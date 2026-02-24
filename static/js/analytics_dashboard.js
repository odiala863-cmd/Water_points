/**
 * Analytics Dashboard Controller
 * Complete rewrite - Main orchestrator for the water analytics dashboard
 * Version: 2.0.0
 */

class AnalyticsDashboard {
    constructor() {
        // Core properties
        this.api = window.analyticsAPI || null;
        this.charts = window.analyticsCharts || null;
        this.filters = window.analyticsFilters || null;
        
        this.dashboardData = window.dashboardData || null;
        this.currentTheme = localStorage.getItem('dashboard-theme') || 'light';
        this.isFullscreen = false;
        this.currentPage = 1;
        this.pageSize = 15;
        this.sortColumn = 'score';
        this.sortOrder = 'desc';
        this.activeFilters = {};
        this.updateInterval = null;
        this.realTimeEnabled = false;
        
        // Initialize dashboard
        this.init();
    }

    /**
     * Initialize the dashboard
     */
    init() {
        console.log('🚀 Initializing Analytics Dashboard v2.0.0');
        
        // Check if all dependencies are loaded
        this.checkDependencies();
        
        // Initialize components
        this.initTheme();
        this.bindEvents();
        this.loadDashboardData();
        this.setupEventListeners();
        this.startPeriodicUpdates();
        
        // Mark as initialized
        this.initialized = true;
        document.dispatchEvent(new CustomEvent('dashboardInitialized', { 
            detail: { dashboard: this } 
        }));
    }

    /**
     * Check if all required dependencies are loaded
     */
    checkDependencies() {
        const missing = [];
        
        if (!this.api) {
            console.error('❌ AnalyticsAPI not found');
            missing.push('AnalyticsAPI');
        }
        
        if (!this.charts) {
            console.error('❌ AnalyticsCharts not found');
            missing.push('AnalyticsCharts');
        }
        
        if (!this.filters) {
            console.warn('⚠️ AnalyticsFilters not found - using fallback');
            this.filters = this.createFallbackFilters();
        }
        
        if (missing.length > 0) {
            console.warn(`Missing dependencies: ${missing.join(', ')}`);
        }
        
        return missing.length === 0;
    }

    /**
     * Create fallback filters object
     */
    createFallbackFilters() {
        return {
            filters: {},
            listeners: [],
            onFiltersChanged(callback) {
                this.listeners.push(callback);
            },
            getFilters() {
                return this.filters;
            },
            notifyListeners() {
                this.listeners.forEach(cb => cb(this.filters));
            }
        };
    }

