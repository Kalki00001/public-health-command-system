"""
Smart Public Health Command System - Ward Risk Classifier

Rule-based system to classify wards into GREEN, YELLOW, or RED risk categories.
Designed for real-time dashboard integration with full explainability.

Author: SMC ML Team
Date: January 2026
"""

import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Tuple


class WardRiskClassifier:
    """
    Rule-based classifier for ward risk assessment.
    
    Why Rule-Based?
    - Fully explainable and auditable
    - No training data required
    - Instant decisions
    - Easy to modify rules based on expert input
    - Transparent to government officials
    """
    
    def __init__(self):
        # Define thresholds (can be adjusted based on city requirements)
        self.thresholds = {
            'cases': {
                'low': 10,
                'high': 25
            },
            'growth_rate': {
                'low': 20,
                'high': 50
            },
            'alerts': {
                'low': 1,
                'high': 2
            },
            'bed_availability': {
                'critical': 20,
                'low': 40
            }
        }
        
        # Rule weights for composite scoring
        self.weights = {
            'cases': 0.3,
            'growth_rate': 0.3,
            'alerts': 0.2,
            'beds': 0.2
        }
    
    def classify_ward(self, 
                     active_cases: int,
                     case_growth_rate: float,
                     num_alerts: int,
                     bed_availability_pct: float,
                     ward_name: str = "Unknown") -> Dict:
        """
        Classify ward into risk category using rule-based logic.
        
        Args:
            active_cases: Number of active disease cases
            case_growth_rate: Percentage growth in cases (e.g., 25.5 for 25.5%)
            num_alerts: Number of active health alerts
            bed_availability_pct: Percentage of hospital beds available (0-100)
            ward_name: Name of the ward
        
        Returns:
            Dictionary with status, reasons, and recommendations
        """
        
        # Individual risk scores (0-100)
        case_risk = self._score_cases(active_cases)
        growth_risk = self._score_growth(case_growth_rate)
        alert_risk = self._score_alerts(num_alerts)
        bed_risk = self._score_beds(bed_availability_pct)
        
        # Composite risk score
        composite_score = (
            case_risk * self.weights['cases'] +
            growth_risk * self.weights['growth_rate'] +
            alert_risk * self.weights['alerts'] +
            bed_risk * self.weights['beds']
        )
        
        # Determine status
        status, priority = self._determine_status(composite_score)
        
        # Generate human-readable reasons
        reasons = self._generate_reasons(
            active_cases, case_growth_rate, num_alerts, 
            bed_availability_pct, case_risk, growth_risk, 
            alert_risk, bed_risk
        )
        
        # Generate recommendations
        recommendations = self._generate_recommendations(
            status, active_cases, case_growth_rate, 
            num_alerts, bed_availability_pct
        )
        
        return {
            'ward_name': ward_name,
            'status': status,
            'priority': priority,
            'composite_score': round(composite_score, 2),
            'risk_breakdown': {
                'case_risk': round(case_risk, 2),
                'growth_risk': round(growth_risk, 2),
                'alert_risk': round(alert_risk, 2),
                'bed_risk': round(bed_risk, 2)
            },
            'reasons': reasons,
            'recommendations': recommendations,
            'timestamp': datetime.now().isoformat()
        }
    
    def _score_cases(self, active_cases: int) -> float:
        """Score based on active case count (0-100)."""
        if active_cases < self.thresholds['cases']['low']:
            return 20  # Low risk
        elif active_cases < self.thresholds['cases']['high']:
            return 60  # Medium risk
        else:
            return 100  # High risk
    
    def _score_growth(self, growth_rate: float) -> float:
        """Score based on case growth rate (0-100)."""
        if growth_rate < 0:
            return 10  # Decreasing - very low risk
        elif growth_rate < self.thresholds['growth_rate']['low']:
            return 30  # Slow growth - low risk
        elif growth_rate < self.thresholds['growth_rate']['high']:
            return 70  # Moderate growth - medium risk
        else:
            return 100  # Rapid growth - high risk
    
    def _score_alerts(self, num_alerts: int) -> float:
        """Score based on number of active alerts (0-100)."""
        if num_alerts == 0:
            return 0
        elif num_alerts < self.thresholds['alerts']['high']:
            return 60
        else:
            return 100
    
    def _score_beds(self, bed_availability_pct: float) -> float:
        """Score based on bed availability (0-100, inverse relationship)."""
        if bed_availability_pct > self.thresholds['bed_availability']['low']:
            return 10  # Good availability - low risk
        elif bed_availability_pct > self.thresholds['bed_availability']['critical']:
            return 60  # Limited availability - medium risk
        else:
            return 100  # Critical shortage - high risk
    
    def _determine_status(self, composite_score: float) -> Tuple[str, int]:
        """
        Determine ward status based on composite score.
        
        Returns:
            Tuple of (status_label, priority_number)
        """
        if composite_score < 40:
            return "GREEN", 1
        elif composite_score < 70:
            return "YELLOW", 2
        else:
            return "RED", 3
    
    def _generate_reasons(self, active_cases, growth_rate, num_alerts, 
                         bed_availability, case_risk, growth_risk, 
                         alert_risk, bed_risk) -> List[str]:
        """Generate human-readable reasons for classification."""
        reasons = []
        
        # Case count reasons
        if case_risk >= 60:
            if active_cases >= self.thresholds['cases']['high']:
                reasons.append(f"High case count: {active_cases} active cases")
            else:
                reasons.append(f"Elevated case count: {active_cases} active cases")
        
        # Growth rate reasons
        if growth_risk >= 70:
            reasons.append(f"Rapid case growth: {growth_rate:.1f}% increase")
        elif growth_risk >= 30 and growth_rate > 0:
            reasons.append(f"Cases increasing: {growth_rate:.1f}% growth")
        elif growth_rate < 0:
            reasons.append(f"Cases declining: {abs(growth_rate):.1f}% decrease")
        
        # Alert reasons
        if num_alerts > 0:
            alert_word = "alerts" if num_alerts > 1 else "alert"
            reasons.append(f"{num_alerts} active health {alert_word}")
        
        # Bed availability reasons
        if bed_risk >= 100:
            reasons.append(f"Critical bed shortage: {bed_availability:.1f}% available")
        elif bed_risk >= 60:
            reasons.append(f"Limited bed availability: {bed_availability:.1f}% available")
        elif bed_availability > 60:
            reasons.append(f"Adequate bed capacity: {bed_availability:.1f}% available")
        
        # If no concerning reasons, add positive note
        if not reasons:
            reasons.append("All indicators within normal range")
        
        return reasons
    
    def _generate_recommendations(self, status, active_cases, growth_rate, 
                                 num_alerts, bed_availability) -> List[str]:
        """Generate actionable recommendations based on status."""
        recommendations = []
        
        if status == "RED":
            recommendations.append("🚨 URGENT: Deploy emergency response team")
            
            if active_cases >= self.thresholds['cases']['high']:
                recommendations.append("Activate additional healthcare workers")
            
            if growth_rate > self.thresholds['growth_rate']['high']:
                recommendations.append("Implement containment measures immediately")
            
            if bed_availability < self.thresholds['bed_availability']['critical']:
                recommendations.append("Arrange temporary hospital beds/facilities")
            
            if num_alerts >= 2:
                recommendations.append("Coordinate multi-disease response strategy")
        
        elif status == "YELLOW":
            recommendations.append("⚠️ MONITOR: Enhanced surveillance required")
            
            if growth_rate > 20:
                recommendations.append("Increase testing and contact tracing")
            
            if bed_availability < 40:
                recommendations.append("Prepare additional bed capacity")
            
            recommendations.append("Conduct health awareness campaigns")
            recommendations.append("Ensure medicine stock adequacy")
        
        else:  # GREEN
            recommendations.append("✅ ROUTINE: Continue standard monitoring")
            recommendations.append("Maintain preventive measures")
            
            if growth_rate > 0:
                recommendations.append("Watch for trend changes")
        
        return recommendations
    
    def classify_multiple_wards(self, wards_data: List[Dict]) -> pd.DataFrame:
        """
        Classify multiple wards and return sorted by priority.
        
        Args:
            wards_data: List of dictionaries with ward information
        
        Returns:
            DataFrame sorted by priority (RED first)
        """
        results = []
        
        for ward in wards_data:
            classification = self.classify_ward(
                active_cases=ward['active_cases'],
                case_growth_rate=ward['case_growth_rate'],
                num_alerts=ward['num_alerts'],
                bed_availability_pct=ward['bed_availability_pct'],
                ward_name=ward.get('ward_name', 'Unknown')
            )
            results.append(classification)
        
        df = pd.DataFrame(results)
        
        # Sort by priority (RED=3, YELLOW=2, GREEN=1)
        df = df.sort_values('priority', ascending=False)
        
        return df
    
    def get_city_summary(self, wards_data: List[Dict]) -> Dict:
        """
        Generate city-wide summary statistics.
        
        Args:
            wards_data: List of ward data dictionaries
        
        Returns:
            Summary statistics dictionary
        """
        classifications = self.classify_multiple_wards(wards_data)
        
        status_counts = classifications['status'].value_counts().to_dict()
        
        return {
            'total_wards': len(wards_data),
            'red_wards': status_counts.get('RED', 0),
            'yellow_wards': status_counts.get('YELLOW', 0),
            'green_wards': status_counts.get('GREEN', 0),
            'avg_composite_score': classifications['composite_score'].mean(),
            'highest_risk_ward': classifications.iloc[0]['ward_name'],
            'timestamp': datetime.now().isoformat()
        }


