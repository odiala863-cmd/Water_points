// ============================================
// ANALYTICS EXPORT HANDLER
// Data export functionality for analytics dashboard
// ============================================

class AnalyticsExport {
    constructor() {
        this.exportFormats = ['csv', 'excel', 'json', 'geojson'];
        this.exportHistory = [];
        this.maxHistoryItems = 10;
        this.bindExportEvents();
    }

    // ============================================
    // EXPORT EVENT HANDLING
    // ============================================

    bindExportEvents() {
        // Main export button
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', (e) => this.toggleExportOptions(e));
        }
        
        // Export options
        document.querySelectorAll('.export-option').forEach(option => {
            option.addEventListener('click', (e) => this.handleExportOption(e));
        });
        
        // Export table button
        const exportTableBtn = document.getElementById('export-table');
        if (exportTableBtn) {
            exportTableBtn.addEventListener('click', () => this.exportTableData());
        }
        
        // Export drill button (already bound in drilldown.js)
        // We'll add additional handlers if needed
        
        // Close export options when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.export-dropdown')) {
                this.hideExportOptions();
            }
        });
    }

    toggleExportOptions(event) {
        event.stopPropagation();
        const options = document.getElementById('export-options');
        if (options) {
            options.classList.toggle('hidden');
        }
    }

    hideExportOptions() {
        const options = document.getElementById('export-options');
        if (options) {
            options.classList.add('hidden');
        }
    }

    async handleExportOption(event) {
        event.preventDefault();
        
        const format = event.target.textContent.toLowerCase();
        await this.exportData(format);
        
        this.hideExportOptions();
    }

    // ============================================
    // MAIN EXPORT FUNCTIONALITY
    // ============================================

    async exportData(format = 'csv', customFilters = null) {
        if (!this.exportFormats.includes(format.toLowerCase())) {
            this.showError(`Unsupported export format: ${format}`);
            return;
        }
        
        this.showLoading(`Preparing ${format.toUpperCase()} export...`);
        
        try {
            let exportUrl;
            const filters = customFilters || (window.analyticsAPI ? window.analyticsAPI.activeFilters : {});
            
            switch (format.toLowerCase()) {
                case 'csv':
                    exportUrl = `/analytics/export/csv/?filters=${encodeURIComponent(JSON.stringify(filters))}`;
                    break;
                case 'excel':
                    exportUrl = `/analytics/export/excel/?filters=${encodeURIComponent(JSON.stringify(filters))}`;
                    break;
                case 'json':
                    exportUrl = `/analytics/export/json/?filters=${encodeURIComponent(JSON.stringify(filters))}`;
                    break;
                case 'geojson':
                    exportUrl = `/analytics/export/geojson/?filters=${encodeURIComponent(JSON.stringify(filters))}`;
                    break;
            }
            
            await this.downloadFile(exportUrl, format);
            
            this.addToExportHistory(format, filters);
            this.showSuccess(`Data exported successfully as ${format.toUpperCase()}`);
            
        } catch (error) {
            console.error('Export error:', error);
            this.showError(`Export failed: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    async downloadFile(url, format) {
        const response = await fetch(url, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': this.getCSRFToken()
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        
        // Generate filename
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const filename = `water_points_${timestamp}.${format}`;
        a.download = filename;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
    }

    // ============================================
    // TABLE EXPORT
    // ============================================

    async exportTableData() {
        const table = document.querySelector('.performance-table');
        if (!table) {
            this.showError('No table data found');
            return;
        }
        
        const format = prompt('Export format (csv, excel):', 'csv');
        if (!format || !['csv', 'excel'].includes(format.toLowerCase())) {
            this.showError('Invalid format selected');
            return;
        }
        
        this.showLoading(`Exporting table as ${format.toUpperCase()}...`);
        
        try {
            const data = this.extractTableData(table);
            const blob = await this.convertTableData(data, format);
            
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            const filename = `county_performance_${timestamp}.${format}`;
            
            this.downloadBlob(blob, filename);
            
            this.showSuccess(`Table exported successfully as ${format.toUpperCase()}`);
            
        } catch (error) {
            console.error('Table export error:', error);
            this.showError(`Table export failed: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    extractTableData(table) {
        const headers = [];
        const rows = [];
        
        // Extract headers
        table.querySelectorAll('thead th').forEach(th => {
            const text = th.textContent.trim();
            if (text && !th.classList.contains('actions')) {
                headers.push(text);
            }
        });
        
        // Extract rows
        table.querySelectorAll('tbody tr').forEach(tr => {
            if (tr.style.display === 'none') return;
            
            const row = [];
            tr.querySelectorAll('td').forEach((td, index) => {
                if (index >= headers.length) return;
                
                // Handle special cells
                if (td.querySelector('.progress-text')) {
                    row.push(td.querySelector('.progress-text').textContent);
                } else if (td.querySelector('.score-badge')) {
                    row.push(td.querySelector('.score-badge').textContent);
                } else {
                    row.push(td.textContent.trim());
                }
            });
            
            if (row.length > 0) {
                rows.push(row);
            }
        });
        
        return { headers, rows };
    }

    async convertTableData(data, format) {
        if (format.toLowerCase() === 'csv') {
            const csvContent = [
                data.headers.join(','),
                ...data.rows.map(row => row.map(cell => 
                    typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
                ).join(','))
            ].join('\n');
            
            return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            
        } else if (format.toLowerCase() === 'excel') {
            // For Excel, we'll create a simple CSV (in production, use SheetJS)
            const csvContent = [
                data.headers.join(','),
                ...data.rows.map(row => row.map(cell => 
                    typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
                ).join(','))
            ].join('\n');
            
            return new Blob([csvContent], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        }
        
        throw new Error('Unsupported format');
    }

    // ============================================
    // CHART EXPORT
    // ============================================

    async exportChart(chartId, format = 'png') {
        const chart = window.analyticsCharts?.charts.get(chartId);
        if (!chart) {
            this.showError(`Chart ${chartId} not found`);
            return;
        }
        
        this.showLoading(`Exporting chart as ${format.toUpperCase()}...`);
        
        try {
            const canvas = chart.canvas;
            const dataUrl = canvas.toDataURL(`image/${format}`);
            
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            const filename = `${chartId}_chart_${timestamp}.${format}`;
            
            this.downloadDataUrl(dataUrl, filename);
            
            this.showSuccess(`Chart exported successfully as ${format.toUpperCase()}`);
            
        } catch (error) {
            console.error('Chart export error:', error);
            this.showError(`Chart export failed: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    exportAllCharts(format = 'png') {
        if (!window.analyticsCharts) {
            this.showError('No charts available');
            return;
        }
        
        const chartIds = Array.from(window.analyticsCharts.charts.keys());
        if (chartIds.length === 0) {
            this.showError('No charts to export');
            return;
        }
        
        this.showLoading(`Exporting ${chartIds.length} charts as ${format.toUpperCase()}...`);
        
        // Create a zip file with all charts
        // In production, you would use a library like JSZip
        // For now, we'll export them individually
        chartIds.forEach((chartId, index) => {
            setTimeout(() => {
                this.exportChart(chartId, format);
            }, index * 1000); // Stagger exports
        });
        
        setTimeout(() => {
            this.hideLoading();
            this.showSuccess(`${chartIds.length} charts exported`);
        }, chartIds.length * 1000);
    }

    // ============================================
    // DASHBOARD STATE EXPORT
    // ============================================

    async exportDashboardState() {
        this.showLoading('Exporting dashboard state...');
        
        try {
            const state = {
                timestamp: new Date().toISOString(),
                filters: window.analyticsAPI ? window.analyticsAPI.activeFilters : {},
                viewState: this.getViewState(),
                dataSnapshot: await this.getDataSnapshot()
            };
            
            const json = JSON.stringify(state, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            const filename = `dashboard_state_${timestamp}.json`;
            
            this.downloadBlob(blob, filename);
            
            this.showSuccess('Dashboard state exported successfully');
            
        } catch (error) {
            console.error('State export error:', error);
            this.showError(`State export failed: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    getViewState() {
        const state = {
            activeTab: document.querySelector('.nav-link.active')?.textContent.trim(),
            geographicalLevel: document.querySelector('.option-tag.active')?.dataset.level,
            chartTypes: {},
            tableSort: {}
        };
        
        // Get chart types
        if (window.analyticsCharts) {
            window.analyticsCharts.charts.forEach((chart, id) => {
                state.chartTypes[id] = chart.config.type;
            });
        }
        
        // Get table sort state
        const tableHeaders = document.querySelectorAll('.performance-table th[data-sort]');
        tableHeaders.forEach(th => {
            if (th.dataset.sort) {
                state.tableSort[th.dataset.sort] = th.dataset.sortDirection;
            }
        });
        
        return state;
    }

    async getDataSnapshot() {
        if (!window.analyticsAPI) return null;
        
        try {
            // Get current data with applied filters
            const data = await window.analyticsAPI.getAnalyticsData(
                window.analyticsAPI.activeFilters,
                'admin_1',
                100
            );
            
            return {
                statistics: data.statistics,
                aggregated_data: data.aggregated_data.slice(0, 20), // Limit size
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Error getting data snapshot:', error);
            return null;
        }
    }

    // ============================================
    // EXPORT HISTORY
    // ============================================

    addToExportHistory(format, filters) {
        const historyItem = {
            format,
            filters,
            timestamp: new Date().toISOString(),
            size: this.estimateExportSize(filters)
        };
        
        this.exportHistory.push(historyItem);
        
        // Keep only last N items
        if (this.exportHistory.length > this.maxHistoryItems) {
            this.exportHistory.shift();
        }
        
        // Save to localStorage
        this.saveExportHistory();
        
        // Update history display
        this.updateExportHistoryDisplay();
    }

    estimateExportSize(filters) {
        // Simple size estimation based on filter complexity
        const complexity = Object.keys(filters).length;
        return `${complexity * 10}KB (estimated)`;
    }

    saveExportHistory() {
        try {
            localStorage.setItem('exportHistory', JSON.stringify(this.exportHistory));
        } catch (error) {
            console.error('Error saving export history:', error);
        }
    }

    loadExportHistory() {
        try {
            const saved = localStorage.getItem('exportHistory');
            if (saved) {
                this.exportHistory = JSON.parse(saved);
                this.updateExportHistoryDisplay();
            }
        } catch (error) {
            console.error('Error loading export history:', error);
        }
    }

    updateExportHistoryDisplay() {
        const historyContainer = document.getElementById('export-history');
        if (!historyContainer) {
            this.createExportHistoryDisplay();
            return;
        }
        
        const historyList = historyContainer.querySelector('.history-list');
        if (historyList) {
            historyList.innerHTML = this.exportHistory
                .slice()
                .reverse()
                .map((item, index) => `
                    <div class="history-item">
                        <span class="history-format">${item.format.toUpperCase()}</span>
                        <span class="history-time">${new Date(item.timestamp).toLocaleTimeString()}</span>
                        <span class="history-size">${item.size}</span>
                        <button class="history-redo" data-index="${this.exportHistory.length - 1 - index}">
                            <i class="fas fa-redo"></i>
                        </button>
                    </div>
                `)
                .join('');
            
            // Add redo handlers
            historyList.querySelectorAll('.history-redo').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt(e.currentTarget.dataset.index);
                    this.redoExport(index);
                });
            });
        }
    }

    createExportHistoryDisplay() {
        const exportDropdown = document.querySelector('.export-dropdown');
        if (!exportDropdown) return;
        
        const historyContainer = document.createElement('div');
        historyContainer.id = 'export-history';
        historyContainer.className = 'export-history';
        historyContainer.innerHTML = `
            <div class="history-header">
                <h6>Recent Exports</h6>
                <button class="btn-clear-history" id="clear-export-history">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="history-list"></div>
        `;
        
        exportDropdown.appendChild(historyContainer);
        
        // Add clear history handler
        const clearBtn = document.getElementById('clear-export-history');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearExportHistory());
        }
        
        this.updateExportHistoryDisplay();
    }

    async redoExport(index) {
        const historyItem = this.exportHistory[index];
        if (!historyItem) return;
        
        await this.exportData(historyItem.format, historyItem.filters);
    }

    clearExportHistory() {
        this.exportHistory = [];
        this.saveExportHistory();
        this.updateExportHistoryDisplay();
        this.showSuccess('Export history cleared');
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    downloadBlob(blob, filename) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    downloadDataUrl(dataUrl, filename) {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    getCSRFToken() {
        return document.querySelector('[name=csrf-token]')?.content || 
               document.querySelector('meta[name="csrf-token"]')?.content;
    }

    showLoading(message) {
        if (window.showLoading) {
            window.showLoading(message);
        }
    }

    hideLoading() {
        if (window.hideLoading) {
            window.hideLoading();
        }
    }

    showSuccess(message) {
        if (window.showNotification) {
            window.showNotification(message, 'success');
        } else {
            alert(`Success: ${message}`);
        }
    }

    showError(message) {
        if (window.showError) {
            window.showError(message);
        } else {
            alert(`Error: ${message}`);
        }
    }

    // ============================================
    // BATCH EXPORT
    // ============================================

    async exportBatch(formats = ['csv', 'json']) {
        if (!Array.isArray(formats) || formats.length === 0) {
            this.showError('No export formats specified');
            return;
        }
        
        const confirmed = confirm(`Export data in ${formats.length} formats? This may take a moment.`);
        if (!confirmed) return;
        
        this.showLoading(`Exporting batch (${formats.join(', ')})...`);
        
        try {
            const promises = formats.map(format => this.exportData(format));
            await Promise.all(promises);
            
            this.showSuccess(`Batch export completed: ${formats.join(', ')}`);
            
        } catch (error) {
            console.error('Batch export error:', error);
            this.showError(`Batch export failed: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    // ============================================
    // SCHEDULED EXPORTS
    // ============================================

    setupScheduledExport(schedule) {
        // Schedule can be 'daily', 'weekly', or a cron expression
        console.log(`Scheduled export set up: ${schedule}`);
        
        // In production, you would set up actual scheduling
        // For now, we'll just save the preference
        localStorage.setItem('exportSchedule', schedule);
        
        this.showSuccess(`Scheduled export set to: ${schedule}`);
    }

    cancelScheduledExport() {
        localStorage.removeItem('exportSchedule');
        this.showSuccess('Scheduled export cancelled');
    }
}

// ============================================
// INITIALIZATION
// ============================================

let analyticsExport;

document.addEventListener('DOMContentLoaded', () => {
    analyticsExport = new AnalyticsExport();
    
    // Load export history
    analyticsExport.loadExportHistory();
    
    // Make available globally
    window.analyticsExport = analyticsExport;
});