"""
Smart Public Health Command System - Resource Forecaster

Lightweight time-series forecasting for hospital bed occupancy and medicine shortages.
Uses simple statistical methods suitable for small datasets.

Author: SMC ML Team
Date: January 2026
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import warnings
warnings.filterwarnings('ignore')


class ResourceForecaster:
    """
    Forecasts hospital bed occupancy and medicine stock levels.
    
    Why Simple Time-Series Methods?
    - Works with limited historical data (as few as 14 days)
    - Fast computation (real-time predictions)
    - No complex training required
    - Interpretable results
    - Robust to missing data
    - Easy to explain to non-technical users
    
    Methods Used:
    1. Exponential Smoothing - for trend detection
    2. Moving Average - for noise reduction
    3. Linear Regression - for simple trend projection
    """
    
    def __init__(self):
        self.min_data_points = 7  # Minimum days of data required
        self.forecast_horizon = 7  # Days to forecast ahead
        
    def forecast_bed_occupancy(self, 
                               historical_bed_usage: List[float],
                               disease_case_trend: List[int],
                               disease_type: str) -> Dict:
        """
        Forecast bed occupancy for next 7 days.
        
        Args:
            historical_bed_usage: List of bed occupancy percentages (last 14-30 days)
            disease_case_trend: List of daily case counts (same period)
            disease_type: Type of disease (affects bed usage patterns)
        
        Returns:
            Dictionary with forecasts and confidence levels
        """
        
        # Validate input
        if len(historical_bed_usage) < self.min_data_points:
            return self._fallback_bed_forecast(historical_bed_usage, disease_type)
        
        # Convert to numpy arrays
        bed_usage = np.array(historical_bed_usage)
        cases = np.array(disease_case_trend)
        
        # Calculate disease-specific bed usage factor
        bed_factor = self._get_bed_usage_factor(disease_type)
        
        # Method 1: Exponential Smoothing for baseline
        alpha = 0.3  # Smoothing parameter
        baseline_forecast = self._exponential_smoothing(bed_usage, alpha)
        
        # Method 2: Case-driven adjustment
        case_trend = self._calculate_trend(cases)
        case_adjustment = case_trend * bed_factor
        
        # Combine forecasts
        forecasts = []
        for day in range(1, self.forecast_horizon + 1):
            # Base prediction from exponential smoothing
            base = baseline_forecast[-1] + (baseline_forecast[-1] - baseline_forecast[-2]) * day
            
            # Adjust based on case trend
            adjusted = base + (case_adjustment * day)
            
            # Apply bounds (0-100%)
            forecast = np.clip(adjusted, 0, 100)
            forecasts.append(forecast)
        
        # Calculate confidence
        volatility = np.std(bed_usage[-7:])  # Recent volatility
        confidence = self._calculate_confidence(volatility, len(bed_usage))
        
        # Determine risk level
        max_forecast = max(forecasts)
        risk_level = self._determine_bed_risk(max_forecast)
        
        return {
            'forecasts': [round(f, 2) for f in forecasts],
            'forecast_dates': self._get_forecast_dates(),
            'current_occupancy': round(bed_usage[-1], 2),
            'predicted_peak': round(max_forecast, 2),
            'peak_day': forecasts.index(max(forecasts)) + 1,
            'trend': 'increasing' if case_trend > 0 else 'decreasing',
            'confidence': confidence,
            'risk_level': risk_level,
            'method': 'exponential_smoothing_with_case_correlation',
            'data_quality': 'good' if len(bed_usage) >= 14 else 'limited'
        }
    
    def forecast_medicine_shortage(self,
                                   current_stock: int,
                                   daily_consumption: List[int],
                                   disease_case_forecast: List[int],
                                   medicine_name: str) -> Dict:
        """
        Forecast medicine stock levels and shortage risk.
        
        Args:
            current_stock: Current medicine units in stock
            daily_consumption: Historical daily consumption (last 7-14 days)
            disease_case_forecast: Forecasted case counts for next 7 days
            medicine_name: Name of medicine
        
        Returns:
            Dictionary with stock forecasts and risk assessment
        """
        
        # Validate input
        if len(daily_consumption) < self.min_data_points:
            return self._fallback_medicine_forecast(current_stock, daily_consumption)
        
        consumption = np.array(daily_consumption)
        case_forecast = np.array(disease_case_forecast)
        
        # Calculate average consumption per case
        avg_consumption_per_case = np.mean(consumption) / max(np.mean(case_forecast), 1)
        
        # Forecast daily consumption based on case forecast
        forecasted_consumption = []
        stock_levels = [current_stock]
        
        for day in range(self.forecast_horizon):
            # Predict consumption based on forecasted cases
            expected_cases = case_forecast[day] if day < len(case_forecast) else case_forecast[-1]
            daily_need = expected_cases * avg_consumption_per_case
            
            # Add safety buffer (20%)
            daily_need *= 1.2
            
            forecasted_consumption.append(daily_need)
            
            # Calculate remaining stock
            remaining = stock_levels[-1] - daily_need
            stock_levels.append(max(0, remaining))
        
        # Determine shortage risk
        min_stock = min(stock_levels[1:])
        days_until_shortage = self._calculate_days_until_shortage(stock_levels)
        risk_level = self._determine_medicine_risk(min_stock, days_until_shortage)
        
        return {
            'current_stock': current_stock,
            'forecasted_consumption': [round(c, 2) for c in forecasted_consumption],
            'forecasted_stock_levels': [round(s, 2) for s in stock_levels[1:]],
            'minimum_stock': round(min_stock, 2),
            'days_until_shortage': days_until_shortage,
            'risk_level': risk_level,
            'recommended_order': self._calculate_reorder_quantity(
                forecasted_consumption, current_stock
            ),
            'forecast_dates': self._get_forecast_dates(),
            'medicine_name': medicine_name
        }
    
    def _exponential_smoothing(self, data: np.ndarray, alpha: float) -> np.ndarray:
        """Apply exponential smoothing to time series."""
        smoothed = [data[0]]
        for i in range(1, len(data)):
            smoothed.append(alpha * data[i] + (1 - alpha) * smoothed[-1])
        return np.array(smoothed)
    
    def _calculate_trend(self, data: np.ndarray) -> float:
        """Calculate linear trend using simple regression."""
        n = len(data)
        x = np.arange(n)
        
        # Simple linear regression
        x_mean = np.mean(x)
        y_mean = np.mean(data)
        
        numerator = np.sum((x - x_mean) * (data - y_mean))
        denominator = np.sum((x - x_mean) ** 2)
        
        if denominator == 0:
            return 0
        
        slope = numerator / denominator
        return slope
    
    def _get_bed_usage_factor(self, disease_type: str) -> float:
        """
        Get bed usage factor based on disease severity.
        Higher factor = more beds needed per case.
        """
        factors = {
            'covid': 0.8,
            'tuberculosis': 0.6,
            'dengue': 0.5,
            'malaria': 0.4,
            'typhoid': 0.5,
            'cholera': 0.7
        }
        return factors.get(disease_type.lower(), 0.5)
    
    def _calculate_confidence(self, volatility: float, data_points: int) -> str:
        """Calculate forecast confidence level."""
        if data_points >= 21 and volatility < 10:
            return 'high'
        elif data_points >= 14 and volatility < 20:
            return 'medium'
        else:
            return 'low'
    
    def _determine_bed_risk(self, max_occupancy: float) -> str:
        """Determine bed occupancy risk level."""
        if max_occupancy >= 90:
            return 'CRITICAL'
        elif max_occupancy >= 75:
            return 'HIGH'
        elif max_occupancy >= 60:
            return 'MEDIUM'
        else:
            return 'NORMAL'
    
    def _determine_medicine_risk(self, min_stock: float, days_until_shortage: int) -> str:
        """Determine medicine shortage risk level."""
        if days_until_shortage <= 2 or min_stock <= 0:
            return 'CRITICAL'
        elif days_until_shortage <= 4:
            return 'HIGH'
        elif days_until_shortage <= 6:
            return 'MEDIUM'
        else:
            return 'NORMAL'
    
    def _calculate_days_until_shortage(self, stock_levels: List[float]) -> int:
        """Calculate days until stock runs out."""
        for day, stock in enumerate(stock_levels[1:], 1):
            if stock <= 0:
                return day
        return self.forecast_horizon + 1  # Beyond forecast horizon
    
    def _calculate_reorder_quantity(self, forecasted_consumption: List[float], 
                                   current_stock: float) -> int:
        """Calculate recommended reorder quantity."""
        total_need = sum(forecasted_consumption)
        safety_stock = total_need * 0.3  # 30% safety buffer
        reorder = max(0, total_need + safety_stock - current_stock)
        return int(np.ceil(reorder))
    
    def _get_forecast_dates(self) -> List[str]:
        """Generate forecast dates for next 7 days."""
        dates = []
        for i in range(1, self.forecast_horizon + 1):
            date = datetime.now() + timedelta(days=i)
            dates.append(date.strftime('%Y-%m-%d'))
        return dates
    
    def _fallback_bed_forecast(self, bed_usage: List[float], disease_type: str) -> Dict:
        """
        Fallback forecast when insufficient data.
        Uses simple average and conservative estimates.
        """
        if len(bed_usage) == 0:
            avg_usage = 50.0  # Default assumption
        else:
            avg_usage = np.mean(bed_usage)
        
        # Conservative forecast: assume slight increase
        forecasts = [avg_usage + i * 2 for i in range(1, self.forecast_horizon + 1)]
        forecasts = [min(f, 100) for f in forecasts]
        
        return {
            'forecasts': [round(f, 2) for f in forecasts],
            'forecast_dates': self._get_forecast_dates(),
            'current_occupancy': round(avg_usage, 2),
            'predicted_peak': round(max(forecasts), 2),
            'peak_day': forecasts.index(max(forecasts)) + 1,
            'trend': 'stable',
            'confidence': 'low',
            'risk_level': 'MEDIUM',
            'method': 'fallback_average',
            'data_quality': 'insufficient',
            'warning': 'Limited data - using conservative estimates'
        }
    
    def _fallback_medicine_forecast(self, current_stock: int, 
                                    consumption: List[int]) -> Dict:
        """Fallback medicine forecast with insufficient data."""
        if len(consumption) == 0:
            avg_consumption = current_stock / 10  # Conservative estimate
        else:
            avg_consumption = np.mean(consumption)
        
        forecasted_consumption = [avg_consumption] * self.forecast_horizon
        stock_levels = [current_stock]
        
        for consumption in forecasted_consumption:
            stock_levels.append(max(0, stock_levels[-1] - consumption))
        
        days_until_shortage = self._calculate_days_until_shortage(stock_levels)
        
        return {
            'current_stock': current_stock,
            'forecasted_consumption': [round(c, 2) for c in forecasted_consumption],
            'forecasted_stock_levels': [round(s, 2) for s in stock_levels[1:]],
            'minimum_stock': round(min(stock_levels[1:]), 2),
            'days_until_shortage': days_until_shortage,
            'risk_level': self._determine_medicine_risk(min(stock_levels[1:]), days_until_shortage),
            'recommended_order': int(avg_consumption * 10),
            'forecast_dates': self._get_forecast_dates(),
            'warning': 'Limited data - using conservative estimates'
        }


# Example usage
if __name__ == "__main__":
    print("=" * 60)
    print("Smart Public Health Command System")
    print("Resource Forecaster - Time Series Predictions")
    print("=" * 60)
    
    # Initialize forecaster
    forecaster = ResourceForecaster()
    
    # Example 1: Bed Occupancy Forecast
    print("\n1. Hospital Bed Occupancy Forecast")
    print("-" * 60)
    
    historical_beds = [45, 48, 52, 55, 58, 62, 65, 68, 70, 72, 75, 78, 80, 82]
    case_trend = [10, 12, 15, 18, 20, 22, 25, 28, 30, 32, 35, 38, 40, 42]
    
    bed_forecast = forecaster.forecast_bed_occupancy(
        historical_bed_usage=historical_beds,
        disease_case_trend=case_trend,
        disease_type='dengue'
    )
    
    print(f"   Current Occupancy: {bed_forecast['current_occupancy']}%")
    print(f"   Trend: {bed_forecast['trend']}")
    print(f"   Predicted Peak: {bed_forecast['predicted_peak']}% on Day {bed_forecast['peak_day']}")
    print(f"   Risk Level: {bed_forecast['risk_level']}")
    print(f"   Confidence: {bed_forecast['confidence']}")
    print(f"\n   7-Day Forecast:")
    for date, forecast in zip(bed_forecast['forecast_dates'], bed_forecast['forecasts']):
        print(f"     {date}: {forecast}%")
    
    # Example 2: Medicine Shortage Forecast
    print("\n\n2. Medicine Stock Forecast")
    print("-" * 60)
    
    daily_consumption = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115]
    case_forecast = [45, 48, 50, 52, 55, 58, 60]
    
    medicine_forecast = forecaster.forecast_medicine_shortage(
        current_stock=500,
        daily_consumption=daily_consumption,
        disease_case_forecast=case_forecast,
        medicine_name='Paracetamol'
    )
    
    print(f"   Medicine: {medicine_forecast['medicine_name']}")
    print(f"   Current Stock: {medicine_forecast['current_stock']} units")
    print(f"   Minimum Stock (7 days): {medicine_forecast['minimum_stock']} units")
    print(f"   Days Until Shortage: {medicine_forecast['days_until_shortage']}")
    print(f"   Risk Level: {medicine_forecast['risk_level']}")
    print(f"   Recommended Order: {medicine_forecast['recommended_order']} units")
    print(f"\n   7-Day Stock Forecast:")
    for date, stock in zip(medicine_forecast['forecast_dates'], 
                          medicine_forecast['forecasted_stock_levels']):
        print(f"     {date}: {stock} units")
    
    # Example 3: Fallback with Limited Data
    print("\n\n3. Fallback Forecast (Limited Data)")
    print("-" * 60)
    
    limited_data = [60, 62, 65]
    fallback_forecast = forecaster.forecast_bed_occupancy(
        historical_bed_usage=limited_data,
        disease_case_trend=[20, 22, 25],
        disease_type='covid'
    )
    
    print(f"   Data Quality: {fallback_forecast['data_quality']}")
    print(f"   Method: {fallback_forecast['method']}")
    if 'warning' in fallback_forecast:
        print(f"   ⚠️  Warning: {fallback_forecast['warning']}")
    print(f"   Forecast: {fallback_forecast['forecasts']}")
    
    print("\n" + "=" * 60)
    print("Forecasting Complete!")
    print("=" * 60)
