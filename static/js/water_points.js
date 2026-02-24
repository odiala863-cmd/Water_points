// water_points.js - Enhanced water points functionality

// Global variables for water points
let waterPointsLayer;
let waterPointsCluster;
let waterPointsMarkers = [];
let currentWaterPointsDisplay = 'cluster';
let waterPointsData = [];
let waterPointsFiltered = [];
let waterPointsChart = null;
let waterPointsSummary = {
    total: 0,
    functional: 0,
    nonFunctional: 0,
    needsRepair: 0,
    unknown: 0
};

// Initialize water points functionality
function initWaterPoints() {
    console.log('Initializing water points functionality...');
    
    // Create water points layer
    waterPointsLayer = L.layerGroup();
    waterPointsCluster = L.markerClusterGroup({
        chunkedLoading: true,
        chunkDelay: 100,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: function(cluster) {
            const count = cluster.getChildCount();
            let size = 'small';
            if (count > 50) size = 'large';
            else if (count > 20) size = 'medium';
            
            return L.divIcon({
                html: `<div>${count}</div>`,
                className: `marker-cluster marker-cluster-${size}`,
                iconSize: L.point(40, 40)
            });
        }
    });
    
    // Load initial water points
    loadWaterPoints();
    
    // Setup water points event handlers
    setupWaterPointsEventHandlers();
    
    // Setup search functionality
    setupSearch();
    
    // Setup summary panel
    setupSummaryPanel();
    
    console.log('Water points functionality initialized');
}

// Load water points with filters
async function loadWaterPoints(countyId = 'all', subcountyId = 'all', wardId = 'all', status = 'all', sourceTypeId = 'all') {
    try {
        showNotification('Loading Water Points', 'Fetching water points data...', 'info');
        
        // Build URL with filters
        let url = '/api/water-points/';
        const params = new URLSearchParams();
        
        if (countyId !== 'all') params.append('county_id', countyId);
        if (subcountyId !== 'all') params.append('subcounty_id', subcountyId);
        if (wardId !== 'all') params.append('ward_id', wardId);
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        // Store data
        waterPointsData = data.features || [];
        waterPointsFiltered = [...waterPointsData];
        
        // Apply additional filters
        applyWaterPointsFilters(status, sourceTypeId);
        
        // Update summary statistics
        updateWaterPointsSummary();
        
        // Render water points on map
        renderWaterPoints();
        
        // Update UI
        updateWaterPointsCount();
        updateSummaryPanel();
        
        showNotification('Water Points Loaded', `Loaded ${waterPointsFiltered.length} water points`, 'success');
        
    } catch (error) {
        console.error('Error loading water points:', error);
        showNotification('Loading Error', 'Failed to load water points data', 'error');
    }
}

// Apply additional filters to water points
function applyWaterPointsFilters(status, sourceTypeId) {
    waterPointsFiltered = waterPointsData.filter(point => {
        const props = point.properties;
        let pass = true;
        
        // Status filter
        if (status !== 'all') {
            const pointStatus = props.status ? props.status.toLowerCase() : 'unknown';
            if (status === 'functional' && !pointStatus.includes('functional')) pass = false;
            else if (status === 'non-functional' && !pointStatus.includes('non-functional')) pass = false;
            else if (status === 'needs_repair' && !pointStatus.includes('repair')) pass = false;
            else if (status === 'unknown' && pointStatus !== 'unknown') pass = false;
        }
        
        // Source type filter
        if (sourceTypeId !== 'all') {
            // You'll need to implement this based on your data structure
            // For now, we'll just pass all if source type filter is applied
            // pass = props.water_source_type_id == sourceTypeId;
        }
        
        return pass;
    });
}

