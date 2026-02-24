// map_dashboard.js - COMPLETE ENHANCED VERSION WITH FULL ANALYTICS INTEGRATION
// ============================================================================
// GLOBAL VARIABLES
// ============================================================================
// ============================================================================
// ULTIMATE DEBUG - RUNS NO MATTER WHAT
// ============================================================================

console.log('🚀 DEBUG: Script starting');

// This will run repeatedly until it finds the button
(function findButton() {
    const btn = document.getElementById('analysis-dropdown-btn');
    if (btn) {
        console.log('✅ DEBUG: Found analysis button!');
        console.log('Button HTML:', btn.outerHTML);
        
        // Add direct click handler that logs
        btn.addEventListener('click', function(e) {
            console.log('🎯🎯🎯 BUTTON CLICK DETECTED 🎯🎯🎯');
            console.log('Event:', e);
            console.log('Button classes:', this.className);
            
            const content = document.getElementById('analysis-dropdown-content');
            console.log('Content element:', content);
            
            if (content) {
                console.log('Content classes before:', content.className);
                console.log('Content display before:', window.getComputedStyle(content).display);
                
                // Force show it
                content.classList.add('show');
                console.log('Added show class');
                
                setTimeout(() => {
                    console.log('Content classes after:', content.className);
                    console.log('Content display after:', window.getComputedStyle(content).display);
                    console.log('Content visibility after:', window.getComputedStyle(content).visibility);
                }, 100);
            }
            
            e.preventDefault();
            e.stopPropagation();
        }, true); // Use capture to ensure it runs first
    } else {
        console.log('⏳ DEBUG: Waiting for button...');
        setTimeout(findButton, 500);
    }
})();

let map;
let countiesLayer, subcountiesLayer, wardsLayer;
let waterPointsLayer, boreholesLayer;
let heatLayer = null;
let markerClusterGroup = null;
let waterPointsMarkers = [];
let boreholesMarkers = [];
let drawControl, measureControl;
let selectedCounty = 'all';
let selectedSubcounty = 'all';
let selectedWard = 'all';
let selectedStatus = 'all';
let selectedModelType = 'all';
let selectedSourceType = 'all';
let yearFrom = '';
let yearTo = '';
let depthFrom = '';
let depthTo = '';
let yieldFrom = '';
let yieldTo = '';
let highlightedFeature = null;
let highlightedFeatureType = null;
let currentBasemap = 'osm';
let drawnItems = new L.FeatureGroup();
let isFullscreen = false;
let waterPointsData = [];
let boreholesData = [];
let waterPointsFiltered = [];
let boreholesFiltered = [];
let currentDisplayMode = 'individual'; // individual, cluster, heatmap
let currentZoom = 7;
let lastRenderedZoom = 7;
let renderTimeout = null;

// Chart instances
let distributionChart = null;
let correlationChart = null;
let qualityEcChart = null;
let qualityPhChart = null;

// Zoom-level simplification variables
const maxPointsAtZoom = {
    1: 100, 2: 200, 3: 300, 4: 400, 5: 500, 6: 750, 7: 1000,
    8: 1500, 9: 2000, 10: 3000, 11: 4000, 12: 5000, 13: 7500,
    14: 10000, 15: 15000, 16: 20000, 17: 25000, 18: 30000
};

// Water points summary
let waterPointsSummary = {
    total: 0,
    functional: 0,
    nonFunctional: 0,
    needsRepair: 0,
    unknown: 0,
    avgYield: 0,
    totalYield: 0
};

// Boreholes summary
let boreholesSummary = {
    total: 0,
    functional: 0,
    nonFunctional: 0,
    needsRepair: 0,
    unknown: 0,
    avgYield: 0,
    totalYield: 0,
    avgDepth: 0,
    avgPh: 0,
    avgEc: 0
};

// Color mapping for different statuses
const statusColors = {
    functional: '#2ecc71',
    'non-functional': '#e74c3c',
    'non_functional': '#e74c3c',
    'needs repair': '#f39c12',
    'needs_repair': '#f39c12',
    'repair': '#f39c12',
    unknown: '#95a5a6',
    default: '#3498db'
};

// Layer visibility
let layerVisibility = {
    counties: true,
    subcounties: false,
    wards: false,
    waterPoints: true,
    boreholes: true
};

// Base maps configuration
const baseMaps = {
    osm: {
        name: 'OpenStreetMap Streets',
        layer: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }),
        icon: 'road'
    },
    satellite: {
        name: 'Satellite Imagery',
        layer: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri',
            maxZoom: 19
        }),
        icon: 'satellite'
    },
    topo: {
        name: 'Topographic Map',
        layer: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenTopoMap',
            maxZoom: 17
        }),
        icon: 'mountain'
    },
    dark: {
        name: 'Dark Theme',
        layer: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '© CartoDB',
            maxZoom: 19
        }),
        icon: 'moon'
    }
};

// Layer styles
const layerStyles = {
    counties: {
        fillColor: '#3b82f6',
        weight: 2,
        opacity: 0.8,
        color: '#2563eb',
        fillOpacity: 0.1,
        className: 'county-boundary'
    },
    subcounties: {
        fillColor: '#14b8a6',
        weight: 1.5,
        opacity: 0.7,
        color: '#0d9488',
        fillOpacity: 0.05,
        className: 'subcounty-boundary'
    },
    wards: {
        fillColor: '#f97316',
        weight: 1,
        opacity: 0.6,
        color: '#ea580c',
        fillOpacity: 0.03,
        className: 'ward-boundary'
    }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

function initMap() {
    console.log('Initializing map with enhanced analytics features...');
    
    // Create map instance
    map = L.map('map', {
        center: [0.5, 37.5],
        zoom: 7,
        zoomControl: false,
        preferCanvas: true,
        fullscreenControl: true
    });
    
    // Add default base map
    baseMaps.osm.layer.addTo(map);
    
    // Initialize layer groups
    countiesLayer = L.layerGroup().addTo(map);
    subcountiesLayer = L.layerGroup();
    wardsLayer = L.layerGroup();
    waterPointsLayer = L.layerGroup();
    boreholesLayer = L.layerGroup();
    
    // Initialize marker cluster group
    markerClusterGroup = L.markerClusterGroup({
        disableClusteringAtZoom: 10,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: true,
        zoomToBoundsOnClick: true
    });
    
    // Add drawn items layer
    drawnItems.addTo(map);
    
    // Initialize controls
    initControls();
    
    // Add scale control
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
    
    // Load initial data
    loadCounties('all');
    
    // Setup all event handlers
    setupEventHandlers();
    setupDropdowns();
    setupLayerToggles();
    setupMapTools();
    setupDisplayOptions();
    setupAllDropdowns(); // Single function to setup all dropdowns
    setupAnalysisTools();
    
    // Setup zoom end handler for simplification
    map.on('zoomend', function() {
        currentZoom = map.getZoom();
        scheduleSimplifiedRender();
    });
    
    // Load initial data
    setTimeout(() => {
        loadWaterPoints('all', 'all', 'all', 'all');
        loadBoreholes('all', 'all', 'all');
    }, 1000);
    
    // Show notification
    showNotification('Map Initialized', 'Loading water points and boreholes data...', 'info');
    
    // Dispatch event that map is ready
    document.dispatchEvent(new CustomEvent('map:initialized'));
}

function initControls() {
    try {
        measureControl = new L.Control.Measure({
            position: 'topleft',
            primaryLengthUnit: 'kilometers',
            secondaryLengthUnit: 'meters',
            primaryAreaUnit: 'sqkilometers',
            secondaryAreaUnit: 'hectares',
            activeColor: '#10b981',
            completedColor: '#059669'
        });
        map.addControl(measureControl);
    } catch (e) {
        console.warn('Measure control not available:', e);
    }
    
    try {
        drawControl = new L.Control.Draw({
            position: 'topleft',
            draw: {
                polyline: false,
                polygon: {
                    allowIntersection: false,
                    drawError: {
                        color: '#ef4444',
                        message: '<strong>Error:</strong> Shape edges cannot cross!'
                    },
                    shapeOptions: {
                        color: '#ec4899',
                        fillColor: '#ec4899',
                        fillOpacity: 0.2
                    }
                },
                circle: false,
                rectangle: {
                    shapeOptions: {
                        color: '#8b5cf6',
                        fillColor: '#8b5cf6',
                        fillOpacity: 0.2
                    }
                },
                marker: false
            },
            edit: {
                featureGroup: drawnItems,
                remove: true
            }
        });
        map.addControl(drawControl);
    } catch (e) {
        console.warn('Draw control not available:', e);
    }
}

// ============================================================================
// DROPDOWN MENU FUNCTIONALITY - SINGLE SOURCE OF TRUTH
// ============================================================================

function setupAllDropdowns() {
    console.log('🔵 SETUP: Setting up all dropdown menus...');
    
    // Get all dropdown buttons and content
    const dropdowns = [
        { btn: 'layers-dropdown-btn', content: 'layers-dropdown-content' },
        { btn: 'tools-dropdown-btn', content: 'tools-dropdown-content' },
        { btn: 'basemaps-dropdown-btn', content: 'basemaps-dropdown-content' },
        { btn: 'analysis-dropdown-btn', content: 'analysis-dropdown-content' }
    ];
    
    // Check if elements exist
    dropdowns.forEach(d => {
        const btn = document.getElementById(d.btn);
        const content = document.getElementById(d.content);
        console.log(`🔍 CHECK: ${d.btn} exists:`, !!btn);
        console.log(`🔍 CHECK: ${d.content} exists:`, !!content);
        if (btn) console.log(`🔍 BTN HTML:`, btn.outerHTML);
        if (content) console.log(`🔍 CONTENT HTML:`, content.outerHTML);
    });
    
    // Close all dropdowns function
    function closeAllDropdowns() {
        console.log('🟡 Closing all dropdowns');
        dropdowns.forEach(d => {
            const content = document.getElementById(d.content);
            if (content && content.classList.contains('show')) {
                console.log(`   Closing: ${d.content}`);
                content.classList.remove('show');
            }
        });
        
        document.querySelectorAll('.control-dropdown-btn .fa-chevron-down').forEach(chevron => {
            chevron.style.transform = 'rotate(0)';
        });
    }
    
    // Setup each dropdown
    dropdowns.forEach(d => {
        const btn = document.getElementById(d.btn);
        const content = document.getElementById(d.content);
        
        if (btn && content) {
            console.log(`✅ Setting up: ${d.btn}`);
            
            // Remove any existing listeners
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                console.log(`🟢 CLICKED: ${d.btn}`);
                console.log(`   Current classes:`, content.className);
                console.log(`   Has 'show' class:`, content.classList.contains('show'));
                
                // If this dropdown is already open, close it
                if (content.classList.contains('show')) {
                    console.log(`   Closing ${d.btn}`);
                    content.classList.remove('show');
                    const chevron = this.querySelector('.fa-chevron-down');
                    if (chevron) chevron.style.transform = 'rotate(0)';
                    
                    // Verify it closed
                    setTimeout(() => {
                        console.log(`   VERIFY: After closing, has 'show' class:`, content.classList.contains('show'));
                        console.log(`   Computed display:`, window.getComputedStyle(content).display);
                    }, 100);
                    return;
                }
                
                // Close all other dropdowns
                console.log(`   Closing all other dropdowns`);
                closeAllDropdowns();
                
                // Open this dropdown
                console.log(`   Opening ${d.btn}`);
                content.classList.add('show');
                console.log(`   After adding 'show' class:`, content.className);
                
                // Check computed style
                setTimeout(() => {
                    const style = window.getComputedStyle(content);
                    console.log(`   VERIFY: Computed display:`, style.display);
                    console.log(`   VERIFY: Visibility:`, style.visibility);
                    console.log(`   VERIFY: Opacity:`, style.opacity);
                    console.log(`   VERIFY: Position:`, style.position);
                    console.log(`   VERIFY: Z-index:`, style.zIndex);
                    
                    // Check if any parent is hiding it
                    let parent = content.parentElement;
                    let level = 0;
                    while (parent && level < 5) {
                        const parentStyle = window.getComputedStyle(parent);
                        if (parentStyle.display === 'none') {
                            console.log(`   ⚠️ PARENT ${level} is hiding it: display=none`);
                        }
                        if (parentStyle.visibility === 'hidden') {
                            console.log(`   ⚠️ PARENT ${level} is hiding it: visibility=hidden`);
                        }
                        if (parentStyle.opacity === '0') {
                            console.log(`   ⚠️ PARENT ${level} is hiding it: opacity=0`);
                        }
                        parent = parent.parentElement;
                        level++;
                    }
                }, 100);
                
                // Update chevron
                const chevron = this.querySelector('.fa-chevron-down');
                if (chevron) {
                    chevron.style.transform = 'rotate(180deg)';
                }
            });
        }
    });
    
    // Close on outside click
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.control-dropdown')) {
            console.log('🔴 Outside click detected - closing all');
            closeAllDropdowns();
        }
    });
    
    console.log('🔵 SETUP: Dropdown setup complete');
}

function setupBasemapOptions() {
    const basemapOptions = document.querySelectorAll('.basemap-option-dropdown');
    
    basemapOptions.forEach(option => {
        option.addEventListener('click', function() {
            const basemapType = this.dataset.basemap;
            
            basemapOptions.forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');
            
            changeBasemap(basemapType);
            
            // Close the basemaps dropdown
            const basemapsContent = document.getElementById('basemaps-dropdown-content');
            if (basemapsContent) basemapsContent.classList.remove('show');
        });
    });
}

function changeBasemap(basemapType) {
    if (currentBasemap === basemapType) return;
    
    map.removeLayer(baseMaps[currentBasemap].layer);
    baseMaps[basemapType].layer.addTo(map);
    currentBasemap = basemapType;
    
    showNotification('Basemap Changed', `Switched to ${baseMaps[basemapType].name}`, 'success');
}

function setupToolButtons() {
    const toolButtons = [
        { id: 'tool-measure-dropdown', handler: toggleMeasure },
        { id: 'tool-draw-dropdown', handler: startDrawing },
        { id: 'tool-clear-dropdown', handler: clearLayers },
        { id: 'tool-print-dropdown', handler: () => window.print() },
        { id: 'tool-export-dropdown', handler: openExportModal },
        { id: 'tool-refresh-dropdown', handler: refreshData },
        { id: 'tool-search-dropdown', handler: openSearchModal },
        { id: 'tool-buffer-dropdown', handler: openBufferModal },
        { id: 'tool-anomaly-dropdown', handler: openAnomalyModal }
    ];
    
    toolButtons.forEach(item => {
        const btn = document.getElementById(item.id);
        if (btn) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Close all dropdowns
                closeAllDropdowns();
                
                // Call the handler
                item.handler();
            });
        }
    });
}

function toggleMeasure() {
    if (measureControl) {
        if (map.hasControl(measureControl)) {
            map.removeControl(measureControl);
        } else {
            map.addControl(measureControl);
        }
    }
}

function startDrawing() {
    if (drawControl) {
        new L.Draw.Polygon(map, drawControl.options.polygon).enable();
    }
}

function clearLayers() {
    drawnItems.clearLayers();
    if (heatLayer) {
        map.removeLayer(heatLayer);
        heatLayer = null;
    }
    showNotification('Cleared', 'All layers cleared', 'info');
}

function closeAllDropdowns() {
    const dropdownContents = document.querySelectorAll('.control-dropdown-content');
    dropdownContents.forEach(content => {
        content.classList.remove('show');
    });
    
    // Reset all chevrons
    document.querySelectorAll('.control-dropdown-btn .fa-chevron-down').forEach(chevron => {
        chevron.style.transform = 'rotate(0)';
    });
}

