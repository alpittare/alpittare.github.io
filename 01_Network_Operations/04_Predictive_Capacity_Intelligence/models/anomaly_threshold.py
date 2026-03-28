"""
Dynamic anomaly detection and adaptive capacity threshold alerting.
"""
import numpy as np
from typing import Dict, List, Tuple
import logging

logger = logging.getLogger(__name__)


class AnomalyDetector:
    """
    Detect anomalies in time series using z-score and context-aware thresholds.
    """

    def __init__(self, zscore_threshold: float = 2.5):
        """
        Initialize anomaly detector.
        
        Args:
            zscore_threshold: Z-score threshold for anomaly detection
        """
        self.zscore_threshold = zscore_threshold
        self.mean = None
        self.std = None

    def fit(self, series: np.ndarray) -> 'AnomalyDetector':
        """Fit detector to historical data."""
        self.mean = np.mean(series)
        self.std = np.std(series)
        return self

    def detect(self, series: np.ndarray) -> Dict:
        """
        Detect anomalies using z-score method.
        
        Args:
            series: Time series to check
        
        Returns:
            Dictionary with anomaly indices and flags
        """
        if self.mean is None or self.std is None:
            self.fit(series)
        
        z_scores = np.abs((series - self.mean) / (self.std + 1e-10))
        anomalies = z_scores > self.zscore_threshold
        
        result = {
            'anomaly_indices': np.where(anomalies)[0].tolist(),
            'anomaly_flags': anomalies,
            'z_scores': z_scores,
            'threshold': self.zscore_threshold,
            'n_anomalies': np.sum(anomalies)
        }
        
        return result

    def detect_seasonal_anomalies(self, series: np.ndarray, 
                                  seasonal_period: int = 288) -> Dict:
        """
        Detect anomalies within seasonal context.
        
        Args:
            series: Time series
            seasonal_period: Period of seasonality (e.g., 288 for daily in 5-min intervals)
        
        Returns:
            Anomaly detection results
        """
        anomalies = []
        
        for i in range(len(series)):
            # Get seasonal peers (same time of day/week from other periods)
            peers = []
            for j in range(seasonal_period, len(series), seasonal_period):
                if i - seasonal_period * (j // seasonal_period) >= 0:
                    peer_idx = i - seasonal_period * (j // seasonal_period)
                    if 0 <= peer_idx < len(series):
                        peers.append(series[peer_idx])
            
            if len(peers) > 1:
                peer_mean = np.mean(peers)
                peer_std = np.std(peers)
                z_score = abs((series[i] - peer_mean) / (peer_std + 1e-10))
                
                if z_score > self.zscore_threshold:
                    anomalies.append(i)
        
        result = {
            'seasonal_anomaly_indices': anomalies,
            'n_seasonal_anomalies': len(anomalies),
            'seasonal_period': seasonal_period
        }
        
        return result


class CapacityThresholdAlert:
    """
    Generate dynamic capacity alerts based on forecasts and historical patterns.
    """

    def __init__(self, warning_threshold: float = 0.80, 
                 critical_threshold: float = 0.95):
        """
        Initialize threshold alerter.
        
        Args:
            warning_threshold: Utilization % for warning alert
            critical_threshold: Utilization % for critical alert
        """
        self.warning_threshold = warning_threshold
        self.critical_threshold = critical_threshold
        self.alerts = []

    def check_forecast(self, forecast: np.ndarray, interface: str, 
                      forecast_hours: int = 168) -> Dict:
        """
        Check forecast for capacity threshold breaches.
        
        Args:
            forecast: Forecasted utilization values
            interface: Interface name
            forecast_hours: Number of forecast hours
        
        Returns:
            Dictionary with alert information
        """
        alerts = {
            'interface': interface,
            'forecast_hours': forecast_hours,
            'warnings': [],
            'criticals': [],
            'time_to_warning': None,
            'time_to_critical': None,
            'max_forecast': np.max(forecast),
            'avg_forecast': np.mean(forecast)
        }
        
        for i, utilization in enumerate(forecast):
            hours_ahead = (i + 1) / (len(forecast) / forecast_hours)
            
            if utilization >= self.critical_threshold:
                alerts['criticals'].append({
                    'hours_ahead': hours_ahead,
                    'utilization': utilization
                })
                if alerts['time_to_critical'] is None:
                    alerts['time_to_critical'] = hours_ahead
            
            elif utilization >= self.warning_threshold:
                alerts['warnings'].append({
                    'hours_ahead': hours_ahead,
                    'utilization': utilization
                })
                if alerts['time_to_warning'] is None:
                    alerts['time_to_warning'] = hours_ahead
        
        return alerts

    def adaptive_threshold(self, historical_series: np.ndarray, 
                          seasonal_period: int = 288) -> Dict:
        """
        Calculate adaptive thresholds based on seasonal patterns.
        
        Args:
            historical_series: Historical utilization data
            seasonal_period: Seasonality period
        
        Returns:
            Dictionary with adaptive thresholds
        """
        # Calculate seasonal patterns
        seasonal_means = []
        seasonal_stds = []
        
        for i in range(seasonal_period):
            indices = np.arange(i, len(historical_series), seasonal_period)
            if len(indices) > 0:
                values = historical_series[indices]
                seasonal_means.append(np.mean(values))
                seasonal_stds.append(np.std(values))
        
        seasonal_means = np.array(seasonal_means)
        seasonal_stds = np.array(seasonal_stds)
        
        # Adaptive thresholds: mean + 2*std for warning, mean + 3*std for critical
        adaptive_warning = seasonal_means + 2 * seasonal_stds
        adaptive_critical = seasonal_means + 3 * seasonal_stds
        
        # Ensure realistic bounds
        adaptive_warning = np.clip(adaptive_warning, self.warning_threshold * 100, 95)
        adaptive_critical = np.clip(adaptive_critical, self.critical_threshold * 100, 100)
        
        result = {
            'seasonal_means': seasonal_means,
            'seasonal_stds': seasonal_stds,
            'adaptive_warning_thresholds': adaptive_warning,
            'adaptive_critical_thresholds': adaptive_critical,
            'static_warning': self.warning_threshold * 100,
            'static_critical': self.critical_threshold * 100
        }
        
        return result

    def generate_alert(self, interface: str, current_util: float, 
                      forecasted_util: float, severity: str) -> Dict:
        """
        Generate a capacity alert.
        
        Args:
            interface: Interface name
            current_util: Current utilization %
            forecasted_util: Forecasted utilization %
            severity: 'warning' or 'critical'
        
        Returns:
            Alert dictionary
        """
        alert = {
            'interface': interface,
            'severity': severity,
            'current_utilization': current_util,
            'forecasted_utilization': forecasted_util,
            'timestamp': np.datetime64('now'),
            'recommendation': self._get_recommendation(interface, forecasted_util, severity)
        }
        
        self.alerts.append(alert)
        return alert

    @staticmethod
    def _get_recommendation(interface: str, forecasted_util: float, severity: str) -> str:
        """Generate capacity upgrade recommendation."""
        if severity == 'critical' and forecasted_util > 95:
            return f"URGENT: {interface} forecast exceeds 95%. Increase interface speed or add parallel links immediately."
        elif severity == 'warning':
            return f"CAUTION: {interface} approaching capacity. Plan bandwidth upgrade within 2 weeks."
        else:
            return f"Monitor {interface} utilization trends. No immediate action required."

    def summary(self) -> Dict:
        """Get summary of all alerts."""
        if not self.alerts:
            return {'total_alerts': 0, 'warnings': 0, 'criticals': 0, 'affected_interfaces': []}
        
        warnings = [a for a in self.alerts if a['severity'] == 'warning']
        criticals = [a for a in self.alerts if a['severity'] == 'critical']
        interfaces = list(set(a['interface'] for a in self.alerts))
        
        return {
            'total_alerts': len(self.alerts),
            'warnings': len(warnings),
            'criticals': len(criticals),
            'affected_interfaces': interfaces
        }
