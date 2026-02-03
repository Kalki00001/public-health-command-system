# Smart Public Health Command System (SMC) - Quick Start Guide

## 🚀 Getting Started

### Step 1: Open the Application
Simply open `index.html` in your web browser by double-clicking the file.

### Step 2: Select Your Role
You'll see three role options:

#### 🏛️ Admin (SMC)
**Purpose:** City-wide health monitoring and management

**What you can do:**
- View real-time city health map with 10 wards
- Monitor disease case statistics (last 7 days)
- Track hospital bed availability across the city
- Review active health alerts
- Click any ward to see detailed analysis
- View disease trends (30-day charts)
- Get AI-suggested actions for disease control

**Demo Flow:**
1. Click "Admin (SMC)" on login screen
2. See dashboard with 4 key statistics
3. Explore the interactive city map
4. Click on any colored ward polygon
5. View detailed ward information, trends, and hospitals

---

#### 👨‍⚕️ Health Worker
**Purpose:** Report disease cases from the field

**What you can do:**
- Submit new disease case reports
- Record patient information (age, gender, severity)
- Select disease type from 6 monitored diseases
- Add location and additional notes
- Get instant confirmation with case ID

**Demo Flow:**
1. Click "Health Worker" on login screen
2. Fill out the disease reporting form:
   - Disease Type: Dengue, Malaria, Typhoid, COVID, TB, or Cholera
   - Patient Age & Gender
   - Severity: Low, Medium, or High
   - Ward location
   - Additional notes (optional)
3. Click "Submit Report"
4. See success confirmation with Case ID
5. Report another case or logout

---

#### 👥 Citizen
**Purpose:** Stay informed about health alerts and find nearby facilities

**What you can do:**
- View health alerts in your area
- Find nearby hospitals and health centers on map
- Check hospital bed availability
- Access emergency helpline (108)
- Read disease prevention tips

**Demo Flow:**
1. Click "Citizen" on login screen
2. See emergency contact banner at top
3. View any active health alerts in your area
4. Explore nearby health centers on interactive map
5. Check hospital bed availability
6. Read prevention tips for common diseases

---

## 📊 Understanding the System

### Disease Monitoring
The system automatically monitors 6 diseases:
- **Dengue** 🦟
- **Malaria** 🦟
- **Typhoid** 💧
- **COVID-19** 😷
- **Tuberculosis** 🫁
- **Cholera** 💧

### Alert System
Alerts are automatically generated when disease cases exceed thresholds:

**Warning Level (Yellow):**
- Dengue: 10+ cases per 100k population/week
- Malaria: 8+ cases per 100k population/week
- Typhoid: 5+ cases per 100k population/week
- COVID: 15+ cases per 100k population/week
- TB: 3+ cases per 100k population/week
- Cholera: 5+ cases per 100k population/week

**Critical Level (Red):**
- Dengue: 25+ cases per 100k population/week
- Malaria: 20+ cases per 100k population/week
- Typhoid: 15+ cases per 100k population/week
- COVID: 40+ cases per 100k population/week
- TB: 10+ cases per 100k population/week
- Cholera: 12+ cases per 100k population/week

### Real-Time Simulation
The admin dashboard includes live simulation:
- New cases auto-generated every 30 seconds
- Hospital bed availability updates every 15 seconds
- Alerts automatically created when thresholds exceeded
- Dashboard refreshes in real-time

---

## 🎯 Demo Scenarios

### Scenario 1: Disease Outbreak Response
1. **Login as Health Worker**
2. Submit 5-6 dengue cases in "Andheri East" ward
3. **Logout and login as Admin**
4. Watch as a new alert appears for Andheri East
5. Click on the ward to see detailed trends
6. Review suggested actions for dengue control

### Scenario 2: Citizen Health Awareness
1. **Login as Citizen**
2. View any active alerts in your area
3. Click on hospital markers on the map
4. Check which hospitals have available beds
5. Read prevention tips
6. Note the emergency helpline number

### Scenario 3: Hospital Capacity Monitoring
1. **Login as Admin**
2. Check "Available Beds" statistic
3. View the city map
4. Click on different wards
5. Compare hospital capacities across wards
6. Identify areas with bed shortages

---

## 🎨 Features Highlights

### Interactive Maps
- **Leaflet.js** powered maps
- Color-coded wards (Green=Safe, Yellow=Warning, Red=Critical)
- Hospital markers with bed availability
- Click for detailed popups

### Real-Time Charts
- **Chart.js** powered visualizations
- 30-day disease trend analysis
- Smooth animations
- Responsive design

### Modern UI/UX
- **Glassmorphism** design
- Vibrant gradient colors
- Smooth micro-animations
- Dark theme (eye-friendly)
- Mobile responsive

---

## 🏥 City Structure

The demo includes:
- **10 Wards:** Andheri East, Bandra West, Borivali, Dadar, Goregaon, Kurla, Malad, Powai, Santacruz, Vikhroli
- **10 Hospitals:** Mix of PHCs, CHCs, and District Hospitals
- **60+ Disease Cases:** Distributed over last 30 days
- **Real Population Data:** Each ward has realistic population figures

---

## 💡 Tips for Best Experience

1. **Use Chrome/Edge** for best performance
2. **Maximize your browser** to see full dashboard
3. **Try all three roles** to understand the complete system
4. **Submit cases as Health Worker** then check Admin dashboard
5. **Click on ward polygons** in the map for detailed views
6. **Watch the real-time simulation** in admin mode

---

## 🔧 Troubleshooting

**Map not loading?**
- Check your internet connection (maps use OpenStreetMap tiles)
- Refresh the page

**Charts not showing?**
- Ensure JavaScript is enabled
- Try a different browser

**Simulation not running?**
- Make sure you're logged in as Admin
- Wait 30 seconds for first auto-generated case

---

## 📱 Mobile Access

The application is fully responsive! Access from:
- Desktop computers
- Tablets
- Smartphones

All features work on mobile devices.

---

## 🎓 Educational Use

This prototype demonstrates:
- Public health surveillance systems
- Disease outbreak monitoring
- Geographic information systems (GIS)
- Real-time data visualization
- Multi-role user interfaces
- Alert threshold systems

Perfect for:
- Health informatics courses
- Public health training
- Smart city demonstrations
- Government health department presentations

---

## 🔐 Privacy Note

This is a **prototype with simulated data only**. No real patient information is collected, stored, or transmitted.

---

## 📞 Emergency Contacts (India)

- **Health Helpline:** 108
- **Ambulance:** 102
- **COVID Helpline:** 1075
- **Women Helpline:** 1091
- **Child Helpline:** 1098

---

**Ready to explore? Open `index.html` and start your journey!** 🚀
