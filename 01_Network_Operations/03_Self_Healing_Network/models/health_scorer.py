"""
Device/Service Health Scoring
Weighted multi-metric health calculation
"""

import numpy as np
from typing import Dict, List
from dataclasses import dataclass


@dataclass
class HealthScore:
    """Device health score"""
    overall_score: float  # 0-100
    component_scores: Dict[str, float]
    trend: str  # improving, stable, degrading
    risk_level: str  # low, medium, high, critical


class HealthScorer:
    """Calculate weighted health scores"""
    
    def __init__(self):
        # Default weights
        self.weights = {
            'cpu': 0.20,
            'memory': 0.15,
            'interface_health': 0.25,
            'bgp_health': 0.20,
            'error_rate': 0.20
        }
        self.history = []
        self.max_history = 100

    def calculate_health(self, metrics: Dict[str, float]) -> HealthScore:
        """Calculate overall device health"""
        
        # Calculate component scores (0-100, higher is better)
        cpu_score = self._score_cpu(metrics.get('cpu_percent', 0))
        memory_score = self._score_memory(metrics.get('memory_percent', 0))
        interface_score = self._score_interface(metrics.get('interface_errors', 0), 
                                                metrics.get('packet_loss_percent', 0),
                                                metrics.get('link_utilization_percent', 50))
        bgp_score = self._score_bgp(metrics.get('bgp_neighbors_up', 8), 
                                    metrics.get('bgp_neighbors_down', 0))
        error_score = self._score_errors(metrics.get('interface_errors', 0),
                                        metrics.get('packet_loss_percent', 0))
        
        component_scores = {
            'cpu': cpu_score,
            'memory': memory_score,
            'interface_health': interface_score,
            'bgp_health': bgp_score,
            'error_rate': error_score
        }
        
        # Weighted sum
        overall = (
            self.weights['cpu'] * cpu_score +
            self.weights['memory'] * memory_score +
            self.weights['interface_health'] * interface_score +
            self.weights['bgp_health'] * bgp_score +
            self.weights['error_rate'] * error_score
        )
        
        # Track history
        self.history.append(overall)
        if len(self.history) > self.max_history:
            self.history.pop(0)
        
        # Determine trend
        trend = self._calculate_trend()
        
        # Risk level
        risk = self._calculate_risk(overall)
        
        return HealthScore(
            overall_score=overall,
            component_scores=component_scores,
            trend=trend,
            risk_level=risk
        )

    def _score_cpu(self, cpu_percent: float) -> float:
        """Score CPU health (0-100)"""
        if cpu_percent < 50:
            return 100
        elif cpu_percent < 70:
            return 100 - (cpu_percent - 50) * 2  # 100 to 60
        elif cpu_percent < 85:
            return 60 - (cpu_percent - 70) * 2.67  # 60 to 20
        else:
            return max(0, 20 - (cpu_percent - 85) * 4)

    def _score_memory(self, memory_percent: float) -> float:
        """Score memory health (0-100)"""
        if memory_percent < 60:
            return 100
        elif memory_percent < 75:
            return 100 - (memory_percent - 60) * 2.67  # 100 to 60
        elif memory_percent < 90:
            return 60 - (memory_percent - 75) * 2.67  # 60 to 20
        else:
            return max(0, 20 - (memory_percent - 90) * 4)

    def _score_interface(self, errors: int, packet_loss: float, utilization: float) -> float:
        """Score interface health (0-100)"""
        error_score = max(0, 100 - errors / 10)  # 1000 errors = 0
        loss_score = max(0, 100 - packet_loss * 5)  # 20% loss = 0
        util_score = 100 if utilization < 85 else max(0, 100 - (utilization - 85) * 4)
        
        return (error_score * 0.4 + loss_score * 0.4 + util_score * 0.2)

    def _score_bgp(self, neighbors_up: int, neighbors_down: int) -> float:
        """Score BGP health (0-100)"""
        if neighbors_down == 0:
            return 100
        elif neighbors_down == 1:
            return 80
        elif neighbors_down == 2:
            return 50
        else:
            return max(0, 50 - neighbors_down * 10)

    def _score_errors(self, errors: int, packet_loss: float) -> float:
        """Score error rate (0-100)"""
        error_score = max(0, 100 - errors / 5)  # 500 errors = 0
        loss_score = max(0, 100 - packet_loss * 3)  # 33% loss = 0
        return (error_score + loss_score) / 2

    def _calculate_trend(self) -> str:
        """Calculate health trend"""
        if len(self.history) < 5:
            return "stable"
        
        recent = np.mean(self.history[-5:])
        older = np.mean(self.history[-20:-5]) if len(self.history) >= 20 else np.mean(self.history[:-5])
        
        diff = recent - older
        
        if diff > 5:
            return "improving"
        elif diff < -5:
            return "degrading"
        else:
            return "stable"

    def _calculate_risk(self, health_score: float) -> str:
        """Calculate risk level based on health score"""
        if health_score >= 80:
            return "low"
        elif health_score >= 60:
            return "medium"
        elif health_score >= 40:
            return "high"
        else:
            return "critical"

    def adaptive_weights(self, incident_history: List[Dict]) -> None:
        """
        Adapt weights based on historical incidents
        (Simplified: boost weight of metrics that precede incidents)
        """
        if not incident_history:
            return
        
        # In production, this would analyze which metrics best predict incidents
        # For now, slightly boost interface and error metrics
        total_weight = sum(self.weights.values())
        self.weights['interface_health'] *= 1.1
        self.weights['error_rate'] *= 1.05
        
        # Renormalize
        new_total = sum(self.weights.values())
        for key in self.weights:
            self.weights[key] = self.weights[key] / new_total * total_weight
