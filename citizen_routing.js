/**
 * Calculate and display route to nearest hospital using FREE OSRM API
 */
async function calculateRouteToNearestHospital(userLat, userLng) {
    if (!citizenMap || !hospitals || hospitals.length === 0) {
        console.log('Map or hospitals not available for routing');
        return;
    }

    // Find nearest hospital
    const hospitalsWithDistance = hospitals.map(hospital => ({
        ...hospital,
        distance: calculateDistance(userLat, userLng, hospital.coordinates[0], hospital.coordinates[1])
    }));

    hospitalsWithDistance.sort((a, b) => a.distance - b.distance);
    const nearestHospital = hospitalsWithDistance[0];

    console.log(`Calculating route to nearest hospital: ${nearestHospital.name}`);

    // Use OSRM API (completely FREE, no API key needed!)
    const url = `https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${nearestHospital.coordinates[1]},${nearestHospital.coordinates[0]}?overview=full&geometries=geojson`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const route = data.routes[0];

            // Remove old route if exists
            if (window.hospitalRoute) {
                citizenMap.removeLayer(window.hospitalRoute);
            }

            // Convert coordinates from [lng, lat] to [lat, lng] for Leaflet
            const routeCoords = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);

            // Draw route on map
            window.hospitalRoute = L.polyline(routeCoords, {
                color: '#4CAF50',
                weight: 5,
                opacity: 0.8,
                lineJoin: 'round',
                lineCap: 'round'
            }).addTo(citizenMap);

            // Calculate distance and duration
            const distanceKm = (route.distance / 1000).toFixed(1);
            const durationMin = Math.ceil(route.duration / 60);

            // Display route information
            displayRouteInformation(nearestHospital, distanceKm, durationMin);

            // Fit map to show entire route
            const bounds = L.latLngBounds(routeCoords);
            citizenMap.fitBounds(bounds, { padding: [50, 50] });

            console.log(`Route calculated: ${distanceKm} km, ${durationMin} min`);
        } else {
            // Fallback to straight line if routing fails
            console.warn('Routing failed, showing straight line');
            showStraightLineRoute(userLat, userLng, nearestHospital);
        }
    } catch (error) {
        console.error('Route calculation error:', error);
        // Fallback to straight line
        showStraightLineRoute(userLat, userLng, nearestHospital);
    }
}

/**
 * Fallback: Show straight line route
 */
function showStraightLineRoute(userLat, userLng, hospital) {
    if (window.hospitalRoute) {
        citizenMap.removeLayer(window.hospitalRoute);
    }

    window.hospitalRoute = L.polyline(
        [[userLat, userLng], hospital.coordinates],
        {
            color: '#FF9800',
            weight: 4,
            opacity: 0.7,
            dashArray: '10, 10'
        }
    ).addTo(citizenMap);

    const distance = calculateDistance(userLat, userLng, hospital.coordinates[0], hospital.coordinates[1]);
    const distanceKm = distance.toFixed(1);
    const durationMin = Math.ceil(distance * 3); // Rough estimate

    displayRouteInformation(hospital, distanceKm, durationMin, true);
}

/**
 * Display route information card
 */
function displayRouteInformation(hospital, distanceKm, durationMin, isStraightLine = false) {
    // Check if route info container exists in citizen screen
    let routeInfoContainer = document.getElementById('citizen-route-info');

    if (!routeInfoContainer) {
        // Create container if it doesn't exist
        const citizenAlertsSection = document.querySelector('.citizen-container .section:first-child');
        if (citizenAlertsSection) {
            routeInfoContainer = document.createElement('div');
            routeInfoContainer.id = 'citizen-route-info';
            routeInfoContainer.className = 'section glass-effect';
            citizenAlertsSection.parentNode.insertBefore(routeInfoContainer, citizenAlertsSection.nextSibling);
        } else {
            console.warn('Could not find citizen alerts section to insert route info');
            return;
        }
    }

    routeInfoContainer.innerHTML = `
        <h2>🚗 Route to Nearest Hospital</h2>
        <div class="route-info-card" style="
            background: linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(33, 150, 243, 0.1));
            border: 2px solid rgba(76, 175, 80, 0.3);
            border-radius: 12px;
            padding: 1.5rem;
            margin-top: 1rem;
        ">
            <h3 style="margin: 0 0 1rem 0; color: var(--text-primary);">
                🏥 ${hospital.name}
            </h3>
            
            ${isStraightLine ? `
                <div style="background: rgba(255, 152, 0, 0.2); padding: 0.5rem; border-radius: 6px; margin-bottom: 1rem;">
                    <small style="color: #FF9800;">⚠️ Approximate route (straight line)</small>
                </div>
            ` : `
                <div style="background: rgba(76, 175, 80, 0.2); padding: 0.5rem; border-radius: 6px; margin-bottom: 1rem;">
                    <small style="color: #4CAF50;">✅ Real driving route calculated</small>
                </div>
            `}
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div style="text-align: center; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">📏</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Distance</div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: #4CAF50; margin-top: 0.25rem;">${distanceKm} km</div>
                </div>
                <div style="text-align: center; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">⏱️</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">ETA</div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: #2196F3; margin-top: 0.25rem;">${durationMin} min</div>
                </div>
            </div>

            <div style="display: grid; gap: 0.75rem;">
                <button 
                    onclick="openGoogleMapsDirections(${hospital.coordinates[0]}, ${hospital.coordinates[1]})"
                    style="
                        width: 100%;
                        padding: 0.875rem;
                        background: linear-gradient(135deg, #4CAF50, #45a049);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: transform 0.2s;
                        font-size: 1rem;
                    "
                    onmouseover="this.style.transform='translateY(-2px)'"
                    onmouseout="this.style.transform='translateY(0)'"
                >
                    🗺️ Open in Google Maps
                </button>
                
                <button 
                    onclick="recalculateRoute()"
                    style="
                        width: 100%;
                        padding: 0.875rem;
                        background: rgba(33, 150, 243, 0.2);
                        color: var(--text-primary);
                        border: 1px solid rgba(33, 150, 243, 0.3);
                        border-radius: 8px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                        font-size: 0.875rem;
                    "
                    onmouseover="this.style.background='rgba(33, 150, 243, 0.3)'"
                    onmouseout="this.style.background='rgba(33, 150, 243, 0.2)'"
                >
                    🔄 Recalculate Route
                </button>
            </div>

            ${!isStraightLine ? `
                <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(33, 150, 243, 0.1); border-radius: 8px;">
                    <small style="color: var(--text-secondary);">
                        💡 Route updates automatically as you move
                    </small>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Open route in Google Maps
 */
function openGoogleMapsDirections(destLat, destLng) {
    if (!locationManager.currentLocation) {
        alert('Your location is not available');
        return;
    }

    const { lat, lng } = locationManager.currentLocation;
    const url = `https://www.google.com/maps/dir/${lat},${lng}/${destLat},${destLng}`;
    window.open(url, '_blank');
}

/**
 * Recalculate route manually
 */
function recalculateRoute() {
    if (!locationManager.currentLocation) {
        showNotification('Location not available', 'error');
        return;
    }

    showNotification('Recalculating route...', 'info');
    calculateRouteToNearestHospital(
        locationManager.currentLocation.lat,
        locationManager.currentLocation.lng
    );
}
