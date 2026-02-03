# Smart Public Health Command System - ML Integration Guide

## Overview

This document explains how to integrate the ML prediction models into the existing Smart Public Health Command System.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React/HTML)                    │
│                  City Health Dashboard                       │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP Requests
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    ML API Layer (Flask)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Outbreak   │  │     Ward     │  │   Resource   │      │
│  │  Prediction  │  │ Classification│  │  Forecasting │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   ML Models (Python)                         │
│  • Random Forest (Outbreak)                                  │
│  • Rule-Based (Ward Classification)                          │
│  • Time-Series (Resource Forecasting)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### 1. Outbreak Prediction

**Endpoint:** `POST /ml/predict-outbreak`

**Request:**
```json
{
  "ward_id": "W001",
  "population_density": 15000,
  "daily_cases": [5, 6, 7, 8, 10, 12, 15, 18, 20, 22, 25, 28, 30, 32],
  "disease_type": "dengue",
  "month": 7,
  "previous_outbreak": 1
}
```

**Response:**
```json
{
  "success": true,
  "ward_id": "W001",
  "prediction": {
    "risk_score": 0.78,
    "risk_category": "HIGH",
    "explanation": "HIGH RISK: Immediate action recommended | Cases increasing rapidly (>50% growth) | Cases rising for 5 consecutive days | Ward has history of previous outbreaks",
    "top_risk_factors": [
      {
        "factor": "case_growth_rate",
        "value": 65.5,
        "importance": 0.25
      },
      {
        "factor": "consecutive_increase_days",
        "value": 5,
        "importance": 0.18
      },
      {
        "factor": "previous_outbreak",
        "value": 1,
        "importance": 0.15
      }
    ]
  },
  "timestamp": "2026-01-21T19:56:00"
}
```

**Frontend Integration:**
```javascript
async function predictOutbreak(wardData) {
    const response = await fetch('http://localhost:5000/ml/predict-outbreak', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(wardData)
    });
    
    const result = await response.json();
    
    if (result.success) {
        displayOutbreakPrediction(result.prediction);
    }
}
```

---

### 2. Ward Classification

**Endpoint:** `POST /ml/classify-ward`

**Request:**
```json
{
  "ward_name": "Andheri East",
  "active_cases": 28,
  "case_growth_rate": 65.0,
  "num_alerts": 2,
  "bed_availability_pct": 15.0
}
```

**Response:**
```json
{
  "success": true,
  "classification": {
    "ward_name": "Andheri East",
    "status": "RED",
    "priority": 3,
    "composite_score": 85.5,
    "risk_breakdown": {
      "case_risk": 100,
      "growth_risk": 100,
      "alert_risk": 100,
      "bed_risk": 100
    },
    "reasons": [
      "High case count: 28 active cases",
      "Rapid case growth: 65.0% increase",
      "2 active health alerts",
      "Critical bed shortage: 15.0% available"
    ],
    "recommendations": [
      "🚨 URGENT: Deploy emergency response team",
      "Activate additional healthcare workers",
      "Implement containment measures immediately",
      "Arrange temporary hospital beds/facilities",
      "Coordinate multi-disease response strategy"
    ],
    "timestamp": "2026-01-21T19:56:00"
  }
}
```

**Frontend Integration:**
```javascript
async function classifyWard(wardData) {
    const response = await fetch('http://localhost:5000/ml/classify-ward', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(wardData)
    });
    
    const result = await response.json();
    
    if (result.success) {
        updateWardStatus(result.classification);
    }
}
```

---

### 3. Batch Ward Classification

**Endpoint:** `POST /ml/classify-wards-batch`

**Request:**
```json
{
  "wards": [
    {
      "ward_name": "Andheri East",
      "active_cases": 28,
      "case_growth_rate": 65.0,
      "num_alerts": 2,
      "bed_availability_pct": 15.0
    },
    {
      "ward_name": "Bandra West",
      "active_cases": 8,
      "case_growth_rate": 15.0,
      "num_alerts": 0,
      "bed_availability_pct": 55.0
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "classifications": [
    {
      "ward_name": "Andheri East",
      "status": "RED",
      "priority": 3,
      "composite_score": 85.5,
      ...
    },
    {
      "ward_name": "Bandra West",
      "status": "GREEN",
      "priority": 1,
      "composite_score": 25.0,
      ...
    }
  ],
  "summary": {
    "total_wards": 2,
    "red_wards": 1,
    "yellow_wards": 0,
    "green_wards": 1,
    "avg_composite_score": 55.25,
    "highest_risk_ward": "Andheri East",
    "timestamp": "2026-01-21T19:56:00"
  }
}
```

