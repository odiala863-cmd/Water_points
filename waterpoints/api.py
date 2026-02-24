# waterpoints/api.py
from rest_framework import viewsets, generics, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Count, Avg, Sum, Min, Max
from django.contrib.gis.db.models import Union
from django.contrib.gis.geos import GEOSGeometry
from django.utils import timezone
from datetime import timedelta, datetime
import json

from .models import County, SubCounty, Ward, Bore_hole, water_points
from .serializers import (
    CountySerializer, CountyGeoSerializer,
    SubCountySerializer, SubCountyGeoSerializer,
    WardSerializer, WardGeoSerializer,
    BoreHoleSerializer, BoreHoleGeoSerializer,
    WaterPointSerializer, WaterPointGeoSerializer,
    WaterPointDetailSerializer, WaterPointSummarySerializer,
    CountyStatsSerializer, SourceTypeSerializer, TechnologyTypeSerializer
)

class StandardResultsSetPagination(PageNumberPagination):
    """Standard pagination for API results"""
    page_size = 100
    page_size_query_param = 'page_size'
    max_page_size = 1000

# ============= COUNTY VIEWSET =============
class CountyViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for County data.
    Supports GeoJSON format with ?format=geojson
    """
    queryset = County.objects.all()
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['country', 'county']
    search_fields = ['county', 'country']
    ordering_fields = ['county', 'population_2009']
    
    def get_serializer_class(self):
        if self.request.query_params.get('format') == 'geojson':
            return CountyGeoSerializer
        return CountySerializer
    
    @action(detail=True, methods=['get'])
    def statistics(self, request, pk=None):
        """Get statistics for a specific county"""
        county = self.get_object()
        
        # Get water points in this county
        water_points_qs = water_points.objects.filter(clean_adm1__iexact=county.county)
        
        total = water_points_qs.count()
        functional = water_points_qs.filter(status_cle__iexact='functional').count()
        non_functional = water_points_qs.filter(
            Q(status_cle__iexact='non-functional') | 
            Q(status_cle__iexact='non functional')
        ).count()
        needs_repair = water_points_qs.filter(
            Q(status_cle__iexact='needs repair') |
            Q(status_cle__iexact='needs major repair') |
            Q(status_cle__iexact='needs minor repair')
        ).count()
        
        # Get boreholes
        boreholes = Bore_hole.objects.filter(admin_1__iexact=county.county)
        
        stats = {
            'county_name': county.county,
            'total_water_points': total,
            'functional_water_points': functional,
            'non_functional_water_points': non_functional,
            'needs_repair_water_points': needs_repair,
            'functional_percentage': round((functional / total) * 100, 1) if total > 0 else 0,
            'total_boreholes': boreholes.count(),
            'total_population_served': water_points_qs.aggregate(Sum('assigned_p'))['assigned_p__sum'] or 0,
            'area_sq_km': county.geom.area * 10000 / 1000000 if county.geom else 0
        }
        
        return Response(stats)
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get summary of all counties"""
        counties = self.get_queryset()
        data = []
        
        for county in counties:
            water_points_qs = water_points.objects.filter(clean_adm1__iexact=county.county)
            total = water_points_qs.count()
            
            data.append({
                'id': county.id,
                'name': county.county,
                'total_water_points': total,
                'population': county.population_2009,
                'has_geometry': county.geom is not None
            })
        
        return Response(data)

