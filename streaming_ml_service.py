"""
Smart Public Health Management System - Streaming ML Inference Service
Online learning models for real-time outbreak prediction and anomaly detection

Author: SMC ML Team
Date: January 2026
"""

from river import linear_model, preprocessing, compose, anomaly, metrics
from river import tree
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import json
from collections import deque, defaultdict

class StreamingOutbreakPredictor:
    """
    Online learning model for outbreak prediction.
    Uses River library for incremental learning.
    """
    
    def __init__(self):
        # Online Logistic Regression with feature scaling
        self.model = compose.Pipeline(
            preprocessing.StandardScaler(),
            linear_model.LogisticRegression()
        )
        
        # Feature importance tracking
        self.feature_importance = defaultdict(float)
        
        # Performance metrics
        self.accuracy = metrics.Accuracy()
        self.roc_auc = metrics.ROCAUC()
        
        # Training history
        self.predictions_made = 0
        self.correct_predictions = 0
        
    def extract_features(self, ward_data: Dict) -> Dict:
        """
        Extract features from ward data for prediction.
        
        Args:
            ward_data: Dictionary with ward statistics
        
        Returns:
            Feature dictionary
        """
        features = {
            # Case counts
            'cases_1h': ward_data.get('case_count_1h', 0),
            'cases_6h': ward_data.get('case_count_6h', 0),
            'cases_24h': ward_data.get('case_count_24h', 0),
            
            # Velocity and growth
            'case_velocity': ward_data.get('case_velocity', 0),
            'growth_rate': ward_data.get('growth_rate', 0),
            
            # Population
            'population_density': ward_data.get('population_density', 10000),
            
            # Temporal features
            'hour_of_day': datetime.now().hour,
            'day_of_week': datetime.now().weekday(),
            'is_monsoon': 1 if datetime.now().month in [6, 7, 8, 9] else 0,
            
            # Historical
            'had_outbreak_before': ward_data.get('previous_outbreak', 0),
            
            # Disease-specific
            'primary_disease_dengue': 1 if ward_data.get('top_disease') == 'dengue' else 0,
            'primary_disease_covid': 1 if ward_data.get('top_disease') == 'covid' else 0,
        }
        
        return features
    
    def predict(self, ward_data: Dict) -> Dict:
        """
        Predict outbreak probability for a ward.
        
        Args:
            ward_data: Ward statistics
        
        Returns:
            Prediction with explanation
        """
        features = self.extract_features(ward_data)
        
        # Get probability
        outbreak_prob = self.model.predict_proba_one(features).get(True, 0.0)
        
        # Get feature contributions (simplified)
        top_features = sorted(
            features.items(),
            key=lambda x: abs(x[1]),
            reverse=True
        )[:3]
        
        # Generate explanation
        explanation = self._generate_explanation(features, outbreak_prob)
        
        self.predictions_made += 1
        
        return {
            'outbreak_probability': round(outbreak_prob, 3),
            'confidence': self._calculate_confidence(outbreak_prob),
            'risk_category': self._categorize_risk(outbreak_prob),
            'top_features': [
                {
                    'feature': name,
                    'value': round(value, 2),
                    'impact': 'high' if abs(value) > 10 else 'medium'
                }
                for name, value in top_features
            ],
            'explanation': explanation,
            'model_accuracy': round(self.accuracy.get(), 3) if self.predictions_made > 10 else None
        }
    
    def update(self, ward_data: Dict, actual_outbreak: bool):
        """
        Update model with new data (online learning).
        
        Args:
            ward_data: Ward statistics
            actual_outbreak: Whether outbreak actually occurred
        """
        features = self.extract_features(ward_data)
        
        # Update model
        self.model.learn_one(features, actual_outbreak)
        
        # Update metrics
        prediction = self.model.predict_one(features)
        self.accuracy.update(actual_outbreak, prediction)
        
        if actual_outbreak == prediction:
            self.correct_predictions += 1
    
    def _calculate_confidence(self, probability: float) -> str:
        """Calculate confidence level based on probability"""
        if probability > 0.8 or probability < 0.2:
            return 'high'
        elif probability > 0.6 or probability < 0.4:
            return 'medium'
        else:
            return 'low'
    
    def _categorize_risk(self, probability: float) -> str:
        """Categorize risk level"""
        if probability >= 0.7:
            return 'HIGH'
        elif probability >= 0.4:
            return 'MEDIUM'
        else:
            return 'LOW'
    
    def _generate_explanation(self, features: Dict, probability: float) -> str:
        """Generate human-readable explanation"""
        explanations = []
        
        if probability >= 0.7:
            explanations.append("HIGH RISK: Immediate action recommended")
        elif probability >= 0.4:
            explanations.append("MEDIUM RISK: Enhanced monitoring required")
        else:
            explanations.append("LOW RISK: Continue routine surveillance")
        
        # Add specific factors
        if features['case_velocity'] > 5:
            explanations.append(f"High case velocity ({features['case_velocity']} cases/hour)")
        
        if features['growth_rate'] > 50:
            explanations.append(f"Rapid growth rate ({features['growth_rate']}%)")
        
        if features['had_outbreak_before']:
            explanations.append("Ward has history of outbreaks")
        
        return " | ".join(explanations)