// Render water points on map
function renderWaterPoints() {
    // Clear existing water points
    waterPointsLayer.clearLayers();
    waterPointsCluster.clearLayers();
    waterPointsMarkers = [];
    
    // Remove from map
    if (map.hasLayer(waterPointsLayer)) map.removeLayer(waterPointsLayer);
    if (map.hasLayer(waterPointsCluster)) map.removeLayer(waterPointsCluster);
    
    // Create markers
    waterPointsFiltered.forEach(point => {
        const marker = createWaterPointMarker(point);
        waterPointsMarkers.push(marker);
        
        if (currentWaterPointsDisplay === 'cluster') {
            waterPointsCluster.addLayer(marker);
        } else {
            waterPointsLayer.addLayer(marker);
        }
    });
    
    // Add to map based on display mode
    if (currentWaterPointsDisplay === 'cluster') {
        waterPointsCluster.addTo(map);
    } else {
        waterPointsLayer.addTo(map);
    }
    
    // Fit bounds to show all water points if we have points
    if (waterPointsFiltered.length > 0) {
        const bounds = waterPointsCluster.getBounds().isValid() ? 
            waterPointsCluster.getBounds() : waterPointsLayer.getBounds();
        
        if (bounds.isValid()) {
            setTimeout(() => {
                map.fitBounds(bounds, {
                    padding: [50, 50],
                    maxZoom: 12,
                    animate: true,
                    duration: 1
                });
            }, 100);
        }
    }
}

