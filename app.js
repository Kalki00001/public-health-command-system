

// ================= ALERT SYSTEM (GLOBAL) =================

// 🔔 Alert sounds
const alertSounds = {
    critical: new Audio("/sounds/alert.mp3"),
    warning: new Audio("/sounds/alert.mp3")
};

alertSounds.critical.preload = "auto";
alertSounds.warning.preload = "auto";

// 🔓 Unlock audio on first user interaction
document.addEventListener("click", () => {
    
    alertSounds.critical.play()
        .then(() => {
            alertSounds.critical.pause();
            alertSounds.critical.currentTime = 0;
        })
        .catch(() => {});
}, { once: true });

// 🔊 PLAY SOUND (GLOBAL FUNCTION)
function playAlertSound(level) {
    console.log("🔊 playAlertSound called:", level);
    const normalized = String(level || "").toLowerCase();
    if (normalized === "critical") {
        alertSounds.critical.currentTime = 0;
        alertSounds.critical.play();
    } else if (normalized === "warning") {
        alertSounds.warning.currentTime = 0;
        alertSounds.warning.play();
    }
}

// 🔴 RED ALERT POPUP
function showRedAlert(message) {
    const alertBox = document.getElementById("zoneAlert");
    alertBox.style.display = "block";
    alertBox.style.background = "#d32f2f";
    alertBox.innerText = "🚨 " + message;

    playAlertSound("CRITICAL");

    setTimeout(() => {
        alertBox.style.display = "none";
    }, 6000);
}

