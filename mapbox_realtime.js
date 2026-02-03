// ===== MAPBOX-BASED REAL-TIME HOSPITAL FINDER =====
// Alternative to Google Maps with generous free tier (50,000 requests/month)
// ===== ZONE RULES =====
const ZONE_RULES = {
    RED_MIN: 100,     // critical
    ORANGE_MIN: 50    // warning
};

function getZoneFromPatients(p) {
    if (p >= ZONE_RULES.RED_MIN) return "red";
    if (p >= ZONE_RULES.ORANGE_MIN) return "orange";
    return "blue";
}

function getZoneColor(zone) {
    if (zone === "red") return "#ff1744";
    if (zone === "orange") return "#ff9100";
    return "#2979ff";
}

const id = hospital.id || hospital.place_name || hospital.text;

if (!ZoneAlertState.lastZones[id]) {
    ZoneAlertState.lastZones[id] = hospital.zone;

    if (hospital.zone === "red") {
        showZoneAlert(
            `⚠️ CRITICAL: ${hospital.text || hospital.place_name} is in RED ZONE`,
            "red"
        );
    }
} else {
    const prev = ZoneAlertState.lastZones[id];
    if (prev !== hospital.zone) {
        ZoneAlertState.lastZones[id] = hospital.zone;

        showZoneAlert(
            `🚦 ${hospital.text || hospital.place_name}: ${prev.toUpperCase()} → ${hospital.zone.toUpperCase()}`,
            hospital.zone
        );
    }
}


// Mapbox Configuration
const MAPBOX_CONFIG = {
    ACCESS_TOKEN: 'YOUR_MAPBOX_ACCESS_TOKEN', // Get from https://account.mapbox.com/
    STYLE: 'mapbox://styles/mapbox/dark-v11', // Map style
    DEFAULT_ZOOM: 14,
    UPDATE_INTERVAL: 5000,
    MOVEMENT_THRESHOLD: 50, // meters
    HOSPITAL_SEARCH_RADIUS: 5000, // meters
    MAX_HOSPITALS: 10
};

// State
const MapboxState = {
    map: null,
    userMarker: null,
    userLocation: null,
    watchId: null,
    isTracking: false,
    hospitals: [],
    selectedHospital: null,
    hospitalMarkers: [],
    routeLayer: null
};

/**
 * Initialize Mapbox GL JS map with real-time tracking
 */
