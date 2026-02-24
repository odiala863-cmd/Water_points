"""
Comprehensive Water Points Analytics System
Dynamic, DRY, and database-driven analytics with deep filtering capabilities
"""

import json
import logging
import csv
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from io import StringIO, BytesIO
from django.shortcuts import render
from django.db.models import (
    Count, Avg, Sum, Min, Max, StdDev, Variance,
    Q, F, Value, FloatField, IntegerField,
    Case, When, CharField, Subquery, OuterRef
)
from django.db.models.functions import (
    Cast, Round, Coalesce, Concat, ExtractYear,
    TruncMonth, TruncDay
)
from django.contrib.gis.db.models.functions import (
    Area, Transform, Distance, Centroid, Length
)
from django.contrib.gis.geos import GEOSGeometry, Point
from django.http import JsonResponse, HttpResponse
from django.views.decorators.cache import cache_page
from django.core.cache import cache
from django.core.paginator import Paginator
from django.conf import settings
from django.core import serializers
import math

from .models import County, SubCounty, Ward, Bore_hole

logger = logging.getLogger(__name__)


# ============================================
# HELPER FUNCTIONS AND CLASSES
# ============================================

class AnalyticsEngine:
    """Main analytics engine for dynamic data processing"""
    
    @staticmethod
    def get_distinct_field_values(model, field_name):
        """Get distinct values from any model field"""
        try:
            # Get distinct values from database
            values = model.objects.exclude(
                **{f'{field_name}__isnull': True}
            ).exclude(
                **{f'{field_name}': ''}
            ).values_list(field_name, flat=True).distinct()
            
            # Filter out None and empty strings, and sort
            return sorted([str(v) for v in values if v not in [None, '', ' ']])
        except Exception as e:
            logger.error(f"Error getting distinct values for {field_name}: {e}")
            return []
    
    @staticmethod
    def apply_filters(queryset, filters):
        """Apply complex filters to queryset dynamically"""
        if not filters:
            return queryset
        
        filter_map = {
            'county': 'admin_1',
            'admin_1': 'admin_1',
            'subcounty': 'locality',
            'locality': 'locality',
            'country': 'country',
            'source_type': 'source_1',
            'operation_status': 'operation_field',
            'water_rest': 'water_rest',
            'first_stru': 'first_stru',
            'second_str': 'second_str',
            'third_stru': 'third_stru',
        }
        
        for filter_key, filter_value in filters.items():
            if filter_value and filter_key in filter_map:
                field_name = filter_map[filter_key]
                
                # Handle range filters
                if isinstance(filter_value, dict):
                    if 'min' in filter_value and filter_value['min'] is not None:
                        queryset = queryset.filter(**{f'{field_name}__gte': filter_value['min']})
                    if 'max' in filter_value and filter_value['max'] is not None:
                        queryset = queryset.filter(**{f'{field_name}__lte': filter_value['max']})
                
                # Handle list filters
                elif isinstance(filter_value, list):
                    if filter_value:
                        # Handle special case for operation status
                        if filter_key == 'operation_status':
                            status_q = Q()
                            for status in filter_value:
                                status = str(status).lower()
                                if status == 'functional':
                                    status_q |= Q(operation_field__icontains='functional')
                                elif status == 'non_functional':
                                    status_q |= Q(operation_field__icontains='non-functional') | Q(operation_field__icontains='non functional')
                                elif status == 'needs_repair':
                                    status_q |= Q(operation_field__icontains='repair') | Q(operation_field__icontains='maintenance')
                                elif status == 'unknown':
                                    status_q |= Q(operation_field__isnull=True) | Q(operation_field='')
                            if status_q:
                                queryset = queryset.filter(status_q)
                        else:
                            queryset = queryset.filter(**{f'{field_name}__in': filter_value})
                
                # Handle single value filters
                elif filter_value:
                    if filter_key == 'geographical_search':
                        queryset = queryset.filter(
                            Q(admin_1__icontains=filter_value) |
                            Q(locality__icontains=filter_value) |
                            Q(country__icontains=filter_value)
                        )
                    else:
                        queryset = queryset.filter(**{f'{field_name}__icontains': filter_value})
        
        return queryset
    
    @staticmethod
    def calculate_performance_score(data):
        """Calculate performance score for counties/subcounties"""
        if not data or data.get('total_points', 0) == 0:
            return 0
        
        functional_rate = data.get('functional_rate', 0)
        avg_yield = data.get('avg_yield', 0) or 0
        avg_ph = data.get('avg_ph', 7) or 7
        density = data.get('density', 0) or 0
        
        # Normalize values
        functional_score = functional_rate * 0.4  # 40% weight
        yield_score = min(avg_yield / 20 * 100, 100) * 0.3  # 30% weight, cap at 20 m³/h
        ph_score = (1 - abs(avg_ph - 7) / 7) * 100 * 0.2  # 20% weight, ideal pH is 7
        density_score = min(density * 10, 100) * 0.1  # 10% weight, higher density is better
        
        total_score = functional_score + yield_score + ph_score + density_score
        return round(total_score, 1)
    
    @staticmethod
    def calculate_water_quality_indicators(queryset):
        """Calculate comprehensive water quality metrics"""
        # First get the aggregates
        aggregates = queryset.aggregate(
            avg_ph=Round(Avg(Case(
                When(ph__isnull=False, then='ph'),
                default=Value(None),
                output_field=FloatField()
            )), 2),
            min_ph=Min('ph'),
            max_ph=Max('ph'),
            ph_stddev=Round(StdDev('ph'), 2),
            
            avg_ec=Round(Avg(Case(
                When(ec__isnull=False, then='ec'),
                default=Value(None),
                output_field=IntegerField()
            )), 2),
            min_ec=Min('ec'),
            max_ec=Max('ec'),
        )
        
        # Count water quality categories
        acidic_count = queryset.filter(ph__lt=6.5).count()
        neutral_count = queryset.filter(ph__gte=6.5, ph__lte=8.5).count()
        alkaline_count = queryset.filter(ph__gt=8.5).count()
        
        # Count EC categories (µS/cm)
        low_ec = queryset.filter(ec__lt=250).count()
        medium_ec = queryset.filter(ec__gte=250, ec__lt=750).count()
        high_ec = queryset.filter(ec__gte=750, ec__lt=2250).count()
        very_high_ec = queryset.filter(ec__gte=2250).count()
        
        total_quality_points = queryset.exclude(ph__isnull=True).count()
        
        quality_data = {
            'avg_ph': aggregates['avg_ph'] or 0,
            'min_ph': aggregates['min_ph'] or 0,
            'max_ph': aggregates['max_ph'] or 14,
            'ph_stddev': aggregates['ph_stddev'] or 0,
            
            'avg_ec': aggregates['avg_ec'] or 0,
            'min_ec': aggregates['min_ec'] or 0,
            'max_ec': aggregates['max_ec'] or 5000,
            
            'acidic_count': acidic_count,
            'neutral_count': neutral_count,
            'alkaline_count': alkaline_count,
            
            'low_ec': low_ec,
            'medium_ec': medium_ec,
            'high_ec': high_ec,
            'very_high_ec': very_high_ec,
        }
        
        if total_quality_points > 0:
            quality_data['ph_distribution'] = {
                'acidic': round((acidic_count / total_quality_points) * 100, 1),
                'neutral': round((neutral_count / total_quality_points) * 100, 1),
                'alkaline': round((alkaline_count / total_quality_points) * 100, 1),
            }
        else:
            quality_data['ph_distribution'] = {
                'acidic': 0,
                'neutral': 0,
                'alkaline': 0,
            }
        
        return quality_data
    
    @staticmethod
    def calculate_yield_statistics(queryset):
        """Calculate comprehensive yield statistics"""
        aggregates = queryset.aggregate(
            total_count=Count('yield_value'),
            avg_yield=Round(Avg('yield_value'), 2),
            min_yield=Min('yield_value'),
            max_yield=Max('yield_value'),
            stddev_yield=Round(StdDev('yield_value'), 2),
        )
        
        # Count yield categories (m³/hour)
        very_low = queryset.filter(yield_value__lt=2).count()
        low = queryset.filter(yield_value__gte=2, yield_value__lt=5).count()
        medium = queryset.filter(yield_value__gte=5, yield_value__lt=10).count()
        high = queryset.filter(yield_value__gte=10, yield_value__lt=20).count()
        very_high = queryset.filter(yield_value__gte=20).count()
        
        total_yield_points = aggregates['total_count'] or 1
        
        yield_stats = {
            'total_count': aggregates['total_count'] or 0,
            'avg_yield': aggregates['avg_yield'] or 0,
            'min_yield': aggregates['min_yield'] or 0,
            'max_yield': aggregates['max_yield'] or 100,
            'stddev_yield': aggregates['stddev_yield'] or 0,
            
            'very_low': very_low,
            'low': low,
            'medium': medium,
            'high': high,
            'very_high': very_high,
        }
        
        if total_yield_points > 0:
            yield_stats['yield_distribution'] = {
                'very_low': round((very_low / total_yield_points) * 100, 1),
                'low': round((low / total_yield_points) * 100, 1),
                'medium': round((medium / total_yield_points) * 100, 1),
                'high': round((high / total_yield_points) * 100, 1),
                'very_high': round((very_high / total_yield_points) * 100, 1),
            }
        else:
            yield_stats['yield_distribution'] = {
                'very_low': 0,
                'low': 0,
                'medium': 0,
                'high': 0,
                'very_high': 0,
            }
        
        return yield_stats
    
    @staticmethod
    def get_spatial_coverage(queryset):
        """Calculate geographical coverage metrics"""
        total_counties = County.objects.count()
        total_subcounties = SubCounty.objects.count()
        
        counties_with_points = queryset.exclude(admin_1__isnull=True).values('admin_1').distinct().count()
        subcounties_with_points = queryset.exclude(locality__isnull=True).values('locality').distinct().count()
        
        coverage_rate_counties = round((counties_with_points / total_counties * 100), 1) if total_counties > 0 else 0
        coverage_rate_subcounties = round((subcounties_with_points / total_subcounties * 100), 1) if total_subcounties > 0 else 0
        
        return {
            'counties_with_water_points': counties_with_points,
            'subcounties_with_water_points': subcounties_with_points,
            'coverage_rate_counties': coverage_rate_counties,
            'coverage_rate_subcounties': coverage_rate_subcounties,
            'total_counties': total_counties,
            'total_subcounties': total_subcounties,
        }


