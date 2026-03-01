from django.contrib.gis.db import models

class County(models.Model):
    county = models.CharField(max_length=254, null=True, blank=True, db_index=True)
    population_2009 = models.BigIntegerField(null=True, blank=True)
    country = models.CharField(max_length=5, null=True, blank=True, db_index=True)
    geom = models.MultiPolygonField(srid=4326, null=True, blank=True, spatial_index=True)

    def __str__(self):
        return self.county or "Unknown County"
    
    class Meta:
        verbose_name_plural = "Counties"
        indexes = [
            models.Index(fields=['county']),
            models.Index(fields=['country']),
        ]

class SubCounty(models.Model):
    country = models.CharField(max_length=254, null=True, blank=True, db_index=True)
    province = models.CharField(max_length=254, null=True, blank=True, db_index=True)
    county = models.CharField(max_length=254, null=True, blank=True, db_index=True)
    subcounty = models.CharField(max_length=254, null=True, blank=True, db_index=True)
    geom = models.MultiPolygonField(srid=4326, null=True, blank=True, spatial_index=True)

    def __str__(self):
        return self.subcounty or "Unknown SubCounty"
    
    class Meta:
        verbose_name_plural = "SubCounties"
        indexes = [
            models.Index(fields=['county']),
            models.Index(fields=['subcounty']),
            models.Index(fields=['country']),
            models.Index(fields=['province']),
        ]

class Ward(models.Model):
    county = models.CharField(max_length=80, null=True, blank=True, db_index=True)
    subcounty = models.CharField(max_length=80, null=True, blank=True, db_index=True)
    ward = models.CharField(max_length=80, null=True, blank=True, db_index=True)
    geom = models.MultiPolygonField(srid=4326, null=True, blank=True, spatial_index=True)

    def __str__(self):
        return self.ward or "Unknown Ward"
    
    class Meta:
        verbose_name_plural = "Wards"
        indexes = [
            models.Index(fields=['county']),
            models.Index(fields=['subcounty']),
            models.Index(fields=['ward']),
        ]

class Bore_hole(models.Model):
    country = models.CharField(max_length=254, null=True, blank=True, db_index=True)
    admin_1 = models.CharField(max_length=254, null=True, blank=True, db_index=True)
    locality = models.CharField(max_length=254, null=True, blank=True, db_index=True)
    latitude = models.FloatField(null=True, blank=True, db_index=True)
    longitude = models.FloatField(null=True, blank=True, db_index=True)
    elevation = models.CharField(max_length=254, null=True, blank=True)
    
    # CRITICAL: Use 'yield' as db_column name, but 'yield_value' as model field name
    yield_value = models.FloatField(db_column="yield", null=True, blank=True, db_index=True)
    
    well_depth = models.CharField(max_length=254, null=True, blank=True)
    
    # Shapefile has 'operation_' (with underscore)
    operation_field = models.CharField(
        max_length=254, 
        null=True, 
        blank=True, 
        db_column="operation_",
        db_index=True
    )
    
    drilling_e = models.CharField(max_length=254, null=True, blank=True)
    source_1 = models.CharField(max_length=254, null=True, blank=True, db_index=True)
    first_stru = models.CharField(max_length=254, null=True, blank=True)
    second_str = models.CharField(max_length=254, null=True, blank=True)
    third_stru = models.CharField(max_length=254, null=True, blank=True)
    water_rest = models.CharField(max_length=254, null=True, blank=True)
    ec = models.BigIntegerField(null=True, blank=True, db_index=True)
    ph = models.FloatField(null=True, blank=True, db_index=True)
    temperatur = models.CharField(max_length=254, null=True, blank=True)
    geom = models.PointField(srid=4326, null=True, blank=True, spatial_index=True)
    
    # Timestamp for data freshness
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.locality or f"Borehole at {self.latitude}, {self.longitude}"

    class Meta:
        verbose_name_plural = "Boreholes"
        indexes = [
            # Status and location indexes
            models.Index(fields=['operation_field']),
            models.Index(fields=['admin_1']),
            models.Index(fields=['country']),
            models.Index(fields=['locality']),
            
            # Numeric field indexes for aggregations
            models.Index(fields=['yield_value']),
            models.Index(fields=['ec']),
            models.Index(fields=['ph']),
            
            # Composite indexes for common queries
            models.Index(fields=['admin_1', 'operation_field']),
            models.Index(fields=['admin_1', 'yield_value']),
            
            # Coordinate indexes for spatial queries
            models.Index(fields=['latitude', 'longitude']),
            
            # Timestamp index for data freshness queries
            models.Index(fields=['-updated_at']),
            models.Index(fields=['-created_at']),
        ]

