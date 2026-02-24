// ============================================
// ANALYTICS DRILLDOWN HANDLER
// Deep drilldown analysis functionality
// ============================================

class AnalyticsDrilldown {
    constructor() {
        this.currentDrillLevel = 0;
        this.drillHistory = [];
        this.comparisonMode = false;
        this.comparisonData = null;
        this.bindDrilldownEvents();
    }

    // ============================================
    // DRILLDOWN EVENT HANDLING
    // ============================================

    bindDrilldownEvents() {
        // Drill buttons in table
        document.querySelectorAll('.btn-drill').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleTableDrill(e));
        });
        
        // Map buttons in table
        document.querySelectorAll('.btn-map').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleMapView(e));
        });
        
        // Drill area controls
        const drillAreaType = document.getElementById('drill-area-type');
        const drillAreaSelect = document.getElementById('drill-area-select');
        
        if (drillAreaType) {
            drillAreaType.addEventListener('change', () => this.updateDrillAreaOptions());
        }
        
        if (drillAreaSelect) {
            drillAreaSelect.addEventListener('change', (e) => this.handleAreaSelection(e));
        }
        
        // Compare button
        const compareBtn = document.getElementById('compare-area');
        if (compareBtn) {
            compareBtn.addEventListener('click', () => this.toggleComparisonMode());
        }
        
        // Export drill button
        const exportBtn = document.getElementById('export-drill');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportDrillData());
        }
    }

    async handleTableDrill(event) {
        const button = event.currentTarget;
        const county = button.dataset.county;
        
        if (!county) return;
        
        // Update drill area selection
        const drillSelect = document.getElementById('drill-area-select');
        if (drillSelect) {
            drillSelect.value = county;
            drillSelect.dispatchEvent(new Event('change'));
        }
        
        // Scroll to drill section
        const drillSection = document.querySelector('.chart-card.card-wide');
        if (drillSection) {
            drillSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    handleMapView(event) {
        const button = event.currentTarget;
        const county = button.dataset.county;
        
        // This would integrate with your map system
        // For now, show a notification
        this.showNotification(`Map view for ${county} would open here`, 'info');
    }

    async updateDrillAreaOptions() {
        const areaType = document.getElementById('drill-area-type')?.value || 'county';
        const areaSelect = document.getElementById('drill-area-select');
        
        if (!areaSelect) return;
        
        // Clear current options
        areaSelect.innerHTML = '<option value="">Select Area to Analyze</option>';
        
        // Show loading
        areaSelect.disabled = true;
        
        try {
            let options = [];
            
            switch (areaType) {
                case 'county':
                    options = await this.getCountyOptions();
                    break;
                case 'subcounty':
                    options = await this.getSubcountyOptions();
                    break;
                case 'source':
                    options = await this.getSourceTypeOptions();
                    break;
            }
            
            // Add options to select
            options.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option.value;
                optionElement.textContent = option.label;
                areaSelect.appendChild(optionElement);
            });
            
        } catch (error) {
            console.error('Error loading area options:', error);
            this.showNotification('Failed to load area options', 'error');
        } finally {
            areaSelect.disabled = false;
        }
    }

    async getCountyOptions() {
        // Get counties from API or existing data
        if (window.analyticsData?.countyPerformance) {
            return window.analyticsData.countyPerformance
                .filter(c => c.admin_1)
                .map(c => ({ value: c.admin_1, label: c.admin_1 }));
        }
        
        // Fallback to API call
        if (window.analyticsAPI) {
            const data = await window.analyticsAPI.getAnalyticsData({}, 'admin_1', 50);
            return data.aggregated_data.map(item => ({
                value: item.admin_1,
                label: `${item.admin_1} (${item.count} points)`
            }));
        }
        
        return [];
    }

    async getSubcountyOptions() {
        // Get subcounties from API
        if (window.analyticsAPI) {
            const data = await window.analyticsAPI.getAnalyticsData({}, 'locality', 100);
            return data.aggregated_data
                .filter(item => item.locality)
                .map(item => ({
                    value: item.locality,
                    label: `${item.locality} (${item.count} points)`
                }));
        }
        
        return [];
    }

    async getSourceTypeOptions() {
        // Get source types from existing data or API
        if (window.analyticsData?.sourceAnalysis) {
            return window.analyticsData.sourceAnalysis
                .filter(s => s.source_1)
                .map(s => ({
                    value: s.source_1,
                    label: `${s.source_1} (${s.count} points)`
                }));
        }
        
        return [];
    }

    async handleAreaSelection(event) {
        const areaName = event.target.value;
        const areaType = document.getElementById('drill-area-type')?.value || 'county';
        
        if (!areaName) {
            this.resetDrilldownView();
            return;
        }
        
        await this.performDrilldown(areaType, areaName);
    }

    async performDrilldown(areaType, areaName, drilldownLevel = 'subcounty') {
        if (!window.analyticsAPI) return;
        
        this.showLoading(`Analyzing ${areaName}...`);
        
        try {
            const data = await window.analyticsAPI.getDrilldownData(
                areaType, 
                areaName, 
                drilldownLevel
            );
            
            if (data.success) {
                this.updateDrilldownView(data);
                this.addToDrillHistory(areaType, areaName, data);
            } else {
                throw new Error(data.error || 'Drilldown failed');
            }
            
        } catch (error) {
            console.error('Drilldown error:', error);
            this.showNotification(`Failed to analyze ${areaName}: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    updateDrilldownView(data) {
        // Update area info
        this.updateAreaInfo(data);
        
        // Update metrics
        this.updateMetrics(data);
        
        // Create drilldown chart
        this.createDrilldownChart(data);
        
        // Update comparison data if in comparison mode
        if (this.comparisonMode && this.comparisonData) {
            this.updateComparisonView(data, this.comparisonData);
        }
    }

    updateAreaInfo(data) {
        const areaName = document.getElementById('selected-area');
        if (areaName) {
            areaName.textContent = data.area_name;
        }
        
        // Update area type badge
        const areaTypeBadge = document.getElementById('area-type-badge');
        if (!areaTypeBadge) {
            // Create badge if it doesn't exist
            const areaInfo = document.querySelector('.detail-item:first-child');
            if (areaInfo) {
                const badge = document.createElement('span');
                badge.id = 'area-type-badge';
                badge.className = 'type-badge';
                badge.textContent = data.area_type;
                areaInfo.appendChild(badge);
            }
        } else {
            areaTypeBadge.textContent = data.area_type;
        }
    }

    updateMetrics(data) {
        const metrics = {
            'detail-points': data.area_statistics.total || 0,
            'detail-functional': `${data.area_statistics.functional_rate || 0}%`,
            'detail-yield': `${data.area_statistics.avg_yield || 0} m³/h`,
            'detail-ph': data.area_statistics.avg_ph || 'N/A',
            'detail-ec': data.area_statistics.avg_ec || 'N/A'
        };
        
        Object.entries(metrics).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
                
                // Add animation for changed values
                element.classList.add('metric-updated');
                setTimeout(() => element.classList.remove('metric-updated'), 1000);
            }
        });
    }

    createDrilldownChart(data) {
        const drilldownData = data.drilldown_data || [];
        
        if (drilldownData.length === 0) {
            this.showNoDataMessage();
            return;
        }
        
        // Determine chart type based on data
        const chartType = drilldownData.length > 8 ? 'bar' : 'pie';
        
        const chartData = {
            labels: drilldownData.map(item => {
                const key = Object.keys(item).find(k => k !== 'count' && k !== 'functional');
                return item[key] || 'Unknown';
            }),
            values: drilldownData.map(item => item.count),
            datasetLabel: 'Water Points',
            yAxisLabel: 'Number of Points'
        };
        
        // Create or update chart
        if (window.analyticsCharts) {
            window.analyticsCharts.createDrilldownChart(chartData, chartType);
        }
    }

    addToDrillHistory(areaType, areaName, data) {
        const historyItem = {
            areaType,
            areaName,
            data,
            timestamp: new Date().toISOString()
        };
        
        this.drillHistory.push(historyItem);
        
        // Keep only last 10 items
        if (this.drillHistory.length > 10) {
            this.drillHistory.shift();
        }
        
        // Update history navigation if exists
        this.updateHistoryNavigation();
    }

    updateHistoryNavigation() {
        // Create or update history navigation
        const historyNav = document.getElementById('drill-history-nav');
        if (!historyNav) {
            this.createHistoryNavigation();
            return;
        }
        
        // Update history list
        const historyList = historyNav.querySelector('.history-list');
        if (historyList) {
            historyList.innerHTML = this.drillHistory
                .slice()
                .reverse()
                .map((item, index) => `
                    <div class="history-item" data-index="${this.drillHistory.length - 1 - index}">
                        <span class="history-type">${item.areaType}</span>
                        <span class="history-name">${item.areaName}</span>
                        <span class="history-time">${new Date(item.timestamp).toLocaleTimeString()}</span>
                    </div>
                `)
                .join('');
            
            // Add click handlers
            historyList.querySelectorAll('.history-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const index = parseInt(e.currentTarget.dataset.index);
                    this.loadFromHistory(index);
                });
            });
        }
    }

    createHistoryNavigation() {
        const drillSection = document.querySelector('.drill-container');
        if (!drillSection) return;
        
        const historyNav = document.createElement('div');
        historyNav.id = 'drill-history-nav';
        historyNav.className = 'history-navigation';
        historyNav.innerHTML = `
            <div class="history-header">
                <h5><i class="fas fa-history"></i> Drill History</h5>
                <button class="btn-clear-history" id="clear-history">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="history-list"></div>
        `;
        
        drillSection.parentNode.insertBefore(historyNav, drillSection);
        
        // Add clear history handler
        const clearBtn = document.getElementById('clear-history');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearHistory());
        }
        
        // Update history list
        this.updateHistoryNavigation();
    }

    loadFromHistory(index) {
        const historyItem = this.drillHistory[index];
        if (!historyItem) return;
        
        this.updateDrilldownView(historyItem.data);
        
        // Update selects
        const areaTypeSelect = document.getElementById('drill-area-type');
        const areaSelect = document.getElementById('drill-area-select');
        
        if (areaTypeSelect) areaTypeSelect.value = historyItem.areaType;
        if (areaSelect) areaSelect.value = historyItem.areaName;
        
        this.showNotification(`Loaded ${historyItem.areaName} from history`, 'info');
    }

    clearHistory() {
        this.drillHistory = [];
        this.updateHistoryNavigation();
        this.showNotification('Drill history cleared', 'info');
    }

    // ============================================
    // COMPARISON FUNCTIONALITY
    // ============================================

    toggleComparisonMode() {
        this.comparisonMode = !this.comparisonMode;
        
        const compareBtn = document.getElementById('compare-area');
        if (compareBtn) {
            if (this.comparisonMode) {
                compareBtn.innerHTML = '<i class="fas fa-times"></i> Cancel Comparison';
                compareBtn.classList.add('comparing');
                this.promptForComparisonArea();
            } else {
                compareBtn.innerHTML = '<i class="fas fa-balance-scale"></i> Compare with Another Area';
                compareBtn.classList.remove('comparing');
                this.clearComparisonView();
            }
        }
    }

    async promptForComparisonArea() {
        const areaName = prompt('Enter the name of the area to compare with:');
        if (!areaName) {
            this.toggleComparisonMode(); // Cancel comparison
            return;
        }
        
        const areaType = document.getElementById('drill-area-type')?.value || 'county';
        
        this.showLoading(`Loading comparison data for ${areaName}...`);
        
        try {
            const data = await window.analyticsAPI.getDrilldownData(areaType, areaName);
            
            if (data.success) {
                this.comparisonData = data;
                this.updateComparisonView(null, data);
            } else {
                throw new Error(data.error || 'Comparison failed');
            }
            
        } catch (error) {
            console.error('Comparison error:', error);
            this.showNotification(`Failed to load comparison: ${error.message}`, 'error');
            this.toggleComparisonMode(); // Cancel comparison
        } finally {
            this.hideLoading();
        }
    }

    updateComparisonView(mainData, comparisonData) {
        if (!comparisonData) return;
        
        // Get main data from current view or parameter
        const currentArea = document.getElementById('selected-area')?.textContent;
        if (!mainData && currentArea && currentArea !== '-') {
            // We need to fetch main data
            this.performComparison(currentArea, comparisonData.area_name);
            return;
        }
        
        // Create comparison view
        this.createComparisonChart(mainData, comparisonData);
        this.updateComparisonMetrics(mainData, comparisonData);
    }

    createComparisonChart(mainData, comparisonData) {
        // Create a side-by-side bar chart for comparison
        const mainPoints = mainData?.area_statistics?.total || 0;
        const comparisonPoints = comparisonData?.area_statistics?.total || 0;
        
        const mainYield = mainData?.area_statistics?.avg_yield || 0;
        const comparisonYield = comparisonData?.area_statistics?.avg_yield || 0;
        
        const chartData = {
            labels: ['Total Points', 'Avg Yield (m³/h)', 'Functional Rate (%)'],
            datasets: [
                {
                    label: mainData?.area_name || 'Current Area',
                    data: [mainPoints, mainYield, mainData?.area_statistics?.functional_rate || 0],
                    backgroundColor: '#3498db'
                },
                {
                    label: comparisonData?.area_name || 'Comparison Area',
                    data: [comparisonPoints, comparisonYield, comparisonData?.area_statistics?.functional_rate || 0],
                    backgroundColor: '#2ecc71'
                }
            ]
        };
        
        // Update drilldown chart with comparison
        if (window.analyticsCharts) {
            window.analyticsCharts.createDrilldownChart(chartData, 'bar');
        }
    }

    updateComparisonMetrics(mainData, comparisonData) {
        const comparisonSection = document.getElementById('comparison-metrics');
        if (!comparisonSection) {
            this.createComparisonMetricsSection();
        }
        
        // Calculate differences
        const differences = {
            points: (mainData?.area_statistics?.total || 0) - (comparisonData?.area_statistics?.total || 0),
            yield: (mainData?.area_statistics?.avg_yield || 0) - (comparisonData?.area_statistics?.avg_yield || 0),
            functional: (mainData?.area_statistics?.functional_rate || 0) - (comparisonData?.area_statistics?.functional_rate || 0)
        };
        
        // Update metrics
        const metrics = {
            'comp-points-diff': `${differences.points > 0 ? '+' : ''}${differences.points}`,
            'comp-yield-diff': `${differences.yield > 0 ? '+' : ''}${differences.yield.toFixed(1)} m³/h`,
            'comp-functional-diff': `${differences.functional > 0 ? '+' : ''}${differences.functional.toFixed(1)}%`
        };
        
        Object.entries(metrics).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
                element.className = `difference ${parseFloat(value) > 0 ? 'positive' : 'negative'}`;
            }
        });
    }

    createComparisonMetricsSection() {
        const drillDetails = document.getElementById('drill-details');
        if (!drillDetails) return;
        
        const comparisonSection = document.createElement('div');
        comparisonSection.id = 'comparison-metrics';
        comparisonSection.className = 'comparison-metrics';
        comparisonSection.innerHTML = `
            <h5><i class="fas fa-balance-scale"></i> Comparison Metrics</h5>
            <div class="comparison-grid">
                <div class="comparison-metric">
                    <span>Points Difference:</span>
                    <span id="comp-points-diff" class="difference">0</span>
                </div>
                <div class="comparison-metric">
                    <span>Yield Difference:</span>
                    <span id="comp-yield-diff" class="difference">0 m³/h</span>
                </div>
                <div class="comparison-metric">
                    <span>Functional Rate Difference:</span>
                    <span id="comp-functional-diff" class="difference">0%</span>
                </div>
            </div>
        `;
        
        drillDetails.appendChild(comparisonSection);
    }

    clearComparisonView() {
        this.comparisonData = null;
        
        // Remove comparison metrics section
        const comparisonSection = document.getElementById('comparison-metrics');
        if (comparisonSection) {
            comparisonSection.remove();
        }
        
        // Reset drilldown chart
        const currentArea = document.getElementById('selected-area')?.textContent;
        if (currentArea && currentArea !== '-') {
            // Reload original drilldown
            const areaType = document.getElementById('drill-area-type')?.value || 'county';
            this.performDrilldown(areaType, currentArea);
        }
    }

    // ============================================
    // EXPORT FUNCTIONALITY
    // ============================================

    async exportDrillData() {
        const areaName = document.getElementById('selected-area')?.textContent;
        if (!areaName || areaName === '-') {
            this.showNotification('Please select an area to export', 'warning');
            return;
        }
        
        const format = prompt('Export format (csv, excel, json):', 'csv');
        if (!format || !['csv', 'excel', 'json'].includes(format.toLowerCase())) {
            this.showNotification('Invalid format selected', 'error');
            return;
        }
        
        this.showLoading(`Exporting ${areaName} data as ${format.toUpperCase()}...`);
        
        try {
            const areaType = document.getElementById('drill-area-type')?.value || 'county';
            
            // Get drilldown data
            const data = await window.analyticsAPI.getDrilldownData(areaType, areaName);
            
            if (data.success) {
                // Prepare export data
                const exportData = {
                    metadata: {
                        area_type: areaType,
                        area_name: areaName,
                        export_date: new Date().toISOString(),
                        total_points: data.area_statistics.total
                    },
                    area_statistics: data.area_statistics,
                    drilldown_data: data.drilldown_data,
                    spatial_points: data.spatial_points,
                    water_quality: data.water_quality,
                    yield_analysis: data.yield_analysis
                };
                
                // Export based on format
                this.downloadData(exportData, areaName, format);
                
                this.showNotification(`Exported ${areaName} data successfully`, 'success');
            }
            
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification(`Export failed: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    downloadData(data, filename, format) {
        let content, mimeType, extension;
        
        switch (format.toLowerCase()) {
            case 'csv':
                content = this.convertToCSV(data);
                mimeType = 'text/csv';
                extension = 'csv';
                break;
            case 'excel':
                content = this.convertToExcel(data);
                mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                extension = 'xlsx';
                break;
            case 'json':
                content = JSON.stringify(data, null, 2);
                mimeType = 'application/json';
                extension = 'json';
                break;
            default:
                throw new Error('Unsupported format');
        }
        
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename.replace(/[^a-z0-9]/gi, '_')}_analysis.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    convertToCSV(data) {
        // Convert drilldown data to CSV
        const drilldown = data.drilldown_data || [];
        if (drilldown.length === 0) return '';
        
        const headers = Object.keys(drilldown[0]).join(',');
        const rows = drilldown.map(item => 
            Object.values(item).map(val => 
                typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
            ).join(',')
        );
        
        return [headers, ...rows].join('\n');
    }

    convertToExcel(data) {
        // Simplified Excel export - in production, use a library like SheetJS
        return this.convertToCSV(data); // Fallback to CSV
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    showNoDataMessage() {
        const placeholder = document.getElementById('drill-chart-placeholder');
        const canvas = document.getElementById('drillDownChart');
        
        if (placeholder) {
            placeholder.innerHTML = `
                <i class="fas fa-database"></i>
                <p>No drilldown data available</p>
                <small>Try selecting a different area or filter</small>
            `;
            placeholder.classList.remove('hidden');
        }
        
        if (canvas) {
            canvas.classList.add('hidden');
        }
    }

    resetDrilldownView() {
        const placeholder = document.getElementById('drill-chart-placeholder');
        const canvas = document.getElementById('drillDownChart');
        
        if (placeholder) {
            placeholder.innerHTML = `
                <i class="fas fa-chart-bar"></i>
                <p>Select an area to see detailed analysis</p>
                <small>Click on a county in the table or select from dropdown</small>
            `;
            placeholder.classList.remove('hidden');
        }
        
        if (canvas) {
            canvas.classList.add('hidden');
        }
        
        this.resetDrillDetails();
    }

    resetDrillDetails() {
        const details = {
            'selected-area': '-',
            'detail-points': '0',
            'detail-functional': '0%',
            'detail-yield': '0 m³/h',
            'detail-ph': 'N/A',
            'detail-ec': 'N/A'
        };
        
        Object.entries(details).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
        
        // Remove area type badge
        const badge = document.getElementById('area-type-badge');
        if (badge) badge.remove();
    }

    showLoading(message) {
        if (window.showLoading) {
            window.showLoading(message);
        } else {
            // Fallback loading indicator
            const overlay = document.createElement('div');
            overlay.className = 'drill-loading';
            overlay.innerHTML = `
                <div class="loading-spinner"></div>
                <p>${message}</p>
            `;
            overlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255,255,255,0.9);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            `;
            
            const drillContainer = document.querySelector('.drill-container');
            if (drillContainer) {
                drillContainer.style.position = 'relative';
                drillContainer.appendChild(overlay);
            }
        }
    }

    hideLoading() {
        if (window.hideLoading) {
            window.hideLoading();
        } else {
            const loading = document.querySelector('.drill-loading');
            if (loading) loading.remove();
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${this.getNotificationColor(type)};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 9999;
            animation: slideIn 0.3s ease;
        `;
        
        // Add close button handler
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => notification.remove());
        
        // Auto-remove after 5 seconds
        setTimeout(() => notification.remove(), 5000);
        
        document.body.appendChild(notification);
    }

    getNotificationIcon(type) {
        const icons = {
            'info': 'info-circle',
            'success': 'check-circle',
            'warning': 'exclamation-triangle',
            'error': 'times-circle'
        };
        return icons[type] || 'info-circle';
    }

    getNotificationColor(type) {
        const colors = {
            'info': '#3498db',
            'success': '#2ecc71',
            'warning': '#f39c12',
            'error': '#e74c3c'
        };
        return colors[type] || '#3498db';
    }
}

// ============================================
// INITIALIZATION
// ============================================

let analyticsDrilldown;

document.addEventListener('DOMContentLoaded', () => {
    analyticsDrilldown = new AnalyticsDrilldown();
    
    // Make available globally
    window.analyticsDrilldown = analyticsDrilldown;
});