# ============================================
# MAIN VIEW FUNCTIONS
# ============================================
def analytics_dashboard(request):
    """
    Comprehensive water points analytics dashboard
    Renders the main dashboard page with all necessary data
    """
    import json
    from datetime import datetime
    from django.db.models import Count, Q, Avg, Min, Max, IntegerField, Case, When, Sum, FloatField
    from django.db.models.functions import Round, Coalesce
    import logging
    
    logger = logging.getLogger(__name__)
    
    # ============================================
    # AJAX API ENDPOINTS
    # ============================================
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        endpoint = request.GET.get('endpoint')
        
        # === SOURCE TYPE ANALYSIS API ===
        if endpoint == 'source-type-analysis' or endpoint == 'source-analysis':
            total = Bore_hole.objects.count()
            data = list(Bore_hole.objects.exclude(
                source_1__isnull=True
            ).exclude(
                source_1=''
            ).values('source_1').annotate(
                count=Count('id')
            ).order_by('-count')[:15])
            
            for item in data:
                item['percentage'] = round((item['count'] / total) * 100, 1) if total > 0 else 0
                item['source'] = item['source_1']
                item['value'] = item['count']
            
            if not data:
                data = [{'source_1': 'Borehole', 'source': 'Borehole', 'count': total, 'value': total, 'percentage': 100}]
            
            return JsonResponse(data, safe=False)
        
        # === YIELD ANALYSIS API ===
        elif endpoint == 'yield-analysis':
            min_yield = float(request.GET.get('min_yield', 0))
            max_yield = float(request.GET.get('max_yield', 100))
            
            queryset = Bore_hole.objects.filter(
                yield_value__isnull=False,
                yield_value__gte=min_yield,
                yield_value__lte=max_yield
            )
            
            very_low = queryset.filter(yield_value__lt=2).count()
            low = queryset.filter(yield_value__gte=2, yield_value__lt=5).count()
            medium = queryset.filter(yield_value__gte=5, yield_value__lt=10).count()
            high = queryset.filter(yield_value__gte=10, yield_value__lt=20).count()
            very_high = queryset.filter(yield_value__gte=20).count()
            total_yield = queryset.count()
            
            yield_analysis = {
                'very_low': very_low,
                'low': low,
                'medium': medium,
                'high': high,
                'very_high': very_high,
                'min_yield': queryset.aggregate(min=Min('yield_value'))['min'] or 0,
                'max_yield': queryset.aggregate(max=Max('yield_value'))['max'] or 0,
                'avg_yield': queryset.aggregate(avg=Round(Avg('yield_value'), 2))['avg'] or 0,
                'distribution': {
                    'very_low': round((very_low / total_yield * 100), 1) if total_yield > 0 else 0,
                    'low': round((low / total_yield * 100), 1) if total_yield > 0 else 0,
                    'medium': round((medium / total_yield * 100), 1) if total_yield > 0 else 0,
                    'high': round((high / total_yield * 100), 1) if total_yield > 0 else 0,
                    'very_high': round((very_high / total_yield * 100), 1) if total_yield > 0 else 0,
                }
            }
            
            return JsonResponse(yield_analysis)
        
        # === COUNTY PERFORMANCE API ===
        elif endpoint == 'county-performance':
            counties = County.objects.exclude(
                county__isnull=True
            ).exclude(
                county=''
            ).values_list('county', flat=True).distinct().order_by('county')[:20]
            
            performance_data = []
            
            for county_name in counties:
                if county_name:
                    county_points = Bore_hole.objects.filter(admin_1__iexact=county_name)
                    county_total = county_points.count()
                    
                    if county_total > 0:
                        county_functional = county_points.filter(
                            Q(operation_field__icontains='functional') &
                            ~Q(operation_field__icontains='non')
                        ).count()
                        
                        county_functional_rate = round((county_functional / county_total * 100), 1)
                        county_yield = county_points.aggregate(avg=Avg('yield_value'))['avg'] or 0
                        county_ph = county_points.aggregate(avg=Avg('ph'))['avg'] or 7.0
                        
                        performance_score = round(
                            county_functional_rate * 0.5 + 
                            min(county_yield / 20 * 100, 100) * 0.3 + 
                            (1 - abs(county_ph - 7) / 7) * 100 * 0.2,
                            1
                        )
                        
                        performance_data.append({
                            'admin_1': county_name[:50],
                            'county': county_name[:50],
                            'total_points': county_total,
                            'functional_points': county_functional,
                            'functional_rate': county_functional_rate,
                            'avg_yield': round(county_yield, 2),
                            'avg_ph': round(county_ph, 2),
                            'performance_score': performance_score
                        })
            
            performance_data = sorted(performance_data, key=lambda x: x['performance_score'], reverse=True)
            
            return JsonResponse(performance_data, safe=False)
        
        # === STRUCTURE ANALYSIS API ===
        elif endpoint == 'structure-analysis':
            structure_type = request.GET.get('structure_type', 'first')
            
            if structure_type == 'first':
                data = list(Bore_hole.objects.exclude(
                    first_stru__isnull=True
                ).exclude(
                    first_stru=''
                ).values('first_stru').annotate(
                    count=Count('id')
                ).order_by('-count')[:20])
                
                if not data:
                    data = [{'first_stru': 'Concrete', 'count': 0}]
                    
            elif structure_type == 'second':
                data = list(Bore_hole.objects.exclude(
                    second_str__isnull=True
                ).exclude(
                    second_str=''
                ).values('second_str').annotate(
                    count=Count('id')
                ).order_by('-count')[:20])
                
                if not data:
                    data = [{'second_str': 'Steel', 'count': 0}]
                    
            else:  # combined
                first_data = Bore_hole.objects.exclude(
                    first_stru__isnull=True
                ).exclude(
                    first_stru=''
                ).values('first_stru').annotate(
                    count=Count('id')
                ).order_by('-count')[:10]
                
                second_data = Bore_hole.objects.exclude(
                    second_str__isnull=True
                ).exclude(
                    second_str=''
                ).values('second_str').annotate(
                    count=Count('id')
                ).order_by('-count')[:10]
                
                data = {
                    'first_structure': list(first_data),
                    'second_structure': list(second_data)
                }
            
            return JsonResponse(data, safe=False)
        
        # === WATER QUALITY API ===
        elif endpoint == 'water-quality':
            county = request.GET.get('county')
            subcounty = request.GET.get('subcounty')
            
            queryset = Bore_hole.objects.all()
            
            if county:
                queryset = queryset.filter(admin_1__iexact=county)
            if subcounty:
                queryset = queryset.filter(locality__iexact=subcounty)
            
            acidic_count = queryset.filter(ph__lt=6.5).count()
            neutral_count = queryset.filter(ph__gte=6.5, ph__lte=8.5).count()
            alkaline_count = queryset.filter(ph__gt=8.5).count()
            total_quality = queryset.exclude(ph__isnull=True).count()
            
            quality_data = {
                'acidic_count': acidic_count,
                'neutral_count': neutral_count,
                'alkaline_count': alkaline_count,
                'ph_distribution': {
                    'acidic': round((acidic_count / total_quality * 100), 1) if total_quality > 0 else 0,
                    'neutral': round((neutral_count / total_quality * 100), 1) if total_quality > 0 else 0,
                    'alkaline': round((alkaline_count / total_quality * 100), 1) if total_quality > 0 else 0,
                },
                'aggregates': queryset.aggregate(
                    avg_ph=Round(Avg('ph'), 2),
                    min_ph=Round(Min('ph'), 2),
                    max_ph=Round(Max('ph'), 2),
                )
            }
            
            return JsonResponse(quality_data)
        
        # === DASHBOARD SUMMARY API ===
        elif endpoint == 'dashboard-summary':
            total_boreholes = Bore_hole.objects.count()
            
            functional_count = Bore_hole.objects.filter(
                Q(operation_field__icontains='functional') &
                ~Q(operation_field__icontains='non')
            ).count()
            
            non_functional_count = Bore_hole.objects.filter(
                Q(operation_field__icontains='non-functional') |
                Q(operation_field__icontains='not working') |
                Q(operation_field__icontains='broken')
            ).count()
            
            maintenance_count = Bore_hole.objects.filter(
                Q(operation_field__icontains='maintenance') |
                Q(operation_field__icontains='repair')
            ).count()
            
            yield_agg = Bore_hole.objects.aggregate(
                avg_yield=Round(Avg('yield_value'), 2),
                min_yield=Round(Min('yield_value'), 2),
                max_yield=Round(Max('yield_value'), 2)
            )
            
            ph_agg = Bore_hole.objects.aggregate(
                avg_ph=Round(Avg('ph'), 2),
                min_ph=Round(Min('ph'), 2),
                max_ph=Round(Max('ph'), 2)
            )
            
            summary = {
                'total_boreholes': total_boreholes,
                'functional_count': functional_count,
                'non_functional_count': non_functional_count,
                'maintenance_count': maintenance_count,
                'functional_rate': round((functional_count / total_boreholes * 100), 1) if total_boreholes > 0 else 0,
                'avg_yield': yield_agg['avg_yield'] or 0,
                'min_yield': yield_agg['min_yield'] or 0,
                'max_yield': yield_agg['max_yield'] or 0,
                'avg_ph': ph_agg['avg_ph'] or 7.0,
                'min_ph': ph_agg['min_ph'] or 0,
                'max_ph': ph_agg['max_ph'] or 14,
                'counties_covered': Bore_hole.objects.exclude(admin_1__isnull=True).values('admin_1').distinct().count(),
                'subcounties_covered': Bore_hole.objects.exclude(locality__isnull=True).values('locality').distinct().count(),
                'last_updated': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            
            return JsonResponse(summary)
        
        # === FILTER OPTIONS API ===
        elif endpoint == 'filter-options':
            # Get counties from County model
            counties = County.objects.exclude(
                county__isnull=True
            ).exclude(
                county=''
            ).values_list('county', flat=True).distinct().order_by('county')[:50]
            
            # Get subcounties from SubCounty model
            subcounties = SubCounty.objects.exclude(
                subcounty__isnull=True
            ).exclude(
                subcounty=''
            ).values_list('subcounty', flat=True).distinct().order_by('subcounty')[:50]
            
            # Get wards from Ward model
            wards = Ward.objects.exclude(
                ward__isnull=True
            ).exclude(
                ward=''
            ).values_list('ward', flat=True).distinct().order_by('ward')[:50]
            
            # Get source types from Bore_hole
            source_types = list(Bore_hole.objects.exclude(
                source_1__isnull=True
            ).exclude(
                source_1=''
            ).values_list('source_1', flat=True).distinct().order_by('source_1')[:30])
            
            # Get operation statuses from Bore_hole
            operation_statuses = list(Bore_hole.objects.exclude(
                operation_field__isnull=True
            ).exclude(
                operation_field=''
            ).values_list('operation_field', flat=True).distinct().order_by('operation_field')[:20])
            
            # If no operation_statuses found, provide defaults
            if not operation_statuses:
                operation_statuses = ['Functional', 'Non-Functional', 'Needs Repair', 'Unknown']
            
            options = {
                'counties': list(counties),
                'subcounties': list(subcounties),
                'wards': list(wards),
                'source_types': source_types,
                'operation_statuses': operation_statuses,
                'yield_ranges': {
                    'min': Bore_hole.objects.aggregate(min=Min('yield_value'))['min'] or 0,
                    'max': Bore_hole.objects.aggregate(max=Max('yield_value'))['max'] or 100,
                },
                'ph_ranges': {
                    'min': Bore_hole.objects.aggregate(min=Min('ph'))['min'] or 0,
                    'max': Bore_hole.objects.aggregate(max=Max('ph'))['max'] or 14,
                }
            }
            
            return JsonResponse(options)
        
        # === DEFAULT JSON RESPONSE FOR UNKNOWN ENDPOINTS ===
        else:
            return JsonResponse({'error': f'Unknown endpoint: {endpoint}'}, status=400)
    
    # ============================================
    # REGULAR PAGE RENDER (HTML)
    # ============================================
    try:
        # Get total count
        total_boreholes = Bore_hole.objects.count()
        
        # ============= FILTER OPTIONS =============
        # Get counties from County model
        counties = County.objects.exclude(
            county__isnull=True
        ).exclude(
            county=''
        ).values_list('county', flat=True).distinct().order_by('county')[:50]
        
        # Get subcounties from SubCounty model
        subcounties = SubCounty.objects.exclude(
            subcounty__isnull=True
        ).exclude(
            subcounty=''
        ).values_list('subcounty', flat=True).distinct().order_by('subcounty')[:50]
        
        # Get wards from Ward model
        wards = Ward.objects.exclude(
            ward__isnull=True
        ).exclude(
            ward=''
        ).values_list('ward', flat=True).distinct().order_by('ward')[:50]
        
        # Get source types from Bore_hole
        source_types = list(Bore_hole.objects.exclude(
            source_1__isnull=True
        ).exclude(
            source_1=''
        ).values_list('source_1', flat=True).distinct().order_by('source_1')[:30])
        
        # Get operation statuses from Bore_hole
        operation_statuses = list(Bore_hole.objects.exclude(
            operation_field__isnull=True
        ).exclude(
            operation_field=''
        ).values_list('operation_field', flat=True).distinct().order_by('operation_field')[:20])
        
        # If no operation_statuses found, provide defaults
        if not operation_statuses:
            operation_statuses = ['Functional', 'Non-Functional', 'Needs Repair', 'Unknown']
        
        filter_options = {
            'counties': list(counties),
            'subcounties': list(subcounties),
            'wards': list(wards),
            'source_types': source_types,
            'operation_statuses': operation_statuses
        }
        
        # ============= WATER QUALITY INDICATORS =============
        ph_stats = Bore_hole.objects.aggregate(
            avg_ph=Round(Avg('ph'), 2),
            min_ph=Round(Min('ph'), 2),
            max_ph=Round(Max('ph'), 2)
        )
        
        water_quality_indicators = {
            'acidic_count': Bore_hole.objects.filter(ph__lt=6.5).count(),
            'neutral_count': Bore_hole.objects.filter(ph__gte=6.5, ph__lte=8.5).count(),
            'alkaline_count': Bore_hole.objects.filter(ph__gt=8.5).count(),
            'min_ph': ph_stats['min_ph'] or 0,
            'max_ph': ph_stats['max_ph'] or 14,
            'avg_ph': ph_stats['avg_ph'] or 7.0
        }
        
        # ============= YIELD STATISTICS =============
        yield_stats = Bore_hole.objects.aggregate(
            avg_yield=Round(Avg('yield_value'), 2),
            min_yield=Round(Min('yield_value'), 2),
            max_yield=Round(Max('yield_value'), 2)
        )
        
        yield_statistics = {
            'very_low': Bore_hole.objects.filter(yield_value__lt=2).count(),
            'low': Bore_hole.objects.filter(yield_value__gte=2, yield_value__lt=5).count(),
            'medium': Bore_hole.objects.filter(yield_value__gte=5, yield_value__lt=10).count(),
            'high': Bore_hole.objects.filter(yield_value__gte=10, yield_value__lt=20).count(),
            'very_high': Bore_hole.objects.filter(yield_value__gte=20).count(),
            'min_yield': yield_stats['min_yield'] or 0,
            'max_yield': yield_stats['max_yield'] or 100,
            'avg_yield': yield_stats['avg_yield'] or 0
        }
        
        # ============= TOTAL STATISTICS =============
        functional_count = Bore_hole.objects.filter(
            Q(operation_field__icontains='functional') &
            ~Q(operation_field__icontains='non')
        ).count()
        
        non_functional_count = Bore_hole.objects.filter(
            Q(operation_field__icontains='non-functional') |
            Q(operation_field__icontains='not working') |
            Q(operation_field__icontains='broken')
        ).count()
        
        functional_rate = round((functional_count / total_boreholes * 100), 1) if total_boreholes > 0 else 0
        
        total_stats = {
            'total_boreholes': total_boreholes,
            'functional_count': functional_count,
            'non_functional_count': non_functional_count,
            'functional_rate': functional_rate,
            'avg_yield': yield_stats['avg_yield'] or 0,
            'min_yield': yield_stats['min_yield'] or 0,
            'max_yield': yield_stats['max_yield'] or 0,
            'avg_ph': ph_stats['avg_ph'] or 7.0,
            'min_ph': ph_stats['min_ph'] or 0,
            'max_ph': ph_stats['max_ph'] or 14
        }
        
        # ============= COUNTY PERFORMANCE =============
        county_performance = []
        
        for county_name in counties[:20]:
            if county_name:
                county_points = Bore_hole.objects.filter(admin_1__iexact=county_name)
                county_total = county_points.count()
                
                if county_total > 0:
                    county_functional = county_points.filter(
                        Q(operation_field__icontains='functional') &
                        ~Q(operation_field__icontains='non')
                    ).count()
                    
                    county_functional_rate = round((county_functional / county_total * 100), 1)
                    county_yield = county_points.aggregate(avg=Avg('yield_value'))['avg'] or 0
                    county_ph = county_points.aggregate(avg=Avg('ph'))['avg'] or 7.0
                    
                    performance_score = round(
                        county_functional_rate * 0.5 + 
                        min(county_yield / 20 * 100, 100) * 0.3 + 
                        (1 - abs(county_ph - 7) / 7) * 100 * 0.2,
                        1
                    )
                    
                    county_performance.append({
                        'admin_1': county_name[:50],
                        'county': county_name[:50],
                        'total_points': county_total,
                        'functional_points': county_functional,
                        'functional_rate': county_functional_rate,
                        'avg_yield': round(county_yield, 2),
                        'avg_ph': round(county_ph, 2),
                        'performance_score': performance_score
                    })
        
        county_performance = sorted(county_performance, key=lambda x: x['performance_score'], reverse=True)
        
        # ============= SOURCE ANALYSIS =============
        source_analysis = list(Bore_hole.objects.exclude(
            source_1__isnull=True
        ).exclude(
            source_1=''
        ).values('source_1').annotate(
            count=Count('id')
        ).order_by('-count')[:15])
        
        for item in source_analysis:
            item['percentage'] = round((item['count'] / total_boreholes * 100), 1) if total_boreholes > 0 else 0
            item['source_1'] = item['source_1'][:30] if item['source_1'] else 'Unknown'
            item['source'] = item['source_1']
            item['value'] = item['count']
        
        # ============= STRUCTURE ANALYSIS =============
        first_structure_data = list(Bore_hole.objects.exclude(
            first_stru__isnull=True
        ).exclude(
            first_stru=''
        ).values('first_stru').annotate(
            count=Count('id')
        ).order_by('-count')[:10])
        
        second_structure_data = list(Bore_hole.objects.exclude(
            second_str__isnull=True
        ).exclude(
            second_str=''
        ).values('second_str').annotate(
            count=Count('id')
        ).order_by('-count')[:10])
        
        structure_analysis = {
            'first_structure': first_structure_data,
            'second_structure': second_structure_data
        }
        
        # ============= GEOGRAPHICAL COVERAGE =============
        counties_with_points = Bore_hole.objects.exclude(
            admin_1__isnull=True
        ).values('admin_1').distinct().count()
        
        subcounties_with_points = Bore_hole.objects.exclude(
            locality__isnull=True
        ).values('locality').distinct().count()
        
        total_counties = County.objects.exclude(
            county__isnull=True
        ).exclude(
            county=''
        ).count()
        
        total_subcounties = SubCounty.objects.exclude(
            subcounty__isnull=True
        ).exclude(
            subcounty=''
        ).count()
        
        geographical_coverage = {
            'counties_with_water_points': counties_with_points,
            'subcounties_with_water_points': subcounties_with_points,
            'coverage_rate_counties': round((counties_with_points / total_counties * 100), 1) if total_counties > 0 else 0,
            'coverage_rate_subcounties': round((subcounties_with_points / total_subcounties * 100), 1) if total_subcounties > 0 else 0,
            'total_counties': total_counties,
            'total_subcounties': total_subcounties
        }
        
        # ============= PREPARE CONTEXT FOR TEMPLATE =============
        context = {
            # Pass these as regular Python objects for direct template access
            'filter_options': filter_options,
            'water_quality_indicators': water_quality_indicators,
            'yield_statistics': yield_statistics,
            'total_stats': total_stats,
            'geographical_coverage': geographical_coverage,
            'county_performance': county_performance,
            'source_analysis': source_analysis,
            'structure_analysis': structure_analysis,
            
            # Pass these as JSON strings for JavaScript
            'filter_options_json': json.dumps(filter_options, default=str),
            'total_stats_json': json.dumps(total_stats, default=str),
            'county_performance_json': json.dumps(county_performance, default=str),
            'source_analysis_json': json.dumps(source_analysis, default=str),
            'structure_analysis_json': json.dumps(structure_analysis, default=str),
            'geographical_coverage_json': json.dumps(geographical_coverage, default=str),
            'water_quality_indicators_json': json.dumps(water_quality_indicators, default=str),
            'yield_statistics_json': json.dumps(yield_statistics, default=str),
            
            'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M")
        }
        
        return render(request, 'analytics_dashboard.html', context)
        
    except Exception as e:
        logger.error(f"Error in analytics_dashboard: {e}")
        import traceback
        logger.error(traceback.format_exc())
        
        # Return empty but structured context on error
        empty_filter_options = {
            'counties': [],
            'subcounties': [],
            'wards': [],
            'source_types': [],
            'operation_statuses': ['Functional', 'Non-Functional', 'Needs Repair', 'Unknown']
        }
        
        empty_water_quality = {
            'acidic_count': 0, 'neutral_count': 0, 'alkaline_count': 0,
            'min_ph': 0, 'max_ph': 14, 'avg_ph': 7.0
        }
        
        empty_yield_stats = {
            'very_low': 0, 'low': 0, 'medium': 0, 'high': 0, 'very_high': 0,
            'min_yield': 0, 'max_yield': 100, 'avg_yield': 0
        }
        
        empty_total_stats = {
            'total_boreholes': 0, 'functional_count': 0, 'non_functional_count': 0,
            'functional_rate': 0, 'avg_yield': 0, 'avg_ph': 7.0,
            'min_yield': 0, 'max_yield': 0, 'min_ph': 0, 'max_ph': 14
        }
        
        error_context = {
            # Pass these as regular Python objects
            'filter_options': empty_filter_options,
            'water_quality_indicators': empty_water_quality,
            'yield_statistics': empty_yield_stats,
            'total_stats': empty_total_stats,
            'geographical_coverage': {},
            'county_performance': [],
            'source_analysis': [],
            'structure_analysis': {'first_structure': [], 'second_structure': []},
            
            # JSON versions
            'filter_options_json': json.dumps(empty_filter_options, default=str),
            'total_stats_json': json.dumps(empty_total_stats, default=str),
            'county_performance_json': json.dumps([], default=str),
            'source_analysis_json': json.dumps([], default=str),
            'structure_analysis_json': json.dumps({'first_structure': [], 'second_structure': []}, default=str),
            'geographical_coverage_json': json.dumps({}, default=str),
            'water_quality_indicators_json': json.dumps(empty_water_quality, default=str),
            'yield_statistics_json': json.dumps(empty_yield_stats, default=str),
            
            'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M"),
            'error': True
        }
        
        return render(request, 'analytics_dashboard.html', error_context)
    


def get_distinct_values_safe(model, field_name, limit=50):
    """Safely get distinct values from a model field"""
    try:
        values = model.objects.exclude(
            **{f'{field_name}__isnull': True}
        ).exclude(
            **{f'{field_name}': ''}
        ).values_list(field_name, flat=True).distinct()[:limit]
        
        result = []
        for v in values:
            if v and str(v).strip():
                result.append(str(v).strip()[:100])  # Truncate for safety
        return sorted(result)
    except Exception as e:
        logger.error(f"Error getting distinct values for {field_name}: {e}")
        return []


def prepare_context_safe(**kwargs):
    """Prepare context with safe JSON serialization"""
    context = {}
    for key, value in kwargs.items():
        try:
            # Convert to JSON and back to ensure it's serializable
            context[key] = json.dumps(value, default=str)
        except Exception as e:
            logger.error(f"Error serializing {key}: {e}")
            context[key] = json.dumps({})
    return context


def create_empty_context():
    """Create an empty context with proper structure"""
    return {
        'filter_options': json.dumps({
            'counties': [], 'subcounties': [], 'countries': [],
            'source_types': [], 'operation_statuses': [],
            'water_restrictions': [], 'structures': {'first': [], 'second': [], 'third': []}
        }),
        'total_stats': json.dumps({
            'total_boreholes': 0, 'functional_count': 0, 'non_functional_count': 0,
            'functional_rate': 0, 'avg_yield': 0, 'avg_ph': 7.0
        }),
        'county_performance': json.dumps([]),
        'source_analysis': json.dumps([]),
        'structure_analysis': json.dumps({}),
        'geographical_coverage': json.dumps({}),
        'water_quality_indicators': json.dumps({}),
        'yield_statistics': json.dumps({}),
        'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M"),
    }


@cache_page(60 * 15)  # Cache for 15 minutes
def get_analytics_data(request):
    """
    Comprehensive API endpoint for analytics data with deep filtering
    Supports multiple filter types and aggregation levels
    """
    try:
        # Parse filters from request
        filters = {}
        for key in request.GET:
            if key not in ['aggregation', 'limit', 'offset', 'sort_by', 'sort_order']:
                value = request.GET.get(key)
                if value:
                    # Try to parse JSON if it's a complex value
                    try:
                        filters[key] = json.loads(value)
                    except:
                        filters[key] = value
        
        # Get aggregation level and pagination
        aggregation_level = request.GET.get('aggregation', 'admin_1')
        limit = int(request.GET.get('limit', 50))
        offset = int(request.GET.get('offset', 0))
        sort_by = request.GET.get('sort_by', 'performance_score')
        sort_order = request.GET.get('sort_order', 'desc')
        
        # Start with base queryset
        queryset = Bore_hole.objects.all()
        
        # Apply filters
        queryset = AnalyticsEngine.apply_filters(queryset, filters)
        
        # Get total count
        total_count = queryset.count()
        
        # Get paginated data
        paginated_queryset = queryset[offset:offset + limit]
        
        # Calculate comprehensive statistics
        statistics = {
            'total_count': total_count,
            'functional_count': queryset.filter(
                Q(operation_field__icontains='functional') |
                Q(operation_field__icontains='working')
            ).count(),
            'non_functional_count': queryset.filter(
                Q(operation_field__icontains='non-functional') |
                Q(operation_field__icontains='not working')
            ).count(),
            'under_maintenance_count': queryset.filter(
                Q(operation_field__icontains='maintenance') |
                Q(operation_field__icontains='repair')
            ).count(),
        }
        
        # Calculate rates
        if statistics['total_count'] > 0:
            statistics['functional_rate'] = round(
                (statistics['functional_count'] / statistics['total_count']) * 100, 1
            )
            statistics['non_functional_rate'] = round(
                (statistics['non_functional_count'] / statistics['total_count']) * 100, 1
            )
        else:
            statistics['functional_rate'] = 0
            statistics['non_functional_rate'] = 0
        
        # Add water quality statistics
        statistics.update(AnalyticsEngine.calculate_water_quality_indicators(queryset))
        
        # Add yield statistics
        statistics.update(AnalyticsEngine.calculate_yield_statistics(queryset))
        
        # Add spatial coverage
        statistics.update(AnalyticsEngine.get_spatial_coverage(queryset))
        
        # Aggregate by geographical level
        aggregation_map = {
            'admin_1': 'admin_1',
            'locality': 'locality',
            'country': 'country',
            'source_1': 'source_1',
            'operation_field': 'operation_field',
            'water_rest': 'water_rest',
        }
        
        aggregation_field = aggregation_map.get(aggregation_level, 'admin_1')
        
        if aggregation_field:
            # Base aggregation
            aggregated_data = queryset.exclude(
                **{f'{aggregation_field}__isnull': True}
            ).exclude(
                **{f'{aggregation_field}': ''}
            ).values(
                aggregation_field
            ).annotate(
                count=Count('id'),
                functional_count=Count(Case(
                    When(
                        Q(operation_field__icontains='functional') |
                        Q(operation_field__icontains='working'),
                        then=1
                    )
                )),
                avg_yield=Round(Avg('yield_value'), 2),
                avg_ph=Round(Avg('ph'), 2),
                avg_ec=Round(Avg('ec'), 2),
                min_depth=Min(Cast('well_depth', FloatField())),
                max_depth=Max(Cast('well_depth', FloatField())),
                avg_depth=Round(Avg(Cast('well_depth', FloatField())), 2),
            )
            
            # Calculate rates and performance scores
            for item in aggregated_data:
                if item['count'] > 0:
                    item['functional_rate'] = round(
                        (item['functional_count'] / item['count']) * 100, 1
                    )
                    
                    # Calculate performance score
                    item['performance_score'] = AnalyticsEngine.calculate_performance_score({
                        'total_points': item['count'],
                        'functional_rate': item['functional_rate'],
                        'avg_yield': item['avg_yield'] or 0,
                        'avg_ph': item['avg_ph'] or 7.0,
                    })
                else:
                    item['functional_rate'] = 0
                    item['performance_score'] = 0
            
            # Sort the data
            if sort_by in aggregated_data[0] if aggregated_data else False:
                reverse = sort_order == 'desc'
                aggregated_data = sorted(aggregated_data, key=lambda x: x.get(sort_by, 0), reverse=reverse)
            
            # Apply pagination
            aggregated_data = list(aggregated_data[offset:offset + limit])
        else:
            aggregated_data = []
        
        # Get spatial distribution
        spatial_distribution = get_spatial_distribution(queryset, aggregation_level)
        
        # Prepare response
        response_data = {
            'success': True,
            'statistics': statistics,
            'aggregated_data': aggregated_data,
            'spatial_distribution': spatial_distribution,
            'pagination': {
                'total': total_count,
                'limit': limit,
                'offset': offset,
                'has_more': (offset + limit) < total_count,
            },
            'filters_applied': filters,
        }
        
        return JsonResponse(response_data, safe=False)
        
    except Exception as e:
        logger.error(f"Error in get_analytics_data: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e),
            'statistics': {},
            'aggregated_data': [],
            'spatial_distribution': {},
        }, status=500)


