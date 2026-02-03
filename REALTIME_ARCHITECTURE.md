# Smart Public Health Management System - Real-Time Architecture

## System Overview

A real-time, event-driven public health monitoring system with streaming data ingestion, ML-powered outbreak detection, and live dashboard updates.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Health Worker│  │   Hospitals  │  │   Citizens   │              │
│  │   Reports    │  │   Resources  │  │   Feedback   │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
└─────────┼──────────────────┼──────────────────┼──────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   REAL-TIME INGESTION LAYER                          │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Event Queue (Redis Streams / RabbitMQ)                    │    │
│  │  - case_events                                             │    │
│  │  - resource_events                                         │    │
│  │  - alert_events                                            │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────┬───────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  STREAM PROCESSING LAYER                             │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  Real-Time Aggregator (Python)                           │      │
│  │  - Rolling window aggregations (1h, 6h, 24h)            │      │
│  │  - Case velocity calculation                            │      │
│  │  - Growth rate computation                              │      │
│  │  - Trigger ML inference on threshold                    │      │
│  └──────────────────────────────────────────────────────────┘      │
└─────────┬───────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ML INFERENCE SERVICE                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Outbreak   │  │   Anomaly    │  │   Resource   │             │
│  │  Prediction  │  │  Detection   │  │  Forecasting │             │
│  │  (Streaming) │  │  (Real-time) │  │  (ARIMA)     │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
└─────────┼──────────────────┼──────────────────┼──────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   DECISION ENGINE                                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Rule-Based Action Generator                               │    │
│  │  - Risk scoring (0-100)                                    │    │
│  │  - Ward classification (GREEN/YELLOW/RED)                  │    │
│  │  - Action recommendations with urgency                     │    │
│  │  - Alert generation and routing                            │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────┬───────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    DATA PERSISTENCE                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  TimescaleDB │  │     Redis    │  │  PostgreSQL  │             │
│  │ (Time-series)│  │    (Cache)   │  │  (Metadata)  │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└─────────┬───────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    API LAYER (FastAPI)                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  REST APIs   │  │  WebSocket   │  │  SSE Stream  │             │
│  │  (CRUD)      │  │  (Live Data) │  │  (Alerts)    │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└─────────┬───────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │    Admin     │  │    Health    │  │   Citizen    │             │
│  │  Dashboard   │  │    Worker    │  │   Portal     │             │
│  │ (WebSocket)  │  │   (PWA)      │  │  (Mobile)    │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Backend
- **API Framework**: FastAPI (Python) - async, WebSocket support
- **Message Queue**: Redis Streams - lightweight, fast
- **Database**: 
  - TimescaleDB (time-series data)
  - PostgreSQL (metadata, users)
  - Redis (cache, real-time state)
- **ML Framework**: scikit-learn, river (online learning)
- **WebSocket**: FastAPI WebSocket + Socket.IO

### Frontend
- **Framework**: React (for complex state management)
- **Real-time**: Socket.IO client
- **Maps**: Leaflet.js
- **Charts**: Chart.js with real-time plugin
- **State**: Redux + WebSocket middleware

### DevOps
- **Containerization**: Docker + Docker Compose
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)

---

## Data Flow

### 1. Case Reporting Flow
```
Health Worker → POST /events/case → Redis Stream → Stream Processor
→ ML Inference → Decision Engine → WebSocket Broadcast → Admin Dashboard
```

### 2. Real-time Alert Flow
```
ML Model → Anomaly Detected → Alert Generator → Redis Pub/Sub
→ WebSocket → Admin + Citizen Apps → Push Notification
```

### 3. Resource Monitoring Flow
```
Hospital System → POST /events/resource → Redis Stream → Aggregator
→ Forecast Model → Shortage Prediction → Alert if Critical
```

---

## ML Models Architecture

### 1. Streaming Outbreak Predictor
**Algorithm**: River (Online Random Forest)
**Why**: Learns incrementally from streaming data, no retraining needed

**Input Features** (computed in real-time):
- Cases in last 1h, 6h, 24h
- Case velocity (cases/hour)
- Growth rate (% change)
- Population density
- Historical outbreak flag
- Season/month
- Day of week

**Output**:
- Outbreak probability (0-1)
- Confidence score
- Top 3 contributing features

**Update Frequency**: Every new case event

---

### 2. Anomaly Detection
**Algorithm**: EWMA (Exponentially Weighted Moving Average) + Z-score
**Why**: Fast, explainable, works with limited data

**Logic**:
```python
ewma = alpha * current_value + (1 - alpha) * previous_ewma
z_score = (current_value - ewma) / std_dev
if z_score > 3: ANOMALY
```

**Output**:
- Anomaly flag (True/False)
- Z-score
- Expected vs Actual values

---

### 3. Resource Stress Forecaster
**Algorithm**: ARIMA (AutoRegressive Integrated Moving Average)
**Why**: Standard for time-series, interpretable

**Forecast Horizon**: 24-72 hours
**Output**:
- Predicted bed occupancy (%)
- Predicted medicine stock levels
- Shortage probability

---

### 4. Dynamic Risk Scoring
**Algorithm**: Weighted composite scoring
**Formula**:
```
Risk Score = 
  0.4 × ML_Outbreak_Prob +
  0.3 × Anomaly_Score +
  0.2 × Case_Growth_Rate +
  0.1 × Resource_Stress
```

**Classification**:
- 0-30: GREEN (Safe)
- 31-60: YELLOW (Monitor)
- 61-100: RED (Urgent)

---