function initMapboxRealtimeMap(containerId = 'mapbox-map') {
    // Check if Mapbox GL is loaded
    if (!window.mapboxgl) {
        console.error('Mapbox GL JS not loaded');
        alert('Please include Mapbox GL JS library');
        return;
    }

    // Set access token
    mapboxgl.accessToken = MAPBOX_CONFIG.ACCESS_TOKEN;

    // Get initial location
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const initialLocation = {
                lng: position.coords.longitude,
                lat: position.coords.latitude
            };

            createMapboxMap(containerId, initialLocation);
            startMapboxTracking();
            searchMapboxHospitals(initialLocation);
        },
        (error) => {
            handleMapboxLocationError(error);
            // Fallback to default location
            const fallbackLocation = { lng: 72.8777, lat: 19.0760 }; // Mumbai
            createMapboxMap(containerId, fallbackLocation);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

/**
 * Create Mapbox map instance
 */
function createMapboxMap(containerId, initialLocation) {
    MapboxState.map = new mapboxgl.Map({
        container: containerId,
        style: MAPBOX_CONFIG.STYLE,
        center: [initialLocation.lng, initialLocation.lat],
        zoom: MAPBOX_CONFIG.DEFAULT_ZOOM,
        pitch: 45, // 3D tilt
        bearing: 0
    });

    // Add controls
    MapboxState.map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    MapboxState.map.addControl(new mapboxgl.GeolocateControl({
        positionOptions: {
            enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true
    }), 'top-right');
    MapboxState.map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    function generateGrid(centerLng, centerLat, size = 0.01, count = 5) {
        const features = [];
        const half = Math.floor(count / 2);

        for (let x = -half; x <= half; x++) {
            for (let y = -half; y <= half; y++) {
                const lng = centerLng + x * size;
                const lat = centerLat + y * size;

                features.push({
                    type: "Feature",
                    properties: {
                        grid_id: `${x}_${y}`,
                        zone: "green"   // default
                    },
                    geometry: {
                        type: "Polygon",
                        coordinates: [[
                            [lng, lat],
                            [lng + size, lat],
                            [lng + size, lat + size],
                            [lng, lat + size],
                            [lng, lat]
                        ]]
                    }
                });
            }
        }

        return {
            type: "FeatureCollection",
            features
        };
    }


    // Wait for map to load
    MapboxState.map.on('load', () => {
        addMapboxUserMarker(initialLocation);
        console.log('Mapbox map loaded successfully');

        const gridData = generateGrid(
            initialLocation.lng,
            initialLocation.lat
        );


        MapboxState.map.addSource("risk-grid", {
            type: "geojson",
            data: gridData
        });

        MapboxState.map.addLayer({
            id: "risk-grid-layer",
            type: "fill",
            source: "risk-grid",
            paint: {
                "fill-color": [
                    "case",
                    ["==", ["get", "zone"], "red"], "#ff3b3b",
                    ["==", ["get", "zone"], "orange"], "#ff9800",
                    ["==", ["get", "zone"], "green"], "#4caf50",
                    "#4caf50"
                ],
                "fill-opacity": 0.45,
                "fill-outline-color": "#222222"
            }
        });

    });

    MapboxState.userLocation = initialLocation;
}

/**
 * Add animated user location marker
 */
function addMapboxUserMarker(location) {
    if (!MapboxState.map) return;

    // Create custom marker element
    const el = document.createElement('div');
    el.className = 'mapbox-user-marker';
    el.style.cssText = `
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: radial-gradient(circle, #2196F3 0%, #1976D2 100%);
        border: 4px solid white;
        box-shadow: 0 0 20px rgba(33, 150, 243, 0.6);
        animation: pulse-marker 2s infinite;
    `;

    // Add marker to map
    MapboxState.userMarker = new mapboxgl.Marker({
        element: el,
        anchor: 'center'
    })
        .setLngLat([location.lng, location.lat])
        .addTo(MapboxState.map);

    // Add pulsing circle
    addPulsingCircle(location);
}

/**
 * Add pulsing circle around user marker
 */
function addPulsingCircle(location) {
    if (!MapboxState.map.getSource('user-pulse')) {
        MapboxState.map.addSource('user-pulse', {
            type: 'geojson',
            data: {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [location.lng, location.lat]
                }
            }
        });

        MapboxState.map.addLayer({
            id: 'user-pulse-layer',
            type: 'circle',
            source: 'user-pulse',
            paint: {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    12, 50,
                    16, 100
                ],
                'circle-color': '#2196F3',
                'circle-opacity': 0.3,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#2196F3',
                'circle-stroke-opacity': 0.8
            }
        });
    }
}

/**
 * Start real-time location tracking
 */
function startMapboxTracking() {
    if (MapboxState.isTracking) return;

    MapboxState.watchId = navigator.geolocation.watchPosition(
        (position) => {
            const newLocation = {
                lng: position.coords.longitude,
                lat: position.coords.latitude
            };

            const moved = MapboxState.userLocation
                ? getDistanceMeters(MapboxState.userLocation, newLocation)
                : Infinity;

            // Update marker position
            if (MapboxState.userMarker) {
                MapboxState.userMarker.setLngLat([newLocation.lng, newLocation.lat]);
            }

            // Update pulse circle
            if (MapboxState.map.getSource('user-pulse')) {
                MapboxState.map.getSource('user-pulse').setData({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [newLocation.lng, newLocation.lat]
                    }
                });
            }

            // Center map on user
            MapboxState.map.flyTo({
                center: [newLocation.lng, newLocation.lat],
                duration: 1000
            });

            MapboxState.userLocation = newLocation;

            // Update hospital distances
            if (moved > MAPBOX_CONFIG.MOVEMENT_THRESHOLD) {
                updateMapboxHospitalDistances();

                // Re-search if moved significantly
                if (moved > 500) {
                    searchMapboxHospitals(newLocation);
                }

                // Update route if hospital selected
                if (MapboxState.selectedHospital) {
                    calculateMapboxRoute(newLocation, MapboxState.selectedHospital.geometry.coordinates);
                }
            }

            MapboxState.isTracking = true;
            updateMapboxLocationDisplay(newLocation, position.coords.accuracy);
        },
        handleMapboxLocationError,
        {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        }
    );
}

