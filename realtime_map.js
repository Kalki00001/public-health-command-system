// ===== REAL-TIME LOCATION-AGNOSTIC MAP SYSTEM =====
// Global, real-time hospital finder with routing capabilities
// Configuration
const MAP_CONFIG = {
    API_KEY: 'YOUR_GOOGLE_MAPS_API_KEY', // Replace with your actual API key
    DEFAULT_ZOOM: 15,
    MIN_ZOOM: 10,
    MAX_ZOOM: 18,
    UPDATE_INTERVAL: 5000, // Update every 5 seconds
    MOVEMENT_THRESHOLD: 50, // Update route if user moves > 50 meters
    HOSPITAL_SEARCH_RADIUS: 5000, // Search within 5km radius
    MAX_HOSPITALS_DISPLAY: 10
};

// State management for real-time tracking
const MapState = {
    map: null,
    userMarker: null,
    userLocation: null,
    lastRouteUpdate: null,
    nearbyHospitals: [],
    selectedHospital: null,
    routePolyline: null,
    hospitalMarkers: [],
    directionsService: null,
    directionsRenderer: null,
    watchId: null,
    isTracking: false,
    placesService: null,
    infoWindows: []
};

/**
 * Initialize Google Maps with real-time tracking
 */
async function initRealtimeMap(containerId = 'realtime-map') {
    // Load Google Maps
    if (!window.google || !window.google.maps) {
        console.error('Google Maps API not loaded');
        showMapNotification('Please add Google Maps API to use this feature', 'error');
        return;
    }

    // Get user's initial location
    if (!navigator.geolocation) {
        showMapNotification('Geolocation is not supported by your browser', 'error');
        return;
    }

    // Request initial position
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const initialLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            // Initialize map
            createGoogleMap(containerId, initialLocation);

            // Start continuous tracking
            startRealtimeTracking();

            // Initial hospital search
            searchNearbyHospitals(initialLocation);
        },
        (error) => {
            handleLocationError(error);
            // Fallback to default location
            const fallbackLocation = { lat: 19.0760, lng: 72.8777 }; // Mumbai
            createGoogleMap(containerId, fallbackLocation);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

/**
 * Create Google Map instance
 */
function createGoogleMap(containerId, initialLocation) {
    const mapContainer = document.getElementById(containerId);
    if (!mapContainer) {
        console.error(`Map container ${containerId} not found`);
        return;
    }

    // Map options
    MapState.map = new google.maps.Map(mapContainer, {
        center: initialLocation,
        zoom: MAP_CONFIG.DEFAULT_ZOOM,
        minZoom: MAP_CONFIG.MIN_ZOOM,
        maxZoom: MAP_CONFIG.MAX_ZOOM,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true,
        styles: [
            {
                featureType: 'poi.medical',
                elementType: 'labels.icon',
                stylers: [{ visibility: 'on' }]
            }
        ]
    });

    // Initialize services
    MapState.directionsService = new google.maps.DirectionsService();
    MapState.directionsRenderer = new google.maps.DirectionsRenderer({
        map: MapState.map,
        suppressMarkers: true, // We'll add custom markers
        polylineOptions: {
            strokeColor: '#4CAF50',
            strokeWeight: 5,
            strokeOpacity: 0.8
        }
    });
    MapState.placesService = new google.maps.places.PlacesService(MapState.map);

    // Add user marker
    addUserMarker(initialLocation);

    // Update UI
    updateLocationDisplay(initialLocation, 'Map initialized');
}

/**
 * Add/Update user location marker
 */
function addUserMarker(location) {
    if (MapState.userMarker) {
        // Update existing marker
        MapState.userMarker.setPosition(location);
    } else {
        // Create new marker
        MapState.userMarker = new google.maps.Marker({
            position: location,
            map: MapState.map,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: '#2196F3',
                fillOpacity: 1,
                strokeColor: '#FFFFFF',
                strokeWeight: 3
            },
            title: 'Your Location',
            zIndex: 1000
        });

        // Add pulsing animation
        const pulseCircle = new google.maps.Circle({
            strokeColor: '#2196F3',
            strokeOpacity: 0,
            strokeWeight: 0,
            fillColor: '#2196F3',
            fillOpacity: 0.2,
            map: MapState.map,
            center: location,
            radius: 100,
            zIndex: 999
        });

        // Animate pulse
        let growing = true;
        setInterval(() => {
            const currentRadius = pulseCircle.getRadius();
            if (growing) {
                pulseCircle.setRadius(currentRadius + 5);
                if (currentRadius >= 200) growing = false;
            } else {
                pulseCircle.setRadius(currentRadius - 5);
                if (currentRadius <= 100) growing = true;
            }
        }, 100);
    }

    // Center map on user
    MapState.map.setCenter(location);
    MapState.userLocation = location;
}