class StreamingAnomalyDetector:
    """
    Real-time anomaly detection using EWMA and Z-score.
    Detects unusual spikes in case counts.
    """
    
    def __init__(self, alpha: float = 0.3, threshold: float = 3.0):
        """
        Args:
            alpha: Smoothing factor for EWMA (0-1)
            threshold: Z-score threshold for anomaly
        """
        self.alpha = alpha
        self.threshold = threshold
        
        # EWMA state per ward
        self.ewma = {}
        self.variance = {}
        self.history = defaultdict(lambda: deque(maxlen=100))
        
    def detect(self, ward_id: str, current_value: float) -> Dict:
        """
        Detect if current value is anomalous.
        
        Args:
            ward_id: Ward identifier
            current_value: Current case count or velocity
        
        Returns:
            Anomaly detection result
        """
        # Initialize if first time
        if ward_id not in self.ewma:
            self.ewma[ward_id] = current_value
            self.variance[ward_id] = 0
            self.history[ward_id].append(current_value)
            return {
                'is_anomaly': False,
                'z_score': 0,
                'expected_value': current_value,
                'actual_value': current_value,
                'severity': 'normal'
            }
        
        # Calculate EWMA
        prev_ewma = self.ewma[ward_id]
        new_ewma = self.alpha * current_value + (1 - self.alpha) * prev_ewma
        
        # Update variance
        prev_var = self.variance[ward_id]
        new_var = self.alpha * (current_value - new_ewma) ** 2 + (1 - self.alpha) * prev_var
        std_dev = np.sqrt(new_var) if new_var > 0 else 1
        
        # Calculate Z-score
        z_score = (current_value - new_ewma) / std_dev if std_dev > 0 else 0
        
        # Detect anomaly
        is_anomaly = abs(z_score) > self.threshold
        
        # Determine severity
        if abs(z_score) > 5:
            severity = 'critical'
        elif abs(z_score) > 3:
            severity = 'high'
        elif abs(z_score) > 2:
            severity = 'medium'
        else:
            severity = 'normal'
        
        # Update state
        self.ewma[ward_id] = new_ewma
        self.variance[ward_id] = new_var
        self.history[ward_id].append(current_value)
        
        return {
            'is_anomaly': is_anomaly,
            'z_score': round(z_score, 2),
            'expected_value': round(new_ewma, 2),
            'actual_value': current_value,
            'deviation': round(current_value - new_ewma, 2),
            'severity': severity,
            'explanation': self._explain_anomaly(z_score, current_value, new_ewma)
        }
    
    def _explain_anomaly(self, z_score: float, actual: float, expected: float) -> str:
        """Generate explanation for anomaly"""
        if abs(z_score) < 2:
            return "Within normal range"
        
        direction = "higher" if actual > expected else "lower"
        magnitude = abs(actual - expected)
        
        return f"Unusual spike: {actual} cases ({direction} than expected {expected:.1f} by {magnitude:.1f})"


