// water_points_new.js - Advanced Water Points with Multi-Factor Status Detection
// This file extends and enhances the water points functionality with sophisticated
// status determination based on multiple parameters

// ============================================================================
// ENHANCED WATER POINT STATUS DETECTION
// ============================================================================

// Global variables for enhanced water points
let enhancedWaterPointsData = [];
let enhancedWaterPointsMarkers = [];
let currentVizMode = 'status'; // status, source, year, water_quality

// Water quality thresholds (based on WHO standards)
const WATER_QUALITY_THRESHOLDS = {
    ph: { min: 6.5, max: 8.5, optimal: 7.0 },
    ec: { 
        excellent: 400,      // <400 µS/cm - Excellent
        good: 800,           // 400-800 - Good
        fair: 1500,         // 800-1500 - Fair
        poor: 2500         // >1500 - Poor
    },
    temperature: { max: 30 }, // >30°C - Potential issue
    yield: {
        low: 5,            // <5 m³/hr - Low yield
        medium: 15,        // 5-15 m³/hr - Medium yield
        high: 30          // >15 m³/hr - High yield
    }
};

// Status definitions with enhanced criteria
const ENHANCED_STATUS_DEFINITIONS = {
    functional: {
        color: '#2ecc71',
        icon: 'fa-check-circle',
        description: 'Fully operational',
        criteria: {
            status_keywords: ['functional', 'working', 'operational'],
            min_yield: 1,
            max_ec: 1500,
            ph_range: { min: 6.0, max: 9.0 }
        }
    },
    likely_functional: {
        color: '#3498db',
        icon: 'fa-question-circle',
        description: 'Likely operational (status not recorded)',
        criteria: {
            has_coordinates: true,
            has_depth: true,
            has_yield: true
        }
    },
    needs_attention: {
        color: '#f39c12',
        icon: 'fa-exclamation-triangle',
        description: 'Functional but needs attention',
        criteria: {
            water_quality_issues: true,
            ph_out_of_range: true,
            ec_high: true,
            temperature_high: true
        }
    },
    non_functional: {
        color: '#e74c3c',
        icon: 'fa-times-circle',
        description: 'Not operational',
        criteria: {
            status_keywords: ['non-functional', 'broken', 'damaged', 'abandoned']
        }
    },
    needs_repair: {
        color: '#f39c12',
        icon: 'fa-tools',
        description: 'Needs maintenance/repair',
        criteria: {
            status_keywords: ['repair', 'maintenance', 'rehab']
        }
    },
    unknown: {
        color: '#95a5a6',
        icon: 'fa-question',
        description: 'Status unknown',
        criteria: {}
    }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

function initEnhancedWaterPoints() {
    console.log('Initializing enhanced water points with multi-factor status detection...');
    
    // Create enhanced layers
    createEnhancedLayers();
    
    // Setup visualization options
    setupVisualizationOptions();
    
    // Setup analysis tools
    setupAnalysisTools();
    
    // Load enhanced water point data
    loadEnhancedWaterPoints();
    
    console.log('Enhanced water points initialized');
}

function createEnhancedLayers() {
    // Create separate layers for different visualization modes
    window.enhancedWaterPointsLayer = L.layerGroup();
    window.enhancedWaterPointsCluster = L.markerClusterGroup({
        chunkedLoading: true,
        chunkDelay: 100,
        maxClusterRadius: 60,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: createEnhancedClusterIcon
    });
}

// ============================================================================
// ENHANCED STATUS DETECTION ENGINE
// ============================================================================

function determineEnhancedStatus(point) {
    const props = point.properties || point;
    
    // Initialize status object
    const status = {
        primary: 'unknown',
        color: ENHANCED_STATUS_DEFINITIONS.unknown.color,
        icon: ENHANCED_STATUS_DEFINITIONS.unknown.icon,
        description: ENHANCED_STATUS_DEFINITIONS.unknown.description,
        confidence: 0,
        issues: [],
        water_quality: {},
        parameters: {}
    };
    
    // Extract available parameters
    const parameters = extractWaterParameters(props);
    status.parameters = parameters;
    
    // Check water quality
    const waterQuality = analyzeWaterQuality(parameters);
    status.water_quality = waterQuality;
    
    // 1. Check explicit status field
    if (props.status || props.operation_field) {
        const explicitStatus = (props.status || props.operation_field || '').toLowerCase();
        
        if (explicitStatus.includes('functional') && !explicitStatus.includes('non')) {
            // Check for water quality issues
            if (waterQuality.hasIssues) {
                status.primary = 'needs_attention';
                status.color = ENHANCED_STATUS_DEFINITIONS.needs_attention.color;
                status.icon = ENHANCED_STATUS_DEFINITIONS.needs_attention.icon;
                status.description = 'Functional but has water quality issues';
                status.confidence = 0.8;
                status.issues = waterQuality.issues;
            } else {
                status.primary = 'functional';
                status.color = ENHANCED_STATUS_DEFINITIONS.functional.color;
                status.icon = ENHANCED_STATUS_DEFINITIONS.functional.icon;
                status.description = 'Fully operational';
                status.confidence = 0.95;
            }
            return status;
        }
        
        if (explicitStatus.includes('non-functional') || explicitStatus.includes('broken') || 
            explicitStatus.includes('damaged') || explicitStatus.includes('abandoned')) {
            status.primary = 'non_functional';
            status.color = ENHANCED_STATUS_DEFINITIONS.non_functional.color;
            status.icon = ENHANCED_STATUS_DEFINITIONS.non_functional.icon;
            status.description = 'Not operational';
            status.confidence = 0.9;
            status.issues.push('Reported as non-functional');
            return status;
        }
        
        if (explicitStatus.includes('repair') || explicitStatus.includes('maintenance') || 
            explicitStatus.includes('rehab')) {
            status.primary = 'needs_repair';
            status.color = ENHANCED_STATUS_DEFINITIONS.needs_repair.color;
            status.icon = ENHANCED_STATUS_DEFINITIONS.needs_repair.icon;
            status.description = 'Needs maintenance/repair';
            status.confidence = 0.85;
            return status;
        }
    }
    
    // 2. No explicit status - infer from available data
    if (parameters.has_coordinates) {
        // Check if it has yield data
        if (parameters.yield_value !== null && !isNaN(parameters.yield_value)) {
            if (parameters.yield_value > 0) {
                // Has positive yield - likely functional
                if (waterQuality.hasIssues) {
                    status.primary = 'needs_attention';
                    status.color = ENHANCED_STATUS_DEFINITIONS.needs_attention.color;
                    status.icon = ENHANCED_STATUS_DEFINITIONS.needs_attention.icon;
                    status.description = 'Likely operational but has quality issues';
                    status.confidence = 0.7;
                    status.issues = waterQuality.issues;
                } else {
                    status.primary = 'likely_functional';
                    status.color = ENHANCED_STATUS_DEFINITIONS.likely_functional.color;
                    status.icon = ENHANCED_STATUS_DEFINITIONS.likely_functional.icon;
                    status.description = 'Likely operational (yield data available)';
                    status.confidence = 0.6;
                }
                return status;
            }
        }
        
        // Has depth but no yield - possibly functional
        if (parameters.well_depth && parseFloat(parameters.well_depth) > 0) {
            status.primary = 'likely_functional';
            status.color = ENHANCED_STATUS_DEFINITIONS.likely_functional.color;
            status.icon = ENHANCED_STATUS_DEFINITIONS.likely_functional.icon;
            status.description = 'Possibly operational (depth data available)';
            status.confidence = 0.4;
            return status;
        }
    }
    
    // 3. Check for abandonment indicators
    if (parameters.elevation === 'abandoned' || 
        parameters.operation_field === 'abandoned' ||
        parameters.status_cle === 'abandoned') {
        status.primary = 'non_functional';
        status.color = ENHANCED_STATUS_DEFINITIONS.non_functional.color;
        status.icon = ENHANCED_STATUS_DEFINITIONS.non_functional.icon;
        status.description = 'Abandoned';
        status.confidence = 0.95;
        status.issues.push('Marked as abandoned');
        return status;
    }
    
    // 4. Default to unknown with available metadata
    status.primary = 'unknown';
    status.color = ENHANCED_STATUS_DEFINITIONS.unknown.color;
    status.icon = ENHANCED_STATUS_DEFINITIONS.unknown.icon;
    status.description = 'Status unknown';
    status.confidence = 0.2;
    
    if (parameters.has_coordinates) {
        status.description += ' (has location)';
    }
    
    return status;
}

// Extract all available water parameters from point properties
function extractWaterParameters(props) {
    return {
        // Status fields
        status: props.status || props.status_cle || props.operation_field,
        status_id: props.status_id,
        
        // Location
        has_coordinates: !!(props.latitude || props.lat_deg) && !!(props.longitude || props.lon_deg),
        latitude: props.latitude || props.lat_deg,
        longitude: props.longitude || props.lon_deg,
        
        // Yield and depth
        yield_value: parseFloat(props.yield_value || props.yield),
        well_depth: parseFloat(props.well_depth || props.depth),
        
        // Water quality
        ph: parseFloat(props.ph),
        ec: parseFloat(props.ec),
        temperature: parseFloat(props.temperature || props.temperatur),
        
        // Source information
        water_source: props.water_sour || props.source,
        water_tech: props.water_tech || props.first_stru,
        
        // Operational
        operation_field: props.operation_field,
        drilling_e: props.drilling_e,
        
        // Administrative
        county: props.admin_1 || props.clean_adm1,
        subcounty: props.locality || props.clean_adm2,
        ward: props.clean_adm3,
        
        // Additional
        elevation: props.elevation,
        installer: props.installer,
        install_year: props.install_ye,
        management: props.management
    };
}

// Comprehensive water quality analysis
function analyzeWaterQuality(params) {
    const analysis = {
        isSafe: true,
        hasIssues: false,
        issues: [],
        score: 100, // 0-100, higher is better
        details: {}
    };
    
    // Check PH level
    if (params.ph && !isNaN(params.ph)) {
        analysis.details.ph = {
            value: params.ph,
            status: 'good',
            message: 'Within normal range'
        };
        
        if (params.ph < WATER_QUALITY_THRESHOLDS.ph.min) {
            analysis.hasIssues = true;
            analysis.isSafe = false;
            analysis.issues.push(`PH too low (${params.ph}) - acidic water`);
            analysis.details.ph.status = 'poor';
            analysis.details.ph.message = 'Too acidic - may cause corrosion';
            analysis.score -= 30;
        } else if (params.ph > WATER_QUALITY_THRESHOLDS.ph.max) {
            analysis.hasIssues = true;
            analysis.isSafe = false;
            analysis.issues.push(`PH too high (${params.ph}) - alkaline water`);
            analysis.details.ph.status = 'poor';
            analysis.details.ph.message = 'Too alkaline - may cause scaling';
            analysis.score -= 30;
        }
    }
    
    // Check Electrical Conductivity (salinity)
    if (params.ec && !isNaN(params.ec)) {
        analysis.details.ec = {
            value: params.ec,
            status: 'good',
            message: 'Low salinity'
        };
        
        if (params.ec > WATER_QUALITY_THRESHOLDS.ec.poor) {
            analysis.hasIssues = true;
            analysis.isSafe = false;
            analysis.issues.push(`Very high salinity (${params.ec} µS/cm)`);
            analysis.details.ec.status = 'very poor';
            analysis.details.ec.message = 'Unsuitable for drinking';
            analysis.score -= 40;
        } else if (params.ec > WATER_QUALITY_THRESHOLDS.ec.fair) {
            analysis.hasIssues = true;
            analysis.issues.push(`High salinity (${params.ec} µS/cm)`);
            analysis.details.ec.status = 'poor';
            analysis.details.ec.message = 'High salinity - marginal quality';
            analysis.score -= 25;
        } else if (params.ec > WATER_QUALITY_THRESHOLDS.ec.good) {
            analysis.details.ec.status = 'fair';
            analysis.details.ec.message = 'Moderate salinity';
            analysis.score -= 10;
        } else if (params.ec > WATER_QUALITY_THRESHOLDS.ec.excellent) {
            analysis.details.ec.status = 'good';
            analysis.details.ec.message = 'Good quality';
        } else {
            analysis.details.ec.status = 'excellent';
            analysis.details.ec.message = 'Excellent quality';
        }
    }
    
    // Check temperature
    if (params.temperature && !isNaN(params.temperature)) {
        analysis.details.temperature = {
            value: params.temperature,
            status: 'good',
            message: 'Normal temperature'
        };
        
        if (params.temperature > WATER_QUALITY_THRESHOLDS.temperature.max) {
            analysis.hasIssues = true;
            analysis.issues.push(`High water temperature (${params.temperature}°C)`);
            analysis.details.temperature.status = 'poor';
            analysis.details.temperature.message = 'Above recommended level';
            analysis.score -= 15;
        }
    }
    
    // Check yield
    if (params.yield_value && !isNaN(params.yield_value)) {
        analysis.details.yield = {
            value: params.yield_value,
            status: 'good',
            message: 'Good yield'
        };
        
        if (params.yield_value < WATER_QUALITY_THRESHOLDS.yield.low) {
            analysis.details.yield.status = 'poor';
            analysis.details.yield.message = 'Low yield';
            analysis.score -= 20;
        } else if (params.yield_value < WATER_QUALITY_THRESHOLDS.yield.medium) {
            analysis.details.yield.status = 'fair';
            analysis.details.yield.message = 'Medium yield';
            analysis.score -= 10;
        } else {
            analysis.details.yield.status = 'excellent';
            analysis.details.yield.message = 'High yield';
            analysis.score += 10;
        }
    }
    
    // Normalize score to 0-100
    analysis.score = Math.max(0, Math.min(100, analysis.score));
    
    // Overall assessment
    if (analysis.score >= 80) {
        analysis.overall = 'Excellent';
    } else if (analysis.score >= 60) {
        analysis.overall = 'Good';
    } else if (analysis.score >= 40) {
        analysis.overall = 'Fair';
    } else if (analysis.score >= 20) {
        analysis.overall = 'Poor';
    } else {
        analysis.overall = 'Very Poor';
    }
    
    return analysis;
}

// ============================================================================
// ENHANCED MARKER CREATION
// ============================================================================

function createEnhancedWaterPointMarker(point) {
    const props = point.properties || point;
    const enhancedStatus = determineEnhancedStatus(props);
    
    // Get coordinates
    let lat, lng;
    if (point.geometry && point.geometry.coordinates) {
        lng = point.geometry.coordinates[0];
        lat = point.geometry.coordinates[1];
    } else {
        lat = props.latitude || props.lat_deg;
        lng = props.longitude || props.lon_deg;
    }
    
    if (!lat || !lng) return null;
    
    // Determine marker type and shape
    const markerType = determineMarkerType(props);
    const markerShape = getMarkerShape(markerType, enhancedStatus);
    
    // Create enhanced icon with status indicators
    const icon = L.divIcon({
        html: generateEnhancedMarkerHTML(props, enhancedStatus, markerType, markerShape),
        className: `enhanced-water-point-marker ${enhancedStatus.primary} ${markerType}`,
        iconSize: markerShape.size,
        iconAnchor: [markerShape.size[0]/2, markerShape.size[1]/2],
        popupAnchor: [0, -markerShape.size[1]/2]
    });
    
    // Create marker
    const marker = L.marker([lat, lng], { 
        icon: icon,
        riseOnHover: true
    });
    
    // Store enhanced data
    marker.enhancedData = {
        props: props,
        status: enhancedStatus,
        markerType: markerType,
        waterQuality: enhancedStatus.water_quality
    };
    
    // Add enhanced popup
    marker.bindPopup(createEnhancedPopup(props, enhancedStatus), {
        maxWidth: 400,
        minWidth: 350,
        className: 'enhanced-water-point-popup'
    });
    
    // Add event handlers
    marker.on('click', function(e) {
        showEnhancedWaterPointDetails(this.enhancedData);
    });
    
    marker.on('mouseover', function(e) {
        this.setZIndexOffset(1000);
    });
    
    return marker;
}

function determineMarkerType(props) {
    // Determine if it's a borehole, well, spring, etc.
    const source = (props.water_sour || props.source || '').toLowerCase();
    const tech = (props.water_tech || props.first_stru || '').toLowerCase();
    const facility = (props.facility_t || '').toLowerCase();
    
    if (source.includes('bore') || tech.includes('bore') || facility.includes('bore')) {
        return 'borehole';
    } else if (source.includes('well') || tech.includes('well')) {
        return 'well';
    } else if (source.includes('spring') || tech.includes('spring')) {
        return 'spring';
    } else if (source.includes('rain') || tech.includes('rain')) {
        return 'rainwater';
    } else if (source.includes('shallow') || tech.includes('shallow')) {
        return 'shallow_well';
    } else if (source.includes('hand') || tech.includes('hand')) {
        return 'hand_pump';
    } else {
        return 'water_point';
    }
}

function getMarkerShape(type, status) {
    // Define shapes and sizes for different marker types
    const shapes = {
        borehole: {
            shape: 'diamond',
            size: [28, 28],
            icon: 'fa-tint'
        },
        well: {
            shape: 'square',
            size: [26, 26],
            icon: 'fa-square'
        },
        spring: {
            shape: 'triangle',
            size: [24, 24],
            icon: 'fa-chevron-circle-up'
        },
        rainwater: {
            shape: 'circle',
            size: [26, 26],
            icon: 'fa-cloud-rain'
        },
        shallow_well: {
            shape: 'square',
            size: [24, 24],
            icon: 'fa-arrow-down'
        },
        hand_pump: {
            shape: 'circle',
            size: [26, 26],
            icon: 'fa-hand-paper'
        },
        water_point: {
            shape: 'circle',
            size: [24, 24],
            icon: 'fa-water'
        }
    };
    
    return shapes[type] || shapes.water_point;
}

function generateEnhancedMarkerHTML(props, status, type, shape) {
    // Status indicator color
    const statusColor = status.color;
    
    // Quality indicator (small dot in corner)
    let qualityIndicator = '';
    if (status.water_quality && status.water_quality.hasIssues) {
        qualityIndicator = `
            <div style="
                position: absolute;
                top: -3px;
                right: -3px;
                width: 10px;
                height: 10px;
                background: #f39c12;
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                z-index: 2;
            "></div>
        `;
    }
    
    // Confidence indicator (small dot at bottom)
    let confidenceIndicator = '';
    if (status.confidence < 0.7) {
        confidenceIndicator = `
            <div style="
                position: absolute;
                bottom: -3px;
                left: -3px;
                width: 10px;
                height: 10px;
                background: ${status.confidence > 0.4 ? '#3498db' : '#95a5a6'};
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                z-index: 2;
            "></div>
        `;
    }
    
    // Yield indicator (if available)
    let yieldIndicator = '';
    if (props.yield_value && !isNaN(props.yield_value)) {
        const yieldValue = parseFloat(props.yield_value);
        const yieldColor = yieldValue > 15 ? '#2ecc71' : (yieldValue > 5 ? '#f39c12' : '#e74c3c');
        yieldIndicator = `
            <div style="
                position: absolute;
                bottom: -3px;
                right: -3px;
                width: 10px;
                height: 10px;
                background: ${yieldColor};
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                z-index: 2;
            " title="Yield: ${yieldValue} m³/hr"></div>
        `;
    }
    
    // Base marker styles
    let markerStyles = `
        width: ${shape.size[0]}px;
        height: ${shape.size[1]}px;
        background: ${statusColor};
        border: 3px solid white;
        box-shadow: 0 3px 6px rgba(0,0,0,0.3);
        cursor: pointer;
        position: relative;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: ${shape.size[0] * 0.5}px;
    `;
    
    // Apply shape-specific styles
    switch(shape.shape) {
        case 'diamond':
            markerStyles += `transform: rotate(45deg);`;
            break;
        case 'square':
            markerStyles += `border-radius: 4px;`;
            break;
        case 'triangle':
            markerStyles = `
                width: 0;
                height: 0;
                border-left: ${shape.size[0]/2}px solid transparent;
                border-right: ${shape.size[0]/2}px solid transparent;
                border-bottom: ${shape.size[1]}px solid ${statusColor};
                background: transparent;
                border: none;
                box-shadow: none;
            `;
            break;
        default: // circle
            markerStyles += `border-radius: 50%;`;
    }
    
    // Icon inside marker
    let iconHtml = '';
    if (shape.shape !== 'triangle') {
        iconHtml = `<i class="fas ${shape.icon}" style="transform: ${shape.shape === 'diamond' ? 'rotate(-45deg)' : 'none'};"></i>`;
    } else {
        iconHtml = `<div style="
            position: absolute;
            top: 5px;
            left: -6px;
            width: 12px;
            height: 12px;
            background: white;
            border-radius: 50%;
        "></div>`;
    }
    
    return `
        <div style="${markerStyles}">
            ${iconHtml}
            ${qualityIndicator}
            ${confidenceIndicator}
            ${yieldIndicator}
        </div>
    `;
}

// ============================================================================
// ENHANCED POPUP
// ============================================================================

function createEnhancedPopup(props, status) {
    const waterQuality = status.water_quality || {};
    const parameters = status.parameters || {};
    
    // Generate water quality badges
    const qualityBadges = generateQualityBadges(waterQuality);
    
    // Generate issues list
    const issuesHtml = status.issues && status.issues.length > 0 ? `
        <div style="margin-top: 12px; padding: 10px; background: #fef5e7; border-left: 4px solid #f39c12; border-radius: 4px;">
            <div style="font-weight: 600; color: #c47b2c; margin-bottom: 5px;">
                <i class="fas fa-exclamation-triangle"></i> Issues Detected
            </div>
            <ul style="margin: 0; padding-left: 20px; color: #7f5e3a;">
                ${status.issues.map(issue => `<li style="margin-bottom: 3px;">${issue}</li>`).join('')}
            </ul>
        </div>
    ` : '';
    
    // Generate parameters grid
    const paramsHtml = generateParametersGrid(parameters, waterQuality);
    
    return `
        <div style="padding: 16px; max-width: 400px;">
            <!-- Header -->
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid ${status.color};">
                <div style="
                    width: 48px;
                    height: 48px;
                    background: ${status.color};
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 24px;
                    border: 3px solid white;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                ">
                    <i class="fas ${status.icon}"></i>
                </div>
                <div style="flex: 1;">
                    <div style="font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
                        ${parameters.locality || parameters.subcounty || 'Water Point'}
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <span style="
                            background: ${status.color};
                            color: white;
                            padding: 4px 12px;
                            border-radius: 20px;
                            font-size: 12px;
                            font-weight: 600;
                        ">
                            <i class="fas ${status.icon}" style="margin-right: 4px;"></i>
                            ${status.description}
                        </span>
                        <span style="font-size: 11px; color: #64748b;">
                            Confidence: ${Math.round(status.confidence * 100)}%
                        </span>
                    </div>
                </div>
            </div>
            
            <!-- Location Info -->
            <div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 8px; color: #475569;">
                    <i class="fas fa-map-marker-alt" style="color: ${status.color};"></i>
                    <span style="font-weight: 500;">
                        ${[parameters.county, parameters.subcounty, parameters.ward].filter(Boolean).join(' › ')}
                    </span>
                </div>
                ${parameters.install_year ? `
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px; color: #64748b; font-size: 13px;">
                    <i class="fas fa-calendar"></i>
                    Installed: ${parameters.install_year}
                    ${parameters.installer ? `by ${parameters.installer}` : ''}
                </div>` : ''}
            </div>
            
            <!-- Water Quality Score -->
            ${waterQuality.score !== undefined ? `
            <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-size: 13px; font-weight: 600; color: #334155;">
                        <i class="fas fa-chart-line"></i> Water Quality Score
                    </span>
                    <span style="
                        padding: 4px 8px;
                        background: ${waterQuality.score >= 80 ? '#2ecc71' : (waterQuality.score >= 60 ? '#f39c12' : '#e74c3c')};
                        color: white;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 600;
                    ">
                        ${waterQuality.overall || 'Unknown'}
                    </span>
                </div>
                <div style="height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                    <div style="
                        height: 100%;
                        width: ${waterQuality.score}%;
                        background: linear-gradient(90deg, #f39c12, ${waterQuality.score >= 60 ? '#2ecc71' : '#e74c3c'});
                        border-radius: 4px;
                        transition: width 0.3s ease;
                    "></div>
                </div>
            </div>` : ''}
            
            <!-- Quality Badges -->
            ${qualityBadges}
            
            <!-- Parameters Grid -->
            ${paramsHtml}
            
            <!-- Issues -->
            ${issuesHtml}
            
            <!-- Management Info -->
            ${parameters.management ? `
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
                <div style="display: flex; align-items: center; gap: 8px; color: #475569; font-size: 13px;">
                    <i class="fas fa-users-cog"></i>
                    <span style="font-weight: 600;">Management:</span> ${parameters.management}
                </div>
            </div>` : ''}
            
            <!-- Action Buttons -->
            <div style="margin-top: 20px; display: flex; gap: 10px;">
                <button onclick="zoomToWaterPoint(${props.id})" style="
                    flex: 1;
                    padding: 10px;
                    background: white;
                    border: 2px solid ${status.color};
                    color: ${status.color};
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                " onmouseover="this.style.background='${status.color}'; this.style.color='white';" 
                   onmouseout="this.style.background='white'; this.style.color='${status.color}';">
                    <i class="fas fa-search"></i> Zoom
                </button>
                <button onclick="showEnhancedWaterPointDetails(${props.id})" style="
                    flex: 1;
                    padding: 10px;
                    background: ${status.color};
                    border: 2px solid ${status.color};
                    color: white;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                " onmouseover="this.style.opacity='0.9';" onmouseout="this.style.opacity='1';">
                    <i class="fas fa-chart-bar"></i> Full Analysis
                </button>
            </div>
        </div>
    `;
}

function generateQualityBadges(waterQuality) {
    if (!waterQuality.details) return '';
    
    const badges = [];
    
    Object.entries(waterQuality.details).forEach(([key, detail]) => {
        let badgeClass = 'badge-good';
        let icon = 'fa-check-circle';
        
        if (detail.status === 'poor' || detail.status === 'very poor') {
            badgeClass = 'badge-poor';
            icon = 'fa-exclamation-circle';
        } else if (detail.status === 'fair') {
            badgeClass = 'badge-fair';
            icon = 'fa-exclamation-triangle';
        }
        
        badges.push(`
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: #f8fafc; border-radius: 6px; border-left: 3px solid ${detail.status === 'good' || detail.status === 'excellent' ? '#2ecc71' : (detail.status === 'fair' ? '#f39c12' : '#e74c3c')};">
                <i class="fas ${icon}" style="color: ${detail.status === 'good' || detail.status === 'excellent' ? '#2ecc71' : (detail.status === 'fair' ? '#f39c12' : '#e74c3c')};"></i>
                <div style="flex: 1;">
                    <div style="font-size: 12px; font-weight: 600; color: #334155; text-transform: capitalize;">
                        ${key}
                    </div>
                    <div style="font-size: 11px; color: #64748b;">
                        ${detail.message}
                    </div>
                </div>
                <div style="font-size: 13px; font-weight: 700; color: #1e293b;">
                    ${detail.value}${key === 'ph' ? '' : key === 'temperature' ? '°C' : key === 'ec' ? ' µS/cm' : key === 'yield' ? ' m³/hr' : ''}
                </div>
            </div>
        `);
    });
    
    return `
        <div style="margin-top: 12px;">
            <div style="font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 8px;">
                <i class="fas fa-flask"></i> Water Quality Parameters
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
                ${badges.join('')}
            </div>
        </div>
    `;
}

function generateParametersGrid(parameters, waterQuality) {
    const grid = [];
    
    if (parameters.well_depth) {
        grid.push(`
            <div style="padding: 8px; background: #f8fafc; border-radius: 6px;">
                <div style="font-size: 11px; color: #64748b;">Depth</div>
                <div style="font-size: 14px; font-weight: 700; color: #1e293b;">${parameters.well_depth}m</div>
            </div>
        `);
    }
    
    if (parameters.yield_value) {
        const yieldColor = parameters.yield_value > 15 ? '#2ecc71' : (parameters.yield_value > 5 ? '#f39c12' : '#e74c3c');
        grid.push(`
            <div style="padding: 8px; background: #f8fafc; border-radius: 6px;">
                <div style="font-size: 11px; color: #64748b;">Yield</div>
                <div style="font-size: 14px; font-weight: 700; color: ${yieldColor};">${parameters.yield_value} m³/hr</div>
            </div>
        `);
    }
    
    if (parameters.ph) {
        const phColor = parameters.ph >= 6.5 && parameters.ph <= 8.5 ? '#2ecc71' : '#e74c3c';
        grid.push(`
            <div style="padding: 8px; background: #f8fafc; border-radius: 6px;">
                <div style="font-size: 11px; color: #64748b;">PH Level</div>
                <div style="font-size: 14px; font-weight: 700; color: ${phColor};">${parameters.ph}</div>
            </div>
        `);
    }
    
    if (parameters.ec) {
        grid.push(`
            <div style="padding: 8px; background: #f8fafc; border-radius: 6px;">
                <div style="font-size: 11px; color: #64748b;">EC</div>
                <div style="font-size: 14px; font-weight: 700; color: #1e293b;">${parameters.ec} µS/cm</div>
            </div>
        `);
    }
    
    if (grid.length > 0) {
        return `
            <div style="margin-top: 12px;">
                <div style="font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 8px;">
                    <i class="fas fa-cube"></i> Technical Parameters
                </div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                    ${grid.join('')}
                </div>
            </div>
        `;
    }
    
    return '';
}

// ============================================================================
// ENHANCED CLUSTER ICON
// ============================================================================

function createEnhancedClusterIcon(cluster) {
    const count = cluster.getChildCount();
    const markers = cluster.getAllChildMarkers();
    
    // Analyze status distribution within cluster
    const statusCounts = {
        functional: 0,
        likely_functional: 0,
        needs_attention: 0,
        non_functional: 0,
        needs_repair: 0,
        unknown: 0
    };
    
    markers.forEach(marker => {
        if (marker.enhancedData) {
            const status = marker.enhancedData.status.primary;
            if (statusCounts.hasOwnProperty(status)) {
                statusCounts[status]++;
            }
        }
    });
    
    // Determine cluster color based on predominant status
    let predominantStatus = 'unknown';
    let maxCount = 0;
    
    Object.entries(statusCounts).forEach(([status, statusCount]) => {
        if (statusCount > maxCount) {
            maxCount = statusCount;
            predominantStatus = status;
        }
    });
    
    const statusColor = ENHANCED_STATUS_DEFINITIONS[predominantStatus]?.color || '#95a5a6';
    
    // Determine cluster size
    let size = 'small';
    let iconSize = 40;
    if (count > 100) {
        size = 'xlarge';
        iconSize = 56;
    } else if (count > 50) {
        size = 'large';
        iconSize = 50;
    } else if (count > 20) {
        size = 'medium';
        iconSize = 44;
    }
    
    return L.divIcon({
        html: `
            <div style="
                width: ${iconSize}px;
                height: ${iconSize}px;
                background: ${statusColor}20;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                backdrop-filter: blur(2px);
            ">
                <div style="
                    width: ${iconSize - 10}px;
                    height: ${iconSize - 10}px;
                    background: ${statusColor};
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: 700;
                    font-size: ${iconSize * 0.35}px;
                    border: 2px solid white;
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
                ">
                    ${count}
                </div>
                <div style="
                    position: absolute;
                    bottom: -5px;
                    right: -5px;
                    display: flex;
                    gap: 2px;
                ">
                    ${statusCounts.non_functional > 0 ? `
                        <div style="
                            width: 12px;
                            height: 12px;
                            background: #e74c3c;
                            border-radius: 50%;
                            border: 2px solid white;
                        " title="${statusCounts.non_functional} non-functional"></div>
                    ` : ''}
                    ${statusCounts.needs_attention > 0 || statusCounts.needs_repair > 0 ? `
                        <div style="
                            width: 12px;
                            height: 12px;
                            background: #f39c12;
                            border-radius: 50%;
                            border: 2px solid white;
                        " title="${statusCounts.needs_attention + statusCounts.needs_repair} need attention"></div>
                    ` : ''}
                </div>
            </div>
        `,
        className: `enhanced-marker-cluster marker-cluster-${size}`,
        iconSize: L.point(iconSize, iconSize)
    });
}

// ============================================================================
// VISUALIZATION MODES
// ============================================================================

function setupVisualizationOptions() {
    const vizOptions = document.querySelectorAll('[data-viz]');
    vizOptions.forEach(option => {
        option.addEventListener('click', function() {
            const vizMode = this.dataset.viz;
            
            // Update active state
            vizOptions.forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');
            
            // Change visualization mode
            changeVisualizationMode(vizMode);
            
            // Close dropdown
            document.getElementById('layers-dropdown-content').classList.remove('show');
        });
    });
}

function changeVisualizationMode(mode) {
    if (currentVizMode === mode) return;
    
    currentVizMode = mode;
    
    // Reload water points with new visualization
    reloadEnhancedWaterPoints();
    
    showNotification('Visualization Mode', `Switched to ${mode} view`, 'info');
}

function reloadEnhancedWaterPoints() {
    // Clear existing markers
    window.enhancedWaterPointsCluster.clearLayers();
    window.enhancedWaterPointsLayer.clearLayers();
    enhancedWaterPointsMarkers = [];
    
    // Recreate markers with current visualization mode
    enhancedWaterPointsData.forEach(point => {
        const marker = createEnhancedWaterPointMarker(point);
        if (marker) {
            enhancedWaterPointsMarkers.push(marker);
            
            if (currentWaterPointsDisplay === 'cluster') {
                window.enhancedWaterPointsCluster.addLayer(marker);
            } else {
                window.enhancedWaterPointsLayer.addLayer(marker);
            }
        }
    });
    
    // Update map
    if (layerVisibility.waterPoints) {
        if (currentWaterPointsDisplay === 'cluster') {
            window.enhancedWaterPointsCluster.addTo(map);
        } else {
            window.enhancedWaterPointsLayer.addTo(map);
        }
    }
}

// ============================================================================
// ANALYSIS TOOLS
// ============================================================================

function setupAnalysisTools() {
    // Buffer analysis
    const bufferBtn = document.getElementById('tool-buffer-dropdown');
    if (bufferBtn) {
        bufferBtn.addEventListener('click', function() {
            openBufferAnalysis();
        });
    }
    
    // Export tool
    const exportBtn = document.getElementById('tool-export-dropdown');
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            openExportModal();
        });
    }
    
    // Search tool
    const searchBtn = document.getElementById('tool-search-dropdown');
    if (searchBtn) {
        searchBtn.addEventListener('click', function() {
            openSearchModal();
        });
    }
}

