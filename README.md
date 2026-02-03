# Smart Public Health Command System (SMC)

A real-time city health monitoring and disease alert system for public health management.

## 🎯 Features

### Admin Dashboard
- **City Health Map**: Interactive ward visualization with color-coded health status
- **Real-time Statistics**: Total cases, active alerts, bed availability
- **Alert Management**: Automatic disease outbreak detection based on thresholds
- **Ward Details**: Detailed view with trends, hospitals, and suggested actions

### Health Worker Portal
- **Quick Case Reporting**: Simple form to report disease cases
- **Instant Submission**: Cases are immediately recorded and analyzed
- **Alert Generation**: Automatic alert creation when thresholds are exceeded

### Citizen Portal
- **Area-based Alerts**: View health alerts in your vicinity
- **Nearby Health Centers**: Interactive map showing hospitals and PHCs
- **Emergency Contact**: Quick access to health helpline (108)
- **Prevention Tips**: Health and hygiene guidance

## 🚀 Quick Start

### Option 1: Direct File Opening
1. Simply open `index.html` in your web browser
2. No installation or build process required!

### Option 2: Local Server (Recommended)
```bash
# Using Python 3
python -m http.server 8000

# Using Python 2
python -m SimpleHTTPServer 8000

# Using Node.js
npx http-server -p 8000
```

Then open: `http://localhost:8000`

## 👥 User Roles

### 1. Admin (SMC)
- Monitor city-wide health metrics
- View ward-specific disease trends
- Access hospital capacity information
- Review and act on alerts

### 2. Health Worker
- Report new disease cases
- Submit patient information
- Contribute to disease surveillance

### 3. Citizen
- View health alerts in your area
- Find nearby health facilities
- Access emergency contacts
- Learn prevention measures

## 📊 Disease Monitoring

The system monitors these diseases with automatic alert thresholds:

| Disease | Warning (per 100k) | Critical (per 100k) |
|---------|-------------------|---------------------|
| Dengue | 10 cases/week | 25 cases/week |
| Malaria | 8 cases/week | 20 cases/week |
| Typhoid | 5 cases/week | 15 cases/week |
| COVID-19 | 15 cases/week | 40 cases/week |
| Tuberculosis | 3 cases/week | 10 cases/week |
| Cholera | 5 cases/week | 12 cases/week |

## 🎨 Technology Stack

- **Frontend**: Pure HTML5, CSS3, JavaScript (ES6+)
- **Maps**: Leaflet.js
- **Charts**: Chart.js
- **Design**: Glassmorphism with vibrant gradients
- **Data**: Simulated real-time data

## 🏗️ Project Structure

```
mit/
├── index.html          # Main application file
├── styles.css          # Premium styling with animations
├── app.js              # Application logic and data
└── README.md           # This file
```

## 🎭 Demo Flow

1. **Login Screen**: Select your role (Admin/Health Worker/Citizen)
2. **Admin View**: 
   - See city map with 10 wards
   - View active alerts panel
   - Click any ward for detailed analysis
3. **Health Worker**: 
   - Fill disease report form
   - Submit case
   - See confirmation
4. **Citizen**: 
   - View nearby alerts
   - Find health centers
   - Access emergency services

## 📈 Real-time Simulation

- New cases are auto-generated every 30 seconds
- Hospital bed availability updates every 15 seconds
- Alerts are automatically created/updated based on thresholds
- Dashboard refreshes in real-time

## 🎨 Design Highlights

- **Glassmorphism**: Modern frosted glass effect
- **Vibrant Colors**: Health-focused color palette
- **Smooth Animations**: Micro-interactions throughout
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Dark Theme**: Eye-friendly dark mode by default

## 🔒 Data Privacy

This is a prototype with simulated data. No real patient information is collected or stored.

## 📱 Browser Compatibility

- Chrome/Edge (Recommended)
- Firefox
- Safari
- Opera

## 🛠️ Customization

### Adding New Wards
Edit the `wards` array in `app.js`:
```javascript
wards.push({
    id: 'w11',
    name: 'New Ward',
    population: 100000,
    coordinates: [[lat, lng], ...],
    activeAlerts: 0,
    totalCases: 0
});
```

### Adjusting Thresholds
Modify `DISEASE_THRESHOLDS` in `app.js`:
```javascript
const DISEASE_THRESHOLDS = {
    dengue: { warning: 10, critical: 25 },
    // Add or modify diseases here
};
```

## 📞 Emergency Contacts

- **Health Helpline**: 108 (India)
- **Ambulance**: 102
- **COVID Helpline**: 1075

## 🎯 Future Enhancements

- [ ] Backend API integration
- [ ] Real database (Firebase/PostgreSQL)
- [ ] User authentication
- [ ] SMS/Email notifications
- [ ] Mobile app (React Native)
- [ ] Multi-language support
- [ ] Export reports (PDF/Excel)
- [ ] Predictive analytics with ML

## 📄 License

This is a prototype for educational and demonstration purposes.

## 👨‍💻 Development

Built following modern web development best practices:
- Semantic HTML5
- CSS Grid & Flexbox
- ES6+ JavaScript
- Mobile-first responsive design
- Accessibility (ARIA labels)
- SEO optimized

---

**Built with ❤️ for public health**