/**
 * Start real-time location tracking
 */
function startRealtimeTracking() {
    if (MapState.isTracking) {
        console.log('Already tracking location');
        return;
    }

    const options = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
    };

    MapState.watchId = navigator.geolocation.watchPosition(
        (position) => {
            const newLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            const moved = MapState.userLocation
                ? calculateDistanceMeters(MapState.userLocation, newLocation)
                : Infinity;

            // Update location
            MapState.userLocation = newLocation;
            addUserMarker(newLocation);

            // Update UI
            updateLocationDisplay(newLocation, `Accuracy: ±${Math.round(position.coords.accuracy)}m`);

            // If user moved significantly, update route
            if (moved > MAP_CONFIG.MOVEMENT_THRESHOLD) {
                console.log(`User moved ${Math.round(moved)}m - updating route`);

                // Re-search hospitals if moved significantly
                if (moved > 500) {
                    searchNearbyHospitals(newLocation);
                }

                // Update route if hospital is selected
                if (MapState.selectedHospital) {
                    calculateRoute(newLocation, MapState.selectedHospital.geometry.location);
                }

                // Update distances in hospital list
                updateHospitalDistances(newLocation);
            }

            MapState.isTracking = true;
            showMapNotification('Location tracking active', 'success');
        },
        (error) => {
            handleLocationError(error);
            MapState.isTracking = false;
        },
        options
    );
}

/**
 * Stop real-time tracking
 */
function stopRealtimeTracking() {
    if (MapState.watchId) {
        navigator.geolocation.clearWatch(MapState.watchId);
        MapState.watchId = null;
        MapState.isTracking = false;
        showMapNotification('Location tracking stopped', 'info');
    }
}

/**
 * Search for nearby hospitals using Google Places API
 */
function searchNearbyHospitals(location) {
    if (!MapState.placesService) {
        console.error('Places service not initialized');
        return;
    }

    const request = {
        location: location,
        radius: MAP_CONFIG.HOSPITAL_SEARCH_RADIUS,
        type: 'hospital',
        rankBy: google.maps.places.RankBy.DISTANCE
    };

    MapState.placesService.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
            // Clear existing markers
            clearHospitalMarkers();

            // Store hospitals
            MapState.nearbyHospitals = results.slice(0, MAP_CONFIG.MAX_HOSPITALS_DISPLAY);

            // Add markers for each hospital
            MapState.nearbyHospitals.forEach((hospital, index) => {
                addHospitalMarker(hospital, index);
            });

            // Calculate distances
            updateHospitalDistances(location);

            // Display hospital list
            displayHospitalList(MapState.nearbyHospitals);

            // Auto-select nearest hospital
            if (MapState.nearbyHospitals.length > 0) {
                selectHospital(MapState.nearbyHospitals[0], true);
            }

            showMapNotification(`Found ${MapState.nearbyHospitals.length} nearby hospitals`, 'success');
        } else {
            console.error('Places search failed:', status);
            showMapNotification('Failed to find nearby hospitals', 'error');
        }
    });
}