function openBufferAnalysis() {
    const modal = document.getElementById('bufferModal');
    if (modal) {
        modal.classList.add('show');
        
        // Setup buffer application
        const applyBtn = document.getElementById('apply-buffer-btn');
        if (applyBtn) {
            applyBtn.onclick = function() {
                const distance = parseFloat(document.getElementById('buffer-distance').value);
                const locationType = document.getElementById('buffer-location').value;
                
                performBufferAnalysis(distance, locationType);
            };
        }
    }
}

function performBufferAnalysis(distance, locationType) {
    let center;
    
    if (locationType === 'click') {
        showNotification('Buffer Analysis', 'Click on the map to set buffer center', 'info');
        
        const clickHandler = function(e) {
            center = e.latlng;
            map.off('click', clickHandler);
            
            // Draw buffer circle
            const circle = L.circle(center, {
                radius: distance * 1000,
                color: '#8b5cf6',
                weight: 2,
                fillColor: '#8b5cf6',
                fillOpacity: 0.1
            }).addTo(map);
            
            // Count points within buffer
            const pointsInBuffer = enhancedWaterPointsMarkers.filter(marker => {
                const markerLatLng = marker.getLatLng();
                const markerPoint = L.latLng(markerLatLng.lat, markerLatLng.lng);
                return center.distanceTo(markerPoint) <= distance * 1000;
            });
            
            // Analyze points in buffer
            analyzeBufferPoints(pointsInBuffer, distance, center);
            
            // Close modal
            document.getElementById('bufferModal').classList.remove('show');
        };
        
        map.once('click', clickHandler);
    } else {
        // Use map center
        center = map.getCenter();
        
        // Draw buffer circle
        const circle = L.circle(center, {
            radius: distance * 1000,
            color: '#8b5cf6',
            weight: 2,
            fillColor: '#8b5cf6',
            fillOpacity: 0.1
        }).addTo(map);
        
        // Count points within buffer
        const pointsInBuffer = enhancedWaterPointsMarkers.filter(marker => {
            const markerLatLng = marker.getLatLng();
            const markerPoint = L.latLng(markerLatLng.lat, markerLatLng.lng);
            return center.distanceTo(markerPoint) <= distance * 1000;
        });
        
        // Analyze points in buffer
        analyzeBufferPoints(pointsInBuffer, distance, center);
        
        // Close modal
        document.getElementById('bufferModal').classList.remove('show');
    }
}