function flashScreen(color = "rgba(211, 47, 47, 0.35)", durationMs = 400) {
    const existing = document.getElementById("alert-flash-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "alert-flash-overlay";
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: ${color};
        opacity: 0;
        z-index: 9999;
        transition: opacity 120ms ease;
        pointer-events: none;
    `;
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        overlay.style.opacity = "1";
        setTimeout(() => {
            overlay.style.opacity = "0";
            setTimeout(() => overlay.remove(), 140);
        }, durationMs);
    });
}


// ===== DATA MODELS =====
const DISEASE_THRESHOLDS = {
    dengue: { warning: 10, critical: 25 },
    malaria: { warning: 8, critical: 20 },
    typhoid: { warning: 5, critical: 15 },
    covid: { warning: 15, critical: 40 },
    tuberculosis: { warning: 3, critical: 10 },
    cholera: { warning: 5, critical: 12 }
};

// Maharashtra state center coordinates (centered between major cities)
const CITY_CENTER = [19.7515, 75.7139];

// ===== STATE =====
let currentUser = null;
let wards = [];
let cases = [];
let hospitals = [];
let alerts = [];
let cityMap = null;
let citizenMap = null;
let wardChart = null;
let lastAlertIds = new Set();
let adminMapLegend = null;

// ===== LOCATION TRACKING STATE =====
let locationManager = {
    watchId: null,
    currentLocation: null,
    lastUpdate: null,
    isTracking: false,
    permissionGranted: false
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    initializeData();
    setupEventListeners();
});

function initializeData() {
    // Create wards - Major cities across Maharashtra
    wards = [
        { id: 'w1', name: 'Mumbai', population: 1250000, coordinates: [[19.0760, 72.8777], [19.1500, 72.9500], [19.0500, 73.0000], [18.9500, 72.9000]], activeAlerts: 0, totalCases: 0 },
        { id: 'w2', name: 'Pune', population: 650000, coordinates: [[18.5204, 73.8567], [18.6000, 73.9500], [18.4500, 74.0000], [18.4000, 73.8000]], activeAlerts: 0, totalCases: 0 },
        { id: 'w3', name: 'Nagpur', population: 480000, coordinates: [[21.1458, 79.0882], [21.2200, 79.1800], [21.0800, 79.2000], [21.0500, 79.0500]], activeAlerts: 0, totalCases: 0 },
        { id: 'w4', name: 'Nashik', population: 320000, coordinates: [[19.9975, 73.7898], [20.0800, 73.8800], [19.9200, 73.9000], [19.9000, 73.7500]], activeAlerts: 0, totalCases: 0 },
        { id: 'w5', name: 'Aurangabad', population: 285000, coordinates: [[19.8762, 75.3433], [19.9500, 75.4300], [19.8000, 75.4500], [19.7800, 75.3000]], activeAlerts: 0, totalCases: 0 },
        { id: 'w6', name: 'Solapur', population: 195000, coordinates: [[17.6599, 75.9064], [17.7300, 76.0000], [17.5900, 76.0200], [17.5700, 75.8800]], activeAlerts: 0, totalCases: 0 },
        { id: 'w7', name: 'Thane', population: 420000, coordinates: [[19.2183, 72.9781], [19.3000, 73.0700], [19.1500, 73.1000], [19.1200, 72.9500]], activeAlerts: 0, totalCases: 0 },
        { id: 'w8', name: 'Kolhapur', population: 175000, coordinates: [[16.7050, 74.2433], [16.7800, 74.3300], [16.6300, 74.3500], [16.6100, 74.2000]], activeAlerts: 0, totalCases: 0 },
        { id: 'w9', name: 'Amravati', population: 165000, coordinates: [[20.9374, 77.7796], [21.0200, 77.8700], [20.8600, 77.9000], [20.8400, 77.7500]], activeAlerts: 0, totalCases: 0 },
        { id: 'w10', name: 'Nanded', population: 145000, coordinates: [[19.1383, 77.3210], [19.2200, 77.4100], [19.0600, 77.4300], [19.0400, 77.2800]], activeAlerts: 0, totalCases: 0 }
    ];

    // Create hospitals - Major hospitals across Maharashtra cities
    hospitals = [
        { id: 'h1', name: 'KEM Hospital Mumbai', wardId: 'w1', type: 'District Hospital', coordinates: [19.0176, 72.8561], totalBeds: 450, availableBeds: 85 },
        { id: 'h2', name: 'Sassoon Hospital Pune', wardId: 'w2', type: 'District Hospital', coordinates: [18.5314, 73.8446], totalBeds: 380, availableBeds: 62 },
        { id: 'h3', name: 'GMCH Nagpur', wardId: 'w3', type: 'District Hospital', coordinates: [21.1367, 79.0624], totalBeds: 320, availableBeds: 48 },
        { id: 'h4', name: 'Nashik Civil Hospital', wardId: 'w4', type: 'CHC', coordinates: [20.0063, 73.7679], totalBeds: 180, availableBeds: 28 },
        { id: 'h5', name: 'GMCH Aurangabad', wardId: 'w5', type: 'District Hospital', coordinates: [19.8857, 75.3203], totalBeds: 250, availableBeds: 42 },
        { id: 'h6', name: 'Solapur Civil Hospital', wardId: 'w6', type: 'CHC', coordinates: [17.6715, 75.9106], totalBeds: 150, availableBeds: 25 },
        { id: 'h7', name: 'Thane Civil Hospital', wardId: 'w7', type: 'District Hospital', coordinates: [19.1972, 72.9722], totalBeds: 280, availableBeds: 52 },
        { id: 'h8', name: 'CPR Hospital Kolhapur', wardId: 'w8', type: 'CHC', coordinates: [16.7107, 74.2324], totalBeds: 140, availableBeds: 22 },
        { id: 'h9', name: 'Amravati District Hospital', wardId: 'w9', type: 'CHC', coordinates: [20.9258, 77.7588], totalBeds: 120, availableBeds: 18 },
        { id: 'h10', name: 'Nanded Civil Hospital', wardId: 'w10', type: 'CHC', coordinates: [19.1502, 77.3152], totalBeds: 110, availableBeds: 16 }
    ];

    // Generate dummy cases
    generateDummyCases();

    // Check and create alerts
    updateAlerts();
}

function generateDummyCases() {
    const diseases = ['dengue', 'malaria', 'typhoid', 'covid', 'tuberculosis', 'cholera'];
    const severities = ['low', 'medium', 'high'];
    const genders = ['male', 'female', 'other'];

    // Ward-specific disease patterns (realistic scenarios)
    const wardDiseasePatterns = {
        'w1': { primary: 'dengue', secondary: 'covid', casesMultiplier: 1.5 }, // Andheri East - dengue hotspot
        'w2': { primary: 'covid', secondary: 'typhoid', casesMultiplier: 0.8 }, // Bandra West - moderate
        'w3': { primary: 'malaria', secondary: 'dengue', casesMultiplier: 1.2 }, // Borivali - malaria prone
        'w4': { primary: 'typhoid', secondary: 'cholera', casesMultiplier: 1.3 }, // Dadar - water issues
        'w5': { primary: 'covid', secondary: 'tuberculosis', casesMultiplier: 1.0 }, // Goregaon - average
        'w6': { primary: 'dengue', secondary: 'malaria', casesMultiplier: 1.8 }, // Kurla - high density hotspot
        'w7': { primary: 'tuberculosis', secondary: 'covid', casesMultiplier: 1.1 }, // Malad - TB cases
        'w8': { primary: 'covid', secondary: 'dengue', casesMultiplier: 0.7 }, // Powai - low cases
        'w9': { primary: 'typhoid', secondary: 'dengue', casesMultiplier: 0.9 }, // Santacruz - moderate
        'w10': { primary: 'malaria', secondary: 'cholera', casesMultiplier: 1.6 } // Vikhroli - malaria hotspot
    };

    // Generate varied cases for each ward
    wards.forEach(ward => {
        const pattern = wardDiseasePatterns[ward.id];
        const baseCases = Math.floor(8 * pattern.casesMultiplier); // Base cases per ward

        for (let i = 0; i < baseCases; i++) {
            const daysAgo = Math.floor(Math.random() * 30);
            const date = new Date();
            date.setDate(date.getDate() - daysAgo);

            // Determine disease type based on ward pattern
            let diseaseType;
            const rand = Math.random();
            if (rand < 0.5) {
                diseaseType = pattern.primary; // 50% primary disease
            } else if (rand < 0.8) {
                diseaseType = pattern.secondary; // 30% secondary disease
            } else {
                diseaseType = diseases[Math.floor(Math.random() * diseases.length)]; // 20% random
            }

            // Severity distribution (more realistic)
            let severity;
            const sevRand = Math.random();
            if (sevRand < 0.5) {
                severity = 'low'; // 50% low
            } else if (sevRand < 0.85) {
                severity = 'medium'; // 35% medium
            } else {
                severity = 'high'; // 15% high
            }

            // Age distribution varies by disease
            let patientAge;
            if (diseaseType === 'dengue' || diseaseType === 'malaria') {
                patientAge = Math.floor(Math.random() * 60) + 5; // 5-65 (all ages)
            } else if (diseaseType === 'covid') {
                patientAge = Math.floor(Math.random() * 50) + 30; // 30-80 (older)
            } else if (diseaseType === 'tuberculosis') {
                patientAge = Math.floor(Math.random() * 40) + 20; // 20-60 (working age)
            } else {
                patientAge = Math.floor(Math.random() * 70) + 10; // 10-80 (varied)
            }

            // Recent cases more likely to be active
            const isRecent = daysAgo < 7;
            const status = isRecent ?
                (Math.random() < 0.8 ? 'active' : 'recovered') :
                (Math.random() < 0.3 ? 'active' : 'recovered');

            cases.push({
                id: `case_${Date.now()}_${ward.id}_${i}`,
                wardId: ward.id,
                diseaseType: diseaseType,
                reportedBy: 'worker_' + Math.floor(Math.random() * 15),
                severity: severity,
                timestamp: date,
                patientAge: patientAge,
                patientGender: genders[Math.floor(Math.random() * genders.length)],
                status: status
            });
        }
    });

    // Add some recent surge cases in hotspot wards (last 7 days)
    const hotspots = ['w1', 'w6', 'w10'];
    hotspots.forEach(wardId => {
        const surgeDisease = wardDiseasePatterns[wardId].primary;
        const surgeCases = Math.floor(Math.random() * 8) + 5; // 5-12 recent cases

        for (let i = 0; i < surgeCases; i++) {
            const daysAgo = Math.floor(Math.random() * 7); // Last week only
            const date = new Date();
            date.setDate(date.getDate() - daysAgo);

            cases.push({
                id: `case_surge_${Date.now()}_${wardId}_${i}`,
                wardId: wardId,
                diseaseType: surgeDisease,
                reportedBy: 'worker_surge_' + Math.floor(Math.random() * 5),
                severity: Math.random() < 0.6 ? 'medium' : 'high', // More severe in surge
                timestamp: date,
                patientAge: Math.floor(Math.random() * 60) + 10,
                patientGender: genders[Math.floor(Math.random() * genders.length)],
                status: 'active'
            });
        }
    });

    console.log(`Generated ${cases.length} disease cases across ${wards.length} wards`);
}

function updateAlerts() {
    const previousAlertIds = lastAlertIds;
    const newAlertIds = new Set();
    alerts = [];
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    wards.forEach(ward => {
        ward.activeAlerts = 0;
        // Get cases in this ward from last 7 days
        const recentCases = cases.filter(c =>
            c.wardId === ward.id &&
            c.timestamp >= weekAgo
        );

        ward.totalCases = recentCases.length;

        // Group by disease type
        const diseaseCount = {};
        recentCases.forEach(c => {
            diseaseCount[c.diseaseType] = (diseaseCount[c.diseaseType] || 0) + 1;
        });

        // Check thresholds
        Object.keys(diseaseCount).forEach(disease => {
            const count = diseaseCount[disease];
            const threshold = DISEASE_THRESHOLDS[disease];

            // Normalize to per 100k population
            const normalizedCount = (count / ward.population) * 100000;

            if (normalizedCount >= threshold.critical) {
                const alert = createAlert(ward, disease, 'critical', count, threshold.critical);
                if (alert && !previousAlertIds.has(alert.id)) {
                    showRedAlert(`${alert.message} (Threshold: ${alert.threshold} per 100k)`);
                }
            } else if (normalizedCount >= threshold.warning) {
                createAlert(ward, disease, 'warning', count, threshold.warning);
            }
        });
    });

    alerts.forEach(a => newAlertIds.add(a.id));
    lastAlertIds = newAlertIds;

    const alertsChanged = !setsEqual(previousAlertIds, newAlertIds);
    if (alertsChanged && currentUser?.role === 'admin') {
        updateDashboardStats();
        renderAlerts();
        if (cityMap) {
            initCityMap();
        }
    }
}

function createAlert(ward, disease, severity, currentCount, threshold) {
    const alert = {
        id: `alert_${ward.id}_${disease}`,
        wardId: ward.id,
        wardName: ward.name,
        diseaseType: disease,
        severity: severity,
        message: `${currentCount} ${disease} cases reported in ${ward.name} in the last 7 days`,
        threshold: threshold,
        currentCount: currentCount,
        createdAt: new Date(),
        status: 'active',
        suggestedActions: getSuggestedActions(disease, severity)
    };

    alerts.push(alert);
    ward.activeAlerts++;
    return alert;
}

function getSuggestedActions(disease, severity) {
    const actions = {
        dengue: [
            'Deploy mosquito control teams for fogging',
            'Conduct door-to-door awareness campaigns',
            'Inspect and eliminate water stagnation points',
            'Distribute mosquito repellents to affected areas'
        ],
        malaria: [
            'Intensify vector control measures',
            'Distribute insecticide-treated bed nets',
            'Conduct blood testing camps',
            'Spray anti-larval chemicals in water bodies'
        ],
        typhoid: [
            'Ensure safe drinking water supply',
            'Conduct water quality testing',
            'Promote hand hygiene awareness',
            'Vaccinate high-risk populations'
        ],
        covid: [
            'Set up testing centers in the ward',
            'Ensure mask compliance in public places',
            'Increase hospital bed capacity',
            'Accelerate vaccination drive'
        ],
        tuberculosis: [
            'Conduct contact tracing',
            'Ensure DOTS (Directly Observed Treatment)',
            'Screen high-risk populations',
            'Improve ventilation in crowded areas'
        ],
        cholera: [
            'Provide clean drinking water',
            'Improve sanitation facilities',
            'Conduct health education programs',
            'Set up oral rehydration centers'
        ]
    };

    return actions[disease] || ['Monitor the situation closely', 'Increase surveillance'];
}

// ===== AUTHENTICATION =====
function login(role) {
    currentUser = { role: role, id: `user_${Date.now()}` };

    document.getElementById('login-screen').classList.remove('active');

    if (role === 'admin') {
        document.getElementById('admin-screen').classList.add('active');
        initAdminDashboard();
    } else if (role === 'health-worker') {
        document.getElementById('health-worker-screen').classList.add('active');
        initHealthWorkerScreen();
    } else if (role === 'citizen') {
        document.getElementById('citizen-screen').classList.add('active');
        initCitizenScreen();
    }
}

function logout() {
    currentUser = null;

    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });

    document.getElementById('login-screen').classList.add('active');

    // Clean up maps
    if (cityMap) {
        cityMap.remove();
        cityMap = null;
    }
    if (citizenMap) {
        citizenMap.remove();
        citizenMap = null;
    }
    if (wardChart) {
        wardChart.destroy();
        wardChart = null;
    }
}

// ===== ADMIN DASHBOARD =====
function initAdminDashboard() {
    updateDashboardStats();
    initCityMap();
    renderAlerts();

    // Start real-time simulation
    startSimulation();
}

function updateDashboardStats() {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentCases = cases.filter(c => c.timestamp >= weekAgo);
    const totalBeds = hospitals.reduce((sum, h) => sum + h.totalBeds, 0);
    const availableBeds = hospitals.reduce((sum, h) => sum + h.availableBeds, 0);

    document.getElementById('total-cases').textContent = recentCases.length;
    document.getElementById('active-alerts').textContent = alerts.length;
    document.getElementById('available-beds').textContent = availableBeds;
    document.getElementById('total-wards').textContent = wards.length;
}

function initCityMap() {
    if (cityMap) {
        cityMap.remove();
    }

    cityMap = L.map('city-map').setView(CITY_CENTER, 7);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(cityMap);

    // Add ward polygons
    wards.forEach(ward => {
        const color = getWardColor(ward);

        const polygon = L.polygon(ward.coordinates, {
            color: color,
            fillColor: color,
            fillOpacity: 0.4,
            weight: 2
        }).addTo(cityMap);

        polygon.bindPopup(`
            <strong>${ward.name}</strong><br>
            Population: ${ward.population.toLocaleString()}<br>
            Active Cases: ${ward.totalCases}<br>
            Alerts: ${ward.activeAlerts}
        `);

        polygon.on('click', () => showWardDetails(ward.id));
    });

    // Add hospital markers
    hospitals.forEach(hospital => {
        const icon = L.divIcon({
            className: 'hospital-marker',
            html: '<div style="background: #2196F3; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
            iconSize: [16, 16]
        });

        L.marker(hospital.coordinates, { icon: icon })
            .bindPopup(`
                <strong>${hospital.name}</strong><br>
                Type: ${hospital.type}<br>
                Beds: ${hospital.availableBeds}/${hospital.totalBeds} available
            `)
            .addTo(cityMap);
    });

    if (adminMapLegend) {
        adminMapLegend.remove();
    }
    adminMapLegend = L.control({ position: 'bottomleft' });
    adminMapLegend.onAdd = function () {
        const div = L.DomUtil.create('div', 'info legend');
        div.innerHTML = `
            <div style="background: rgba(0,0,0,0.65); padding: 8px 10px; border-radius: 8px; color: white; font-family: Arial; font-size: 12px;">
                <div style="font-weight: 700; margin-bottom: 6px;">Ward Status</div>
                <div style="display:flex; align-items:center; gap:6px; margin:4px 0;">
                    <span style="display:inline-block;width:14px;height:10px;background:#4CAF50;border-radius:2px;"></span> Safe
                </div>
                <div style="display:flex; align-items:center; gap:6px; margin:4px 0;">
                    <span style="display:inline-block;width:14px;height:10px;background:#FF9800;border-radius:2px;"></span> Warning
                </div>
                <div style="display:flex; align-items:center; gap:6px; margin:4px 0;">
                    <span style="display:inline-block;width:14px;height:10px;background:#F44336;border-radius:2px;"></span> Critical
                </div>
            </div>
        `;
        return div;
    };
    adminMapLegend.addTo(cityMap);
}

function getWardColor(ward) {
    if (ward.activeAlerts === 0) {
        return '#4CAF50'; // Green - Safe
    }

    const criticalAlerts = alerts.filter(a =>
        a.wardId === ward.id && a.severity === 'critical'
    ).length;

    if (criticalAlerts > 0) {
        return '#F44336'; // Red - Critical
    }

    return '#FF9800'; // Orange - Warning
}

function renderAlerts() {
    const alertsList = document.getElementById('alerts-list');

    if (alerts.length === 0) {
        alertsList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No active alerts</p>';
        return;
    }

    alertsList.innerHTML = alerts.map(alert => `
        <div class="alert-item ${alert.severity}">
            <div class="alert-header">
                <div class="alert-title">${alert.wardName} - ${capitalize(alert.diseaseType)}</div>
                <span class="alert-badge ${alert.severity}">${alert.severity}</span>
            </div>
            <div class="alert-message">${alert.message}</div>
            <div class="alert-time">${formatTimeAgo(alert.createdAt)}</div>
        </div>
    `).join('');
}

function showWardDetails(wardId) {
    const ward = wards.find(w => w.id === wardId);
    if (!ward) return;

    const wardHospitals = hospitals.filter(h => h.wardId === wardId);
    const wardAlerts = alerts.filter(a => a.wardId === wardId);

    document.getElementById('ward-modal-title').textContent = ward.name;
    document.getElementById('ward-population').textContent = ward.population.toLocaleString();
    document.getElementById('ward-cases').textContent = ward.totalCases;
    document.getElementById('ward-alerts').textContent = ward.activeAlerts;

    // Render hospitals
    const hospitalsHtml = wardHospitals.map(h => `
        <div class="hospital-item">
            <div class="hospital-name">${h.name}</div>
            <div class="hospital-capacity">
                <span>Type: ${h.type}</span>
                <span>Beds: ${h.availableBeds}/${h.totalBeds}</span>
            </div>
        </div>
    `).join('');
    document.getElementById('ward-hospitals').innerHTML = hospitalsHtml || '<p style="color: var(--text-secondary);">No hospitals in this ward</p>';

    // Render suggested actions
    const actionsHtml = wardAlerts.length > 0
        ? wardAlerts[0].suggestedActions.map(action => `<li>${action}</li>`).join('')
        : '<li>Continue routine monitoring</li>';
    document.getElementById('suggested-actions').innerHTML = actionsHtml;

    // Create trend chart
    createWardChart(wardId);

    document.getElementById('ward-modal').classList.add('active');
}

function closeWardModal() {
    document.getElementById('ward-modal').classList.remove('active');
    if (wardChart) {
        wardChart.destroy();
        wardChart = null;
    }
}

function createWardChart(wardId) {
    const ctx = document.getElementById('ward-chart');
    if (!ctx) return;

    if (wardChart) {
        wardChart.destroy();
    }

    // Get last 30 days of data
    const labels = [];
    const data = [];

    for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const count = cases.filter(c =>
            c.wardId === wardId &&
            c.timestamp >= dayStart &&
            c.timestamp <= dayEnd
        ).length;

        data.push(count);
    }

    wardChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Daily Cases',
                data: data,
                borderColor: 'rgb(33, 150, 243)',
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        color: 'rgba(255, 255, 255, 0.7)'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
}

// ===== HEALTH WORKER SCREEN =====
function initHealthWorkerScreen() {
    const wardSelect = document.getElementById('ward-select');
    wardSelect.innerHTML = '<option value="">Select ward...</option>' +
        wards.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
}

function submitCase(event) {
    event.preventDefault();

    const diseaseType = document.getElementById('disease-type').value;
    const patientAge = parseInt(document.getElementById('patient-age').value);
    const patientGender = document.getElementById('patient-gender').value;
    const severity = document.getElementById('severity').value;
    const wardId = document.getElementById('ward-select').value;
    const notes = document.getElementById('notes').value;

    const newCase = {
        id: `case_${Date.now()}`,
        wardId: wardId,
        diseaseType: diseaseType,
        reportedBy: currentUser.id,
        severity: severity,
        timestamp: new Date(),
        patientAge: patientAge,
        patientGender: patientGender,
        status: 'active',
        notes: notes
    };

    cases.push(newCase);
    updateAlerts();

    // Show success modal
    document.getElementById('case-id').textContent = newCase.id;
    document.getElementById('success-modal').classList.add('active');

    // Reset form
    document.getElementById('case-report-form').reset();
}

function closeSuccessModal() {
    document.getElementById('success-modal').classList.remove('active');
}

// ===== CITIZEN SCREEN =====
function initCitizenScreen() {
    renderCitizenAlerts();
    initCitizenMap();

    // Initialize location toggle button state
    setTimeout(() => {
        updateLocationToggleButton();
        // Optionally request location permission (can be removed if you want it fully manual)
        // requestLocationPermission();
    }, 500); // Small delay to ensure DOM is ready
}

function renderCitizenAlerts() {
    const alertsContainer = document.getElementById('citizen-alerts');

    if (alerts.length === 0) {
        alertsContainer.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No active alerts in your area</p>';
        return;
    }

    // Show top 5 most critical alerts
    const topAlerts = alerts
        .sort((a, b) => b.severity === 'critical' ? 1 : -1)
        .slice(0, 5);

    alertsContainer.innerHTML = topAlerts.map(alert => `
        <div class="citizen-alert-item ${alert.severity}">
            <h3>${capitalize(alert.diseaseType)} Alert - ${alert.wardName}</h3>
            <p>${alert.message}</p>
            <p style="font-size: 0.85rem; color: var(--text-muted);">${formatTimeAgo(alert.createdAt)}</p>
        </div>
    `).join('');
}

function initCitizenMap() {
    if (citizenMap) {
        citizenMap.remove();
    }

    // Check if user location is already available
    const initialCenter = locationManager.currentLocation
        ? [locationManager.currentLocation.lat, locationManager.currentLocation.lng]
        : CITY_CENTER;
    const initialZoom = locationManager.currentLocation ? 12 : 7;

    citizenMap = L.map('citizen-map').setView(initialCenter, initialZoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(citizenMap);

    // Add city polygons with color coding (SAFE/WARNING/CRITICAL)
    wards.forEach(ward => {
        const color = getWardColor(ward);

        // Determine safety status for citizens
        let safetyStatus, statusEmoji;
        if (color === '#4CAF50') {
            safetyStatus = 'SAFE';
            statusEmoji = '✅';
        } else if (color === '#FF9800') {
            safetyStatus = 'WARNING';
            statusEmoji = '⚠️';
        } else {
            safetyStatus = 'CRITICAL';
            statusEmoji = '🚨';
        }

        const polygon = L.polygon(ward.coordinates, {
            color: color,
            fillColor: color,
            fillOpacity: 0.35,
            weight: 2
        }).addTo(citizenMap);

        // Citizen-friendly popup
        polygon.bindPopup(`
            <div style="font-family: Arial, sans-serif;">
                <strong style="font-size: 1.1em;">${statusEmoji} ${ward.name}</strong><br>
                <div style="margin-top: 8px; padding: 8px; background: ${color}22; border-radius: 4px;">
                    <strong>Status: ${safetyStatus}</strong><br>
                    Active Cases: ${ward.totalCases}<br>
                    ${ward.activeAlerts > 0 ? `⚠️ ${ward.activeAlerts} Active Alert(s)` : '✓ No Active Alerts'}
                </div>
                ${safetyStatus === 'CRITICAL' ?
                '<div style="margin-top: 8px; color: #d32f2f; font-weight: bold;">⚠️ Avoid non-essential travel</div>' :
                safetyStatus === 'WARNING' ?
                    '<div style="margin-top: 8px; color: #f57c00;">⚠️ Take precautions</div>' :
                    '<div style="margin-top: 8px; color: #388e3c;">✓ Safe for travel</div>'
            }
            </div>
        `);
    });

    // Add hospital markers
    hospitals.forEach(hospital => {
        const markerColor = hospital.availableBeds > 10 ? '#4CAF50' : '#FF9800';

        const icon = L.divIcon({
            className: 'hospital-marker',
            html: `<div style="background: ${markerColor}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
            iconSize: [22, 22]
        });

        L.marker(hospital.coordinates, { icon: icon })
            .bindPopup(`
                <strong>${hospital.name}</strong><br>
                Type: ${hospital.type}<br>
                Available Beds: ${hospital.availableBeds}/${hospital.totalBeds}<br>
                ${hospital.availableBeds > 10 ?
                    '<span style="color: #4CAF50;">✓ Beds Available</span>' :
                    '<span style="color: #FF9800;">⚠️ Limited Beds</span>'
                }
            `)
            .addTo(citizenMap);
    });

    // Add legend for citizens
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function () {
        const div = L.DomUtil.create('div', 'info legend');
        div.innerHTML = `
            <div style="background: #787272; padding: 10px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); font-family: Arial;">
                <strong style="display: block; margin-bottom: 8px; color: white;">Area Safety Status</strong>
                <div style="margin: 4px 0;">
                    <span style="display: inline-block; width: 20px; height: 12px; background: #4CAF50; border-radius: 2px;"></span>
                    <span style="margin-left: 8px; color: white;">✅ Safe</span>
                </div>
                <div style="margin: 4px 0;">
                    <span style="display: inline-block; width: 20px; height: 12px; background: #FF9800; border-radius: 2px;"></span>
                    <span style="margin-left: 8px; color: white;">⚠️ Warning</span>
                </div>
                <div style="margin: 4px 0;">
                    <span style="display: inline-block; width: 20px; height: 12px; background: #F44336; border-radius: 2px;"></span>
                    <span style="margin-left: 8px; color: white;">🚨 Critical</span>
                </div>
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.3); font-size: 0.85em; color: rgba(255,255,255,0.8);">
                    Click on areas for details
                </div>
            </div>
        `;
        return div;
    };
    legend.addTo(citizenMap);

    renderHospitalsList();
}

