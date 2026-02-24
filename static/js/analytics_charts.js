/**
 * Analytics Charts Service
 * Handles all chart rendering and updates
 * FIXED: No duplicate declarations, proper global scope
 */

// Prevent multiple declarations
if (typeof AnalyticsCharts !== 'undefined') {
    console.warn('AnalyticsCharts already declared, using existing instance');
} else {
    
    class AnalyticsCharts {
        constructor() {
            this.chartInstances = {};
            this.chartColors = {
                primary: '#0ea5e9',
                secondary: '#06b6d4',
                success: '#10b981',
                warning: '#f59e0b',
                danger: '#ef4444',
                info: '#8b5cf6',
                purple: '#8b5cf6',
                pink: '#ec4899',
                indigo: '#6366f1',
                teal: '#14b8a6',
                orange: '#f97316',
                gray: '#6b7280'
            };
            
            this.colorPalette = [
                '#0ea5e9', '#06b6d4', '#10b981', '#f59e0b', 
                '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'
            ];
            
            this.initialize();
        }

        initialize() {
            // Check if Chart is available
            if (typeof Chart === 'undefined') {
                console.error('Chart.js is not loaded!');
                return;
            }
            
            try {
                // Set global chart defaults
                Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
                Chart.defaults.font.size = 11;
                
                // Get CSS variable safely
                const textSecondary = getComputedStyle(document.documentElement)
                    .getPropertyValue('--text-secondary')?.trim() || '#425466';
                Chart.defaults.color = textSecondary;
                
                console.log('✅ AnalyticsCharts initialized');
            } catch (error) {
                console.error('Error initializing charts:', error);
            }
        }

        // Source Distribution Chart
        createSourceChart(canvasId, data) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) {
                console.error(`Canvas element ${canvasId} not found`);
                return null;
            }
            
            // Destroy existing chart
            if (this.chartInstances.sourceChart) {
                this.chartInstances.sourceChart.destroy();
                delete this.chartInstances.sourceChart;
            }
            
            // Ensure data is valid
            if (!data || !Array.isArray(data) || data.length === 0) {
                console.warn(`No data for ${canvasId}, creating placeholder`);
                data = [{ source_1: 'No Data', count: 1 }];
            }
            
            // Prepare data
            const labels = data.map(item => {
                const name = item.source_1 || item.name || 'Unknown';
                return name.length > 25 ? name.substring(0, 22) + '...' : name;
            });
            const counts = data.map(item => item.count || 0);
            const total = counts.reduce((a, b) => a + b, 0);
            
            const ctx = canvas.getContext('2d');
            
            try {
                this.chartInstances.sourceChart = new Chart(ctx, {
                    type: 'pie',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: counts,
                            backgroundColor: this.colorPalette,
                            borderColor: '#ffffff',
                            borderWidth: 2,
                            hoverBorderColor: '#ffffff',
                            hoverBorderWidth: 3
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'right',
                                labels: {
                                    padding: 15,
                                    usePointStyle: true,
                                    pointStyle: 'circle',
                                    font: {
                                        size: 10
                                    },
                                    generateLabels: (chart) => {
                                        const datasets = chart.data.datasets;
                                        return chart.data.labels.map((label, i) => ({
                                            text: `${label} (${datasets[0].data[i]})`,
                                            fillStyle: datasets[0].backgroundColor[i],
                                            hidden: false,
                                            lineCap: 'round',
                                            lineDash: [],
                                            lineDashOffset: 0,
                                            lineJoin: 'round',
                                            lineWidth: 0,
                                            strokeStyle: datasets[0].backgroundColor[i],
                                            pointStyle: 'circle',
                                            rotation: 0
                                        }));
                                    }
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: (context) => {
                                        const label = context.label || '';
                                        const value = context.raw || 0;
                                        const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                        return `${label}: ${value} points (${percentage}%)`;
                                    }
                                }
                            }
                        },
                        cutout: '50%'
                    }
                });
                
                return this.chartInstances.sourceChart;
            } catch (error) {
                console.error('Error creating source chart:', error);
                return null;
            }
        }

        // Yield Distribution Chart
        createYieldChart(canvasId, data) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) {
                console.error(`Canvas element ${canvasId} not found`);
                return null;
            }
            
            // Destroy existing chart
            if (this.chartInstances.yieldChart) {
                this.chartInstances.yieldChart.destroy();
                delete this.chartInstances.yieldChart;
            }
            
            // Default data if none provided
            if (!data) {
                data = { very_low: 0, low: 0, medium: 0, high: 0, very_high: 0 };
            }
            
            // Prepare data from yield statistics
            const categories = [
                'Very Low (<2 m³/h)',
                'Low (2-5 m³/h)', 
                'Medium (5-10 m³/h)',
                'High (10-20 m³/h)',
                'Very High (>20 m³/h)'
            ];
            
            const values = [
                data.very_low || 0,
                data.low || 0,
                data.medium || 0,
                data.high || 0,
                data.very_high || 0
            ];
            
            const ctx = canvas.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, 'rgba(14, 165, 233, 0.8)');
            gradient.addColorStop(1, 'rgba(14, 165, 233, 0.2)');
            
            try {
                this.chartInstances.yieldChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: categories,
                        datasets: [{
                            label: 'Number of Points',
                            data: values,
                            backgroundColor: gradient,
                            borderColor: this.chartColors.primary,
                            borderWidth: 1,
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                callbacks: {
                                    label: (context) => {
                                        const value = context.raw || 0;
                                        const total = values.reduce((a, b) => a + b, 0);
                                        const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                        return `${value} points (${percentage}%)`;
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                title: {
                                    display: true,
                                    text: 'Number of Points'
                                },
                                grid: {
                                    drawBorder: false,
                                    color: 'rgba(0,0,0,0.05)'
                                }
                            },
                            x: {
                                ticks: {
                                    maxRotation: 45,
                                    minRotation: 45,
                                    font: {
                                        size: 10
                                    }
                                },
                                grid: {
                                    display: false
                                }
                            }
                        }
                    }
                });
                
                return this.chartInstances.yieldChart;
            } catch (error) {
                console.error('Error creating yield chart:', error);
                return null;
            }
        }

        // County Performance Chart
        createCountyChart(canvasId, data) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) {
                console.error(`Canvas element ${canvasId} not found`);
                return null;
            }
            
            // Destroy existing chart
            if (this.chartInstances.countyChart) {
                this.chartInstances.countyChart.destroy();
                delete this.chartInstances.countyChart;
            }
            
            // Default data
            if (!data || !Array.isArray(data) || data.length === 0) {
                console.warn(`No county data for ${canvasId}`);
                data = [{ admin_1: 'No Data', performance_score: 0 }];
            }
            
            // Sort by performance score and take top 10
            const sortedData = [...data]
                .filter(item => item.admin_1 && item.performance_score !== undefined)
                .sort((a, b) => {
                    return (b.performance_score || 0) - (a.performance_score || 0);
                }).slice(0, 10);
            
            // If no valid data after filtering, create placeholder
            if (sortedData.length === 0) {
                sortedData.push({ admin_1: 'No Data', performance_score: 0 });
            }
            
            const labels = sortedData.map(item => {
                const name = item.admin_1 || 'Unknown';
                return name.length > 20 ? name.substring(0, 17) + '...' : name;
            });
            const scores = sortedData.map(item => item.performance_score || 0);
            
            const ctx = canvas.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, 'rgba(16, 185, 129, 0.8)');
            gradient.addColorStop(1, 'rgba(16, 185, 129, 0.2)');
            
            try {
                this.chartInstances.countyChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Performance Score',
                            data: scores,
                            backgroundColor: gradient,
                            borderColor: this.chartColors.success,
                            borderWidth: 1,
                            borderRadius: 4
                        }]
                    },
                    options: {
                        indexAxis: 'y', // Horizontal bar chart for better county name display
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                callbacks: {
                                    label: (context) => {
                                        const value = context.raw || 0;
                                        return `Performance Score: ${value}`;
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                beginAtZero: true,
                                max: 100,
                                title: {
                                    display: true,
                                    text: 'Performance Score'
                                },
                                grid: {
                                    drawBorder: false,
                                    color: 'rgba(0,0,0,0.05)'
                                }
                            },
                            y: {
                                ticks: {
                                    font: {
                                        size: 10
                                    }
                                },
                                grid: {
                                    display: false
                                }
                            }
                        }
                    }
                });
                
                return this.chartInstances.countyChart;
            } catch (error) {
                console.error('Error creating county chart:', error);
                return null;
            }
        }

        // Water Quality Chart
        createQualityChart(canvasId, data) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) {
                console.error(`Canvas element ${canvasId} not found`);
                return null;
            }
            
            // Destroy existing chart
            if (this.chartInstances.qualityChart) {
                this.chartInstances.qualityChart.destroy();
                delete this.chartInstances.qualityChart;
            }
            
            // Default data
            if (!data) {
                data = { acidic_count: 0, neutral_count: 0, alkaline_count: 0 };
            }
            
            const acidic = data.acidic_count || 0;
            const neutral = data.neutral_count || 0;
            const alkaline = data.alkaline_count || 0;
            const total = acidic + neutral + alkaline;
            
            const ctx = canvas.getContext('2d');
            
            try {
                this.chartInstances.qualityChart = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Acidic (pH < 6.5)', 'Neutral (6.5-8.5)', 'Alkaline (pH > 8.5)'],
                        datasets: [{
                            data: [acidic, neutral, alkaline],
                            backgroundColor: [
                                this.chartColors.danger,
                                this.chartColors.success,
                                this.chartColors.warning
                            ],
                            borderColor: '#ffffff',
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '65%',
                        plugins: {
                            legend: {
                                position: 'right',
                                labels: {
                                    padding: 15,
                                    usePointStyle: true,
                                    pointStyle: 'circle',
                                    font: {
                                        size: 10
                                    },
                                    generateLabels: (chart) => {
                                        const datasets = chart.data.datasets;
                                        return chart.data.labels.map((label, i) => {
                                            const value = datasets[0].data[i];
                                            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                            return {
                                                text: `${label}: ${value} (${percentage}%)`,
                                                fillStyle: datasets[0].backgroundColor[i],
                                                hidden: false,
                                                lineCap: 'round',
                                                lineDash: [],
                                                lineDashOffset: 0,
                                                lineJoin: 'round',
                                                lineWidth: 0,
                                                strokeStyle: datasets[0].backgroundColor[i],
                                                pointStyle: 'circle',
                                                rotation: 0
                                            };
                                        });
                                    }
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: (context) => {
                                        const label = context.label || '';
                                        const value = context.raw || 0;
                                        const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                        return `${label}: ${value} points (${percentage}%)`;
                                    }
                                }
                            }
                        }
                    }
                });
                
                return this.chartInstances.qualityChart;
            } catch (error) {
                console.error('Error creating quality chart:', error);
                return null;
            }
        }

        // Structure Analysis Chart
        createStructureChart(canvasId, data) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) {
                console.error(`Canvas element ${canvasId} not found`);
                return null;
            }
            
            // Destroy existing chart
            if (this.chartInstances.structureChart) {
                this.chartInstances.structureChart.destroy();
                delete this.chartInstances.structureChart;
            }
            
            // Default data
            if (!data) {
                data = { first_structure: [] };
            }
            
            // Use first structure data by default
            let structureData = data.first_structure || [];
            
            if (!Array.isArray(structureData) || structureData.length === 0) {
                structureData = [{ first_stru: 'No Data', count: 0 }];
            }
            
            // Take top 8 for better display
            structureData = structureData.slice(0, 8);
            
            const labels = structureData.map(item => {
                const name = item.first_stru || item.name || 'Unknown';
                return name.length > 15 ? name.substring(0, 12) + '...' : name;
            });
            const counts = structureData.map(item => item.count || 0);
            
            const ctx = canvas.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, 'rgba(139, 92, 246, 0.8)');
            gradient.addColorStop(1, 'rgba(139, 92, 246, 0.2)');
            
            try {
                this.chartInstances.structureChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Number of Points',
                            data: counts,
                            backgroundColor: gradient,
                            borderColor: this.chartColors.info,
                            borderWidth: 1,
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                callbacks: {
                                    label: (context) => {
                                        const value = context.raw || 0;
                                        const total = counts.reduce((a, b) => a + b, 0);
                                        const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                        return `${value} points (${percentage}%)`;
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                title: {
                                    display: true,
                                    text: 'Number of Points'
                                },
                                grid: {
                                    drawBorder: false,
                                    color: 'rgba(0,0,0,0.05)'
                                }
                            },
                            x: {
                                ticks: {
                                    maxRotation: 45,
                                    minRotation: 45,
                                    font: {
                                        size: 10
                                    }
                                },
                                grid: {
                                    display: false
                                }
                            }
                        }
                    }
                });
                
                return this.chartInstances.structureChart;
            } catch (error) {
                console.error('Error creating structure chart:', error);
                return null;
            }
        }

        // Update all charts
        updateAllCharts(dashboardData) {
            if (!dashboardData) {
                console.warn('No dashboard data provided for charts');
                return;
            }
            
            console.log('Updating all charts with data:', dashboardData);
            
            try {
                // Update source chart
                if (dashboardData.sourceAnalysis) {
                    this.createSourceChart('sourceChart', dashboardData.sourceAnalysis);
                }
                
                // Update yield chart
                if (dashboardData.yieldStatistics) {
                    this.createYieldChart('yieldChart', dashboardData.yieldStatistics);
                }
                
                // Update county chart
                if (dashboardData.countyPerformance) {
                    this.createCountyChart('countyChart', dashboardData.countyPerformance);
                }
                
                // Update quality chart
                if (dashboardData.waterQualityIndicators) {
                    this.createQualityChart('qualityChart', dashboardData.waterQualityIndicators);
                }
                
                // Update structure chart
                if (dashboardData.structureAnalysis) {
                    this.createStructureChart('structureChart', dashboardData.structureAnalysis);
                }
                
                console.log('✅ All charts updated successfully');
            } catch (error) {
                console.error('Error updating charts:', error);
            }
        }

        // Destroy all charts
        destroyAllCharts() {
            Object.keys(this.chartInstances).forEach(key => {
                if (this.chartInstances[key] && typeof this.chartInstances[key].destroy === 'function') {
                    try {
                        this.chartInstances[key].destroy();
                    } catch (e) {
                        console.warn(`Error destroying chart ${key}:`, e);
                    }
                    delete this.chartInstances[key];
                }
            });
            this.chartInstances = {};
            console.log('All charts destroyed');
        }

        // Switch chart type (pie/bar/doughnut) for source chart
        switchSourceChartType(type) {
            const canvas = document.getElementById('sourceChart');
            if (!canvas) return;
            
            const data = this.chartInstances.sourceChart?.data;
            if (!data) return;
            
            if (type === 'pie' || type === 'doughnut') {
                this.chartInstances.sourceChart.config.type = type;
                this.chartInstances.sourceChart.update();
            } else if (type === 'bar') {
                this.chartInstances.sourceChart.config.type = 'bar';
                this.chartInstances.sourceChart.config.options.indexAxis = 'x';
                this.chartInstances.sourceChart.update();
            }
        }

        // Switch between first/second/combined structure view
        switchStructureView(type, data) {
            if (!data) return;
            
            let structureData;
            if (type === 'first') {
                structureData = data.first_structure || [];
            } else if (type === 'second') {
                structureData = data.second_structure || [];
            } else if (type === 'combined') {
                // Handle combined view logic
                return;
            }
            
            this.createStructureChart('structureChart', { first_structure: structureData });
        }
    }

    // Create single instance
    const analyticsCharts = new AnalyticsCharts();
    
    // Make available globally
    window.AnalyticsCharts = AnalyticsCharts;
    window.analyticsCharts = analyticsCharts;
    
    console.log('✅ AnalyticsCharts loaded and available globally');
}

// Ensure no duplicate global instance
if (!window.analyticsChartsInstance) {
    window.analyticsChartsInstance = window.analyticsCharts;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // If charts instance exists, verify it's working
    if (window.analyticsCharts) {
        console.log('✅ AnalyticsCharts ready');
    } else {
        console.error('❌ AnalyticsCharts not initialized');
    }
});

// Export for module systems if needed (will be ignored in browser)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AnalyticsCharts, analyticsCharts: window.analyticsCharts };
}