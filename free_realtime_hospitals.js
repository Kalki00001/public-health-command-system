// ===== FREE REAL-TIME HOSPITAL FINDER =====
// NO API KEYS REQUIRED!
// Uses: OpenStreetMap (Leaflet) + Overpass API
// 🔔 Alert sounds
const alertSounds = {
    critical: new Audio('/sounds/alert.mp3'),
    warning: new Audio('/sounds/alert2.mp3')
};

// Allow repeated play
alertSounds.critical.preload = 'auto';
alertSounds.warning.preload = 'auto';

// State
const AppState = {
    map: null,
    userMarker: null,
    userLocation: null,
    watchId: null,
    hospitals: [],
    selectedHospital: null,
    hospitalMarkers: [],
    routeLine: null,
    isTracking: false
};

// Configuration
const CONFIG = {
    searchRadius: 5000, // 5km in meters
    updateInterval: 5000, // 5 seconds
    movementThreshold: 50, // 50 meters
    maxHospitals: 10
};

/**
 * Initialize the map
 */
function initMap() {
    // Create map
    AppState.map = L.map('map').setView([19.0760, 72.8777], 13);

    // Add OpenStreetMap tiles (FREE!)
    // ✅ FIRST add tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(AppState.map);

    // ✅ THEN add the grid
    const testBounds = [
        [19.05, 72.85],
        [19.10, 72.90]
    ];

    const testGrid = L.rectangle(testBounds, {
        color: "#2e7d32",
        weight: 1,
        fillColor: "#4caf50",
        fillOpacity: 0.45
    }).addTo(AppState.map);

    testGrid.bindPopup("🟢 SAFE ZONE");

    // Force zoom
    AppState.map.fitBounds(testBounds);

    // Get user location and start tracking
    startLocationTracking();
}

/**
 * Start real-time location tracking
 */
function startLocationTracking() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }

    // Get initial position
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const location = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy
            };

            AppState.userLocation = location;
            updateUserMarker(location);
            updateLocationStatus(location, position.coords.accuracy);
            searchNearbyHospitals(location);

            // Start continuous tracking
            AppState.watchId = navigator.geolocation.watchPosition(
                (pos) => handleLocationUpdate(pos),
                (error) => handleLocationError(error),
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                }
            );

            AppState.isTracking = true;
        },
        (error) => {
            handleLocationError(error);
            // Use default location if permission denied
            const defaultLocation = { lat: 19.0760, lng: 72.8777 };
            AppState.map.setView([defaultLocation.lat, defaultLocation.lng], 13);
            searchNearbyHospitals(defaultLocation);
        }
    );
}

/**
 * Handle location updates
 */
function handleLocationUpdate(position) {
    const newLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
    };

    const moved = AppState.userLocation
        ? calculateDistance(AppState.userLocation, newLocation) * 1000
        : Infinity;

    AppState.userLocation = newLocation;
    updateUserMarker(newLocation);
    updateLocationStatus(newLocation, position.coords.accuracy);

    // Re-search hospitals if moved significantly
    if (moved > CONFIG.movementThreshold) {
        console.log(`Moved ${Math.round(moved)}m - updating...`);
        updateHospitalDistances();

        if (moved > 500) {
            searchNearbyHospitals(newLocation);
        }

        // Update route if hospital selected
        if (AppState.selectedHospital) {
            calculateRoute(newLocation, AppState.selectedHospital);
        }
    }
}

/**
 * Update user marker
 */