def get_drilldown_data(request):
    """
    Deep drilldown analysis for specific geographical areas
    Supports multiple drilldown levels and comparative analysis
    """
    try:
        area_type = request.GET.get('area_type', 'county')
        area_name = request.GET.get('area_name', '')
        drilldown_level = request.GET.get('drilldown_level', 'subcounty')
        compare_with = request.GET.get('compare_with', '')
        
        if not area_name:
            return JsonResponse({'error': 'Area name is required'}, status=400)
        
        # Base queryset for the area
        if area_type == 'county':
            area_queryset = Bore_hole.objects.filter(admin_1__iexact=area_name)
        elif area_type == 'subcounty':
            area_queryset = Bore_hole.objects.filter(locality__iexact=area_name)
        elif area_type == 'ward':
            # Assuming ward information might be in locality or other field
            area_queryset = Bore_hole.objects.filter(locality__icontains=area_name)
        else:
            area_queryset = Bore_hole.objects.none()
        
        # Get area statistics
        area_total = area_queryset.count()
        
        if area_total == 0:
            return JsonResponse({
                'success': False,
                'error': 'No data found for the specified area'
            }, status=404)
        
        area_functional = area_queryset.filter(
            Q(operation_field__icontains='functional') |
            Q(operation_field__icontains='working')
        ).count()
        
        area_stats = area_queryset.aggregate(
            avg_yield=Round(Avg('yield_value'), 2),
            avg_ph=Round(Avg('ph'), 2),
            avg_ec=Round(Avg('ec'), 2),
            min_yield=Min('yield_value'),
            max_yield=Max('yield_value'),
        )
        
        functional_rate = round((area_functional / area_total * 100), 1) if area_total > 0 else 0
        
        area_stats = {
            'total': area_total,
            'functional': area_functional,
            'functional_rate': functional_rate,
            'avg_yield': area_stats['avg_yield'] or 0,
            'avg_ph': area_stats['avg_ph'] or 7.0,
            'avg_ec': area_stats['avg_ec'] or 0,
            'min_yield': area_stats['min_yield'] or 0,
            'max_yield': area_stats['max_yield'] or 0,
            'performance_score': AnalyticsEngine.calculate_performance_score({
                'total_points': area_total,
                'functional_rate': functional_rate,
                'avg_yield': area_stats['avg_yield'] or 0,
                'avg_ph': area_stats['avg_ph'] or 7.0,
            })
        }
        
        # Get drilldown data
        drilldown_data = []
        
        if drilldown_level == 'subcounty' and area_type == 'county':
            # Drill down to subcounties within the county
            subcounties = Bore_hole.objects.filter(
                admin_1__iexact=area_name
            ).exclude(locality__isnull=True).values('locality').distinct()
            
            for subcounty in subcounties:
                subcounty_name = subcounty['locality']
                if subcounty_name:
                    subcounty_points = Bore_hole.objects.filter(
                        admin_1__iexact=area_name,
                        locality__iexact=subcounty_name
                    )
                    subcounty_total = subcounty_points.count()
                    
                    if subcounty_total > 0:
                        subcounty_stats = subcounty_points.aggregate(
                            functional_count=Count(Case(
                                When(
                                    Q(operation_field__icontains='functional') |
                                    Q(operation_field__icontains='working'),
                                    then=1
                                )
                            )),
                            avg_yield=Round(Avg('yield_value'), 2),
                            avg_ph=Round(Avg('ph'), 2),
                        )
                        
                        subcounty_functional_rate = round(
                            (subcounty_stats['functional_count'] / subcounty_total * 100), 1
                        )
                        
                        drilldown_info = {
                            'name': subcounty_name,
                            'total': subcounty_total,
                            'functional': subcounty_stats['functional_count'],
                            'functional_rate': subcounty_functional_rate,
                            'avg_yield': subcounty_stats['avg_yield'] or 0,
                            'avg_ph': subcounty_stats['avg_ph'] or 7.0,
                            'performance_score': AnalyticsEngine.calculate_performance_score({
                                'total_points': subcounty_total,
                                'functional_rate': subcounty_functional_rate,
                                'avg_yield': subcounty_stats['avg_yield'] or 0,
                                'avg_ph': subcounty_stats['avg_ph'] or 7.0,
                            })
                        }
                        
                        drilldown_data.append(drilldown_info)
            
            # Sort by performance score
            drilldown_data = sorted(drilldown_data, key=lambda x: x['performance_score'], reverse=True)
        
        elif drilldown_level == 'source_type':
            # Drill down by source type
            source_types = area_queryset.exclude(source_1__isnull=True).values('source_1').distinct()
            
            for source in source_types:
                source_name = source['source_1']
                if source_name:
                    source_points = area_queryset.filter(source_1__iexact=source_name)
                    source_total = source_points.count()
                    
                    if source_total > 0:
                        source_stats = source_points.aggregate(
                            functional_count=Count(Case(
                                When(
                                    Q(operation_field__icontains='functional') |
                                    Q(operation_field__icontains='working'),
                                    then=1
                                )
                            )),
                            avg_yield=Round(Avg('yield_value'), 2),
                            reliability=Round(Avg(Case(
                                When(yield_value__isnull=False, then=Value(1)),
                                default=Value(0),
                                output_field=FloatField()
                            )), 2),
                        )
                        
                        source_functional_rate = round(
                            (source_stats['functional_count'] / source_total * 100), 1
                        )
                        
                        drilldown_info = {
                            'name': source_name,
                            'total': source_total,
                            'functional': source_stats['functional_count'],
                            'functional_rate': source_functional_rate,
                            'avg_yield': source_stats['avg_yield'] or 0,
                            'reliability': source_stats['reliability'] or 0,
                        }
                        
                        drilldown_data.append(drilldown_info)
            
            # Sort by count
            drilldown_data = sorted(drilldown_data, key=lambda x: x['total'], reverse=True)
        
        else:
            drilldown_data = []
        
        # Comparative analysis if requested
        comparative_data = {}
        if compare_with:
            compare_queryset = Bore_hole.objects.filter(admin_1__iexact=compare_with)
            compare_total = compare_queryset.count()
            
            if compare_total > 0:
                compare_functional = compare_queryset.filter(
                    Q(operation_field__icontains='functional') |
                    Q(operation_field__icontains='working')
                ).count()
                
                compare_stats = compare_queryset.aggregate(
                    avg_yield=Round(Avg('yield_value'), 2),
                    avg_ph=Round(Avg('ph'), 2),
                )
                
                compare_functional_rate = round((compare_functional / compare_total * 100), 1)
                
                comparative_data = {
                    'compared_area': compare_with,
                    'statistics': {
                        'total': compare_total,
                        'functional': compare_functional,
                        'functional_rate': compare_functional_rate,
                        'avg_yield': compare_stats['avg_yield'] or 0,
                        'avg_ph': compare_stats['avg_ph'] or 7.0,
                    },
                    'comparison': {
                        'yield_difference': round(
                            (area_stats['avg_yield'] or 0) - (compare_stats['avg_yield'] or 0), 2
                        ),
                        'functional_rate_difference': round(
                            (area_stats['functional_rate'] or 0) - (compare_functional_rate or 0), 1
                        ),
                        'count_difference': area_stats['total'] - compare_total,
                    }
                }
        
        # Get spatial points for mapping
        spatial_points = area_queryset.exclude(
            latitude__isnull=True, 
            longitude__isnull=True
        ).values('latitude', 'longitude', 'yield_value', 'operation_field', 'source_1', 'ph')[:1000]
        
        response_data = {
            'success': True,
            'area_type': area_type,
            'area_name': area_name,
            'area_statistics': area_stats,
            'drilldown_data': drilldown_data,
            'comparative_analysis': comparative_data,
            'spatial_points': list(spatial_points),
            'water_quality': AnalyticsEngine.calculate_water_quality_indicators(area_queryset),
            'yield_analysis': AnalyticsEngine.calculate_yield_statistics(area_queryset),
        }
        
        return JsonResponse(response_data, safe=False)
        
    except Exception as e:
        logger.error(f"Error in get_drilldown_data: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


def export_analytics_data(request):
    """
    Export analytics data in multiple formats (CSV, Excel, JSON, GeoJSON)
    """
    try:
        export_format = request.GET.get('format', 'csv').lower()
        filters = json.loads(request.GET.get('filters', '{}'))
        
        # Apply filters
        queryset = Bore_hole.objects.all()
        queryset = AnalyticsEngine.apply_filters(queryset, filters)
        
        # Get data
        data = list(queryset.values(
            'country', 'admin_1', 'locality',
            'latitude', 'longitude', 'elevation',
            'yield_value', 'well_depth', 'operation_field',
            'source_1', 'first_stru', 'second_str', 'third_stru',
            'water_rest', 'ec', 'ph', 'temperatur'
        ))
        
        if export_format == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="water_points_analytics.csv"'
            
            writer = csv.DictWriter(response, fieldnames=data[0].keys() if data else [])
            writer.writeheader()
            writer.writerows(data)
            
            return response
        
        elif export_format == 'excel':
            df = pd.DataFrame(data)
            output = BytesIO()
            
            # Create Excel writer
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, sheet_name='Water Points', index=False)
                
                # Add summary sheet
                summary_data = {
                    'Metric': ['Total Points', 'Functional Rate', 'Average Yield', 'Average pH'],
                    'Value': [
                        len(data),
                        round((len([d for d in data if 'functional' in str(d.get('operation_field', '')).lower()]) / len(data) * 100), 1) if data else 0,
                        round(df['yield_value'].mean(), 2) if 'yield_value' in df.columns and not df['yield_value'].isnull().all() else 0,
                        round(df['ph'].mean(), 2) if 'ph' in df.columns and not df['ph'].isnull().all() else 0,
                    ]
                }
                pd.DataFrame(summary_data).to_excel(writer, sheet_name='Summary', index=False)
            
            output.seek(0)
            response = HttpResponse(
                output.getvalue(),
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            response['Content-Disposition'] = 'attachment; filename="water_points_analytics.xlsx"'
            return response
        
        elif export_format == 'geojson':
            features = []
            water_points = queryset.exclude(latitude__isnull=True, longitude__isnull=True)[:10000]
            
            for point in water_points:
                feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [point.longitude, point.latitude]
                    },
                    "properties": {
                        "id": point.id,
                        "county": point.admin_1,
                        "subcounty": point.locality,
                        "yield": point.yield_value,
                        "status": point.operation_field,
                        "source": point.source_1,
                        "ph": point.ph,
                        "ec": point.ec,
                        "depth": point.well_depth,
                        "water_rest": point.water_rest,
                    }
                }
                features.append(feature)
            
            geojson = {
                "type": "FeatureCollection",
                "features": features
            }
            
            response = JsonResponse(geojson)
            response['Content-Disposition'] = 'attachment; filename="water_points.geojson"'
            return response
        
        else:  # JSON
            response = JsonResponse({
                'metadata': {
                    'export_date': datetime.now().isoformat(),
                    'total_records': len(data),
                    'filters_applied': filters,
                },
                'data': data
            })
            response['Content-Disposition'] = 'attachment; filename="water_points_analytics.json"'
            return response
            
    except Exception as e:
        logger.error(f"Error exporting data: {e}")
        return JsonResponse({'error': str(e)}, status=500)


