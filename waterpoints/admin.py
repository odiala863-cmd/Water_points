from django.contrib import admin
from .models import County, SubCounty, Ward, Bore_hole, water_points


# ================== ADMIN FOR ADMIN BOUNDARIES ==================

@admin.register(County)
class CountyAdmin(admin.ModelAdmin):
    list_display = ('county', 'country')
    search_fields = ('county',)


@admin.register(SubCounty)
class SubCountyAdmin(admin.ModelAdmin):
    list_display = ('subcounty', 'county', 'province')
    search_fields = ('subcounty', 'county')


@admin.register(Ward)
class WardAdmin(admin.ModelAdmin):
    list_display = ('ward', 'subcounty', 'county')
    search_fields = ('ward', 'subcounty', 'county')


# ================== ADMIN FOR BOREHOLES ==================

@admin.register(Bore_hole)
class BoreHoleAdmin(admin.ModelAdmin):
    list_display = (
        'locality', 'admin_1', 'country',
        'latitude', 'longitude', 'yield_value', 'well_depth'
    )
    search_fields = ('locality', 'admin_1', 'country')
    list_filter = ('country', 'admin_1')


# ================== ADMIN FOR WATER POINTS ==================

@admin.register(water_points)
class WaterPointAdmin(admin.ModelAdmin):
    list_display = (
        'clean_coun', 'clean_adm1', 'clean_adm2',
        'lat_deg', 'lon_deg', 'status_id', 'water_tech'
    )
    search_fields = ('clean_coun', 'clean_adm1', 'clean_adm2', 'status_id')
    list_filter = ('clean_coun', 'water_tech', 'is_urban')