/**
 * Add hospital marker to map
 */
function addHospitalMarker(hospital, index) {
    const marker = new google.maps.Marker({
        position: hospital.geometry.location,
        map: MapState.map,
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: index === 0 ? 10 : 8,
            fillColor: index === 0 ? '#4CAF50' : '#F44336',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2
        },
        title: hospital.name,
        label: {
            text: (index + 1).toString(),
            color: 'white',
            fontSize: '12px',
            fontWeight: 'bold'
        },
        zIndex: index === 0 ? 900 : 800 - index
    });

    // Add click listener
    marker.addListener('click', () => {
        selectHospital(hospital, false);
    });

    // Add info window
    const infoWindow = new google.maps.InfoWindow({
        content: createHospitalInfoContent(hospital, index)
    });

    marker.addListener('mouseover', () => {
        infoWindow.open(MapState.map, marker);
    });

    marker.addListener('mouseout', () => {
        infoWindow.close();
    });

    MapState.hospitalMarkers.push(marker);
    MapState.infoWindows.push(infoWindow);
}

/**
 * Create hospital info window content
 */
function createHospitalInfoContent(hospital, index) {
    const distance = hospital.distance
        ? `<div style="margin-top: 5px; color: #2196F3; font-weight: bold;">📏 ${formatDistance(hospital.distance)}</div>`
        : '';

    const rating = hospital.rating
        ? `<div style="margin-top: 5px;">⭐ ${hospital.rating}/5</div>`
        : '';

    return `
        <div style="padding: 10px; min-width: 200px;">
            <h3 style="margin: 0 0 10px 0; color: #333; font-size: 14px;">
                ${index === 0 ? '🏆 ' : ''}${hospital.name}
            </h3>
            <div style="color: #666; font-size: 12px;">
                ${hospital.vicinity}
            </div>
            ${distance}
            ${rating}
            <button 
                onclick="selectHospital(MapState.nearbyHospitals[${index}], false)" 
                style="margin-top: 10px; padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;">
                Get Directions
            </button>
        </div>
    `;
}

/**
 * Select a hospital and calculate route
 */
function selectHospital(hospital, autoSelect = false) {
    MapState.selectedHospital = hospital;

    if (!MapState.userLocation) {
        showMapNotification('User location not available', 'error');
        return;
    }

    // Calculate and display route
    calculateRoute(MapState.userLocation, hospital.geometry.location);

    // Highlight in list
    highlightHospitalInList(hospital.place_id);

    if (!autoSelect) {
        showMapNotification(`Selected: ${hospital.name}`, 'info');
    }
}

/**
 * Calculate route from user to hospital
 */
function calculateRoute(origin, destination) {
    if (!MapState.directionsService) {
        console.error('Directions service not initialized');
        return;
    }

    const request = {
        origin: origin,
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC
    };

    MapState.directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
            // Display route
            MapState.directionsRenderer.setDirections(result);

            // Extract route information
            const route = result.routes[0];
            const leg = route.legs[0];

            const routeInfo = {
                distance: leg.distance.value, // in meters
                duration: leg.duration.value, // in seconds
                distanceText: leg.distance.text,
                durationText: leg.duration.text
            };

            // Update UI with route info
            displayRouteInfo(routeInfo);

            MapState.lastRouteUpdate = new Date();

            console.log('Route calculated:', routeInfo);
        } else {
            console.error('Directions request failed:', status);
            showMapNotification('Failed to calculate route', 'error');
        }
    });
}

/**
 * Update distances for all hospitals based on current location
 */
function updateHospitalDistances(userLocation) {
    MapState.nearbyHospitals.forEach(hospital => {
        const distance = calculateDistanceMeters(
            userLocation,
            { lat: hospital.geometry.location.lat(), lng: hospital.geometry.location.lng() }
        );
        hospital.distance = distance;
    });

    // Re-sort by distance
    MapState.nearbyHospitals.sort((a, b) => a.distance - b.distance);

    // Update display
    displayHospitalList(MapState.nearbyHospitals);
}