---

### 4. Resource Forecasting

**Endpoint:** `POST /ml/forecast-resources`

**Bed Occupancy Request:**
```json
{
  "forecast_type": "beds",
  "historical_bed_usage": [45, 48, 52, 55, 58, 62, 65, 68, 70, 72, 75, 78, 80, 82],
  "disease_case_trend": [10, 12, 15, 18, 20, 22, 25, 28, 30, 32, 35, 38, 40, 42],
  "disease_type": "dengue"
}
```

**Bed Occupancy Response:**
```json
{
  "success": true,
  "forecast_type": "beds",
  "forecast": {
    "forecasts": [84.5, 87.2, 89.8, 92.5, 95.1, 97.8, 100.0],
    "forecast_dates": ["2026-01-22", "2026-01-23", "2026-01-24", "2026-01-25", "2026-01-26", "2026-01-27", "2026-01-28"],
    "current_occupancy": 82.0,
    "predicted_peak": 100.0,
    "peak_day": 7,
    "trend": "increasing",
    "confidence": "high",
    "risk_level": "CRITICAL",
    "method": "exponential_smoothing_with_case_correlation",
    "data_quality": "good"
  }
}
```

**Medicine Shortage Request:**
```json
{
  "forecast_type": "medicine",
  "current_stock": 500,
  "daily_consumption": [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115],
  "disease_case_forecast": [45, 48, 50, 52, 55, 58, 60],
  "medicine_name": "Paracetamol"
}
```

**Medicine Shortage Response:**
```json
{
  "success": true,
  "forecast_type": "medicine",
  "forecast": {
    "current_stock": 500,
    "forecasted_consumption": [54.0, 57.6, 60.0, 62.4, 66.0, 69.6, 72.0],
    "forecasted_stock_levels": [446.0, 388.4, 328.4, 266.0, 200.0, 130.4, 58.4],
    "minimum_stock": 58.4,
    "days_until_shortage": 8,
    "risk_level": "MEDIUM",
    "recommended_order": 200,
    "forecast_dates": ["2026-01-22", "2026-01-23", "2026-01-24", "2026-01-25", "2026-01-26", "2026-01-27", "2026-01-28"],
    "medicine_name": "Paracetamol"
  }
}
```

---

## Model Update Strategy

### Offline Training (Weekly)

```python
# train_models.py
from ml_outbreak_predictor import OutbreakPredictor, generate_synthetic_training_data

# 1. Collect data from database
training_data = fetch_last_week_data_from_db()

# 2. Train model
predictor = OutbreakPredictor()
X = predictor.engineer_features(training_data)
y = training_data['outbreak_next_7d']
metrics = predictor.train(X, y)

# 3. Save model
predictor.save_model('models/outbreak_model.pkl')

# 4. Log metrics
log_training_metrics(metrics)
```

### Automated Retraining Schedule

```bash
# crontab entry for weekly retraining
0 2 * * 0 /usr/bin/python3 /path/to/train_models.py
```

### API-Triggered Retraining

```javascript
// Trigger retraining via API
async function retrainModel(trainingData) {
    const response = await fetch('http://localhost:5000/ml/retrain-outbreak-model', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            training_data: trainingData
        })
    });
    
    const result = await response.json();
    console.log('Retraining metrics:', result.metrics);
}
```

---

## Deployment

### Option 1: Docker Deployment

```dockerfile
# Dockerfile
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["python", "ml_api.py"]
```

```bash
# Build and run
docker build -t smc-ml-api .
docker run -p 5000:5000 smc-ml-api
```

### Option 2: Direct Python Deployment

```bash
# Install dependencies
pip install flask flask-cors pandas numpy scikit-learn joblib

# Run API server
python ml_api.py
```

---

## Frontend Integration Examples

### Dashboard Integration