/**
 * Search nearby hospitals using Mapbox Geocoding API
 */
async function searchMapboxHospitals(location) {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/hospital.json?proximity=${location.lng},${location.lat}&limit=${MAPBOX_CONFIG.MAX_HOSPITALS}&types=poi&access_token=${MAPBOX_CONFIG.ACCESS_TOKEN}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.features && data.features.length > 0) {
            // Filter only hospitals
            MapboxState.hospitals = data.features.filter(place =>
                place.properties.category &&
                (place.properties.category.includes('hospital') ||
                    place.properties.category.includes('medical') ||
                    place.text.toLowerCase().includes('hospital'))
            );

            // Calculate distances
            MapboxState.hospitals.forEach(hospital => {
                const hospitalCoords = {
                    lng: hospital.geometry.coordinates[0],
                    lat: hospital.geometry.coordinates[1]
                };

                // DEMO patient data
                hospital.patients = Math.floor(Math.random() * 150);

                // Zone calculation
                hospital.zone = getZoneFromPatients(hospital.patients);

                hospital.distance = getDistanceMeters(location, hospitalCoords);
            });



            // Sort by distance
            MapboxState.hospitals.sort((a, b) => a.distance - b.distance);

            // Clear existing markers
            clearMapboxHospitalMarkers();

            // Add new markers
            MapboxState.hospitals.forEach((hospital, index) => {
                addMapboxHospitalMarker(hospital, index);
            });

            // Display list
            displayMapboxHospitalList();

            // Auto-select nearest
            if (MapboxState.hospitals.length > 0) {
                selectMapboxHospital(MapboxState.hospitals[0]);
            }

            showMapboxNotification(`Found ${MapboxState.hospitals.length} nearby hospitals`, 'success');
        } else {
            // Fallback: Use OpenStreetMap Overpass API
            await searchOSMHospitals(location);
        }
    } catch (error) {
        console.error('Mapbox search failed:', error);
        showMapboxNotification('Failed to find hospitals', 'error');
    }
}

/**
 * Fallback: Search hospitals using OpenStreetMap Overpass API
 */
async function searchOSMHospitals(location) {
    const radius = MAPBOX_CONFIG.HOSPITAL_SEARCH_RADIUS;
    const query = `
        [out:json];
        (
          node["amenity"="hospital"](around:${radius},${location.lat},${location.lng});
          way["amenity"="hospital"](around:${radius},${location.lat},${location.lng});
        );
        out center;
    `;

    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.elements && data.elements.length > 0) {
            MapboxState.hospitals = data.elements.slice(0, MAPBOX_CONFIG.MAX_HOSPITALS).map(hospital => {
                const coords = hospital.center || { lat: hospital.lat, lon: hospital.lon };
                return {
                    id: hospital.id,
                    text: hospital.tags?.name || 'Hospital',
                    place_name: hospital.tags?.name || 'Unnamed Hospital',
                    geometry: {
                        type: 'Point',
                        coordinates: [coords.lon, coords.lat]
                    },
                    properties: {
                        category: 'hospital',
                        address: hospital.tags?.['addr:full'] || hospital.tags?.['addr:street'] || ''
                    },
                    distance: getDistanceMeters(location, { lng: coords.lon, lat: coords.lat })
                };
            });

            // Sort by distance
            MapboxState.hospitals.sort((a, b) => a.distance - b.distance);

            // Clear and add markers
            clearMapboxHospitalMarkers();
            MapboxState.hospitals.forEach((hospital, index) => {
                addMapboxHospitalMarker(hospital, index);
            });

            displayMapboxHospitalList();

            if (MapboxState.hospitals.length > 0) {
                selectMapboxHospital(MapboxState.hospitals[0]);
            }

            showMapboxNotification(`Found ${MapboxState.hospitals.length} hospitals (OpenStreetMap)`, 'success');
        }
    } catch (error) {
        console.error('OSM search failed:', error);
        showMapboxNotification('Unable to find nearby hospitals', 'error');
    }
}

