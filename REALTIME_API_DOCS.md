# Smart Public Health Management System - Real-Time API Documentation

## Base URL
```
Production: https://api.smc.health.gov
Development: http://localhost:8000
WebSocket: ws://localhost:8000
```

---

## Authentication
All endpoints require JWT authentication (except public citizen endpoints).

```http
Authorization: Bearer <jwt_token>
```

---

## Event Ingestion APIs

### 1. Ingest Case Event
Submit a new disease case report.

**Endpoint:** `POST /events/case`

**Request Body:**
```json
{
  "ward_id": "w001",
  "disease_type": "dengue",
  "patient_age": 35,
  "patient_gender": "male",
  "severity": "medium",
  "reported_by": "worker_123",
  "notes": "Patient reported high fever and body ache"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "case_id": "case_1737486000.123",
  "ward_risk": {
    "ward_id": "w001",
    "ward_name": "Andheri East",
    "risk_score": 65.5,
    "risk_level": "YELLOW",
    "outbreak_probability": 0.68,
    "anomaly_detected": false,
    "case_count_1h": 3,
    "case_count_24h": 28,
    "case_velocity": 3.0,
    "growth_rate": 45.2,
    "top_disease": "dengue",
    "recommended_actions": [
      "Enhanced surveillance required",
      "Increase testing capacity"
    ],
    "timestamp": "2026-01-21T21:30:00"
  },
  "message": "Case event ingested successfully"
}
```

**Real-time Effects:**
- Triggers ML inference
- Updates ward risk score
- Broadcasts to WebSocket clients
- May generate alert if threshold exceeded

---

### 2. Ingest Resource Event
Update hospital resource availability.

**Endpoint:** `POST /events/resource`

**Request Body:**
```json
{
  "hospital_id": "h001",
  "ward_id": "w001",
  "resource_type": "beds",
  "total_capacity": 250,
  "available": 45
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "resource_id": "h001_beds",
  "utilization": 82.0,
  "stress_level": "HIGH"
}
```

---

## Real-Time Data APIs

### 3. Get Ward Risk Score
Get current real-time risk score for a ward.

**Endpoint:** `GET /realtime/ward-risk/{ward_id}`

**Response:** `200 OK`
```json
{
  "ward_id": "w001",
  "ward_name": "Andheri East",
  "risk_score": 65.5,
  "risk_level": "YELLOW",
  "outbreak_probability": 0.68,
  "anomaly_detected": false,
  "case_count_1h": 3,
  "case_count_24h": 28,
  "case_velocity": 3.0,
  "growth_rate": 45.2,
  "top_disease": "dengue",
  "recommended_actions": [
    "Enhanced surveillance required",
    "Increase testing capacity",
    "Prepare additional resources"
  ],
  "timestamp": "2026-01-21T21:30:00"
}
```

---

### 4. Get Dashboard Statistics
Get real-time dashboard summary.

**Endpoint:** `GET /realtime/dashboard-stats`

**Response:** `200 OK`
```json
{
  "total_cases_24h": 156,
  "active_alerts": 3,
  "wards_monitored": 10,
  "high_risk_wards": 2,
  "timestamp": "2026-01-21T21:30:00"
}
```

---

## WebSocket APIs

### 5. Admin Dashboard WebSocket
Real-time updates for admin dashboard.

**Endpoint:** `WS /ws/admin`

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/admin');