function renderHospitalsList() {
    const hospitalsList = document.getElementById('hospitals-list');

    const sortedHospitals = [...hospitals].sort((a, b) => b.availableBeds - a.availableBeds);

    hospitalsList.innerHTML = sortedHospitals.map(h => `
        <div class="hospital-card">
            <h3>${h.name}</h3>
            <span class="hospital-type">${h.type}</span>
            <div class="hospital-info">
                <span>📍 ${wards.find(w => w.id === h.wardId)?.name || 'Unknown'}</span>
                <span>🛏️ ${h.availableBeds}/${h.totalBeds} beds available</span>
            </div>
        </div>
    `).join('');
}

// ===== SIMULATION =====
let simulationInterval = null;

function startSimulation() {
    // Add a new case every 30 seconds
    simulationInterval = setInterval(() => {
        if (currentUser && currentUser.role === 'admin') {
            addRandomCase();
            updateAlerts();
            updateDashboardStats();
            renderAlerts();

            if (cityMap) {
                initCityMap(); // Refresh map colors
            }
        }
    }, 30000);

    // Random bed availability changes
    setInterval(() => {
        hospitals.forEach(h => {
            const change = Math.floor(Math.random() * 5) - 2;
            h.availableBeds = Math.max(0, Math.min(h.totalBeds, h.availableBeds + change));
        });

        if (currentUser && currentUser.role === 'admin') {
            updateDashboardStats();
        }
    }, 15000);
}