function setupAnalysisDropdownButtons() {
    // Map analysis buttons to their respective modal open functions
    const analysisButtons = [
        { id: 'btn-heatmap-dropdown', handler: openHeatmapModal },
        { id: 'btn-cluster-dropdown', handler: openClusterModal },
        { id: 'btn-distribution-dropdown', handler: openDistributionModal },
        { id: 'btn-buffer-dropdown', handler: openBufferModal },
        { id: 'btn-correlation-dropdown', handler: openCorrelationModal },
        { id: 'btn-water-quality-dropdown', handler: openWaterQualityModal }
    ];
    
    analysisButtons.forEach(item => {
        const btn = document.getElementById(item.id);
        if (btn) {
            // Remove any existing listeners by cloning and replacing
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                console.log(`Analysis button clicked: ${item.id}`); // Debug log
                
                // Close the analysis dropdown
                const analysisContent = document.getElementById('analysis-dropdown-content');
                if (analysisContent) {
                    analysisContent.classList.remove('show');
                    
                    // Reset chevron
                    const analysisBtn = document.getElementById('analysis-dropdown-btn');
                    if (analysisBtn) {
                        const chevron = analysisBtn.querySelector('.fa-chevron-down');
                        if (chevron) chevron.style.transform = 'rotate(0)';
                    }
                }
                
                // Open the modal
                item.handler();
            });
        } else {
            console.warn(`Analysis button not found: ${item.id}`);
        }
    });
}

// ============================================================================
// ANALYSIS TOOLS SETUP
// ============================================================================

function setupAnalysisTools() {
    // This is for the main analysis buttons (not dropdown)
    const analysisButtons = [
        { id: 'btn-heatmap', handler: openHeatmapModal },
        { id: 'btn-cluster', handler: openClusterModal },
        { id: 'btn-distribution', handler: openDistributionModal },
        { id: 'btn-buffer', handler: openBufferModal },
        { id: 'btn-correlation', handler: openCorrelationModal },
        { id: 'btn-water-quality', handler: openWaterQualityModal }
    ];
    
    analysisButtons.forEach(item => {
        const btn = document.getElementById(item.id);
        if (btn) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                item.handler();
            });
        }
    });
}

// ============================================================================
// MODAL FUNCTIONS
// ============================================================================

function openSearchModal() {
    const modal = document.getElementById('searchModal');
    if (modal) {
        modal.style.display = 'block';
        
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.focus();
            searchInput.addEventListener('keyup', function(e) {
                if (e.key === 'Enter') {
                    performSearch(this.value);
                }
            });
        }
        
        const searchButton = document.getElementById('search-button');
        if (searchButton) {
            searchButton.addEventListener('click', function() {
                const input = document.getElementById('search-input');
                if (input) performSearch(input.value);
            });
        }
    }
}

async function performSearch(query) {
    if (!query || query.length < 2) {
        showNotification('Search Error', 'Please enter at least 2 characters', 'warning');
        return;
    }
    
    showNotification('Searching', `Searching for "${query}"...`, 'info');
    
    try {
        const response = await fetch(`/api/search/?q=${encodeURIComponent(query)}&model_type=${selectedModelType}`);
        const data = await response.json();
        
        displaySearchResults(data.results || []);
    } catch (error) {
        console.error('Search error:', error);
        showNotification('Search Error', 'Failed to perform search', 'error');
    }
}

function displaySearchResults(results) {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;
    
    if (results.length === 0) {
        resultsContainer.innerHTML = '<p style="text-align: center; color: #666;">No results found</p>';
        return;
    }
    
    let html = '<div style="max-height: 300px; overflow-y: auto;">';
    
    results.forEach(result => {
        const typeIcon = result.type === 'water_point' ? 'fa-droplet' : 'fa-water';
        const typeColor = result.type === 'water_point' ? '#8b5cf6' : '#10b981';
        
        html += `
            <div class="search-result-item" onclick="zoomToPoint(${result.id}, '${result.type}')" style="
                padding: 10px;
                border-bottom: 1px solid #e2e8f0;
                cursor: pointer;
                transition: background 0.2s;
            " onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <div style="display: flex; align-items: center;">
                    <i class="fas ${typeIcon}" style="color: ${typeColor}; margin-right: 10px; width: 20px;"></i>
                    <div>
                        <strong>${result.name}</strong>
                        <div style="font-size: 12px; color: #666;">
                            ${result.county || ''} ${result.subcounty ? '• ' + result.subcounty : ''}
                            ${result.status ? '• Status: ' + result.status : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    resultsContainer.innerHTML = html;
}

function openExportModal() {
    const modal = document.getElementById('exportModal');
    if (modal) {
        modal.style.display = 'block';
        
        // Setup export format buttons
        const exportBtns = document.querySelectorAll('.export-btn');
        exportBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                exportBtns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            });
        });
        
        const downloadBtn = document.getElementById('export-download-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', performExport);
        }
    }
}

function performExport() {
    const format = document.querySelector('.export-btn.active')?.dataset.format || 'geojson';
    const exportWater = document.getElementById('export-water-points')?.checked || true;
    const exportBoreholes = document.getElementById('export-boreholes')?.checked || true;
    const exportBoundaries = document.getElementById('export-boundaries')?.checked || false;
    const exportSummary = document.getElementById('export-summary')?.checked || false;
    const exportAnomalies = document.getElementById('export-anomalies')?.checked || false;
    
    let boundaryType = 'all';
    if (selectedWard !== 'all') {
        boundaryType = 'ward';
    } else if (selectedSubcounty !== 'all') {
        boundaryType = 'subcounty';
    } else if (selectedCounty !== 'all') {
        boundaryType = 'county';
    }
    
    let boundaryId = 'all';
    if (boundaryType === 'ward') boundaryId = selectedWard;
    else if (boundaryType === 'subcounty') boundaryId = selectedSubcounty;
    else if (boundaryType === 'county') boundaryId = selectedCounty;
    
    let url = `/api/export/geojson/${boundaryType}/${boundaryId}/?model_type=`;
    if (exportWater && exportBoreholes) {
        url += 'all';
    } else if (exportWater) {
        url += 'waterpoints';
    } else if (exportBoreholes) {
        url += 'boreholes';
    } else {
        url += 'all';
    }
    
    if (exportBoundaries) {
        url += '&include_boundaries=true';
    }
    
    if (format !== 'geojson') {
        url += `&format=${format}`;
    }
    
    if (exportSummary) {
        url += '&include_summary=true';
    }
    
    window.location.href = url;
    
    showNotification('Export Started', 'Your file is being prepared...', 'info');
    
    document.getElementById('exportModal').style.display = 'none';
}

function openBufferModal() {
    const modal = document.getElementById('bufferModal');
    if (modal) {
        modal.style.display = 'block';
        
        const applyBtn = document.getElementById('apply-buffer-btn');
        if (applyBtn) {
            applyBtn.addEventListener('click', applyBufferAnalysis);
        }
        
        const radiusInput = document.getElementById('heatmap-radius');
        const radiusValue = document.getElementById('heatmap-radius-value');
        if (radiusInput && radiusValue) {
            radiusInput.addEventListener('input', function() {
                radiusValue.textContent = this.value;
            });
        }
        
        const blurInput = document.getElementById('heatmap-blur');
        const blurValue = document.getElementById('heatmap-blur-value');
        if (blurInput && blurValue) {
            blurInput.addEventListener('input', function() {
                blurValue.textContent = this.value;
            });
        }
        
        const opacityInput = document.getElementById('heatmap-opacity');
        const opacityValue = document.getElementById('heatmap-opacity-value');
        if (opacityInput && opacityValue) {
            opacityInput.addEventListener('input', function() {
                opacityValue.textContent = this.value;
            });
        }
    }
}

function applyBufferAnalysis() {
    const distance = parseFloat(document.getElementById('buffer-distance')?.value) || 5;
    const location = document.getElementById('buffer-location')?.value || 'click';
    const analysisType = document.getElementById('buffer-analysis-type')?.value || 'count';
    
    if (location === 'click') {
        map.once('click', function(e) {
            createBuffer(e.latlng, distance, analysisType);
        });
        showNotification('Buffer Analysis', `Click on the map to set buffer center at ${distance}km`, 'info');
        document.getElementById('bufferModal').style.display = 'none';
    } else if (location === 'current') {
        const center = map.getCenter();
        createBuffer(center, distance, analysisType);
        document.getElementById('bufferModal').style.display = 'none';
    }
}

function createBuffer(center, distanceKm, analysisType) {
    const circle = L.circle(center, {
        radius: distanceKm * 1000,
        color: '#10b981',
        weight: 2,
        fillColor: '#10b981',
        fillOpacity: 0.1
    }).addTo(drawnItems);
    
    // Count points in buffer
    let count = 0;
    let waterCount = 0;
    let boreholeCount = 0;
    let functionalCount = 0;
    let totalYield = 0;
    
    waterPointsFiltered.forEach(point => {
        if (point.geometry && point.geometry.coordinates) {
            const latlng = L.latLng(point.geometry.coordinates[1], point.geometry.coordinates[0]);
            const distance = map.distance(center, latlng) / 1000; // Convert to km
            
            if (distance <= distanceKm) {
                count++;
                waterCount++;
                
                const status = point.properties?.status_cle || '';
                if (status.toLowerCase().includes('functional') && !status.toLowerCase().includes('non')) {
                    functionalCount++;
                }
            }
        }
    });
    
    boreholesFiltered.forEach(point => {
        if (point.geometry && point.geometry.coordinates) {
            const latlng = L.latLng(point.geometry.coordinates[1], point.geometry.coordinates[0]);
            const distance = map.distance(center, latlng) / 1000;
            
            if (distance <= distanceKm) {
                count++;
                boreholeCount++;
                
                const yield_val = point.properties?.yield_value;
                if (yield_val) totalYield += yield_val;
                
                const status = point.properties?.operation_field || '';
                if (status.toLowerCase().includes('functional') && !status.toLowerCase().includes('non')) {
                    functionalCount++;
                }
            }
        }
    });
    
    if (analysisType === 'count') {
        showNotification('Buffer Analysis', 
            `Found ${count} points within ${distanceKm}km buffer (${waterCount} water, ${boreholeCount} boreholes)`, 
            'success');
    } else if (analysisType === 'summary') {
        const html = `
            <div style="padding: 15px;">
                <h4 style="margin-top: 0;">Buffer Analysis Results</h4>
                <p><strong>Center:</strong> ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}</p>
                <p><strong>Radius:</strong> ${distanceKm} km</p>
                <p><strong>Total Points:</strong> ${count}</p>
                <p><strong>Water Points:</strong> ${waterCount}</p>
                <p><strong>Boreholes:</strong> ${boreholeCount}</p>
                <p><strong>Functional:</strong> ${functionalCount}</p>
                <p><strong>Functional %:</strong> ${count > 0 ? ((functionalCount/count)*100).toFixed(1) : 0}%</p>
                <p><strong>Total Yield:</strong> ${totalYield.toFixed(1)} m³/h</p>
            </div>
        `;
        
        const infoContent = document.getElementById('infoContent');
        const infoTitle = document.getElementById('infoTitle');
        if (infoContent && infoTitle) {
            infoTitle.textContent = 'Buffer Analysis Results';
            infoContent.innerHTML = html;
            document.getElementById('infoPanel').classList.add('active');
        }
    }
}

function openHeatmapModal() {
    const modal = document.getElementById('heatmapModal');
    if (modal) {
        modal.style.display = 'block';
        
        const applyBtn = document.getElementById('apply-heatmap-btn');
        if (applyBtn) {
            applyBtn.addEventListener('click', generateHeatmap);
        }
    }
}

function generateHeatmap() {
    const metric = document.getElementById('heatmap-metric')?.value || 'density';
    const radius = parseInt(document.getElementById('heatmap-radius')?.value) || 25;
    const blur = parseInt(document.getElementById('heatmap-blur')?.value) || 15;
    const opacity = parseFloat(document.getElementById('heatmap-opacity')?.value) || 0.8;
    
    // Remove existing heat layer
    if (heatLayer) {
        map.removeLayer(heatLayer);
    }
    
    // Prepare heat data
    const heatData = [];
    
    if (metric === 'density') {
        // Density-based heatmap
        waterPointsFiltered.forEach(point => {
            if (point.geometry && point.geometry.coordinates) {
                heatData.push([
                    point.geometry.coordinates[1],
                    point.geometry.coordinates[0],
                    1.0
                ]);
            }
        });
        
        boreholesFiltered.forEach(point => {
            if (point.geometry && point.geometry.coordinates) {
                heatData.push([
                    point.geometry.coordinates[1],
                    point.geometry.coordinates[0],
                    0.8
                ]);
            }
        });
    } else if (metric === 'functionality') {
        // Functionality-based heatmap
        waterPointsFiltered.forEach(point => {
            if (point.geometry && point.geometry.coordinates) {
                const status = point.properties?.status_cle || '';
                let intensity = 0.5;
                
                if (status.toLowerCase().includes('functional') && !status.toLowerCase().includes('non')) {
                    intensity = 1.0;
                } else if (status.toLowerCase().includes('repair')) {
                    intensity = 0.7;
                } else if (status.toLowerCase().includes('non')) {
                    intensity = 0.3;
                }
                
                heatData.push([
                    point.geometry.coordinates[1],
                    point.geometry.coordinates[0],
                    intensity
                ]);
            }
        });
    } else if (metric === 'yield') {
        // Yield-based heatmap
        boreholesFiltered.forEach(point => {
            if (point.geometry && point.geometry.coordinates) {
                const yield_val = point.properties?.yield_value || 0;
                let intensity = Math.min(1.0, yield_val / 50); // Normalize to max 50 m³/h
                
                heatData.push([
                    point.geometry.coordinates[1],
                    point.geometry.coordinates[0],
                    intensity
                ]);
            }
        });
    }
    
    if (heatData.length > 0) {
        heatLayer = L.heatLayer(heatData, {
            radius: radius,
            blur: blur,
            maxZoom: 17,
            max: 1.0,
            minOpacity: opacity,
            gradient: {
                0.2: '#313695',
                0.4: '#4575b4',
                0.6: '#74add1',
                0.8: '#abd9e9',
                1.0: '#fee090'
            }
        }).addTo(map);
        
        showNotification('Heatmap Generated', `Heatmap with ${heatData.length} points created`, 'success');
    } else {
        showNotification('Heatmap Error', 'No data available for heatmap', 'warning');
    }
    
    document.getElementById('heatmapModal').style.display = 'none';
}

function openClusterModal() {
    const modal = document.getElementById('clusterModal');
    if (modal) {
        modal.style.display = 'block';
        
        const applyBtn = document.getElementById('apply-cluster-btn');
        if (applyBtn) {
            applyBtn.addEventListener('click', performClusterAnalysis);
        }
    }
}

async function performClusterAnalysis() {
    const clusterCount = parseInt(document.getElementById('cluster-count')?.value) || 5;
    const clusterMetric = document.getElementById('cluster-metric')?.value || 'location';
    const clusterDataset = document.getElementById('cluster-dataset')?.value || 'both';
    
    showNotification('Cluster Analysis', 'Running cluster analysis...', 'info');
    
    try {
        const countyParam = selectedCounty !== 'all' ? `&county_id=${selectedCounty}` : '';
        const url = `/api/analytics/clustering/?n_clusters=${clusterCount}${countyParam}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.clusters) {
            displayClusters(data.clusters);
            showNotification('Cluster Analysis', `Found ${data.clusters.length} clusters`, 'success');
        }
    } catch (error) {
        console.error('Cluster analysis error:', error);
        showNotification('Cluster Analysis', 'Failed to perform cluster analysis', 'error');
    }
    
    document.getElementById('clusterModal').style.display = 'none';
}

