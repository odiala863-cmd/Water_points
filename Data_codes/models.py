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