function addRandomCase() {
    const diseases = ['dengue', 'malaria', 'typhoid', 'covid', 'tuberculosis', 'cholera'];
    const severities = ['low', 'medium', 'high'];
    const genders = ['male', 'female', 'other'];

    const newCase = {
        id: `case_${Date.now()}`,
        wardId: wards[Math.floor(Math.random() * wards.length)].id,
        diseaseType: diseases[Math.floor(Math.random() * diseases.length)],
        reportedBy: 'simulation',
        severity: severities[Math.floor(Math.random() * severities.length)],
        timestamp: new Date(),
        patientAge: Math.floor(Math.random() * 80) + 1,
        patientGender: genders[Math.floor(Math.random() * genders.length)],
        status: 'active'
    };

    cases.push(newCase);
}

// ===== UTILITY FUNCTIONS =====
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
}

function setupEventListeners() {
    // Close modals on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (simulationInterval) {
        clearInterval(simulationInterval);
    }
    // Stop location tracking
    stopLocationTracking();
});

// ===== LOCATION TRACKING FUNCTIONS =====

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers

    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in km
}

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Format distance for display
 * @param {number} km - Distance in kilometers
 * @returns {string} Formatted distance string
 */
function formatDistance(km) {
    if (km < 1) {
        return `${Math.round(km * 1000)} m`;
    }
    return `${km.toFixed(1)} km`;
}