# ============================================
# SUPPORTING FUNCTIONS
# ============================================

def get_spatial_distribution(queryset, aggregation_level='admin_1'):
    """Calculate spatial distribution metrics"""
    if aggregation_level == 'admin_1':
        # Group by county
        distribution = []
        counties = queryset.exclude(admin_1__isnull=True).values('admin_1').distinct()
        
        for county in counties:
            county_name = county['admin_1']
            county_points = queryset.filter(admin_1=county_name)
            county_total = county_points.count()
            
            if county_total > 0:
                county_stats = county_points.aggregate(
                    functional_count=Count(Case(
                        When(
                            Q(operation_field__icontains='functional') |
                            Q(operation_field__icontains='working'),
                            then=1
                        )
                    )),
                    avg_yield=Round(Avg('yield_value'), 2),
                )
                
                functional_rate = round((county_stats['functional_count'] / county_total * 100), 1)
                
                distribution.append({
                    'name': county_name,
                    'count': county_total,
                    'functional_count': county_stats['functional_count'],
                    'functional_rate': functional_rate,
                    'avg_yield': county_stats['avg_yield'] or 0,
                    'density': round(county_total / 1000.0, 2),  # Per 1000 km² approximation
                    'performance_score': AnalyticsEngine.calculate_performance_score({
                        'total_points': county_total,
                        'functional_rate': functional_rate,
                        'avg_yield': county_stats['avg_yield'] or 0,
                        'avg_ph': 7.0,  # Default value
                    })
                })
        
        # Sort by count
        distribution = sorted(distribution, key=lambda x: x['count'], reverse=True)[:20]
    else:
        distribution = []
    
    return distribution


