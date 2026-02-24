import os
import sys
import django
import traceback
from pathlib import Path

# ====== 1️⃣ Setup Django ======
BASE_DIR = Path(__file__).resolve().parent.parent

# Add to path and setup Django
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
    from django.contrib.gis.utils import LayerMapping
    from waterpoints.models import SubCounty
    from django.contrib.gis.gdal import DataSource, OGRGeometry
    from django.contrib.gis.geos import GEOSGeometry, MultiPolygon, Polygon
    from django.db import connection
    from django.db import transaction
    import json
    print("[SUCCESS] GIS modules imported")
except Exception as e:
    print(f"[ERROR] Failed to import GIS modules: {e}")
    sys.exit(1)

# ====== 3️⃣ Alternative import using ogr2ogr ======
def import_with_ogr2ogr():
    """Alternative method using ogr2ogr to convert shapefile to GeoJSON first"""
    import subprocess
    import tempfile
    
    shapefile_path = BASE_DIR / "data" / "ke_subcounty.shp"
    if not shapefile_path.exists():
        print(f"[ERROR] Shapefile not found: {shapefile_path}")
        return False
    
    # Create a temporary GeoJSON file
    with tempfile.NamedTemporaryFile(suffix='.geojson', delete=False) as tmp:
        geojson_path = tmp.name
    
    try:
        print("[INFO] Converting shapefile to GeoJSON...")
        # Use ogr2ogr to convert
        cmd = [
            'ogr2ogr',
            '-f', 'GeoJSON',
            '-t_srs', 'EPSG:4326',
            geojson_path,
            str(shapefile_path)
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"[ERROR] ogr2ogr conversion failed: {result.stderr}")
            return False
        
        print("[INFO] Loading GeoJSON...")
        with open(geojson_path, 'r') as f:
            geojson_data = json.load(f)
        
        import_count = 0
        error_count = 0
        
        for feature in geojson_data['features']:
            try:
                properties = feature['properties']
                geometry = feature['geometry']
                
                # Get attributes
                country_name = properties.get('country', 'Kenya')
                province = properties.get('province', '')
                county_name = properties.get('county', '')
                subcounty_name = properties.get('subcounty', '')
                
                if not subcounty_name:
                    continue
                
                # Convert GeoJSON geometry to WKT
                geom_wkt = GEOSGeometry(json.dumps(geometry))
                
                # Ensure it's a MultiPolygon
                if geom_wkt.geom_type == 'Polygon':
                    geom_wkt = MultiPolygon(geom_wkt)
                
                # Create and save
                subcounty_obj = SubCounty(
                    country=country_name,
                    province=province,
                    county=county_name,
                    subcounty=subcounty_name,
                    geom=geos_geom
                )
                subcounty_obj.save()
                import_count += 1
                
            except Exception as e:
                error_count += 1
                print(f"[ERROR] Failed to import feature: {e}")
                continue
        
        print(f"[SUCCESS] Imported {import_count} features from GeoJSON")
        print(f"[INFO] Failed imports: {error_count}")
        return True
        
    except Exception as e:
        print(f"[ERROR] GeoJSON import failed: {e}")
        return False
    finally:
        # Clean up temporary file
        if os.path.exists(geojson_path):
            os.unlink(geojson_path)