/**
 * Get nearest hospitals based on user location
 * @param {number} userLat - User latitude
 * @param {number} userLng - User longitude
 * @param {number} limit - Number of hospitals to return
 * @returns {Array} Array of hospitals with distance
 */
function getNearestHospitals(userLat, userLng, limit = 5) {
    // Calculate distance for each hospital
    const hospitalsWithDistance = hospitals.map(hospital => ({
        ...hospital,
        distance: calculateDistance(
            userLat,
            userLng,
            hospital.coordinates[0],
            hospital.coordinates[1]
        )
    }));

    // Sort by distance (nearest first)
    hospitalsWithDistance.sort((a, b) => a.distance - b.distance);

    // Return top N
    return hospitalsWithDistance.slice(0, limit);
}

/**
 * Request location permission and start tracking
 */
function requestLocationPermission() {
    if (!navigator.geolocation) {
        showNotification('Geolocation is not supported by your browser', 'error');
        return;
    }

    // Show permission modal
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'location-permission-modal';
    modal.innerHTML = `
        <div class="modal-content glass-effect" style="max-width: 500px; text-align: center; padding: 2rem;">
            <div style="font-size: 4rem; margin-bottom: 1rem;">📍</div>
            <h2 style="margin-bottom: 1rem;">Enable Location Access</h2>
            <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                Allow location access to find the nearest hospitals and get real-time distance updates.
                Your location is not stored and is only used to help you in emergencies.
            </p>
            <div style="display: flex; gap: 1rem; justify-content: center;">
                <button class="btn-primary" onclick="startLocationTracking()" style="flex: 1;">
                    Enable Location
                </button>
                <button class="btn-secondary" onclick="closeLocationPermissionModal()" style="flex: 1;">
                    Skip
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function closeLocationPermissionModal() {
    const modal = document.getElementById('location-permission-modal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Start continuous location tracking
 */
function startLocationTracking() {
    closeLocationPermissionModal();

    if (!navigator.geolocation) {
        showNotification('Geolocation not supported', 'error');
        return;
    }

    const options = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
    };

    locationManager.watchId = navigator.geolocation.watchPosition(
        (position) => {
            // Update location
            locationManager.currentLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: new Date()
            };
            locationManager.lastUpdate = new Date();
            locationManager.isTracking = true;
            locationManager.permissionGranted = true;

            // Update UI
            updateLocationUI();
            updateHospitalDistances();

            // Show user marker on citizen map if it's open
            if (citizenMap && currentUser?.role === 'citizen') {
                addUserMarkerToCitizenMap(position.coords.latitude, position.coords.longitude);
            }

            showNotification('Location tracking enabled', 'success');
        },
        (error) => {
            handleLocationError(error);
        },
        options
    );
}

/**
 * Stop location tracking
 */
function stopLocationTracking() {
    if (locationManager.watchId) {
        navigator.geolocation.clearWatch(locationManager.watchId);
        locationManager.watchId = null;
        locationManager.isTracking = false;
    }
}

/**
 * Handle location errors
 */
function handleLocationError(error) {
    let message = '';
    switch (error.code) {
        case error.PERMISSION_DENIED:
            message = 'Location permission denied. Please enable location in your browser settings.';
            break;
        case error.POSITION_UNAVAILABLE:
            message = 'Location information unavailable. Please try again.';
            break;
        case error.TIMEOUT:
            message = 'Location request timed out. Please try again.';
            break;
        default:
            message = 'An unknown error occurred while getting your location.';
    }
    showNotification(message, 'error');
    locationManager.isTracking = false;
}

/**
 * Update location status in UI
 */
function updateLocationUI() {
    const statusElement = document.getElementById('location-status');
    if (!statusElement) return;

    if (locationManager.currentLocation) {
        const { accuracy, timestamp } = locationManager.currentLocation;
        const secondsAgo = Math.floor((new Date() - timestamp) / 1000);

        statusElement.innerHTML = `
            <span class="location-indicator active">📍 Location Active</span>
            <span class="location-accuracy">Accuracy: ±${Math.round(accuracy)}m</span>
            <span class="location-time">Updated ${secondsAgo}s ago</span>
        `;
    } else {
        statusElement.innerHTML = `
            <span class="location-indicator inactive">📍 Location Disabled</span>
            <button class="btn-small" onclick="requestLocationPermission()">Enable</button>
        `;
    }
}

/**
 * Update hospital distances in real-time
 */
function updateHospitalDistances() {
    if (!locationManager.currentLocation) return;

    const { lat, lng } = locationManager.currentLocation;
    const nearestHospitals = getNearestHospitals(lat, lng, 5);

    // Update nearest hospitals list
    const container = document.getElementById('nearest-hospitals-list');
    if (!container) return;

    container.innerHTML = nearestHospitals.map((hospital, index) => `
        <div class="hospital-distance-card ${index === 0 ? 'nearest' : ''}" data-hospital-id="${hospital.id}">
            <div class="hospital-rank">${index + 1}</div>
            <div class="hospital-info">
                <h3>${hospital.name}</h3>
                <p class="hospital-ward">📍 ${wards.find(w => w.id === hospital.wardId)?.name || 'Unknown'}</p>
                <p class="hospital-type">${hospital.type}</p>
            </div>
            <div class="hospital-distance-info">
                <div class="distance-badge ${index === 0 ? 'nearest' : ''}">
                    ${formatDistance(hospital.distance)}
                </div>
                <div class="hospital-beds">
                    🛏️ ${hospital.availableBeds}/${hospital.totalBeds} beds
                </div>
                ${index === 0 ? '<span class="nearest-label">NEAREST</span>' : ''}
            </div>
            <div class="hospital-actions">
                <button class="btn-small btn-call" onclick="callHospital('${hospital.id}')">
                    📞 Call
                </button>
                <button class="btn-small btn-directions" onclick="getDirections(${hospital.coordinates[0]}, ${hospital.coordinates[1]})">
                    🧭 Directions
                </button>
            </div>
        </div>
    `).join('');

    // Update map if on citizen screen
    if (citizenMap && currentUser?.role === 'citizen') {
        updateCitizenMapWithLocation(lat, lng, nearestHospitals);
    }
}

/**
 * Update citizen map with user location and nearest hospitals
 */
function updateCitizenMapWithLocation(userLat, userLng, nearestHospitals) {
    // Add user location marker
    const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `<div style="background: #2196F3; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(33, 150, 243, 0.5); position: relative;">
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
        </div>`,
        iconSize: [26, 26]
    });

    // Remove old user marker if exists
    if (window.userLocationMarker) {
        citizenMap.removeLayer(window.userLocationMarker);
    }

    // Add new user marker
    window.userLocationMarker = L.marker([userLat, userLng], { icon: userIcon })
        .bindPopup(`
            <strong>📍 Your Location</strong><br>
            Accuracy: ±${Math.round(locationManager.currentLocation.accuracy)}m
        `)
        .addTo(citizenMap);

    // Draw lines to nearest 3 hospitals
    if (window.hospitalLines) {
        window.hospitalLines.forEach(line => citizenMap.removeLayer(line));
    }
    window.hospitalLines = [];

    nearestHospitals.slice(0, 3).forEach((hospital, index) => {
        const line = L.polyline(
            [[userLat, userLng], hospital.coordinates],
            {
                color: index === 0 ? '#4CAF50' : '#2196F3',
                weight: index === 0 ? 3 : 2,
                opacity: index === 0 ? 0.8 : 0.5,
                dashArray: '5, 10'
            }
        ).addTo(citizenMap);

        window.hospitalLines.push(line);
    });

    // Center map on user location
    citizenMap.setView([userLat, userLng], 12);
}

/**
 * Add user location marker to citizen map
 */
function addUserMarkerToCitizenMap(userLat, userLng) {
    if (!citizenMap) return;

    // Create pulsing blue marker for user location
    const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `
            <div style="position: relative; width: 26px; height: 26px;">
                <div style="
                    background: #2196F3; 
                    width: 20px; 
                    height: 20px; 
                    border-radius: 50%; 
                    border: 3px solid white; 
                    box-shadow: 0 0 15px rgba(33, 150, 243, 0.8); 
                    position: absolute;
                    top: 3px;
                    left: 3px;
                    z-index: 1000;
                ">
                    <div style="
                        position: absolute; 
                        top: 50%; 
                        left: 50%; 
                        transform: translate(-50%, -50%); 
                        width: 8px; 
                        height: 8px; 
                        background: white; 
                        border-radius: 50%;
                    "></div>
                </div>
                <div style="
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 26px;
                    height: 26px;
                    border-radius: 50%;
                    background: rgba(33, 150, 243, 0.3);
                    animation: pulse-ring 2s infinite;
                "></div>
            </div>
            <style>
                @keyframes pulse-ring {
                    0% {
                        transform: scale(1);
                        opacity: 1;
                    }
                    100% {
                        transform: scale(2);
                        opacity: 0;
                    }
                }
            </style>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
    });

    // Remove old marker if exists
    if (window.userLocationMarker) {
        citizenMap.removeLayer(window.userLocationMarker);
    }

    // Add new marker
    window.userLocationMarker = L.marker([userLat, userLng], { icon: userIcon })
        .bindPopup(`
            <div style="padding: 8px; text-align: center;">
                <strong>📍 Your Location</strong><br>
                <small>Lat: ${userLat.toFixed(6)}<br>Lng: ${userLng.toFixed(6)}</small>
                ${locationManager.currentLocation ?
                `<br><small style="color: #4CAF50;">Accuracy: ±${Math.round(locationManager.currentLocation.accuracy)}m</small>`
                : ''}
            </div>
        `)
        .addTo(citizenMap);

    // Center map on user location with smooth animation
    citizenMap.setView([userLat, userLng], 13, {
        animate: true,
        duration: 1
    });

    // Calculate route to nearest hospital
    if (hospitals && hospitals.length > 0) {
        calculateRouteToNearestHospital(userLat, userLng);
    }
}

