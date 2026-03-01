from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
from .models import County, SubCounty, Ward, Bore_hole, water_points
from django.core.serializers import serialize
import json
from datetime import datetime, timedelta
from django.db.models import Count, Q, Sum, Avg, Max, Min, F, Value, FloatField, Case, When, IntegerField
from django.db.models.functions import Coalesce
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from django.db import connection
from collections import defaultdict
import logging
from django.core.cache import cache

logger = logging.getLogger(__name__)

def landing_page(request):
    """
    Optimized landing page with caching to reduce database load
    """
    # Try to get from cache first (cache for 5 minutes)
    cache_key = 'landing_page_data'
    cached_context = cache.get(cache_key)
    
    if cached_context:
        return render(request, 'landing.html', cached_context)
    
    try:
        # ===== SINGLE QUERY APPROACH =====
        # Get all counts in one go using aggregation
        water_points_count = water_points.objects.count()
        bore_hole_count = Bore_hole.objects.count()
        
        # If no data, return early with empty context
        if water_points_count == 0 and bore_hole_count == 0:
            return render(request, 'landing.html', get_empty_context())
        
        # ===== OPTIMIZED WATER POINTS STATUS =====
        # Use Case/When for status classification in a single query
        wp_status = water_points.objects.aggregate(
            functional=Count(Case(
                When(
                    Q(status_cle__icontains='functional') | 
                    Q(status_cle__icontains='yes') |
                    Q(status_cle__icontains='working') |
                    Q(status_cle__iexact='1'),
                    ~Q(status_cle__icontains='non'),
                    then=1
                ),
                output_field=IntegerField()
            )),
            non_functional=Count(Case(
                When(
                    Q(status_cle__icontains='non-functional') | 
                    Q(status_cle__icontains='non functional') |
                    Q(status_cle__icontains='broken') |
                    Q(status_cle__icontains='not working'),
                    then=1
                ),
                output_field=IntegerField()
            )),
            needs_repair=Count(Case(
                When(
                    Q(status_cle__icontains='repair') | 
                    Q(status_cle__icontains='needs') |
                    Q(status_cle__icontains='maintenance'),
                    then=1
                ),
                output_field=IntegerField()
            )),
            unknown=Count(Case(
                When(
                    Q(status_cle__isnull=True) | 
                    Q(status_cle='') | 
                    Q(status_cle__icontains='unknown') |
                    Q(status_cle__icontains='other'),
                    then=1
                ),
                output_field=IntegerField()
            ))
        )
        
        # ===== OPTIMIZED BOREHOLE STATUS =====
        bh_status = Bore_hole.objects.aggregate(
            functional=Count(Case(
                When(
                    Q(operation_field__icontains='functional') | 
                    Q(operation_field__icontains='yes') |
                    Q(operation_field__icontains='working') |
                    Q(operation_field__iexact='1'),
                    ~Q(operation_field__icontains='non'),
                    then=1
                ),
                output_field=IntegerField()
            )),
            non_functional=Count(Case(
                When(
                    Q(operation_field__icontains='non-functional') | 
                    Q(operation_field__icontains='non functional') |
                    Q(operation_field__icontains='broken'),
                    then=1
                ),
                output_field=IntegerField()
            )),
            needs_repair=Count(Case(
                When(
                    Q(operation_field__icontains='repair') | 
                    Q(operation_field__icontains='needs'),
                    then=1
                ),
                output_field=IntegerField()
            )),
            unknown=Count(Case(
                When(
                    Q(operation_field__isnull=True) | 
                    Q(operation_field='') | 
                    Q(operation_field__icontains='unknown'),
                    then=1
                ),
                output_field=IntegerField()
            ))
        )
        
        # ===== OPTIMIZED YIELD STATISTICS =====
        # Single query for yield stats
        yield_stats = Bore_hole.objects.exclude(
            yield_value__isnull=True
        ).exclude(
            yield_value=0
        ).aggregate(
            total=Coalesce(Sum('yield_value'), 0.0),
            avg=Coalesce(Avg('yield_value'), 0.0),
            max=Coalesce(Max('yield_value'), 0.0),
            min=Coalesce(Min('yield_value'), 0.0)
        )
        
        # ===== OPTIMIZED POPULATION STATISTICS =====
        # Single query for population stats
        pop_stats = water_points.objects.exclude(
            assigned_p__isnull=True
        ).exclude(
            assigned_p=0
        ).aggregate(
            total=Coalesce(Sum('assigned_p'), 0),
            avg=Coalesce(Avg('assigned_p'), 0),
            max=Coalesce(Max('assigned_p'), 0)
        )
        
        # Try local_popu if no assigned_p data
        if pop_stats['total'] == 0:
            pop_stats = water_points.objects.exclude(
                local_popu__isnull=True
            ).exclude(
                local_popu=0
            ).aggregate(
                total=Coalesce(Sum('local_popu'), 0),
                avg=Coalesce(Avg('local_popu'), 0),
                max=Coalesce(Max('local_popu'), 0)
            )
        
        # ===== OPTIMIZED COUNTY COVERAGE =====
        # Single query for unique counties
        counties_with_water = water_points.objects.exclude(
            clean_adm1__isnull=True
        ).exclude(
            clean_adm1=''
        ).exclude(
            clean_adm1__in=['null', 'none', 'NULL', 'NONE']
        ).values('clean_adm1').distinct().count()
        
        counties_with_boreholes = Bore_hole.objects.exclude(
            admin_1__isnull=True
        ).exclude(
            admin_1=''
        ).exclude(
            admin_1__in=['null', 'none', 'NULL', 'NONE']
        ).values('admin_1').distinct().count()
        
        # Get total counties count (cached or from DB)
        total_counties = County.objects.count() or 47
        
        # ===== OPTIMIZED TOP COUNTIES =====
        # Single query for top counties
        top_counties = list(water_points.objects.exclude(
            clean_adm1__isnull=True
        ).exclude(
            clean_adm1=''
        ).exclude(
            clean_adm1__in=['null', 'none', 'NULL', 'NONE']
        ).values('clean_adm1').annotate(
            count=Count('id')
        ).order_by('-count')[:10])
        
        # ===== OPTIMIZED WATER QUALITY STATS =====
        # Single query for EC stats
        ec_stats = Bore_hole.objects.exclude(
            ec__isnull=True
        ).exclude(
            ec=0
        ).aggregate(
            avg=Coalesce(Avg('ec'), 0),
            safe_count=Count(Case(
                When(ec__lt=1500, then=1),
                output_field=IntegerField()
            )),
            total_count=Count('ec')
        )
        
        avg_ec = int(ec_stats['avg'])
        safe_water_percentage = round(
            (ec_stats['safe_count'] / ec_stats['total_count'] * 100), 1
        ) if ec_stats['total_count'] > 0 else 0
        
        # ===== OPTIMIZED PH STATS =====
        ph_stats = Bore_hole.objects.exclude(
            ph__isnull=True
        ).exclude(
            ph=0
        ).aggregate(
            avg=Coalesce(Avg('ph'), 7.0)
        )
        avg_ph = round(ph_stats['avg'], 1)
        
        # ===== OPTIMIZED SOURCE DISTRIBUTION =====
        source_distribution = list(water_points.objects.exclude(
            water_sour__isnull=True
        ).exclude(
            water_sour=''
        ).values('water_sour').annotate(
            count=Count('id')
        ).order_by('-count')[:8])
        
        # ===== OPTIMIZED MANAGEMENT DISTRIBUTION =====
        management_distribution = list(water_points.objects.exclude(
            management__isnull=True
        ).exclude(
            management=''
        ).values('management').annotate(
            count=Count('id')
        ).order_by('-count')[:8])
        
        # ===== OPTIMIZED YEAR DISTRIBUTION =====
        current_year = datetime.now().year
        year_distribution = list(water_points.objects.exclude(
            install_ye__isnull=True
        ).exclude(
            install_ye=0
        ).filter(
            install_ye__gte=1950,
            install_ye__lte=current_year
        ).values('install_ye').annotate(
            count=Count('id')
        ).order_by('-install_ye')[:15])
        
        # ===== RECENT REPORTS =====
        thirty_days_ago = datetime.now().date() - timedelta(days=30)
        recent_reports = water_points.objects.filter(
            report_dat__gte=thirty_days_ago
        ).count()
        
        # ===== CALCULATE COMBINED VALUES =====
        total_combined = water_points_count + bore_hole_count
        combined_functional = wp_status['functional'] + bh_status['functional']
        combined_non_functional = wp_status['non_functional'] + bh_status['non_functional']
        combined_needs_repair = wp_status['needs_repair'] + bh_status['needs_repair']
        
        total_with_status = (
            combined_functional + 
            combined_non_functional + 
            combined_needs_repair + 
            wp_status['unknown'] + 
            bh_status['unknown']
        )
        
        functional_percentage = round(
            (combined_functional / total_with_status * 100), 1
        ) if total_with_status > 0 else 0
        
        # ===== COVERAGE PERCENTAGE =====
        active_counties = counties_with_water + counties_with_boreholes
        coverage_percentage = round(
            (active_counties / total_counties * 100), 1
        ) if total_counties > 0 else 0
        
        # ===== FORMAT POPULATION =====
        total_population = pop_stats['total']
        if total_population >= 1000000:
            total_population_formatted = f"{total_population/1000000:.1f}M"
        elif total_population >= 1000:
            total_population_formatted = f"{total_population/1000:.1f}K"
        else:
            total_population_formatted = str(total_population) if total_population > 0 else "0"
        
        # ===== SYSTEM HEALTH SCORE =====
        functionality_score = (combined_functional / max(total_combined, 1)) * 40
        coverage_score = (active_counties / max(total_counties, 1)) * 30
        density_score = min((total_combined / 5000) * 100, 30) if total_combined > 0 else 0
        system_health_score = min(100, int(functionality_score + coverage_score + density_score))
        
        # ===== PREPARE CONTEXT =====
        context = {
            # Basic counts
            'total_water_points': water_points_count,
            'total_boreholes': bore_hole_count,
            'total_counties': total_counties,
            'total_subcounties': SubCounty.objects.count() or 0,
            'total_wards': Ward.objects.count() or 0,
            'total_combined': total_combined,
            
            # Water point status
            'functional_water_points': wp_status['functional'],
            'non_functional_water_points': wp_status['non_functional'],
            'needs_repair_water_points': wp_status['needs_repair'],
            'unknown_water_points': wp_status['unknown'],
            
            # Borehole status
            'functional_boreholes': bh_status['functional'],
            'non_functional_boreholes': bh_status['non_functional'],
            'needs_repair_boreholes': bh_status['needs_repair'],
            'unknown_boreholes': bh_status['unknown'],
            
            # Combined status
            'combined_functional': combined_functional,
            'combined_non_functional': combined_non_functional,
            'combined_needs_repair': combined_needs_repair,
            'functional_percentage': functional_percentage,
            
            # Borehole statistics
            'total_borehole_yield': yield_stats['total'],
            'average_borehole_yield': round(yield_stats['avg'], 1),
            'max_borehole_yield': round(yield_stats['max'], 1),
            'min_borehole_yield': round(yield_stats['min'], 1),
            
            # Population statistics
            'total_assigned_population': total_population,
            'total_population_formatted': total_population_formatted,
            'avg_population_per_point': int(pop_stats['avg']),
            'max_population_per_point': pop_stats['max'],
            
            # Coverage
            'counties_with_data': active_counties,
            'coverage_percentage': coverage_percentage,
            'recent_reports': recent_reports,
            
            # Distribution data
            'top_counties': [{'name': c['clean_adm1'], 'count': c['count']} for c in top_counties],
            'source_distribution': [{'name': s['water_sour'], 'count': s['count']} for s in source_distribution],
            'management_distribution': [{'name': m['management'], 'count': m['count']} for m in management_distribution],
            'year_distribution': [{'year': y['install_ye'], 'count': y['count']} for y in year_distribution],
            
            # Water quality
            'avg_ec': avg_ec,
            'avg_ph': avg_ph,
            'safe_water_percentage': safe_water_percentage,
            
            # System health
            'system_health_score': system_health_score,
            
            # JSON versions for JavaScript
            'water_points_status_json': json.dumps({
                'functional': wp_status['functional'],
                'non_functional': wp_status['non_functional'],
                'needs_repair': wp_status['needs_repair'],
                'unknown': wp_status['unknown']
            }),
            
            'boreholes_status_json': json.dumps({
                'functional': bh_status['functional'],
                'non_functional': bh_status['non_functional'],
                'needs_repair': bh_status['needs_repair'],
                'unknown': bh_status['unknown']
            }),
            
            # Summary paragraphs
            'system_summary': (
                f"AquaTrack currently monitors {total_combined:,} water points "
                f"across {active_counties} counties in Kenya, serving an estimated population "
                f"of {total_population_formatted}. The system integrates data from {bore_hole_count} boreholes "
                f"with an average yield of {round(yield_stats['avg'], 1)} m³/h, and provides comprehensive "
                f"coverage across {context['total_subcounties']} sub-counties and {context['total_wards']} wards."
            ),
            
            'functionality_summary': (
                f"Currently, {combined_functional:,} water points ({functional_percentage}%) are functional, "
                f"while {combined_needs_repair:,} require repair and "
                f"{combined_non_functional:,} are non-functional."
            ),
            
            # Timestamps
            'now': datetime.now(),
            'year': datetime.now().year,
            
            # Flags
            'has_data': water_points_count > 0 or bore_hole_count > 0,
            'data_quality_score': system_health_score,
        }
        
        # Cache the context for 5 minutes
        cache.set(cache_key, context, 300)  # 300 seconds = 5 minutes
        
        return render(request, 'landing.html', context)
        
    except Exception as e:
        logger.error(f"ERROR in landing_page: {str(e)}", exc_info=True)
        return render(request, 'landing.html', get_error_context())