## API Endpoints

### Event Ingestion
```
POST /events/case
POST /events/resource
POST /events/alert
```

### Real-time Data
```
GET /realtime/ward-risk (WebSocket)
GET /realtime/alerts (Server-Sent Events)
GET /realtime/dashboard-stats (WebSocket)
```

### ML Inference
```
POST /ml/predict-outbreak
POST /ml/detect-anomaly
POST /ml/forecast-resources
GET /ml/model-status
```

### Data Access
```
GET /wards
GET /wards/{id}
GET /cases?ward_id=&start_date=&end_date=
GET /alerts?status=active
GET /hospitals
```

### Citizen APIs
```
GET /citizen/alerts?lat=&lng=&radius=
GET /citizen/nearby-hospitals?lat=&lng=
GET /citizen/prevention-tips?disease=
```

---

## Real-Time Features

### 1. WebSocket Channels
- `/ws/admin` - Admin dashboard updates
- `/ws/ward/{id}` - Ward-specific updates
- `/ws/alerts` - Alert notifications

### 2. Server-Sent Events
- `/sse/alerts` - One-way alert stream
- `/sse/stats` - Dashboard statistics

### 3. Redis Pub/Sub Topics
- `ward_risk_updates`
- `new_alerts`
- `resource_critical`

---

## Explainability Features

### For ML Predictions
```json
{
  "prediction": {
    "outbreak_probability": 0.78,
    "risk_category": "HIGH",
    "confidence": "medium",
    "explanation": {
      "top_factors": [
        {"feature": "case_velocity", "impact": 0.35, "value": 12.5},
        {"feature": "growth_rate", "impact": 0.28, "value": 65.2},
        {"feature": "population_density", "impact": 0.15, "value": 18500}
      ],
      "human_readable": "High risk due to rapid case growth (65% increase) and sustained case velocity (12.5 cases/hour)"
    }
  }
}
```

### For Alerts
```json
{
  "alert": {
    "severity": "CRITICAL",
    "reason": "Dengue cases exceeded threshold by 180%",
    "evidence": {
      "current_cases": 42,
      "threshold": 15,
      "growth_rate": 85.3
    },
    "recommended_actions": [
      {"action": "Deploy emergency team", "urgency": "immediate"},
      {"action": "Arrange temporary beds", "urgency": "within_6h"}
    ]
  }
}
```

---

## Performance Requirements

- **Event Processing Latency**: < 100ms
- **ML Inference Time**: < 50ms
- **WebSocket Update Delay**: < 200ms
- **Dashboard Refresh Rate**: 1-5 seconds
- **Concurrent Users**: 100+
- **Events/Second**: 1000+

---

## Security Considerations

1. **Authentication**: JWT tokens
2. **Authorization**: Role-based (Admin, Worker, Citizen)
3. **Rate Limiting**: 100 req/min per user
4. **Data Encryption**: TLS 1.3
5. **Input Validation**: Pydantic models
6. **SQL Injection Prevention**: Parameterized queries

---

## Monitoring & Observability

### Metrics to Track
- Event processing rate
- ML inference latency
- WebSocket connection count
- Alert generation rate
- Database query performance

### Dashboards
- System health (Grafana)
- ML model performance
- API endpoint metrics
- User activity

---

## Demo Flow (3-4 minutes)

### Minute 1: System Overview
- Show live city map with color-coded wards
- Demonstrate real-time statistics updating
- Explain data sources

### Minute 2: Real-time Event Simulation
- Health worker submits dengue case
- Watch dashboard update instantly
- ML model recalculates risk
- Ward color changes from GREEN → YELLOW
- Alert generated and displayed

### Minute 3: ML Explainability
- Click on high-risk ward
- Show ML prediction with explanation
- Display top risk factors
- Show recommended actions

### Minute 4: Citizen Experience
- Switch to citizen view
- Show area-based alerts
- Demonstrate nearby hospital finder
- Show prevention tips

---

## Deployment Architecture

```
Docker Compose Stack:
├── nginx (reverse proxy)
├── fastapi-app (API server) × 3 replicas
├── redis (message queue + cache)
├── timescaledb (time-series data)
├── postgres (metadata)
├── ml-inference-service (separate container)
└── frontend (React app)
```

---

## Scalability Strategy

### Horizontal Scaling
- Multiple API server instances
- Load balancer (Nginx)
- Redis cluster for high availability

### Vertical Scaling
- Increase ML inference workers
- Database connection pooling
- Caching layer optimization

---

## Future Enhancements

1. **Mobile Apps**: React Native for iOS/Android
2. **SMS Alerts**: Twilio integration
3. **Voice Alerts**: IVR system for low-literacy users
4. **Satellite Data**: Weather correlation
5. **Social Media**: Twitter/WhatsApp monitoring
6. **Predictive Analytics**: 7-day outbreak forecasting

---

## Cost Estimate (Monthly)

- **Cloud Hosting**: $50-100 (AWS/GCP)
- **Database**: $30-50 (managed PostgreSQL)
- **Redis**: $20-30 (managed)
- **Monitoring**: $20 (Grafana Cloud)
- **Total**: ~$120-200/month

---

## Success Metrics

1. **Response Time**: Alerts within 5 minutes of threshold breach
2. **Accuracy**: 85%+ outbreak prediction accuracy
3. **Uptime**: 99.5%+
4. **User Adoption**: 80%+ health workers using system
5. **False Positive Rate**: < 15%

---

*This architecture balances real-time performance, ML accuracy, and operational simplicity for municipal deployment.*