/**
 * Emergency request with location
 */
function emergencyRequestWithLocation() {
    if (!locationManager.currentLocation) {
        if (confirm('Location not available. Enable location for faster emergency response?')) {
            requestLocationPermission();
        }
        return;
    }

    const { lat, lng } = locationManager.currentLocation;
    const nearestHospitals = getNearestHospitals(lat, lng, 1);
    const nearestHospital = nearestHospitals[0];

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'emergency-modal';
    modal.innerHTML = `
        <div class="modal-content glass-effect" style="max-width: 600px;">
            <div class="modal-header">
                <h2>🚨 Emergency Request</h2>
                <button class="modal-close" onclick="closeEmergencyModal()">×</button>
            </div>
            <div class="modal-body">
                <div class="emergency-info">
                    <h3>Your Location</h3>
                    <p>📍 Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}</p>
                    <p>Accuracy: ±${Math.round(locationManager.currentLocation.accuracy)}m</p>
                </div>
                
                <div class="emergency-info" style="margin-top: 1.5rem;">
                    <h3>Nearest Hospital</h3>
                    <p><strong>${nearestHospital.name}</strong></p>
                    <p>📏 Distance: ${formatDistance(nearestHospital.distance)}</p>
                    <p>🛏️ Available Beds: ${nearestHospital.availableBeds}</p>
                    <p>⏱️ Estimated Time: ${Math.ceil(nearestHospital.distance * 3)} minutes</p>
                </div>
                
                <div class="form-group" style="margin-top: 1.5rem;">
                    <label>Emergency Type</label>
                    <select id="emergency-type">
                        <option value="medical">Medical Emergency</option>
                        <option value="accident">Accident</option>
                        <option value="cardiac">Cardiac Emergency</option>
                        <option value="respiratory">Respiratory Distress</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Brief Description</label>
                    <textarea id="emergency-description" rows="3" placeholder="Describe the emergency..."></textarea>
                </div>
                
                <button class="btn-emergency" onclick="submitEmergencyRequest()" style="width: 100%; margin-top: 1rem;">
                    🚨 Send Emergency Request
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function closeEmergencyModal() {
    const modal = document.getElementById('emergency-modal');
    if (modal) modal.remove();
}

function submitEmergencyRequest() {
    const type = document.getElementById('emergency-type').value;
    const description = document.getElementById('emergency-description').value;

    const { lat, lng } = locationManager.currentLocation;
    const nearestHospital = getNearestHospitals(lat, lng, 1)[0];

    const emergencyRequest = {
        id: `EMR_${Date.now()}`,
        timestamp: new Date(),
        userLocation: { lat, lng },
        nearestHospital: {
            id: nearestHospital.id,
            name: nearestHospital.name,
            distance: nearestHospital.distance
        },
        type: type,
        description: description,
        status: 'pending'
    };

    console.log('Emergency Request:', emergencyRequest);

    closeEmergencyModal();

    showNotification(`Emergency request sent to ${nearestHospital.name}. Help is on the way!`, 'success');

    // In real system, this would call the backend API
    // await fetch('/emergency/request', { method: 'POST', body: JSON.stringify(emergencyRequest) });
}

/**
 * Call hospital
 */
function callHospital(hospitalId) {
    const hospital = hospitals.find(h => h.id === hospitalId);
    if (hospital) {
        // In real app, this would initiate a call
        alert(`Calling ${hospital.name}...\n\nIn a real app, this would dial the hospital's emergency number.`);
    }
}

