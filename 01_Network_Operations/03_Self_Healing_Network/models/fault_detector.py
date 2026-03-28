"""
ML-based Fault Detection using multiple methods:
- Z-score anomaly detection
- EWMA (Exponential Weighted Moving Average) drift detection
- Statistical thresholding
"""

import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from enum import Enum


class AnomalyLevel(Enum):
    NORMAL = 0
    WARNING = 1
    CRITICAL = 2


@dataclass
class AnomalyDetectionResult:
    """Result of anomaly detection"""
    timestamp: str
    metric_name: str
    current_value: float
    baseline: float
    zscore: float
    anomaly_level: AnomalyLevel
    confidence: float
    detection_method: str


class ZScoreDetector:
    """Z-score based anomaly detection"""
    
    def __init__(self, threshold_warning: float = 2.0, threshold_critical: float = 3.0):
        self.threshold_warning = threshold_warning
        self.threshold_critical = threshold_critical
        self.history = []
        self.window_size = 50

    def add_value(self, value: float) -> None:
        """Add value to history"""
        self.history.append(value)
        if len(self.history) > self.window_size:
            self.history.pop(0)

    def detect(self, value: float) -> Tuple[float, AnomalyLevel, float]:
        """
        Detect anomaly using Z-score
        Returns: (zscore, anomaly_level, confidence)
        """
        if len(self.history) < 3:
            return 0.0, AnomalyLevel.NORMAL, 0.0
        
        mean = np.mean(self.history)
        std = np.std(self.history)
        
        if std < 0.001:  # Avoid division by zero
            return 0.0, AnomalyLevel.NORMAL, 0.0
        
        zscore = abs((value - mean) / std)
        
        confidence = min(len(self.history) / self.window_size, 1.0)
        
        if zscore >= self.threshold_critical:
            return zscore, AnomalyLevel.CRITICAL, confidence
        elif zscore >= self.threshold_warning:
            return zscore, AnomalyLevel.WARNING, confidence
        else:
            return zscore, AnomalyLevel.NORMAL, confidence


class EWMADetector:
    """Exponential Weighted Moving Average drift detection"""
    
    def __init__(self, alpha: float = 0.2, threshold: float = 2.0):
        """
        alpha: smoothing factor (0-1), higher = more weight to recent values
        threshold: deviation threshold in standard deviations
        """
        self.alpha = alpha
        self.threshold = threshold
        self.ewma = None
        self.ewvar = None
        self.history = []

    def add_value(self, value: float) -> None:
        """Add value and update EWMA"""
        self.history.append(value)
        
        if self.ewma is None:
            self.ewma = value
            self.ewvar = 0.0
        else:
            # Update variance
            residual = value - self.ewma
            self.ewvar = self.alpha * (residual ** 2) + (1 - self.alpha) * self.ewvar
            
            # Update mean
            self.ewma = self.alpha * value + (1 - self.alpha) * self.ewma

    def detect(self, value: float) -> Tuple[float, AnomalyLevel, float]:
        """
        Detect drift using EWMA
        Returns: (deviation, anomaly_level, confidence)
        """
        if self.ewma is None:
            return 0.0, AnomalyLevel.NORMAL, 0.0
        
        ewstd = np.sqrt(max(self.ewvar, 0.001))
        deviation = abs((value - self.ewma) / ewstd) if ewstd > 0 else 0
        
        confidence = min(len(self.history) / 20, 1.0)
        
        if deviation >= self.threshold * 1.5:
            return deviation, AnomalyLevel.CRITICAL, confidence
        elif deviation >= self.threshold:
            return deviation, AnomalyLevel.WARNING, confidence
        else:
            return deviation, AnomalyLevel.NORMAL, confidence


class FaultDetector:
    """Multi-method fault detection"""
    
    def __init__(self):
        self.zscore_detectors = {}
        self.ewma_detectors = {}
        self.metric_thresholds = {
            'cpu_percent': (70, 85),
            'memory_percent': (75, 90),
            'interface_errors': (100, 500),
            'packet_loss_percent': (5, 20),
            'bgp_neighbors_down': (2, 4),
            'link_utilization_percent': (85, 95)
        }

    def _get_or_create_detector(self, metric_name: str):
        """Get or create Z-score detector for metric"""
        if metric_name not in self.zscore_detectors:
            self.zscore_detectors[metric_name] = ZScoreDetector()
            self.ewma_detectors[metric_name] = EWMADetector()
        
        return self.zscore_detectors[metric_name], self.ewma_detectors[metric_name]

    def add_metric(self, metric_name: str, value: float) -> None:
        """Add metric value to detectors"""
        zscore_det, ewma_det = self._get_or_create_detector(metric_name)
        zscore_det.add_value(value)
        ewma_det.add_value(value)

    def detect_anomaly(self, timestamp: str, metric_name: str, value: float) -> Optional[AnomalyDetectionResult]:
        """
        Detect anomalies using multiple methods
        Returns: AnomalyDetectionResult or None
        """
        self.add_metric(metric_name, value)
        
        zscore_det, ewma_det = self._get_or_create_detector(metric_name)
        
        # Z-score detection
        zscore, zscore_level, zscore_conf = zscore_det.detect(value)
        
        # EWMA detection
        ewma_dev, ewma_level, ewma_conf = ewma_det.detect(value)
        
        # Threshold-based detection
        threshold_level = AnomalyLevel.NORMAL
        threshold_conf = 0.0
        
        if metric_name in self.metric_thresholds:
            warning_thresh, critical_thresh = self.metric_thresholds[metric_name]
            
            if value >= critical_thresh:
                threshold_level = AnomalyLevel.CRITICAL
                threshold_conf = 0.9
            elif value >= warning_thresh:
                threshold_level = AnomalyLevel.WARNING
                threshold_conf = 0.7
        
        # Combine results (use highest severity)
        anomaly_levels = [zscore_level, ewma_level, threshold_level]
        max_level = max(anomaly_levels, key=lambda x: x.value)
        
        if max_level == AnomalyLevel.NORMAL:
            return None
        
        # Use the detection method with highest confidence
        if zscore_level.value >= max_level.value and zscore_conf > 0.5:
            method = "zscore"
            conf = zscore_conf
        elif ewma_level.value >= max_level.value and ewma_conf > 0.5:
            method = "ewma"
            conf = ewma_conf
        else:
            method = "threshold"
            conf = threshold_conf
        
        baseline = np.mean(zscore_det.history) if zscore_det.history else value
        
        return AnomalyDetectionResult(
            timestamp=timestamp,
            metric_name=metric_name,
            current_value=value,
            baseline=baseline,
            zscore=zscore,
            anomaly_level=max_level,
            confidence=min(1.0, conf),
            detection_method=method
        )

    def get_all_anomalies(self, timestamp: str, metrics: Dict[str, float]) -> List[AnomalyDetectionResult]:
        """Detect anomalies in all metrics"""
        anomalies = []
        
        for metric_name, value in metrics.items():
            result = self.detect_anomaly(timestamp, metric_name, value)
            if result:
                anomalies.append(result)
        
        return anomalies