# ============= SUBCOUNTY VIEWSET =============
class SubCountyViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for SubCounty data.
    Supports GeoJSON format with ?format=geojson
    """
    queryset = SubCounty.objects.all()
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['country', 'province', 'county']
    search_fields = ['subcounty', 'county', 'province']
    ordering_fields = ['subcounty', 'county']
    
    def get_serializer_class(self):
        if self.request.query_params.get('format') == 'geojson':
            return SubCountyGeoSerializer
        return SubCountySerializer
    
    @action(detail=False, methods=['get'])
    def by_county(self, request):
        """Get subcounties for a specific county"""
        county_name = request.query_params.get('county')
        if not county_name:
            return Response({"error": "county parameter required"}, status=400)
        
        subcounties = self.get_queryset().filter(county__iexact=county_name)
        serializer = self.get_serializer(subcounties, many=True)
        return Response(serializer.data)

# ============= WARD VIEWSET =============
class WardViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for Ward data.
    Supports GeoJSON format with ?format=geojson
    """
    queryset = Ward.objects.all()
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['county', 'subcounty']
    search_fields = ['ward', 'subcounty', 'county']
    ordering_fields = ['ward', 'subcounty']
    
    def get_serializer_class(self):
        if self.request.query_params.get('format') == 'geojson':
            return WardGeoSerializer
        return WardSerializer
    
    @action(detail=False, methods=['get'])
    def by_subcounty(self, request):
        """Get wards for a specific subcounty"""
        subcounty_name = request.query_params.get('subcounty')
        if not subcounty_name:
            return Response({"error": "subcounty parameter required"}, status=400)
        
        wards = self.get_queryset().filter(subcounty__iexact=subcounty_name)
        serializer = self.get_serializer(wards, many=True)
        return Response(serializer.data)

# ============= BOREHOLE VIEWSET =============
class BoreHoleViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for Borehole data.
    Supports GeoJSON format with ?format=geojson
    """
    queryset = Bore_hole.objects.all()
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['country', 'admin_1', 'operation_field']
    search_fields = ['locality', 'admin_1']
    ordering_fields = ['yield_value', 'well_depth']
    
    def get_serializer_class(self):
        if self.request.query_params.get('format') == 'geojson':
            return BoreHoleGeoSerializer
        return BoreHoleSerializer
    
    @action(detail=False, methods=['get'])
    def spatial(self, request):
        """Get boreholes within a boundary"""
        boundary_type = request.query_params.get('boundary_type')
        boundary_id = request.query_params.get('boundary_id')
        
        if not boundary_type or not boundary_id:
            return Response({"error": "boundary_type and boundary_id required"}, status=400)
        
        queryset = self.get_queryset()
        
        if boundary_type == 'county':
            county = County.objects.filter(id=boundary_id).first()
            if county and county.geom:
                queryset = queryset.filter(geom__within=county.geom)
            elif county:
                queryset = queryset.filter(admin_1__iexact=county.county)
        
        elif boundary_type == 'subcounty':
            subcounty = SubCounty.objects.filter(id=boundary_id).first()
            if subcounty and subcounty.geom:
                queryset = queryset.filter(geom__within=subcounty.geom)
            elif subcounty:
                queryset = queryset.filter(locality__iexact=subcounty.subcounty)
        
        elif boundary_type == 'ward':
            ward = Ward.objects.filter(id=boundary_id).first()
            if ward and ward.geom:
                queryset = queryset.filter(geom__within=ward.geom)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get summary statistics for boreholes"""
        queryset = self.get_queryset()
        
        total = queryset.count()
        functional = queryset.filter(
            operation_field__icontains='functional'
        ).exclude(operation_field__icontains='non').count()
        non_functional = queryset.filter(operation_field__icontains='non-functional').count()
        
        with_yield = queryset.exclude(yield_value__isnull=True).exclude(yield_value=0)
        total_yield = with_yield.aggregate(Sum('yield_value'))['yield_value__sum'] or 0
        avg_yield = with_yield.aggregate(Avg('yield_value'))['yield_value__avg'] or 0
        
        yield_distribution = {
            'low': queryset.filter(yield_value__lt=5).count(),
            'medium': queryset.filter(yield_value__gte=5, yield_value__lt=15).count(),
            'high': queryset.filter(yield_value__gte=15).count(),
            'unknown': queryset.filter(yield_value__isnull=True).count()
        }
        
        return Response({
            'total': total,
            'functional': functional,
            'non_functional': non_functional,
            'unknown_status': total - (functional + non_functional),
            'total_yield': total_yield,
            'average_yield': avg_yield,
            'yield_distribution': yield_distribution,
            'counties_covered': queryset.values('admin_1').distinct().count()
        })