/**
 * Get directions to hospital
 */
function getDirections(lat, lng) {
    if (locationManager.currentLocation) {
        const { lat: userLat, lng: userLng } = locationManager.currentLocation;
        // Open Google Maps with directions
        const url = `https://www.google.com/maps/dir/${userLat},${userLng}/${lat},${lng}`;
        window.open(url, '_blank');
    } else {
        showNotification('Enable location to get directions', 'error');
    }
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#F44336' : '#2196F3'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

/**
 * Toggle location tracking on/off manually
 */
function toggleLocationTracking() {
    const toggleBtn = document.getElementById('location-toggle-btn');
    const toggleText = document.getElementById('location-toggle-text');
    const statusBadge = document.getElementById('location-status-badge');

    if (locationManager.isTracking) {
        // Stop tracking
        stopLocationTracking();

        // Remove user marker from map if exists
        if (window.userLocationMarker && citizenMap) {
            citizenMap.removeLayer(window.userLocationMarker);
            window.userLocationMarker = null;
        }

        // Remove hospital lines if exists
        if (window.hospitalLines && citizenMap) {
            window.hospitalLines.forEach(line => citizenMap.removeLayer(line));
            window.hospitalLines = [];
        }

        // Update UI
        toggleBtn.classList.remove('active');
        toggleText.textContent = 'Enable Location';
        statusBadge.textContent = '📍 Off';
        statusBadge.className = 'location-status-badge inactive';

        showNotification('Location tracking disabled', 'info');
    } else {
        // Start tracking
        if (!navigator.geolocation) {
            showNotification('Geolocation is not supported by your browser', 'error');
            return;
        }

        // Update UI to loading state
        toggleBtn.classList.add('loading');
        toggleText.textContent = 'Getting Location...';
        statusBadge.textContent = '⏳ Loading...';
        statusBadge.className = 'location-status-badge loading';

        // Start location tracking
        const options = {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        };

        locationManager.watchId = navigator.geolocation.watchPosition(
            (position) => {
                // Update location
                locationManager.currentLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: new Date()
                };
                locationManager.lastUpdate = new Date();
                locationManager.isTracking = true;
                locationManager.permissionGranted = true;

                // Update UI to active state
                toggleBtn.classList.remove('loading');
                toggleBtn.classList.add('active');
                toggleText.textContent = 'Disable Location';
                statusBadge.textContent = '✅ Active';
                statusBadge.className = 'location-status-badge active';

                // Update hospital distances
                updateHospitalDistances();

                // Show user marker on citizen map if it's open
                if (citizenMap && currentUser?.role === 'citizen') {
                    addUserMarkerToCitizenMap(position.coords.latitude, position.coords.longitude);
                }

                showNotification('Location tracking enabled', 'success');
            },
            (error) => {
                // Handle error
                toggleBtn.classList.remove('loading');
                toggleBtn.classList.remove('active');
                toggleText.textContent = 'Enable Location';
                statusBadge.textContent = '⚠️ Error';
                statusBadge.className = 'location-status-badge error';

                handleLocationError(error);
                locationManager.isTracking = false;
            },
            options
        );
    }
}