function analyzeBufferPoints(points, distance, center) {
    // Count by status
    const statusCounts = {
        functional: 0,
        likely_functional: 0,
        needs_attention: 0,
        non_functional: 0,
        needs_repair: 0,
        unknown: 0
    };
    
    points.forEach(marker => {
        if (marker.enhancedData) {
            const status = marker.enhancedData.status.primary;
            if (statusCounts.hasOwnProperty(status)) {
                statusCounts[status]++;
            }
        }
    });
    
    // Calculate statistics
    const total = points.length;
    const functionalPct = total > 0 ? Math.round((statusCounts.functional + statusCounts.likely_functional) / total * 100) : 0;
    const nonFunctionalPct = total > 0 ? Math.round((statusCounts.non_functional) / total * 100) : 0;
    
    // Show results
    const resultsHtml = `
        <div style="padding: 16px;">
            <h4 style="margin: 0 0 16px 0; color: #8b5cf6; display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-circle"></i> Buffer Analysis Results
            </h4>
            <div style="background: #f8fafc; padding: 16px; border-radius: 12px; margin-bottom: 16px;">
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
                    <div>
                        <div style="font-size: 12px; color: #64748b;">Buffer Radius</div>
                        <div style="font-size: 20px; font-weight: 700; color: #1e293b;">${distance} km</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: #64748b;">Total Points</div>
                        <div style="font-size: 20px; font-weight: 700; color: #1e293b;">${total}</div>
                    </div>
                </div>
            </div>
            
            <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-size: 13px; color: #475569;">Functional Rate</span>
                    <span style="font-size: 13px; font-weight: 700; color: ${functionalPct > 70 ? '#2ecc71' : (functionalPct > 40 ? '#f39c12' : '#e74c3c')};">${functionalPct}%</span>
                </div>
                <div style="height: 8px; background: #e2e8f0; border-radius: 4px;">
                    <div style="height: 100%; width: ${functionalPct}%; background: ${functionalPct > 70 ? '#2ecc71' : (functionalPct > 40 ? '#f39c12' : '#e74c3c')}; border-radius: 4px;"></div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                <div style="padding: 12px; background: #2ecc7120; border-radius: 8px; border-left: 4px solid #2ecc71;">
                    <div style="font-size: 11px; color: #2ecc71; text-transform: uppercase;">Functional</div>
                    <div style="font-size: 18px; font-weight: 700; color: #2ecc71;">${statusCounts.functional + statusCounts.likely_functional}</div>
                </div>
                <div style="padding: 12px; background: #f39c1220; border-radius: 8px; border-left: 4px solid #f39c12;">
                    <div style="font-size: 11px; color: #f39c12; text-transform: uppercase;">Needs Attention</div>
                    <div style="font-size: 18px; font-weight: 700; color: #f39c12;">${statusCounts.needs_attention + statusCounts.needs_repair}</div>
                </div>
                <div style="padding: 12px; background: #e74c3c20; border-radius: 8px; border-left: 4px solid #e74c3c;">
                    <div style="font-size: 11px; color: #e74c3c; text-transform: uppercase;">Non-Functional</div>
                    <div style="font-size: 18px; font-weight: 700; color: #e74c3c;">${statusCounts.non_functional}</div>
                </div>
                <div style="padding: 12px; background: #95a5a620; border-radius: 8px; border-left: 4px solid #95a5a6;">
                    <div style="font-size: 11px; color: #95a5a6; text-transform: uppercase;">Unknown</div>
                    <div style="font-size: 18px; font-weight: 700; color: #95a5a6;">${statusCounts.unknown}</div>
                </div>
            </div>
            
            <div style="margin-top: 20px; display: flex; gap: 10px;">
                <button onclick="exportBufferResults(${distance}, ${center.lat}, ${center.lng})" style="
                    flex: 1;
                    padding: 10px;
                    background: #8b5cf6;
                    border: none;
                    color: white;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                ">
                    <i class="fas fa-download"></i> Export Results
                </button>
                <button onclick="document.getElementById('bufferResultsPanel')?.remove()" style="
                    padding: 10px 16px;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                ">
                    Close
                </button>
            </div>
        </div>
    `;
    
    // Create results panel
    const resultsPanel = document.createElement('div');
    resultsPanel.id = 'bufferResultsPanel';
    resultsPanel.style.cssText = `
        position: absolute;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        width: 400px;
        max-width: 90%;
        background: white;
        border-radius: 16px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.15);
        z-index: 2000;
        border: 1px solid #e2e8f0;
        animation: slideDown 0.3s ease;
    `;
    resultsPanel.innerHTML = resultsHtml;
    
    // Remove any existing results panel
    const existingPanel = document.getElementById('bufferResultsPanel');
    if (existingPanel) existingPanel.remove();
    
    document.body.appendChild(resultsPanel);
}