# ============= WATER POINTS VIEWSET =============
class WaterPointViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for Water Points data.
    Supports GeoJSON format with ?format=geojson
    
    Filters:
    - county: Filter by county name
    - subcounty: Filter by subcounty name  
    - ward: Filter by ward name
    - status: Filter by status (functional, non_functional, needs_repair, unknown)
    - source: Filter by water source
    - technology: Filter by water technology
    - min_population: Minimum assigned population
    - max_population: Maximum assigned population
    - date_from: Start date for reports (YYYY-MM-DD)
    - date_to: End date for reports (YYYY-MM-DD)
    """
    queryset = water_points.objects.all()
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    
    filterset_fields = {
        'clean_adm1': ['exact', 'iexact'],
        'clean_adm2': ['exact', 'iexact'],
        'clean_adm3': ['exact', 'iexact'],
        'status_cle': ['exact', 'iexact'],
        'source': ['exact', 'iexact'],
        'water_tech': ['exact', 'iexact'],
        'install_ye': ['exact', 'gte', 'lte'],
        'report_dat': ['exact', 'gte', 'lte'],
        'is_urban': ['exact', 'iexact'],
    }
    
    search_fields = ['clean_adm1', 'clean_adm2', 'clean_adm3', 'source', 'installer', 'management']
    ordering_fields = ['install_ye', 'report_dat', 'assigned_p', 'criticalit']
    
    def get_serializer_class(self):
        if self.request.query_params.get('format') == 'geojson':
            return WaterPointGeoSerializer
        return WaterPointSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Apply custom filters
        county = self.request.query_params.get('county')
        subcounty = self.request.query_params.get('subcounty')
        ward = self.request.query_params.get('ward')
        status = self.request.query_params.get('status')
        source = self.request.query_params.get('source')
        technology = self.request.query_params.get('technology')
        min_pop = self.request.query_params.get('min_population')
        max_pop = self.request.query_params.get('max_population')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        
        if county:
            queryset = queryset.filter(clean_adm1__iexact=county)
        if subcounty:
            queryset = queryset.filter(clean_adm2__iexact=subcounty)
        if ward:
            queryset = queryset.filter(clean_adm3__iexact=ward)
        
        if status:
            if status == 'functional':
                queryset = queryset.filter(status_cle__iexact='functional')
            elif status == 'non_functional':
                queryset = queryset.filter(
                    Q(status_cle__iexact='non-functional') | 
                    Q(status_cle__iexact='non functional')
                )
            elif status == 'needs_repair':
                queryset = queryset.filter(
                    Q(status_cle__iexact='needs repair') |
                    Q(status_cle__iexact='needs major repair') |
                    Q(status_cle__iexact='needs minor repair')
                )
            elif status == 'unknown':
                queryset = queryset.filter(
                    Q(status_cle__isnull=True) | 
                    Q(status_cle__exact='')
                )
        
        if source:
            queryset = queryset.filter(source__iexact=source)
        
        if technology:
            queryset = queryset.filter(water_tech__iexact=technology)
        
        if min_pop:
            queryset = queryset.filter(assigned_p__gte=min_pop)
        
        if max_pop:
            queryset = queryset.filter(assigned_p__lte=max_pop)
        
        if date_from:
            queryset = queryset.filter(report_dat__gte=date_from)
        
        if date_to:
            queryset = queryset.filter(report_dat__lte=date_to)
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def spatial(self, request):
        """Get water points within a boundary using spatial query"""
        boundary_type = request.query_params.get('boundary_type')
        boundary_id = request.query_params.get('boundary_id')
        
        if not boundary_type or not boundary_id:
            return Response({"error": "boundary_type and boundary_id required"}, status=400)
        
        queryset = self.get_queryset()
        
        if boundary_type == 'county':
            county = County.objects.filter(id=boundary_id).first()
            if county and county.geom:
                queryset = queryset.filter(geom__within=county.geom)
        
        elif boundary_type == 'subcounty':
            subcounty = SubCounty.objects.filter(id=boundary_id).first()
            if subcounty and subcounty.geom:
                queryset = queryset.filter(geom__within=subcounty.geom)
        
        elif boundary_type == 'ward':
            ward = Ward.objects.filter(id=boundary_id).first()
            if ward and ward.geom:
                queryset = queryset.filter(geom__within=ward.geom)
        
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get summary statistics for water points"""
        queryset = self.get_queryset()
        
        total = queryset.count()
        functional = queryset.filter(status_cle__iexact='functional').count()
        non_functional = queryset.filter(
            Q(status_cle__iexact='non-functional') | 
            Q(status_cle__iexact='non functional')
        ).count()
        needs_repair = queryset.filter(
            Q(status_cle__iexact='needs repair') |
            Q(status_cle__iexact='needs major repair') |
            Q(status_cle__iexact='needs minor repair')
        ).count()
        unknown = total - (functional + non_functional + needs_repair)
        
        functional_pct = round((functional / total) * 100, 1) if total > 0 else 0
        
        total_population = queryset.aggregate(Sum('assigned_p'))['assigned_p__sum'] or 0
        avg_criticality = queryset.exclude(criticalit__isnull=True).aggregate(Avg('criticalit'))['criticalit__avg']
        
        # Source distribution
        sources = queryset.exclude(source__isnull=True).exclude(source='') \
            .values('source').annotate(count=Count('id')).order_by('-count')[:10]
        
        # Technology distribution
        technologies = queryset.exclude(water_tech__isnull=True).exclude(water_tech='') \
            .values('water_tech').annotate(count=Count('id')).order_by('-count')[:10]
        
        # Urban/Rural breakdown
        urban = queryset.filter(is_urban__iexact='yes').count()
        rural = queryset.filter(is_urban__iexact='no').count()
        
        # Criticality breakdown
        high_criticality = queryset.filter(criticalit__gte=0.7).count()
        medium_criticality = queryset.filter(criticalit__gte=0.4, criticalit__lt=0.7).count()
        low_criticality = queryset.filter(criticalit__lt=0.4, criticalit__gte=0).count()
        
        # Timeline
        current_year = datetime.now().year
        timeline = []
        for year in range(current_year - 9, current_year + 1):
            count = queryset.filter(install_ye=year).count()
            if count > 0:
                timeline.append({'year': year, 'count': count})
        
        return Response({
            'total': total,
            'functional': functional,
            'non_functional': non_functional,
            'needs_repair': needs_repair,
            'unknown': unknown,
            'functional_percentage': functional_pct,
            'total_population_served': total_population,
            'average_criticality': avg_criticality,
            'criticality_breakdown': {
                'high': high_criticality,
                'medium': medium_criticality,
                'low': low_criticality
            },
            'urban_breakdown': {
                'urban': urban,
                'rural': rural,
                'unknown': total - (urban + rural)
            },
            'top_sources': sources,
            'top_technologies': technologies,
            'installation_timeline': timeline,
            'counties_covered': queryset.values('clean_adm1').distinct().count()
        })
    
    @action(detail=False, methods=['get'])
    def county_breakdown(self, request):
        """Get water point statistics broken down by county"""
        queryset = self.get_queryset()
        
        counties = County.objects.all()
        breakdown = []
        
        for county in counties:
            county_points = queryset.filter(clean_adm1__iexact=county.county)
            total = county_points.count()
            
            if total > 0:
                functional = county_points.filter(status_cle__iexact='functional').count()
                non_functional = county_points.filter(
                    Q(status_cle__iexact='non-functional') | 
                    Q(status_cle__iexact='non functional')
                ).count()
                needs_repair = county_points.filter(
                    Q(status_cle__iexact='needs repair') |
                    Q(status_cle__iexact='needs major repair') |
                    Q(status_cle__iexact='needs minor repair')
                ).count()
                functional_pct = round((functional / total) * 100, 1)
                population = county_points.aggregate(Sum('assigned_p'))['assigned_p__sum'] or 0
                
                breakdown.append({
                    'county': county.county,
                    'total': total,
                    'functional': functional,
                    'non_functional': non_functional,
                    'needs_repair': needs_repair,
                    'functional_percentage': functional_pct,
                    'population_served': population
                })
        
        # Sort by total points (descending)
        breakdown.sort(key=lambda x: x['total'], reverse=True)
        
        return Response(breakdown)
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Get recently updated water points"""
        days = int(request.query_params.get('days', 30))
        limit = int(request.query_params.get('limit', 20))
        
        date_threshold = timezone.now().date() - timedelta(days=days)
        
        recent_points = self.get_queryset().filter(
            report_dat__gte=date_threshold
        ).order_by('-report_dat')[:limit]
        
        serializer = self.get_serializer(recent_points, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def nearby(self, request, pk=None):
        """Find nearby water points within a radius"""
        point = self.get_object()
        radius = float(request.query_params.get('radius', 5))  # km
        limit = int(request.query_params.get('limit', 20))
        
        if not point.geom:
            return Response({"error": "Point has no geometry"}, status=400)
        
        from django.contrib.gis.measure import D
        nearby_points = water_points.objects.filter(
            geom__distance_lte=(point.geom, D(km=radius))
        ).exclude(id=point.id).order_by('geom')[:limit]
        
        serializer = self.get_serializer(nearby_points, many=True)
        return Response(serializer.data)

# ============= COMBINED VIEWS =============
class CombinedWaterSourcesView(generics.GenericAPIView):
    """
    Get all water sources (both boreholes and water points) within a boundary
    """
    pagination_class = StandardResultsSetPagination
    
    def get(self, request):
        boundary_type = request.query_params.get('boundary_type')
        boundary_id = request.query_params.get('boundary_id')
        
        water_points_qs = water_points.objects.all()
        boreholes_qs = Bore_hole.objects.all()
        
        # Apply spatial filter if boundary provided
        if boundary_type and boundary_id:
            if boundary_type == 'county':
                county = County.objects.filter(id=boundary_id).first()
                if county and county.geom:
                    water_points_qs = water_points_qs.filter(geom__within=county.geom)
                    boreholes_qs = boreholes_qs.filter(geom__within=county.geom)
            
            elif boundary_type == 'subcounty':
                subcounty = SubCounty.objects.filter(id=boundary_id).first()
                if subcounty and subcounty.geom:
                    water_points_qs = water_points_qs.filter(geom__within=subcounty.geom)
                    boreholes_qs = boreholes_qs.filter(geom__within=subcounty.geom)
            
            elif boundary_type == 'ward':
                ward = Ward.objects.filter(id=boundary_id).first()
                if ward and ward.geom:
                    water_points_qs = water_points_qs.filter(geom__within=ward.geom)
                    boreholes_qs = boreholes_qs.filter(geom__within=ward.geom)
        
        # Combine results
        water_points_serializer = WaterPointGeoSerializer(
            water_points_qs, many=True, context={'request': request}
        )
        boreholes_serializer = BoreHoleGeoSerializer(
            boreholes_qs, many=True, context={'request': request}
        )
        
        return Response({
            'type': 'FeatureCollection',
            'features': water_points_serializer.data + boreholes_serializer.data,
            'metadata': {
                'water_points_count': water_points_qs.count(),
                'boreholes_count': boreholes_qs.count(),
                'total': water_points_qs.count() + boreholes_qs.count()
            }
        })

class DashboardStatsView(generics.GenericAPIView):
    """Get comprehensive dashboard statistics"""
    
    def get(self, request):
        # Basic counts
        total_water_points = water_points.objects.count()
        total_boreholes = Bore_hole.objects.count()
        total_counties = County.objects.count()
        total_subcounties = SubCounty.objects.count()
        total_wards = Ward.objects.count()
        
        # Water point status
        functional = water_points.objects.filter(status_cle__iexact='functional').count()
        non_functional = water_points.objects.filter(
            Q(status_cle__iexact='non-functional') | 
            Q(status_cle__iexact='non functional')
        ).count()
        needs_repair = water_points.objects.filter(
            Q(status_cle__iexact='needs repair') |
            Q(status_cle__iexact='needs major repair') |
            Q(status_cle__iexact='needs minor repair')
        ).count()
        
        # Borehole stats
        boreholes_with_yield = Bore_hole.objects.exclude(yield_value__isnull=True).exclude(yield_value=0)
        total_yield = boreholes_with_yield.aggregate(Sum('yield_value'))['yield_value__sum'] or 0
        avg_yield = boreholes_with_yield.aggregate(Avg('yield_value'))['yield_value__avg'] or 0
        
        # Population
        total_population = water_points.objects.aggregate(Sum('assigned_p'))['assigned_p__sum'] or 0
        
        # Recent activity
        thirty_days_ago = timezone.now().date() - timedelta(days=30)
        recent_reports = water_points.objects.filter(report_dat__gte=thirty_days_ago).count()
        
        return Response({
            'overview': {
                'total_water_points': total_water_points,
                'total_boreholes': total_boreholes,
                'total_water_sources': total_water_points + total_boreholes,
                'total_counties': total_counties,
                'total_subcounties': total_subcounties,
                'total_wards': total_wards,
            },
            'water_points_status': {
                'functional': functional,
                'non_functional': non_functional,
                'needs_repair': needs_repair,
                'unknown': total_water_points - (functional + non_functional + needs_repair),
                'functional_percentage': round((functional / total_water_points) * 100, 1) if total_water_points > 0 else 0
            },
            'borehole_stats': {
                'total_yield': total_yield,
                'average_yield': avg_yield,
                'functional': Bore_hole.objects.filter(operation_field__icontains='functional').exclude(operation_field__icontains='non').count(),
                'non_functional': Bore_hole.objects.filter(operation_field__icontains='non-functional').count()
            },
            'population': {
                'total_served': total_population,
                'average_per_point': round(total_population / total_water_points, 1) if total_water_points > 0 else 0
            },
            'activity': {
                'recent_reports': recent_reports,
                'counties_with_data': water_points.objects.values('clean_adm1').distinct().count()
            }
        })

# ============= FILTER OPTIONS VIEWS =============
class FilterOptionsView(generics.GenericAPIView):
    """Get available filter options for dropdowns"""
    
    def get(self, request):
        counties = list(County.objects.values_list('county', flat=True).distinct().order_by('county'))
        
        sources = list(water_points.objects.exclude(source__isnull=True).exclude(source='')
                      .values_list('source', flat=True).distinct().order_by('source'))
        
        technologies = list(water_points.objects.exclude(water_tech__isnull=True).exclude(water_tech='')
                          .values_list('water_tech', flat=True).distinct().order_by('water_tech'))
        
        statuses = ['functional', 'non_functional', 'needs_repair', 'unknown']
        
        return Response({
            'counties': counties,
            'sources': sources[:50],  # Limit to 50
            'technologies': technologies[:50],
            'statuses': statuses,
            'installation_years': list(water_points.objects.exclude(install_ye__isnull=True)
                                      .values_list('install_ye', flat=True).distinct().order_by('-install_ye'))
        })