/**
 * Analytics Filters Service
 * Handles all filter logic and UI interactions
 */

class AnalyticsFilters {
    constructor() {
        this.filters = {
            county: [],
            subcounty: [],
            source_type: [],
            operation_status: [],
            water_rest: [],
            ph_range: { min: 0, max: 14 },
            yield_range: { min: 0, max: 100 },
            ec_range: { min: 0, max: 5000 }
        };
        
        this.activeFilters = new Set();
        this.filterCallbacks = [];
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.initMultiSelects();
        this.initRangeSliders();
        this.updateFilterCount();
    }

    bindEvents() {
        // Apply filters button
        document.getElementById('apply-filters')?.addEventListener('click', () => {
            this.applyFilters();
        });
        
        // Clear all filters button
        document.getElementById('clear-all-filters')?.addEventListener('click', () => {
            this.clearAllFilters();
        });
        
        // Toggle filters button
        document.getElementById('toggle-filters')?.addEventListener('click', (e) => {
            this.toggleFilters(e.target);
        });
        
        // Time range buttons
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleTimeRange(e.target);
            });
        });
        
        // Chart type buttons
        document.querySelectorAll('.chart-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleChartType(e.target);
            });
        });
        
        // Quality tabs
        document.querySelectorAll('.quality-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.handleQualityTab(e.target);
            });
        });
        
        // Structure tabs
        document.querySelectorAll('.structure-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.handleStructureTab(e.target);
            });
        });
        
        // County sort select
        document.getElementById('county-sort')?.addEventListener('change', (e) => {
            this.handleCountySort(e.target.value);
        });
        
        // Yield chart type select
        document.getElementById('yield-chart-type')?.addEventListener('change', (e) => {
            this.handleYieldChartType(e.target.value);
        });
        
        // Search input
        document.getElementById('county-search')?.addEventListener('input', (e) => {
            this.handleTableSearch(e.target.value);
        });
    }

    initMultiSelects() {
        // Initialize all multi-select components
        const multiSelects = document.querySelectorAll('.multi-select');
        
        multiSelects.forEach(select => {
            const selected = select.querySelector('.select-selected');
            const options = select.querySelector('.select-options');
            const optionItems = select.querySelectorAll('.select-option');
            
            // Toggle dropdown
            selected.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown(options);
            });
            
            // Handle option selection
            optionItems.forEach(option => {
                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleOption(option);
                    this.updateSelectedCount(select);
                });
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', () => {
                options.style.display = 'none';
            });
        });
    }

    initRangeSliders() {
        // Initialize pH range slider
        const phMinSlider = document.getElementById('ph-slider-min');
        const phMaxSlider = document.getElementById('ph-slider-max');
        const phMinValue = document.getElementById('ph-min-value');
        const phMaxValue = document.getElementById('ph-max-value');
        
        if (phMinSlider && phMaxSlider) {
            this.initRangeSlider(phMinSlider, phMaxSlider, phMinValue, phMaxValue, 'ph_range');
        }
        
        // Initialize yield range slider
        const yieldMinSlider = document.getElementById('yield-slider-min');
        const yieldMaxSlider = document.getElementById('yield-slider-max');
        const yieldMinValue = document.getElementById('yield-min-value');
        const yieldMaxValue = document.getElementById('yield-max-value');
        
        if (yieldMinSlider && yieldMaxSlider) {
            this.initRangeSlider(yieldMinSlider, yieldMaxSlider, yieldMinValue, yieldMaxValue, 'yield_range');
        }
    }

    initRangeSlider(minSlider, maxSlider, minValueEl, maxValueEl, filterKey) {
        // Set initial values from filters
        minSlider.value = this.filters[filterKey].min;
        maxSlider.value = this.filters[filterKey].max;
        minValueEl.textContent = this.filters[filterKey].min;
        maxValueEl.textContent = this.filters[filterKey].max;
        
        // Update values on slider change
        const updateValues = () => {
            const minVal = parseFloat(minSlider.value);
            const maxVal = parseFloat(maxSlider.value);
            
            // Ensure min <= max
            if (minVal > maxVal) {
                minSlider.value = maxVal;
                maxSlider.value = minVal;
                minValueEl.textContent = maxVal.toFixed(1);
                maxValueEl.textContent = minVal.toFixed(1);
                this.filters[filterKey] = { min: maxVal, max: minVal };
            } else {
                minValueEl.textContent = minVal.toFixed(1);
                maxValueEl.textContent = maxVal.toFixed(1);
                this.filters[filterKey] = { min: minVal, max: maxVal };
            }
            
            this.updateFilterCount();
        };
        
        minSlider.addEventListener('input', updateValues);
        maxSlider.addEventListener('input', updateValues);
    }

    toggleDropdown(options) {
        const isVisible = options.style.display === 'block';
        options.style.display = isVisible ? 'none' : 'block';
    }

    toggleOption(option) {
        const checkIcon = option.querySelector('.fa-check');
        const isSelected = checkIcon.style.display === 'inline-block';
        
        checkIcon.style.display = isSelected ? 'none' : 'inline-block';
        option.classList.toggle('selected', !isSelected);
        
        // Update filters
        const select = option.closest('.multi-select');
        const filterKey = select.id.replace('-select', '');
        const value = option.dataset.value;
        
        if (!isSelected) {
            this.addFilter(filterKey, value);
        } else {
            this.removeFilter(filterKey, value);
        }
    }

    updateSelectedCount(select) {
        const selectedCount = select.querySelectorAll('.select-option .fa-check[style*="inline-block"]').length;
        const countSpan = select.querySelector('.selected-count');
        
        if (countSpan) {
            countSpan.textContent = `${selectedCount} selected`;
        }
    }

    addFilter(key, value) {
        if (!this.filters[key]) {
            this.filters[key] = [];
        }
        
        if (!this.filters[key].includes(value)) {
            this.filters[key].push(value);
            this.activeFilters.add(key);
            this.updateFilterCount();
            this.notifyFiltersChanged();
        }
    }

    removeFilter(key, value) {
        if (this.filters[key]) {
            const index = this.filters[key].indexOf(value);
            if (index > -1) {
                this.filters[key].splice(index, 1);
                
                // Remove key from active filters if array is empty
                if (this.filters[key].length === 0) {
                    this.activeFilters.delete(key);
                }
                
                this.updateFilterCount();
                this.notifyFiltersChanged();
            }
        }
    }

    updateFilterCount() {
        const totalFilters = this.activeFilters.size;
        const filterCountEl = document.querySelector('.filter-count');
        
        if (filterCountEl) {
            filterCountEl.textContent = totalFilters;
            filterCountEl.style.display = totalFilters > 0 ? 'inline-block' : 'none';
        }
        
        // Update apply button state
        const applyBtn = document.getElementById('apply-filters');
        if (applyBtn) {
            applyBtn.disabled = totalFilters === 0;
            applyBtn.style.opacity = totalFilters === 0 ? '0.6' : '1';
        }
    }

    applyFilters() {
        console.log('Applying filters:', this.filters);
        
        // Notify all callbacks
        this.notifyFiltersChanged();
        
        // Show loading state
        this.showLoading();
        
        // Simulate API call (would be replaced with actual API call)
        setTimeout(() => {
            this.hideLoading();
            this.showNotification('Filters applied successfully!', 'success');
        }, 500);
    }

    clearAllFilters() {
        // Reset all filters
        Object.keys(this.filters).forEach(key => {
            if (Array.isArray(this.filters[key])) {
                this.filters[key] = [];
            } else if (typeof this.filters[key] === 'object') {
                // Reset range sliders to defaults
                if (key === 'ph_range') {
                    this.filters[key] = { min: 0, max: 14 };
                    this.resetRangeSlider('ph-slider-min', 'ph-slider-max', 'ph-min-value', 'ph-max-value', 0, 14);
                } else if (key === 'yield_range') {
                    this.filters[key] = { min: 0, max: 100 };
                    this.resetRangeSlider('yield-slider-min', 'yield-slider-max', 'yield-min-value', 'yield-max-value', 0, 100);
                } else if (key === 'ec_range') {
                    this.filters[key] = { min: 0, max: 5000 };
                }
            }
        });
        
        // Clear all multi-select selections
        document.querySelectorAll('.select-option .fa-check').forEach(check => {
            check.style.display = 'none';
        });
        
        document.querySelectorAll('.select-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        document.querySelectorAll('.selected-count').forEach(span => {
            span.textContent = '0 selected';
        });
        
        this.activeFilters.clear();
        this.updateFilterCount();
        this.notifyFiltersChanged();
        
        this.showNotification('All filters cleared!', 'info');
    }

    resetRangeSlider(minId, maxId, minValueId, maxValueId, minVal, maxVal) {
        const minSlider = document.getElementById(minId);
        const maxSlider = document.getElementById(maxId);
        const minValue = document.getElementById(minValueId);
        const maxValue = document.getElementById(maxValueId);
        
        if (minSlider && maxSlider && minValue && maxValue) {
            minSlider.value = minVal;
            maxSlider.value = maxVal;
            minValue.textContent = minVal;
            maxValue.textContent = maxVal;
        }
    }

    toggleFilters(button) {
        const filterGrid = document.getElementById('filter-grid');
        const icon = button.querySelector('i');
        
        if (filterGrid) {
            const isCollapsed = filterGrid.style.display === 'none';
            filterGrid.style.display = isCollapsed ? 'grid' : 'none';
            icon.className = isCollapsed ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
        }
    }

    handleTimeRange(button) {
        // Remove active class from all time buttons
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active class to clicked button
        button.classList.add('active');
        
        const range = button.dataset.range;
        console.log('Time range selected:', range);
        
        // Update dashboard based on time range
        this.notifyTimeRangeChanged(range);
    }

    handleChartType(button) {
        const chartType = button.dataset.type;
        
        // Remove active class from all buttons
        button.closest('.chart-type-selector')?.querySelectorAll('.chart-type-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active class to clicked button
        button.classList.add('active');
        
        console.log('Chart type selected:', chartType);
        
        // Update chart based on type
        this.notifyChartTypeChanged(chartType);
    }

    handleQualityTab(tab) {
        const metric = tab.dataset.metric;
        
        // Remove active class from all tabs
        tab.closest('.quality-tabs')?.querySelectorAll('.quality-tab').forEach(t => {
            t.classList.remove('active');
        });
        
        // Add active class to clicked tab
        tab.classList.add('active');
        
        console.log('Quality metric selected:', metric);
        
        // Update quality chart
        this.notifyQualityMetricChanged(metric);
    }

    handleStructureTab(tab) {
        const structure = tab.dataset.structure;
        
        // Remove active class from all tabs
        tab.closest('.structure-tabs')?.querySelectorAll('.structure-tab').forEach(t => {
            t.classList.remove('active');
        });
        
        // Add active class to clicked tab
        tab.classList.add('active');
        
        console.log('Structure type selected:', structure);
        
        // Update structure chart
        this.notifyStructureTypeChanged(structure);
    }

    handleCountySort(sortBy) {
        console.log('County sort changed to:', sortBy);
        this.notifyCountySortChanged(sortBy);
    }

    handleYieldChartType(chartType) {
        console.log('Yield chart type changed to:', chartType);
        this.notifyYieldChartTypeChanged(chartType);
    }

    handleTableSearch(searchTerm) {
        console.log('Table search:', searchTerm);
        this.filterTable(searchTerm);
    }

    filterTable(searchTerm) {
        const table = document.getElementById('county-table');
        if (!table) return;
        
        const rows = table.querySelectorAll('tr');
        let visibleCount = 0;
        
        rows.forEach(row => {
            const countyName = row.querySelector('.county-name')?.textContent.toLowerCase() || '';
            const shouldShow = countyName.includes(searchTerm.toLowerCase()) || searchTerm === '';
            
            row.style.display = shouldShow ? '' : 'none';
            if (shouldShow) visibleCount++;
        });
        
        // Update visible count
        const visibleCountEl = document.getElementById('visible-count');
        if (visibleCountEl) {
            visibleCountEl.textContent = visibleCount;
        }
    }

    // Event notification methods
    onFiltersChanged(callback) {
        this.filterCallbacks.push(callback);
    }

    notifyFiltersChanged() {
        this.filterCallbacks.forEach(callback => {
            callback(this.filters);
        });
    }

    notifyTimeRangeChanged(range) {
        // Implement time range change notifications
        const event = new CustomEvent('timeRangeChanged', { detail: { range } });
        document.dispatchEvent(event);
    }

    notifyChartTypeChanged(type) {
        const event = new CustomEvent('chartTypeChanged', { detail: { type } });
        document.dispatchEvent(event);
    }

    notifyQualityMetricChanged(metric) {
        const event = new CustomEvent('qualityMetricChanged', { detail: { metric } });
        document.dispatchEvent(event);
    }

    notifyStructureTypeChanged(structure) {
        const event = new CustomEvent('structureTypeChanged', { detail: { structure } });
        document.dispatchEvent(event);
    }

    notifyCountySortChanged(sortBy) {
        const event = new CustomEvent('countySortChanged', { detail: { sortBy } });
        document.dispatchEvent(event);
    }

    notifyYieldChartTypeChanged(chartType) {
        const event = new CustomEvent('yieldChartTypeChanged', { detail: { chartType } });
        document.dispatchEvent(event);
    }

    // UI Helper methods
    showLoading() {
        // Show loading overlay
        const overlay = document.createElement('div');
        overlay.id = 'filter-loading-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        `;
        
        const spinner = document.createElement('div');
        spinner.style.cssText = `
            width: 50px;
            height: 50px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #0ea5e9;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        `;
        
        overlay.appendChild(spinner);
        document.body.appendChild(overlay);
        
        // Add animation style if not exists
        if (!document.querySelector('#filter-spinner-style')) {
            const style = document.createElement('style');
            style.id = 'filter-spinner-style';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    hideLoading() {
        const overlay = document.getElementById('filter-loading-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    showNotification(message, type = 'info') {
        // Remove existing notification
        const existing = document.querySelector('.filter-notification');
        if (existing) {
            existing.remove();
        }
        
        // Create notification
        const notification = document.createElement('div');
        notification.className = `filter-notification filter-notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${this.getNotificationColor(type)};
            color: white;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideIn 0.3s ease;
            font-size: 14px;
            font-weight: 500;
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
        
        // Add animation styles if not exists
        if (!document.querySelector('#filter-notification-style')) {
            const style = document.createElement('style');
            style.id = 'filter-notification-style';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    getNotificationColor(type) {
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#0ea5e9'
        };
        return colors[type] || colors.info;
    }

    // Get current filters
    getFilters() {
        return { ...this.filters };
    }

    // Set filters programmatically
    setFilters(newFilters) {
        this.filters = { ...this.filters, ...newFilters };
        this.updateFilterUI();
        this.updateFilterCount();
        this.notifyFiltersChanged();
    }

    updateFilterUI() {
        // Update multi-selects
        Object.keys(this.filters).forEach(key => {
            if (Array.isArray(this.filters[key])) {
                const select = document.getElementById(`${key}-select`);
                if (select) {
                    const options = select.querySelectorAll('.select-option');
                    options.forEach(option => {
                        const value = option.dataset.value;
                        const checkIcon = option.querySelector('.fa-check');
                        const isSelected = this.filters[key].includes(value);
                        
                        checkIcon.style.display = isSelected ? 'inline-block' : 'none';
                        option.classList.toggle('selected', isSelected);
                    });
                    
                    this.updateSelectedCount(select);
                }
            }
        });
        
        // Update range sliders
        if (this.filters.ph_range) {
            this.updateRangeSlider('ph-slider-min', 'ph-slider-max', 'ph-min-value', 'ph-max-value', this.filters.ph_range);
        }
        
        if (this.filters.yield_range) {
            this.updateRangeSlider('yield-slider-min', 'yield-slider-max', 'yield-min-value', 'yield-max-value', this.filters.yield_range);
        }
    }

    updateRangeSlider(minId, maxId, minValueId, maxValueId, range) {
        const minSlider = document.getElementById(minId);
        const maxSlider = document.getElementById(maxId);
        const minValue = document.getElementById(minValueId);
        const maxValue = document.getElementById(maxValueId);
        
        if (minSlider && maxSlider && minValue && maxValue && range) {
            minSlider.value = range.min;
            maxSlider.value = range.max;
            minValue.textContent = range.min.toFixed(1);
            maxValue.textContent = range.max.toFixed(1);
        }
    }

    // Reset to default filters
    resetToDefaults() {
        this.filters = {
            county: [],
            subcounty: [],
            source_type: [],
            operation_status: [],
            water_rest: [],
            ph_range: { min: 0, max: 14 },
            yield_range: { min: 0, max: 100 },
            ec_range: { min: 0, max: 5000 }
        };
        
        this.activeFilters.clear();
        this.updateFilterUI();
        this.updateFilterCount();
        this.notifyFiltersChanged();
    }

    // Export filters
    exportFilters() {
        const dataStr = JSON.stringify(this.filters, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = 'filters.json';
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    }

    // Import filters
    importFilters(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedFilters = JSON.parse(e.target.result);
                this.setFilters(importedFilters);
                this.showNotification('Filters imported successfully!', 'success');
            } catch (error) {
                this.showNotification('Error importing filters: Invalid format', 'error');
            }
        };
        reader.readAsText(file);
    }

    // Get filter summary
    getFilterSummary() {
        const summary = [];
        
        Object.keys(this.filters).forEach(key => {
            const value = this.filters[key];
            
            if (Array.isArray(value) && value.length > 0) {
                summary.push(`${key}: ${value.length} selected`);
            } else if (typeof value === 'object' && value !== null) {
                if (value.min !== undefined && value.max !== undefined) {
                    summary.push(`${key}: ${value.min} - ${value.max}`);
                }
            }
        });
        
        return summary;
    }
}

// Create global instance
const analyticsFilters = new AnalyticsFilters();