// Create a water point marker
function createWaterPointMarker(point) {
    const props = point.properties;
    const latlng = [point.geometry.coordinates[1], point.geometry.coordinates[0]];
    
    // Create custom icon based on status
    const icon = L.divIcon({
        html: `
            <div class="water-point-marker" style="
                width: 24px;
                height: 24px;
                background: ${props.status_color};
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                cursor: pointer;
                position: relative;
            ">
                <div style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: white;
                    font-size: 10px;
                    font-weight: bold;
                ">
                    <i class="fas fa-water"></i>
                </div>
            </div>
        `,
        className: 'water-point-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
    
    // Create marker
    const marker = L.marker(latlng, { icon: icon });
    
    // Add popup
    const popupContent = createWaterPointPopup(props);
    marker.bindPopup(popupContent, {
        maxWidth: 300,
        minWidth: 250,
        className: 'water-point-popup'
    });
    
    // Add click handler
    marker.on('click', function(e) {
        highlightWaterPoint(marker, props);
        updateWaterPointInfoPanel(props);
    });
    
    return marker;
}

// Create popup content for water point
function createWaterPointPopup(props) {
    return `
        <div style="padding: 10px; max-width: 300px;">
            <h4 style="margin: 0 0 10px 0; color: ${props.status_color}; border-bottom: 2px solid ${props.status_color}; padding-bottom: 5px;">
                <i class="fas fa-water"></i> ${props.name}
            </h4>
            <div style="font-size: 14px; color: #475569;">
                <p style="margin: 5px 0;">
                    <strong><i class="fas fa-map-marker-alt"></i> Location:</strong><br>
                    ${props.county ? `${props.county}, ` : ''}
                    ${props.subcounty ? `${props.subcounty}, ` : ''}
                    ${props.ward || ''}
                </p>
                <p style="margin: 5px 0;">
                    <strong><i class="fas fa-check-circle"></i> Status:</strong> 
                    <span style="color: ${props.status_color}; font-weight: 600;">${props.status}</span>
                </p>
                <p style="margin: 5px 0;">
                    <strong><i class="fas fa-faucet"></i> Type:</strong> ${props.water_source_type}
                </p>
                ${props.depth ? `<p style="margin: 5px 0;"><strong><i class="fas fa-ruler-vertical"></i> Depth:</strong> ${props.depth}m</p>` : ''}
                ${props.yield_rate ? `<p style="margin: 5px 0;"><strong><i class="fas fa-tint"></i> Yield:</strong> ${props.yield_rate} m³/hr</p>` : ''}
                ${props.population_served ? `<p style="margin: 5px 0;"><strong><i class="fas fa-users"></i> Population Served:</strong> ${props.population_served.toLocaleString()}</p>` : ''}
            </div>
            <div style="margin-top: 15px; display: flex; gap: 10px;">
                <button onclick="zoomToWaterPoint(${props.id})" style="flex: 1; background: ${props.status_color}; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 13px;">
                    <i class="fas fa-search"></i> Zoom
                </button>
                <button onclick="showWaterPointDetails(${props.id})" style="flex: 1; background: #3498db; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 13px;">
                    <i class="fas fa-info-circle"></i> Details
                </button>
            </div>
        </div>
    `;
}

// Highlight a water point
function highlightWaterPoint(marker, props) {
    // Remove previous highlights
    waterPointsMarkers.forEach(m => {
        m.setStyle && m.setStyle({ weight: 2 });
        m.setZIndexOffset && m.setZIndexOffset(0);
    });
    
    // Highlight current marker
    if (marker.setStyle) {
        marker.setStyle({ weight: 4, color: '#ec4899' });
        marker.setZIndexOffset(1000);
        marker.bringToFront();
    }
    
    // Store reference
    highlightedWaterPoint = { marker, props };
}

// Update water point info panel
function updateWaterPointInfoPanel(props) {
    const infoTitle = document.getElementById('infoTitle');
    const infoContent = document.getElementById('infoContent');
    
    infoTitle.textContent = props.name || 'Water Point Details';
    
    const html = `
        <div class="info-detail-grid">
            <div class="info-detail-item">
                <div class="info-detail-label">Status</div>
                <div class="info-detail-value" style="color: ${props.status_color}">
                    <i class="fas fa-circle" style="font-size: 0.7em; margin-right: 5px;"></i>
                    ${props.status}
                </div>
            </div>
            
            <div class="info-detail-item">
                <div class="info-detail-label">Location</div>
                <div class="info-detail-value">${props.county || 'N/A'}</div>
            </div>
            
            ${props.subcounty ? `
            <div class="info-detail-item">
                <div class="info-detail-label">Sub-County</div>
                <div class="info-detail-value">${props.subcounty}</div>
            </div>` : ''}
            
            ${props.ward ? `
            <div class="info-detail-item">
                <div class="info-detail-label">Ward</div>
                <div class="info-detail-value">${props.ward}</div>
            </div>` : ''}
            
            ${props.water_source_type ? `
            <div class="info-detail-item">
                <div class="info-detail-label">Water Source</div>
                <div class="info-detail-value">${props.water_source_type}</div>
            </div>` : ''}
            
            ${props.depth ? `
            <div class="info-detail-item">
                <div class="info-detail-label">Depth</div>
                <div class="info-detail-value">${props.depth}m</div>
            </div>` : ''}
            
            ${props.yield_rate ? `
            <div class="info-detail-item">
                <div class="info-detail-label">Yield Rate</div>
                <div class="info-detail-value">${props.yield_rate} m³/hr</div>
            </div>` : ''}
            
            ${props.population_served ? `
            <div class="info-detail-item">
                <div class="info-detail-label">Population Served</div>
                <div class="info-detail-value">${props.population_served.toLocaleString()}</div>
            </div>` : ''}
            
            ${props.construction_year ? `
            <div class="info-detail-item">
                <div class="info-detail-label">Construction Year</div>
                <div class="info-detail-value">${props.construction_year}</div>
            </div>` : ''}
            
            ${props.pump_type ? `
            <div class="info-detail-item">
                <div class="info-detail-label">Pump Type</div>
                <div class="info-detail-value">${props.pump_type}</div>
            </div>` : ''}
            
            ${props.management ? `
            <div class="info-detail-item">
                <div class="info-detail-label">Management</div>
                <div class="info-detail-value">${props.management}</div>
            </div>` : ''}
            
            ${props.water_quality ? `
            <div class="info-detail-item">
                <div class="info-detail-label">Water Quality</div>
                <div class="info-detail-value">${props.water_quality}</div>
            </div>` : ''}
        </div>
        
        ${props.remarks ? `
        <div style="margin-top: 1rem;">
            <div class="info-detail-label">Remarks</div>
            <div style="font-size: 0.875rem; color: var(--light-text); padding: 0.5rem; background: var(--light-bg); border-radius: var(--radius-sm);">
                ${props.remarks}
            </div>
        </div>` : ''}
        
        <div class="info-actions">
            <button class="info-action-btn" onclick="zoomToWaterPoint(${props.id})">
                <i class="fas fa-search"></i> Zoom
            </button>
            <button class="info-action-btn primary" onclick="exportWaterPoint(${props.id})">
                <i class="fas fa-download"></i> Export
            </button>
            <button class="info-action-btn" onclick="shareWaterPoint(${props.id})">
                <i class="fas fa-share"></i> Share
            </button>
        </div>
    `;
    
    infoContent.innerHTML = html;
    document.getElementById('infoPanel').classList.add('active');
}

// Update water points summary statistics
function updateWaterPointsSummary() {
    waterPointsSummary = {
        total: waterPointsFiltered.length,
        functional: waterPointsFiltered.filter(p => 
            p.properties.status && p.properties.status.toLowerCase().includes('functional')
        ).length,
        nonFunctional: waterPointsFiltered.filter(p => 
            p.properties.status && p.properties.status.toLowerCase().includes('non-functional')
        ).length,
        needsRepair: waterPointsFiltered.filter(p => 
            p.properties.status && p.properties.status.toLowerCase().includes('repair')
        ).length,
        unknown: waterPointsFiltered.filter(p => 
            !p.properties.status || p.properties.status.toLowerCase() === 'unknown'
        ).length
    };
}

// Update water points count display
function updateWaterPointsCount() {
    const countElement = document.getElementById('water-points-count-dropdown');
    if (countElement) {
        countElement.textContent = `${waterPointsFiltered.length} points`;
    }
    
    // Update sidebar summary
    document.getElementById('summary-functional').textContent = waterPointsSummary.functional;
    document.getElementById('summary-non-functional').textContent = waterPointsSummary.nonFunctional;
    document.getElementById('summary-needs-repair').textContent = waterPointsSummary.needsRepair;
    document.getElementById('summary-unknown').textContent = waterPointsSummary.unknown;
}

// Setup water points event handlers
function setupWaterPointsEventHandlers() {
    // Display mode options
    const displayOptions = document.querySelectorAll('.display-option');
    displayOptions.forEach(option => {
        option.addEventListener('click', function() {
            const displayMode = this.dataset.display;
            
            // Update active state
            displayOptions.forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');
            
            // Change display mode
            changeWaterPointsDisplay(displayMode);
            
            // Close dropdown
            document.getElementById('layers-dropdown-content').classList.remove('show');
        });
    });
    
    // Water points layer toggle
    document.getElementById('toggle-water-points-dropdown').addEventListener('change', function() {
        if (this.checked) {
            waterPointsLayer.addTo(map);
            waterPointsCluster.addTo(map);
            document.getElementById('water-points-layer-control-dropdown').classList.add('active');
            
            // Load water points if not loaded
            if (waterPointsFiltered.length === 0) {
                loadWaterPoints(
                    selectedCounty,
                    selectedSubcounty,
                    selectedWard,
                    document.getElementById('status-select').value,
                    document.getElementById('source-type-select').value
                );
            }
        } else {
            map.removeLayer(waterPointsLayer);
            map.removeLayer(waterPointsCluster);
            document.getElementById('water-points-layer-control-dropdown').classList.remove('active');
        }
    });
    
    // Status filter
    document.getElementById('status-select').addEventListener('change', function() {
        applyFilters();
    });
    
    // Source type filter
    document.getElementById('source-type-select').addEventListener('change', function() {
        applyFilters();
    });
    
    // Refresh button
    document.getElementById('tool-refresh-dropdown').addEventListener('click', function() {
        loadWaterPoints(
            selectedCounty,
            selectedSubcounty,
            selectedWard,
            document.getElementById('status-select').value,
            document.getElementById('source-type-select').value
        );
        showNotification('Refreshing', 'Updating water points data...', 'info');
    });
}

// Change water points display mode
function changeWaterPointsDisplay(mode) {
    if (currentWaterPointsDisplay === mode) return;
    
    currentWaterPointsDisplay = mode;
    
    // Remove current display
    if (currentWaterPointsDisplay === 'cluster') {
        map.removeLayer(waterPointsLayer);
        waterPointsCluster.clearLayers();
        waterPointsMarkers.forEach(marker => waterPointsCluster.addLayer(marker));
        waterPointsCluster.addTo(map);
    } else {
        map.removeLayer(waterPointsCluster);
        waterPointsLayer.clearLayers();
        waterPointsMarkers.forEach(marker => waterPointsLayer.addLayer(marker));
        waterPointsLayer.addTo(map);
    }
    
    showNotification('Display Mode', `Switched to ${mode} view`, 'info');
}

// Setup search functionality
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');
    const searchResults = document.getElementById('searchResults');
    
    let searchTimeout;
    
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        
        if (this.value.trim() === '') {
            searchResults.classList.remove('show');
            searchClear.style.display = 'none';
            return;
        }
        
        searchClear.style.display = 'block';
        
        searchTimeout = setTimeout(() => {
            performSearch(this.value.trim());
        }, 300);
    });
    
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            clearTimeout(searchTimeout);
            performSearch(this.value.trim());
        }
    });
    
    searchClear.addEventListener('click', function() {
        searchInput.value = '';
        searchResults.classList.remove('show');
        this.style.display = 'none';
        searchInput.focus();
    });
    
    // Close search results when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('#searchContainer')) {
            searchResults.classList.remove('show');
        }
    });
}

