import os
import sys
import django

# =====================================================
# 1️⃣ DJANGO SETUP
# =====================================================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Water.settings")

try:
    django.setup()
    print("[SUCCESS] Django setup completed")
except Exception as e:
    print(f"[FATAL] Django setup failed: {e}")
    sys.exit(1)

# =====================================================
# 2️⃣ IMPORT GIS MODULES
# =====================================================
try:
    from django.contrib.gis.utils import LayerMapping
    from django.contrib.gis.gdal import DataSource
    from django.db import connection
    from waterpoints.models import County
    print("[SUCCESS] GIS modules imported")
except Exception as e:
    print(f"[FATAL] Failed to import GIS modules: {e}")
    sys.exit(1)

# =====================================================
# 3️⃣ SHAPEFILE → MODEL FIELD MAPPING
# =====================================================
county_mapping = {
    "county": "county",
    "population_2009": "pop 2009",
    "country": "country",
    "geom": "POLYGON",
}

# =====================================================
# 4️⃣ IMPORT FUNCTION (SPATIALITE SAFE)
# =====================================================
def import_counties(verbose=True):
    shapefile_path = os.path.join(BASE_DIR, "data", "ke_county.shp")

    print(f"[INFO] Shapefile: {shapefile_path}")

    if not os.path.exists(shapefile_path):
        print("[ERROR] Shapefile not found")
        return

    # -------------------------------------------------
    # Clear existing data
    # -------------------------------------------------
    print("[INFO] Deleting existing counties...")
    County.objects.all().delete()

    try:
        # -------------------------------------------------
        # Inspect shapefile (safe)
        # -------------------------------------------------
        ds = DataSource(shapefile_path)
        layer = ds[0]
        feature_count = len(layer)
        print(f"[INFO] Found {feature_count} features")

        # -------------------------------------------------
        # LayerMapping
        # -------------------------------------------------
        lm = LayerMapping(
            County,
            shapefile_path,
            county_mapping,
            transform=True,
            encoding="utf-8",
        )

        print("[INFO] Importing counties...")
        lm.save(
            strict=False,      # tolerate geometry issues
            verbose=verbose,
            progress=True,
        )

        print(f"[SUCCESS] Imported {County.objects.count()} counties")

        # -------------------------------------------------
        # Create Spatialite spatial index
        # -------------------------------------------------
        table_name = County._meta.db_table

        print("[INFO] Creating spatial index...")
        with connection.cursor() as cursor:
            cursor.execute(
                f"SELECT CreateSpatialIndex('{table_name}', 'geom');"
            )

        print("[SUCCESS] Spatial index created")

    except Exception as e:
        print("[ERROR] County import failed")
        import traceback
        traceback.print_exc()

# =====================================================
# 5️⃣ RUN SCRIPT
# =====================================================
if __name__ == "__main__":
    print("=" * 60)
    print("KENYA COUNTY IMPORT (GEODJANGO + SPATIALITE)")
    print("=" * 60)
    import_counties(verbose=True)
    print("[DONE] Import complete")