/**
 * Add hospital marker to map
 */
function addMapboxHospitalMarker(hospital, index) {
    const isNearest = index === 0;

    // Create custom marker
    const el = document.createElement('div');
    el.className = 'mapbox-hospital-marker';
    el.style.cssText = `
        width: ${isNearest ? '36px' : '30px'};
        height: ${isNearest ? '36px' : '30px'};
        background: ${getZoneColor(hospital.zone)};
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
        transition: transform 0.2s;
    `;
    el.textContent = index + 1;

    el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.2)';
    });

    el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
    });

    el.addEventListener('click', () => {
        selectMapboxHospital(hospital);
    });

    // Create popup
    const popup = new mapboxgl.Popup({ offset: 25 })
        .setHTML(`
        <div style="padding: 8px; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #333;">
                ${isNearest ? '🏆 ' : ''}${hospital.text || hospital.place_name}
            </h3>

            <p style="margin: 4px 0; font-size: 12px; color: #666;">
                📏 ${formatDistanceMeters(hospital.distance)}
            </p>

            <p style="margin: 4px 0; font-size: 12px;">
                🧑 Patients: <b>${hospital.patients}</b><br>
                🚦 Zone:
                <b style="color:${getZoneColor(hospital.zone)}">
                    ${hospital.zone.toUpperCase()}
                </b>
            </p>

            <p style="margin: 4px 0; font-size: 11px; color: #999;">
                ${hospital.properties?.address || hospital.place_name || ''}
            </p>

            <button 
                onclick="selectMapboxHospital(MapboxState.hospitals[${index}])"
                style="margin-top: 8px; padding: 6px 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;">
                Get Directions
            </button>
        </div>
    `);


    const marker = new mapboxgl.Marker({ element: el })
        .setLngLat(hospital.geometry.coordinates)
        .setPopup(popup)
        .addTo(MapboxState.map);

    MapboxState.hospitalMarkers.push(marker);
}

/**
 * Calculate and display route
 */
async function calculateMapboxRoute(origin, destination) {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination[0]},${destination[1]}?geometries=geojson&access_token=${MAPBOX_CONFIG.ACCESS_TOKEN}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];

            // Remove old route
            if (MapboxState.map.getSource('route')) {
                MapboxState.map.removeLayer('route-layer');
                MapboxState.map.removeSource('route');
            }

            // Add route to map
            MapboxState.map.addSource('route', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    geometry: route.geometry
                }
            });

            MapboxState.map.addLayer({
                id: 'route-layer',
                type: 'line',
                source: 'route',
                paint: {
                    'line-color': '#4CAF50',
                    'line-width': 6,
                    'line-opacity': 0.8
                }
            });

            // Display route info
            const routeInfo = {
                distance: route.distance,
                duration: route.duration,
                distanceText: `${(route.distance / 1000).toFixed(1)} km`,
                durationText: `${Math.ceil(route.duration / 60)} min`
            };

            displayMapboxRouteInfo(routeInfo);

            // Fit map to route
            const coordinates = route.geometry.coordinates;
            const bounds = coordinates.reduce((bounds, coord) => {
                return bounds.extend(coord);
            }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

            MapboxState.map.fitBounds(bounds, {
                padding: 50
            });
        }
    } catch (error) {
        console.error('Route calculation failed:', error);
        showMapboxNotification('Failed to calculate route', 'error');
    }
}

/**
 * Select hospital and show route
 */
function selectMapboxHospital(hospital) {
    MapboxState.selectedHospital = hospital;

    if (MapboxState.userLocation) {
        calculateMapboxRoute(MapboxState.userLocation, hospital.geometry.coordinates);
    }

    highlightMapboxHospitalInList(hospital.id);
    showMapboxNotification(`Selected: ${hospital.text || hospital.place_name}`, 'info');
}

/**
 * Display hospital list in UI
 */