ws.onopen = () => {
  console.log('Connected to admin stream');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

**Message Types:**

**Initial State:**
```json
{
  "type": "initial_state",
  "total_cases": 156,
  "active_alerts": 3,
  "timestamp": "2026-01-21T21:30:00"
}
```

**Case Added:**
```json
{
  "type": "case_added",
  "case": {
    "ward_id": "w001",
    "disease_type": "dengue",
    "severity": "medium"
  },
  "ward_risk": {
    "ward_id": "w001",
    "risk_score": 65.5,
    "risk_level": "YELLOW"
  }
}
```

**New Alert:**
```json
{
  "type": "new_alert",
  "alert": {
    "id": "alert_1737486000.456",
    "ward_id": "w001",
    "ward_name": "Andheri East",
    "severity": "CRITICAL",
    "disease_type": "dengue",
    "message": "High outbreak risk detected",
    "outbreak_probability": 0.78,
    "recommended_actions": [...]
  }
}
```

**Resource Updated:**
```json
{
  "type": "resource_updated",
  "resource": {
    "hospital_id": "h001",
    "resource_type": "beds",
    "available": 45
  },
  "utilization": 82.0,
  "stress_level": "HIGH"
}
```

---

### 6. Ward-Specific WebSocket
Real-time updates for a specific ward.

**Endpoint:** `WS /ws/ward/{ward_id}`

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/ward/w001');
```

**Messages:**
- Initial ward risk score
- Updates every 5 seconds
- Immediate updates on new cases

---

## Alert APIs

### 7. Get Alerts
Retrieve alerts with filtering.

**Endpoint:** `GET /alerts?status=active&limit=50`

**Query Parameters:**
- `status` (optional): Filter by status (`active`, `resolved`)
- `limit` (optional): Max results (default: 50)

**Response:** `200 OK`
```json
[
  {
    "id": "alert_1737486000.456",
    "ward_id": "w001",
    "ward_name": "Andheri East",
    "severity": "CRITICAL",
    "disease_type": "dengue",
    "message": "High outbreak risk detected in Andheri East",
    "outbreak_probability": 0.78,
    "case_count": 42,
    "threshold": 15,
    "recommended_actions": [
      {
        "action": "Deploy emergency team",
        "urgency": "immediate"
      },
      {
        "action": "Arrange temporary beds",
        "urgency": "within_6h"
      }
    ],
    "created_at": "2026-01-21T21:00:00",
    "status": "active"
  }
]
```

---

### 8. Alert Stream (Server-Sent Events)
Real-time alert stream using SSE.

**Endpoint:** `GET /sse/alerts`

**Connection:**
```javascript
const eventSource = new EventSource('http://localhost:8000/sse/alerts');

eventSource.onmessage = (event) => {
  const alert = JSON.parse(event.data);
  console.log('New alert:', alert);
};
```

**Stream Format:**
```
data: {"id":"alert_123","ward_name":"Andheri East",...}

data: {"id":"alert_124","ward_name":"Kurla",...}
```

---

## Citizen APIs

### 9. Get Citizen Alerts
Get alerts relevant to citizens in an area.

**Endpoint:** `GET /citizen/alerts?ward_id=w001`

**Query Parameters:**
- `ward_id` (optional): Filter by ward

**Response:** `200 OK`
```json
[
  {
    "disease": "dengue",
    "area": "Andheri East",
    "severity": "CRITICAL",
    "message": "High outbreak risk detected in Andheri East",
    "prevention_tips": [
      "Eliminate standing water around your home",
      "Use mosquito repellent",
      "Wear long-sleeved clothing",
      "Use mosquito nets while sleeping"
    ]
  }
]
```

---

### 10. Get Prevention Tips
Get disease-specific prevention guidance.

**Endpoint:** `GET /citizen/prevention-tips?disease=dengue`

**Response:** `200 OK`
```json
{
  "disease": "dengue",
  "tips": [
    "Eliminate standing water around your home",
    "Use mosquito repellent",
    "Wear long-sleeved clothing",
    "Use mosquito nets while sleeping"
  ]
}
```

---

## ML Inference APIs

### 11. Predict Outbreak (Integrated)
Outbreak prediction is automatically triggered on case ingestion.
Results are included in the `/events/case` response.

**Manual Prediction:**
```http
POST /ml/predict-outbreak
```

**Request Body:**
```json
{
  "ward_data": {
    "case_count_1h": 8,
    "case_count_6h": 35,
    "case_count_24h": 120,
    "case_velocity": 8.5,
    "growth_rate": 65.2,
    "population_density": 15000,
    "top_disease": "dengue",
    "previous_outbreak": 1
  }
}
```

**Response:**
```json
{
  "outbreak_probability": 0.782,
  "confidence": "high",
  "risk_category": "HIGH",
  "top_features": [
    {
      "feature": "case_velocity",
      "value": 8.5,
      "impact": "high"
    },
    {
      "feature": "growth_rate",
      "value": 65.2,
      "impact": "high"
    }
  ],
  "explanation": "HIGH RISK: Immediate action recommended | High case velocity (8.5 cases/hour) | Rapid growth rate (65.2%)",
  "model_accuracy": 0.853
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "detail": "Invalid request: missing required field 'ward_id'"
}
```

### 404 Not Found
```json
{
  "detail": "Ward not found: w999"
}
```

### 500 Internal Server Error
```json
{
  "detail": "Internal server error occurred"
}
```

---

## Rate Limiting

- **Default**: 100 requests/minute per user
- **WebSocket**: 1 connection per channel per user
- **SSE**: 1 connection per user

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1737486060
```

---

## Webhooks (Optional)

Configure webhooks to receive alerts at your endpoint.

**Webhook Payload:**
```json
{
  "event": "alert.created",
  "timestamp": "2026-01-21T21:30:00",
  "data": {
    "alert_id": "alert_123",
    "ward_id": "w001",
    "severity": "CRITICAL"
  }
}
```

---

## Testing

### Health Check
```bash
curl http://localhost:8000/health
```

### Submit Test Case
```bash
curl -X POST http://localhost:8000/events/case \
  -H "Content-Type: application/json" \
  -d '{
    "ward_id": "w001",
    "disease_type": "dengue",
    "patient_age": 35,
    "patient_gender": "male",
    "severity": "medium",
    "reported_by": "test_worker"
  }'
```

### WebSocket Test (JavaScript)
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/admin');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

---

## Performance

- **Event Processing**: < 100ms
- **ML Inference**: < 50ms
- **WebSocket Latency**: < 200ms
- **Dashboard Refresh**: 1-5 seconds

---

## Support

- **API Docs**: http://localhost:8000/docs (Swagger UI)
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI Spec**: http://localhost:8000/openapi.json

---

*Real-Time Smart Public Health Management System API v2.0*