# Example usage
if __name__ == "__main__":
    print("=" * 60)
    print("Smart Public Health Command System")
    print("Ward Risk Classifier - Rule-Based System")
    print("=" * 60)
    
    # Initialize classifier
    classifier = WardRiskClassifier()
    
    # Example ward data
    wards_data = [
        {
            'ward_name': 'Andheri East',
            'active_cases': 28,
            'case_growth_rate': 65.0,
            'num_alerts': 2,
            'bed_availability_pct': 15.0
        },
        {
            'ward_name': 'Bandra West',
            'active_cases': 8,
            'case_growth_rate': 15.0,
            'num_alerts': 0,
            'bed_availability_pct': 55.0
        },
        {
            'ward_name': 'Kurla',
            'active_cases': 18,
            'case_growth_rate': 35.0,
            'num_alerts': 1,
            'bed_availability_pct': 30.0
        },
        {
            'ward_name': 'Powai',
            'active_cases': 5,
            'case_growth_rate': -10.0,
            'num_alerts': 0,
            'bed_availability_pct': 70.0
        }
    ]
    
    print("\n1. Classifying Individual Wards:")
    print("-" * 60)
    
    for ward in wards_data:
        result = classifier.classify_ward(
            active_cases=ward['active_cases'],
            case_growth_rate=ward['case_growth_rate'],
            num_alerts=ward['num_alerts'],
            bed_availability_pct=ward['bed_availability_pct'],
            ward_name=ward['ward_name']
        )
        
        print(f"\n📍 {result['ward_name']}")
        print(f"   Status: {result['status']} (Score: {result['composite_score']})")
        print(f"   Reasons:")
        for reason in result['reasons']:
            print(f"     • {reason}")
        print(f"   Recommendations:")
        for rec in result['recommendations']:
            print(f"     • {rec}")
    
    print("\n\n2. City-Wide Summary:")
    print("-" * 60)
    summary = classifier.get_city_summary(wards_data)
    print(f"   Total Wards: {summary['total_wards']}")
    print(f"   🔴 RED Wards: {summary['red_wards']}")
    print(f"   🟡 YELLOW Wards: {summary['yellow_wards']}")
    print(f"   🟢 GREEN Wards: {summary['green_wards']}")
    print(f"   Average Risk Score: {summary['avg_composite_score']:.2f}")
    print(f"   Highest Risk Ward: {summary['highest_risk_ward']}")
    
    print("\n" + "=" * 60)
    print("Classification Complete!")
    print("=" * 60)