class ResourceStressForecaster:
    """
    Short-term forecasting for hospital resources.
    Uses simple exponential smoothing for 24-72 hour predictions.
    """
    
    def __init__(self):
        self.alpha = 0.4  # Smoothing parameter
        self.level = {}  # Current level per resource
        self.trend = {}  # Current trend per resource
        
    def forecast(self, resource_id: str, historical_values: List[float], 
                 horizon: int = 24) -> Dict:
        """
        Forecast resource usage for next N hours.
        
        Args:
            resource_id: Resource identifier
            historical_values: List of past values (hourly)
            horizon: Hours to forecast ahead
        
        Returns:
            Forecast with confidence intervals
        """
        if len(historical_values) < 3:
            # Not enough data - return simple average
            avg = np.mean(historical_values) if historical_values else 50
            return {
                'forecasts': [avg] * horizon,
                'confidence': 'low',
                'shortage_risk': 'unknown',
                'warning': 'Insufficient historical data'
            }
        
        # Initialize or get state
        if resource_id not in self.level:
            self.level[resource_id] = historical_values[0]
            self.trend[resource_id] = 0
        
        # Update with latest data
        for value in historical_values[-10:]:  # Use last 10 points
            prev_level = self.level[resource_id]
            prev_trend = self.trend[resource_id]
            
            # Update level and trend
            self.level[resource_id] = self.alpha * value + (1 - self.alpha) * (prev_level + prev_trend)
            self.trend[resource_id] = self.alpha * (self.level[resource_id] - prev_level) + (1 - self.alpha) * prev_trend
        
        # Generate forecasts
        forecasts = []
        current_level = self.level[resource_id]
        current_trend = self.trend[resource_id]
        
        for h in range(1, horizon + 1):
            forecast = current_level + h * current_trend
            forecasts.append(max(0, min(100, forecast)))  # Clamp to 0-100%
        
        # Determine shortage risk
        max_forecast = max(forecasts)
        if max_forecast > 95:
            shortage_risk = 'CRITICAL'
        elif max_forecast > 85:
            shortage_risk = 'HIGH'
        elif max_forecast > 75:
            shortage_risk = 'MEDIUM'
        else:
            shortage_risk = 'LOW'
        
        # Calculate confidence
        variance = np.var(historical_values[-10:])
        confidence = 'high' if variance < 100 else 'medium' if variance < 400 else 'low'
        
        return {
            'forecasts': [round(f, 2) for f in forecasts],
            'forecast_hours': list(range(1, horizon + 1)),
            'current_value': round(historical_values[-1], 2),
            'predicted_peak': round(max_forecast, 2),
            'peak_hour': forecasts.index(max(forecasts)) + 1,
            'shortage_risk': shortage_risk,
            'confidence': confidence,
            'trend': 'increasing' if current_trend > 0 else 'decreasing',
            'recommended_action': self._get_recommendation(shortage_risk, max_forecast)
        }
    
    def _get_recommendation(self, risk: str, peak: float) -> str:
        """Generate action recommendation"""
        if risk == 'CRITICAL':
            return f"URGENT: Arrange additional capacity immediately. Peak expected at {peak:.0f}%"
        elif risk == 'HIGH':
            return f"Prepare additional resources. Peak expected at {peak:.0f}%"
        elif risk == 'MEDIUM':
            return "Monitor closely and prepare contingency plans"
        else:
            return "Continue routine monitoring"


# ===== INFERENCE SERVICE =====

