class AnalyticsMap {
    constructor() {
        this.map = null;
        this.init();
    }
    
    init() {
        if (!document.getElementById('water-points-map')) return;
        
        // Initialize map
        this.map = L.map('water-points-map').setView([-1.2921, 36.8219], 8);
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
        
        // Load county boundaries
        this.loadCountyBoundaries();
        
        // Load water points
        this.loadWaterPoints();
    }
    
    loadCountyBoundaries() {
        // Fetch county boundaries from your API
        fetch('/api/analytics/geographical-boundaries/?format=geojson')
            .then(response => response.json())
            .then(data => {
                L.geoJSON(data, {
                    style: {
                        color: '#3388ff',
                        weight: 2,
                        fillOpacity: 0.1
                    }
                }).addTo(this.map);
            })
            .catch(error => console.error('Error loading boundaries:', error));
    }
    
    loadWaterPoints() {
        // Fetch water points
        fetch('/api/analytics/export/?format=geojson&limit=1000')
            .then(response => response.json())
            .then(data => {
                L.geoJSON(data, {
                    pointToLayer: (feature, latlng) => {
                        return L.circleMarker(latlng, {
                            radius: this.getRadius(feature.properties.yield),
                            fillColor: this.getColor(feature.properties.status),
                            color: '#fff',
                            weight: 1,
                            opacity: 1,
                            fillOpacity: 0.8
                        });
                    },
                    onEachFeature: (feature, layer) => {
                        layer.bindPopup(this.createPopup(feature.properties));
                    }
                }).addTo(this.map);
            })
            .catch(error => console.error('Error loading water points:', error));
    }
    
    getRadius(yieldValue) {
        return Math.min(Math.max(parseFloat(yieldValue) || 3, 3), 12);
    }
    
    getColor(status) {
        const statusLower = (status || '').toLowerCase();
        if (statusLower.includes('functional')) return '#28a745';
        if (statusLower.includes('non-functional')) return '#dc3545';
        if (statusLower.includes('repair')) return '#ffc107';
        return '#6c757d';
    }
    
    createPopup(properties) {
        return `
            <strong>${properties.county || 'Unknown'}</strong><br>
            Sub-County: ${properties.subcounty || 'Unknown'}<br>
            Status: ${properties.status || 'Unknown'}<br>
            Yield: ${properties.yield || 'N/A'} m³/h<br>
            pH: ${properties.ph || 'N/A'}
        `;
    }
}

// Initialize map when dashboard loads
document.addEventListener('DOMContentLoaded', () => {
    if (typeof AnalyticsDashboard !== 'undefined') {
        setTimeout(() => {
            window.analyticsMap = new AnalyticsMap();
        }, 500);
    }
});