// ============================================================================
// LOAD ENHANCED WATER POINTS
// ============================================================================

async function loadEnhancedWaterPoints() {
    try {
        showNotification('Loading Enhanced Data', 'Fetching water points with advanced analysis...', 'info');
        
        // Fetch water points from both models
        const [newPoints, oldPoints] = await Promise.all([
            fetch('/api/water-points/').then(res => res.json()),
            fetch('/api/boreholes/').then(res => res.json())
        ]);
        
        // Combine and process points
        enhancedWaterPointsData = [
            ...(newPoints.features || []).map(f => ({ ...f, model_type: 'new' })),
            ...(oldPoints.features || []).map(f => ({ ...f, model_type: 'old' }))
        ];
        
        // Process each point with enhanced status detection
        enhancedWaterPointsMarkers = [];
        
        enhancedWaterPointsData.forEach(point => {
            const marker = createEnhancedWaterPointMarker(point);
            if (marker) {
                enhancedWaterPointsMarkers.push(marker);
                
                if (currentWaterPointsDisplay === 'cluster') {
                    window.enhancedWaterPointsCluster.addLayer(marker);
                } else {
                    window.enhancedWaterPointsLayer.addLayer(marker);
                }
            }
        });
        
        // Add to map if layer is visible
        if (layerVisibility.waterPoints) {
            if (currentWaterPointsDisplay === 'cluster') {
                window.enhancedWaterPointsCluster.addTo(map);
            } else {
                window.enhancedWaterPointsLayer.addTo(map);
            }
        }
        
        // Update statistics with enhanced analysis
        updateEnhancedStatistics();
        
        showNotification('Enhanced Data Loaded', `Analyzed ${enhancedWaterPointsMarkers.length} water points with quality assessment`, 'success');
        
    } catch (error) {
        console.error('Error loading enhanced water points:', error);
        showNotification('Loading Error', 'Failed to load enhanced water points data', 'error');
    }
}

