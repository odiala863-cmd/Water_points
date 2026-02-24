from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
from .models import County, SubCounty, Ward, Bore_hole, water_points
from django.core.serializers import serialize
import json
from datetime import datetime, timedelta
from django.db.models import Count, Q, Sum, Avg, Max, Min, F, Value, FloatField
from django.db.models.functions import Coalesce
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from django.db import connection
from collections import defaultdict
import logging
import sys

logger = logging.getLogger(__name__)

def landing_page(request):
    """
    Enhanced landing page with comprehensive overview
    All data is dynamically retrieved from the database
    """
    try:
        # ===== DEBUG: Check if tables have data =====
        print("\n" + "="*50)
        print("DEBUGGING DATABASE COUNTS:")
        print("="*50)
        
        # Direct counts using Django ORM
        water_points_count = water_points.objects.count()
        bore_hole_count = Bore_hole.objects.count()
        county_count = County.objects.count()
        subcounty_count = SubCounty.objects.count()
        ward_count = Ward.objects.count()
        
        print(f"water_points.objects.count(): {water_points_count}")
        print(f"Bore_hole.objects.count(): {bore_hole_count}")
        print(f"County.objects.count(): {county_count}")
        print(f"SubCounty.objects.count(): {subcounty_count}")
        print(f"Ward.objects.count(): {ward_count}")
        
        # Check if there are records with non-null values
        if water_points_count > 0:
            # Get first record to see field names
            first_wp = water_points.objects.first()
            if first_wp:
                print(f"\nSample water_point fields:")
                for field in first_wp._meta.fields:
                    print(f"  {field.name}: {getattr(first_wp, field.name)}")
        
        if bore_hole_count > 0:
            first_bh = Bore_hole.objects.first()
            if first_bh:
                print(f"\nSample bore_hole fields:")
                for field in first_bh._meta.fields:
                    print(f"  {field.name}: {getattr(first_bh, field.name)}")
        
        print("="*50 + "\n")
        
        # ===== BASIC COUNTS =====
        total_water_points = water_points_count
        total_boreholes = bore_hole_count
        total_counties = county_count
        total_subcounties = subcounty_count
        total_wards = ward_count
        total_combined = total_water_points + total_boreholes
        
        # ===== WATER POINTS STATUS COUNTS =====
        # Get all status_cle values to see what we're working with
        if total_water_points > 0:
            status_values = water_points.objects.values('status_cle').distinct()
            print("Distinct status_cle values:", list(status_values))
        
        # Try different matching strategies
        functional_wp = water_points.objects.filter(
            Q(status_cle__icontains='functional') | 
            Q(status_cle__icontains='yes') |
            Q(status_cle__icontains='working') |
            Q(status_cle__iexact='1') |
            Q(status_cle__iexact='true')
        ).exclude(
            Q(status_cle__icontains='non') |
            Q(status_cle__icontains='no') |
            Q(status_cle__icontains='false')
        ).count()
        
        non_functional_wp = water_points.objects.filter(
            Q(status_cle__icontains='non-functional') | 
            Q(status_cle__icontains='non functional') |
            Q(status_cle__icontains='broken') |
            Q(status_cle__icontains='not working')
        ).count()
        
        needs_repair_wp = water_points.objects.filter(
            Q(status_cle__icontains='repair') | 
            Q(status_cle__icontains='needs') |
            Q(status_cle__icontains='maintenance')
        ).count()
        
        unknown_wp = water_points.objects.filter(
            Q(status_cle__isnull=True) | 
            Q(status_cle='') | 
            Q(status_cle__icontains='unknown') |
            Q(status_cle__icontains='other')
        ).count()
        
        print(f"Functional WP: {functional_wp}")
        print(f"Non-functional WP: {non_functional_wp}")
        print(f"Needs repair WP: {needs_repair_wp}")
        print(f"Unknown WP: {unknown_wp}")
        
        # ===== BOREHOLE STATUS COUNTS =====
        if total_boreholes > 0:
            op_values = Bore_hole.objects.values('operation_field').distinct()
            print("Distinct operation_field values:", list(op_values))
        
        functional_bh = Bore_hole.objects.filter(
            Q(operation_field__icontains='functional') | 
            Q(operation_field__icontains='yes') |
            Q(operation_field__icontains='working') |
            Q(operation_field__iexact='1')
        ).exclude(
            Q(operation_field__icontains='non')
        ).count()
        
        non_functional_bh = Bore_hole.objects.filter(
            Q(operation_field__icontains='non-functional') | 
            Q(operation_field__icontains='non functional') |
            Q(operation_field__icontains='broken')
        ).count()
        
        needs_repair_bh = Bore_hole.objects.filter(
            Q(operation_field__icontains='repair') | 
            Q(operation_field__icontains='needs')
        ).count()
        
        unknown_bh = Bore_hole.objects.filter(
            Q(operation_field__isnull=True) | 
            Q(operation_field='') | 
            Q(operation_field__icontains='unknown')
        ).count()
        
        # ===== COMBINED STATUS =====
        combined_functional = functional_wp + functional_bh
        combined_non_functional = non_functional_wp + non_functional_bh
        combined_needs_repair = needs_repair_wp + needs_repair_bh
        combined_unknown = unknown_wp + unknown_bh
        
        # Calculate functional percentage
        total_with_status = combined_functional + combined_non_functional + combined_needs_repair + combined_unknown
        functional_percentage = round((combined_functional / total_with_status * 100), 1) if total_with_status > 0 else 0
        
        # ===== BOREHOLE YIELD STATISTICS =====
        borehole_yield_values = []
        for bh in Bore_hole.objects.all():
            try:
                # Try different fields that might contain yield data
                if bh.yield_value is not None and bh.yield_value != '':
                    val = float(bh.yield_value)
                    if val > 0:
                        borehole_yield_values.append(val)
                        print(f"Found yield value: {val}")
            except (ValueError, TypeError, AttributeError):
                continue
        
        total_borehole_yield = sum(borehole_yield_values)
        average_borehole_yield = round(total_borehole_yield / len(borehole_yield_values), 1) if borehole_yield_values else 0
        max_borehole_yield = round(max(borehole_yield_values), 1) if borehole_yield_values else 0
        min_borehole_yield = round(min(borehole_yield_values), 1) if borehole_yield_values else 0
        
        print(f"Borehole yield values found: {len(borehole_yield_values)}")
        print(f"Total yield: {total_borehole_yield}")
        
        # ===== POPULATION STATISTICS =====
        population_values = []
        for wp in water_points.objects.all():
            try:
                # Try assigned_p first, then local_popu
                if wp.assigned_p is not None and wp.assigned_p != '':
                    val = float(wp.assigned_p)
                    if val > 0:
                        population_values.append(val)
                elif wp.local_popu is not None and wp.local_popu != '':
                    val = float(wp.local_popu)
                    if val > 0:
                        population_values.append(val)
            except (ValueError, TypeError):
                continue
        
        total_population = int(sum(population_values))
        avg_population_per_point = int(total_population / total_water_points) if total_water_points > 0 and total_population > 0 else 0
        max_population_per_point = int(max(population_values)) if population_values else 0
        
        print(f"Population values found: {len(population_values)}")
        print(f"Total population: {total_population}")
        
        # Format population for display
        if total_population >= 1000000:
            total_population_formatted = f"{total_population/1000000:.1f}M"
        elif total_population >= 1000:
            total_population_formatted = f"{total_population/1000:.1f}K"
        else:
            total_population_formatted = str(total_population) if total_population > 0 else "0"
        
        # ===== COUNTY COVERAGE =====
        # Get counties with water points or boreholes
        counties_with_water = set()
        for wp in water_points.objects.all():
            if wp.clean_adm1 and wp.clean_adm1.strip() and wp.clean_adm1.lower() not in ['null', 'none', '']:
                counties_with_water.add(wp.clean_adm1.strip())
        
        counties_with_boreholes = set()
        for bh in Bore_hole.objects.all():
            if bh.admin_1 and bh.admin_1.strip() and bh.admin_1.lower() not in ['null', 'none', '']:
                counties_with_boreholes.add(bh.admin_1.strip())
        
        all_active_counties = counties_with_water.union(counties_with_boreholes)
        counties_with_data = len(all_active_counties)
        coverage_percentage = round((counties_with_data / total_counties * 100), 1) if total_counties > 0 else 0
        
        print(f"Counties with water: {len(counties_with_water)}")
        print(f"Counties with boreholes: {len(counties_with_boreholes)}")
        print(f"Total active counties: {counties_with_data}")
        
        # ===== RECENT REPORTS (30 days) =====
        thirty_days_ago = datetime.now().date() - timedelta(days=30)
        recent_reports = water_points.objects.filter(
            report_dat__gte=thirty_days_ago
        ).count()
        
        # ===== TOP COUNTIES BY WATER POINTS =====
        county_counts = {}
        for wp in water_points.objects.all():
            if wp.clean_adm1 and wp.clean_adm1.strip() and wp.clean_adm1.lower() not in ['null', 'none', '']:
                county = wp.clean_adm1.strip()
                county_counts[county] = county_counts.get(county, 0) + 1
        
        # Sort and get top 10
        sorted_counties = sorted(county_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        top_counties = [{'name': name, 'count': count} for name, count in sorted_counties]
        
        print(f"Top counties: {top_counties}")
        
        # ===== WATER SOURCE DISTRIBUTION =====
        source_counts = {}
        for wp in water_points.objects.all():
            if wp.water_sour and wp.water_sour.strip() and wp.water_sour.lower() not in ['null', 'none', '']:
                source = wp.water_sour.strip()
                source_counts[source] = source_counts.get(source, 0) + 1
        
        sorted_sources = sorted(source_counts.items(), key=lambda x: x[1], reverse=True)[:8]
        source_distribution = [{'name': name, 'count': count} for name, count in sorted_sources]
        
        # ===== MANAGEMENT DISTRIBUTION =====
        mgmt_counts = {}
        for wp in water_points.objects.all():
            if wp.management and wp.management.strip() and wp.management.lower() not in ['null', 'none', '']:
                mgmt = wp.management.strip()
                mgmt_counts[mgmt] = mgmt_counts.get(mgmt, 0) + 1
        
        sorted_mgmt = sorted(mgmt_counts.items(), key=lambda x: x[1], reverse=True)[:8]
        management_distribution = [{'name': name, 'count': count} for name, count in sorted_mgmt]
        
        # ===== YEAR DISTRIBUTION =====
        year_counts = {}
        current_year = datetime.now().year
        for wp in water_points.objects.all():
            try:
                if wp.install_ye and str(wp.install_ye).strip():
                    year = int(float(str(wp.install_ye).strip()))
                    if 1950 <= year <= current_year:
                        year_counts[year] = year_counts.get(year, 0) + 1
            except (ValueError, TypeError):
                continue
        
        sorted_years = sorted(year_counts.items(), key=lambda x: x[0], reverse=True)[:15]
        year_distribution = [{'year': year, 'count': count} for year, count in sorted_years]
        
        # ===== WATER QUALITY STATISTICS =====
        ec_values = []
        for bh in Bore_hole.objects.all():
            try:
                if bh.ec is not None and bh.ec != '' and bh.ec != 0:
                    val = float(bh.ec)
                    if val > 0:
                        ec_values.append(val)
            except (ValueError, TypeError):
                continue
        
        avg_ec = int(sum(ec_values) / len(ec_values)) if ec_values else 0
        
        # Determine safe water percentage based on EC (typically < 1500 µS/cm is safe)
        safe_ec_count = len([v for v in ec_values if v < 1500]) if ec_values else 0
        safe_water_percentage = round((safe_ec_count / len(ec_values) * 100), 1) if ec_values else 0
        
        # ===== PH LEVELS =====
        ph_values = []
        for bh in Bore_hole.objects.all():
            try:
                if bh.ph is not None and bh.ph != '' and bh.ph != 0:
                    val = float(bh.ph)
                    if 0 < val <= 14:  # Valid pH range
                        ph_values.append(val)
            except (ValueError, TypeError):
                continue
        
        avg_ph = round(sum(ph_values) / len(ph_values), 1) if ph_values else 7.0
        
        # ===== SYSTEM HEALTH SCORE =====
        # Calculate overall system health score (0-100)
        functionality_score = (combined_functional / max(total_combined, 1)) * 40
        coverage_score = (counties_with_data / max(total_counties, 1)) * 30
        density_score = min((total_combined / 5000) * 100, 30) if total_combined > 0 else 0
        system_health_score = min(100, int(functionality_score + coverage_score + density_score))
        
        # ===== PREPARE CONTEXT =====
        context = {
            # Basic counts
            'total_water_points': total_water_points,
            'total_boreholes': total_boreholes,
            'total_counties': total_counties,
            'total_subcounties': total_subcounties,
            'total_wards': total_wards,
            'total_combined': total_combined,
            
            # Water point status
            'functional_water_points': functional_wp,
            'non_functional_water_points': non_functional_wp,
            'needs_repair_water_points': needs_repair_wp,
            'unknown_water_points': unknown_wp,
            
            # Borehole status
            'functional_boreholes': functional_bh,
            'non_functional_boreholes': non_functional_bh,
            'needs_repair_boreholes': needs_repair_bh,
            'unknown_boreholes': unknown_bh,
            
            # Combined status
            'combined_functional': combined_functional,
            'combined_non_functional': combined_non_functional,
            'combined_needs_repair': combined_needs_repair,
            'functional_percentage': functional_percentage,
            
            # Borehole statistics
            'total_borehole_yield': total_borehole_yield,
            'average_borehole_yield': average_borehole_yield,
            'max_borehole_yield': max_borehole_yield,
            'min_borehole_yield': min_borehole_yield,
            
            # Population statistics
            'total_assigned_population': total_population,
            'total_population_formatted': total_population_formatted,
            'avg_population_per_point': avg_population_per_point,
            'max_population_per_point': max_population_per_point,
            
            # Coverage
            'counties_with_data': counties_with_data,
            'coverage_percentage': coverage_percentage,
            'recent_reports': recent_reports,
            
            # Distribution data
            'top_counties': top_counties,
            'source_distribution': source_distribution,
            'management_distribution': management_distribution,
            'year_distribution': year_distribution,
            
            # Water quality
            'avg_ec': avg_ec,
            'avg_ph': avg_ph,
            'safe_water_percentage': safe_water_percentage,
            
            # System health
            'system_health_score': system_health_score,
            
            # JSON versions for JavaScript
            'water_points_status_json': json.dumps({
                'functional': functional_wp,
                'non_functional': non_functional_wp,
                'needs_repair': needs_repair_wp,
                'unknown': unknown_wp
            }),
            
            'boreholes_status_json': json.dumps({
                'functional': functional_bh,
                'non_functional': non_functional_bh,
                'needs_repair': needs_repair_bh,
                'unknown': unknown_bh
            }),
            
            # Summary paragraphs
            'system_summary': (
                f"AquaTrack currently monitors {total_combined:,} water points "
                f"across {counties_with_data} counties in Kenya, serving an estimated population "
                f"of {total_population_formatted}. The system integrates data from {total_boreholes} boreholes "
                f"with an average yield of {average_borehole_yield} m³/h, and provides comprehensive "
                f"coverage across {total_subcounties} sub-counties and {total_wards} wards."
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
            'has_data': total_water_points > 0 or total_boreholes > 0,
            'data_quality_score': system_health_score,
        }
        
        # Print final context summary
        print("\n" + "="*50)
        print("FINAL CONTEXT SUMMARY:")
        print("="*50)
        print(f"total_water_points: {context['total_water_points']}")
        print(f"total_boreholes: {context['total_boreholes']}")
        print(f"total_combined: {context['total_combined']}")
        print(f"functional_water_points: {context['functional_water_points']}")
        print(f"counties_with_data: {context['counties_with_data']}")
        print(f"total_population_formatted: {context['total_population_formatted']}")
        print("="*50 + "\n")
        
        return render(request, 'landing.html', context)
        
    except Exception as e:
        logger.error(f"ERROR in landing_page: {str(e)}", exc_info=True)
        print(f"EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Return error context
        error_context = {
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
            'system_summary': "System is currently processing data. Please refresh in a moment.",
            'functionality_summary': "Data is being aggregated. Please check back shortly.",
            'now': datetime.now(),
            'year': datetime.now().year,
            'has_data': False,
            'data_error': True,
        }
        return render(request, 'landing.html', error_context)