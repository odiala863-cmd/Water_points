/**
 * Analytics API Service
 * Browser-compatible version - NO EXPORT STATEMENTS
 */

// Check if already defined to prevent duplicate declarations
if (typeof AnalyticsAPI !== 'undefined') {
    console.warn('AnalyticsAPI already declared, skipping re-declaration');
} else {
    class AnalyticsAPI {
        constructor() {
            this.baseUrl = '/analytics/';
            this.csrfToken = document.querySelector('[name=csrf-token]')?.content || 
                            document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
            this.requestCache = new Map();
            this.pendingRequests = new Map();
        }

        /**
         * Helper method for making API calls with caching and deduplication
         */
        async fetchAPI(endpoint, params = {}, method = 'GET', body = null) {
            // Create cache key for GET requests
            const cacheKey = method === 'GET' ? `${endpoint}:${JSON.stringify(params)}` : null;
            
            // Check cache for GET requests (5 second cache)
            if (method === 'GET' && this.requestCache.has(cacheKey)) {
                const cached = this.requestCache.get(cacheKey);
                if (Date.now() - cached.timestamp < 5000) {
                    return cached.data;
                }
                this.requestCache.delete(cacheKey);
            }

            // Deduplicate pending GET requests
            if (method === 'GET' && this.pendingRequests.has(cacheKey)) {
                return this.pendingRequests.get(cacheKey);
            }

            try {
                // Build URL with proper endpoint mapping
                let url = this.buildUrl(endpoint, params, method);
                
                // Configure headers
                const headers = {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                };

                // Add CSRF token for non-GET requests
                if (method !== 'GET' && this.csrfToken) {
                    headers['X-CSRFToken'] = this.csrfToken;
                }

                // Configure request options
                const options = {
                    method,
                    headers,
                    credentials: 'same-origin'
                };

                // Add body for non-GET requests
                if (method !== 'GET' && body) {
                    options.body = JSON.stringify(body);
                }

                // Create promise for this request
                const requestPromise = (async () => {
                    const response = await fetch(url, options);
                    
                    // Check if response is OK
                    if (!response.ok) {
                        let errorData;
                        try {
                            errorData = await response.json();
                        } catch (e) {
                            errorData = { error: `HTTP error! status: ${response.status}` };
                        }
                        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
                    }

                    const data = await response.json();
                    
                    // Cache successful GET responses
                    if (method === 'GET' && cacheKey) {
                        this.requestCache.set(cacheKey, {
                            data,
                            timestamp: Date.now()
                        });
                        
                        // Limit cache size
                        if (this.requestCache.size > 50) {
                            const oldestKey = this.requestCache.keys().next().value;
                            this.requestCache.delete(oldestKey);
                        }
                    }
                    
                    return data;
                })();

                // Store pending GET request
                if (method === 'GET' && cacheKey) {
                    this.pendingRequests.set(cacheKey, requestPromise);
                    
                    // Clean up after request completes
                    requestPromise.finally(() => {
                        this.pendingRequests.delete(cacheKey);
                    });
                }

                return await requestPromise;
                
            } catch (error) {
                console.error(`API Error (${endpoint}):`, error);
                throw error;
            }
        }

        /**
         * Build URL with proper endpoint mapping for Django backend
         */
        buildUrl(endpoint, params, method) {
            // Map API endpoints to Django view endpoints
            const endpointMap = {
                'filter-options': '',
                'structure-analysis': '',
                'geographical-distribution': '',
                'source-analysis': '',
                'dashboard-summary': '',
                'water-quality-report': '',
                'yield-analysis': '',
                'data': '',
                'drilldown': '',
                'advanced': '',
                'geography-hierarchy': '',
                'export': '',
                'map-statistics': '',
                'realtime': '',
                'spatial-data': '',
                'trends': '',
                'correlations': '',
                'clusters': '',
                'anomalies': '',
                'predict-maintenance': '',
                'operational-efficiency': '',
                'comparative-analysis': '',
                'settings': '',
                'user-preferences': '',
                'notification-settings': '',
                'alert-thresholds': '',
                'system-status': '',
                'data-quality': '',
                'backup-status': '',
                'audit-logs': '',
                'clear-cache': '',
                'test': '',
                'batch-process': '',
                'export-templates': '',
                'validation-rules': '',
                'transformation-functions': '',
                'enrichment-sources': '',
                'ml-models': '',
                'water-points': ''
            };

            // Handle special endpoints
            if (endpoint.includes('water-points/')) {
                return `${this.baseUrl}${endpoint}`;
            }

            // For endpoints that need the ?endpoint= parameter
            if (endpointMap.hasOwnProperty(endpoint)) {
                let url = `${this.baseUrl}?endpoint=${endpoint}`;
                
                // Add query parameters for GET requests
                if (method === 'GET' && Object.keys(params).length > 0) {
                    const queryParams = new URLSearchParams();
                    Object.keys(params).forEach(key => {
                        if (params[key] !== undefined && params[key] !== null) {
                            queryParams.append(key, params[key]);
                        }
                    });
                    url += `&${queryParams.toString()}`;
                }
                
                return url;
            }

            // Default fallback
            let url = `${this.baseUrl}${endpoint}`;
            if (method === 'GET' && Object.keys(params).length > 0) {
                const queryString = new URLSearchParams(params).toString();
                url += `?${queryString}`;
            }
            return url;
        }

        /**
         * Helper method to serialize filters for API requests
         */
        serializeFilters(filters) {
            const serialized = {};
            
            Object.keys(filters).forEach(key => {
                const value = filters[key];
                
                if (Array.isArray(value)) {
                    if (value.length > 0) {
                        serialized[key] = JSON.stringify(value);
                    }
                } else if (typeof value === 'object' && value !== null) {
                    if (Object.keys(value).length > 0) {
                        serialized[key] = JSON.stringify(value);
                    }
                } else if (value !== undefined && value !== null && value !== '') {
                    serialized[key] = value;
                }
            });
            
            return serialized;
        }

        // ============================================
        // EXISTING DASHBOARD ENDPOINTS
        // ============================================

        /**
         * Get filter options for dashboard
         * Maps to: /analytics/?endpoint=filter-options
         */
        async getFilterOptions() {
            return await this.fetchAPI('filter-options');
        }

        /**
         * Get structure analysis data
         * Maps to: /analytics/?endpoint=structure-analysis&structure_type=first|second|combined
         */
        async getStructureAnalysis(structureType = 'first') {
            return await this.fetchAPI('structure-analysis', { structure_type: structureType });
        }

        /**
         * Get geographical distribution
         * Maps to: /analytics/?endpoint=geographical-distribution&resolution=county|subcounty
         */
        async getGeographicalDistribution(resolution = 'county') {
            return await this.fetchAPI('geographical-distribution', { resolution });
        }

        /**
         * Get source analysis data
         * Maps to: /analytics/?endpoint=source-analysis
         */
        async getSourceAnalysis() {
            return await this.fetchAPI('source-analysis');
        }

        /**
         * Get dashboard summary statistics
         * Maps to: /analytics/?endpoint=dashboard-summary
         */
        async getDashboardSummary() {
            return await this.fetchAPI('dashboard-summary');
        }

        /**
         * Get water quality report
         * Maps to: /analytics/?endpoint=water-quality-report&county=&subcounty=
         */
        async getWaterQualityReport(county = null, subcounty = null) {
            const params = {};
            if (county) params.county = county;
            if (subcounty) params.subcounty = subcounty;
            return await this.fetchAPI('water-quality-report', params);
        }

        /**
         * Get yield analysis
         * Maps to: /analytics/?endpoint=yield-analysis&min_yield=&max_yield=
         */
        async getYieldAnalysis(minYield = 0, maxYield = 100) {
            return await this.fetchAPI('yield-analysis', {
                min_yield: minYield,
                max_yield: maxYield
            });
        }

        /**
         * Get comprehensive analytics data with filters
         */
        async getAnalyticsData(filters = {}, aggregation = 'admin_1', limit = 50, offset = 0) {
            const params = {
                aggregation,
                limit,
                offset,
                ...this.serializeFilters(filters)
            };
            return await this.fetchAPI('data', params);
        }

        /**
         * Get drilldown data for specific area
         */
        async getDrilldownData(areaType, areaName, drilldownLevel = 'subcounty', compareWith = '') {
            const params = {
                area_type: areaType,
                area_name: areaName,
                drilldown_level: drilldownLevel,
                compare_with: compareWith
            };
            return await this.fetchAPI('drilldown', params);
        }

        /**
         * Get advanced analytics including clustering and anomalies
         */
        async getAdvancedAnalytics() {
            return await this.fetchAPI('advanced');
        }

        /**
         * Get geographical hierarchy
         */
        async getGeographicalHierarchy() {
            return await this.fetchAPI('geography-hierarchy');
        }

        /**
         * Export data in various formats
         */
        async exportData(format, filters = {}) {
            const params = {
                format,
                filters: JSON.stringify(filters)
            };
            
            const url = this.buildUrl('export', params, 'GET');
            window.open(url, '_blank');
        }

        /**
         * Get map statistics
         */
        async getMapStatistics() {
            return await this.fetchAPI('map-statistics');
        }

        /**
         * Test API connection
         */
        async testConnection() {
            try {
                const response = await this.getFilterOptions();
                return {
                    success: true,
                    response: response
                };
            } catch (error) {
                console.error('API Connection Test Failed:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        }

        /**
         * Clear all caches
         */
        clearRequestCache() {
            this.requestCache.clear();
            console.log('API request cache cleared');
        }

        /**
         * Abort all pending requests
         */
        abortPendingRequests() {
            this.pendingRequests.clear();
            console.log('Pending requests aborted');
        }
    }

    // Create global instance
    const analyticsAPI = new AnalyticsAPI();
    
    // Add to window object for global access
    window.AnalyticsAPI = AnalyticsAPI;
    window.analyticsAPI = analyticsAPI;
    
    console.log('✅ AnalyticsAPI initialized successfully');
}

// Prevent multiple instances
if (window.analyticsAPIInstance) {
    console.warn('AnalyticsAPI already initialized, using existing instance');
} else {
    window.analyticsAPIInstance = window.analyticsAPI || analyticsAPI;
}