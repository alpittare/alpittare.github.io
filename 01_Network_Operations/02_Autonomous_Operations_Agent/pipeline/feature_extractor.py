"""Feature Extraction - Extract features from raw telemetry"""

import numpy as np
from typing import Dict, Any, List


class FeatureExtractor:
    """Extract and engineer features from raw telemetry"""

    @staticmethod
    def extract_time_domain_features(values: List[float]) -> Dict[str, float]:
        """Extract time-domain statistics"""
        if not values:
            return {}

        return {
            'mean': float(np.mean(values)),
            'std': float(np.std(values)),
            'min': float(np.min(values)),
            'max': float(np.max(values)),
            'range': float(np.max(values) - np.min(values)),
            'median': float(np.median(values)),
            'q25': float(np.percentile(values, 25)),
            'q75': float(np.percentile(values, 75)),
            'skew': float(self._skewness(values)),
            'kurtosis': float(self._kurtosis(values))
        }

    @staticmethod
    def _skewness(values: List[float]) -> float:
        """Calculate skewness"""
        mean = np.mean(values)
        std = np.std(values)
        if std == 0:
            return 0.0
        return float(np.mean(((np.array(values) - mean) / std) ** 3))

    @staticmethod
    def _kurtosis(values: List[float]) -> float:
        """Calculate kurtosis"""
        mean = np.mean(values)
        std = np.std(values)
        if std == 0:
            return 0.0
        return float(np.mean(((np.array(values) - mean) / std) ** 4) - 3)

    @staticmethod
    def calculate_rate_of_change(values: List[float]) -> List[float]:
        """Calculate rate of change"""
        if len(values) < 2:
            return [0.0]
        return [values[i+1] - values[i] for i in range(len(values)-1)]

    @staticmethod
    def calculate_acceleration(values: List[float]) -> List[float]:
        """Calculate acceleration (second derivative)"""
        roc = FeatureExtractor.calculate_rate_of_change(values)
        return FeatureExtractor.calculate_rate_of_change(roc)

    @staticmethod
    def extract_anomaly_context(telemetry_sample: Dict[str, Any]) -> Dict[str, float]:
        """Extract contextual features for anomaly detection"""
        return {
            'cpu_memory_ratio': telemetry_sample.get('cpu_utilization', 0) / 
                               (telemetry_sample.get('memory_utilization', 1) + 0.1),
            'error_rate': telemetry_sample.get('interface_errors', 0) + 
                         telemetry_sample.get('interface_crc', 0),
            'stability_score': 100 - (telemetry_sample.get('bgp_neighbor_flaps', 0) * 10),
            'latency_jitter_ratio': (telemetry_sample.get('jitter_ms', 0.1) / 
                                     (telemetry_sample.get('latency_ms', 1) + 0.1)),
            'loss_severity': telemetry_sample.get('packet_loss_percent', 0) * 
                            (1 + telemetry_sample.get('latency_ms', 0) / 100)
        }