```javascript
// app.js - Add to existing SMC dashboard

// 1. Get ML predictions when ward is clicked
async function showWardDetails(wardId) {
    const ward = wards.find(w => w.id === wardId);
    
    // Get outbreak prediction
    const outbreakPrediction = await predictOutbreak({
        ward_id: wardId,
        population_density: ward.population / calculateArea(ward),
        daily_cases: getLastNDaysCases(wardId, 14),
        disease_type: 'dengue',
        month: new Date().getMonth() + 1,
        previous_outbreak: ward.hadPreviousOutbreak ? 1 : 0
    });
    
    // Get ward classification
    const classification = await classifyWard({
        ward_name: ward.name,
        active_cases: ward.totalCases,
        case_growth_rate: calculateGrowthRate(wardId),
        num_alerts: ward.activeAlerts,
        bed_availability_pct: calculateBedAvailability(wardId)
    });
    
    // Display in modal
    displayWardModal(ward, outbreakPrediction, classification);
}

// 2. Update dashboard with ML insights
async function updateDashboardWithML() {
    const allWards = wards.map(w => ({
        ward_name: w.name,
        active_cases: w.totalCases,
        case_growth_rate: calculateGrowthRate(w.id),
        num_alerts: w.activeAlerts,
        bed_availability_pct: calculateBedAvailability(w.id)
    }));
    
    const batchClassification = await fetch('http://localhost:5000/ml/classify-wards-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wards: allWards })
    }).then(r => r.json());
    
    // Update map colors based on ML classification
    updateMapColors(batchClassification.classifications);
    
    // Update summary stats
    updateSummaryStats(batchClassification.summary);
}

// 3. Show resource forecasts
async function showResourceForecasts() {
    const bedForecast = await fetch('http://localhost:5000/ml/forecast-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            forecast_type: 'beds',
            historical_bed_usage: getHistoricalBedUsage(),
            disease_case_trend: getCaseTrend(),
            disease_type: 'dengue'
        })
    }).then(r => r.json());
    
    // Display forecast chart
    displayForecastChart(bedForecast.forecast);
}
```

---

## Error Handling

```javascript
async function safeMLRequest(endpoint, data) {
    try {
        const response = await fetch(`http://localhost:5000${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (!result.success) {
            console.error('ML API Error:', result.error);
            return null;
        }
        
        return result;
    } catch (error) {
        console.error('ML API Request Failed:', error);
        // Fallback to rule-based logic
        return getFallbackPrediction(data);
    }
}
```

---

## Performance Optimization

### Caching

```python
from functools import lru_cache

@lru_cache(maxsize=100)
def cached_prediction(ward_id, cases_hash):
    # Cache predictions for same input
    return predictor.predict(X)
```

### Batch Processing

```python
# Process multiple wards in one request
# More efficient than individual requests
classifications = classify_wards_batch(all_wards)
```

---

## Monitoring

### Log ML Predictions

```python
import logging

logging.basicConfig(
    filename='ml_predictions.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

@app.route('/ml/predict-outbreak', methods=['POST'])
def predict_outbreak():
    result = # ... prediction logic
    
    logging.info(f"Outbreak prediction: Ward={data['ward_id']}, Risk={result['risk_score']}")
    
    return jsonify(result)
```

---

## Testing

```bash
# Test outbreak prediction
curl -X POST http://localhost:5000/ml/predict-outbreak \
  -H "Content-Type: application/json" \
  -d '{
    "ward_id": "W001",
    "population_density": 15000,
    "daily_cases": [5,6,7,8,10,12,15,18,20,22,25,28,30,32],
    "disease_type": "dengue",
    "month": 7,
    "previous_outbreak": 1
  }'

# Test ward classification
curl -X POST http://localhost:5000/ml/classify-ward \
  -H "Content-Type": application/json" \
  -d '{
    "ward_name": "Andheri East",
    "active_cases": 28,
    "case_growth_rate": 65.0,
    "num_alerts": 2,
    "bed_availability_pct": 15.0
  }'
```

---

## Summary

The ML integration provides:
- ✅ Real-time predictions via REST API
- ✅ Easy frontend integration
- ✅ Automated model retraining
- ✅ Comprehensive error handling
- ✅ Production-ready deployment options

All models are lightweight, explainable, and designed for municipal-scale deployment.