function displayClusters(clusters) {
    // Clear previous clusters
    drawnItems.clearLayers();
    
    clusters.forEach(cluster => {
        const center = cluster.center;
        const size = cluster.size;
        
        // Draw cluster center
        L.circleMarker([center.lat, center.lng], {
            radius: Math.min(20, 10 + size / 10),
            fillColor: '#f97316',
            color: '#ffffff',
            weight: 2,
            fillOpacity: 0.8
        }).addTo(drawnItems)
          .bindPopup(`<b>Cluster ${cluster.id}</b><br>Size: ${size} points`);
        
        // Draw cluster points (sample)
        if (cluster.points) {
            cluster.points.forEach(point => {
                L.circleMarker([point.lat, point.lng], {
                    radius: 3,
                    fillColor: '#f97316',
                    color: '#ffffff',
                    weight: 1,
                    fillOpacity: 0.5
                }).addTo(drawnItems);
            });
        }
    });
    
    // Fit map to show all clusters
    if (clusters.length > 0) {
        const bounds = drawnItems.getBounds();
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }
}

function openDistributionModal() {
    const modal = document.getElementById('distributionModal');
    if (modal) {
        modal.style.display = 'block';
        
        const generateBtn = document.getElementById('generate-distribution-btn');
        if (generateBtn) {
            generateBtn.addEventListener('click', generateDistribution);
        }
    }
}

async function generateDistribution() {
    const metric = document.getElementById('distribution-metric')?.value || 'depth';
    const bins = parseInt(document.getElementById('distribution-bins')?.value) || 20;
    
    showNotification('Distribution Analysis', 'Generating distribution...', 'info');
    
    try {
        const countyParam = selectedCounty !== 'all' ? `&county_id=${selectedCounty}` : '';
        const url = `/api/analytics/distribution/?metric=${metric}&bins=${bins}${countyParam}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.distribution) {
            displayDistribution(data, metric);
        }
    } catch (error) {
        console.error('Distribution analysis error:', error);
        showNotification('Distribution Analysis', 'Failed to generate distribution', 'error');
    }
}

function displayDistribution(data, metric) {
    const distribution = data.distribution;
    const stats = data.statistics;
    
    if (!distribution || distribution.length === 0) {
        showNotification('Distribution Analysis', 'No data available', 'warning');
        return;
    }
    
    // Destroy existing chart
    if (distributionChart) {
        distributionChart.destroy();
    }
    
    // Prepare data
    const labels = distribution.map(d => d.range);
    const values = distribution.map(d => d.count);
    
    // Create chart
    const ctx = document.getElementById('distribution-chart').getContext('2d');
    distributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: `Distribution of ${metric}`,
                data: values,
                backgroundColor: 'rgba(46, 189, 176, 0.5)',
                borderColor: '#0e9e8f',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: true }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Count' }
                },
                x: {
                    title: { display: true, text: metric.charAt(0).toUpperCase() + metric.slice(1) }
                }
            }
        }
    });
    
    // Display statistics
    const statsHtml = `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 20px;">
            <div class="stat-card">
                <div class="stat-label">Mean</div>
                <div class="stat-value">${stats.mean?.toFixed(2) || 'N/A'}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Median</div>
                <div class="stat-value">${stats.median?.toFixed(2) || 'N/A'}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Std Dev</div>
                <div class="stat-value">${stats.std?.toFixed(2) || 'N/A'}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Range</div>
                <div class="stat-value">${stats.min?.toFixed(2) || 'N/A'} - ${stats.max?.toFixed(2) || 'N/A'}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Q1</div>
                <div class="stat-value">${stats.q1?.toFixed(2) || 'N/A'}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Q3</div>
                <div class="stat-value">${stats.q3?.toFixed(2) || 'N/A'}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Samples</div>
                <div class="stat-value">${data.total_samples || 0}</div>
            </div>
        </div>
    `;
    
    document.getElementById('distribution-stats').innerHTML = statsHtml;
}

function openCorrelationModal() {
    const modal = document.getElementById('correlationModal');
    if (modal) {
        modal.style.display = 'block';
        
        const calculateBtn = document.getElementById('calculate-correlation-btn');
        if (calculateBtn) {
            calculateBtn.addEventListener('click', calculateCorrelation);
        }
    }
}

async function calculateCorrelation() {
    const varX = document.getElementById('correlation-var-x')?.value || 'depth';
    const varY = document.getElementById('correlation-var-y')?.value || 'yield';
    
    showNotification('Correlation Analysis', 'Calculating correlation...', 'info');
    
    try {
        const countyParam = selectedCounty !== 'all' ? `&county_id=${selectedCounty}` : '';
        const url = `/api/analytics/correlation/?var_x=${varX}&var_y=${varY}${countyParam}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.data) {
            displayCorrelation(data, varX, varY);
        }
    } catch (error) {
        console.error('Correlation analysis error:', error);
        showNotification('Correlation Analysis', 'Failed to calculate correlation', 'error');
    }
}

function displayCorrelation(data, varX, varY) {
    const points = data.data;
    const correlation = data.correlation;
    
    if (points.length === 0) {
        showNotification('Correlation Analysis', 'No data available', 'warning');
        return;
    }
    
    // Destroy existing chart
    if (correlationChart) {
        correlationChart.destroy();
    }
    
    // Prepare data
    const xValues = points.map(p => p.x);
    const yValues = points.map(p => p.y);
    
    // Create scatter plot
    const ctx = document.getElementById('correlation-chart').getContext('2d');
    correlationChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: `${varX} vs ${varY}`,
                data: points.map(p => ({ x: p.x, y: p.y })),
                backgroundColor: 'rgba(46, 189, 176, 0.6)',
                borderColor: '#0e9e8f',
                borderWidth: 1,
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.raw.x.toFixed(2)}, ${context.raw.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: varX.charAt(0).toUpperCase() + varX.slice(1) }
                },
                y: {
                    title: { display: true, text: varY.charAt(0).toUpperCase() + varY.slice(1) }
                }
            }
        }
    });
    
    // Determine correlation strength
    let strength = 'No correlation';
    let color = '#666';
    
    if (Math.abs(correlation) > 0.7) {
        strength = 'Strong';
        color = '#10b981';
    } else if (Math.abs(correlation) > 0.5) {
        strength = 'Moderate';
        color = '#f59e0b';
    } else if (Math.abs(correlation) > 0.3) {
        strength = 'Weak';
        color = '#ef4444';
    }
    
    const direction = correlation > 0 ? 'Positive' : correlation < 0 ? 'Negative' : 'No';
    
    // Display statistics
    const statsHtml = `
        <div style="margin-top: 20px;">
            <div class="stat-card" style="text-align: center;">
                <div class="stat-label">Correlation Coefficient</div>
                <div class="stat-value" style="color: ${color};">${correlation.toFixed(3)}</div>
            </div>
            <div class="stat-card" style="text-align: center;">
                <div class="stat-label">Correlation Strength</div>
                <div class="stat-value" style="color: ${color};">${strength} ${direction}</div>
            </div>
            <div class="stat-card" style="text-align: center;">
                <div class="stat-label">Sample Size</div>
                <div class="stat-value">${points.length}</div>
            </div>
        </div>
    `;
    
    document.getElementById('correlation-stats').innerHTML = statsHtml;
}

function openWaterQualityModal() {
    const modal = document.getElementById('waterQualityModal');
    if (modal) {
        modal.style.display = 'block';
        
        const analyzeBtn = document.getElementById('analyze-quality-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', analyzeWaterQuality);
        }
    }
}

async function analyzeWaterQuality() {
    showNotification('Water Quality Analysis', 'Analyzing water quality data...', 'info');
    
    try {
        const countyParam = selectedCounty !== 'all' ? `&county_id=${selectedCounty}` : '';
        const url = `/api/analytics/water-quality/${countyParam}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.ec && data.ph) {
            displayWaterQuality(data);
        }
    } catch (error) {
        console.error('Water quality analysis error:', error);
        showNotification('Water Quality Analysis', 'Failed to analyze water quality', 'error');
    }
}

function displayWaterQuality(data) {
    // Destroy existing charts
    if (qualityEcChart) {
        qualityEcChart.destroy();
    }
    if (qualityPhChart) {
        qualityPhChart.destroy();
    }
    
    // EC Distribution
    if (data.ec.classification) {
        const ecCtx = document.getElementById('quality-ec-chart').getContext('2d');
        qualityEcChart = new Chart(ecCtx, {
            type: 'pie',
            data: {
                labels: ['Excellent (<400)', 'Good (400-800)', 'Fair (800-1500)', 'Poor (>1500)'],
                datasets: [{
                    data: [
                        data.ec.classification.excellent || 0,
                        data.ec.classification.good || 0,
                        data.ec.classification.fair || 0,
                        data.ec.classification.poor || 0
                    ],
                    backgroundColor: ['#2ecc71', '#3498db', '#f39c12', '#e74c3c']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'EC Distribution (µS/cm)' }
                }
            }
        });
    }
    
    // pH Distribution
    if (data.ph.classification) {
        const phCtx = document.getElementById('quality-ph-chart').getContext('2d');
        qualityPhChart = new Chart(phCtx, {
            type: 'pie',
            data: {
                labels: ['Acidic (<6.5)', 'Neutral (6.5-8.5)', 'Alkaline (>8.5)'],
                datasets: [{
                    data: [
                        data.ph.classification.acidic || 0,
                        data.ph.classification.neutral || 0,
                        data.ph.classification.alkaline || 0
                    ],
                    backgroundColor: ['#e74c3c', '#2ecc71', '#3498db']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'pH Distribution' }
                }
            }
        });
    }
    
    // Statistics
    const statsHtml = `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 20px;">
            <div>
                <h4>Electrical Conductivity (µS/cm)</h4>
                <p>Mean: ${data.ec.statistics.mean.toFixed(1)}</p>
                <p>Median: ${data.ec.statistics.median.toFixed(1)}</p>
                <p>Range: ${data.ec.statistics.min.toFixed(1)} - ${data.ec.statistics.max.toFixed(1)}</p>
                <p>Samples: ${data.ec.total_samples}</p>
            </div>
            <div>
                <h4>pH</h4>
                <p>Mean: ${data.ph.statistics.mean.toFixed(2)}</p>
                <p>Median: ${data.ph.statistics.median.toFixed(2)}</p>
                <p>Range: ${data.ph.statistics.min.toFixed(2)} - ${data.ph.statistics.max.toFixed(2)}</p>
                <p>Samples: ${data.ph.total_samples}</p>
            </div>
        </div>
    `;
    
    document.getElementById('quality-stats').innerHTML = statsHtml;
    
    // Classification
    const totalEc = data.ec.classification.excellent + data.ec.classification.good + 
                    data.ec.classification.fair + data.ec.classification.poor;
    const goodEcPct = ((data.ec.classification.excellent + data.ec.classification.good) / totalEc * 100).toFixed(1);
    
    const totalPh = data.ph.classification.acidic + data.ph.classification.neutral + data.ph.classification.alkaline;
    const goodPhPct = (data.ph.classification.neutral / totalPh * 100).toFixed(1);
    
    const classificationHtml = `
        <div style="margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 8px;">
            <h4>Water Quality Summary</h4>
            <p><strong>EC Quality:</strong> ${goodEcPct}% of samples are within acceptable range (<800 µS/cm)</p>
            <p><strong>pH Balance:</strong> ${goodPhPct}% of samples have neutral pH (6.5-8.5)</p>
            <p><strong>Overall Assessment:</strong> ${getWaterQualityRating(data.ec.statistics.mean, data.ph.statistics.mean)}</p>
        </div>
    `;
    
    document.getElementById('quality-classification').innerHTML = classificationHtml;
}

function getWaterQualityRating(avgEc, avgPh) {
    let score = 0;
    
    if (avgEc < 400) score += 3;
    else if (avgEc < 800) score += 2;
    else if (avgEc < 1500) score += 1;
    
    if (avgPh >= 6.5 && avgPh <= 8.5) score += 3;
    else if (avgPh >= 6.0 && avgPh <= 9.0) score += 2;
    else score += 1;
    
    if (score >= 5) return 'Good - Water quality meets standards';
    else if (score >= 3) return 'Fair - Some parameters need attention';
    else return 'Poor - Water quality needs improvement';
}

function openAnomalyModal() {
    const modal = document.getElementById('anomalyModal');
    if (modal) {
        modal.style.display = 'block';
        
        const detectBtn = document.getElementById('detect-anomalies-btn');
        if (detectBtn) {
            detectBtn.addEventListener('click', detectAnomalies);
        }
    }
}

async function detectAnomalies() {
    showNotification('Anomaly Detection', 'Scanning for anomalies...', 'info');
    
    try {
        const countyParam = selectedCounty !== 'all' ? `&county_id=${selectedCounty}` : '';
        const url = `/api/analytics/anomalies/${countyParam}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.anomalies) {
            displayAnomalies(data.anomalies);
        }
    } catch (error) {
        console.error('Anomaly detection error:', error);
        showNotification('Anomaly Detection', 'Failed to detect anomalies', 'error');
    }
}

