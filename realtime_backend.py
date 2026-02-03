"""
Smart Public Health Management System - Real-Time Backend
FastAPI server with WebSocket support, Redis Streams, and ML inference

Author: SMC Real-Time Team
Date: January 2026
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
import asyncio
import json
import redis.asyncio as redis
from collections import defaultdict
import numpy as np
from fastapi.staticfiles import StaticFiles
from pathlib import Path

# Initialize FastAPI app
app = FastAPI(
    title="Smart Public Health Management System",
    description="Real-time disease monitoring and outbreak prediction",
    version="2.0.0"
)

BASE_DIR = Path(__file__).resolve().parent

app.mount(
    "/sounds",
    StaticFiles(directory="public/sounds"),
    name="sounds"
)

# Serve frontend assets (demo setup)
app.mount(
    "/static",
    StaticFiles(directory=str(BASE_DIR)),
    name="static"
)

@app.get("/")
async def root():
    return FileResponse(BASE_DIR / "index.html")


# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis connection
redis_client = None

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = defaultdict(list)
    
    async def connect(self, websocket: WebSocket, channel: str):
        await websocket.accept()
        self.active_connections[channel].append(websocket)
    
    def disconnect(self, websocket: WebSocket, channel: str):
        self.active_connections[channel].remove(websocket)
    
    async def broadcast(self, message: dict, channel: str):
        """Broadcast message to all connections in a channel"""
        for connection in self.active_connections[channel]:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()

# ===== DATA MODELS =====

class DiseaseType(str, Enum):
    DENGUE = "dengue"
    MALARIA = "malaria"
    TYPHOID = "typhoid"
    COVID = "covid"
    TUBERCULOSIS = "tuberculosis"
    CHOLERA = "cholera"

class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class RiskLevel(str, Enum):
    GREEN = "GREEN"
    YELLOW = "YELLOW"
    RED = "RED"

class CaseEvent(BaseModel):
    ward_id: str
    disease_type: DiseaseType
    patient_age: int = Field(ge=0, le=120)
    patient_gender: str
    severity: Severity
    timestamp: Optional[datetime] = None
    reported_by: str
    notes: Optional[str] = None

class ResourceEvent(BaseModel):
    hospital_id: str
    ward_id: str
    resource_type: str  # "beds" or "medicine"
    total_capacity: int
    available: int
    timestamp: Optional[datetime] = None

class WardRiskScore(BaseModel):
    ward_id: str
    ward_name: str
    risk_score: float = Field(ge=0, le=100)
    risk_level: RiskLevel
    outbreak_probability: float = Field(ge=0, le=1)
    anomaly_detected: bool
    case_count_1h: int
    case_count_24h: int
    case_velocity: float
    growth_rate: float
    top_disease: str
    recommended_actions: List[str]
    timestamp: datetime

class Alert(BaseModel):
    id: str
    ward_id: str
    ward_name: str
    severity: str
    disease_type: str
    message: str
    outbreak_probability: float
    case_count: int
    threshold: int
    recommended_actions: List[Dict[str, str]]
    created_at: datetime
    status: str = "active"

# ===== IN-MEMORY STATE (for prototype) =====
# In production, this would be Redis/TimescaleDB

class RealTimeState:
    def __init__(self):
        self.cases = []
        self.resources = {}
        self.ward_stats = {}
        self.alerts = []
        self.ml_models = {}
    
    def add_case(self, case: CaseEvent):
        """Add case and update statistics"""
        case_dict = case.dict()
        case_dict['timestamp'] = case_dict['timestamp'] or datetime.now()
        case_dict['id'] = f"case_{datetime.now().timestamp()}"
        self.cases.append(case_dict)
        
        # Update ward stats
        ward_id = case.ward_id
        if ward_id not in self.ward_stats:
            self.ward_stats[ward_id] = {
                'cases_1h': [],
                'cases_24h': [],
                'disease_counts': defaultdict(int)
            }
        
        now = datetime.now()
        self.ward_stats[ward_id]['cases_1h'].append(case_dict)
        self.ward_stats[ward_id]['cases_24h'].append(case_dict)
        self.ward_stats[ward_id]['disease_counts'][case.disease_type.value] += 1
        
        # Clean old data
        cutoff_1h = now - timedelta(hours=1)
        cutoff_24h = now - timedelta(hours=24)
        
        self.ward_stats[ward_id]['cases_1h'] = [
            c for c in self.ward_stats[ward_id]['cases_1h']
            if c['timestamp'] > cutoff_1h
        ]
        self.ward_stats[ward_id]['cases_24h'] = [
            c for c in self.ward_stats[ward_id]['cases_24h']
            if c['timestamp'] > cutoff_24h
        ]
    
    def update_resource(self, resource: ResourceEvent):
        """Update hospital resource"""
        resource_dict = resource.dict()
        resource_dict['timestamp'] = resource_dict['timestamp'] or datetime.now()
        
        key = f"{resource.hospital_id}_{resource.resource_type}"
        self.resources[key] = resource_dict
    
    def get_zone(self, patient_count):
        if patient_count >= 100:
            return "red"
        elif patient_count >= 50:
            return "orange"
        else:
            return "blue"


    def get_ward_risk(self, ward_id: str) -> WardRiskScore:
        """Calculate real-time ward risk score"""
        stats = self.ward_stats.get(ward_id, {
            'cases_1h': [],
            'cases_24h': [],
            'disease_counts': defaultdict(int)
        })
        
        case_count_1h = len(stats['cases_1h'])
        case_count_24h = len(stats['cases_24h'])
        
        # Calculate case velocity (cases per hour)
        case_velocity = case_count_1h
        
        # Calculate growth rate
        if case_count_24h > 0:
            recent_6h = len([c for c in stats['cases_24h'] 
                           if c['timestamp'] > datetime.now() - timedelta(hours=6)])
            old_6h = case_count_24h - recent_6h
            growth_rate = ((recent_6h - old_6h) / max(old_6h, 1)) * 100
        else:
            growth_rate = 0
        
        # ML-based outbreak probability (simplified for prototype)
        outbreak_prob = min(1.0, (case_velocity * 0.1 + growth_rate * 0.01))
        
        # Anomaly detection (simple Z-score)
        anomaly_detected = case_velocity > 10 or growth_rate > 100
        
        # Calculate composite risk score
        risk_score = (
            outbreak_prob * 40 +
            (1 if anomaly_detected else 0) * 30 +
            min(growth_rate, 100) * 0.2 +
            min(case_velocity, 20) * 1.5
        )
        
        # Determine risk level
        if risk_score >= 60:
            risk_level = RiskLevel.RED
        elif risk_score >= 30:
            risk_level = RiskLevel.YELLOW
        else:
            risk_level = RiskLevel.GREEN
        
        # Top disease
        top_disease = max(stats['disease_counts'].items(), 
                         key=lambda x: x[1])[0] if stats['disease_counts'] else "none"
        
        # Recommended actions
        actions = []
        if risk_level == RiskLevel.RED:
            actions = [
                "Deploy emergency response team immediately",
                "Activate additional healthcare workers",
                "Implement containment measures"
            ]
        elif risk_level == RiskLevel.YELLOW:
            actions = [
                "Enhanced surveillance required",
                "Increase testing capacity",
                "Prepare additional resources"
            ]
        else:
            actions = ["Continue routine monitoring"]
        
        return WardRiskScore(
            ward_id=ward_id,
            ward_name=f"Ward {ward_id}",
            risk_score=round(risk_score, 2),
            risk_level=risk_level,
            outbreak_probability=round(outbreak_prob, 3),
            anomaly_detected=anomaly_detected,
            case_count_1h=case_count_1h,
            case_count_24h=case_count_24h,
            case_velocity=round(case_velocity, 2),
            growth_rate=round(growth_rate, 2),
            top_disease=top_disease,
            recommended_actions=actions,
            timestamp=datetime.now()
        )

# Global state
state = RealTimeState()

# ===== STARTUP/SHUTDOWN =====

@app.on_event("startup")
async def startup_event():
    """Initialize connections on startup"""
    global redis_client
    try:
        redis_client = await redis.from_url("redis://localhost:6379", decode_responses=True)
        print("✓ Connected to Redis")
    except:
        print("⚠ Redis not available - using in-memory state only")
        redis_client = None

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    if redis_client:
        await redis_client.aclose()

# ===== EVENT INGESTION ENDPOINTS =====

@app.post("/events/case", status_code=201)
async def ingest_case_event(case: CaseEvent, background_tasks: BackgroundTasks):
    """
    Ingest a new disease case event.
    Triggers real-time processing and ML inference.
    """
    # Add to state
    state.add_case(case)
    
    # Publish to Redis stream (if available)
    if redis_client:
        try:
            await redis_client.xadd(
            "case_events",
            {"data": json.dumps(case.dict(), default=str)}
        )
        except Exception as e:
            print("⚠ Redis xadd failed:", e)

    
    # Calculate updated ward risk
    ward_risk = state.get_ward_risk(case.ward_id)
    
    # Broadcast to WebSocket clients
    background_tasks.add_task(
        manager.broadcast,
        {
            "type": "case_added",
            "case": case.dict(exclude={'timestamp'}),
            "ward_risk": ward_risk.dict()
        },
        "admin"
    )
    
    # Check if alert should be generated
    if ward_risk.risk_level == RiskLevel.RED and ward_risk.outbreak_probability > 0.7:
        alert = Alert(
            id=f"alert_{datetime.now().timestamp()}",
            ward_id=case.ward_id,
            ward_name=ward_risk.ward_name,
            severity="CRITICAL",
            disease_type=case.disease_type.value,
            message=f"High outbreak risk detected in {ward_risk.ward_name}",
            outbreak_probability=ward_risk.outbreak_probability,
            case_count=ward_risk.case_count_24h,
            threshold=10,
            recommended_actions=[
                {"action": "Deploy emergency team", "urgency": "immediate"},
                {"action": "Arrange temporary beds", "urgency": "within_6h"}
            ],
            created_at=datetime.now()
        )
        state.alerts.append(alert.dict())
        
        # Broadcast alert
        background_tasks.add_task(
            manager.broadcast,
            {"type": "new_alert", "alert": alert.dict()},
            "admin"
        )
    
    return {
        "success": True,
        "case_id": f"case_{datetime.now().timestamp()}",
        "ward_risk": ward_risk.dict(),
        "message": "Case event ingested successfully"
    }

@app.post("/events/resource", status_code=201)
async def ingest_resource_event(resource: ResourceEvent, background_tasks: BackgroundTasks):
    """
    Ingest hospital resource update event.
    """
    state.update_resource(resource)
    
    # Publish to Redis
    if redis_client:
        await redis_client.xadd(
            "resource_events",
            {"data": json.dumps(resource.dict(), default=str)}
        )
    
    # Calculate stress level
    utilization = ((resource.total_capacity - resource.available) / resource.total_capacity) * 100
    stress_level = "CRITICAL" if utilization > 90 else "HIGH" if utilization > 75 else "NORMAL"
    
    # Broadcast update
    background_tasks.add_task(
        manager.broadcast,
        {
            "type": "resource_updated",
            "resource": resource.dict(),
            "utilization": round(utilization, 2),
            "stress_level": stress_level
        },
        "admin"
    )
    
    return {
        "success": True,
        "resource_id": f"{resource.hospital_id}_{resource.resource_type}",
        "utilization": round(utilization, 2),
        "stress_level": stress_level
    }

# ===== REAL-TIME DATA ENDPOINTS =====

@app.websocket("/ws/admin")
async def websocket_admin(websocket: WebSocket):
    """
    WebSocket endpoint for admin dashboard.
    Streams real-time updates.
    """
    await manager.connect(websocket, "admin")
    
    try:
        # Send initial state
        await websocket.send_json({
            "type": "initial_state",
            "total_cases": len(state.cases),
            "active_alerts": len([a for a in state.alerts if a['status'] == 'active']),
            "timestamp": datetime.now().isoformat()
        })
        
        # Keep connection alive and handle incoming messages
        while True:
            data = await websocket.receive_text()
            # Echo back for heartbeat
            await websocket.send_json({"type": "pong"})
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, "admin")

@app.websocket("/ws/ward/{ward_id}")
async def websocket_ward(websocket: WebSocket, ward_id: str):
    """
    WebSocket endpoint for ward-specific updates.
    """
    channel = f"ward_{ward_id}"
    await manager.connect(websocket, channel)
    
    try:
        # Send initial ward risk
        ward_risk = state.get_ward_risk(ward_id)
        await websocket.send_json({
            "type": "ward_risk",
            "data": ward_risk.dict()
        })
        
        # Stream updates every 5 seconds
        while True:
            await asyncio.sleep(5)
            ward_risk = state.get_ward_risk(ward_id)
            await websocket.send_json({
                "type": "ward_risk_update",
                "data": ward_risk.dict()
            })
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel)

@app.get("/realtime/ward-risk/{ward_id}")
async def get_ward_risk(ward_id: str):
    """Get current ward risk score"""
    ward_risk = state.get_ward_risk(ward_id)
    return ward_risk

@app.get("/realtime/dashboard-stats")
async def get_dashboard_stats():
    """Get real-time dashboard statistics"""
    now = datetime.now()
    cutoff_24h = now - timedelta(hours=24)
    
    recent_cases = [c for c in state.cases if c['timestamp'] > cutoff_24h]
    
    return {
        "total_cases_24h": len(recent_cases),
        "active_alerts": len([a for a in state.alerts if a['status'] == 'active']),
        "wards_monitored": len(state.ward_stats),
        "high_risk_wards": len([
            w for w in state.ward_stats.keys()
            if state.get_ward_risk(w).risk_level == RiskLevel.RED
        ]),
        "timestamp": now.isoformat()
    }

@app.get("/realtime/hospital-load")
async def get_hospital_load():
    """
    Lightweight endpoint for MAP frontend.
    Returns hospital/ward load + zone.
    """

    response = []

    for ward_id, stats in state.ward_stats.items():
        patient_count = len(stats["cases_24h"])

        zone = state.get_zone(patient_count)

        response.append({
            "ward_id": ward_id,
            "patients": patient_count,
            "zone": zone
        })

    return response

# ===== ALERT ENDPOINTS =====

@app.get("/alerts", response_model=List[Alert])
async def get_alerts(status: Optional[str] = "active", limit: int = 50):
    """Get alerts with optional filtering"""
    filtered_alerts = [
        Alert(**a) for a in state.alerts
        if status is None or a['status'] == status
    ]
    return filtered_alerts[:limit]

@app.get("/sse/alerts")
async def stream_alerts():
    """Server-Sent Events stream for alerts"""
    async def event_generator():
        last_alert_count = len(state.alerts)
        
        while True:
            # Check for new alerts
            current_count = len(state.alerts)
            if current_count > last_alert_count:
                new_alerts = state.alerts[last_alert_count:]
                for alert in new_alerts:
                    yield f"data: {json.dumps(alert, default=str)}\n\n"
                last_alert_count = current_count
            
            await asyncio.sleep(2)
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")

# ===== CITIZEN ENDPOINTS =====

@app.get("/citizen/alerts")
async def get_citizen_alerts(ward_id: Optional[str] = None):
    """Get alerts relevant to citizens"""
    filtered_alerts = [
        a for a in state.alerts
        if a['status'] == 'active' and (ward_id is None or a['ward_id'] == ward_id)
    ]
    
    # Simplify for citizens
    citizen_alerts = []
    for alert in filtered_alerts:
        citizen_alerts.append({
            "disease": alert['disease_type'],
            "area": alert['ward_name'],
            "severity": alert['severity'],
            "message": alert['message'],
            "prevention_tips": get_prevention_tips(alert['disease_type'])
        })
    
    return citizen_alerts

@app.get("/citizen/prevention-tips")
async def get_prevention_tips(disease: str):
    """Get prevention tips for a disease"""
    tips = {
        "dengue": [
            "Eliminate standing water around your home",
            "Use mosquito repellent",
            "Wear long-sleeved clothing",
            "Use mosquito nets while sleeping"
        ],
        "malaria": [
            "Sleep under insecticide-treated bed nets",
            "Use mosquito repellent on exposed skin",
            "Wear protective clothing",
            "Keep windows and doors screened"
        ],
        "covid": [
            "Wear masks in crowded places",
            "Maintain social distancing",
            "Wash hands frequently",
            "Get vaccinated"
        ],
        "typhoid": [
            "Drink only boiled or bottled water",
            "Wash hands before eating",
            "Avoid street food",
            "Get vaccinated"
        ]
    }
    
    return {
        "disease": disease,
        "tips": tips.get(disease, ["Consult healthcare provider"])
    }

# ===== HEALTH CHECK =====

@app.get("/health")
async def health_check():
    """API health check"""
    return {
        "status": "healthy",
        "service": "SMC Real-Time API",
        "version": "2.0.0",
        "redis_connected": redis_client is not None,
        "timestamp": datetime.now().isoformat()
    }

# ===== MAIN =====

if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("Smart Public Health Management System - Real-Time API")
    print("=" * 60)
    print("\nEndpoints:")
    print("  POST /events/case - Ingest case event")
    print("  POST /events/resource - Ingest resource event")
    print("  WS   /ws/admin - Admin WebSocket")
    print("  WS   /ws/ward/{id} - Ward WebSocket")
    print("  GET  /realtime/ward-risk/{id} - Ward risk score")
    print("  GET  /alerts - Get alerts")
    print("  GET  /sse/alerts - Alert stream (SSE)")
    print("  GET  /citizen/alerts - Citizen alerts")
    print("\n" + "=" * 60)
    print("Starting server on http://localhost:8000")
    print("WebSocket: ws://localhost:8000/ws/admin")
    print("Docs: http://localhost:8000/docs")
    print("=" * 60 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