    /**
     * Bind DOM events
     */
    bindEvents() {
        // Theme switcher
        const themeSwitcher = document.getElementById('theme-switcher');
        if (themeSwitcher) {
            themeSwitcher.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleTheme();
            });
        }
        
        // Refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.refreshDashboard();
            });
        }
        
        // Export button
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showExportModal();
            });
        }
        
        // Fullscreen button
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleFullscreen();
            });
        }
        
        // Table export button
        const exportTable = document.getElementById('export-table');
        if (exportTable) {
            exportTable.addEventListener('click', (e) => {
                e.preventDefault();
                this.exportTableToCSV();
            });
        }
        
        // Advanced analytics buttons
        const runPredictions = document.getElementById('run-predictions');
        if (runPredictions) {
            runPredictions.addEventListener('click', (e) => {
                e.preventDefault();
                this.runPredictions();
            });
        }
        
        const detectAnomalies = document.getElementById('detect-anomalies');
        if (detectAnomalies) {
            detectAnomalies.addEventListener('click', (e) => {
                e.preventDefault();
                this.detectAnomalies();
            });
        }
        
        const clusterAnalysis = document.getElementById('cluster-analysis');
        if (clusterAnalysis) {
            clusterAnalysis.addEventListener('click', (e) => {
                e.preventDefault();
                this.runClusterAnalysis();
            });
        }
        
        // Pagination
        const prevPage = document.getElementById('prev-page');
        if (prevPage) {
            prevPage.addEventListener('click', (e) => {
                e.preventDefault();
                this.prevPage();
            });
        }
        
        const nextPage = document.getElementById('next-page');
        if (nextPage) {
            nextPage.addEventListener('click', (e) => {
                e.preventDefault();
                this.nextPage();
            });
        }
        
        // County search
        const countySearch = document.getElementById('county-search');
        if (countySearch) {
            countySearch.addEventListener('input', (e) => {
                this.filterCountyTable(e.target.value);
            });
            
            countySearch.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.filterCountyTable(e.target.value);
                }
            });
        }
        
        // Clear all filters
        const clearFilters = document.getElementById('clear-all-filters');
        if (clearFilters) {
            clearFilters.addEventListener('click', (e) => {
                e.preventDefault();
                this.clearAllFilters();
            });
        }
        
        // Apply filters
        const applyFilters = document.getElementById('apply-filters');
        if (applyFilters) {
            applyFilters.addEventListener('click', (e) => {
                e.preventDefault();
                this.applyFilters();
            });
        }
        
        // Toggle filters
        const toggleFilters = document.getElementById('toggle-filters');
        if (toggleFilters) {
            toggleFilters.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleFilterPanel();
            });
        }
        
        // Modal close buttons
        document.querySelectorAll('.modal-close, .btn-secondary').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const modal = e.target.closest('.modal');
                if (modal) {
                    this.closeModal(modal);
                }
            });
        });
        
        // Export format selection
        document.querySelectorAll('.export-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                this.selectExportFormat(option);
            });
        });
        
        // Confirm export
        const confirmExport = document.getElementById('confirm-export');
        if (confirmExport) {
            confirmExport.addEventListener('click', (e) => {
                e.preventDefault();
                this.performExport();
            });
        }
        
        // Cancel export
        const cancelExport = document.getElementById('cancel-export');
        if (cancelExport) {
            cancelExport.addEventListener('click', (e) => {
                e.preventDefault();
                this.closeExportModal();
            });
        }
    }

    /**
     * Setup event listeners for custom events
     */
    setupEventListeners() {
        // Listen for filter changes
        if (this.filters) {
            this.filters.onFiltersChanged((filters) => {
                this.handleFilterChange(filters);
            });
        }
        
        // Listen for chart type changes
        document.addEventListener('chartTypeChanged', (e) => {
            this.handleChartTypeChange(e.detail);
        });
        
        // Listen for quality metric changes
        document.addEventListener('qualityMetricChanged', (e) => {
            this.handleQualityMetricChange(e.detail);
        });
        
        // Listen for structure type changes
        document.addEventListener('structureTypeChanged', (e) => {
            this.handleStructureTypeChange(e.detail);
        });
        
        // Listen for county sort changes
        document.addEventListener('countySortChanged', (e) => {
            this.handleCountySortChange(e.detail);
        });
        
        // Listen for yield chart type changes
        document.addEventListener('yieldChartTypeChanged', (e) => {
            this.handleYieldChartTypeChange(e.detail);
        });
        
        // Window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
        
        // Fullscreen change
        document.addEventListener('fullscreenchange', () => {
            this.isFullscreen = !!document.fullscreenElement;
            const fullscreenBtn = document.getElementById('fullscreen-btn');
            if (fullscreenBtn) {
                const icon = fullscreenBtn.querySelector('i');
                icon.className = this.isFullscreen ? 'fas fa-compress' : 'fas fa-expand';
            }
        });
    }

    /**
     * Initialize theme
     */
    initTheme() {
        const body = document.body;
        body.setAttribute('data-theme', this.currentTheme);
        
        const themeSwitcher = document.getElementById('theme-switcher');
        if (themeSwitcher) {
            const icon = themeSwitcher.querySelector('i');
            const text = themeSwitcher.querySelector('span');
            
            if (this.currentTheme === 'dark') {
                icon.className = 'fas fa-sun';
                text.textContent = 'Light Mode';
            } else {
                icon.className = 'fas fa-moon';
                text.textContent = 'Dark Mode';
            }
        }
        
        // Update charts theme
        if (this.charts && typeof this.charts.updateChartTheme === 'function') {
            this.charts.updateChartTheme(this.currentTheme);
        }
    }

    /**
     * Toggle theme between light and dark
     */
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', this.currentTheme);
        localStorage.setItem('dashboard-theme', this.currentTheme);
        
        const themeSwitcher = document.getElementById('theme-switcher');
        if (themeSwitcher) {
            const icon = themeSwitcher.querySelector('i');
            const text = themeSwitcher.querySelector('span');
            
            if (this.currentTheme === 'dark') {
                icon.className = 'fas fa-sun';
                text.textContent = 'Light Mode';
            } else {
                icon.className = 'fas fa-moon';
                text.textContent = 'Dark Mode';
            }
        }
        
        // Update charts theme
        if (this.charts && typeof this.charts.updateChartTheme === 'function') {
            this.charts.updateChartTheme(this.currentTheme);
        }
        
        this.showNotification(`Switched to ${this.currentTheme} mode`, 'info');
    }

    /**
     * Load dashboard data
     */
    async loadDashboardData() {
        this.showLoading();
        
        try {
            // Try to use pre-loaded data from window
            if (this.dashboardData && Object.keys(this.dashboardData).length > 0) {
                console.log('📊 Using pre-loaded dashboard data');
                this.renderDashboard();
                this.hideLoading();
                return;
            }
            
            // Fallback: Load data via API
            console.log('📡 Loading dashboard data via API...');
            
            if (!this.api) {
                throw new Error('AnalyticsAPI not available');
            }
            
            // Load all necessary data in parallel
            const [summary, countyData, sourceData, qualityData, yieldData, structureData, coverageData] = 
                await Promise.all([
                    this.api.getDashboardSummary().catch(() => null),
                    this.api.getAnalyticsData({}, 'admin_1', 20, 0).catch(() => null),
                    this.api.getSourceTypeAnalysis().catch(() => null),
                    this.api.getWaterQualityReport().catch(() => null),
                    this.api.getYieldAnalysisReport().catch(() => null),
                    this.api.getStructureAnalysis('first').catch(() => null),
                    this.api.getGeographicalDistribution().catch(() => null)
                ]);
            
            this.dashboardData = {
                totalStats: summary || this.getDefaultTotalStats(),
                countyPerformance: countyData?.aggregated_data || this.getDefaultCountyPerformance(),
                sourceAnalysis: sourceData || this.getDefaultSourceAnalysis(),
                waterQualityIndicators: qualityData || this.getDefaultWaterQuality(),
                yieldStatistics: yieldData || this.getDefaultYieldStatistics(),
                structureAnalysis: structureData || this.getDefaultStructureAnalysis(),
                geographicalCoverage: coverageData?.data ? 
                    this.processGeographicalCoverage(coverageData.data) : 
                    this.getDefaultGeographicalCoverage()
            };
            
            this.renderDashboard();
            this.showNotification('Dashboard loaded successfully', 'success');
            
        } catch (error) {
            console.error('❌ Error loading dashboard data:', error);
            
            // Use fallback data
            this.dashboardData = {
                totalStats: this.getDefaultTotalStats(),
                countyPerformance: this.getDefaultCountyPerformance(),
                sourceAnalysis: this.getDefaultSourceAnalysis(),
                waterQualityIndicators: this.getDefaultWaterQuality(),
                yieldStatistics: this.getDefaultYieldStatistics(),
                structureAnalysis: this.getDefaultStructureAnalysis(),
                geographicalCoverage: this.getDefaultGeographicalCoverage()
            };
            
            this.renderDashboard();
            this.showError('Failed to load data. Using default values.');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Render the complete dashboard
     */
    renderDashboard() {
        if (!this.dashboardData) {
            console.error('❌ No dashboard data to render');
            return;
        }
        
        console.log('🎨 Rendering dashboard...');
        
        try {
            // Update metric cards
            this.updateMetricCards();
            
            // Update quick stats
            this.updateQuickStats();
            
            // Render charts
            if (this.charts && typeof this.charts.updateAllCharts === 'function') {
                this.charts.updateAllCharts(this.dashboardData);
            }
            
            // Update county table
            this.updateCountyTable();
            
            // Update coverage stats
            this.updateCoverageStats();
            
            // Update quality indicators
            this.updateQualityIndicators();
            
            // Update structure summary
            this.updateStructureSummary();
            
            // Update performance badges
            this.updatePerformanceBadges();
            
            // Update filter counts
            this.updateFilterCounts();
            
            console.log('✅ Dashboard rendered successfully');
            
        } catch (error) {
            console.error('❌ Error rendering dashboard:', error);
        }
    }

    /**
     * Update metric cards with current data
     */
    updateMetricCards() {
        const stats = this.dashboardData.totalStats || {};
        
        // Total points
        const totalPoints = document.getElementById('total-points');
        if (totalPoints) totalPoints.textContent = this.formatNumber(stats.total_boreholes || 0);
        
        // Functional percentage
        const functionalPercentage = document.getElementById('functional-percentage');
        if (functionalPercentage) functionalPercentage.textContent = `${stats.functional_rate || 0}%`;
        
        // Non-functional / maintenance count
        const nonFunctional = document.getElementById('non-functional');
        if (nonFunctional) nonFunctional.textContent = this.formatNumber(stats.non_functional_count || 0);
        
        // Average yield
        const averageYield = document.getElementById('average-yield');
        if (averageYield) averageYield.textContent = `${(stats.avg_yield || 0).toFixed(1)} m³/h`;
        
        // Average pH
        const averagePH = document.getElementById('average-ph');
        if (averagePH) averagePH.textContent = (stats.avg_ph || 7.2).toFixed(1);
        
        // Live points
        const livePoints = document.getElementById('live-points');
        if (livePoints) livePoints.textContent = this.formatNumber(stats.total_boreholes || 0);
        
        // Functional rate
        const functionalRate = document.getElementById('functional-rate');
        if (functionalRate) functionalRate.textContent = `${stats.functional_rate || 0}%`;
        
        // Avg yield
        const avgYield = document.getElementById('avg-yield');
        if (avgYield) avgYield.textContent = (stats.avg_yield || 0).toFixed(1);
    }

    /**
     * Update quick stats in header
     */
    updateQuickStats() {
        const stats = this.dashboardData.totalStats || {};
        
        const livePoints = document.getElementById('live-points');
        if (livePoints) livePoints.textContent = this.formatNumber(stats.total_boreholes || 0);
        
        const functionalRate = document.getElementById('functional-rate');
        if (functionalRate) functionalRate.textContent = `${stats.functional_rate || 0}%`;
        
        const avgYield = document.getElementById('avg-yield');
        if (avgYield) avgYield.textContent = (stats.avg_yield || 0).toFixed(1);
    }

    /**
     * Update county performance table
     */
    updateCountyTable() {
        const countyData = this.dashboardData.countyPerformance || [];
        const tableBody = document.getElementById('county-table');
        
        if (!tableBody) return;
        
        // Clear existing rows
        tableBody.innerHTML = '';
        
        if (countyData.length === 0) {
            // Show empty state
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="8" class="no-data">No county performance data available</td>';
            tableBody.appendChild(emptyRow);
            
            document.getElementById('visible-count').textContent = '0';
            return;
        }
        
        // Sort data
        const sortedData = this.sortCountyData(countyData);
        
        // Paginate data
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const paginatedData = sortedData.slice(startIndex, endIndex);
        
        // Render rows
        paginatedData.forEach((county, index) => {
            const row = document.createElement('tr');
            row.dataset.county = county.admin_1 || 'Unknown';
            
            const rank = startIndex + index + 1;
            const functionalRate = county.functional_rate || 0;
            const avgYield = county.avg_yield || 0;
            const avgPH = county.avg_ph || 0;
            const performanceScore = county.performance_score || 0;
            
            row.innerHTML = `
                <td>${rank}</td>
                <td class="county-name">${this.escapeHtml(county.admin_1 || 'Unknown')}</td>
                <td>${this.formatNumber(county.total_points || 0)}</td>
                <td>
                    <div class="progress-cell">
                        <div class="progress-track">
                            <div class="progress-fill" style="width: ${functionalRate}%"></div>
                        </div>
                        <span class="progress-text">${functionalRate.toFixed(1)}%</span>
                    </div>
                </td>
                <td>${avgYield.toFixed(2)}</td>
                <td>${avgPH.toFixed(2)}</td>
                <td>
                    <span class="score-cell" data-score="${performanceScore}">
                        ${performanceScore.toFixed(1)}
                    </span>
                </td>
                <td>
                    <div class="action-cell">
                        <button class="cell-action" data-action="drill" title="Drill Down">
                            <i class="fas fa-search"></i>
                        </button>
                        <button class="cell-action" data-action="map" title="View on Map">
                            <i class="fas fa-map-marker-alt"></i>
                        </button>
                        <button class="cell-action" data-action="analyze" title="Analyze">
                            <i class="fas fa-chart-bar"></i>
                        </button>
                    </div>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Update table info
        const visibleCount = document.getElementById('visible-count');
        if (visibleCount) {
            visibleCount.textContent = Math.min(paginatedData.length, sortedData.length);
        }
        
        // Update pagination
        this.updatePagination(sortedData.length);
        
        // Bind cell action events
        this.bindCellActions();
    }

    /**
     * Bind cell action buttons
     */
    bindCellActions() {
        document.querySelectorAll('.cell-action').forEach(btn => {
            btn.removeEventListener('click', this.handleCellAction);
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleCellAction(e);
            });
        });
    }

    /**
     * Handle cell action click
     */
    handleCellAction(e) {
        const button = e.currentTarget;
        const action = button.dataset.action;
        const row = button.closest('tr');
        const county = row?.dataset.county;
        
        if (!county) return;
        
        switch (action) {
            case 'drill':
                this.drillDownToCounty(county);
                break;
            case 'map':
                this.viewCountyOnMap(county);
                break;
            case 'analyze':
                this.analyzeCounty(county);
                break;
        }
    }

    /**
     * Sort county data
     */
    sortCountyData(data) {
        if (!data || !Array.isArray(data)) return [];
        
        return [...data].sort((a, b) => {
            let aVal, bVal;
            
            switch (this.sortColumn) {
                case 'county':
                    aVal = a.admin_1 || '';
                    bVal = b.admin_1 || '';
                    break;
                case 'points':
                    aVal = a.total_points || 0;
                    bVal = b.total_points || 0;
                    break;
                case 'functional':
                    aVal = a.functional_rate || 0;
                    bVal = b.functional_rate || 0;
                    break;
                case 'yield':
                    aVal = a.avg_yield || 0;
                    bVal = b.avg_yield || 0;
                    break;
                case 'ph':
                    aVal = a.avg_ph || 0;
                    bVal = b.avg_ph || 0;
                    break;
                case 'score':
                default:
                    aVal = a.performance_score || 0;
                    bVal = b.performance_score || 0;
                    break;
            }
            
            if (this.sortOrder === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });
    }

    /**
     * Update pagination controls
     */
    updatePagination(totalItems) {
        const totalPages = Math.ceil(totalItems / this.pageSize);
        
        const currentPageEl = document.getElementById('current-page');
        const totalPagesEl = document.getElementById('total-pages');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        
        if (currentPageEl) currentPageEl.textContent = this.currentPage;
        if (totalPagesEl) totalPagesEl.textContent = totalPages || 1;
        
        if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = this.currentPage >= totalPages;
    }

    /**
     * Go to previous page
     */
    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updateCountyTable();
        }
    }

    /**
     * Go to next page
     */
    nextPage() {
        const totalItems = this.dashboardData.countyPerformance?.length || 0;
        const totalPages = Math.ceil(totalItems / this.pageSize);
        
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.updateCountyTable();
        }
    }

    /**
     * Filter county table by search term
     */
    filterCountyTable(searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') {
            // Reset to show all
            this.currentPage = 1;
            this.updateCountyTable();
            return;
        }
        
        const term = searchTerm.toLowerCase().trim();
        const countyData = this.dashboardData.countyPerformance || [];
        
        const filteredData = countyData.filter(county => 
            county.admin_1 && county.admin_1.toLowerCase().includes(term)
        );
        
        // Temporarily override the county performance data
        const originalData = this.dashboardData.countyPerformance;
        this.dashboardData.countyPerformance = filteredData;
        this.currentPage = 1;
        this.updateCountyTable();
        
        // Restore original data
        this.dashboardData.countyPerformance = originalData;
    }

    /**
     * Update coverage statistics
     */
    updateCoverageStats() {
        const coverage = this.dashboardData.geographicalCoverage || {};
        
        const countiesCovered = document.querySelector('.coverage-stat:nth-child(1) .coverage-value');
        const subcountiesCovered = document.querySelector('.coverage-stat:nth-child(2) .coverage-value');
        const coverageRate = document.querySelector('.coverage-stat:nth-child(3) .coverage-value');
        
        if (countiesCovered) {
            countiesCovered.textContent = coverage.counties_with_water_points || 0;
        }
        
        if (subcountiesCovered) {
            subcountiesCovered.textContent = coverage.subcounties_with_water_points || 0;
        }
        
        if (coverageRate) {
            coverageRate.textContent = `${coverage.coverage_rate_counties || 0}%`;
        }
    }

    /**
     * Update water quality indicators
     */
    updateQualityIndicators() {
        const quality = this.dashboardData.waterQualityIndicators || {};
        
        const acidic = document.querySelector('.quality-indicator.acidic .indicator-value');
        const neutral = document.querySelector('.quality-indicator.neutral .indicator-value');
        const alkaline = document.querySelector('.quality-indicator.alkaline .indicator-value');
        
        if (acidic) acidic.textContent = this.formatNumber(quality.acidic_count || 0);
        if (neutral) neutral.textContent = this.formatNumber(quality.neutral_count || 0);
        if (alkaline) alkaline.textContent = this.formatNumber(quality.alkaline_count || 0);
    }

    /**
     * Update structure analysis summary
     */
    updateStructureSummary() {
        const structure = this.dashboardData.structureAnalysis || {};
        
        const firstStructureEl = document.querySelector('.summary-card:nth-child(1) .summary-data');
        const secondStructureEl = document.querySelector('.summary-card:nth-child(2) .summary-data');
        const combinationCountEl = document.querySelector('.summary-card:nth-child(3) .summary-data');
        
        const firstStructure = structure.first_structure?.[0];
        const secondStructure = structure.second_structure?.[0];
        
        if (firstStructureEl) {
            firstStructureEl.textContent = firstStructure?.first_stru || 'Concrete';
        }
        
        if (secondStructureEl) {
            secondStructureEl.textContent = secondStructure?.second_str || 'Steel';
        }
        
        if (combinationCountEl) {
            const total = this.dashboardData.totalStats?.total_boreholes || 0;
            combinationCountEl.textContent = this.formatNumber(total);
        }
    }

    /**
     * Update performance badges
     */
    updatePerformanceBadges() {
        const countyData = this.dashboardData.countyPerformance || [];
        const badgesContainer = document.querySelector('.performance-badges');
        
        if (!badgesContainer) return;
        
        badgesContainer.innerHTML = '';
        
        if (countyData.length === 0) {
            badgesContainer.innerHTML = '<div class="performance-badge">No data</div>';
            return;
        }
        
        // Get top 3 counties
        const top3 = countyData.slice(0, 3);
        
        top3.forEach((county, index) => {
            const badge = document.createElement('div');
            badge.className = 'performance-badge';
            badge.innerHTML = `
                <span class="badge-rank">#${index + 1}</span>
                <span class="badge-name">${this.escapeHtml(county.admin_1?.substring(0, 12) || 'Unknown')}</span>
                <span class="badge-score">${(county.performance_score || 0).toFixed(1)}</span>
            `;
            badgesContainer.appendChild(badge);
        });
    }

    /**
     * Update filter counts
     */
    updateFilterCounts() {
        const filterCount = Object.keys(this.activeFilters).length;
        const filterCountEl = document.querySelector('.filter-count');
        
        if (filterCountEl) {
            filterCountEl.textContent = filterCount > 0 ? filterCount : '';
            filterCountEl.style.display = filterCount > 0 ? 'inline-block' : 'none';
        }
    }

    /**
     * Initialize filter dropdowns
     */
    async initializeFilterDropdowns() {
        try {
            let filterOptions = this.dashboardData?.filterOptions;
            
            // If not available in dashboard data, fetch from API
            if (!filterOptions && this.api) {
                filterOptions = await this.api.getFilterOptions();
            }
            
            if (!filterOptions) return;
            
            // Update county dropdown
            if (filterOptions.counties) {
                const countyOptions = document.querySelector('#county-select .select-options');
                if (countyOptions) {
                    countyOptions.innerHTML = filterOptions.counties.map(county => `
                        <div class="select-option" data-value="${this.escapeHtml(county)}">
                            <span>${this.escapeHtml(county)}</span>
                            <i class="fas fa-check"></i>
                        </div>
                    `).join('');
                }
            }
            
            // Update subcounty dropdown
            if (filterOptions.subcounties) {
                const subcountyOptions = document.querySelector('#subcounty-select .select-options');
                if (subcountyOptions) {
                    subcountyOptions.innerHTML = filterOptions.subcounties.map(subcounty => `
                        <div class="select-option" data-value="${this.escapeHtml(subcounty)}">
                            <span>${this.escapeHtml(subcounty)}</span>
                            <i class="fas fa-check"></i>
                        </div>
                    `).join('');
                }
            }
            
            // Update source type dropdown
            if (filterOptions.source_types) {
                const sourceOptions = document.querySelector('#source-select .select-options');
                if (sourceOptions) {
                    sourceOptions.innerHTML = filterOptions.source_types.map(source => `
                        <div class="select-option" data-value="${this.escapeHtml(source)}">
                            <span>${this.escapeHtml(source)}</span>
                            <i class="fas fa-check"></i>
                        </div>
                    `).join('');
                }
            }
            
            // Update status dropdown
            if (filterOptions.operation_statuses) {
                const statusOptions = document.querySelector('#status-select .select-options');
                if (statusOptions) {
                    statusOptions.innerHTML = filterOptions.operation_statuses.map(status => `
                        <div class="select-option" data-value="${status}">
                            <span>${status}</span>
                            <i class="fas fa-check"></i>
                        </div>
                    `).join('');
                }
            }
            
            // Update range sliders
            if (filterOptions.ph_ranges) {
                this.updateRangeSlider('ph', filterOptions.ph_ranges);
            }
            
            if (filterOptions.yield_ranges) {
                this.updateRangeSlider('yield', filterOptions.yield_ranges);
            }
            
        } catch (error) {
            console.error('Error initializing filter dropdowns:', error);
        }
    }

    /**
     * Update range slider
     */
    updateRangeSlider(type, ranges) {
        const minInput = document.getElementById(`${type}-slider-min`);
        const maxInput = document.getElementById(`${type}-slider-max`);
        const minValue = document.getElementById(`${type}-min-value`);
        const maxValue = document.getElementById(`${type}-max-value`);
        
        if (minInput) {
            minInput.min = ranges.min || 0;
            minInput.max = ranges.max || (type === 'ph' ? 14 : 100);
            minInput.value = ranges.min || 0;
        }
        
        if (maxInput) {
            maxInput.min = ranges.min || 0;
            maxInput.max = ranges.max || (type === 'ph' ? 14 : 100);
            maxInput.value = ranges.max || (type === 'ph' ? 14 : 100);
        }
        
        if (minValue) minValue.textContent = (ranges.min || 0).toFixed(1);
        if (maxValue) maxValue.textContent = (ranges.max || (type === 'ph' ? 14 : 100)).toFixed(1);
    }

    /**
     * Handle filter changes
     */
    async handleFilterChange(filters) {
        console.log('🔍 Filters changed:', filters);
        this.activeFilters = filters;
        this.updateFilterCounts();
        
        if (Object.keys(filters).length === 0) {
            // No filters, reload original data
            await this.loadDashboardData();
            return;
        }
        
        this.showLoading();
        
        try {
            // Apply filters via API
            const filteredData = await this.api.getAnalyticsData(filters, 'admin_1', 20, 0);
            
            // Update relevant parts of the dashboard
            if (filteredData.aggregated_data) {
                this.dashboardData.countyPerformance = filteredData.aggregated_data;
                this.currentPage = 1;
                this.updateCountyTable();
                this.updatePerformanceBadges();
                
                // Update charts
                if (this.charts && typeof this.charts.renderCountyChart === 'function') {
                    this.charts.renderCountyChart('countyChart', filteredData.aggregated_data, 'performance_score');
                }
            }
            
            this.showNotification('Filters applied successfully', 'success');
            
        } catch (error) {
            console.error('Error applying filters:', error);
            this.showError('Failed to apply filters');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Apply filters button handler
     */
    applyFilters() {
        // Collect filters from UI
        const filters = this.collectFilters();
        this.handleFilterChange(filters);
    }

    /**
     * Collect filters from UI
     */
    collectFilters() {
        const filters = {};
        
        // Collect selected counties
        const selectedCounties = this.getSelectedOptions('county-select');
        if (selectedCounties.length > 0) {
            filters.county = selectedCounties;
        }
        
        // Collect selected subcounties
        const selectedSubcounties = this.getSelectedOptions('subcounty-select');
        if (selectedSubcounties.length > 0) {
            filters.subcounty = selectedSubcounties;
        }
        
        // Collect selected source types
        const selectedSources = this.getSelectedOptions('source-select');
        if (selectedSources.length > 0) {
            filters.source_type = selectedSources;
        }
        
        // Collect selected statuses
        const selectedStatuses = this.getSelectedOptions('status-select');
        if (selectedStatuses.length > 0) {
            filters.operation_status = selectedStatuses;
        }
        
        // Collect pH range
        const phMin = document.getElementById('ph-slider-min')?.value;
        const phMax = document.getElementById('ph-slider-max')?.value;
        if (phMin && phMax) {
            filters.ph = { min: parseFloat(phMin), max: parseFloat(phMax) };
        }
        
        // Collect yield range
        const yieldMin = document.getElementById('yield-slider-min')?.value;
        const yieldMax = document.getElementById('yield-slider-max')?.value;
        if (yieldMin && yieldMax) {
            filters.yield = { min: parseFloat(yieldMin), max: parseFloat(yieldMax) };
        }
        
        return filters;
    }

    /**
     * Get selected options from a multi-select
     */
    getSelectedOptions(selectId) {
        const select = document.getElementById(selectId);
        if (!select) return [];
        
        const selected = [];
        const options = select.querySelectorAll('.select-option.selected');
        
        options.forEach(option => {
            const value = option.dataset.value;
            if (value) selected.push(value);
        });
        
        return selected;
    }

    /**
     * Clear all filters
     */
    clearAllFilters() {
        // Clear all select options
        document.querySelectorAll('.select-option.selected').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Reset range sliders
        const phMin = document.getElementById('ph-slider-min');
        const phMax = document.getElementById('ph-slider-max');
        const yieldMin = document.getElementById('yield-slider-min');
        const yieldMax = document.getElementById('yield-slider-max');
        
        if (phMin && this.dashboardData.waterQualityIndicators) {
            phMin.value = this.dashboardData.waterQualityIndicators.min_ph || 0;
        }
        
        if (phMax && this.dashboardData.waterQualityIndicators) {
            phMax.value = this.dashboardData.waterQualityIndicators.max_ph || 14;
        }
        
        if (yieldMin && this.dashboardData.yieldStatistics) {
            yieldMin.value = this.dashboardData.yieldStatistics.min_yield || 0;
        }
        
        if (yieldMax && this.dashboardData.yieldStatistics) {
            yieldMax.value = this.dashboardData.yieldStatistics.max_yield || 100;
        }
        
        // Update range displays
        document.getElementById('ph-min-value').textContent = phMin?.value || '0';
        document.getElementById('ph-max-value').textContent = phMax?.value || '14';
        document.getElementById('yield-min-value').textContent = yieldMin?.value || '0';
        document.getElementById('yield-max-value').textContent = yieldMax?.value || '100';
        
        // Clear active filters
        this.activeFilters = {};
        this.updateFilterCounts();
        
        // Reload dashboard without filters
        this.loadDashboardData();
        
        this.showNotification('All filters cleared', 'info');
    }

    /**
     * Toggle filter panel
     */
    toggleFilterPanel() {
        const filterGrid = document.getElementById('filter-grid');
        const toggleBtn = document.getElementById('toggle-filters');
        const icon = toggleBtn?.querySelector('i');
        
        if (filterGrid) {
            filterGrid.classList.toggle('collapsed');
            
            if (icon) {
                if (filterGrid.classList.contains('collapsed')) {
                    icon.className = 'fas fa-chevron-up';
                } else {
                    icon.className = 'fas fa-chevron-down';
                }
            }
        }
    }

    /**
     * Handle chart type change
     */
    handleChartTypeChange(detail) {
        console.log('Chart type changed:', detail);
        
        if (detail.type === 'source' && detail.chartType) {
            if (this.charts && this.dashboardData.sourceAnalysis) {
                this.charts.renderSourceChart('sourceChart', this.dashboardData.sourceAnalysis, detail.chartType);
            }
        }
    }

    /**
     * Handle quality metric change
     */
    handleQualityMetricChange(detail) {
        console.log('Quality metric changed:', detail);
        
        if (detail.metric === 'ec') {
            // Show EC data
            this.showNotification('EC conductivity view - Coming soon', 'info');
        } else {
            // Show pH data (already displayed)
            if (this.charts && this.dashboardData.waterQualityIndicators) {
                this.charts.renderQualityChart('qualityChart', this.dashboardData.waterQualityIndicators);
            }
        }
    }

    /**
     * Handle structure type change
     */
    handleStructureTypeChange(detail) {
        console.log('Structure type changed:', detail);
        
        if (!this.charts || !this.dashboardData.structureAnalysis) return;
        
        if (detail.structure === 'first') {
            this.charts.renderStructureChart('structureChart', this.dashboardData.structureAnalysis, 'first');
        } else if (detail.structure === 'second') {
            this.charts.renderStructureChart('structureChart', this.dashboardData.structureAnalysis, 'second');
        } else if (detail.structure === 'combined') {
            // Show combined view
            this.showNotification('Combined structure view - Coming soon', 'info');
        }
    }

    /**
     * Handle county sort change
     */
    handleCountySortChange(detail) {
        console.log('County sort changed:', detail);
        
        this.sortColumn = detail.sortBy || 'score';
        this.currentPage = 1;
        this.updateCountyTable();
        
        if (this.charts && this.dashboardData.countyPerformance) {
            this.charts.renderCountyChart('countyChart', this.dashboardData.countyPerformance, this.sortColumn);
        }
    }

    /**
     * Handle yield chart type change
     */
    handleYieldChartTypeChange(detail) {
        console.log('Yield chart type changed:', detail);
        
        if (this.charts && this.dashboardData.yieldStatistics) {
            this.charts.renderYieldChart('yieldChart', this.dashboardData.yieldStatistics, detail.chartType);
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        // Debounce resize event
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            if (this.charts && typeof this.charts.handleResize === 'function') {
                this.charts.handleResize();
            }
        }, 250);
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(e) {
        // Only handle if not in input field
        if (e.target.matches('input, textarea, select')) return;
        
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'r':
                    e.preventDefault();
                    this.refreshDashboard();
                    break;
                case 'e':
                    e.preventDefault();
                    this.showExportModal();
                    break;
                case 'f':
                    e.preventDefault();
                    const searchInput = document.getElementById('county-search');
                    if (searchInput) {
                        searchInput.focus();
                        searchInput.select();
                    }
                    break;
                case 't':
                    e.preventDefault();
                    this.toggleTheme();
                    break;
                case 'k':
                    e.preventDefault();
                    this.clearAllFilters();
                    break;
                case 'arrowleft':
                    e.preventDefault();
                    this.prevPage();
                    break;
                case 'arrowright':
                    e.preventDefault();
                    this.nextPage();
                    break;
            }
        }
    }

    /**
     * Refresh dashboard
     */
    async refreshDashboard() {
        this.showLoading();
        await this.loadDashboardData();
        this.showNotification('Dashboard refreshed', 'success');
        this.hideLoading();
    }

    /**
     * Show export modal
     */
    showExportModal() {
        const modal = document.getElementById('export-modal');
        if (modal) {
            modal.style.display = 'flex';
            
            // Reset selection
            document.querySelectorAll('.export-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            
            const confirmBtn = document.getElementById('confirm-export');
            if (confirmBtn) confirmBtn.disabled = true;
        }
    }

    /**
     * Close export modal
     */
    closeExportModal() {
        const modal = document.getElementById('export-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Select export format
     */
    selectExportFormat(option) {
        // Remove selection from all options
        document.querySelectorAll('.export-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        // Select clicked option
        option.classList.add('selected');
        
        // Enable export button
        const confirmBtn = document.getElementById('confirm-export');
        if (confirmBtn) confirmBtn.disabled = false;
    }

    /**
     * Perform export
     */
    async performExport() {
        const selectedOption = document.querySelector('.export-option.selected');
        if (!selectedOption) {
            this.showNotification('Please select an export format', 'warning');
            return;
        }
        
        const format = selectedOption.dataset.format;
        
        this.showLoading();
        
        try {
            if (this.api && typeof this.api.exportData === 'function') {
                await this.api.exportData(format, this.activeFilters);
                this.closeExportModal();
                this.showNotification(`Exporting as ${format.toUpperCase()}...`, 'success');
            } else {
                // Fallback: export current table
                this.exportTableToCSV();
                this.closeExportModal();
            }
        } catch (error) {
            console.error('Export error:', error);
            this.showError('Failed to export data');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Export table to CSV
     */
    exportTableToCSV() {
        const table = document.querySelector('.data-table');
        if (!table) return;
        
        const rows = table.querySelectorAll('tr');
        const csv = [];
        
        // Process header row
        const headers = [];
        const headerCells = table.querySelectorAll('thead th');
        headerCells.forEach(cell => {
            // Skip actions column
            if (!cell.textContent.includes('Actions')) {
                headers.push(this.escapeCSV(cell.textContent.trim()));
            }
        });
        csv.push(headers.join(','));
        
        // Process data rows
        rows.forEach(row => {
            if (!row.closest('thead')) {
                const rowData = [];
                const cells = row.querySelectorAll('td');
                
                cells.forEach((cell, index) => {
                    // Skip actions column (last column)
                    if (index < cells.length - 1) {
                        let cellText = '';
                        
                        // Check for progress bar
                        const progressText = cell.querySelector('.progress-text');
                        if (progressText) {
                            cellText = progressText.textContent.trim();
                        } 
                        // Check for score cell
                        else if (cell.querySelector('.score-cell')) {
                            cellText = cell.querySelector('.score-cell').textContent.trim();
                        }
                        // Regular cell
                        else {
                            cellText = cell.textContent.trim();
                        }
                        
                        rowData.push(this.escapeCSV(cellText));
                    }
                });
                
                csv.push(rowData.join(','));
            }
        });
        
        // Create and download file
        const csvContent = csv.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `county_performance_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        this.showNotification('Table exported to CSV', 'success');
    }

    /**
     * Escape CSV field
     */
    escapeCSV(text) {
        if (text === null || text === undefined) return '';
        text = String(text);
        if (text.includes(',') || text.includes('"') || text.includes('\n')) {
            return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
    }

    /**
     * Toggle fullscreen
     */
    toggleFullscreen() {
        if (!this.isFullscreen) {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen();
            } else if (document.documentElement.webkitRequestFullscreen) {
                document.documentElement.webkitRequestFullscreen();
            } else if (document.documentElement.msRequestFullscreen) {
                document.documentElement.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    }

    /**
     * Run predictions
     */
    async runPredictions() {
        this.showLoading();
        
        try {
            let predictions;
            
            if (this.api && typeof this.api.getAdvancedAnalytics === 'function') {
                predictions = await this.api.getAdvancedAnalytics();
            } else {
                // Generate mock predictions
                predictions = this.generateMockPredictions();
            }
            
            this.displayAdvancedResults(predictions, 'predictions');
            this.showNotification('Predictions generated successfully', 'success');
            
        } catch (error) {
            console.error('Error running predictions:', error);
            this.showError('Failed to run predictions');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Detect anomalies
     */
    async detectAnomalies() {
        this.showLoading();
        
        try {
            let anomalies;
            
            if (this.api && typeof this.api.getAnomalies === 'function') {
                anomalies = await this.api.getAnomalies();
            } else {
                // Generate mock anomalies
                anomalies = this.generateMockAnomalies();
            }
            
            this.displayAdvancedResults(anomalies, 'anomalies');
            this.showNotification('Anomaly detection completed', 'success');
            
        } catch (error) {
            console.error('Error detecting anomalies:', error);
            this.showError('Failed to detect anomalies');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Run cluster analysis
     */
    async runClusterAnalysis() {
        this.showLoading();
        
        try {
            let clusters;
            
            if (this.api && typeof this.api.getClusterAnalysis === 'function') {
                clusters = await this.api.getClusterAnalysis();
            } else {
                // Generate mock clusters
                clusters = this.generateMockClusters();
            }
            
            this.displayAdvancedResults(clusters, 'clusters');
            this.showNotification('Cluster analysis completed', 'success');
            
        } catch (error) {
            console.error('Error running cluster analysis:', error);
            this.showError('Failed to run cluster analysis');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Display advanced analytics results
     */
    displayAdvancedResults(data, type) {
        const resultsContainer = document.getElementById('advanced-results');
        if (!resultsContainer) return;
        
        let html = '';
        
        switch (type) {
            case 'predictions':
                html = this.formatPredictions(data);
                break;
            case 'anomalies':
                html = this.formatAnomalies(data);
                break;
            case 'clusters':
                html = this.formatClusters(data);
                break;
            default:
                html = '<div class="result-placeholder">No results available</div>';
        }
        
        resultsContainer.innerHTML = html;
    }

    /**
     * Format predictions for display
     */
    formatPredictions(data) {
        const metrics = data?.predictive_metrics || {};
        
        return `
            <div class="prediction-results">
                <h4>📊 Predictive Analysis Results</h4>
                <div class="prediction-grid">
                    <div class="prediction-card">
                        <span class="prediction-label">Yield Trend</span>
                        <span class="prediction-value ${metrics.yield_trend || 'stable'}">
                            ${metrics.yield_trend || 'Stable'}
                        </span>
                    </div>
                    <div class="prediction-card">
                        <span class="prediction-label">Maintenance Needs</span>
                        <span class="prediction-value">${metrics.maintenance_needs || 0}%</span>
                    </div>
                    <div class="prediction-card">
                        <span class="prediction-label">Reliability Score</span>
                        <span class="prediction-value">${metrics.reliability_score || 0}%</span>
                    </div>
                    <div class="prediction-card">
                        <span class="prediction-label">Predicted Functional Rate</span>
                        <span class="prediction-value">${metrics.predicted_functional_rate || 0}%</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Format anomalies for display
     */
    formatAnomalies(data) {
        const anomalies = data?.anomalies || [];
        
        if (anomalies.length === 0) {
            return '<div class="anomaly-results"><p>✅ No anomalies detected</p></div>';
        }
        
        return `
            <div class="anomaly-results">
                <h4>⚠️ Top Anomalies Detected</h4>
                <div class="anomaly-list">
                    ${anomalies.slice(0, 5).map(anomaly => `
                        <div class="anomaly-item">
                            <span class="anomaly-county">${this.escapeHtml(anomaly.county || 'Unknown')}</span>
                            <span class="anomaly-yield">Yield: ${(anomaly.yield || 0).toFixed(2)}</span>
                            <span class="anomaly-score">Z-Score: ${(anomaly.z_score || 0).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
                <small>Total anomalies detected: ${anomalies.length}</small>
            </div>
        `;
    }

    /**
     * Format clusters for display
     */
    formatClusters(data) {
        const clusters = data?.clusters || [];
        
        if (clusters.length === 0) {
            return '<div class="cluster-results"><p>No cluster data available</p></div>';
        }
        
        return `
            <div class="cluster-results">
                <h4>🔄 Cluster Analysis Results</h4>
                <div class="cluster-grid">
                    ${clusters.map(cluster => `
                        <div class="cluster-card">
                            <span class="cluster-label">Cluster ${cluster.cluster || 0}</span>
                            <span class="cluster-stats">
                                <small>Avg Yield: ${(cluster.avg_yield || 0).toFixed(2)}</small>
                                <small>Avg pH: ${(cluster.avg_ph || 0).toFixed(2)}</small>
                                <small>Points: ${cluster.count || 0}</small>
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Generate mock predictions (fallback)
     */
    generateMockPredictions() {
        return {
            predictive_metrics: {
                yield_trend: ['increasing', 'stable', 'decreasing'][Math.floor(Math.random() * 3)],
                maintenance_needs: Math.round(Math.random() * 30),
                reliability_score: Math.round(70 + Math.random() * 25),
                predicted_functional_rate: Math.round(65 + Math.random() * 30)
            }
        };
    }

    /**
     * Generate mock anomalies (fallback)
     */
    generateMockAnomalies() {
        const counties = this.dashboardData.countyPerformance || [];
        const anomalies = [];
        
        for (let i = 0; i < Math.min(3, counties.length); i++) {
            if (counties[i]) {
                anomalies.push({
                    county: counties[i].admin_1 || `County ${i + 1}`,
                    yield: (Math.random() * 30).toFixed(2),
                    z_score: (Math.random() * 4 - 1).toFixed(2)
                });
            }
        }
        
        return { anomalies };
    }

    /**
     * Generate mock clusters (fallback)
     */
    generateMockClusters() {
        const clusters = [];
        
        for (let i = 0; i < 3; i++) {
            clusters.push({
                cluster: i + 1,
                avg_yield: Math.round(Math.random() * 15 * 10) / 10,
                avg_ph: Math.round((6 + Math.random() * 3) * 10) / 10,
                count: Math.floor(Math.random() * 200) + 50
            });
        }
        
        return { clusters };
    }

    /**
     * Drill down to county
     */
    drillDownToCounty(county) {
        console.log('Drilling down to county:', county);
        this.showNotification(`Loading detailed data for ${county}...`, 'info');
        
        // Dispatch event for other components
        document.dispatchEvent(new CustomEvent('drilldownRequested', {
            detail: { county, level: 'subcounty' }
        }));
    }

    /**
     * View county on map
     */
    viewCountyOnMap(county) {
        console.log('Viewing county on map:', county);
        this.showNotification(`Viewing ${county} on map`, 'info');
        
        // Dispatch event for map component
        document.dispatchEvent(new CustomEvent('mapViewRequested', {
            detail: { county }
        }));
    }

    /**
     * Analyze county
     */
    analyzeCounty(county) {
        console.log('Analyzing county:', county);
        this.showNotification(`Running analysis for ${county}...`, 'info');
        
        // Dispatch event for analysis component
        document.dispatchEvent(new CustomEvent('analysisRequested', {
            detail: { county }
        }));
    }

    /**
     * Start periodic updates
     */
    startPeriodicUpdates() {
        // Update every 5 minutes
        this.updateInterval = setInterval(() => {
            this.refreshDashboard();
        }, 5 * 60 * 1000);
    }

    /**
     * Close modal
     */
    closeModal(modal) {
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Show loading overlay
     */
    showLoading() {
        let overlay = document.getElementById('dashboard-loading-overlay');
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'dashboard-loading-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                backdrop-filter: blur(2px);
            `;
            
            const spinner = document.createElement('div');
            spinner.style.cssText = `
                width: 60px;
                height: 60px;
                border: 4px solid rgba(255, 255, 255, 0.3);
                border-top: 4px solid #0ea5e9;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            `;
            
            overlay.appendChild(spinner);
            document.body.appendChild(overlay);
        } else {
            overlay.style.display = 'flex';
        }
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        const overlay = document.getElementById('dashboard-loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        // Remove existing notification
        const existing = document.querySelector('.dashboard-notification');
        if (existing) {
            existing.remove();
        }
        
        // Create notification
        const notification = document.createElement('div');
        notification.className = `dashboard-notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            background: ${this.getNotificationColor(type)};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideIn 0.3s ease;
            font-size: 14px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        const icon = document.createElement('i');
        icon.className = this.getNotificationIcon(type);
        
        notification.appendChild(icon);
        notification.appendChild(document.createTextNode(message));
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Show error notification
     */
    showError(message) {
        this.showNotification(message, 'error');
    }

    /**
     * Get notification color
     */
    getNotificationColor(type) {
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#0ea5e9'
        };
        return colors[type] || colors.info;
    }

    /**
     * Get notification icon
     */
    getNotificationIcon(type) {
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        return icons[type] || icons.info;
    }

    /**
     * Format number with commas
     */
    formatNumber(num) {
        if (num === null || num === undefined) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Default data getters
     */
    getDefaultTotalStats() {
        return {
            total_boreholes: 0,
            functional_count: 0,
            non_functional_count: 0,
            functional_rate: 0,
            avg_yield: 0,
            min_yield: 0,
            max_yield: 0,
            avg_ph: 7.0,
            min_ph: 0,
            max_ph: 14
        };
    }

    getDefaultCountyPerformance() {
        return [];
    }

    getDefaultSourceAnalysis() {
        return [{ source_1: 'Borehole', count: 0, percentage: 0 }];
    }

    getDefaultWaterQuality() {
        return {
            acidic_count: 0,
            neutral_count: 0,
            alkaline_count: 0,
            min_ph: 0,
            max_ph: 14,
            avg_ph: 7.0
        };
    }

    getDefaultYieldStatistics() {
        return {
            very_low: 0,
            low: 0,
            medium: 0,
            high: 0,
            very_high: 0,
            min_yield: 0,
            max_yield: 100,
            avg_yield: 0
        };
    }

    getDefaultStructureAnalysis() {
        return {
            first_structure: [{ first_stru: 'Concrete', count: 0 }],
            second_structure: [{ second_str: 'Steel', count: 0 }]
        };
    }

    getDefaultGeographicalCoverage() {
        return {
            counties_with_water_points: 0,
            subcounties_with_water_points: 0,
            coverage_rate_counties: 0,
            coverage_rate_subcounties: 0,
            total_counties: 0,
            total_subcounties: 0
        };
    }

    processGeographicalCoverage(data) {
        if (!data || !Array.isArray(data)) {
            return this.getDefaultGeographicalCoverage();
        }
        
        return {
            counties_with_water_points: data.length,
            subcounties_with_water_points: 0, // Calculate if needed
            coverage_rate_counties: data.length > 0 ? Math.round((data.length / 47) * 100) : 0,
            coverage_rate_subcounties: 0,
            total_counties: 47,
            total_subcounties: 290
        };
    }

    /**
     * Clean up on page unload
     */
    cleanup() {
        console.log('🧹 Cleaning up dashboard...');
        
        // Clear intervals
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        // Destroy charts
        if (this.charts && typeof this.charts.destroyAllCharts === 'function') {
            this.charts.destroyAllCharts();
        }
        
        // Remove event listeners
        window.removeEventListener('resize', this.handleResize);
        document.removeEventListener('keydown', this.handleKeyboardShortcuts);
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Ensure loading animation is defined
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Create dashboard instance
    window.analyticsDashboard = new AnalyticsDashboard();
    
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        if (window.analyticsDashboard && typeof window.analyticsDashboard.cleanup === 'function') {
            window.analyticsDashboard.cleanup();
        }
    });
});

// Export for use in other modules
window.AnalyticsDashboard = AnalyticsDashboard;