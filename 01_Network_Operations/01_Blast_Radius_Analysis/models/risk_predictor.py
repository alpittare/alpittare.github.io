"""
Risk prediction models for network changes.

Implements logistic regression and decision tree classifiers
trained on change complexity features to predict blast radius risk.
"""

import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class ChangeRequest:
    """Represents a network change request."""
    change_id: str
    device_id: str
    change_type: str  # interface_down, bgp_change, vlan_change, config_update
    severity: str  # low, medium, high, critical
    affected_services: List[str]
    affected_nodes: List[str]
    change_complexity: float  # 0.0 to 1.0
    estimated_duration: float  # minutes
    rollback_capability: bool
    maintenance_window: bool
    dependencies_count: int


class LogisticRegression:
    """
    Logistic Regression classifier trained with gradient descent.
    
    Model: P(y=1|x) = sigmoid(w·x + b)
    Loss: Binary cross-entropy
    """
    
    def __init__(self, learning_rate: float = 0.01, max_iterations: int = 1000):
        """
        Initialize logistic regression.
        
        Args:
            learning_rate: Gradient descent step size
            max_iterations: Maximum training iterations
        """
        self.learning_rate = learning_rate
        self.max_iterations = max_iterations
        self.weights = None
        self.bias = None
        self.history = []
    
    def sigmoid(self, z: np.ndarray) -> np.ndarray:
        """
        Sigmoid activation function.
        
        σ(z) = 1 / (1 + e^(-z))
        
        Args:
            z: Input array
            
        Returns:
            Sigmoid of z
        """
        return 1.0 / (1.0 + np.exp(-np.clip(z, -500, 500)))
    
    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        """
        Train logistic regression using gradient descent.
        
        Gradient of loss w.r.t. weights:
        dL/dw = (1/m) * X^T * (y_pred - y)
        dL/db = (1/m) * Σ(y_pred - y)
        
        Args:
            X: Feature matrix (n_samples, n_features)
            y: Binary labels (n_samples,)
        """
        m, n_features = X.shape
        self.weights = np.zeros(n_features)
        self.bias = 0.0
        
        for iteration in range(self.max_iterations):
            # Forward pass
            z = X @ self.weights + self.bias
            y_pred = self.sigmoid(z)
            
            # Compute loss (binary cross-entropy)
            loss = -np.mean(y * np.log(y_pred + 1e-15) + 
                           (1 - y) * np.log(1 - y_pred + 1e-15))
            self.history.append(loss)
            
            # Compute gradients
            dz = y_pred - y
            dw = (1 / m) * (X.T @ dz)
            db = (1 / m) * np.sum(dz)
            
            # Update weights and bias
            self.weights -= self.learning_rate * dw
            self.bias -= self.learning_rate * db
            
            if (iteration + 1) % 100 == 0:
                logger.debug(f"Iteration {iteration + 1}, Loss: {loss:.4f}")
        
        logger.info(f"Logistic regression trained in {self.max_iterations} iterations")
    
    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """
        Predict probability of positive class.
        
        Args:
            X: Feature matrix
            
        Returns:
            Probability array (0.0 to 1.0)
        """
        z = X @ self.weights + self.bias
        return self.sigmoid(z)
    
    def predict(self, X: np.ndarray, threshold: float = 0.5) -> np.ndarray:
        """
        Predict binary class.
        
        Args:
            X: Feature matrix
            threshold: Decision threshold
            
        Returns:
            Binary predictions
        """
        return (self.predict_proba(X) >= threshold).astype(int)