/**
 * Display list of hospitals in UI
 */
function displayHospitalList(hospitals) {
    const container = document.getElementById('realtime-hospitals-list');
    if (!container) return;

    if (hospitals.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #999;">
                <p>No hospitals found nearby</p>
                <button onclick="searchNearbyHospitals(MapState.userLocation)" class="btn-primary">
                    Refresh Search
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = hospitals.map((hospital, index) => {
        const isNearest = index === 0;
        const distance = hospital.distance ? formatDistance(hospital.distance) : 'Calculating...';
        const isOpen = hospital.opening_hours?.open_now;

        return `
            <div class="hospital-card ${isNearest ? 'nearest-hospital' : ''}" 
                 onclick="selectHospital(MapState.nearbyHospitals[${index}], false)"
                 data-place-id="${hospital.place_id}">
                <div class="hospital-rank">${index + 1}</div>
                <div class="hospital-info">
                    <h3>${hospital.name} ${isNearest ? '<span class="badge-nearest">NEAREST</span>' : ''}</h3>
                    <p class="hospital-address">📍 ${hospital.vicinity}</p>
                    ${hospital.rating ? `<p class="hospital-rating">⭐ ${hospital.rating}/5</p>` : ''}
                    ${isOpen !== undefined ? `<p class="hospital-status ${isOpen ? 'open' : 'closed'}">
                        ${isOpen ? '✅ Open Now' : '🔴 Closed'}
                    </p>` : ''}
                </div>
                <div class="hospital-distance">
                    <div class="distance-badge ${isNearest ? 'nearest' : ''}">
                        ${distance}
                    </div>
                    <button class="btn-directions" onclick="event.stopPropagation(); selectHospital(MapState.nearbyHospitals[${index}], false)">
                        🧭 Directions
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Display route information
 */
function displayRouteInfo(routeInfo) {
    const container = document.getElementById('route-info-display');
    if (!container) return;

    container.innerHTML = `
        <div class="route-info-card glass-effect">
            <h3>📍 Route to Hospital</h3>
            <div class="route-stats">
                <div class="route-stat">
                    <div class="stat-icon">📏</div>
                    <div class="stat-details">
                        <div class="stat-label">Distance</div>
                        <div class="stat-value">${routeInfo.distanceText}</div>
                    </div>
                </div>
                <div class="route-stat">
                    <div class="stat-icon">⏱️</div>
                    <div class="stat-details">
                        <div class="stat-label">Estimated Time</div>
                        <div class="stat-value">${routeInfo.durationText}</div>
                    </div>
                </div>
                <div class="route-stat">
                    <div class="stat-icon">🚗</div>
                    <div class="stat-details">
                        <div class="stat-label">Mode</div>
                        <div class="stat-value">Driving</div>
                    </div>
                </div>
            </div>
            <div class="route-actions">
                <button class="btn-emergency" onclick="triggerEmergencyMode()">
                    🚨 Emergency Mode
                </button>
                <button class="btn-secondary" onclick="openInGoogleMaps()">
                    Open in Google Maps
                </button>
            </div>
        </div>
    `;
}

/**
 * Update location display
 */
function updateLocationDisplay(location, status) {
    const container = document.getElementById('location-status-display');
    if (!container) return;

    container.innerHTML = `
        <div class="location-status active">
            <div class="status-indicator"></div>
            <div class="status-text">
                <strong>📍 Live Location</strong>
                <span>${status}</span>
            </div>
            <div class="coordinates">
                ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}
            </div>
            <button class="btn-small" onclick="MapState.map.setCenter(MapState.userLocation)">
                Center Map
            </button>
        </div>
    `;
}

/**
 * Highlight hospital in list
 */
function highlightHospitalInList(placeId) {
    // Remove previous highlights
    document.querySelectorAll('.hospital-card').forEach(card => {
        card.classList.remove('selected');
    });

    // Add highlight to selected
    const selectedCard = document.querySelector(`[data-place-id="${placeId}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
        selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

/**
 * Clear hospital markers
 */
function clearHospitalMarkers() {
    MapState.hospitalMarkers.forEach(marker => marker.setMap(null));
    MapState.hospitalMarkers = [];
    MapState.infoWindows.forEach(window => window.close());
    MapState.infoWindows = [];
}

/**
 * Calculate distance between two points in meters
 */
function calculateDistanceMeters(point1, point2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = toRadians(point2.lat - point1.lat);
    const dLng = toRadians(point2.lng - point1.lng);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(point1.lat)) * Math.cos(toRadians(point2.lat)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Format distance for display
 */
function formatDistance(meters) {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Handle location errors
 */
function handleLocationError(error) {
    let message = '';
    switch (error.code) {
        case error.PERMISSION_DENIED:
            message = 'Location permission denied. Please enable location access.';
            break;
        case error.POSITION_UNAVAILABLE:
            message = 'Location information unavailable.';
            break;
        case error.TIMEOUT:
            message = 'Location request timed out.';
            break;
        default:
            message = 'An unknown error occurred.';
    }
    showMapNotification(message, 'error');
}

/**
 * Show map notification
 */
function showMapNotification(message, type = 'info') {
    // Reuse existing notification function if available
    if (typeof showNotification === 'function') {
        showNotification(message, type);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

/**
 * Emergency mode - locks to nearest hospital
 */
function triggerEmergencyMode() {
    if (!MapState.selectedHospital) {
        showMapNotification('No hospital selected', 'error');
        return;
    }

    if (!MapState.userLocation) {
        showMapNotification('User location not available', 'error');
        return;
    }

    const hospital = MapState.selectedHospital;
    const distance = hospital.distance ? formatDistance(hospital.distance) : 'Unknown';

    const confirmed = confirm(`
🚨 EMERGENCY MODE

You are about to send an emergency request to:
${hospital.name}

Distance: ${distance}
Address: ${hospital.vicinity}

This will:
- Lock navigation to this hospital
- Share your live location
- Notify the hospital (if integrated)

Continue?
    `);

    if (confirmed) {
        // Lock the route
        showMapNotification('🚨 Emergency Mode Activated', 'error');

        // You can integrate with backend here
        const emergencyData = {
            timestamp: new Date().toISOString(),
            userLocation: MapState.userLocation,
            hospital: {
                name: hospital.name,
                placeId: hospital.place_id,
                address: hospital.vicinity,
                coordinates: {
                    lat: hospital.geometry.location.lat(),
                    lng: hospital.geometry.location.lng()
                }
            },
            distance: hospital.distance
        };

        console.log('Emergency request:', emergencyData);

        // Send to backend
        // await fetch('/api/emergency/request', { method: 'POST', body: JSON.stringify(emergencyData) });
    }
}

/**
 * Open selected hospital in Google Maps
 */
function openInGoogleMaps() {
    if (!MapState.selectedHospital || !MapState.userLocation) {
        showMapNotification('Location or hospital not available', 'error');
        return;
    }

    const destLat = MapState.selectedHospital.geometry.location.lat();
    const destLng = MapState.selectedHospital.geometry.location.lng();
    const url = `https://www.google.com/maps/dir/${MapState.userLocation.lat},${MapState.userLocation.lng}/${destLat},${destLng}`;

    window.open(url, '_blank');
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.RealtimeMap = {
        init: initRealtimeMap,
        startTracking: startRealtimeTracking,
        stopTracking: stopRealtimeTracking,
        searchHospitals: searchNearbyHospitals,
        selectHospital: selectHospital,
        state: MapState
    };
}
