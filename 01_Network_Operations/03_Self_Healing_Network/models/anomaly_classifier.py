"""
Fault Type Classification using simple decision tree (numpy-based)
Classifies detected anomalies into fault categories
"""

import numpy as np
from typing import Dict, List, Tuple
from enum import Enum
from dataclasses import dataclass


class FaultClass(Enum):
    """Fault classification types"""
    INTERFACE_DOWN = "interface_down"
    BGP_FLAP = "bgp_flap"
    INTERFACE_FLAP = "interface_flap"
    HIGH_CPU = "high_cpu"
    LINK_ERROR = "link_error"
    PACKET_LOSS = "packet_loss"
    STP_LOOP = "stp_loop"
    UNKNOWN = "unknown"


@dataclass
class ClassificationResult:
    """Result of fault classification"""
    fault_class: FaultClass
    confidence: float
    feature_importance: Dict[str, float]
    reasoning: str


class SimpleDecisionTree:
    """Simple decision tree classifier using numpy"""
    
    def __init__(self):
        self.feature_names = [
            'cpu_percent', 'memory_percent', 'interface_errors',
            'packet_loss_percent', 'bgp_neighbors_down', 'stp_blocked_ports',
            'link_utilization_percent', 'bgp_neighbors_up'
        ]

    def classify(self, features: Dict[str, float]) -> Tuple[FaultClass, float, Dict[str, float]]:
        """
        Classify fault using decision tree logic
        Returns: (fault_class, confidence, feature_importance)
        """
        
        # Extract features
        cpu = features.get('cpu_percent', 0)
        memory = features.get('memory_percent', 0)
        iface_errors = features.get('interface_errors', 0)
        packet_loss = features.get('packet_loss_percent', 0)
        bgp_down = features.get('bgp_neighbors_down', 0)
        stp_blocked = features.get('stp_blocked_ports', 0)
        link_util = features.get('link_utilization_percent', 0)
        bgp_up = features.get('bgp_neighbors_up', 8)
        
        scores = {}
        importances = {}
        
        # Decision tree logic
        
        # 1. STP Loop detection
        if stp_blocked >= 3:
            scores[FaultClass.STP_LOOP] = 0.95
            importances['stp_blocked_ports'] = 0.9
            importances['interface_errors'] = 0.8 if iface_errors > 1000 else 0.3
        
        # 2. High CPU
        if cpu >= 80 and memory >= 60:
            scores[FaultClass.HIGH_CPU] = 0.90
            importances['cpu_percent'] = 0.95
            importances['memory_percent'] = 0.85
        
        # 3. BGP Flap
        if bgp_down >= 3 or (bgp_up < 6 and packet_loss > 15):
            scores[FaultClass.BGP_FLAP] = 0.88
            importances['bgp_neighbors_down'] = 0.95
            importances['packet_loss_percent'] = 0.70
        
        # 4. Interface Down (zero utilization + high errors)
        if link_util < 1 and iface_errors > 100:
            scores[FaultClass.INTERFACE_DOWN] = 0.92
            importances['link_utilization_percent'] = 0.95
            importances['interface_errors'] = 0.85
        
        # 5. Interface Flap (high errors, variable utilization)
        if iface_errors > 500 and packet_loss > 10:
            scores[FaultClass.INTERFACE_FLAP] = 0.85
            importances['interface_errors'] = 0.90
            importances['packet_loss_percent'] = 0.75
        
        # 6. Packet Loss
        if packet_loss > 20 and iface_errors < 200:
            scores[FaultClass.PACKET_LOSS] = 0.80
            importances['packet_loss_percent'] = 0.95
            importances['link_utilization_percent'] = 0.60
        
        # 7. Link Errors
        if iface_errors > 200:
            scores[FaultClass.LINK_ERROR] = 0.75
            importances['interface_errors'] = 0.95
        
        # Find best classification
        if not scores:
            return FaultClass.UNKNOWN, 0.0, {}
        
        best_class = max(scores.keys(), key=lambda x: scores[x])
        best_score = scores[best_class]
        
        # Normalize importances
        if importances:
            max_importance = max(importances.values())
            if max_importance > 0:
                importances = {k: v / max_importance for k, v in importances.items()}
        
        return best_class, best_score, importances


class FaultClassifier:
    """Fault classification engine"""
    
    def __init__(self):
        self.tree = SimpleDecisionTree()
        self.history = []

    def classify(self, metrics: Dict[str, float]) -> ClassificationResult:
        """Classify fault from metrics"""
        
        fault_class, confidence, importances = self.tree.classify(metrics)
        
        # Generate reasoning
        reasoning = self._generate_reasoning(fault_class, metrics, importances)
        
        result = ClassificationResult(
            fault_class=fault_class,
            confidence=confidence,
            feature_importance=importances,
            reasoning=reasoning
        )
        
        self.history.append(result)
        return result

    def _generate_reasoning(self, fault_class: FaultClass, metrics: Dict[str, float], 
                           importances: Dict[str, float]) -> str:
        """Generate human-readable reasoning"""
        
        reasoning_map = {
            FaultClass.INTERFACE_DOWN: f"Interface down detected: link utilization {metrics.get('link_utilization_percent', 0):.1f}%, errors {metrics.get('interface_errors', 0)}",
            FaultClass.BGP_FLAP: f"BGP session instability: {metrics.get('bgp_neighbors_down', 0)} neighbors down, packet loss {metrics.get('packet_loss_percent', 0):.1f}%",
            FaultClass.INTERFACE_FLAP: f"Interface flapping detected: {metrics.get('interface_errors', 0)} errors, {metrics.get('packet_loss_percent', 0):.1f}% loss",
            FaultClass.HIGH_CPU: f"High CPU detected: {metrics.get('cpu_percent', 0):.1f}%, memory {metrics.get('memory_percent', 0):.1f}%",
            FaultClass.LINK_ERROR: f"Link errors detected: {metrics.get('interface_errors', 0)} errors on interface",
            FaultClass.PACKET_LOSS: f"Packet loss detected: {metrics.get('packet_loss_percent', 0):.1f}% loss rate",
            FaultClass.STP_LOOP: f"STP loop detected: {metrics.get('stp_blocked_ports', 0)} blocked ports, {metrics.get('interface_errors', 0)} errors",
            FaultClass.UNKNOWN: "No clear fault pattern detected"
        }
        
        return reasoning_map.get(fault_class, f"Fault class: {fault_class.value}")

    def get_top_features(self, result: ClassificationResult, top_k: int = 3) -> List[Tuple[str, float]]:
        """Get top contributing features for classification"""
        sorted_features = sorted(result.feature_importance.items(), key=lambda x: x[1], reverse=True)
        return sorted_features[:top_k]