/**
 * Update location toggle button state
 */
function updateLocationToggleButton() {
    const toggleBtn = document.getElementById('location-toggle-btn');
    const toggleText = document.getElementById('location-toggle-text');
    const statusBadge = document.getElementById('location-status-badge');

    if (!toggleBtn || !toggleText || !statusBadge) return;

    if (locationManager.isTracking) {
        toggleBtn.classList.add('active');
        toggleText.textContent = 'Disable Location';
        statusBadge.textContent = '✅ Active';
        statusBadge.className = 'location-status-badge active';
    } else {
        toggleBtn.classList.remove('active');
        toggleText.textContent = 'Enable Location';
        statusBadge.textContent = '📍 Off';
        statusBadge.className = 'location-status-badge inactive';
    }
}


// 🚨 ADMIN TEST ALERT (Option 3)
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('test-alert-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
        flashScreen();
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

function showRedAlertPopup(wardId, patients) {
    const alertBox = document.getElementById('zoneAlert');

    alertBox.style.display = 'block';
    alertBox.style.background = '#d32f2f';
    alertBox.innerHTML = `
        🚨 <b>RED ALERT</b><br>
        Ward: ${wardId}<br>
        Patients: ${patients}<br>
        Immediate action required!
    `;

    // play sound
    playAlertSound('CRITICAL');

    // auto-hide after 8 sec
    setTimeout(() => {
        alertBox.style.display = 'none';
    }, 8000);
}


let alertedWards = new Set();

async function pollWardZones() {
    try {
        const res = await fetch('http://localhost:8000/realtime/hospital-load');
        const data = await res.json();

        data.forEach(ward => {
            if (ward.zone === 'red' && !alertedWards.has(ward.ward_id)) {
                alertedWards.add(ward.ward_id);
                showRedAlertPopup(ward.ward_id, ward.patients);
            }
        });
    } catch (e) {
        console.error('Zone polling failed', e);
    }
}

function setsEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const item of a) {
        if (!b.has(item)) return false;
    }
    return true;
}
// check every 5 seconds
setInterval(pollWardZones, 5000);

console.log("🔥 app.js loaded");