class DecisionTree:
    """
    Decision tree classifier for risk prediction.
    
    Builds a binary tree by recursively splitting on features
    that maximize information gain.
    """
    
    def __init__(self, max_depth: int = 5, min_samples_split: int = 2):
        """
        Initialize decision tree.
        
        Args:
            max_depth: Maximum tree depth
            min_samples_split: Minimum samples required to split a node
        """
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.tree = None
    
    def entropy(self, y: np.ndarray) -> float:
        """
        Calculate Shannon entropy of labels.
        
        H(y) = -Σ(p_i * log2(p_i))
        
        Args:
            y: Binary labels
            
        Returns:
            Entropy value
        """
        unique, counts = np.unique(y, return_counts=True)
        probabilities = counts / len(y)
        return -np.sum(probabilities * np.log2(probabilities + 1e-15))
    
    def information_gain(self, parent: np.ndarray, left_child: np.ndarray,
                        right_child: np.ndarray) -> float:
        """
        Calculate information gain from a split.
        
        IG = H(parent) - (|left|/|parent| * H(left) + |right|/|parent| * H(right))
        
        Args:
            parent: Parent node labels
            left_child: Left child labels
            right_child: Right child labels
            
        Returns:
            Information gain
        """
        n_parent = len(parent)
        n_left = len(left_child)
        n_right = len(right_child)
        
        if n_left == 0 or n_right == 0:
            return 0.0
        
        parent_entropy = self.entropy(parent)
        left_entropy = self.entropy(left_child)
        right_entropy = self.entropy(right_child)
        
        weighted_child_entropy = (n_left / n_parent) * left_entropy + \
                                 (n_right / n_parent) * right_entropy
        
        return parent_entropy - weighted_child_entropy
    
    def best_split(self, X: np.ndarray, y: np.ndarray) -> Tuple[Optional[int], Optional[float]]:
        """
        Find best feature and threshold for splitting.
        
        Args:
            X: Feature matrix
            y: Labels
            
        Returns:
            Tuple of (best_feature_idx, best_threshold)
        """
        best_gain = -1.0
        best_feature = None
        best_threshold = None
        
        n_features = X.shape[1]
        
        for feature_idx in range(n_features):
            feature_values = X[:, feature_idx]
            unique_values = np.unique(feature_values)
            
            # Try all unique values as thresholds
            for value in unique_values:
                left_mask = feature_values <= value
                right_mask = feature_values > value
                
                if np.sum(left_mask) == 0 or np.sum(right_mask) == 0:
                    continue
                
                gain = self.information_gain(y, y[left_mask], y[right_mask])
                
                if gain > best_gain:
                    best_gain = gain
                    best_feature = feature_idx
                    best_threshold = value
        
        return best_feature, best_threshold
    
    def build_tree(self, X: np.ndarray, y: np.ndarray, depth: int = 0) -> Dict:
        """
        Recursively build decision tree.
        
        Args:
            X: Feature matrix
            y: Labels
            depth: Current depth
            
        Returns:
            Tree node (dict or leaf value)
        """
        n_samples = len(y)
        n_classes = len(np.unique(y))
        
        # Stopping criteria
        if (depth >= self.max_depth or
            n_samples < self.min_samples_split or
            n_classes == 1):
            # Leaf node: return majority class
            return np.bincount(y).argmax()
        
        # Find best split
        feature_idx, threshold = self.best_split(X, y)
        
        if feature_idx is None:
            # No valid split found
            return np.bincount(y).argmax()
        
        # Recursively build left and right subtrees
        left_mask = X[:, feature_idx] <= threshold
        right_mask = X[:, feature_idx] > threshold
        
        left_tree = self.build_tree(X[left_mask], y[left_mask], depth + 1)
        right_tree = self.build_tree(X[right_mask], y[right_mask], depth + 1)
        
        return {
            'feature': feature_idx,
            'threshold': threshold,
            'left': left_tree,
            'right': right_tree
        }
    
    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        """Train decision tree."""
        self.tree = self.build_tree(X, y)
        logger.info("Decision tree trained")
    
    def predict_sample(self, x: np.ndarray, node: Dict) -> int:
        """Predict single sample by traversing tree."""
        if isinstance(node, (int, np.integer)):
            # Leaf node
            return node
        
        feature = node['feature']
        threshold = node['threshold']
        
        if x[feature] <= threshold:
            return self.predict_sample(x, node['left'])
        else:
            return self.predict_sample(x, node['right'])
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Predict class for multiple samples."""
        return np.array([self.predict_sample(x, self.tree) for x in X])


class RiskPredictor:
    """
    Network change risk prediction using ML models.
    """
    
    def __init__(self):
        """Initialize risk predictor with two models."""
        self.logistic_model = LogisticRegression(learning_rate=0.1, max_iterations=500)
        self.tree_model = DecisionTree(max_depth=6, min_samples_split=5)
        self.feature_names = None
    
    def prepare_features(self, changes: List[ChangeRequest]) -> Tuple[np.ndarray, np.ndarray]:
        """
        Convert change requests to feature vectors and labels.
        
        Features:
        1. Affected services count
        2. Affected nodes count
        3. Change complexity
        4. Estimated duration
        5. Dependencies count
        6. Maintenance window (bool)
        7. Rollback capability (bool)
        
        Label: Risk class (0=low, 1=high)
        
        Args:
            changes: List of ChangeRequest objects
            
        Returns:
            Tuple of (features, labels)
        """
        X = []
        y = []
        
        for change in changes:
            features = [
                float(len(change.affected_services)),
                float(len(change.affected_nodes)),
                change.change_complexity,
                change.estimated_duration,
                float(change.dependencies_count),
                1.0 if change.maintenance_window else 0.0,
                1.0 if change.rollback_capability else 0.0,
            ]
            X.append(features)
            
            # Determine risk label
            if change.severity in ['high', 'critical']:
                y.append(1)
            else:
                y.append(0)
        
        self.feature_names = [
            'affected_services', 'affected_nodes', 'change_complexity',
            'estimated_duration', 'dependencies_count', 'maintenance_window',
            'rollback_capability'
        ]
        
        return np.array(X), np.array(y)
    
    def train(self, changes: List[ChangeRequest]) -> None:
        """Train both models."""
        X, y = self.prepare_features(changes)
        
        # Normalize features
        X_mean = np.mean(X, axis=0)
        X_std = np.std(X, axis=0) + 1e-8
        X_normalized = (X - X_mean) / X_std
        
        self.X_mean = X_mean
        self.X_std = X_std
        
        # Train models
        self.logistic_model.fit(X_normalized, y)
        self.tree_model.fit(X_normalized, y)
        
        logger.info("Risk predictor trained")
    
    def predict_risk(self, change: ChangeRequest) -> Dict[str, float]:
        """
        Predict risk score for a change request.
        
        Returns ensemble prediction combining logistic regression and decision tree.
        
        Args:
            change: ChangeRequest object
            
        Returns:
            Dictionary with risk_score (0.0-1.0) and individual model scores
        """
        # Prepare feature vector
        features = np.array([[
            float(len(change.affected_services)),
            float(len(change.affected_nodes)),
            change.change_complexity,
            change.estimated_duration,
            float(change.dependencies_count),
            1.0 if change.maintenance_window else 0.0,
            1.0 if change.rollback_capability else 0.0,
        ]])
        
        # Normalize
        features_normalized = (features - self.X_mean) / self.X_std
        
        # Get predictions from both models
        lr_proba = self.logistic_model.predict_proba(features_normalized)[0]
        tree_pred = self.tree_model.predict(features_normalized)[0]
        
        # Ensemble: average logistic regression probability with tree prediction
        ensemble_score = 0.7 * lr_proba + 0.3 * float(tree_pred)
        
        return {
            'risk_score': float(ensemble_score),
            'logistic_regression': float(lr_proba),
            'decision_tree': float(tree_pred),
            'severity_estimate': self._score_to_severity(ensemble_score)
        }
    
    def _score_to_severity(self, score: float) -> str:
        """Convert risk score to severity label."""
        if score < 0.25:
            return 'LOW'
        elif score < 0.50:
            return 'MEDIUM'
        elif score < 0.75:
            return 'HIGH'
        else:
            return 'CRITICAL'


def generate_synthetic_training_data(n_samples: int = 200) -> List[ChangeRequest]:
    """
    Generate synthetic training data for risk predictor.
    
    Args:
        n_samples: Number of samples to generate
        
    Returns:
        List of ChangeRequest objects with labels
    """
    changes = []
    
    for i in range(n_samples):
        severity_rand = np.random.random()
        
        # Generate features correlated with severity
        if severity_rand < 0.3:
            # Low risk changes
            severity = 'low'
            complexity = np.random.uniform(0.1, 0.3)
            services = np.random.randint(1, 3)
            nodes = np.random.randint(1, 4)
            duration = np.random.uniform(5, 15)
            dependencies = np.random.randint(0, 3)
        elif severity_rand < 0.7:
            # Medium risk
            severity = 'medium'
            complexity = np.random.uniform(0.3, 0.6)
            services = np.random.randint(2, 5)
            nodes = np.random.randint(3, 8)
            duration = np.random.uniform(15, 45)
            dependencies = np.random.randint(2, 6)
        else:
            # High/Critical risk
            severity = np.random.choice(['high', 'critical'])
            complexity = np.random.uniform(0.6, 1.0)
            services = np.random.randint(5, 12)
            nodes = np.random.randint(8, 16)
            duration = np.random.uniform(45, 120)
            dependencies = np.random.randint(6, 15)
        
        # Ensure services count doesn't exceed available services
        available_services = ['HTTP', 'Database', 'Cache', 'DNS', 'SSH', 'VPN']
        actual_services = min(int(services), len(available_services))
        selected_services = np.random.choice(available_services, size=actual_services, replace=False).tolist()

        change = ChangeRequest(
            change_id=f"CHG-{i:04d}",
            device_id=f"DEV-{np.random.randint(1, 20):02d}",
            change_type=np.random.choice(['interface_down', 'bgp_change', 'vlan_change', 'config_update']),
            severity=severity,
            affected_services=selected_services,
            affected_nodes=[f"NODE-{j}" for j in range(nodes)],
            change_complexity=float(complexity),
            estimated_duration=float(duration),
            rollback_capability=np.random.random() > 0.3,
            maintenance_window=np.random.random() > 0.4,
            dependencies_count=int(dependencies)
        )
        changes.append(change)
    
    return changes