function updateUserMarker(location) {
    if (AppState.userMarker) {
        AppState.userMarker.setLatLng([location.lat, location.lng]);
    } else {
        // Create pulsing marker
        const pulseIcon = L.divIcon({
            className: 'pulse-marker',
            html: `
                <div style="position: relative;">
                    <div style="
                        width: 20px;
                        height: 20px;
                        background: #2196F3;
                        border: 3px solid white;
                        border-radius: 50%;
                        box-shadow: 0 0 20px rgba(33, 150, 243, 0.6);
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        z-index: 2;
                    "></div>
                    <div style="
                        width: 40px;
                        height: 40px;
                        background: rgba(33, 150, 243, 0.3);
                        border-radius: 50%;
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        animation: pulse 2s infinite;
                    "></div>
                </div>
                <style>
                    @keyframes pulse {
                        0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                        100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
                    }
                </style>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        AppState.userMarker = L.marker([location.lat, location.lng], { icon: pulseIcon })
            .addTo(AppState.map)
            .bindPopup('📍 Your Location');
    }

    AppState.map.setView([location.lat, location.lng], AppState.map.getZoom() || 14);
}

/**
 * Search nearby hospitals using Overpass API (FREE!)
 */
async function searchNearbyHospitals(location) {
    const radius = CONFIG.searchRadius;

    // Overpass API query for hospitals
    const query = `
        [out:json][timeout:25];
        (
            node["amenity"="hospital"](around:${radius},${location.lat},${location.lng});
            way["amenity"="hospital"](around:${radius},${location.lat},${location.lng});
            node["amenity"="clinic"](around:${radius},${location.lat},${location.lng});
        );
        out center;
    `;

    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    try {
        document.getElementById('hospitals-list').innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>Searching for hospitals...</p>
            </div>
        `;

        const response = await fetch(url);
        const data = await response.json();

        if (data.elements && data.elements.length > 0) {
            // Process hospitals
            AppState.hospitals = data.elements
                .filter(el => el.tags && el.tags.name)
                .slice(0, CONFIG.maxHospitals)
                .map(hospital => {
                    const coords = hospital.center || { lat: hospital.lat, lon: hospital.lon };
                    const distance = calculateDistance(location, { lat: coords.lat, lng: coords.lon });

                    return {
                        id: hospital.id,
                        name: hospital.tags.name,
                        type: hospital.tags.amenity || 'hospital',
                        lat: coords.lat,
                        lng: coords.lon,
                        distance: distance,
                        address: hospital.tags['addr:full'] || hospital.tags['addr:street'] || '',
                        phone: hospital.tags.phone || '',
                        website: hospital.tags.website || ''
                    };
                });

            // Sort by distance
            AppState.hospitals.sort((a, b) => a.distance - b.distance);

            // Clear existing markers
            clearHospitalMarkers();

            // Add new markers
            AppState.hospitals.forEach((hospital, index) => {
                addHospitalMarker(hospital, index);
            });

            // Display hospital list
            displayHospitalsList();

            // Auto-select nearest
            if (AppState.hospitals.length > 0) {
                selectHospital(AppState.hospitals[0]);
            }

            showNotification(`Found ${AppState.hospitals.length} nearby hospitals`, 'success');
        } else {
            document.getElementById('hospitals-list').innerHTML = `
                <p style="text-align: center; padding: 2rem; color: #999;">
                    No hospitals found within ${radius / 1000}km.<br>
                    Try increasing the search radius.
                </p>
            `;
        }
    } catch (error) {
        console.error('Hospital search failed:', error);
        document.getElementById('hospitals-list').innerHTML = `
            <p style="text-align: center; padding: 2rem; color: #f44336;">
                Search failed. Please try again.
            </p>
        `;
    }
}

/**
 * Add hospital marker
 */
function addHospitalMarker(hospital, index) {
    const isNearest = index === 0;

    const icon = L.divIcon({
        className: 'hospital-marker',
        html: `
            <div style="
                width: ${isNearest ? '36px' : '30px'};
                height: ${isNearest ? '36px' : '30px'};
                background: ${isNearest ? '#4CAF50' : '#F44336'};
                border: 3px solid white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: ${isNearest ? '14px' : '12px'};
                box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                cursor: pointer;
            ">${index + 1}</div>
        `,
        iconSize: [isNearest ? 36 : 30, isNearest ? 36 : 30],
        iconAnchor: [isNearest ? 18 : 15, isNearest ? 18 : 15]
    });

    const marker = L.marker([hospital.lat, hospital.lng], { icon })
        .addTo(AppState.map)
        .bindPopup(`
            <div style="padding: 8px; min-width: 200px;">
                <h3 style="margin: 0 0 8px 0; font-size: 14px;">
                    ${isNearest ? '🏆 ' : ''}${hospital.name}
                </h3>
                <p style="margin: 4px 0; font-size: 12px; color: #666;">
                    📏 ${formatDistance(hospital.distance)}
                </p>
                ${hospital.address ? `<p style="margin: 4px 0; font-size: 11px; color: #999;">${hospital.address}</p>` : ''}
                ${hospital.phone ? `<p style="margin: 4px 0; font-size: 11px; color: #999;">📞 ${hospital.phone}</p>` : ''}
                <button 
                    onclick="selectHospital(AppState.hospitals[${index}])"
                    style="margin-top: 8px; padding: 6px 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;">
                    Get Directions
                </button>
            </div>
        `);

    marker.on('click', () => selectHospital(hospital));
    AppState.hospitalMarkers.push(marker);
}

/**
 * Display hospitals list
 */
function displayHospitalsList() {
    const container = document.getElementById('hospitals-list');

    if (AppState.hospitals.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999;">No hospitals found</p>';
        return;
    }

    container.innerHTML = AppState.hospitals.map((hospital, index) => {
        const isNearest = index === 0;
        return `
            <div class="hospital-card ${isNearest ? 'nearest' : ''}" onclick="selectHospital(AppState.hospitals[${index}])">
                <div class="hospital-rank">${index + 1}</div>
                <div class="hospital-info">
                    <h3>
                        ${hospital.name}
                        ${isNearest ? '<span class="badge">NEAREST</span>' : ''}
                    </h3>
                    <p>${hospital.address || hospital.type}</p>
                </div>
                <div class="distance-badge">${formatDistance(hospital.distance)}</div>
            </div>
        `;
    }).join('');
}

/**
 * Select hospital and show route
 */
function selectHospital(hospital) {
    AppState.selectedHospital = hospital;

    if (AppState.userLocation) {
        calculateRoute(AppState.userLocation, hospital);
    }

    // Zoom to show both user and hospital
    const bounds = L.latLngBounds(
        [AppState.userLocation.lat, AppState.userLocation.lng],
        [hospital.lat, hospital.lng]
    );
    AppState.map.fitBounds(bounds, { padding: [50, 50] });

    showNotification(`Selected: ${hospital.name}`, 'info');
}

/**
 * Calculate route (simple straight line for FREE version)
 */
function calculateRoute(origin, destination) {
    // Remove old route
    if (AppState.routeLine) {
        AppState.map.removeLayer(AppState.routeLine);
    }

    // Draw route line
    AppState.routeLine = L.polyline(
        [[origin.lat, origin.lng], [destination.lat, destination.lng]],
        {
            color: '#4CAF50',
            weight: 5,
            opacity: 0.8
        }
    ).addTo(AppState.map);

    // Calculate simple metrics
    const distance = calculateDistance(origin, destination);
    const duration = Math.ceil(distance * 3); // Rough estimate: 3 min per km

    // Display route info
    displayRouteInfo(distance, duration, destination.name);
}

/**
 * Display route info
 */
function displayRouteInfo(distance, duration, hospitalName) {
    const container = document.getElementById('route-info-section');
    container.innerHTML = `
        <div class="card glass-effect">
            <h2>📍 Route to Hospital</h2>
            <p style="margin-bottom: 1rem; color: var(--text-secondary);">${hospitalName}</p>
            <div class="route-info">
                <div class="route-stat">
                    <div class="stat-icon">📏</div>
                    <div class="stat-label">Distance</div>
                    <div class="stat-value">${formatDistance(distance)}</div>
                </div>
                <div class="route-stat">
                    <div class="stat-icon">⏱️</div>
                    <div class="stat-label">Est. Time</div>
                    <div class="stat-value">${duration} min</div>
                </div>
            </div>
            <button class="btn-primary" onclick="openInGoogleMaps()">
                🗺️ Open in Google Maps
            </button>
        </div>
    `;
}

/**
 * Update location status
 */
function updateLocationStatus(location, accuracy) {
    document.getElementById('location-status').innerHTML = `
        <div class="status-indicator"></div>
        <div>
            <strong>📍 Live Location</strong><br>
            <small>Accuracy: ±${Math.round(accuracy)}m</small>
        </div>
        <div style="font-family: monospace; font-size: 0.875rem;">
            ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}
        </div>
    `;
}

/**
 * Update hospital distances
 */
function updateHospitalDistances() {
    if (!AppState.userLocation) return;

    AppState.hospitals.forEach(hospital => {
        hospital.distance = calculateDistance(AppState.userLocation, hospital);
    });

    AppState.hospitals.sort((a, b) => a.distance - b.distance);
    displayHospitalsList();
}

/**
 * Clear hospital markers
 */
function clearHospitalMarkers() {
    AppState.hospitalMarkers.forEach(marker => AppState.map.removeLayer(marker));
    AppState.hospitalMarkers = [];
}

/**
 * Calculate distance between two points (Haversine formula)
 */
function calculateDistance(point1, point2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRadians(point2.lat - point1.lat);
    const dLng = toRadians(point2.lng - point1.lng);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(point1.lat)) * Math.cos(toRadians(point2.lat)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Format distance
 */
function formatDistance(km) {
    if (km < 1) {
        return `${Math.round(km * 1000)} m`;
    }
    return `${km.toFixed(1)} km`;
}

/**
 * Handle location errors
 */
function handleLocationError(error) {
    let message = '';
    switch (error.code) {
        case error.PERMISSION_DENIED:
            message = 'Location permission denied. Using default location.';
            break;
        case error.POSITION_UNAVAILABLE:
            message = 'Location unavailable.';
            break;
        case error.TIMEOUT:
            message = 'Location request timed out.';
            break;
        default:
            message = 'Unknown error occurred.';
    }
    console.error('Location error:', message);
    document.getElementById('location-status').innerHTML = `
        <div style="color: #f44336;">⚠️ ${message}</div>
    `;
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    const color = type === 'success' ? '#4CAF50' : type === 'error' ? '#F44336' : '#2196F3';

    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${color};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}


function playAlertSound(level) {
    try {
        if (level === 'CRITICAL') {
            alertSounds.critical.currentTime = 0;
            alertSounds.critical.play();
        } else if (level === 'WARNING') {
            alertSounds.warning.currentTime = 0;
            alertSounds.warning.play();
        }
    } catch (e) {
        console.warn('Audio blocked:', e);
    }
}

// 🔓 Unlock audio on first user interaction
document.addEventListener('click', () => {
    alertSounds.critical.play().then(() => {
        alertSounds.critical.pause();
        alertSounds.critical.currentTime = 0;
    }).catch(() => { });
}, { once: true });


// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);

/**
 * Utility functions for buttons
 */
function refreshSearch() {
    if (AppState.userLocation) {
        searchNearbyHospitals(AppState.userLocation);
    } else {
        alert('Location not available');
    }
}

function centerOnUser() {
    if (AppState.userLocation) {
        AppState.map.setView([AppState.userLocation.lat, AppState.userLocation.lng], 14);
    }
}

function openInGoogleMaps() {
    if (!AppState.selectedHospital || !AppState.userLocation) {
        alert('Select a hospital first');
        return;
    }

    const url = `https://www.google.com/maps/dir/${AppState.userLocation.lat},${AppState.userLocation.lng}/${AppState.selectedHospital.lat},${AppState.selectedHospital.lng}`;
    window.open(url, '_blank');
}

function triggerEmergency() {
    if (!AppState.selectedHospital) {
        alert('No hospital selected. Please wait for search to complete.');
        return;
    }

    const confirmed = confirm(`
🚨 EMERGENCY MODE

Hospital: ${AppState.selectedHospital.name}
Distance: ${formatDistance(AppState.selectedHospital.distance)}

This will:
- Lock navigation to this hospital
- Share your live location
- Open directions in Google Maps

Continue?
    `);

    if (confirmed) {
        showNotification('🚨 Emergency Mode Activated', 'error');
        openInGoogleMaps();

        // Log emergency data (you can send to backend here)
        const emergencyData = {
            timestamp: new Date().toISOString(),
            userLocation: AppState.userLocation,
            hospital: AppState.selectedHospital
        };
        console.log('Emergency Request:', emergencyData);
    }
}

// Initialize when page loads
window.addEventListener('load', () => {
    initMap();
});

setTimeout(() => {
    playAlertSound('CRITICAL');
    showNotification('🚨 CRITICAL HEALTH ALERT', 'error');
}, 3000);


// 🚨 ADMIN TEST ALERT (Option 3)
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('test-alert-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
        showNotification('🚨 CRITICAL HEALTH ALERT (TEST MODE)', 'error');
        playAlertSound('CRITICAL');

        // Optional: flash banner
        const banner = document.getElementById('zoneAlert');
        if (banner) {
            banner.style.display = 'block';
            banner.style.background = '#d32f2f';
            banner.textContent = '🚨 CRITICAL ZONE – TEST ALERT';
            setTimeout(() => banner.style.display = 'none', 4000);
        }
    });
});