# ====== 4️⃣ Direct GDAL import with better error handling ======
def import_with_gdal_direct():
    """Direct import using GDAL with better geometry handling"""
    
    shapefile_path = BASE_DIR / "data" / "ke_subcounty.shp"
    if not shapefile_path.exists():
        print(f"[ERROR] Shapefile not found: {shapefile_path}")
        return 0
    
    print(f"[INFO] Loading shapefile: {shapefile_path}")
    
    try:
        # Clear existing data
        SubCounty.objects.all().delete()
        
        # Open data source
        ds = DataSource(str(shapefile_path))
        layer = ds[0]
        
        print(f"[INFO] Found {len(layer)} features")
        print(f"[INFO] Geometry type: {layer.geom_type}")
        
        import_count = 0
        error_count = 0
        
        for i, feat in enumerate(layer):
            try:
                # Get attributes
                props = {}
                for field in layer.fields:
                    props[field] = feat.get(field)
                
                country_name = props.get('country', 'Kenya')
                province = props.get('province', '')
                county_name = props.get('county', '')
                subcounty_name = props.get('subcounty', '')
                
                if not subcounty_name or subcounty_name.strip() == '':
                    continue
                
                # Get geometry - try multiple methods
                geom = feat.geom
                
                # Method 1: Try to get geometry as GeoJSON
                try:
                    geom_json = geom.geojson
                    if geom_json:
                        geom_wkt = GEOSGeometry(geom_json)
                    else:
                        raise ValueError("Empty GeoJSON")
                except:
                    # Method 2: Try to get WKB (binary)
                    try:
                        wkb = geom.wkb
                        if wkb:
                            geom_wkt = GEOSGeometry(wkb)
                        else:
                            raise ValueError("Empty WKB")
                    except:
                        # Method 3: Try hex WKB
                        try:
                            hex_wkb = geom.hex
                            if hex_wkb:
                                geom_wkt = GEOSGeometry(memoryview(bytes.fromhex(hex_wkb)))
                            else:
                                raise ValueError("Empty hex WKB")
                        except:
                            # Method 4: Last resort - try to fix WKT
                            wkt_str = str(geom.wkt)
                            # Check if WKT is truncated
                            if '...' in wkt_str:
                                # Try to reconstruct from OGR geometry
                                ogr_geom = OGRGeometry(wkt_str)
                                # Get coordinates and reconstruct
                                coords = []
                                for ring in ogr_geom.coords:
                                    ring_coords = []
                                    for coord in ring:
                                        if isinstance(coord, (list, tuple)):
                                            ring_coords.append(tuple(coord))
                                        else:
                                            break
                                    if ring_coords:
                                        coords.append(ring_coords)
                                
                                if coords:
                                    # Create new geometry
                                    if len(coords) == 1:
                                        geom_wkt = Polygon(coords[0])
                                    else:
                                        geom_wkt = MultiPolygon([Polygon(ring) for ring in coords])
                                else:
                                    raise ValueError("No valid coordinates found")
                            else:
                                # Try to parse as-is
                                geom_wkt = GEOSGeometry(wkt_str)
                
                # Ensure it's a MultiPolygon
                if geom_wkt.geom_type == 'Polygon':
                    geom_wkt = MultiPolygon(geom_wkt)
                
                # Fix geometry if invalid
                if not geom_wkt.valid:
                    geom_wkt = geom_wkt.buffer(0)
                
                # Create and save
                subcounty_obj = SubCounty(
                    country=country_name,
                    province=province,
                    county=county_name,
                    subcounty=subcounty_name,
                    geom=geos_geom
                )
                subcounty_obj.save()
                import_count += 1
                
                if import_count % 50 == 0:
                    print(f"[PROGRESS] Imported {import_count} features...")
                    
            except Exception as e:
                error_count += 1
                print(f"[ERROR] Failed feature {i}: {str(e)[:100]}")
                continue
        
        return import_count
        
    except Exception as e:
        print(f"[ERROR] GDAL import failed: {e}")
        traceback.print_exc()
        return 0

# ====== 5️⃣ Simple fix approach ======
def import_with_simple_fix():
    """Simple approach focusing on fixing the WKT issue"""
    
    shapefile_path = BASE_DIR / "data" / "ke_subcounty.shp"
    if not shapefile_path.exists():
        print(f"[ERROR] Shapefile not found: {shapefile_path}")
        return 0
    
    print(f"[INFO] Loading shapefile: {shapefile_path}")
    
    try:
        # Clear existing data
        SubCounty.objects.all().delete()
        
        # Open data source
        ds = DataSource(str(shapefile_path))
        layer = ds[0]
        
        import_count = 0
        error_count = 0
        
        for i, feat in enumerate(layer):
            try:
                # Get attributes
                country_name = feat.get('country') or 'Kenya'
                province = feat.get('province') or ''
                county_name = feat.get('county') or ''
                subcounty_name = feat.get('subcounty') or ''
                
                if not subcounty_name:
                    continue
                
                # Get OGR geometry
                ogr_geom = feat.geom
                
                # Convert OGRGeometry to GEOSGeometry using ewkt
                # This often works better than wkt
                ewkt = ogr_geom.ewkt
                
                # Parse ewkt to get SRID and geometry
                if ewkt.startswith('SRID='):
                    # Extract SRID and WKT
                    parts = ewkt.split(';', 1)
                    if len(parts) == 2:
                        srid_part = parts[0]
                        wkt_part = parts[1]
                        srid = int(srid_part.replace('SRID=', ''))
                        geos_geom = GEOSGeometry(wkt_part, srid=srid)
                    else:
                        geos_geom = GEOSGeometry(ewkt)
                else:
                    geos_geom = GEOSGeometry(ewkt)
                
                # Convert to MultiPolygon if needed
                if geos_geom.geom_type == 'Polygon':
                    geos_geom = MultiPolygon(geos_geom)
                
                # Create and save
                subcounty_obj = SubCounty(
                    country=country_name,
                    province=province,
                    county=county_name,
                    subcounty=subcounty_name,
                    geom=geos_geom
                )
                
                subcounty_obj.save()
                import_count += 1
                
                if import_count % 50 == 0:
                    print(f"[PROGRESS] Imported {import_count} features...")
                    
            except Exception as e:
                error_count += 1
                # Try one more approach for this feature
                try:
                    # Alternative: use hex representation
                    ogr_geom = feat.geom
                    hex_wkb = ogr_geom.hex
                    if hex_wkb:
                        geos_geom = GEOSGeometry(memoryview(bytes.fromhex(hex_wkb)))
                        
                        if geos_geom.geom_type == 'Polygon':
                            geos_geom = MultiPolygon(geos_geom)
                        
                        # Get attributes again
                        country_name = feat.get('country') or 'Kenya'
                        province = feat.get('province') or ''
                        county_name = feat.get('county') or ''
                        subcounty_name = feat.get('subcounty') or ''
                        
                        subcounty_obj =  SubCounty(
                            country=country_name,
                            province=province,
                            county=county_name,
                            subcounty=subcounty_name,
                            geom=geos_geom
                        )
                        
                        subcounty_obj.save()
                        import_count += 1
                        error_count -= 1  # Decrease error count since we recovered
                        print(f"[RECOVERED] Feature {i} imported using hex WKB")
                        
                except Exception as e2:
                    print(f"[ERROR] Feature {i} failed all methods: {str(e)[:100]}")
                    continue
        
        return import_count
        
    except Exception as e:
        print(f"[ERROR] Simple fix import failed: {e}")
        traceback.print_exc()
        return 0

