"""
Smart Public Health Command System - ML API Integration

Flask REST API for serving ML predictions in production.
Integrates outbreak prediction, ward classification, and resource forecasting.

Author: SMC ML Team
Date: January 2026
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from datetime import datetime
import os

# Import ML modules
from ml_outbreak_predictor import OutbreakPredictor
from ml_ward_classifier import WardRiskClassifier
from ml_resource_forecaster import ResourceForecaster

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for frontend integration

# Initialize ML models
outbreak_predictor = OutbreakPredictor()
ward_classifier = WardRiskClassifier()
resource_forecaster = ResourceForecaster()

# Load trained models (if available)
MODEL_PATH = 'models/outbreak_model.pkl'
if os.path.exists(MODEL_PATH):
    outbreak_predictor.load_model(MODEL_PATH)
    print(f"✓ Loaded outbreak prediction model from {MODEL_PATH}")
else:
    print(f"⚠ Outbreak model not found. Train model first using ml_outbreak_predictor.py")


# ===== HEALTH CHECK =====
@app.route('/health', methods=['GET'])
def health_check():
    """API health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'SMC ML API',
        'version': '1.0.0',
        'timestamp': datetime.now().isoformat()
    })


# ===== OUTBREAK PREDICTION =====
@app.route('/ml/predict-outbreak', methods=['POST'])
def predict_outbreak():
    """
    Predict disease outbreak probability for a ward.
    
    Request Body:
    {
        "ward_id": "W001",
        "population_density": 15000,
        "daily_cases": [5, 6, 7, 8, 10, 12, 15, 18, 20, 22, 25, 28, 30, 32],
        "disease_type": "dengue",
        "month": 7,
        "previous_outbreak": 1
    }
    
    Response:
    {
        "success": true,
        "prediction": {
            "risk_score": 0.78,
            "risk_category": "HIGH",
            "explanation": "...",
            "top_risk_factors": [...]
        },
        "timestamp": "2026-01-21T19:56:00"
    }
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['ward_id', 'population_density', 'daily_cases', 
                          'disease_type', 'month', 'previous_outbreak']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }), 400
        
        # Validate daily_cases length
        if len(data['daily_cases']) != 14:
            return jsonify({
                'success': False,
                'error': 'daily_cases must contain exactly 14 values'
            }), 400
        
        # Create DataFrame for prediction
        df = pd.DataFrame([data])
        
        # Engineer features
        X = outbreak_predictor.engineer_features(df)
        
        # Make prediction
        prediction = outbreak_predictor.predict(X)
        
        return jsonify({
            'success': True,
            'ward_id': data['ward_id'],
            'prediction': prediction,
            'timestamp': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ===== WARD CLASSIFICATION =====
@app.route('/ml/classify-ward', methods=['POST'])
def classify_ward():
    """
    Classify ward into GREEN/YELLOW/RED risk category.
    
    Request Body:
    {
        "ward_name": "Andheri East",
        "active_cases": 28,
        "case_growth_rate": 65.0,
        "num_alerts": 2,
        "bed_availability_pct": 15.0
    }
    
    Response:
    {
        "success": true,
        "classification": {
            "ward_name": "Andheri East",
            "status": "RED",
            "priority": 3,
            "composite_score": 85.5,
            "risk_breakdown": {...},
            "reasons": [...],
            "recommendations": [...]
        }
    }
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['active_cases', 'case_growth_rate', 
                          'num_alerts', 'bed_availability_pct']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }), 400
        
        # Classify ward
        classification = ward_classifier.classify_ward(
            active_cases=data['active_cases'],
            case_growth_rate=data['case_growth_rate'],
            num_alerts=data['num_alerts'],
            bed_availability_pct=data['bed_availability_pct'],
            ward_name=data.get('ward_name', 'Unknown')
        )
        
        return jsonify({
            'success': True,
            'classification': classification
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ===== BATCH WARD CLASSIFICATION =====
@app.route('/ml/classify-wards-batch', methods=['POST'])
def classify_wards_batch():
    """
    Classify multiple wards at once.
    
    Request Body:
    {
        "wards": [
            {
                "ward_name": "Andheri East",
                "active_cases": 28,
                "case_growth_rate": 65.0,
                "num_alerts": 2,
                "bed_availability_pct": 15.0
            },
            ...
        ]
    }
    
    Response:
    {
        "success": true,
        "classifications": [...],
        "summary": {
            "total_wards": 10,
            "red_wards": 2,
            "yellow_wards": 3,
            "green_wards": 5
        }
    }
    """
    try:
        data = request.get_json()
        
        if 'wards' not in data or not isinstance(data['wards'], list):
            return jsonify({
                'success': False,
                'error': 'Request must contain "wards" array'
            }), 400
        
        # Classify all wards
        classifications_df = ward_classifier.classify_multiple_wards(data['wards'])
        classifications = classifications_df.to_dict('records')
        
        # Get summary
        summary = ward_classifier.get_city_summary(data['wards'])
        
        return jsonify({
            'success': True,
            'classifications': classifications,
            'summary': summary
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ===== RESOURCE FORECASTING =====
@app.route('/ml/forecast-resources', methods=['POST'])
def forecast_resources():
    """
    Forecast hospital bed occupancy and medicine shortages.
    
    Request Body:
    {
        "forecast_type": "beds",  // or "medicine"
        "historical_bed_usage": [45, 48, 52, ...],  // for beds
        "disease_case_trend": [10, 12, 15, ...],
        "disease_type": "dengue",
        // For medicine forecast:
        "current_stock": 500,
        "daily_consumption": [50, 55, 60, ...],
        "disease_case_forecast": [45, 48, 50, ...],
        "medicine_name": "Paracetamol"
    }
    
    Response:
    {
        "success": true,
        "forecast": {
            "forecasts": [...],
            "risk_level": "HIGH",
            ...
        }
    }
    """
    try:
        data = request.get_json()
        
        forecast_type = data.get('forecast_type', 'beds')
        
        if forecast_type == 'beds':
            # Bed occupancy forecast
            if 'historical_bed_usage' not in data or 'disease_case_trend' not in data:
                return jsonify({
                    'success': False,
                    'error': 'Missing required fields for bed forecast'
                }), 400
            
            forecast = resource_forecaster.forecast_bed_occupancy(
                historical_bed_usage=data['historical_bed_usage'],
                disease_case_trend=data['disease_case_trend'],
                disease_type=data.get('disease_type', 'unknown')
            )
        
        elif forecast_type == 'medicine':
            # Medicine shortage forecast
            required = ['current_stock', 'daily_consumption', 'disease_case_forecast']
            if not all(field in data for field in required):
                return jsonify({
                    'success': False,
                    'error': 'Missing required fields for medicine forecast'
                }), 400
            
            forecast = resource_forecaster.forecast_medicine_shortage(
                current_stock=data['current_stock'],
                daily_consumption=data['daily_consumption'],
                disease_case_forecast=data['disease_case_forecast'],
                medicine_name=data.get('medicine_name', 'Unknown')
            )
        
        else:
            return jsonify({
                'success': False,
                'error': 'Invalid forecast_type. Use "beds" or "medicine"'
            }), 400
        
        return jsonify({
            'success': True,
            'forecast_type': forecast_type,
            'forecast': forecast
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ===== MODEL RETRAINING =====
@app.route('/ml/retrain-outbreak-model', methods=['POST'])
def retrain_outbreak_model():
    """
    Trigger model retraining with new data.
    
    Request Body:
    {
        "training_data": [
            {
                "ward_id": "W001",
                "population_density": 15000,
                "daily_cases": [...],
                "disease_type": "dengue",
                "month": 7,
                "previous_outbreak": 1,
                "outbreak_next_7d": 1
            },
            ...
        ]
    }
    
    Response:
    {
        "success": true,
        "metrics": {
            "accuracy": 0.85,
            "roc_auc": 0.88,
            ...
        }
    }
    """
    try:
        data = request.get_json()
        
        if 'training_data' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing training_data'
            }), 400
        
        # Convert to DataFrame
        df = pd.DataFrame(data['training_data'])
        
        # Engineer features
        X = outbreak_predictor.engineer_features(df)
        y = df['outbreak_next_7d']
        
        # Retrain model
        metrics = outbreak_predictor.train(X, y)
        
        # Save updated model
        outbreak_predictor.save_model(MODEL_PATH)
        
        return jsonify({
            'success': True,
            'message': 'Model retrained successfully',
            'metrics': {
                'accuracy': metrics['accuracy'],
                'roc_auc': metrics['roc_auc']
            },
            'timestamp': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ===== MODEL INFO =====
@app.route('/ml/model-info', methods=['GET'])
def model_info():
    """Get information about loaded models."""
    return jsonify({
        'success': True,
        'models': {
            'outbreak_predictor': {
                'type': 'Random Forest Classifier',
                'features': len(outbreak_predictor.feature_names) if outbreak_predictor.feature_names else 0,
                'top_features': list(outbreak_predictor.feature_importance.keys())[:5] if outbreak_predictor.feature_importance else []
            },
            'ward_classifier': {
                'type': 'Rule-Based System',
                'thresholds': ward_classifier.thresholds
            },
            'resource_forecaster': {
                'type': 'Time-Series (Exponential Smoothing)',
                'forecast_horizon': resource_forecaster.forecast_horizon
            }
        },
        'timestamp': datetime.now().isoformat()
    })


# ===== ERROR HANDLERS =====
@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'error': 'Endpoint not found'
    }), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'error': 'Internal server error'
    }), 500


# ===== MAIN =====
if __name__ == '__main__':
    print("=" * 60)
    print("Smart Public Health Command System - ML API")
    print("=" * 60)
    print("\nAvailable Endpoints:")
    print("  GET  /health - Health check")
    print("  POST /ml/predict-outbreak - Outbreak prediction")
    print("  POST /ml/classify-ward - Ward classification")
    print("  POST /ml/classify-wards-batch - Batch classification")
    print("  POST /ml/forecast-resources - Resource forecasting")
    print("  POST /ml/retrain-outbreak-model - Model retraining")
    print("  GET  /ml/model-info - Model information")
    print("\n" + "=" * 60)
    print("Starting server on http://localhost:5000")
    print("=" * 60 + "\n")
    
    # Create models directory if it doesn't exist
    os.makedirs('models', exist_ok=True)
    
    # Run Flask app
    app.run(host='0.0.0.0', port=5000, debug=True)