// Perform search
async function performSearch(query) {
    if (!query || query.length < 2) {
        document.getElementById('searchResults').innerHTML = '';
        document.getElementById('searchResults').classList.remove('show');
        return;
    }
    
    try {
        // For now, we'll search within loaded water points
        const results = waterPointsFiltered.filter(point => {
            const props = point.properties;
            const searchText = `${props.name} ${props.county} ${props.subcounty} ${props.ward}`.toLowerCase();
            return searchText.includes(query.toLowerCase());
        }).slice(0, 10); // Limit to 10 results
        
        displaySearchResults(results, query);
        
    } catch (error) {
        console.error('Search error:', error);
    }
}

// Display search results
function displaySearchResults(results, query) {
    const searchResults = document.getElementById('searchResults');
    
    if (results.length === 0) {
        searchResults.innerHTML = `
            <div class="search-result-item" style="justify-content: center; color: var(--light-text-secondary);">
                <i class="fas fa-search" style="margin-right: 8px;"></i>
                No water points found for "${query}"
            </div>
        `;
        searchResults.classList.add('show');
        return;
    }
    
    let html = '';
    
    results.forEach(point => {
        const props = point.properties;
        
        html += `
            <div class="search-result-item" onclick="zoomToSearchResult(${point.geometry.coordinates[1]}, ${point.geometry.coordinates[0]}, ${props.id})">
                <div class="search-result-icon" style="background: ${props.status_color};">
                    <i class="fas fa-water"></i>
                </div>
                <div class="search-result-content">
                    <div class="search-result-name">${props.name}</div>
                    <div class="search-result-details">
                        <span>
                            <i class="fas fa-map-marker-alt"></i>
                            ${props.county || 'Unknown'}
                        </span>
                        <span>
                            <i class="fas fa-check-circle"></i>
                            ${props.status}
                        </span>
                    </div>
                </div>
                <div class="search-result-arrow">
                    <i class="fas fa-chevron-right"></i>
                </div>
            </div>
        `;
    });
    
    searchResults.innerHTML = html;
    searchResults.classList.add('show');
}