def get_advanced_analytics(request):
    """
    Advanced analytics including clustering, predictive metrics, and anomaly detection
    """
    try:
        # Get all boreholes with yield and pH data
        boreholes = Bore_hole.objects.exclude(
            yield_value__isnull=True, 
            ph__isnull=True
        ).values('admin_1', 'yield_value', 'ph', 'ec')[:1000]
        
        if not boreholes:
            return JsonResponse({
                'success': False,
                'error': 'Insufficient data for advanced analytics'
            })
        
        # Convert to lists for analysis
        yields = [b['yield_value'] for b in boreholes if b['yield_value'] is not None]
        ph_values = [b['ph'] for b in boreholes if b['ph'] is not None]
        
        # Basic statistics
        avg_yield = np.mean(yields) if yields else 0
        std_yield = np.std(yields) if len(yields) > 1 else 1
        
        # Cluster analysis (simplified k-means)
        clusters = []
        if len(yields) > 10:
            # Create simple clusters based on yield and pH
            for i in range(min(5, len(boreholes))):
                cluster_data = {
                    'cluster': i + 1,
                    'avg_yield': round(np.mean([b['yield_value'] for b in boreholes[i*200:(i+1)*200]]), 2) if boreholes[i*200:(i+1)*200] else 0,
                    'avg_ph': round(np.mean([b['ph'] for b in boreholes[i*200:(i+1)*200] if b['ph'] is not None]), 2) if boreholes[i*200:(i+1)*200] else 0,
                    'count': len(boreholes[i*200:(i+1)*200])
                }
                clusters.append(cluster_data)
        
        # Identify outliers/anomalies
        anomalies = []
        if std_yield > 0:
            for borehole in boreholes[:50]:  # Limit to first 50 for performance
                if borehole['yield_value'] is not None:
                    z_score = (borehole['yield_value'] - avg_yield) / std_yield
                    if abs(z_score) > 2:  # Outside 2 standard deviations
                        anomalies.append({
                            'county': borehole['admin_1'] or 'Unknown',
                            'yield': borehole['yield_value'],
                            'ph': borehole['ph'],
                            'z_score': round(z_score, 2)
                        })
        
        # Predictive metrics (simplified)
        maintenance_needs = round(
            Bore_hole.objects.filter(
                Q(operation_field__icontains='repair') |
                Q(operation_field__icontains='maintenance') |
                Q(operation_field__icontains='broken')
            ).count() / max(Bore_hole.objects.count(), 1) * 100, 1
        )
        
        # Yield trend (simplified - would need temporal data)
        recent_data = boreholes[:100]  # Assuming recent data
        recent_avg_yield = np.mean([b['yield_value'] for b in recent_data if b['yield_value'] is not None]) if recent_data else 0
        
        yield_trend = 'increasing' if recent_avg_yield > avg_yield else 'decreasing' if recent_avg_yield < avg_yield else 'stable'
        
        predictive_metrics = {
            'yield_trend': yield_trend,
            'maintenance_needs': maintenance_needs,
            'reliability_score': round(100 - maintenance_needs, 1),
            'predicted_functional_rate': round(100 - maintenance_needs * 0.8, 1),  # Simplified prediction
        }
        
        return JsonResponse({
            'success': True,
            'clusters': clusters,
            'anomalies': anomalies[:20],  # Limit to 20 anomalies
            'predictive_metrics': predictive_metrics,
            'correlation_matrix': calculate_correlations(boreholes),
            'summary': {
                'total_analyzed': len(boreholes),
                'avg_yield': round(avg_yield, 2),
                'std_yield': round(std_yield, 2),
                'anomaly_count': len(anomalies)
            }
        }, safe=False)
        
    except Exception as e:
        logger.error(f"Error in advanced analytics: {e}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


def calculate_correlations(boreholes):
    """
    Calculate correlations between different metrics
    Returns a simplified correlation matrix
    """
    if not boreholes:
        return {}
    
    # Extract data
    yields = []
    ph_values = []
    ec_values = []
    
    for b in boreholes:
        if b['yield_value'] is not None:
            yields.append(b['yield_value'])
        if b['ph'] is not None:
            ph_values.append(b['ph'])
        if b['ec'] is not None:
            ec_values.append(b['ec'])
    
    # Calculate correlations if we have enough data
    correlations = {}
    
    if len(yields) > 1 and len(ph_values) > 1:
        try:
            corr_yield_ph = np.corrcoef(yields[:len(ph_values)], ph_values[:len(yields)])[0, 1]
            correlations['yield_ph'] = round(corr_yield_ph, 3)
        except:
            correlations['yield_ph'] = 0
    
    if len(yields) > 1 and len(ec_values) > 1:
        try:
            corr_yield_ec = np.corrcoef(yields[:len(ec_values)], ec_values[:len(yields)])[0, 1]
            correlations['yield_ec'] = round(corr_yield_ec, 3)
        except:
            correlations['yield_ec'] = 0
    
    if len(ph_values) > 1 and len(ec_values) > 1:
        try:
            corr_ph_ec = np.corrcoef(ph_values[:len(ec_values)], ec_values[:len(ph_values)])[0, 1]
            correlations['ph_ec'] = round(corr_ph_ec, 3)
        except:
            correlations['ph_ec'] = 0
    
    return correlations


def get_geographical_hierarchy(request):
    """
    Returns the complete geographical hierarchy for navigation
    """
    try:
        hierarchy = {
            'countries': list(Bore_hole.objects.exclude(country__isnull=True)
                             .values('country').distinct()
                             .values_list('country', flat=True)),
            
            'counties': list(Bore_hole.objects.exclude(admin_1__isnull=True)
                            .values('admin_1').distinct()
                            .values_list('admin_1', flat=True)),
            
            'subcounties': list(Bore_hole.objects.exclude(locality__isnull=True)
                               .values('locality').distinct()
                               .values_list('locality', flat=True)),
        }
        
        # Filter out None values
        hierarchy = {k: [v for v in vs if v] for k, vs in hierarchy.items()}
        
        return JsonResponse(hierarchy, safe=False)
    except Exception as e:
        logger.error(f"Error in get_geographical_hierarchy: {e}")
        return JsonResponse({'error': str(e)}, status=500)


def get_filter_options(request):
    """
    API endpoint to get all available filter options
    """
    try:
        # Get yield ranges
        yield_agg = Bore_hole.objects.aggregate(
            min=Min('yield_value'),
            max=Max('yield_value')
        )
        
        # Get pH ranges
        ph_agg = Bore_hole.objects.aggregate(
            min=Min('ph'),
            max=Max('ph')
        )
        
        # Get EC ranges
        ec_agg = Bore_hole.objects.aggregate(
            min=Min('ec'),
            max=Max('ec')
        )
        
        options = {
            'counties': AnalyticsEngine.get_distinct_field_values(Bore_hole, 'admin_1'),
            'subcounties': AnalyticsEngine.get_distinct_field_values(Bore_hole, 'locality'),
            'countries': AnalyticsEngine.get_distinct_field_values(Bore_hole, 'country'),
            'source_types': AnalyticsEngine.get_distinct_field_values(Bore_hole, 'source_1'),
            'operation_statuses': ['Functional', 'Non-Functional', 'Needs Repair', 'Unknown'],
            'water_restrictions': AnalyticsEngine.get_distinct_field_values(Bore_hole, 'water_rest'),
            'yield_ranges': {
                'min': yield_agg['min'] or 0,
                'max': yield_agg['max'] or 100,
            },
            'ph_ranges': {
                'min': ph_agg['min'] or 0,
                'max': ph_agg['max'] or 14,
            },
            'ec_ranges': {
                'min': ec_agg['min'] or 0,
                'max': ec_agg['max'] or 5000,
            },
        }
        
        return JsonResponse(options, safe=False)
    except Exception as e:
        logger.error(f"Error in get_filter_options: {e}")
        return JsonResponse({'error': str(e)}, status=500)


def get_map_statistics(request):
    """Get statistics for map visualization"""
    try:
        total_counties = County.objects.count()
        total_subcounties = SubCounty.objects.count()
        total_wards = Ward.objects.count()
        total_water_points = Bore_hole.objects.count()
        
        # Get water points summary
        functional_count = Bore_hole.objects.filter(
            Q(operation_field__icontains='functional') |
            Q(operation_field__icontains='working')
        ).count()
        
        functional_rate = round((functional_count / total_water_points * 100), 1) if total_water_points > 0 else 0
        
        return JsonResponse({
            "total_counties": total_counties,
            "total_subcounties": total_subcounties,
            "total_wards": total_wards,
            "total_water_points": total_water_points,
            "functional_water_points": functional_count,
            "functional_rate": functional_rate,
            "last_updated": datetime.now().strftime("%Y-%m-%d")
        })
    except Exception as e:
        logger.error(f"Error in get_map_statistics: {e}")
        return JsonResponse({'error': str(e)}, status=500)
    
    
    
    
    
    
#######################
############################
##############################
#######################
# Add these new functions to your views.py

def get_filter_options(request):
    """Get all filter options for the analytics dashboard"""
    try:
        # Get counties - use the 'county' field name
        counties = County.objects.all().order_by('county')
        county_options = []
        for county in counties:
            if county.county:  # Only include if name exists
                county_options.append({
                    'id': county.id,
                    'name': county.county.strip()
                })
        
        # Get subcounties - use the 'subcounty' field name
        subcounties = SubCounty.objects.all().order_by('subcounty')
        subcounty_options = []
        for sub in subcounties:
            if sub.subcounty:  # Only include if name exists
                subcounty_options.append({
                    'id': sub.id,
                    'name': sub.subcounty.strip(),
                    'county': sub.county.strip() if sub.county else None
                })
        
        # Get wards - use the 'ward' field name
        wards = Ward.objects.all().order_by('ward')
        ward_options = []
        for ward in wards:
            if ward.ward:  # Only include if name exists
                ward_options.append({
                    'id': ward.id,
                    'name': ward.ward.strip(),
                    'subcounty': ward.subcounty.strip() if ward.subcounty else None,
                    'county': ward.county.strip() if ward.county else None
                })
        
        # Get unique source types from Bore_hole
        source_types = Bore_hole.objects.exclude(source_1__isnull=True).exclude(source_1='').values_list('source_1', flat=True).distinct().order_by('source_1')
        
        # Get unique status types from Bore_hole
        status_types = Bore_hole.objects.exclude(operation_field__isnull=True).exclude(operation_field='').values_list('operation_field', flat=True).distinct().order_by('operation_field')
        
        # Get pH range
        ph_values = Bore_hole.objects.exclude(ph__isnull=True).values_list('ph', flat=True)
        ph_min = min(ph_values) if ph_values else 0
        ph_max = max(ph_values) if ph_values else 14
        
        # Get yield range
        yield_values = Bore_hole.objects.exclude(yield_value__isnull=True).values_list('yield_value', flat=True)
        yield_min = min(yield_values) if yield_values else 0
        yield_max = max(yield_values) if yield_values else 100
        
        data = {
            'counties': county_options,
            'subcounties': subcounty_options,
            'wards': ward_options,
            'source_types': list(source_types),
            'status_types': list(status_types),
            'ph_range': {
                'min': float(ph_min),
                'max': float(ph_max)
            },
            'yield_range': {
                'min': float(yield_min),
                'max': float(yield_max)
            }
        }
        
        return JsonResponse(data)
    except Exception as e:
        print(f"Error in get_filter_options: {e}")
        return JsonResponse({'error': str(e)}, status=500)


def get_geographical_hierarchy(request):
    """Get geographical hierarchy data for cascading dropdowns"""
    try:
        # Build hierarchical data structure
        hierarchy = []
        
        counties = County.objects.all().order_by('county')
        for county in counties:
            if not county.county:
                continue
                
            county_data = {
                'id': county.id,
                'name': county.county.strip(),
                'subcounties': []
            }
            
            # Get subcounties for this county
            subcounties = SubCounty.objects.filter(county__iexact=county.county).order_by('subcounty')
            for sub in subcounties:
                if not sub.subcounty:
                    continue
                    
                sub_data = {
                    'id': sub.id,
                    'name': sub.subcounty.strip(),
                    'wards': []
                }
                
                # Get wards for this subcounty
                wards = Ward.objects.filter(subcounty__iexact=sub.subcounty, county__iexact=county.county).order_by('ward')
                for ward in wards:
                    if ward.ward:
                        sub_data['wards'].append({
                            'id': ward.id,
                            'name': ward.ward.strip()
                        })
                
                if sub_data['wards']:  # Only add if has wards
                    county_data['subcounties'].append(sub_data)
            
            # Only add counties that have subcounties
            if county_data['subcounties']:
                hierarchy.append(county_data)
        
        return JsonResponse({'hierarchy': hierarchy})
    except Exception as e:
        print(f"Error in get_geographical_hierarchy: {e}")
        return JsonResponse({'error': str(e)}, status=500)


def get_dropdown_data(request):
    """Simple endpoint to get dropdown data for the map dashboard"""
    try:
        counties = County.objects.all().order_by('county')
        county_data = [{'id': c.id, 'name': c.county} for c in counties if c.county]
        
        subcounties = SubCounty.objects.all().order_by('subcounty')
        subcounty_data = [{'id': s.id, 'name': s.subcounty, 'county': s.county} for s in subcounties if s.subcounty]
        
        wards = Ward.objects.all().order_by('ward')
        ward_data = [{'id': w.id, 'name': w.ward, 'subcounty': w.subcounty, 'county': w.county} for w in wards if w.ward]
        
        return JsonResponse({
            'counties': county_data,
            'subcounties': subcounty_data,
            'wards': ward_data
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)