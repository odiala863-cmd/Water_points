import os
import sys
import django
import traceback
from pathlib import Path

# ====== 1️⃣ Setup Django ======
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Water.settings")

try:
    django.setup()
    print("[SUCCESS] Django setup completed")
except Exception as e:
    print(f"[ERROR] Django setup failed: {e}")
    sys.exit(1)

# ====== 2️⃣ Import GIS modules ======
try:
    from waterpoints.models import Ward
    from django.contrib.gis.gdal import DataSource
    from django.contrib.gis.geos import GEOSGeometry, MultiPolygon, Polygon, GeometryCollection
    from django.db import connection
    print("[SUCCESS] GIS modules imported")
except Exception as e:
    print(f"[ERROR] Failed to import GIS modules: {e}")
    sys.exit(1)

# ====== 3️⃣ Ward import function ======
def import_wards(verbose=True):
    """Import ward shapefile into Django GIS model with robust geometry handling."""

    # Possible shapefile names
    possible_files = ['ke_wards.shp', 'wards.shp', 'kenya_wards.shp', 'ke_ward.shp', 'Ward.shp']
    shapefile_path = None

    for filename in possible_files:
        path = BASE_DIR / "data" / filename
        if path.exists():
            shapefile_path = path
            break

    if not shapefile_path:
        print(f"[ERROR] Ward shapefile not found. Tried: {', '.join(possible_files)}")
        return 0

    print(f"[INFO] Loading ward shapefile from: {shapefile_path}")

    # Clear existing data
    print("[INFO] Clearing existing Ward data...")
    Ward.objects.all().delete()

    try:
        ds = DataSource(str(shapefile_path))
        layer = ds[0]
        num_features = len(layer)
        print(f"[INFO] Found {num_features} features, Geometry type: {layer.geom_type}")

        import_count = 0
        error_count = 0
        skipped_count = 0
        batch_size = 100
        batch_objects = []

        for i, feature in enumerate(layer):
            try:
                # Extract attributes
                county_name = feature.get('county') or feature.get('County') or ''
                subcounty_name = feature.get('subcounty') or feature.get('Subcounty') or feature.get('sub_county') or ''
                ward_name = feature.get('ward') or feature.get('Ward') or ''

                if not ward_name.strip():
                    skipped_count += 1
                    if verbose and skipped_count <= 10:
                        print(f"[WARNING] Feature {i} has no ward name, skipping...")
                    continue

                geom = feature.geom

                # Convert geometry to GEOS
                try:
                    geos_geom = GEOSGeometry(memoryview(bytes.fromhex(geom.hex)))
                except:
                    ewkt = geom.ewkt
                    if ewkt.startswith('SRID='):
                        srid, wkt = ewkt.split(';', 1)
                        srid = int(srid.replace('SRID=', ''))
                        geos_geom = GEOSGeometry(wkt, srid=srid)
                    else:
                        geos_geom = GEOSGeometry(str(geom.wkt))

                # Ensure MultiPolygon
                if geos_geom.geom_type == 'Polygon':
                    geos_geom = MultiPolygon(geos_geom)
                elif geos_geom.geom_type == 'GeometryCollection':
                    polygons = [g for g in geos_geom if g.geom_type == 'Polygon']
                    if polygons:
                        geos_geom = MultiPolygon(polygons)
                    else:
                        raise ValueError("GeometryCollection contains no polygons")
                elif geos_geom.geom_type != 'MultiPolygon':
                    raise ValueError(f"Unexpected geometry type: {geos_geom.geom_type}")

                # Fix invalid geometry
                if not geos_geom.valid:
                    geos_geom = geos_geom.buffer(0)
                    if geos_geom.geom_type == 'Polygon':
                        geos_geom = MultiPolygon(geos_geom)
                    elif geos_geom.geom_type == 'GeometryCollection':
                        polygons = [g for g in geos_geom if g.geom_type == 'Polygon']
                        if polygons:
                            geos_geom = MultiPolygon(polygons)
                        else:
                            raise ValueError("Could not extract polygons after buffer")

                ward_obj = Ward(
                    county=county_name,
                    subcounty=subcounty_name,
                    ward=ward_name,
                    geom=geos_geom
                )

                batch_objects.append(ward_obj)
                import_count += 1

                if len(batch_objects) >= batch_size:
                    Ward.objects.bulk_create(batch_objects, batch_size=batch_size)
                    batch_objects = []
                    if verbose:
                        print(f"[PROGRESS] Imported {import_count}/{num_features} wards...")

            except Exception as e:
                error_count += 1
                if verbose and error_count <= 10:
                    print(f"[ERROR] Feature {i} ({ward_name[:50]}): {str(e)[:100]}")
                continue

        # Insert remaining objects
        if batch_objects:
            Ward.objects.bulk_create(batch_objects, batch_size=batch_size)

        print(f"\n[SUMMARY] Import complete: {import_count} imported, {skipped_count} skipped, {error_count} failed")

        # Create indexes (SQLite/Spatialite-compatible)
        print("\n[INFO] Creating indexes...")
        with connection.cursor() as cursor:
            index_queries = [
                "CREATE INDEX IF NOT EXISTS idx_wards_geom ON waterpoints_ward(geom);",
                "CREATE INDEX IF NOT EXISTS idx_wards_ward ON waterpoints_ward(ward);",
                "CREATE INDEX IF NOT EXISTS idx_wards_subcounty ON waterpoints_ward(subcounty);",
                "CREATE INDEX IF NOT EXISTS idx_wards_county ON waterpoints_ward(county);",
            ]
            for query in index_queries:
                try:
                    cursor.execute(query)
                    print(f"[SUCCESS] Executed: {query}")
                except Exception as e:
                    print(f"[WARNING] Failed to execute index query: {e}")

        return import_count

    except Exception as e:
        print(f"[ERROR] Ward import failed: {e}")
        traceback.print_exc()
        return 0

# ====== 4️⃣ Main function ======
def main():
    print("="*60)
    print("WARD DATA IMPORT SCRIPT")
    print("="*60)

    try:
        imported = import_wards(verbose=True)
    except Exception as e:
        print(f"[ERROR] Import failed: {e}")
        imported = 0

    try:
        total_count = Ward.objects.count()
        print(f"\n[INFO] Current ward count in database: {total_count}")
    except Exception as e:
        print(f"[ERROR] Failed to count wards: {e}")
        total_count = 0

    print("="*60)
    print(f"FINAL RESULT: {total_count} wards imported")
    print("="*60)

# ====== 5️⃣ Run script ======
if __name__ == "__main__":
    try:
        main()
        print("\n[COMPLETE] Ward import finished!")
    except KeyboardInterrupt:
        print("\n[INFO] Import interrupted by user")
    except Exception as e:
        print(f"[ERROR] Script failed: {e}")
        traceback.print_exc()

    # Flush output and exit safely
    sys.stdout.flush()
    sys.stderr.flush()
    os._exit(0)