// Setup summary panel
function setupSummaryPanel() {
    const summaryToggle = document.getElementById('summaryToggle');
    const summaryPanel = document.getElementById('summaryPanel');
    
    summaryToggle.addEventListener('click', function() {
        summaryPanel.classList.toggle('collapsed');
    });
    
    // Initialize chart
    initWaterPointsChart();
}

// Initialize water points chart
function initWaterPointsChart() {
    const ctx = document.getElementById('summaryChart').getContext('2d');
    
    waterPointsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Functional', 'Non-Functional', 'Needs Repair', 'Unknown'],
            datasets: [{
                data: [0, 0, 0, 0],
                backgroundColor: [
                    '#2ecc71',
                    '#e74c3c',
                    '#f39c12',
                    '#95a5a6'
                ],
                borderColor: 'white',
                borderWidth: 2,
                hoverOffset: 4
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
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '70%'
        }
    });
}

// Update summary panel
function updateSummaryPanel() {
    // Update stats
    document.getElementById('filtered-count').textContent = waterPointsSummary.total;
    document.getElementById('filtered-functional').textContent = waterPointsSummary.functional;
    document.getElementById('filtered-non-functional').textContent = waterPointsSummary.nonFunctional;
    
    // Update chart
    if (waterPointsChart) {
        waterPointsChart.data.datasets[0].data = [
            waterPointsSummary.functional,
            waterPointsSummary.nonFunctional,
            waterPointsSummary.needsRepair,
            waterPointsSummary.unknown
        ];
        waterPointsChart.update();
    }
}

