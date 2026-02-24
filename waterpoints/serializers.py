# waterpoints/serializers.py
from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from .models import County, SubCounty, Ward, Bore_hole, water_points
from django.contrib.gis.geos import Point
import json

class CountySerializer(serializers.ModelSerializer):
    """Serializer for County model"""
    class Meta:
        model = County
        fields = '__all__'

class CountyGeoSerializer(GeoFeatureModelSerializer):
    """GeoJSON serializer for County model"""
    class Meta:
        model = County
        geo_field = 'geom'
        fields = ('id', 'county', 'population_2009', 'country')

class SubCountySerializer(serializers.ModelSerializer):
    """Serializer for SubCounty model"""
    class Meta:
        model = SubCounty
        fields = '__all__'

class SubCountyGeoSerializer(GeoFeatureModelSerializer):
    """GeoJSON serializer for SubCounty model"""
    class Meta:
        model = SubCounty
        geo_field = 'geom'
        fields = ('id', 'country', 'province', 'county', 'subcounty')

class WardSerializer(serializers.ModelSerializer):
    """Serializer for Ward model"""
    class Meta:
        model = Ward
        fields = '__all__'

class WardGeoSerializer(GeoFeatureModelSerializer):
    """GeoJSON serializer for Ward model"""
    class Meta:
        model = Ward
        geo_field = 'geom'
        fields = ('id', 'county', 'subcounty', 'ward')

class BoreHoleSerializer(serializers.ModelSerializer):
    """Serializer for Bore_hole model"""
    class Meta:
        model = Bore_hole
        fields = '__all__'

class BoreHoleGeoSerializer(GeoFeatureModelSerializer):
    """GeoJSON serializer for Bore_hole model"""
    class Meta:
        model = Bore_hole
        geo_field = 'geom'
        fields = (
            'id', 'country', 'admin_1', 'locality', 'latitude', 'longitude',
            'elevation', 'yield_value', 'well_depth', 'operation_field',
            'drilling_e', 'source_1', 'first_stru', 'second_str', 'third_stru',
            'water_rest', 'ec', 'ph', 'temperatur'
        )

class WaterPointSerializer(serializers.ModelSerializer):
    """Serializer for water_points model"""
    class Meta:
        model = water_points
        fields = '__all__'

class WaterPointGeoSerializer(GeoFeatureModelSerializer):
    """GeoJSON serializer for water_points model"""
    status_color = serializers.SerializerMethodField()
    
    class Meta:
        model = water_points
        geo_field = 'geom'
        fields = (
            'id', 'lat_deg', 'lon_deg', 'status_id', 'report_dat', 'source',
            'water_sour', 'water_tech', 'clean_coun', 'clean_co_1', 'clean_adm1',
            'clean_adm2', 'clean_adm3', 'install_ye', 'installer', 'management',
            'pay_clean', 'status_cle', 'subjective', 'local_popu', 'assigned_p',
            'facility_t', 'water_so_1', 'water_te_1', 'created_ti', 'dataset_ti',
            'rehab_prio', 'would_gain', 'usage_cap', 'criticalit', 'pressure',
            'distance_t', 'distance_1', 'distance_2', 'distance_3', 'distance_4',
            'is_urban', 'days_since', 'staleness', 'prediction', 'predicti_1',
            'predicti_2', 'predicti_3', 'predicted_field', 'predicted1',
            'predicte_1', 'status_color'
        )
    
    def get_status_color(self, obj):
        """Get color based on water point status"""
        if not obj.status_cle:
            return "#95a5a6"  # Gray for unknown
        
        status_lower = obj.status_cle.lower()
        if "functional" in status_lower and "non" not in status_lower:
            return "#2ecc71"  # Green
        elif "non-functional" in status_lower or "non functional" in status_lower:
            return "#e74c3c"  # Red
        elif "repair" in status_lower or "maintenance" in status_lower:
            return "#f39c12"  # Orange
        else:
            return "#3498db"  # Blue for other

class WaterPointDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for water_points with all fields"""
    class Meta:
        model = water_points
        fields = '__all__'
        depth = 0  # No nested relations

class WaterPointSummarySerializer(serializers.Serializer):
    """Serializer for summary statistics"""
    total = serializers.IntegerField()
    functional = serializers.IntegerField()
    non_functional = serializers.IntegerField()
    needs_repair = serializers.IntegerField()
    unknown = serializers.IntegerField()
    functional_percentage = serializers.FloatField()
    total_population = serializers.IntegerField()
    avg_criticality = serializers.FloatField(allow_null=True)

class CountyStatsSerializer(serializers.Serializer):
    """Serializer for county statistics"""
    name = serializers.CharField()
    total = serializers.IntegerField()
    functional = serializers.IntegerField()
    non_functional = serializers.IntegerField()
    needs_repair = serializers.IntegerField()
    functional_pct = serializers.FloatField()
    population = serializers.IntegerField()

class SourceTypeSerializer(serializers.Serializer):
    """Serializer for source type aggregation"""
    source = serializers.CharField()
    count = serializers.IntegerField()

class TechnologyTypeSerializer(serializers.Serializer):
    """Serializer for technology type aggregation"""
    water_tech = serializers.CharField()
    count = serializers.IntegerField()