function displayAnomalies(anomalies) {
    const resultsDiv = document.getElementById('anomaly-results');
    
    if (anomalies.length === 0) {
        resultsDiv.innerHTML = '<p style="text-align: center;">No anomalies detected</p>';
        return;
    }
    
    let html = '<div style="max-height: 400px; overflow-y: auto;">';
    
    anomalies.forEach(anomaly => {
        const severityColor = anomaly.severity === 'high' ? '#e74c3c' :
                             anomaly.severity === 'medium' ? '#f39c12' : '#3498db';
        
        html += `
            <div style="padding: 15px; margin-bottom: 10px; background: #f8fafc; border-left: 4px solid ${severityColor}; border-radius: 4px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <h4 style="margin: 0;">${anomaly.title}</h4>
                    <span style="background: ${severityColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">
                        ${anomaly.severity}
                    </span>
                </div>
                <p style="margin: 10px 0 0;">${anomaly.description}</p>
                ${anomaly.count ? `<p style="margin: 5px 0 0; font-size: 12px; color: #666;">Count: ${anomaly.count}</p>` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    resultsDiv.innerHTML = html;
    
    showNotification('Anomaly Detection', `Found ${anomalies.length} anomalies`, 'warning');
}

// Setup modal close buttons
document.addEventListener('DOMContentLoaded', function() {
    const modalCloses = document.querySelectorAll('.modal-close');
    modalCloses.forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) modal.style.display = 'none';
        });
    });
    
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
});

// ============================================================================
// ZOOM-LEVEL SIMPLIFICATION FUNCTIONS
// ============================================================================

function scheduleSimplifiedRender() {
    if (renderTimeout) {
        clearTimeout(renderTimeout);
    }
    renderTimeout = setTimeout(() => {
        renderSimplifiedPoints();
        renderTimeout = null;
    }, 300);
}

function renderSimplifiedPoints() {
    const newZoom = map.getZoom();
    
    // Handle water points
    if (waterPointsFiltered && waterPointsFiltered.length > 0) {
        const maxPoints = getMaxPointsForZoom(newZoom);
        
        if (waterPointsFiltered.length <= maxPoints) {
            if (lastRenderedZoom !== newZoom || waterPointsMarkers.length !== waterPointsFiltered.length) {
                console.log(`Zoom ${newZoom}: Showing all ${waterPointsFiltered.length} water points`);
                renderWaterPoints(waterPointsFiltered);
            }
        } else {
            console.log(`Zoom ${newZoom}: Simplifying water points from ${waterPointsFiltered.length} to ${maxPoints}`);
            const simplifiedPoints = sampleSpatialPoints(waterPointsFiltered, maxPoints);
            renderWaterPoints(simplifiedPoints);
            updateSimplificationIndicator(waterPointsFiltered.length, simplifiedPoints.length, 'water points');
        }
    }
    
    // Handle boreholes
    if (boreholesFiltered && boreholesFiltered.length > 0) {
        renderBoreholes(boreholesFiltered);
    }
    
    lastRenderedZoom = newZoom;
}

function getMaxPointsForZoom(zoom) {
    const clampedZoom = Math.min(Math.max(Math.floor(zoom), 1), 18);
    return maxPointsAtZoom[clampedZoom] || maxPointsAtZoom[7];
}

function sampleSpatialPoints(points, maxPoints) {
    if (points.length <= maxPoints) return points;
    
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    
    points.forEach(point => {
        if (point.geometry && point.geometry.coordinates) {
            const lng = point.geometry.coordinates[0];
            const lat = point.geometry.coordinates[1];
            minLng = Math.min(minLng, lng);
            maxLng = Math.max(maxLng, lng);
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
        }
    });
    
    const gridSize = Math.ceil(Math.sqrt(maxPoints));
    const lngStep = (maxLng - minLng) / gridSize || 0.1;
    const latStep = (maxLat - minLat) / gridSize || 0.1;
    
    const grid = {};
    
    points.forEach(point => {
        if (point.geometry && point.geometry.coordinates) {
            const lng = point.geometry.coordinates[0];
            const lat = point.geometry.coordinates[1];
            
            const gridX = Math.floor((lng - minLng) / lngStep);
            const gridY = Math.floor((lat - minLat) / latStep);
            const cellKey = `${gridX},${gridY}`;
            
            if (!grid[cellKey]) {
                grid[cellKey] = [];
            }
            grid[cellKey].push(point);
        }
    });
    
    const selected = [];
    const cells = Object.values(grid);
    
    for (let i = cells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    
    const pointsPerCell = Math.ceil(maxPoints / cells.length);
    
    cells.forEach(cellPoints => {
        if (selected.length >= maxPoints) return;
        
        for (let i = cellPoints.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cellPoints[i], cellPoints[j]] = [cellPoints[j], cellPoints[i]];
        }
        
        const takeCount = Math.min(pointsPerCell, cellPoints.length, maxPoints - selected.length);
        for (let i = 0; i < takeCount; i++) {
            selected.push(cellPoints[i]);
        }
    });
    
    if (selected.length < maxPoints) {
        const remainingPoints = points.filter(p => !selected.includes(p));
        const needed = maxPoints - selected.length;
        
        for (let i = 0; i < needed && i < remainingPoints.length; i++) {
            selected.push(remainingPoints[i]);
        }
    }
    
    return selected;
}

function updateSimplificationIndicator(totalPoints, shownPoints, type = 'points') {
    const indicator = document.getElementById('simplification-indicator');
    if (indicator) {
        const percent = Math.round((shownPoints / totalPoints) * 100);
        indicator.innerHTML = `Showing ${shownPoints.toLocaleString()} of ${totalPoints.toLocaleString()} ${type} (${percent}%) at zoom level ${currentZoom}`;
        indicator.style.display = 'block';
        
        setTimeout(() => {
            indicator.style.display = 'none';
        }, 3000);
    }
}

// ============================================================================
// DATA LOADING FUNCTIONS
// ============================================================================

async function loadCounties(countyId = 'all') {
    try {
        let url;
        if (countyId === 'all') {
            url = '/api/counties/?format=geojson';
        } else {
            url = `/api/counties/${countyId}/?format=geojson`;
        }
        
        console.log('Fetching counties from:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        countiesLayer.clearLayers();
        
        if (data.features && data.features.length > 0) {
            L.geoJSON(data, {
                style: layerStyles.counties,
                onEachFeature: onEachCountyFeature
            }).addTo(countiesLayer);
            
            const countyCountElement = document.getElementById('county-count-dropdown');
            if (countyCountElement) {
                countyCountElement.textContent = `${data.features.length} counties`;
            }
            
            if (countyId !== 'all' && data.features.length > 0) {
                try {
                    const bounds = countiesLayer.getBounds();
                    if (bounds && bounds.isValid && bounds.isValid()) {
                        map.fitBounds(bounds, { 
                            padding: [50, 50],
                            maxZoom: 11,
                            animate: true,
                            duration: 1
                        });
                    }
                } catch (e) {
                    console.warn('Could not fit bounds:', e);
                }
            }
        }
    } catch (error) {
        console.error('Error loading counties:', error);
        showNotification('Error', 'Failed to load county boundaries', 'error');
    }
}

async function loadSubcounties(countyId = 'all') {
    try {
        let url;
        if (countyId === 'all') {
            url = '/api/subcounties/?format=geojson';
        } else {
            url = `/api/subcounties/?county_id=${countyId}&format=geojson`;
        }
        
        console.log('Fetching subcounties from:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        subcountiesLayer.clearLayers();
        
        if (data.features && data.features.length > 0) {
            L.geoJSON(data, {
                style: layerStyles.subcounties,
                onEachFeature: onEachSubcountyFeature
            }).addTo(subcountiesLayer);
            
            const subcountyCountElement = document.getElementById('subcounty-count-dropdown');
            if (subcountyCountElement) {
                subcountyCountElement.textContent = `${data.features.length} sub-counties`;
            }
        }
    } catch (error) {
        console.error('Error loading subcounties:', error);
        showNotification('Error', 'Failed to load subcounty boundaries', 'error');
    }
}

async function loadWards(subcountyId = 'all', countyId = 'all') {
    try {
        let url;
        if (subcountyId !== 'all') {
            url = `/api/wards/?subcounty_id=${subcountyId}&format=geojson`;
        } else if (countyId !== 'all') {
            url = `/api/wards/?county_id=${countyId}&format=geojson`;
        } else {
            url = '/api/wards/?format=geojson';
        }
        
        console.log('Fetching wards from:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        wardsLayer.clearLayers();
        
        if (data.features && data.features.length > 0) {
            L.geoJSON(data, {
                style: layerStyles.wards,
                onEachFeature: onEachWardFeature
            }).addTo(wardsLayer);
            
            const wardCountElement = document.getElementById('ward-count-dropdown');
            if (wardCountElement) {
                wardCountElement.textContent = `${data.features.length} wards`;
            }
        }
    } catch (error) {
        console.error('Error loading wards:', error);
        showNotification('Error', 'Failed to load ward boundaries', 'error');
    }
}

// ============================================================================
// WATER POINTS FUNCTIONS
// ============================================================================

async function loadWaterPoints(countyVal = 'all', subcountyVal = 'all', wardVal = 'all', modelType = 'all') {
    if (modelType === 'boreholes') {
        waterPointsLayer.clearLayers();
        waterPointsMarkers = [];
        waterPointsData = [];
        waterPointsFiltered = [];
        updateWaterPointsSummary();
        updateLegendCounts();
        return;
    }
    
    try {
        console.log('Loading water points with params:', { countyVal, subcountyVal, wardVal, modelType });
        showNotification('Loading Water Points', 'Fetching water points data...', 'info');
        
        let url = '/api/waterpoints/?format=geojson';
        
        if (wardVal !== 'all') {
            url += `&ward=${encodeURIComponent(wardVal)}`;
        }
        if (subcountyVal !== 'all') {
            url += `&subcounty=${encodeURIComponent(subcountyVal)}`;
        }
        if (countyVal !== 'all') {
            url += `&county=${encodeURIComponent(countyVal)}`;
        }
        
        console.log('Fetching water points from:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.features) {
            waterPointsData = data.features;
        } else if (Array.isArray(data)) {
            waterPointsData = data.map(item => ({
                type: 'Feature',
                geometry: item.geom,
                properties: item
            }));
        } else {
            waterPointsData = [];
        }
        
        waterPointsFiltered = [...waterPointsData];
        
        // Apply additional filters
        applyAdditionalFilters();
        
        console.log(`Loaded ${waterPointsFiltered.length} water points`);
        
        updateWaterPointsSummary();
        
        currentZoom = map.getZoom();
        renderSimplifiedPoints();
        
        updateWaterPointsCount();
        updateLegendCounts();
        updateQuickStats();
        
        if (waterPointsFiltered.length > 0) {
            showNotification('Water Points Loaded', `Loaded ${waterPointsFiltered.length} water points`, 'success');
            
            setTimeout(() => {
                fitBoundsToPoints();
            }, 500);
        } else {
            showNotification('No Water Points', 'No water points found in the selected area', 'warning');
        }
        
    } catch (error) {
        console.error('Error loading water points:', error);
        showNotification('Loading Error', 'Failed to load water points data. Please try again.', 'error');
    }
}

// ============================================================================
// BOREHOLES FUNCTIONS
// ============================================================================

async function loadBoreholes(countyVal = 'all', subcountyVal = 'all', wardVal = 'all') {
    try {
        console.log('Loading boreholes with params:', { countyVal, subcountyVal, wardVal });
        
        let url = '/api/boreholes/?format=geojson';
        
        if (subcountyVal !== 'all') {
            url += `&locality=${encodeURIComponent(subcountyVal)}`;
        }
        if (countyVal !== 'all') {
            url += `&admin_1=${encodeURIComponent(countyVal)}`;
        }
        
        console.log('Fetching boreholes from:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.features) {
            boreholesData = data.features;
        } else if (Array.isArray(data)) {
            boreholesData = data.map(item => ({
                type: 'Feature',
                geometry: item.geom,
                properties: item
            }));
        } else {
            boreholesData = [];
        }
        
        boreholesFiltered = [...boreholesData];
        
        // Apply additional filters
        applyAdditionalFilters();
        
        console.log(`Loaded ${boreholesFiltered.length} boreholes`);
        
        updateBoreholesSummary();
        renderBoreholes(boreholesFiltered);
        updateBoreholesCount();
        updateQuickStats();
        
    } catch (error) {
        console.error('Error loading boreholes:', error);
    }
}

function applyAdditionalFilters() {
    // Apply source type filter
    if (selectedSourceType !== 'all') {
        waterPointsFiltered = waterPointsFiltered.filter(point => {
            const source = point.properties?.water_sour || '';
            return source.toLowerCase() === selectedSourceType.toLowerCase();
        });
    }
    
    // Apply year range filter
    if (yearFrom) {
        waterPointsFiltered = waterPointsFiltered.filter(point => {
            const year = point.properties?.install_ye;
            return !year || year >= parseInt(yearFrom);
        });
        boreholesFiltered = boreholesFiltered.filter(point => {
            const year = point.properties?.install_ye;
            return !year || year >= parseInt(yearFrom);
        });
    }
    
    if (yearTo) {
        waterPointsFiltered = waterPointsFiltered.filter(point => {
            const year = point.properties?.install_ye;
            return !year || year <= parseInt(yearTo);
        });
        boreholesFiltered = boreholesFiltered.filter(point => {
            const year = point.properties?.install_ye;
            return !year || year <= parseInt(yearTo);
        });
    }
    
    // Apply depth range filter
    if (depthFrom) {
        waterPointsFiltered = waterPointsFiltered.filter(point => {
            const depth = point.properties?.well_depth;
            return !depth || depth >= parseFloat(depthFrom);
        });
        boreholesFiltered = boreholesFiltered.filter(point => {
            const depth = point.properties?.well_depth;
            return !depth || depth >= parseFloat(depthFrom);
        });
    }
    
    if (depthTo) {
        waterPointsFiltered = waterPointsFiltered.filter(point => {
            const depth = point.properties?.well_depth;
            return !depth || depth <= parseFloat(depthTo);
        });
        boreholesFiltered = boreholesFiltered.filter(point => {
            const depth = point.properties?.well_depth;
            return !depth || depth <= parseFloat(depthTo);
        });
    }
    
    // Apply yield range filter
    if (yieldFrom) {
        boreholesFiltered = boreholesFiltered.filter(point => {
            const yield_val = point.properties?.yield_value;
            return !yield_val || yield_val >= parseFloat(yieldFrom);
        });
    }
    
    if (yieldTo) {
        boreholesFiltered = boreholesFiltered.filter(point => {
            const yield_val = point.properties?.yield_value;
            return !yield_val || yield_val <= parseFloat(yieldTo);
        });
    }
    
    // Apply status filter
    if (selectedStatus !== 'all') {
        waterPointsFiltered = waterPointsFiltered.filter(point => {
            const status = point.properties?.status_cle || '';
            return matchesStatus(status, selectedStatus);
        });
        
        boreholesFiltered = boreholesFiltered.filter(point => {
            const status = point.properties?.operation_field || '';
            return matchesStatus(status, selectedStatus);
        });
    }
}

function matchesStatus(status, filter) {
    const statusLower = String(status).toLowerCase();
    
    switch(filter) {
        case 'functional':
            return statusLower.includes('functional') && !statusLower.includes('non');
        case 'non_functional':
            return statusLower.includes('non-functional') || statusLower.includes('non functional');
        case 'needs_repair':
            return statusLower.includes('repair') || statusLower.includes('needs');
        case 'unknown':
            return !status || statusLower === 'unknown' || statusLower === '';
        default:
            return true;
    }
}

function updateWaterPointsSummary() {
    waterPointsSummary = {
        total: waterPointsFiltered.length,
        functional: waterPointsFiltered.filter(p => {
            const status = p.properties?.status_cle || p.properties?.operation_field || '';
            return String(status).toLowerCase().includes('functional') && !String(status).toLowerCase().includes('non');
        }).length,
        nonFunctional: waterPointsFiltered.filter(p => {
            const status = p.properties?.status_cle || p.properties?.operation_field || '';
            return String(status).toLowerCase().includes('non-functional') || 
                   String(status).toLowerCase().includes('non functional');
        }).length,
        needsRepair: waterPointsFiltered.filter(p => {
            const status = p.properties?.status_cle || p.properties?.operation_field || '';
            return String(status).toLowerCase().includes('repair') || 
                   String(status).toLowerCase().includes('needs');
        }).length,
        unknown: waterPointsFiltered.filter(p => {
            const status = p.properties?.status_cle || p.properties?.operation_field || '';
            return !status || String(status).toLowerCase() === 'unknown' || String(status).toLowerCase() === '';
        }).length
    };
}

function updateBoreholesSummary() {
    let totalYield = 0;
    let yieldCount = 0;
    let totalDepth = 0;
    let depthCount = 0;
    let totalPh = 0;
    let phCount = 0;
    let totalEc = 0;
    let ecCount = 0;
    
    boreholesFiltered.forEach(point => {
        const props = point.properties || {};
        
        if (props.yield_value) {
            totalYield += props.yield_value;
            yieldCount++;
        }
        
        if (props.well_depth) {
            totalDepth += props.well_depth;
            depthCount++;
        }
        
        if (props.ph) {
            totalPh += props.ph;
            phCount++;
        }
        
        if (props.ec) {
            totalEc += props.ec;
            ecCount++;
        }
    });
    
    boreholesSummary = {
        total: boreholesFiltered.length,
        functional: boreholesFiltered.filter(p => {
            const status = p.properties?.operation_field || '';
            return String(status).toLowerCase().includes('functional') && !String(status).toLowerCase().includes('non');
        }).length,
        nonFunctional: boreholesFiltered.filter(p => {
            const status = p.properties?.operation_field || '';
            return String(status).toLowerCase().includes('non-functional') || 
                   String(status).toLowerCase().includes('non functional');
        }).length,
        needsRepair: boreholesFiltered.filter(p => {
            const status = p.properties?.operation_field || '';
            return String(status).toLowerCase().includes('repair') || 
                   String(status).toLowerCase().includes('needs');
        }).length,
        unknown: boreholesFiltered.filter(p => {
            const status = p.properties?.operation_field || '';
            return !status || String(status).toLowerCase() === 'unknown' || String(status).toLowerCase() === '';
        }).length,
        avgYield: yieldCount > 0 ? totalYield / yieldCount : 0,
        totalYield: totalYield,
        avgDepth: depthCount > 0 ? totalDepth / depthCount : 0,
        avgPh: phCount > 0 ? totalPh / phCount : 0,
        avgEc: ecCount > 0 ? totalEc / ecCount : 0
    };
}

function updateQuickStats() {
    const totalWater = waterPointsSummary.total;
    const totalBoreholes = boreholesSummary.total;
    const totalFunctional = waterPointsSummary.functional + boreholesSummary.functional;
    const totalNonFunctional = waterPointsSummary.nonFunctional + boreholesSummary.nonFunctional;
    const totalRepair = waterPointsSummary.needsRepair + boreholesSummary.needsRepair;
    const totalYield = boreholesSummary.totalYield;
    
    safeUpdateElementText('quick-water-count', totalWater);
    safeUpdateElementText('quick-borehole-count', totalBoreholes);
    safeUpdateElementText('quick-functional', totalFunctional);
    safeUpdateElementText('quick-nonfunctional', totalNonFunctional);
    safeUpdateElementText('quick-repair', totalRepair);
    safeUpdateElementText('quick-total-yield', totalYield.toFixed(1) + ' m³/h');
    
    // Update mini stats
    const totalVisible = totalWater + totalBoreholes;
    safeUpdateElementText('visible-points-count', totalVisible);
    safeUpdateElementText('visible-functional-count', totalFunctional);
    safeUpdateElementText('visible-nonfunctional-count', totalNonFunctional);
    safeUpdateElementText('visible-repair-count', totalRepair);
    safeUpdateElementText('visible-avg-yield', boreholesSummary.avgYield.toFixed(1) + ' m³/h');
    
    const countyCount = document.querySelectorAll('.county-boundary').length;
    safeUpdateElementText('visible-counties-count', countyCount || '0');
}

function updateWaterPointsCount() {
    const waterPointsCount = document.getElementById('water-points-count-dropdown');
    if (waterPointsCount) {
        waterPointsCount.textContent = `${waterPointsSummary.total} points`;
    }
}

function updateBoreholesCount() {
    const boreholesCount = document.getElementById('boreholes-count-dropdown');
    if (boreholesCount) {
        boreholesCount.textContent = `${boreholesSummary.total} points`;
    }
}

function updateLegendCounts() {
    safeUpdateElementText('legend-functional', waterPointsSummary.functional);
    safeUpdateElementText('legend-nonfunctional', waterPointsSummary.nonFunctional);
    safeUpdateElementText('legend-repair', waterPointsSummary.needsRepair);
    safeUpdateElementText('legend-unknown', waterPointsSummary.unknown);
    
    safeUpdateElementText('legend-borehole-functional', boreholesSummary.functional);
    safeUpdateElementText('legend-borehole-nonfunctional', boreholesSummary.nonFunctional);
    safeUpdateElementText('legend-borehole-repair', boreholesSummary.needsRepair);
    safeUpdateElementText('legend-borehole-unknown', boreholesSummary.unknown);
}

function safeUpdateElementText(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

function renderWaterPoints(pointsToRender) {
    console.log('Rendering water points, count:', pointsToRender.length);
    
    waterPointsLayer.clearLayers();
    waterPointsMarkers = [];
    
    if (map.hasLayer(waterPointsLayer)) {
        map.removeLayer(waterPointsLayer);
    }
    
    if (markerClusterGroup) {
        markerClusterGroup.clearLayers();
    }
    
    pointsToRender.forEach(point => {
        const marker = createWaterPointMarker(point);
        if (marker) {
            waterPointsMarkers.push(marker);
            
            if (currentDisplayMode === 'cluster') {
                markerClusterGroup.addLayer(marker);
            } else {
                waterPointsLayer.addLayer(marker);
            }
        }
    });
    
    console.log(`Created ${waterPointsMarkers.length} water point markers`);
    
    if (layerVisibility.waterPoints && waterPointsMarkers.length > 0) {
        if (currentDisplayMode === 'cluster') {
            if (!map.hasLayer(markerClusterGroup)) {
                map.addLayer(markerClusterGroup);
            }
        } else {
            waterPointsLayer.addTo(map);
        }
    }
}

function renderBoreholes(pointsToRender) {
    console.log('Rendering boreholes, count:', pointsToRender.length);
    
    boreholesLayer.clearLayers();
    boreholesMarkers = [];
    
    if (map.hasLayer(boreholesLayer)) {
        map.removeLayer(boreholesLayer);
    }
    
    pointsToRender.forEach(point => {
        const marker = createBoreholeMarker(point);
        if (marker) {
            boreholesMarkers.push(marker);
            
            if (currentDisplayMode === 'cluster') {
                markerClusterGroup.addLayer(marker);
            } else {
                boreholesLayer.addLayer(marker);
            }
        }
    });
    
    console.log(`Created ${boreholesMarkers.length} borehole markers`);
    
    if (layerVisibility.boreholes && boreholesMarkers.length > 0) {
        if (currentDisplayMode === 'cluster') {
            if (!map.hasLayer(markerClusterGroup)) {
                map.addLayer(markerClusterGroup);
            }
        } else {
            boreholesLayer.addTo(map);
        }
    }
}

function createWaterPointMarker(point) {
    if (!point.geometry || !point.geometry.coordinates) {
        console.warn('Point missing geometry:', point);
        return null;
    }
    
    const props = point.properties || {};
    const latlng = [point.geometry.coordinates[1], point.geometry.coordinates[0]];
    
    if (!latlng[0] || !latlng[1] || isNaN(latlng[0]) || isNaN(latlng[1])) {
        console.warn('Invalid coordinates:', latlng);
        return null;
    }
    
    const status = props.status_cle || props.operation_field || props.status || 'Unknown';
    const statusColor = getStatusColor(status);
    
    let markerSize = 6;
    if (currentZoom < 8) {
        markerSize = 4;
    } else if (currentZoom > 12) {
        markerSize = 8;
    }
    
    const marker = L.circleMarker(latlng, {
        radius: markerSize,
        fillColor: statusColor,
        color: '#ffffff',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.9,
        className: `water-point-marker status-${status.replace(/\s+/g, '-').toLowerCase()}`
    });
    
    const popupContent = createWaterPointPopup(props, statusColor, status);
    marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'water-point-popup'
    });
    
    marker.on('click', function() {
        updateInfoPanel(props, statusColor, status, 'water');
    });
    
    marker.on('mouseover', function() {
        this.setStyle({
            radius: markerSize + 2,
            weight: 2
        });
    });
    
    marker.on('mouseout', function() {
        this.setStyle({
            radius: markerSize,
            weight: 1
        });
    });
    
    return marker;
}

function createBoreholeMarker(point) {
    if (!point.geometry || !point.geometry.coordinates) {
        console.warn('Borehole missing geometry:', point);
        return null;
    }
    
    const props = point.properties || {};
    const latlng = [point.geometry.coordinates[1], point.geometry.coordinates[0]];
    
    if (!latlng[0] || !latlng[1] || isNaN(latlng[0]) || isNaN(latlng[1])) {
        console.warn('Invalid borehole coordinates:', latlng);
        return null;
    }
    
    const status = props.operation_field || props.status || 'Unknown';
    const statusColor = getStatusColor(status);
    
    let markerSize = 5;
    if (currentZoom < 8) {
        markerSize = 4;
    } else if (currentZoom > 12) {
        markerSize = 7;
    }
    
    const marker = L.circleMarker(latlng, {
        radius: markerSize,
        fillColor: statusColor,
        color: '#ffffff',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.9,
        className: `borehole-marker status-${status.replace(/\s+/g, '-').toLowerCase()}`
    });
    
    const popupContent = createBoreholePopup(props, statusColor, status);
    marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'borehole-popup'
    });
    
    marker.on('click', function() {
        updateInfoPanel(props, statusColor, status, 'borehole');
    });
    
    marker.on('mouseover', function() {
        this.setStyle({
            radius: markerSize + 2,
            weight: 2
        });
    });
    
    marker.on('mouseout', function() {
        this.setStyle({
            radius: markerSize,
            weight: 1
        });
    });
    
    return marker;
}

function getStatusColor(status) {
    if (!status) return statusColors.unknown;
    
    const statusLower = String(status).toLowerCase();
    
    if (statusLower.includes('functional') && !statusLower.includes('non')) {
        return statusColors.functional;
    } else if (statusLower.includes('non-functional') || statusLower.includes('non functional')) {
        return statusColors['non-functional'];
    } else if (statusLower.includes('repair') || statusLower.includes('needs')) {
        return statusColors['needs repair'];
    } else if (statusLower === 'unknown' || statusLower === '') {
        return statusColors.unknown;
    } else {
        return statusColors.default;
    }
}

function createWaterPointPopup(props, statusColor, status) {
    let name = props.locality || props.name || '';
    if (!name && props.id) {
        name = `Water Point ${props.id}`;
    }
    
    const county = props.clean_adm1 || props.admin_1 || props.county || '';
    const subcounty = props.clean_adm2 || props.locality || props.subcounty || '';
    const ward = props.clean_adm3 || props.ward || '';
    
    const depth = props.well_depth;
    const yield_rate = props.yield_value;
    const water_quality = props.water_rest;
    const ph = props.ph;
    const source = props.water_sour || props.source;
    const installer = props.installer;
    const installYear = props.install_ye;
    const management = props.management;
    const payment = props.pay_clean;
    const facilityType = props.facility_t;
    const criticality = props.criticalit;
    const population = props.assigned_p;
    
    return `
        <div style="padding: 12px; min-width: 200px;">
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: ${statusColor}; margin-right: 8px;"></div>
                <h4 style="margin: 0; font-size: 16px; color: #1e293b;">${name || 'Water Point'}</h4>
            </div>
            
            <div style="font-size: 13px; color: #475569;">
                <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-weight: 600;">Status:</span> 
                    <span style="color: ${statusColor}; font-weight: 600;">${status}</span>
                </div>
                
                <div style="display: grid; grid-template-columns: auto 1fr; gap: 5px; margin-bottom: 5px;">
                    ${county ? `<span style="font-weight: 600;">County:</span> <span>${county}</span>` : ''}
                    ${subcounty ? `<span style="font-weight: 600;">Sub-County:</span> <span>${subcounty}</span>` : ''}
                    ${ward ? `<span style="font-weight: 600;">Ward:</span> <span>${ward}</span>` : ''}
                    ${depth ? `<span style="font-weight: 600;">Depth:</span> <span>${depth}m</span>` : ''}
                    ${yield_rate ? `<span style="font-weight: 600;">Yield:</span> <span>${yield_rate} m³/hr</span>` : ''}
                    ${water_quality ? `<span style="font-weight: 600;">Water Quality:</span> <span>${water_quality}</span>` : ''}
                    ${ph ? `<span style="font-weight: 600;">pH:</span> <span>${ph}</span>` : ''}
                    ${source ? `<span style="font-weight: 600;">Source:</span> <span>${source}</span>` : ''}
                    ${installer ? `<span style="font-weight: 600;">Installer:</span> <span>${installer}</span>` : ''}
                    ${installYear ? `<span style="font-weight: 600;">Install Year:</span> <span>${installYear}</span>` : ''}
                    ${management ? `<span style="font-weight: 600;">Management:</span> <span>${management}</span>` : ''}
                    ${payment ? `<span style="font-weight: 600;">Payment:</span> <span>${payment}</span>` : ''}
                    ${facilityType ? `<span style="font-weight: 600;">Facility Type:</span> <span>${facilityType}</span>` : ''}
                    ${criticality ? `<span style="font-weight: 600;">Criticality:</span> <span>${criticality}</span>` : ''}
                    ${population ? `<span style="font-weight: 600;">Population:</span> <span>${population.toLocaleString()}</span>` : ''}
                </div>
            </div>
        </div>
    `;
}

function createBoreholePopup(props, statusColor, status) {
    let name = props.locality || `Borehole ${props.id}`;
    
    const county = props.admin_1 || props.county || '';
    const subcounty = props.locality || props.subcounty || '';
    
    const depth = props.well_depth;
    const yield_value = props.yield_value;
    const installer = props.installer;
    const installYear = props.install_ye;
    const ec = props.ec;
    const ph = props.ph;
    const temperature = props.temperatur;
    const waterRest = props.water_rest;
    
    return `
        <div style="padding: 12px; min-width: 200px;">
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <div style="width: 12px; height: 12px; border-radius: 2px; background: ${statusColor}; margin-right: 8px;"></div>
                <h4 style="margin: 0; font-size: 16px; color: #1e293b;">${name}</h4>
            </div>
            
            <div style="font-size: 13px; color: #475569;">
                <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-weight: 600;">Status:</span> 
                    <span style="color: ${statusColor}; font-weight: 600;">${status}</span>
                </div>
                
                <div style="display: grid; grid-template-columns: auto 1fr; gap: 5px; margin-bottom: 5px;">
                    ${county ? `<span style="font-weight: 600;">County:</span> <span>${county}</span>` : ''}
                    ${subcounty ? `<span style="font-weight: 600;">Sub-County:</span> <span>${subcounty}</span>` : ''}
                    ${depth ? `<span style="font-weight: 600;">Depth:</span> <span>${depth}m</span>` : ''}
                    ${yield_value ? `<span style="font-weight: 600;">Yield:</span> <span>${yield_value} m³/hr</span>` : ''}
                    ${ec ? `<span style="font-weight: 600;">EC:</span> <span>${ec} µS/cm</span>` : ''}
                    ${ph ? `<span style="font-weight: 600;">pH:</span> <span>${ph}</span>` : ''}
                    ${temperature ? `<span style="font-weight: 600;">Temperature:</span> <span>${temperature}°C</span>` : ''}
                    ${waterRest ? `<span style="font-weight: 600;">Water Rest:</span> <span>${waterRest}m</span>` : ''}
                    ${installer ? `<span style="font-weight: 600;">Installer:</span> <span>${installer}</span>` : ''}
                    ${installYear ? `<span style="font-weight: 600;">Install Year:</span> <span>${installYear}</span>` : ''}
                </div>
            </div>
        </div>
    `;
}

function updateInfoPanel(props, statusColor, status, type) {
    try {
        const infoTitle = document.getElementById('infoTitle');
        const infoContent = document.getElementById('infoContent');
        const infoPanel = document.getElementById('infoPanel');
        
        if (!infoTitle || !infoContent || !infoPanel) return;
        
        let name = props.locality || props.name || '';
        if (!name && props.id) {
            name = type === 'water' ? `Water Point ${props.id}` : `Borehole ${props.id}`;
        }
        
        infoTitle.textContent = name || (type === 'water' ? 'Water Point' : 'Borehole');
        
        const county = props.clean_adm1 || props.admin_1 || props.county || '';
        const subcounty = props.clean_adm2 || props.locality || props.subcounty || '';
        const ward = props.clean_adm3 || props.ward || '';
        
        let html = `
            <div style="padding: 12px;">
                <div style="display: flex; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0;">
                    <div style="width: 16px; height: 16px; border-radius: ${type === 'water' ? '50%' : '2px'}; background: ${statusColor}; margin-right: 10px;"></div>
                    <div>
                        <div style="font-weight: 600; color: #1e293b;">${name}</div>
                        <div style="font-size: 12px; color: ${statusColor};">${status}</div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: auto 1fr; gap: 8px; font-size: 13px;">
        `;
        
        if (type === 'water') {
            const depth = props.well_depth;
            const yield_rate = props.yield_value;
            const water_quality = props.water_rest;
            const ph = props.ph;
            const source = props.water_sour || props.source;
            const installer = props.installer;
            const installYear = props.install_ye;
            const management = props.management;
            const payment = props.pay_clean;
            const facilityType = props.facility_t;
            const criticality = props.criticalit;
            const population = props.assigned_p;
            
            html += `
                ${county ? `<div style="color: #475569; font-weight: 500;">County:</div><div>${county}</div>` : ''}
                ${subcounty ? `<div style="color: #475569; font-weight: 500;">Sub-County:</div><div>${subcounty}</div>` : ''}
                ${ward ? `<div style="color: #475569; font-weight: 500;">Ward:</div><div>${ward}</div>` : ''}
                ${depth ? `<div style="color: #475569; font-weight: 500;">Depth:</div><div>${depth}m</div>` : ''}
                ${yield_rate ? `<div style="color: #475569; font-weight: 500;">Yield:</div><div>${yield_rate} m³/hr</div>` : ''}
                ${water_quality ? `<div style="color: #475569; font-weight: 500;">Water Quality:</div><div>${water_quality}</div>` : ''}
                ${ph ? `<div style="color: #475569; font-weight: 500;">pH:</div><div>${ph}</div>` : ''}
                ${source ? `<div style="color: #475569; font-weight: 500;">Source:</div><div>${source}</div>` : ''}
                ${installer ? `<div style="color: #475569; font-weight: 500;">Installer:</div><div>${installer}</div>` : ''}
                ${installYear ? `<div style="color: #475569; font-weight: 500;">Install Year:</div><div>${installYear}</div>` : ''}
                ${management ? `<div style="color: #475569; font-weight: 500;">Management:</div><div>${management}</div>` : ''}
                ${payment ? `<div style="color: #475569; font-weight: 500;">Payment:</div><div>${payment}</div>` : ''}
                ${facilityType ? `<div style="color: #475569; font-weight: 500;">Facility Type:</div><div>${facilityType}</div>` : ''}
                ${criticality ? `<div style="color: #475569; font-weight: 500;">Criticality:</div><div>${criticality}</div>` : ''}
                ${population ? `<div style="color: #475569; font-weight: 500;">Population:</div><div>${population.toLocaleString()}</div>` : ''}
            `;
        } else {
            const depth = props.well_depth;
            const yield_value = props.yield_value;
            const installer = props.installer;
            const installYear = props.install_ye;
            const ec = props.ec;
            const ph = props.ph;
            const temperature = props.temperatur;
            const waterRest = props.water_rest;
            
            html += `
                ${county ? `<div style="color: #475569; font-weight: 500;">County:</div><div>${county}</div>` : ''}
                ${subcounty ? `<div style="color: #475569; font-weight: 500;">Sub-County:</div><div>${subcounty}</div>` : ''}
                ${depth ? `<div style="color: #475569; font-weight: 500;">Depth:</div><div>${depth}m</div>` : ''}
                ${yield_value ? `<div style="color: #475569; font-weight: 500;">Yield:</div><div>${yield_value} m³/hr</div>` : ''}
                ${ec ? `<div style="color: #475569; font-weight: 500;">EC:</div><div>${ec} µS/cm</div>` : ''}
                ${ph ? `<div style="color: #475569; font-weight: 500;">pH:</div><div>${ph}</div>` : ''}
                ${temperature ? `<div style="color: #475569; font-weight: 500;">Temperature:</div><div>${temperature}°C</div>` : ''}
                ${waterRest ? `<div style="color: #475569; font-weight: 500;">Water Rest:</div><div>${waterRest}m</div>` : ''}
                ${installer ? `<div style="color: #475569; font-weight: 500;">Installer:</div><div>${installer}</div>` : ''}
                ${installYear ? `<div style="color: #475569; font-weight: 500;">Install Year:</div><div>${installYear}</div>` : ''}
            `;
        }
        
        html += `
                </div>
            </div>
        `;
        
        infoContent.innerHTML = html;
        infoPanel.classList.add('active');
    } catch (e) {
        console.warn('Error updating info panel:', e);
    }
}

function fitBoundsToPoints() {
    try {
        if (waterPointsFiltered.length === 0 && boreholesFiltered.length === 0) return;
        
        const tempGroup = L.featureGroup();
        
        // Add water points
        waterPointsFiltered.forEach(point => {
            if (point.geometry && point.geometry.coordinates) {
                const latlng = [point.geometry.coordinates[1], point.geometry.coordinates[0]];
                if (latlng[0] && latlng[1] && !isNaN(latlng[0]) && !isNaN(latlng[1])) {
                    L.marker(latlng).addTo(tempGroup);
                }
            }
        });
        
        // Add boreholes
        boreholesFiltered.forEach(point => {
            if (point.geometry && point.geometry.coordinates) {
                const latlng = [point.geometry.coordinates[1], point.geometry.coordinates[0]];
                if (latlng[0] && latlng[1] && !isNaN(latlng[0]) && !isNaN(latlng[1])) {
                    L.marker(latlng).addTo(tempGroup);
                }
            }
        });
        
        const bounds = tempGroup.getBounds();
        tempGroup.clearLayers();
        
        if (bounds && bounds.isValid && bounds.isValid()) {
            let maxZoom = 12;
            if (selectedWard !== 'all') maxZoom = 15;
            else if (selectedSubcounty !== 'all') maxZoom = 13;
            else if (selectedCounty !== 'all') maxZoom = 11;
            
            if ((waterPointsFiltered.length + boreholesFiltered.length) === 1) {
                maxZoom = 16;
            }

            map.fitBounds(bounds, { 
                padding: [50, 50],
                maxZoom: maxZoom,
                animate: true,
                duration: 1
            });
        }
    } catch (e) {
        console.warn('Could not fit bounds to points:', e);
    }
}

// ============================================================================
// FEATURE EVENT HANDLERS
// ============================================================================

function onEachCountyFeature(feature, layer) {
    const props = feature.properties;
    
    const popupContent = `
        <div style="padding: 10px; min-width: 200px;">
            <h4 style="color: #2563eb; margin: 0 0 10px 0;">${props.county || 'Unknown County'}</h4>
            <div style="font-size: 13px;">
                ${props.population_2009 ? `<p><strong>Population (2009):</strong> ${props.population_2009.toLocaleString()}</p>` : ''}
                <p><strong>Country:</strong> ${props.country || 'KE'}</p>
            </div>
            <button onclick="filterToCounty(${props.id})" style="
                background: #2563eb;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 4px;
                cursor: pointer;
                margin-top: 10px;
                width: 100%;
                font-size: 13px;
            ">View Water Points in this County</button>
        </div>
    `;
    
    layer.bindPopup(popupContent);
    
    layer.on({
        mouseover: function(e) {
            e.target.setStyle({
                weight: 3,
                color: '#f97316',
                fillOpacity: 0.2
            });
            e.target.bringToFront();
        },
        mouseout: function(e) {
            if (!highlightedFeature || highlightedFeature !== e.target) {
                e.target.setStyle(layerStyles.counties);
            }
        },
        click: function(e) {
            highlightFeature(e.target, 'counties');
        }
    });
}

function onEachSubcountyFeature(feature, layer) {
    const props = feature.properties;
    
    const popupContent = `
        <div style="padding: 10px; min-width: 200px;">
            <h4 style="color: #14b8a6; margin: 0 0 10px 0;">${props.subcounty || 'Unknown Sub-County'}</h4>
            <div style="font-size: 13px;">
                <p><strong>County:</strong> ${props.county || 'N/A'}</p>
                <p><strong>Country:</strong> ${props.country || 'KE'}</p>
            </div>
            <button onclick="filterToSubcounty(${props.id})" style="
                background: #14b8a6;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 4px;
                cursor: pointer;
                margin-top: 10px;
                width: 100%;
                font-size: 13px;
            ">View Water Points in this Sub-County</button>
        </div>
    `;
    
    layer.bindPopup(popupContent);
    
    layer.on({
        mouseover: function(e) {
            e.target.setStyle({
                weight: 2.5,
                color: '#f97316',
                fillOpacity: 0.15
            });
            e.target.bringToFront();
        },
        mouseout: function(e) {
            if (!highlightedFeature || highlightedFeature !== e.target) {
                e.target.setStyle(layerStyles.subcounties);
            }
        },
        click: function(e) {
            highlightFeature(e.target, 'subcounties');
        }
    });
}

function onEachWardFeature(feature, layer) {
    const props = feature.properties;
    
    const popupContent = `
        <div style="padding: 10px; min-width: 200px;">
            <h4 style="color: #f97316; margin: 0 0 10px 0;">${props.ward || 'Unknown Ward'}</h4>
            <div style="font-size: 13px;">
                <p><strong>Sub-County:</strong> ${props.subcounty || 'N/A'}</p>
                <p><strong>County:</strong> ${props.county || 'N/A'}</p>
            </div>
            <button onclick="filterToWard(${props.id})" style="
                background: #f97316;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 4px;
                cursor: pointer;
                margin-top: 10px;
                width: 100%;
                font-size: 13px;
            ">View Water Points in this Ward</button>
        </div>
    `;
    
    layer.bindPopup(popupContent);
    
    layer.on({
        mouseover: function(e) {
            e.target.setStyle({
                weight: 2,
                color: '#2563eb',
                fillOpacity: 0.1
            });
            e.target.bringToFront();
        },
        mouseout: function(e) {
            if (!highlightedFeature || highlightedFeature !== e.target) {
                e.target.setStyle(layerStyles.wards);
            }
        },
        click: function(e) {
            highlightFeature(e.target, 'wards');
        }
    });
}

// ============================================================================
// HIGHLIGHT FEATURE
// ============================================================================

function highlightFeature(layer, type) {
    if (highlightedFeature) {
        const style = layerStyles[highlightedFeatureType] || layerStyles.counties;
        highlightedFeature.setStyle(style);
    }
    
    layer.setStyle({
        weight: 4,
        color: '#ec4899',
        fillOpacity: 0.2
    });
    
    layer.bringToFront();
    highlightedFeature = layer;
    highlightedFeatureType = type;
}

// ============================================================================
// FILTER FUNCTIONS
// ============================================================================

function filterToCounty(countyId) {
    const countySelect = document.getElementById('county-select');
    if (countySelect) {
        countySelect.value = countyId;
        countySelect.dispatchEvent(new Event('change'));
        setTimeout(() => applyFilters(), 100);
    }
}

function filterToSubcounty(subcountyId) {
    const subcountySelect = document.getElementById('subcounty-select');
    if (subcountySelect) {
        subcountySelect.value = subcountyId;
        subcountySelect.dispatchEvent(new Event('change'));
        setTimeout(() => applyFilters(), 100);
    }
}

function filterToWard(wardId) {
    const wardSelect = document.getElementById('ward-select');
    if (wardSelect) {
        wardSelect.value = wardId;
        wardSelect.dispatchEvent(new Event('change'));
        setTimeout(() => applyFilters(), 100);
    }
}

// ============================================================================
// APPLY FILTERS
// ============================================================================

async function applyFilters() {
    showNotification('Applying Filters', 'Loading selected area and water points...', 'info');
    
    // Clear existing points
    waterPointsLayer.clearLayers();
    boreholesLayer.clearLayers();
    if (markerClusterGroup) {
        markerClusterGroup.clearLayers();
    }
    waterPointsMarkers = [];
    boreholesMarkers = [];
    waterPointsData = [];
    boreholesData = [];
    waterPointsFiltered = [];
    boreholesFiltered = [];
    
    if (map.hasLayer(waterPointsLayer)) {
        map.removeLayer(waterPointsLayer);
    }
    if (map.hasLayer(boreholesLayer)) {
        map.removeLayer(boreholesLayer);
    }
    if (map.hasLayer(markerClusterGroup)) {
        map.removeLayer(markerClusterGroup);
    }
    
    // Get selected values
    const countySelect = document.getElementById('county-select');
    const subcountySelect = document.getElementById('subcounty-select');
    const wardSelect = document.getElementById('ward-select');
    const modelTypeSelect = document.getElementById('model-type-select');
    const statusSelect = document.getElementById('status-select');
    const sourceTypeSelect = document.getElementById('source-type-select');
    
    selectedCounty = countySelect ? countySelect.value : 'all';
    selectedSubcounty = subcountySelect ? subcountySelect.value : 'all';
    selectedWard = wardSelect ? wardSelect.value : 'all';
    selectedModelType = modelTypeSelect ? modelTypeSelect.value : 'all';
    selectedStatus = statusSelect ? statusSelect.value : 'all';
    selectedSourceType = sourceTypeSelect ? sourceTypeSelect.value : 'all';
    
    // Get range filters
    const yearFromInput = document.getElementById('year-from');
    const yearToInput = document.getElementById('year-to');
    const depthFromInput = document.getElementById('depth-from');
    const depthToInput = document.getElementById('depth-to');
    const yieldFromInput = document.getElementById('yield-from');
    const yieldToInput = document.getElementById('yield-to');
    
    yearFrom = yearFromInput ? yearFromInput.value : '';
    yearTo = yearToInput ? yearToInput.value : '';
    depthFrom = depthFromInput ? depthFromInput.value : '';
    depthTo = depthToInput ? depthToInput.value : '';
    yieldFrom = yieldFromInput ? yieldFromInput.value : '';
    yieldTo = yieldToInput ? yieldToInput.value : '';
    
    // Get names for API filtering
    let countyName = 'all';
    if (selectedCounty !== 'all' && countySelect && countySelect.selectedIndex >= 0) {
        countyName = countySelect.options[countySelect.selectedIndex].text;
    }
    
    let subcountyName = 'all';
    if (selectedSubcounty !== 'all' && subcountySelect && subcountySelect.selectedIndex >= 0) {
        subcountyName = subcountySelect.options[subcountySelect.selectedIndex].text;
    }
    
    let wardName = 'all';
    if (selectedWard !== 'all' && wardSelect && wardSelect.selectedIndex >= 0) {
        wardName = wardSelect.options[wardSelect.selectedIndex].text;
    }
    
    // Load boundaries
    if (selectedCounty !== 'all') {
        await loadCounties(selectedCounty);
        
        // Show subcounties
        layerVisibility.subcounties = true;
        await loadSubcounties(selectedCounty);
        if (!map.hasLayer(subcountiesLayer) && layerVisibility.subcounties) {
            subcountiesLayer.addTo(map);
        }
        
        if (selectedSubcounty !== 'all') {
            // Show wards
            layerVisibility.wards = true;
            await loadWards(selectedSubcounty);
            if (!map.hasLayer(wardsLayer) && layerVisibility.wards) {
                wardsLayer.addTo(map);
            }
        }
    } else {
        await loadCounties('all');
    }
    
    // Load water points and boreholes based on model type
    if (selectedModelType === 'waterpoints' || selectedModelType === 'all') {
        await loadWaterPoints(countyName, subcountyName, wardName, selectedModelType);
    }
    
    if (selectedModelType === 'boreholes' || selectedModelType === 'all') {
        await loadBoreholes(countyName, subcountyName, wardName);
    }
    
    // Add layers to map based on visibility
    if (layerVisibility.waterPoints && waterPointsFiltered.length > 0) {
        if (currentDisplayMode === 'cluster') {
            if (!map.hasLayer(markerClusterGroup)) {
                map.addLayer(markerClusterGroup);
            }
        } else {
            if (!map.hasLayer(waterPointsLayer)) {
                waterPointsLayer.addTo(map);
            }
        }
    }
    
    if (layerVisibility.boreholes && boreholesFiltered.length > 0) {
        if (currentDisplayMode === 'cluster') {
            if (!map.hasLayer(markerClusterGroup)) {
                map.addLayer(markerClusterGroup);
            }
        } else {
            if (!map.hasLayer(boreholesLayer)) {
                boreholesLayer.addTo(map);
            }
        }
    }
    
    // Fit bounds to show all points
    setTimeout(() => {
        fitBoundsToPoints();
    }, 500);
    
    const totalPoints = waterPointsSummary.total + boreholesSummary.total;
    showNotification('Filters Applied', `Loaded ${totalPoints} total points (${waterPointsSummary.total} water points, ${boreholesSummary.total} boreholes)`, 'success');
}

function resetFilters() {
    const countySelect = document.getElementById('county-select');
    const subcountySelect = document.getElementById('subcounty-select');
    const wardSelect = document.getElementById('ward-select');
    const modelTypeSelect = document.getElementById('model-type-select');
    const statusSelect = document.getElementById('status-select');
    const sourceTypeSelect = document.getElementById('source-type-select');
    const yearFromInput = document.getElementById('year-from');
    const yearToInput = document.getElementById('year-to');
    const depthFromInput = document.getElementById('depth-from');
    const depthToInput = document.getElementById('depth-to');
    const yieldFromInput = document.getElementById('yield-from');
    const yieldToInput = document.getElementById('yield-to');
    
    if (countySelect) countySelect.value = 'all';
    if (subcountySelect) {
        subcountySelect.value = 'all';
        subcountySelect.disabled = true;
        subcountySelect.innerHTML = '<option value="all">All Sub-Counties</option>';
    }
    if (wardSelect) {
        wardSelect.value = 'all';
        wardSelect.disabled = true;
        wardSelect.innerHTML = '<option value="all">All Wards</option>';
    }
    if (modelTypeSelect) modelTypeSelect.value = 'all';
    if (statusSelect) statusSelect.value = 'all';
    if (sourceTypeSelect) sourceTypeSelect.value = 'all';
    if (yearFromInput) yearFromInput.value = '';
    if (yearToInput) yearToInput.value = '';
    if (depthFromInput) depthFromInput.value = '';
    if (depthToInput) depthToInput.value = '';
    if (yieldFromInput) yieldFromInput.value = '';
    if (yieldToInput) yieldToInput.value = '';
    
    selectedCounty = 'all';
    selectedSubcounty = 'all';
    selectedWard = 'all';
    selectedModelType = 'all';
    selectedStatus = 'all';
    selectedSourceType = 'all';
    yearFrom = '';
    yearTo = '';
    depthFrom = '';
    depthTo = '';
    yieldFrom = '';
    yieldTo = '';
    
    map.setView([0.5, 37.5], 7, { animate: true, duration: 1.5 });
    
    // Reset layer visibility
    layerVisibility.counties = true;
    layerVisibility.subcounties = false;
    layerVisibility.wards = false;
    layerVisibility.waterPoints = true;
    layerVisibility.boreholes = true;
    
    // Remove layers
    map.removeLayer(subcountiesLayer);
    map.removeLayer(wardsLayer);
    
    // Clear data
    waterPointsData = [];
    boreholesData = [];
    waterPointsFiltered = [];
    boreholesFiltered = [];
    waterPointsMarkers = [];
    boreholesMarkers = [];
    
    // Reload counties and all points
    loadCounties('all');
    setTimeout(() => {
        loadWaterPoints('all', 'all', 'all', 'all');
        loadBoreholes('all', 'all', 'all');
    }, 500);
    
    showNotification('Filters Reset', 'Showing all water points and boreholes', 'info');
}

// ============================================================================
// SETUP FUNCTIONS
// ============================================================================

function setupEventHandlers() {
    if (!map) return;
    
    map.on(L.Draw.Event.CREATED, function(e) {
        const layer = e.layer;
        drawnItems.addLayer(layer);
        showNotification('Shape Added', 'New shape drawn on map', 'success');
    });
    
    map.on(L.Draw.Event.EDITED, function() {
        showNotification('Shape Edited', 'Shape has been modified', 'info');
    });
    
    map.on(L.Draw.Event.DELETED, function() {
        showNotification('Shape Removed', 'Shape has been deleted', 'warning');
    });
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
}

function setupDropdowns() {
    const countySelect = document.getElementById('county-select');
    const subcountySelect = document.getElementById('subcounty-select');
    const wardSelect = document.getElementById('ward-select');
    const applyFilterBtn = document.getElementById('apply-filter');
    const resetFilterBtn = document.getElementById('reset-filter');
    
    if (countySelect) {
        countySelect.addEventListener('change', async function() {
            selectedCounty = this.value;
            console.log('County changed to:', selectedCounty);
            
            // Reset subcounty and ward selects
            if (subcountySelect) {
                subcountySelect.innerHTML = '<option value="all">Loading sub-counties...</option>';
                subcountySelect.disabled = true;
            }
            
            if (wardSelect) {
                wardSelect.innerHTML = '<option value="all">All Wards</option>';
                wardSelect.disabled = true;
            }
            
            if (selectedCounty !== 'all') {
                try {
                    const response = await fetch(`/api/dropdown/subcounties/?county_id=${selectedCounty}`);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    
                    subcountySelect.innerHTML = '<option value="all">All Sub-Counties</option>';
                    
                    let subcountiesList = [];
                    
                    if (Array.isArray(data)) {
                        if (data.length > 0 && data[0].id !== undefined) {
                            subcountiesList = data;
                        } else {
                            subcountiesList = data.map((item, index) => {
                                if (typeof item === 'string') {
                                    return { id: index, name: item };
                                } else if (item.subcounty) {
                                    return { id: item.id || index, name: item.subcounty };
                                } else {
                                    return { id: item.id || index, name: item.name || item };
                                }
                            });
                        }
                    } else if (data.features) {
                        subcountiesList = data.features.map(f => ({
                            id: f.id,
                            name: f.properties?.subcounty || f.properties?.name || 'Unknown'
                        }));
                    } else if (data.results) {
                        subcountiesList = data.results.map(item => ({
                            id: item.id,
                            name: item.subcounty || item.name
                        }));
                    }
                    
                    if (subcountiesList.length > 0) {
                        subcountiesList.forEach(item => {
                            if (item.name && item.name !== 'Unknown' && item.name !== 'null') {
                                const option = document.createElement('option');
                                option.value = item.id;
                                option.textContent = item.name;
                                subcountySelect.appendChild(option);
                            }
                        });
                        
                        subcountySelect.disabled = false;
                        selectedSubcounty = 'all';
                        subcountySelect.value = 'all';
                    } else {
                        subcountySelect.innerHTML = '<option value="all">No sub-counties found</option>';
                        subcountySelect.disabled = true;
                    }
                    
                } catch (error) {
                    console.error('Error loading subcounties:', error);
                    subcountySelect.innerHTML = '<option value="all">Error loading sub-counties</option>';
                    showNotification('Error', 'Failed to load subcounties', 'error');
                }
            } else {
                if (subcountySelect) {
                    subcountySelect.innerHTML = '<option value="all">All Sub-Counties</option>';
                    subcountySelect.disabled = true;
                }
                if (wardSelect) {
                    wardSelect.innerHTML = '<option value="all">All Wards</option>';
                    wardSelect.disabled = true;
                }
                selectedSubcounty = 'all';
                selectedWard = 'all';
                
                map.setView([0.5, 37.5], 7, { animate: true, duration: 1.5 });
                
                layerVisibility.subcounties = false;
                layerVisibility.wards = false;
                
                map.removeLayer(subcountiesLayer);
                map.removeLayer(wardsLayer);
            }
        });
    }
    
    if (subcountySelect) {
        subcountySelect.addEventListener('change', async function() {
            selectedSubcounty = this.value;
            console.log('Subcounty changed to:', selectedSubcounty);
            
            if (wardSelect) {
                wardSelect.innerHTML = '<option value="all">Loading wards...</option>';
                wardSelect.disabled = true;
            }
            
            if (selectedSubcounty !== 'all') {
                try {
                    const response = await fetch(`/api/dropdown/wards/?subcounty_id=${selectedSubcounty}`);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    
                    wardSelect.innerHTML = '<option value="all">All Wards</option>';
                    
                    let wardsList = [];
                    
                    if (Array.isArray(data)) {
                        if (data.length > 0 && data[0].id !== undefined) {
                            wardsList = data;
                        } else {
                            wardsList = data.map((item, index) => {
                                if (typeof item === 'string') {
                                    return { id: index, name: item };
                                } else if (item.ward) {
                                    return { id: item.id || index, name: item.ward };
                                } else {
                                    return { id: item.id || index, name: item.name || item };
                                }
                            });
                        }
                    } else if (data.features) {
                        wardsList = data.features.map(f => ({
                            id: f.id,
                            name: f.properties?.ward || f.properties?.name || 'Unknown'
                        }));
                    } else if (data.results) {
                        wardsList = data.results.map(item => ({
                            id: item.id,
                            name: item.ward || item.name
                        }));
                    }
                    
                    if (wardsList.length > 0) {
                        wardsList.forEach(item => {
                            if (item.name && item.name !== 'Unknown' && item.name !== 'null') {
                                const option = document.createElement('option');
                                option.value = item.id;
                                option.textContent = item.name;
                                wardSelect.appendChild(option);
                            }
                        });
                        
                        wardSelect.disabled = false;
                        selectedWard = 'all';
                        wardSelect.value = 'all';
                    } else {
                        wardSelect.innerHTML = '<option value="all">No wards found</option>';
                        wardSelect.disabled = true;
                    }
                    
                } catch (error) {
                    console.error('Error loading wards:', error);
                    wardSelect.innerHTML = '<option value="all">Error loading wards</option>';
                    showNotification('Error', 'Failed to load wards', 'error');
                }
            } else {
                if (wardSelect) {
                    wardSelect.innerHTML = '<option value="all">All Wards</option>';
                    wardSelect.disabled = true;
                }
                selectedWard = 'all';
            }
        });
    }
    
    if (wardSelect) {
        wardSelect.addEventListener('change', function() {
            selectedWard = this.value;
            console.log('Ward changed to:', selectedWard);
        });
    }
    
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', applyFilters);
    }
    
    if (resetFilterBtn) {
        resetFilterBtn.addEventListener('click', resetFilters);
    }
}

function setupLayerToggles() {
    const waterPointsToggle = document.getElementById('toggle-water-points-dropdown');
    if (waterPointsToggle) {
        waterPointsToggle.addEventListener('change', function() {
            layerVisibility.waterPoints = this.checked;
            if (this.checked) {
                if (currentDisplayMode === 'cluster') {
                    if (!map.hasLayer(markerClusterGroup) && markerClusterGroup.getLayers().length > 0) {
                        map.addLayer(markerClusterGroup);
                    }
                } else {
                    if (!map.hasLayer(waterPointsLayer) && waterPointsMarkers.length > 0) {
                        waterPointsLayer.addTo(map);
                    }
                }
            } else {
                if (currentDisplayMode === 'cluster') {
                    map.removeLayer(markerClusterGroup);
                } else {
                    map.removeLayer(waterPointsLayer);
                }
            }
        });
        waterPointsToggle.checked = true;
    }
    
    const boreholesToggle = document.getElementById('toggle-boreholes-dropdown');
    if (boreholesToggle) {
        boreholesToggle.addEventListener('change', function() {
            layerVisibility.boreholes = this.checked;
            if (this.checked) {
                if (currentDisplayMode === 'cluster') {
                    if (!map.hasLayer(markerClusterGroup) && markerClusterGroup.getLayers().length > 0) {
                        map.addLayer(markerClusterGroup);
                    }
                } else {
                    if (!map.hasLayer(boreholesLayer) && boreholesMarkers.length > 0) {
                        boreholesLayer.addTo(map);
                    } else if (boreholesMarkers.length === 0 && boreholesData.length === 0) {
                        loadBoreholes(selectedCounty, selectedSubcounty, selectedWard);
                    }
                }
            } else {
                if (currentDisplayMode === 'cluster') {
                    map.removeLayer(markerClusterGroup);
                } else {
                    map.removeLayer(boreholesLayer);
                }
            }
        });
        boreholesToggle.checked = true;
    }
    
    const countyToggle = document.getElementById('toggle-counties-dropdown');
    if (countyToggle) {
        countyToggle.addEventListener('change', function() {
            layerVisibility.counties = this.checked;
            if (this.checked) {
                if (!map.hasLayer(countiesLayer)) countiesLayer.addTo(map);
            } else {
                map.removeLayer(countiesLayer);
            }
        });
        countyToggle.checked = true;
    }
    
    const subcountyToggle = document.getElementById('toggle-subcounties-dropdown');
    if (subcountyToggle) {
        subcountyToggle.addEventListener('change', function() {
            layerVisibility.subcounties = this.checked;
            if (this.checked) {
                if (!map.hasLayer(subcountiesLayer)) subcountiesLayer.addTo(map);
                if (subcountiesLayer.getLayers().length === 0 && selectedCounty !== 'all') {
                    loadSubcounties(selectedCounty);
                }
            } else {
                map.removeLayer(subcountiesLayer);
            }
        });
        subcountyToggle.checked = false;
    }
    
    const wardToggle = document.getElementById('toggle-wards-dropdown');
    if (wardToggle) {
        wardToggle.addEventListener('change', function() {
            layerVisibility.wards = this.checked;
            if (this.checked) {
                if (!map.hasLayer(wardsLayer)) wardsLayer.addTo(map);
                if (wardsLayer.getLayers().length === 0) {
                    loadWards(selectedSubcounty, selectedCounty);
                }
            } else {
                map.removeLayer(wardsLayer);
            }
        });
        wardToggle.checked = false;
    }
}

function setupDisplayOptions() {
    const displayOptions = document.querySelectorAll('.display-option[data-display]');
    displayOptions.forEach(option => {
        option.addEventListener('click', function() {
            const displayMode = this.dataset.display;
            
            displayOptions.forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');
            
            currentDisplayMode = displayMode;
            
            // Update display
            updateDisplayMode();
        });
    });
    
    const individualOption = document.querySelector('.display-option[data-display="individual"]');
    if (individualOption) {
        individualOption.classList.add('active');
    }
}

function updateDisplayMode() {
    // Remove all point layers
    map.removeLayer(waterPointsLayer);
    map.removeLayer(boreholesLayer);
    map.removeLayer(markerClusterGroup);
    
    if (heatLayer) {
        map.removeLayer(heatLayer);
        heatLayer = null;
    }
    
    if (currentDisplayMode === 'heatmap') {
        generateHeatmap();
        return;
    }
    
    // Re-add based on new mode
    if (currentDisplayMode === 'cluster') {
        markerClusterGroup.clearLayers();
        
        waterPointsMarkers.forEach(marker => markerClusterGroup.addLayer(marker));
        boreholesMarkers.forEach(marker => markerClusterGroup.addLayer(marker));
        
        if (layerVisibility.waterPoints || layerVisibility.boreholes) {
            map.addLayer(markerClusterGroup);
        }
    } else {
        if (layerVisibility.waterPoints && waterPointsMarkers.length > 0) {
            waterPointsLayer.addTo(map);
        }
        if (layerVisibility.boreholes && boreholesMarkers.length > 0) {
            boreholesLayer.addTo(map);
        }
    }
}

function setupMapTools() {
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const resetViewBtn = document.getElementById('reset-view-btn');
    const locateMeBtn = document.getElementById('locate-me-btn');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => map.zoomIn());
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => map.zoomOut());
    
    if (resetViewBtn) {
        resetViewBtn.addEventListener('click', () => {
            map.setView([0.5, 37.5], 7, { animate: true, duration: 1.5 });
        });
    }
    
    if (locateMeBtn) {
        locateMeBtn.addEventListener('click', () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    position => {
                        map.setView([position.coords.latitude, position.coords.longitude], 12, {
                            animate: true,
                            duration: 1.5
                        });
                        
                        L.circleMarker([position.coords.latitude, position.coords.longitude], {
                            radius: 8,
                            fillColor: '#2563eb',
                            color: '#ffffff',
                            weight: 2,
                            fillOpacity: 0.9
                        }).addTo(map).bindPopup('Your location').openPopup();
                        
                        showNotification('Location Found', 'Zoomed to your current location', 'success');
                    },
                    error => {
                        showNotification('Location Error', 'Unable to get your location', 'error');
                    }
                );
            }
        });
    }
    
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }
    
    const legendToggleBtn = document.getElementById('legend-toggle');
    if (legendToggleBtn) {
        legendToggleBtn.addEventListener('click', function() {
            const legendContent = document.getElementById('legend-content');
            if (legendContent) {
                const isHidden = legendContent.style.display === 'none';
                legendContent.style.display = isHidden ? 'block' : 'none';
                this.innerHTML = isHidden ? 
                    '<i class="fas fa-chevron-up"></i>' : 
                    '<i class="fas fa-chevron-down"></i>';
            }
        });
    }
    
    const infoCloseBtn = document.getElementById('infoClose');
    if (infoCloseBtn) {
        infoCloseBtn.addEventListener('click', () => {
            document.getElementById('infoPanel').classList.remove('active');
        });
    }
    
    const notificationCloseBtn = document.getElementById('notificationClose');
    if (notificationCloseBtn) {
        notificationCloseBtn.addEventListener('click', () => {
            document.getElementById('notification').classList.remove('show');
        });
    }
    
    const miniStatsToggle = document.getElementById('miniStatsToggle');
    if (miniStatsToggle) {
        miniStatsToggle.addEventListener('click', function() {
            const miniStatsContent = document.getElementById('miniStatsContent');
            if (miniStatsContent) {
                const isHidden = miniStatsContent.style.display === 'none';
                miniStatsContent.style.display = isHidden ? 'block' : 'none';
                this.innerHTML = isHidden ? 
                    '<i class="fas fa-chevron-up"></i>' : 
                    '<i class="fas fa-chevron-down"></i>';
            }
        });
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function toggleFullscreen() {
    const elem = document.documentElement;
    
    if (!isFullscreen) {
        if (elem.requestFullscreen) elem.requestFullscreen();
        else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
        else if (elem.mozRequestFullScreen) elem.mozRequestFullScreen();
        else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
    }
}

function handleFullscreenChange() {
    isFullscreen = !!(document.fullscreenElement || 
                     document.webkitFullscreenElement || 
                     document.mozFullScreenElement || 
                     document.msFullscreenElement);
    
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    if (fullscreenBtn) {
        fullscreenBtn.innerHTML = isFullscreen ? 
            '<i class="fas fa-compress"></i>' : 
            '<i class="fas fa-expand"></i>';
    }
}

function showNotification(title, message, type = 'info') {
    try {
        const notification = document.getElementById('notification');
        if (!notification) {
            console.log(`${title}: ${message}`);
            return;
        }
        
        const notificationTitle = document.getElementById('notificationTitle');
        const notificationMessage = document.getElementById('notificationMessage');
        const notificationIcon = notification.querySelector('.notification-icon i');
        
        if (!notificationTitle || !notificationMessage || !notificationIcon) {
            console.log(`${title}: ${message}`);
            return;
        }
        
        let icon = 'info-circle';
        let borderColor = '#2563eb';
        
        switch(type) {
            case 'success':
                icon = 'check-circle';
                borderColor = '#10b981';
                break;
            case 'warning':
                icon = 'exclamation-triangle';
                borderColor = '#f59e0b';
                break;
            case 'error':
                icon = 'times-circle';
                borderColor = '#ef4444';
                break;
        }
        
        notificationTitle.textContent = title;
        notificationMessage.textContent = message;
        notificationIcon.className = `fas fa-${icon}`;
        notification.style.borderLeftColor = borderColor;
        
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 5000);
    } catch (e) {
        console.warn('Error showing notification:', e);
        console.log(`${title}: ${message}`);
    }
}

function refreshData() {
    showNotification('Refreshing', 'Reloading data...', 'info');
    
    // Clear existing layers
    waterPointsLayer.clearLayers();
    boreholesLayer.clearLayers();
    if (markerClusterGroup) {
        markerClusterGroup.clearLayers();
    }
    
    // Reload data
    setTimeout(() => {
        loadWaterPoints(selectedCounty, selectedSubcounty, selectedWard, selectedModelType);
        loadBoreholes(selectedCounty, selectedSubcounty, selectedWard);
    }, 500);
}

// ============================================================================
// GLOBAL FUNCTIONS
// ============================================================================

function zoomToPoint(pointId, type) {
    let point = null;
    
    if (type === 'water_point') {
        point = waterPointsFiltered.find(p => p.properties.id == pointId);
    } else {
        point = boreholesFiltered.find(p => p.properties.id == pointId);
    }
    
    if (point && point.geometry && point.geometry.coordinates) {
        const latlng = [point.geometry.coordinates[1], point.geometry.coordinates[0]];
        map.setView(latlng, 14, { animate: true, duration: 1.5 });
        
        setTimeout(() => {
            if (type === 'water_point') {
                waterPointsMarkers.forEach(marker => {
                    const markerLatLng = marker.getLatLng();
                    if (Math.abs(markerLatLng.lat - latlng[0]) < 0.001 && 
                        Math.abs(markerLatLng.lng - latlng[1]) < 0.001) {
                        marker.openPopup();
                    }
                });
            } else {
                boreholesMarkers.forEach(marker => {
                    const markerLatLng = marker.getLatLng();
                    if (Math.abs(markerLatLng.lat - latlng[0]) < 0.001 && 
                        Math.abs(markerLatLng.lng - latlng[1]) < 0.001) {
                        marker.openPopup();
                    }
                });
            }
        }, 500);
        
        document.getElementById('searchModal').style.display = 'none';
    }
}

window.zoomToPoint = zoomToPoint;
window.showPointDetails = zoomToPoint;
window.filterToCounty = filterToCounty;
window.filterToSubcounty = filterToSubcounty;
window.filterToWard = filterToWard;
window.highlightFeature = highlightFeature;

// ============================================================================
// INITIALIZATION
// ============================================================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMap);
} else {
    initMap();
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        toggleFullscreen();
    }
    
    if (e.key === 'Escape' && highlightedFeature) {
        const style = layerStyles[highlightedFeatureType] || layerStyles.counties;
        highlightedFeature.setStyle(style);
        highlightedFeature = null;
        highlightedFeatureType = null;
    }
    
    if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        const infoPanel = document.getElementById('infoPanel');
        if (infoPanel) infoPanel.classList.toggle('active');
    }
    
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        openSearchModal();
    }
    
    if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        openHeatmapModal();
    }
    
    if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        openBufferModal();
    }
});

// Handle window resize
window.addEventListener('resize', function() {
    if (map) {
        map.invalidateSize();
    }
});


// ============================================================================
// DIRECT ANALYSIS DROPDOWN FIX
// ============================================================================

// ============================================================================
// SIMPLE ANALYSIS DROPDOWN FIX
// ============================================================================

(function() {
    console.log('Applying simple analysis dropdown fix...');
    
    // Wait for DOM to be fully loaded
    function initAnalysisDropdown() {
        const analysisBtn = document.getElementById('analysis-dropdown-btn');
        const analysisContent = document.getElementById('analysis-dropdown-content');
        
        if (!analysisBtn || !analysisContent) {
            console.log('Analysis dropdown not ready, retrying...');
            setTimeout(initAnalysisDropdown, 300);
            return;
        }
        
        console.log('Analysis dropdown found, applying fix...');
        
        // Remove any existing click handlers by cloning
        const newBtn = analysisBtn.cloneNode(true);
        analysisBtn.parentNode.replaceChild(newBtn, analysisBtn);
        
        // Simple toggle function
        newBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('Analysis dropdown clicked');
            
            // Close all other dropdowns
            document.querySelectorAll('.control-dropdown-content').forEach(content => {
                if (content.id !== 'analysis-dropdown-content') {
                    content.classList.remove('show');
                }
            });
            
            // Reset other chevrons
            document.querySelectorAll('.control-dropdown-btn .fa-chevron-down').forEach(chevron => {
                chevron.style.transform = 'rotate(0)';
            });
            
            // Toggle this dropdown
            analysisContent.classList.toggle('show');
            
            // Update chevron
            const chevron = newBtn.querySelector('.fa-chevron-down');
            if (chevron) {
                chevron.style.transform = analysisContent.classList.contains('show') ? 'rotate(180deg)' : 'rotate(0)';
            }
        };
        
        // Fix the analysis tool buttons
        const toolButtons = [
            'btn-heatmap-dropdown',
            'btn-cluster-dropdown',
            'btn-distribution-dropdown',
            'btn-buffer-dropdown',
            'btn-correlation-dropdown',
            'btn-water-quality-dropdown'
        ];
        
        toolButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                const newToolBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newToolBtn, btn);
                
                newToolBtn.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    console.log(`Tool clicked: ${id}`);
                    
                    // Close dropdown
                    analysisContent.classList.remove('show');
                    
                    // Reset chevron
                    const chevron = document.querySelector('#analysis-dropdown-btn .fa-chevron-down');
                    if (chevron) chevron.style.transform = 'rotate(0)';
                    
                    // Open modal
                    const modalMap = {
                        'btn-heatmap-dropdown': 'heatmapModal',
                        'btn-cluster-dropdown': 'clusterModal',
                        'btn-distribution-dropdown': 'distributionModal',
                        'btn-buffer-dropdown': 'bufferModal',
                        'btn-correlation-dropdown': 'correlationModal',
                        'btn-water-quality-dropdown': 'waterQualityModal'
                    };
                    
                    const modalId = modalMap[id];
                    const modal = document.getElementById(modalId);
                    if (modal) {
                        modal.style.display = 'block';
                    }
                };
            }
        });
        
        // Add CSS to ensure dropdown works
        const style = document.createElement('style');
        style.textContent = `
            #analysis-dropdown-content.control-dropdown-content {
                display: none !important;
                position: absolute !important;
                top: 100% !important;
                right: 0 !important;
                z-index: 10000 !important;
                background: white !important;
                border-radius: 8px !important;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2) !important;
                min-width: 250px !important;
                margin-top: 5px !important;
            }
            
            #analysis-dropdown-content.control-dropdown-content.show {
                display: block !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Start the initialization
    initAnalysisDropdown();
})();