// Utility functions
function zoomToWaterPoint(pointId) {
    const point = waterPointsFiltered.find(p => p.properties.id == pointId);
    if (point) {
        const latlng = [point.geometry.coordinates[1], point.geometry.coordinates[0]];
        map.setView(latlng, 14, { animate: true, duration: 1.5 });
        
        // Open popup
        const marker = waterPointsMarkers.find(m => 
            m.getLatLng().lat === latlng[0] && m.getLatLng().lng === latlng[1]
        );
        if (marker) {
            marker.openPopup();
        }
    }
}

function zoomToSearchResult(lat, lng, pointId) {
    map.setView([lat, lng], 14, { animate: true, duration: 1.5 });
    
    // Close search results
    document.getElementById('searchResults').classList.remove('show');
    document.getElementById('searchInput').value = '';
    document.getElementById('searchClear').style.display = 'none';
    
    // Find and open popup
    setTimeout(() => {
        const marker = waterPointsMarkers.find(m => 
            m.getLatLng().lat === lat && m.getLatLng().lng === lng
        );
        if (marker) {
            marker.openPopup();
        }
    }, 500);
}

function showWaterPointDetails(pointId) {
    // Fetch detailed information
    fetch(`/api/water-point/${pointId}/`)
        .then(response => response.json())
        .then(data => {
            updateWaterPointInfoPanel(data);
        })
        .catch(error => {
            console.error('Error fetching water point details:', error);
            showNotification('Error', 'Failed to load water point details', 'error');
        });
}

function exportWaterPoint(pointId) {
    const url = `/api/export/water-point/${pointId}/`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `water_point_${pointId}.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    showNotification('Export', 'Water point data exported', 'success');
}

function shareWaterPoint(pointId) {
    const point = waterPointsFiltered.find(p => p.properties.id == pointId);
    if (point) {
        const lat = point.geometry.coordinates[1];
        const lng = point.geometry.coordinates[0];
        const url = `${window.location.origin}/map/?lat=${lat}&lng=${lng}&point=${pointId}`;
        
        if (navigator.share) {
            navigator.share({
                title: point.properties.name,
                text: `Water Point: ${point.properties.name}`,
                url: url
            });
        } else {
            navigator.clipboard.writeText(url);
            showNotification('Link Copied', 'Water point link copied to clipboard', 'success');
        }
    }
}

// Update applyFilters function to include water points
function applyFilters() {
    showNotification('Applying Filters', 'Loading filtered data...', 'info');
    
    // Get filter values
    const countyId = document.getElementById('county-select').value;
    const subcountyId = document.getElementById('subcounty-select').value;
    const wardId = document.getElementById('ward-select').value;
    const status = document.getElementById('status-select').value;
    const sourceTypeId = document.getElementById('source-type-select').value;
    
    // Update global variables
    selectedCounty = countyId;
    selectedSubcounty = subcountyId;
    selectedWard = wardId;
    
    // Load boundaries
    loadCounties(countyId);
    loadSubcounties(countyId);
    loadWards(subcountyId, countyId);
    
    // Load water points with filters
    loadWaterPoints(countyId, subcountyId, wardId, status, sourceTypeId);
    
    showNotification('Filters Applied', 'Data filtered successfully!', 'success');
}

// Update resetFilters function
function resetFilters() {
    document.getElementById('county-select').value = 'all';
    document.getElementById('subcounty-select').value = 'all';
    document.getElementById('subcounty-select').disabled = true;
    document.getElementById('ward-select').value = 'all';
    document.getElementById('ward-select').disabled = true;
    document.getElementById('status-select').value = 'all';
    document.getElementById('source-type-select').value = 'all';
    
    selectedCounty = 'all';
    selectedSubcounty = 'all';
    selectedWard = 'all';
    
    // Reset to default view
    map.setView([0.5, 37.5], 7, { animate: true, duration: 1.5 });
    
    applyFilters();
    showNotification('Filters Reset', 'All filters have been reset', 'info');
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize water points after map is initialized
    setTimeout(initWaterPoints, 1000);
});

// Add keyboard shortcuts for water points
document.addEventListener('keydown', function(e) {
    // W to toggle water points layer
    if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        const toggle = document.getElementById('toggle-water-points-dropdown');
        toggle.checked = !toggle.checked;
        toggle.dispatchEvent(new Event('change'));
    }
    
    // S to focus search
    if (e.key === 's' || e.key === 'S') {
        if (!e.target.matches('input, textarea')) {
            e.preventDefault();
            document.getElementById('searchInput').focus();
        }
    }
});