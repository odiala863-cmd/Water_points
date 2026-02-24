from django.contrib.gis.db import models

class County(models.Model):
    county = models.CharField(max_length=254, null=True, blank=True)
    population_2009 = models.BigIntegerField(null=True, blank=True)
    country = models.CharField(max_length=5, null=True, blank=True)
    geom = models.MultiPolygonField(srid=4326, null=True, blank=True)

    def __str__(self):
        return self.county or "Unknown County"
    
    class Meta:
        verbose_name_plural = "Counties"

class SubCounty(models.Model):
    country = models.CharField(max_length=254, null=True, blank=True)
    province = models.CharField(max_length=254, null=True, blank=True)
    county = models.CharField(max_length=254, null=True, blank=True)
    subcounty = models.CharField(max_length=254, null=True, blank=True)
    geom = models.MultiPolygonField(srid=4326, null=True, blank=True)

    def __str__(self):
        return self.subcounty or "Unknown SubCounty"
    
    class Meta:
        verbose_name_plural = "SubCounties"

class Ward(models.Model):
    county = models.CharField(max_length=80, null=True, blank=True)
    subcounty = models.CharField(max_length=80, null=True, blank=True)
    ward = models.CharField(max_length=80, null=True, blank=True)
    geom = models.MultiPolygonField(srid=4326, null=True, blank=True)

    def __str__(self):
        return self.ward or "Unknown Ward"
    
    class Meta:
        verbose_name_plural = "Wards"
        
# models.py - Bore_hole class only (update this part)
class Bore_hole(models.Model):
    country = models.CharField(max_length=254, null=True, blank=True)
    admin_1 = models.CharField(max_length=254, null=True, blank=True)
    locality = models.CharField(max_length=254, null=True, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    elevation = models.CharField(max_length=254, null=True, blank=True)
    
    # CRITICAL: Use 'yield' as db_column name, but 'yield_value' as model field name
    yield_value = models.FloatField(db_column="yield", null=True, blank=True)
    
    well_depth = models.CharField(max_length=254, null=True, blank=True)
    
    # Shapefile has 'operation_' (with underscore)
    operation_field = models.CharField(max_length=254, null=True, blank=True, db_column="operation_")
    
    drilling_e = models.CharField(max_length=254, null=True, blank=True)
    source_1 = models.CharField(max_length=254, null=True, blank=True)
    first_stru = models.CharField(max_length=254, null=True, blank=True)
    second_str = models.CharField(max_length=254, null=True, blank=True)
    third_stru = models.CharField(max_length=254, null=True, blank=True)
    water_rest = models.CharField(max_length=254, null=True, blank=True)
    ec = models.BigIntegerField(null=True, blank=True)
    ph = models.FloatField(null=True, blank=True)
    temperatur = models.CharField(max_length=254, null=True, blank=True)
    geom = models.PointField(srid=4326, null=True, blank=True)

    def __str__(self):
        return self.locality or f"Borehole at {self.latitude}, {self.longitude}"

    class Meta:
        verbose_name_plural = "Boreholes"
        
        

class water_points(models.Model):
    lat_deg = models.FloatField(null=True, blank=True)
    lon_deg = models.FloatField(null=True, blank=True)

    status_id = models.CharField(max_length=254, null=True, blank=True)
    report_dat = models.DateField(null=True, blank=True)

    source = models.CharField(max_length=254, null=True, blank=True)
    water_sour = models.CharField(max_length=254, null=True, blank=True)
    water_tech = models.CharField(max_length=254, null=True, blank=True)

    clean_coun = models.CharField(max_length=254, null=True, blank=True)
    clean_co_1 = models.CharField(max_length=254, null=True, blank=True)
    clean_adm1 = models.CharField(max_length=254, null=True, blank=True)
    clean_adm2 = models.CharField(max_length=254, null=True, blank=True)
    clean_adm3 = models.CharField(max_length=254, null=True, blank=True)

    install_ye = models.BigIntegerField(null=True, blank=True)
    installer = models.CharField(max_length=254, null=True, blank=True)
    management = models.CharField(max_length=254, null=True, blank=True)
    pay_clean = models.CharField(max_length=254, null=True, blank=True)
    status_cle = models.CharField(max_length=254, null=True, blank=True)
    subjective = models.CharField(max_length=254, null=True, blank=True)

    local_popu = models.BigIntegerField(null=True, blank=True)
    assigned_p = models.BigIntegerField(null=True, blank=True)

    facility_t = models.CharField(max_length=254, null=True, blank=True)
    water_so_1 = models.CharField(max_length=254, null=True, blank=True)
    water_te_1 = models.CharField(max_length=254, null=True, blank=True)

    created_ti = models.CharField(max_length=254, null=True, blank=True)
    dataset_ti = models.CharField(max_length=254, null=True, blank=True)

    rehab_prio = models.BigIntegerField(null=True, blank=True)
    would_gain = models.BigIntegerField(null=True, blank=True)
    usage_cap = models.BigIntegerField(null=True, blank=True)

    criticalit = models.FloatField(null=True, blank=True)
    pressure = models.FloatField(null=True, blank=True)

    distance_t = models.FloatField(null=True, blank=True)
    distance_1 = models.FloatField(null=True, blank=True)
    distance_2 = models.FloatField(null=True, blank=True)
    distance_3 = models.FloatField(null=True, blank=True)
    distance_4 = models.FloatField(null=True, blank=True)

    is_urban = models.CharField(max_length=254, null=True, blank=True)
    days_since = models.BigIntegerField(null=True, blank=True)
    staleness = models.FloatField(null=True, blank=True)

    prediction = models.FloatField(null=True, blank=True)
    predicti_1 = models.FloatField(null=True, blank=True)
    predicti_2 = models.FloatField(null=True, blank=True)
    predicti_3 = models.FloatField(null=True, blank=True)

    predicted_field = models.CharField(max_length=254, null=True, blank=True)
    predicted1 = models.CharField(max_length=254, null=True, blank=True)
    predicte_1 = models.CharField(max_length=254, null=True, blank=True)

    geom = models.PointField(srid=4326, null=True, blank=True)

    def __str__(self):
        return f"WaterPoint at {self.lat_deg}, {self.lon_deg}"

    class Meta:
        verbose_name = "Water Point"
        verbose_name_plural = "Water Points"
