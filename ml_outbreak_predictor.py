"""
Smart Public Health Command System - ML Outbreak Predictor

This module implements a lightweight, explainable ML model to predict
disease outbreak probability in city wards within the next 7 days.

Author: SMC ML Team
Date: January 2026
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
import joblib
import json
from datetime import datetime, timedelta


class OutbreakPredictor:
    """
    Predicts disease outbreak probability using Random Forest Classifier.
    
    Why Random Forest?
    - Highly interpretable (feature importance)
    - Handles non-linear relationships
    - Robust to outliers
    - No need for feature scaling
    - Works well with small datasets
    - Fast training and prediction
    """
    
    def __init__(self):
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=5,  # Limit depth for interpretability
            min_samples_split=10,
            min_samples_leaf=5,
            random_state=42,
            class_weight='balanced'  # Handle imbalanced data
        )
        self.scaler = StandardScaler()
        self.disease_encoder = LabelEncoder()
        self.feature_names = []
        self.feature_importance = {}
        
    def engineer_features(self, data):
        """
        Create meaningful features from raw data.
        
        Args:
            data: DataFrame with columns:
                - ward_id
                - population_density
                - daily_cases (list of 14 days)
                - disease_type
                - month
                - previous_outbreak (0 or 1)
        
        Returns:
            DataFrame with engineered features
        """
        features = pd.DataFrame()
        
        # Basic features
        features['population_density'] = data['population_density']
        features['month'] = data['month']
        features['previous_outbreak'] = data['previous_outbreak']
        
        # Disease type encoding
        features['disease_encoded'] = self.disease_encoder.fit_transform(data['disease_type'])
        
        # Time-series features from daily cases
        daily_cases = np.array(data['daily_cases'].tolist())
        
        # Statistical features
        features['cases_mean_14d'] = daily_cases.mean(axis=1)
        features['cases_std_14d'] = daily_cases.std(axis=1)
        features['cases_max_14d'] = daily_cases.max(axis=1)
        features['cases_min_14d'] = daily_cases.min(axis=1)
        
        # Trend features
        features['cases_last_7d_mean'] = daily_cases[:, -7:].mean(axis=1)
        features['cases_first_7d_mean'] = daily_cases[:, :7].mean(axis=1)
        features['case_growth_rate'] = (
            (features['cases_last_7d_mean'] - features['cases_first_7d_mean']) / 
            (features['cases_first_7d_mean'] + 1)  # Avoid division by zero
        ) * 100
        
        # Momentum features
        features['cases_increasing'] = (daily_cases[:, -1] > daily_cases[:, -7]).astype(int)
        features['consecutive_increase_days'] = self._count_consecutive_increases(daily_cases)
        
        # Seasonal features
        features['is_monsoon'] = ((data['month'] >= 6) & (data['month'] <= 9)).astype(int)
        features['is_winter'] = ((data['month'] >= 11) | (data['month'] <= 2)).astype(int)
        
        # Risk indicators
        features['high_density_risk'] = (data['population_density'] > 10000).astype(int)
        features['rapid_growth'] = (features['case_growth_rate'] > 50).astype(int)
        
        self.feature_names = features.columns.tolist()
        return features
    
    def _count_consecutive_increases(self, daily_cases):
        """Count consecutive days with increasing cases."""
        consecutive = []
        for cases in daily_cases:
            count = 0
            for i in range(len(cases) - 1, 0, -1):
                if cases[i] > cases[i-1]:
                    count += 1
                else:
                    break
            consecutive.append(count)
        return np.array(consecutive)
    
    def train(self, X, y):
        """
        Train the outbreak prediction model.
        
        Args:
            X: Feature DataFrame
            y: Target labels (0: No outbreak, 1: Outbreak)
        
        Returns:
            Training metrics dictionary
        """
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Train model
        self.model.fit(X_train, y_train)
        
        # Predictions
        y_pred = self.model.predict(X_test)
        y_pred_proba = self.model.predict_proba(X_test)[:, 1]
        
        # Feature importance
        self.feature_importance = dict(zip(
            self.feature_names,
            self.model.feature_importances_
        ))
        
        # Sort by importance
        self.feature_importance = dict(
            sorted(self.feature_importance.items(), 
                   key=lambda x: x[1], reverse=True)
        )
        
        # Evaluation metrics
        metrics = {
            'accuracy': self.model.score(X_test, y_test),
            'roc_auc': roc_auc_score(y_test, y_pred_proba),
            'classification_report': classification_report(y_test, y_pred, output_dict=True),
            'confusion_matrix': confusion_matrix(y_test, y_pred).tolist(),
            'feature_importance': self.feature_importance
        }
        
        return metrics
    
    def predict(self, X):
        """
        Predict outbreak probability and risk category.
        
        Args:
            X: Feature DataFrame
        
        Returns:
            Dictionary with risk_score, risk_category, and explanation
        """
        # Get probability
        risk_score = self.model.predict_proba(X)[:, 1][0]
        
        # Classify risk
        if risk_score < 0.3:
            risk_category = "LOW"
        elif risk_score < 0.7:
            risk_category = "MEDIUM"
        else:
            risk_category = "HIGH"
        
        # Generate explanation
        explanation = self._generate_explanation(X, risk_score)
        
        return {
            'risk_score': float(risk_score),
            'risk_category': risk_category,
            'explanation': explanation,
            'top_risk_factors': self._get_top_risk_factors(X)
        }
    
    def _generate_explanation(self, X, risk_score):
        """Generate human-readable explanation."""
        explanations = []
        
        if risk_score >= 0.7:
            explanations.append("HIGH RISK: Immediate action recommended")
        elif risk_score >= 0.3:
            explanations.append("MEDIUM RISK: Enhanced monitoring required")
        else:
            explanations.append("LOW RISK: Continue routine surveillance")
        
        # Add specific factors
        if X['case_growth_rate'].values[0] > 50:
            explanations.append("Cases increasing rapidly (>50% growth)")
        
        if X['consecutive_increase_days'].values[0] >= 5:
            explanations.append(f"Cases rising for {int(X['consecutive_increase_days'].values[0])} consecutive days")
        
        if X['previous_outbreak'].values[0] == 1:
            explanations.append("Ward has history of previous outbreaks")
        
        if X['high_density_risk'].values[0] == 1:
            explanations.append("High population density increases transmission risk")
        
        return " | ".join(explanations)
    
    def _get_top_risk_factors(self, X):
        """Identify top 3 contributing risk factors."""
        factors = []
        for feature, importance in list(self.feature_importance.items())[:3]:
            value = X[feature].values[0]
            factors.append({
                'factor': feature,
                'value': float(value),
                'importance': float(importance)
            })
        return factors
    
    def save_model(self, filepath='outbreak_model.pkl'):
        """Save trained model to disk."""
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'disease_encoder': self.disease_encoder,
            'feature_names': self.feature_names,
            'feature_importance': self.feature_importance
        }
        joblib.dump(model_data, filepath)
        print(f"Model saved to {filepath}")
    
    def load_model(self, filepath='outbreak_model.pkl'):
        """Load trained model from disk."""
        model_data = joblib.load(filepath)
        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.disease_encoder = model_data['disease_encoder']
        self.feature_names = model_data['feature_names']
        self.feature_importance = model_data['feature_importance']
        print(f"Model loaded from {filepath}")


def generate_synthetic_training_data(n_samples=1000):
    """
    Generate synthetic training data for demonstration.
    In production, this would come from historical records.
    """
    np.random.seed(42)
    
    data = []
    diseases = ['dengue', 'malaria', 'typhoid', 'covid', 'tuberculosis', 'cholera']
    
    for _ in range(n_samples):
        # Random ward characteristics
        population_density = np.random.randint(5000, 20000)
        month = np.random.randint(1, 13)
        previous_outbreak = np.random.choice([0, 1], p=[0.7, 0.3])
        disease_type = np.random.choice(diseases)
        
        # Generate daily cases with some pattern
        base_cases = np.random.randint(0, 10)
        trend = np.random.choice([-1, 0, 1], p=[0.2, 0.5, 0.3])
        noise = np.random.normal(0, 2, 14)
        daily_cases = np.maximum(0, base_cases + trend * np.arange(14) + noise).astype(int)
        
        # Determine outbreak (next 7 days)
        # Higher probability if cases increasing, high density, previous outbreak
        outbreak_prob = 0.1
        if trend > 0:
            outbreak_prob += 0.3
        if population_density > 15000:
            outbreak_prob += 0.2
        if previous_outbreak:
            outbreak_prob += 0.2
        if daily_cases[-1] > 15:
            outbreak_prob += 0.2
        
        outbreak = np.random.choice([0, 1], p=[1-outbreak_prob, outbreak_prob])
        
        data.append({
            'ward_id': f'W{_:03d}',
            'population_density': population_density,
            'daily_cases': daily_cases.tolist(),
            'disease_type': disease_type,
            'month': month,
            'previous_outbreak': previous_outbreak,
            'outbreak_next_7d': outbreak
        })
    
    return pd.DataFrame(data)


# Example usage and training
if __name__ == "__main__":
    print("=" * 60)
    print("Smart Public Health Command System")
    print("ML Outbreak Predictor - Training Module")
    print("=" * 60)
    
    # Generate training data
    print("\n1. Generating synthetic training data...")
    df = generate_synthetic_training_data(n_samples=1000)
    print(f"   Generated {len(df)} training samples")
    
    # Initialize predictor
    print("\n2. Initializing outbreak predictor...")
    predictor = OutbreakPredictor()
    
    # Engineer features
    print("\n3. Engineering features...")
    X = predictor.engineer_features(df)
    y = df['outbreak_next_7d']
    print(f"   Created {len(X.columns)} features")
    
    # Train model
    print("\n4. Training Random Forest model...")
    metrics = predictor.train(X, y)
    
    print(f"\n5. Model Performance:")
    print(f"   Accuracy: {metrics['accuracy']:.3f}")
    print(f"   ROC-AUC: {metrics['roc_auc']:.3f}")
    
    print(f"\n6. Top 5 Most Important Features:")
    for i, (feature, importance) in enumerate(list(metrics['feature_importance'].items())[:5], 1):
        print(f"   {i}. {feature}: {importance:.4f}")
    
    # Save model
    print("\n7. Saving model...")
    predictor.save_model('models/outbreak_model.pkl')
    
    # Test prediction
    print("\n8. Testing prediction on sample ward...")
    test_sample = df.iloc[[0]]
    X_test = predictor.engineer_features(test_sample)
    prediction = predictor.predict(X_test)
    
    print(f"\n   Prediction Results:")
    print(f"   Risk Score: {prediction['risk_score']:.3f}")
    print(f"   Risk Category: {prediction['risk_category']}")
    print(f"   Explanation: {prediction['explanation']}")
    
    print("\n" + "=" * 60)
    print("Training Complete!")
    print("=" * 60)