# ====== 6️⃣ Main import function ======
def import_data():
    """Main import function that tries multiple methods"""
    
    print("=" * 60)
    print("SUB-COUNTY DATA IMPORT SCRIPT")
    print("=" * 60)
    
    # Try method 1: Simple fix
    print("\n[INFO] Attempting Method 1: Simple fix...")
    count1 = import_with_simple_fix()
    
    if count1 > 100:  # If we got a reasonable number of features
        print(f"[SUCCESS] Method 1 imported {count1} features")
        
        # Create indexes
        print("\n[INFO] Creating indexes...")
        with connection.cursor() as cursor:
            try:
                cursor.execute("""
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_indexes 
                            WHERE indexname = 'idx_subcounty_geom'
                        ) THEN
                            CREATE INDEX idx_subcounty_geom ON hospitals_sub_county USING GIST (geom);
                        END IF;
                    END
                    $$;
                """)
                print("[SUCCESS] Spatial index created")
            except Exception as e:
                print(f"[WARNING] Index creation: {e}")
                
        return
    
    # If method 1 failed, try method 2
    print("\n[INFO] Method 1 didn't get enough features, trying Method 2...")
    count2 = import_with_gdal_direct()
    
    if count2 > 100:
        print(f"[SUCCESS] Method 2 imported {count2} features")
        return
    
    # If both failed, try ogr2ogr method
    print("\n[INFO] Both methods failed, trying ogr2ogr conversion...")
    if import_with_ogr2ogr():
        print("[SUCCESS] GeoJSON import completed")
    else:
        print("[ERROR] All import methods failed")
        
        # Diagnostic: Check shapefile
        print("\n[DIAGNOSTIC] Checking shapefile...")
        try:
            shapefile_path = BASE_DIR / "data" / "ke_subcounty.shp"
            ds = DataSource(str(shapefile_path))
            layer = ds[0]
            print(f"  - Layer name: {layer.name}")
            print(f"  - Feature count: {len(layer)}")
            print(f"  - Geometry type: {layer.geom_type}")
            print(f"  - Fields: {layer.fields}")
            
            # Check first feature
            if len(layer) > 0:
                feat = layer[0]
                print(f"\n  First feature attributes:")
                for field in layer.fields:
                    print(f"    {field}: {feat.get(field)}")
                
                # Try to get geometry in different formats
                geom = feat.geom
                print(f"\n  Geometry tests:")
                print(f"    WKT length: {len(str(geom.wkt))}")
                print(f"    GeoJSON available: {bool(geom.geojson)}")
                print(f"    WKB available: {bool(geom.wkb)}")
                print(f"    Hex WKB available: {bool(geom.hex)}")
                
        except Exception as e:
            print(f"  Diagnostic failed: {e}")

# ====== 7️⃣ Run script ======
if __name__ == "__main__":
    try:
        import_data()
        print("\n" + "=" * 60)
        print("IMPORT PROCESS COMPLETED")
        print("=" * 60)
    except KeyboardInterrupt:
        print("\n[INFO] Import interrupted by user")
    except Exception as e:
        print(f"\n[ERROR] Script failed: {e}")
        traceback.print_exc()