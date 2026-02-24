import django_filters
from .models import County, SubCounty, Ward, Bore_hole, water_points
from django.contrib.gis.measure import D
from django.contrib.gis.geos import Point

class CountyFilter(django_filters.FilterSet):
    county__icontains = django_filters.CharFilter(field_name='county', lookup_expr='icontains')
    country = django_filters.CharFilter(lookup_expr='exact')
    min_population = django_filters.NumberFilter(field_name='population_2009', lookup_expr='gte')
    max_population = django_filters.NumberFilter(field_name='population_2009', lookup_expr='lte')
    
    class Meta:
        model = County
        fields = ['county', 'country', 'population_2009']

class SubCountyFilter(django_filters.FilterSet):
    county__icontains = django_filters.CharFilter(field_name='county', lookup_expr='icontains')
    subcounty__icontains = django_filters.CharFilter(field_name='subcounty', lookup_expr='icontains')
    province = django_filters.CharFilter(lookup_expr='icontains')
    
    class Meta:
        model = SubCounty
        fields = ['country', 'province', 'county', 'subcounty']

class WardFilter(django_filters.FilterSet):
    county__icontains = django_filters.CharFilter(field_name='county', lookup_expr='icontains')
    subcounty__icontains = django_filters.CharFilter(field_name='subcounty', lookup_expr='icontains')
    ward__icontains = django_filters.CharFilter(field_name='ward', lookup_expr='icontains')
    
    class Meta:
        model = Ward
        fields = ['county', 'subcounty', 'ward']

class BoreHoleFilter(django_filters.FilterSet):
    # Text filters
    country = django_filters.CharFilter(lookup_expr='icontains')
    admin_1 = django_filters.CharFilter(lookup_expr='icontains')
    locality = django_filters.CharFilter(lookup_expr='icontains')
    
    # Numeric filters
    min_yield = django_filters.NumberFilter(field_name='yield_value', lookup_expr='gte')
    max_yield = django_filters.NumberFilter(field_name='yield_value', lookup_expr='lte')
    min_depth = django_filters.NumberFilter(field_name='well_depth', lookup_expr='gte')
    max_depth = django_filters.NumberFilter(field_name='well_depth', lookup_expr='lte')
    min_ec = django_filters.NumberFilter(field_name='ec', lookup_expr='gte')
    max_ec = django_filters.NumberFilter(field_name='ec', lookup_expr='lte')
    min_ph = django_filters.NumberFilter(field_name='ph', lookup_expr='gte')
    max_ph = django_filters.NumberFilter(field_name='ph', lookup_expr='lte')
    
    # Operation status
    operation_field = django_filters.CharFilter(lookup_expr='icontains')
    
    # Spatial filter - points within a bounding box
    bbox = django_filters.CharFilter(method='filter_bbox')
    
    # Spatial filter - points within a radius of a point
    near = django_filters.CharFilter(method='filter_near')
    
    class Meta:
        model = Bore_hole
        fields = ['country', 'admin_1', 'locality', 'yield_value', 'well_depth', 
                 'operation_field', 'ec', 'ph']
    
    def filter_bbox(self, queryset, name, value):
        """
        Filter by bounding box: min_lon,min_lat,max_lon,max_lat
        Example: ?bbox=34.5,-2.5,35.5,-1.5
        """
        try:
            coords = [float(x) for x in value.split(',')]
            if len(coords) == 4:
                min_lon, min_lat, max_lon, max_lat = coords
                bbox = (min_lon, min_lat, max_lon, max_lat)
                return queryset.filter(geom__within=bbox)
        except (ValueError, TypeError):
            pass
        return queryset
    
    def filter_near(self, queryset, name, value):
        """
        Filter by proximity to a point: lon,lat,distance_km
        Example: ?near=34.5,-2.5,10
        """
        try:
            parts = value.split(',')
            if len(parts) == 3:
                lon, lat, distance_km = float(parts[0]), float(parts[1]), float(parts[2])
                point = Point(lon, lat, srid=4326)
                return queryset.filter(geom__distance_lte=(point, D(km=distance_km)))
        except (ValueError, TypeError):
            pass
        return queryset

class WaterPointFilter(django_filters.FilterSet):
    # Status filters
    status_id = django_filters.CharFilter(lookup_expr='icontains')
    status_cle = django_filters.CharFilter(lookup_expr='icontains')
    
    # Location filters
    clean_adm1 = django_filters.CharFilter(lookup_expr='icontains')
    clean_adm2 = django_filters.CharFilter(lookup_expr='icontains')
    clean_adm3 = django_filters.CharFilter(lookup_expr='icontains')
    
    # Source and technology
    source = django_filters.CharFilter(lookup_expr='icontains')
    water_tech = django_filters.CharFilter(lookup_expr='icontains')
    
    # Date filters
    report_date_after = django_filters.DateFilter(field_name='report_dat', lookup_expr='gte')
    report_date_before = django_filters.DateFilter(field_name='report_dat', lookup_expr='lte')
    
    # Numeric filters
    min_population = django_filters.NumberFilter(field_name='local_popu', lookup_expr='gte')
    max_population = django_filters.NumberFilter(field_name='local_popu', lookup_expr='lte')
    
    # Spatial filters
    bbox = django_filters.CharFilter(method='filter_bbox')
    near = django_filters.CharFilter(method='filter_near')
    
    class Meta:
        model = water_points
        fields = ['status_id', 'status_cle', 'source', 'water_tech', 
                 'clean_adm1', 'clean_adm2', 'clean_adm3']
    
    def filter_bbox(self, queryset, name, value):
        try:
            coords = [float(x) for x in value.split(',')]
            if len(coords) == 4:
                min_lon, min_lat, max_lon, max_lat = coords
                bbox = (min_lon, min_lat, max_lon, max_lat)
                return queryset.filter(geom__within=bbox)
        except (ValueError, TypeError):
            pass
        return queryset
    
    def filter_near(self, queryset, name, value):
        try:
            parts = value.split(',')
            if len(parts) == 3:
                lon, lat, distance_km = float(parts[0]), float(parts[1]), float(parts[2])
                point = Point(lon, lat, srid=4326)
                return queryset.filter(geom__distance_lte=(point, D(km=distance_km)))
        except (ValueError, TypeError):
            pass
        return queryset