class MLInferenceService:
    """
    Centralized ML inference service.
    Manages all ML models and provides unified interface.
    """
    
    def __init__(self):
        self.outbreak_predictor = StreamingOutbreakPredictor()
        self.anomaly_detector = StreamingAnomalyDetector()
        self.resource_forecaster = ResourceStressForecaster()
        
        print("✓ ML Inference Service initialized")
        print("  - Streaming Outbreak Predictor (Online Logistic Regression)")
        print("  - Anomaly Detector (EWMA + Z-score)")
        print("  - Resource Forecaster (Exponential Smoothing)")
    
    def predict_outbreak(self, ward_data: Dict) -> Dict:
        """Predict outbreak for a ward"""
        return self.outbreak_predictor.predict(ward_data)
    
    def detect_anomaly(self, ward_id: str, current_cases: float) -> Dict:
        """Detect anomaly in case count"""
        return self.anomaly_detector.detect(ward_id, current_cases)
    
    def forecast_resources(self, resource_id: str, historical_data: List[float], 
                          horizon: int = 24) -> Dict:
        """Forecast resource usage"""
        return self.resource_forecaster.forecast(resource_id, historical_data, horizon)
    
    def update_outbreak_model(self, ward_data: Dict, actual_outbreak: bool):
        """Update outbreak model with feedback"""
        self.outbreak_predictor.update(ward_data, actual_outbreak)
    
    def get_model_status(self) -> Dict:
        """Get status of all models"""
        return {
            'outbreak_predictor': {
                'type': 'Online Logistic Regression',
                'predictions_made': self.outbreak_predictor.predictions_made,
                'accuracy': round(self.outbreak_predictor.accuracy.get(), 3) 
                           if self.outbreak_predictor.predictions_made > 10 else None
            },
            'anomaly_detector': {
                'type': 'EWMA + Z-score',
                'wards_monitored': len(self.anomaly_detector.ewma)
            },
            'resource_forecaster': {
                'type': 'Exponential Smoothing',
                'resources_tracked': len(self.resource_forecaster.level)
            }
        }


# ===== EXAMPLE USAGE =====

if __name__ == "__main__":
    print("=" * 60)
    print("Smart Public Health - Streaming ML Inference Service")
    print("=" * 60)
    
    # Initialize service
    ml_service = MLInferenceService()
    
    # Example 1: Outbreak Prediction
    print("\n1. Outbreak Prediction:")
    ward_data = {
        'case_count_1h': 8,
        'case_count_6h': 35,
        'case_count_24h': 120,
        'case_velocity': 8.5,
        'growth_rate': 65.2,
        'population_density': 15000,
        'top_disease': 'dengue',
        'previous_outbreak': 1
    }
    
    prediction = ml_service.predict_outbreak(ward_data)
    print(f"   Outbreak Probability: {prediction['outbreak_probability']}")
    print(f"   Risk Category: {prediction['risk_category']}")
    print(f"   Explanation: {prediction['explanation']}")
    
    # Example 2: Anomaly Detection
    print("\n2. Anomaly Detection:")
    for hour, cases in enumerate([5, 6, 5, 7, 6, 5, 25, 8, 6]):  # Spike at hour 6
        result = ml_service.detect_anomaly('ward_1', cases)
        if result['is_anomaly']:
            print(f"   Hour {hour}: ANOMALY DETECTED!")
            print(f"   Z-score: {result['z_score']}")
            print(f"   {result['explanation']}")
    
    # Example 3: Resource Forecasting
    print("\n3. Resource Forecasting:")
    historical_occupancy = [65, 68, 70, 72, 75, 78, 80, 82, 85, 87]
    forecast = ml_service.forecast_resources('hospital_1_beds', historical_occupancy, horizon=12)
    print(f"   Current Occupancy: {forecast['current_value']}%")
    print(f"   Predicted Peak: {forecast['predicted_peak']}% at hour {forecast['peak_hour']}")
    print(f"   Shortage Risk: {forecast['shortage_risk']}")
    print(f"   Recommendation: {forecast['recommended_action']}")
    
    # Model Status
    print("\n4. Model Status:")
    status = ml_service.get_model_status()
    for model, info in status.items():
        print(f"   {model}: {info['type']}")
    
    print("\n" + "=" * 60)
    print("ML Inference Service Ready!")
    print("=" * 60)
