/**
 * Analytics Data Service
 * Handles data loading and initialization
 */

class AnalyticsData {
    constructor() {
        this.initialized = false;
    }

    async loadInitialData() {
        try {
            console.log('Loading initial dashboard data...');
            
            // Load all dashboard data
            const [summary, countyData, sourceData, qualityData, yieldData, structureData, coverageData] = await Promise.all([
                this.fetchData('dashboard-summary/'),
                this.fetchData('data/', { aggregation: 'admin_1', limit: 15 }),
                this.fetchData('source-analysis/'),
                this.fetchData('water-quality-report/'),
                this.fetchData('yield-analysis/'),
                this.fetchData('structure-analysis/', { structure_type: 'first' }),
                this.fetchData('geographical-distribution/')
            ]);

            return {
                totalStats: summary || {},
                countyPerformance: countyData?.aggregated_data || [],
                sourceAnalysis: sourceData || [],
                waterQualityIndicators: qualityData || {},
                yieldStatistics: yieldData || {},
                structureAnalysis: structureData || {},
                geographicalCoverage: coverageData || {}
            };
        } catch (error) {
            console.error('Error loading initial data:', error);
            return this.getFallbackData();
        }
    }

    async fetchData(endpoint, params = {}) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const url = `/analytics/${endpoint}${queryString ? '?' + queryString : ''}`;
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`Error fetching ${endpoint}:`, error);
            return null;
        }
    }

    getFallbackData() {
        return {
            totalStats: {
                total_boreholes: 0,
                functional_rate: 0,
                functional_count: 0,
                non_functional_count: 0,
                avg_yield: 0,
                avg_ph: 7.0
            },
            countyPerformance: [],
            sourceAnalysis: [],
            waterQualityIndicators: {
                acidic_count: 0,
                neutral_count: 0,
                alkaline_count: 0,
                min_ph: 0,
                max_ph: 14
            },
            yieldStatistics: {
                min_yield: 0,
                max_yield: 100,
                avg_yield: 0
            },
            structureAnalysis: {
                first_structure: [],
                second_structure: []
            },
            geographicalCoverage: {
                counties_with_water_points: 0,
                subcounties_with_water_points: 0,
                coverage_rate_counties: 0
            }
        };
    }

    async refreshData() {
        const newData = await this.loadInitialData();
        return newData;
    }

    processCountyPerformance(data) {
        if (!Array.isArray(data)) return [];
        
        return data.map(item => ({
            admin_1: item.admin_1 || 'Unknown',
            total_points: item.count || 0,
            functional_points: item.functional_count || 0,
            functional_rate: item.functional_rate || 0,
            avg_yield: item.avg_yield || 0,
            avg_ph: item.avg_ph || 7.0,
            performance_score: item.performance_score || 0
        }));
    }

    processSourceAnalysis(data) {
        if (!Array.isArray(data)) return [];
        
        return data.map(item => ({
            source_1: item.source_1 || 'Unknown',
            count: item.count || 0,
            avg_yield: item.avg_yield || 0,
            functional_rate: item.functional_rate || 0
        }));
    }
}

// Create global instance
const analyticsData = new AnalyticsData();