"""
Failure Prediction using Logistic Regression (numpy-based)
Predicts probability of device failure in 1h, 4h, 24h windows
"""

import numpy as np
from typing import Dict, Tuple, List
from dataclasses import dataclass


@dataclass
class FailurePrediction:
    """Failure prediction result"""
    failure_probability_1h: float
    failure_probability_4h: float
    failure_probability_24h: float
    risk_factors: List[Tuple[str, float]]
    recommendation: str


class LogisticRegressionPredictor:
    """Simple logistic regression for failure prediction"""
    
    def __init__(self):
        # Pre-trained weights (simplified)
        self.weights = {
            'error_rate_trend': 0.8,
            'cpu_trend': 0.6,
            'memory_trend': 0.5,
            'bgp_stability': -0.7,
            'interface_stability': -0.6
        }
        self.bias = -2.0
        self.history = []
        self.window_size = 20

    def add_metrics(self, metrics: Dict[str, float]) -> None:
        """Add metrics to training history"""
        self.history.append(metrics)
        if len(self.history) > self.window_size:
            self.history.pop(0)

    def _extract_features(self, metrics: Dict[str, float]) -> Dict[str, float]:
        """Extract features for prediction"""
        
        features = {
            'error_rate_trend': 0.0,
            'cpu_trend': 0.0,
            'memory_trend': 0.0,
            'bgp_stability': 1.0,
            'interface_stability': 1.0
        }
        
        # Calculate trends
        if len(self.history) >= 5:
            recent_errors = np.mean([m.get('interface_errors', 0) for m in self.history[-5:]])
            older_errors = np.mean([m.get('interface_errors', 0) for m in self.history[-10:-5]])
            features['error_rate_trend'] = min(1.0, (recent_errors - older_errors) / max(older_errors, 1))
            
            recent_cpu = np.mean([m.get('cpu_percent', 0) for m in self.history[-5:]])
            older_cpu = np.mean([m.get('cpu_percent', 0) for m in self.history[-10:-5]])
            features['cpu_trend'] = min(1.0, (recent_cpu - older_cpu) / 100)
            
            recent_mem = np.mean([m.get('memory_percent', 0) for m in self.history[-5:]])
            older_mem = np.mean([m.get('memory_percent', 0) for m in self.history[-10:-5]])
            features['memory_trend'] = min(1.0, (recent_mem - older_mem) / 100)
        
        # BGP stability
        if metrics.get('bgp_neighbors_down', 0) > 0:
            features['bgp_stability'] = 1.0 - min(1.0, metrics.get('bgp_neighbors_down', 0) / 4)
        
        # Interface stability
        if metrics.get('interface_errors', 0) > 100:
            features['interface_stability'] = 1.0 - min(1.0, metrics.get('interface_errors', 0) / 1000)
        
        return features

    def _sigmoid(self, x: float) -> float:
        """Sigmoid function"""
        return 1.0 / (1.0 + np.exp(-min(max(x, -500), 500)))

    def predict(self, metrics: Dict[str, float]) -> FailurePrediction:
        """Predict failure probability"""
        
        self.add_metrics(metrics)
        features = self._extract_features(metrics)
        
        # Simple logistic regression: P = sigmoid(w*x + b)
        z = self.bias
        for feature_name, weight in self.weights.items():
            z += weight * features.get(feature_name, 0)
        
        base_prob = self._sigmoid(z)
        
        # Time-window adjusted probabilities
        prob_1h = base_prob * 0.6
        prob_4h = base_prob * 1.0
        prob_24h = min(1.0, base_prob * 1.5)
        
        # Calculate risk factors
        risk_factors = []
        for feature_name, value in features.items():
            weight = self.weights.get(feature_name, 0)
            contribution = abs(weight * value)
            if contribution > 0.1:
                risk_factors.append((feature_name, contribution))
        
        risk_factors.sort(key=lambda x: x[1], reverse=True)
        
        # Generate recommendation
        recommendation = self._generate_recommendation(prob_4h, risk_factors)
        
        return FailurePrediction(
            failure_probability_1h=prob_1h,
            failure_probability_4h=prob_4h,
            failure_probability_24h=prob_24h,
            risk_factors=risk_factors[:3],
            recommendation=recommendation
        )

    def _generate_recommendation(self, probability: float, risk_factors: List[Tuple[str, float]]) -> str:
        """Generate action recommendation"""
        
        if probability < 0.3:
            return "No immediate action required. Continue monitoring."
        elif probability < 0.6:
            base = "Increased risk detected. Schedule maintenance window within 4-8 hours."
            if risk_factors:
                return base + f" Focus on: {risk_factors[0][0].replace('_', ' ')}"
            return base
        else:
            base = "High failure probability. Take immediate action or escalate."
            if risk_factors:
                return base + f" Critical factor: {risk_factors[0][0].replace('_', ' ')}"
            return base

    def fit(self, training_data: List[Tuple[Dict[str, float], bool]]) -> None:
        """
        Simple training (not full gradient descent, just weight adjustment)
        training_data: list of (metrics_dict, failed_bool)
        """
        if not training_data:
            return
        
        # Calculate feature means for failed and healthy devices
        failed_features = []
        healthy_features = []
        
        for metrics, failed in training_data:
            features_vec = self._extract_features(metrics)
            if failed:
                failed_features.append(features_vec)
            else:
                healthy_features.append(features_vec)
        
        if not failed_features or not healthy_features:
            return
        
        # Adjust weights based on differences
        for feature_name in self.weights.keys():
            failed_mean = np.mean([f.get(feature_name, 0) for f in failed_features])
            healthy_mean = np.mean([f.get(feature_name, 0) for f in healthy_features])
            
            diff = failed_mean - healthy_mean
            if abs(diff) > 0.1:
                self.weights[feature_name] += diff * 0.1
