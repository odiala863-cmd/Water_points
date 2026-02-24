from django.urls import path
from . import views, landing_view

urlpatterns = [
    # ============= MAIN PAGES =============
    path('', landing_view.landing_page, name='landing'),
    path('map/', views.map_dashboard, name='map_dashboard'),
    path('analytics/', views.analytics_dashboard, name='analytics_dashboard'),
    
    # ============= CORE ANALYTICS API ENDPOINTS =============
    path('api/analytics/summary/', views.get_analytics_summary, name='analytics_summary'),
    path('api/analytics/trends/', views.get_analytics_trends, name='analytics_trends'),
    path('api/analytics/drilldown/', views.get_drilldown_detail, name='drilldown_detail'),
    path('api/analytics/comparison/', views.get_advanced_comparison, name='advanced_comparison'),
    
    # ============= ADVANCED ANALYTICS API ENDPOINTS =============
    path('api/analytics/heatmap/', views.get_heatmap_data, name='heatmap_data'),
    path('api/analytics/clustering/', views.get_clustering_analysis, name='clustering_analysis'),
    path('api/analytics/distribution/', views.get_distribution_analysis, name='distribution_analysis'),
    path('api/analytics/ranking/', views.get_ranking_analysis, name='ranking_analysis'),
    path('api/analytics/anomalies/', views.get_anomaly_detection, name='anomaly_detection'),
    path('api/analytics/forecast/', views.get_forecast_analysis, name='forecast_analysis'),
    path('api/analytics/scenario/', views.get_scenario_analysis, name='scenario_analysis'),
    path('api/analytics/top-performers/', views.get_top_performers, name='top_performers'),
    path('api/analytics/correlation/', views.get_correlation_analysis, name='correlation_analysis'),
    path('api/analytics/timeline/', views.get_timeline_analysis, name='timeline_analysis'),
    path('api/analytics/predictive/', views.get_predictive_metrics, name='predictive_metrics'),
    path('api/analytics/water-quality/', views.get_water_quality_analysis, name='water_quality_analysis'),
    path('api/analytics/service-coverage/', views.get_service_coverage_analysis, name='service_coverage_analysis'),
    path('api/analytics/investment-prioritization/', views.get_investment_prioritization, name='investment_prioritization'),
    path('api/analytics/detailed/', views.get_detailed_stats_api, name='detailed_stats_api'),
    
    # ============= MAP & SPATIAL API ENDPOINTS =============
    path('api/minimap/data/', views.get_minimap_data, name='minimap_data'),
    path('api/counties/', views.get_county_data, name='county_data'),
    path('api/counties/<int:county_id>/', views.get_county_data, name='county_detail'),
    path('api/subcounties/', views.get_subcounty_data, name='subcounty_data'),
    path('api/wards/', views.get_ward_data, name='ward_data'),
    
    # ============= WATER POINTS API ENDPOINTS =============
    path('api/waterpoints/', views.get_water_points_data, name='water_points_data'),
    path('api/filtered-waterpoints/', views.get_filtered_water_points, name='filtered_water_points'),
    
    # ============= BOREHOLES API ENDPOINTS =============
    path('api/boreholes/', views.get_boreholes_data, name='boreholes_data'),
    path('api/filtered-boreholes/', views.get_filtered_boreholes, name='filtered_boreholes'),
    
    # ============= STATISTICS API ENDPOINTS =============
    path('api/stats/', views.get_stats_api, name='stats_api'),
    path('api/stats/detailed/', views.get_detailed_stats_api, name='detailed_stats'),
    
    # ============= DROPDOWN & SEARCH API ENDPOINTS =============
    path('api/dropdown/subcounties/', views.get_subcounty_dropdown, name='subcounty_dropdown'),
    path('api/dropdown/wards/', views.get_ward_dropdown, name='ward_dropdown'),
    path('api/search/', views.search_water_points, name='search'),
    
    # ============= EXPORT API ENDPOINTS =============
    path('api/export/analytics/', views.export_analytics_report, name='export_analytics'),
    path('api/export/geojson/<str:boundary_type>/<int:boundary_id>/', views.export_geojson, name='export_geojson'),
    path('api/export/geojson/', views.export_geojson, name='export_geojson_all'),
    path('api/export/geojson/<str:boundary_type>/', views.export_geojson, name='export_geojson_boundary'),
    
    # ============= SYSTEM & UTILITY ENDPOINTS =============
    path('health/', views.health_check, name='health_check'),
    path('debug/urls/', views.debug_urls, name='debug_urls'),
]