def get_empty_context():
    """Return empty context when no data"""
    return {
        'total_water_points': 0,
        'total_boreholes': 0,
        'total_counties': County.objects.count() or 47,
        'total_subcounties': SubCounty.objects.count() or 0,
        'total_wards': Ward.objects.count() or 0,
        'total_combined': 0,
        'functional_water_points': 0,
        'non_functional_water_points': 0,
        'needs_repair_water_points': 0,
        'unknown_water_points': 0,
        'functional_boreholes': 0,
        'non_functional_boreholes': 0,
        'needs_repair_boreholes': 0,
        'unknown_boreholes': 0,
        'combined_functional': 0,
        'combined_non_functional': 0,
        'combined_needs_repair': 0,
        'functional_percentage': 0,
        'total_borehole_yield': 0,
        'average_borehole_yield': 0,
        'total_population_formatted': '0',
        'avg_population_per_point': 0,
        'counties_with_data': 0,
        'coverage_percentage': 0,
        'recent_reports': 0,
        'top_counties': [],
        'source_distribution': [],
        'management_distribution': [],
        'year_distribution': [],
        'avg_ec': 0,
        'avg_ph': 7.0,
        'safe_water_percentage': 0,
        'system_health_score': 0,
        'system_summary': "No water point data available in the system yet.",
        'functionality_summary': "No status data available.",
        'now': datetime.now(),
        'year': datetime.now().year,
        'has_data': False,
    }

def get_error_context():
    """Return error context"""
    context = get_empty_context()
    context.update({
        'system_summary': "System encountered an error while loading data. Please refresh the page.",
        'functionality_summary': "Unable to load functionality data.",
        'data_error': True,
    })
    return context