function displayMapboxHospitalList() {
    const container = document.getElementById('mapbox-hospitals-list');
    if (!container) return;

    if (MapboxState.hospitals.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 2rem; color: #999;">No hospitals found</p>';
        return;
    }

    container.innerHTML = MapboxState.hospitals.map((hospital, index) => {
        const isNearest = index === 0;
        return `
            <div class="hospital-card ${isNearest ? 'nearest-hospital' : ''}" 
                 onclick="selectMapboxHospital(MapboxState.hospitals[${index}])"
                 data-hospital-id="${hospital.id}">
                <div class="hospital-rank">${index + 1}</div>
                <div class="hospital-info">
                    <h3>${hospital.text || hospital.place_name} ${isNearest ? '<span class="badge-nearest">NEAREST</span>' : ''}</h3>
                    <p class="hospital-address">📍 ${hospital.properties?.address || hospital.place_name || ''}</p>
                </div>
                <div class="hospital-distance">
                    <div class="distance-badge ${isNearest ? 'nearest' : ''}">
                        ${formatDistanceMeters(hospital.distance)}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Display route information
 */
function displayMapboxRouteInfo(routeInfo) {
    const container = document.getElementById('mapbox-route-info');
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
                        <div class="stat-label">ETA</div>
                        <div class="stat-value">${routeInfo.durationText}</div>
                    </div>
                </div>
            </div>
            <button class="btn-emergency" onclick="triggerMapboxEmergency()" style="width: 100%;">
                🚨 Emergency Mode
            </button>
        </div>
    `;
}

/**
 * Update location display
 */
function updateMapboxLocationDisplay(location, accuracy) {
    const container = document.getElementById('mapbox-location-status');
    if (!container) return;

    container.innerHTML = `
        <div class="location-status active">
            <div class="status-indicator"></div>
            <div class="status-text">
                <strong>📍 Live Location</strong>
                <span>Accuracy: ±${Math.round(accuracy)}m</span>
            </div>
            <div class="coordinates">${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}</div>
        </div>
    `;
}

/**
 * Update hospital distances
 */
function updateMapboxHospitalDistances() {
    if (!MapboxState.userLocation) return;

    MapboxState.hospitals.forEach(hospital => {
        const hospitalCoords = {
            lng: hospital.geometry.coordinates[0],
            lat: hospital.geometry.coordinates[1]
        };
        hospital.distance = getDistanceMeters(MapboxState.userLocation, hospitalCoords);
    });

    MapboxState.hospitals.sort((a, b) => a.distance - b.distance);
    displayMapboxHospitalList();
}

/**
 * Highlight selected hospital
 */
function highlightMapboxHospitalInList(hospitalId) {
    document.querySelectorAll('.hospital-card').forEach(card => {
        card.classList.remove('selected');
    });

    const selectedCard = document.querySelector(`[data-hospital-id="${hospitalId}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
        selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

/**
 * Clear hospital markers
 */
function clearMapboxHospitalMarkers() {
    MapboxState.hospitalMarkers.forEach(marker => marker.remove());
    MapboxState.hospitalMarkers = [];
}

/**
 * Calculate distance between two points
 */
function getDistanceMeters(point1, point2) {
    const R = 6371000;
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLng = (point2.lng - point1.lng) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Format distance
 */
function formatDistanceMeters(meters) {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Handle errors
 */
function handleMapboxLocationError(error) {
    console.error('Location error:', error);
    showMapboxNotification('Location access denied or unavailable', 'error');
}

/**
 * Show notification
 */
function showMapboxNotification(message, type = 'info') {
    if (typeof showNotification === 'function') {
        showNotification(message, type);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

/**
 * Emergency mode
 */
function triggerMapboxEmergency() {
    if (!MapboxState.selectedHospital) {
        alert('Please select a hospital first');
        return;
    }

    const confirmed = confirm(`
🚨 EMERGENCY MODE

Hospital: ${MapboxState.selectedHospital.text || MapboxState.selectedHospital.place_name}
Distance: ${formatDistanceMeters(MapboxState.selectedHospital.distance)}

This will lock navigation and share your live location.

Continue?
    `);

    if (confirmed) {
        showMapboxNotification('🚨 Emergency Mode Activated', 'error');
        // Integrate with backend here
    }
}

// Export
if (typeof window !== 'undefined') {
    window.MapboxRealtimeMap = {
        init: initMapboxRealtimeMap,
        startTracking: startMapboxTracking,
        searchHospitals: searchMapboxHospitals,
        selectHospital: selectMapboxHospital,
        state: MapboxState
    };
}