function updateEnhancedStatistics() {
    const stats = {
        total: enhancedWaterPointsMarkers.length,
        functional: 0,
        likely_functional: 0,
        needs_attention: 0,
        non_functional: 0,
        needs_repair: 0,
        unknown: 0,
        good_quality: 0,
        fair_quality: 0,
        poor_quality: 0
    };
    
    enhancedWaterPointsMarkers.forEach(marker => {
        if (marker.enhancedData) {
            // Status counts
            const status = marker.enhancedData.status.primary;
            stats[status] = (stats[status] || 0) + 1;
            
            // Quality counts
            const quality = marker.enhancedData.waterQuality;
            if (quality) {
                if (quality.score >= 70) stats.good_quality++;
                else if (quality.score >= 40) stats.fair_quality++;
                else stats.poor_quality++;
            }
        }
    });
    
    // Update UI with enhanced statistics
    const functionalTotal = stats.functional + stats.likely_functional;
    const functionalPct = stats.total > 0 ? Math.round(functionalTotal / stats.total * 100) : 0;
    
    // Update legend counts
    document.getElementById('legend-functional-new').textContent = stats.functional + stats.likely_functional;
    document.getElementById('legend-nonfunctional-new').textContent = stats.non_functional;
    document.getElementById('legend-repair-new').textContent = stats.needs_attention + stats.needs_repair;
    document.getElementById('legend-unknown-new').textContent = stats.unknown;
    
    // Update dashboard stats if elements exist
    const functionalRateEl = document.getElementById('functional-rate');
    if (functionalRateEl) {
        functionalRateEl.textContent = `${functionalPct}%`;
    }
    
    console.log('Enhanced Statistics:', stats);
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

function openExportModal() {
    const modal = document.getElementById('exportModal');
    if (modal) {
        modal.classList.add('show');
        
        const downloadBtn = document.getElementById('export-download-btn');
        if (downloadBtn) {
            downloadBtn.onclick = function() {
                exportEnhancedData();
            };
        }
    }
}

function exportEnhancedData() {
    const includeNew = document.getElementById('export-water-points-new')?.checked ?? true;
    const includeOld = document.getElementById('export-boreholes')?.checked ?? true;
    const includeBoundaries = document.getElementById('export-boundaries')?.checked ?? false;
    
    // Prepare enhanced GeoJSON
    const features = [];
    
    if (includeNew || includeOld) {
        enhancedWaterPointsMarkers.forEach(marker => {
            if (marker.enhancedData) {
                const data = marker.enhancedData;
                const latlng = marker.getLatLng();
                
                features.push({
                    type: 'Feature',
                    properties: {
                        id: data.props.id,
                        name: data.props.locality || data.props.name || 'Water Point',
                        status: data.status.primary,
                        status_description: data.status.description,
                        confidence: data.status.confidence,
                        water_quality_score: data.waterQuality.score,
                        water_quality_overall: data.waterQuality.overall,
                        issues: data.status.issues,
                        county: data.props.admin_1 || data.props.clean_adm1,
                        subcounty: data.props.locality || data.props.clean_adm2,
                        ward: data.props.clean_adm3,
                        depth: data.parameters.well_depth,
                        yield: data.parameters.yield_value,
                        ph: data.parameters.ph,
                        ec: data.parameters.ec,
                        temperature: data.parameters.temperature,
                        model_type: data.props.model_type
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: [latlng.lng, latlng.lat]
                    }
                });
            }
        });
    }
    
    const geojson = {
        type: 'FeatureCollection',
        features: features,
        metadata: {
            generated: new Date().toISOString(),
            total_features: features.length,
            enhanced_analysis: true,
            water_quality_assessment: true
        }
    };
    
    // Download file
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enhanced_water_points_${new Date().getTime()}.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Close modal
    document.getElementById('exportModal').classList.remove('show');
    
    showNotification('Export Complete', `Exported ${features.length} enhanced water points`, 'success');
}

function openSearchModal() {
    const modal = document.getElementById('searchModal');
    if (modal) {
        modal.classList.add('show');
        
        // Setup search
        const searchInput = document.getElementById('search-input');
        const searchBtn = document.getElementById('search-button');
        
        if (searchInput && searchBtn) {
            searchBtn.onclick = function() {
                performEnhancedSearch(searchInput.value);
            };
            
            searchInput.onkeypress = function(e) {
                if (e.key === 'Enter') {
                    performEnhancedSearch(this.value);
                }
            };
        }
    }
}

function performEnhancedSearch(query) {
    if (!query || query.length < 2) {
        showNotification('Search', 'Please enter at least 2 characters', 'warning');
        return;
    }
    
    const results = enhancedWaterPointsMarkers.filter(marker => {
        if (!marker.enhancedData) return false;
        
        const data = marker.enhancedData;
        const searchText = `
            ${data.props.locality || ''} 
            ${data.props.admin_1 || ''} 
            ${data.props.clean_adm1 || ''} 
            ${data.props.clean_adm2 || ''} 
            ${data.props.clean_adm3 || ''}
            ${data.status.primary}
            ${data.status.description}
        `.toLowerCase();
        
        return searchText.includes(query.toLowerCase());
    }).slice(0, 20);
    
    displayEnhancedSearchResults(results, query);
}

function displayEnhancedSearchResults(results, query) {
    const resultsDiv = document.getElementById('search-results');
    if (!resultsDiv) return;
    
    if (results.length === 0) {
        resultsDiv.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #64748b;">
                <i class="fas fa-search" style="font-size: 24px; margin-bottom: 10px;"></i>
                <p>No water points found for "${query}"</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    results.forEach(marker => {
        const data = marker.enhancedData;
        const latlng = marker.getLatLng();
        
        html += `
            <div class="search-result-item" onclick="zoomToWaterPoint(${data.props.id})" style="
                padding: 12px;
                border-bottom: 1px solid #e2e8f0;
                cursor: pointer;
                transition: background 0.2s ease;
                display: flex;
                align-items: center;
                gap: 12px;
            " onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <div style="
                    width: 40px;
                    height: 40px;
                    background: ${data.status.color};
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 18px;
                    border: 2px solid white;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                ">
                    <i class="fas ${data.status.icon}"></i>
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">
                        ${data.props.locality || data.props.name || 'Water Point'}
                    </div>
                    <div style="display: flex; gap: 12px; font-size: 12px; color: #64748b;">
                        <span>
                            <i class="fas fa-map-marker-alt"></i>
                            ${data.props.admin_1 || data.props.clean_adm1 || 'Unknown'}
                        </span>
                        <span>
                            <i class="fas ${data.status.icon}"></i>
                            ${data.status.description}
                        </span>
                        ${data.waterQuality.score ? `
                        <span>
                            <i class="fas fa-flask"></i>
                            ${data.waterQuality.overall || 'Unknown'}
                        </span>
                        ` : ''}
                    </div>
                </div>
                <div style="color: ${data.status.color};">
                    <i class="fas fa-chevron-right"></i>
                </div>
            </div>
        `;
    });
    
    resultsDiv.innerHTML = html;
}

function showEnhancedWaterPointDetails(pointId) {
    const marker = enhancedWaterPointsMarkers.find(m => m.enhancedData?.props.id == pointId);
    if (marker) {
        marker.openPopup();
        
        // Zoom to marker
        const latlng = marker.getLatLng();
        map.setView(latlng, 14, { animate: true, duration: 1.5 });
    }
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

function exportBufferResults(distance, lat, lng) {
    const results = {
        analysis: {
            type: 'Buffer Analysis',
            distance_km: distance,
            center: { lat, lng },
            timestamp: new Date().toISOString()
        },
        points: []
    };
    
    enhancedWaterPointsMarkers.forEach(marker => {
        if (marker.enhancedData) {
            const markerLatLng = marker.getLatLng();
            const distanceFromCenter = L.latLng(lat, lng).distanceTo(markerLatLng) / 1000;
            
            if (distanceFromCenter <= distance) {
                results.points.push({
                    id: marker.enhancedData.props.id,
                    name: marker.enhancedData.props.locality || 'Unknown',
                    status: marker.enhancedData.status.primary,
                    status_description: marker.enhancedData.status.description,
                    water_quality_score: marker.enhancedData.waterQuality.score,
                    distance_from_center_km: Math.round(distanceFromCenter * 100) / 100,
                    coordinates: [markerLatLng.lng, markerLatLng.lat]
                });
            }
        }
    });
    
    results.summary = {
        total_points: results.points.length,
        functional_count: results.points.filter(p => p.status.includes('functional')).length,
        non_functional_count: results.points.filter(p => p.status === 'non_functional').length,
        average_quality_score: Math.round(results.points.reduce((sum, p) => sum + (p.water_quality_score || 0), 0) / results.points.length)
    };
    
    // Download results
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `buffer_analysis_${distance}km_${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Buffer Analysis', `Exported ${results.points.length} points with analysis`, 'success');
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Wait for DOM and map to be ready
document.addEventListener('DOMContentLoaded', function() {
    // Wait for map to initialize
    setTimeout(() => {
        if (typeof map !== 'undefined' && map) {
            initEnhancedWaterPoints();
        } else {
            // Try again after map initialization
            document.addEventListener('map:initialized', initEnhancedWaterPoints);
        }
    }, 1500);
});

// Export global functions
window.zoomToWaterPoint = zoomToWaterPoint;
window.showEnhancedWaterPointDetails = showEnhancedWaterPointDetails;
window.exportBufferResults = exportBufferResults;