class water_points(models.Model):
    # Coordinates
    lat_deg = models.FloatField(null=True, blank=True, db_index=True)
    lon_deg = models.FloatField(null=True, blank=True, db_index=True)

    # Status and reporting
    status_id = models.CharField(max_length=254, null=True, blank=True, db_index=True)
    report_dat = models.DateField(null=True, blank=True, db_index=True)

    # Water source information
    source = models.CharField(max_length=254, null=True, blank=True, db_index=True)
    water_sour = models.CharField(max_length=254, null=True, blank=True, db_index=True)
    water_tech = models.CharField(max_length=254, null=True, blank=True, db_index=True)

    # Administrative boundaries
    clean_coun = models.CharField(max_length=254, null=True, blank=True, db_index=True)
    clean_co_1 = models.CharField(max_length=254, null=True, blank=True, db_index=True)
    clean_adm1 = models.CharField(max_length=254, null=True, blank=True, db_index=True)
    clean_adm2 = models.CharField(max_length=254, null=True, blank=True, db_index=True)
    clean_adm3 = models.CharField(max_length=254, null=True, blank=True, db_index=True)

    # Installation details
    install_ye = models.BigIntegerField(null=True, blank=True, db_index=True)
    installer = models.CharField(max_length=254, null=True, blank=True)
    
    # Management and payment
    management = models.CharField(max_length=254, null=True, blank=True, db_index=True)
    pay_clean = models.CharField(max_length=254, null=True, blank=True)
    
    # Status classification
    status_cle = models.CharField(max_length=254, null=True, blank=True, db_index=True)
    subjective = models.CharField(max_length=254, null=True, blank=True)

    # Population data
    local_popu = models.BigIntegerField(null=True, blank=True, db_index=True)
    assigned_p = models.BigIntegerField(null=True, blank=True, db_index=True)

    # Facility type
    facility_t = models.CharField(max_length=254, null=True, blank=True)
    water_so_1 = models.CharField(max_length=254, null=True, blank=True)
    water_te_1 = models.CharField(max_length=254, null=True, blank=True)

    # Timestamps
    created_ti = models.CharField(max_length=254, null=True, blank=True)
    dataset_ti = models.CharField(max_length=254, null=True, blank=True)

    # Priority and usage metrics
    rehab_prio = models.BigIntegerField(null=True, blank=True)
    would_gain = models.BigIntegerField(null=True, blank=True)
    usage_cap = models.BigIntegerField(null=True, blank=True)

    # Criticality and pressure
    criticalit = models.FloatField(null=True, blank=True)
    pressure = models.FloatField(null=True, blank=True)

    # Distance metrics
    distance_t = models.FloatField(null=True, blank=True)
    distance_1 = models.FloatField(null=True, blank=True)
    distance_2 = models.FloatField(null=True, blank=True)
    distance_3 = models.FloatField(null=True, blank=True)
    distance_4 = models.FloatField(null=True, blank=True)

    # Urban/rural classification
    is_urban = models.CharField(max_length=254, null=True, blank=True)
    days_since = models.BigIntegerField(null=True, blank=True)
    staleness = models.FloatField(null=True, blank=True)

    # Prediction fields
    prediction = models.FloatField(null=True, blank=True)
    predicti_1 = models.FloatField(null=True, blank=True)
    predicti_2 = models.FloatField(null=True, blank=True)
    predicti_3 = models.FloatField(null=True, blank=True)

    predicted_field = models.CharField(max_length=254, null=True, blank=True)
    predicted1 = models.CharField(max_length=254, null=True, blank=True)
    predicte_1 = models.CharField(max_length=254, null=True, blank=True)

    # Geometry
    geom = models.PointField(srid=4326, null=True, blank=True, spatial_index=True)
    
    # System fields for data management
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Data quality flag
    is_valid = models.BooleanField(default=True, db_index=True)

    def __str__(self):
        return f"WaterPoint at {self.lat_deg}, {self.lon_deg}"

    class Meta:
        verbose_name = "Water Point"
        verbose_name_plural = "Water Points"
        indexes = [
            # Status and functionality indexes
            models.Index(fields=['status_cle']),
            models.Index(fields=['report_dat']),
            models.Index(fields=['status_id']),
            
            # Administrative boundary indexes
            models.Index(fields=['clean_adm1']),
            models.Index(fields=['clean_adm2']),
            models.Index(fields=['clean_adm3']),
            models.Index(fields=['clean_coun']),
            
            # Water source indexes
            models.Index(fields=['water_sour']),
            models.Index(fields=['water_tech']),
            models.Index(fields=['source']),
            models.Index(fields=['management']),
            
            # Numeric field indexes for aggregations
            models.Index(fields=['assigned_p']),
            models.Index(fields=['local_popu']),
            models.Index(fields=['install_ye']),
            
            # Composite indexes for common query patterns
            models.Index(fields=['clean_adm1', 'status_cle']),
            models.Index(fields=['clean_adm1', 'water_sour']),
            models.Index(fields=['clean_adm1', 'assigned_p']),
            models.Index(fields=['report_dat', 'status_cle']),
            
            # Coordinate indexes for spatial queries
            models.Index(fields=['lat_deg', 'lon_deg']),
            
            # Data quality and freshness
            models.Index(fields=['is_valid']),
            models.Index(fields=['-updated_at']),
            models.Index(fields=['-created_at']),
            models.Index(fields=['staleness']),
            models.Index(fields=['days_since']),
            
            # Priority and planning indexes
            models.Index(fields=['rehab_prio']),
            models.Index(fields=['criticalit']),
            models.Index(fields=['pressure']),
        ]
        
        # Add table-level comments for documentation
        db_table_comment = "Water points data with spatial and attribute information"