console.log('Enhanced map_dashboard.js loaded successfully with full analytics integration');



// ============================================================================
// AUTO DEBUG - This will run automatically when you click
// ============================================================================

(function() {
    console.log('🔧 AUTO-DEBUG: Initialized');
    
    // Wait a bit for everything to load
    setTimeout(function() {
        const analysisBtn = document.getElementById('analysis-dropdown-btn');
        const analysisContent = document.getElementById('analysis-dropdown-content');
        
        if (!analysisBtn || !analysisContent) {
            console.log('❌ AUTO-DEBUG: Analysis elements not found!');
            return;
        }
        
        console.log('✅ AUTO-DEBUG: Found analysis button and content');
        
        // Store original click handler
        const originalClick = analysisBtn.onclick;
        
        // Wrap with debug
        analysisBtn.addEventListener('click', function(e) {
            console.log('\n🔴🔴🔴 ANALYSIS BUTTON CLICKED 🔴🔴🔴');
            console.log('Timestamp:', new Date().toISOString());
            
            // Log button state
            console.log('Button classes:', this.className);
            console.log('Button HTML:', this.outerHTML);
            
            // Log content state BEFORE click
            console.log('\n📊 BEFORE CLICK:');
            console.log('Content ID:', analysisContent.id);
            console.log('Content classes:', analysisContent.className);
            console.log('Has "show" class:', analysisContent.classList.contains('show'));
            
            // Get computed styles BEFORE
            const beforeStyle = window.getComputedStyle(analysisContent);
            console.log('Computed display BEFORE:', beforeStyle.display);
            console.log('Computed visibility BEFORE:', beforeStyle.visibility);
            console.log('Computed opacity BEFORE:', beforeStyle.opacity);
            console.log('Computed position BEFORE:', beforeStyle.position);
            console.log('Computed z-index BEFORE:', beforeStyle.zIndex);
            
            // Check parent elements
            console.log('\n📊 PARENT CHAIN:');
            let parent = analysisContent.parentElement;
            let level = 0;
            while (parent && level < 10) {
                const parentStyle = window.getComputedStyle(parent);
                console.log(`Parent ${level} (${parent.tagName}#${parent.id}):`);
                console.log(`  - display: ${parentStyle.display}`);
                console.log(`  - visibility: ${parentStyle.visibility}`);
                console.log(`  - overflow: ${parentStyle.overflow}`);
                console.log(`  - position: ${parentStyle.position}`);
                
                if (parentStyle.display === 'none') {
                    console.log(`  ⚠️⚠️⚠️ PARENT IS HIDING IT! display: none`);
                }
                if (parentStyle.visibility === 'hidden') {
                    console.log(`  ⚠️⚠️⚠️ PARENT IS HIDING IT! visibility: hidden`);
                }
                if (parentStyle.opacity === '0') {
                    console.log(`  ⚠️⚠️⚠️ PARENT IS HIDING IT! opacity: 0`);
                }
                parent = parent.parentElement;
                level++;
            }
            
            // Check all CSS rules
            console.log('\n📊 CSS RULES:');
            try {
                for (let i = 0; i < document.styleSheets.length; i++) {
                    const sheet = document.styleSheets[i];
                    try {
                        for (let j = 0; j < sheet.cssRules.length; j++) {
                            const rule = sheet.cssRules[j];
                            if (rule.selectorText && 
                                (rule.selectorText.includes('analysis-dropdown') || 
                                 rule.selectorText.includes('control-dropdown-content'))) {
                                console.log(`Rule [${i}:${j}] ${rule.selectorText}:`, rule.style.cssText);
                                
                                // Check if it has display:none
                                if (rule.style.display === 'none') {
                                    console.log(`  ⚠️ This rule sets display: none!`);
                                }
                            }
                        }
                    } catch(e) {
                        // CORS error, skip
                    }
                }
            } catch(e) {
                console.log('Error reading CSS rules:', e);
            }
            
            // Check if there are any inline styles hiding it
            if (analysisContent.style.display === 'none') {
                console.log('⚠️ Inline style sets display: none');
            }
            
            // Let the click propagate
            console.log('\n🔄 Letting click handler run...');
            
            // Check after a short delay
            setTimeout(function() {
                console.log('\n📊 AFTER CLICK (100ms delay):');
                console.log('Has "show" class NOW:', analysisContent.classList.contains('show'));
                
                const afterStyle = window.getComputedStyle(analysisContent);
                console.log('Computed display AFTER:', afterStyle.display);
                console.log('Computed visibility AFTER:', afterStyle.visibility);
                console.log('Computed opacity AFTER:', afterStyle.opacity);
                
                // Check if it's actually visible on screen
                const rect = analysisContent.getBoundingClientRect();
                console.log('Bounding rect:', rect);
                console.log('Is visible on screen:', 
                    rect.width > 0 && 
                    rect.height > 0 && 
                    afterStyle.display !== 'none' && 
                    afterStyle.visibility !== 'hidden' && 
                    afterStyle.opacity !== '0'
                );
                
                // Check if any other element is on top
                if (rect.width > 0 && rect.height > 0) {
                    const elementAtPoint = document.elementFromPoint(rect.left + 10, rect.top + 10);
                    console.log('Element at dropdown position:', elementAtPoint);
                    console.log('Is our dropdown on top?', elementAtPoint === analysisContent || analysisContent.contains(elementAtPoint));
                }
                
                console.log('🔴🔴🔴 DEBUG COMPLETE 🔴🔴🔴\n');
            }, 100);
        });
        
        console.log('✅ AUTO-DEBUG: Click handler wrapped with debug logging');
        
    }, 2000); // Wait 2 seconds for everything to load
})();