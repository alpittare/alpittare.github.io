"""Intent classification using logistic regression with numpy."""
import numpy as np
from typing import List, Tuple, Dict
import re
from collections import defaultdict


class IntentClassifier:
    """Multi-class intent classifier using logistic regression."""

    INTENTS = [
        'topology_query',  # Questions about network topology
        'config_query',    # Questions about device configuration
        'troubleshoot',    # Troubleshooting questions
        'capacity_planning',  # Capacity and performance questions
        'general'          # General network knowledge
    ]

    INTENT_KEYWORDS = {
        'topology_query': [
            'topology', 'neighbor', 'connection', 'connected', 'link',
            'adjacency', 'discover', 'device', 'location', 'connected to',
            'depends on', 'impact'
        ],
        'config_query': [
            'config', 'configuration', 'running-config', 'interface',
            'vlan', 'bgp', 'ospf', 'acl', 'route', 'policy', 'address',
            'ip address', 'show', 'command', 'setting'
        ],
        'troubleshoot': [
            'troubleshoot', 'issue', 'problem', 'down', 'fail', 'error',
            'high cpu', 'high memory', 'flapping', 'not working',
            'why', 'what went wrong', 'fix', 'resolve'
        ],
        'capacity_planning': [
            'capacity', 'bandwidth', 'throughput', 'utilization', 'traffic',
            'performance', 'latency', 'loss', 'congestion', 'scaling',
            'growth', 'forecast', 'upgrade'
        ],
        'general': [
            'what', 'how', 'when', 'where', 'purpose', 'explain',
            'documentation', 'standard', 'best practice', 'recommendation'
        ]
    }

    def __init__(self, learning_rate=0.01, iterations=100):
        """Initialize classifier."""
        self.learning_rate = learning_rate
        self.iterations = iterations
        self.weights = None
        self.bias = None
        self.vocabulary = {}
        self.is_fitted = False

    def _extract_features(self, text: str) -> np.ndarray:
        """
        Extract features from text.

        Features:
        - Keyword presence (one-hot for each intent)
        - Question mark indicator
        - Word length
        - Keyword density
        """
        text_lower = text.lower()
        features = []

        # Keyword presence features (one per intent)
        for intent in self.INTENTS:
            keywords = self.INTENT_KEYWORDS[intent]
            matches = sum(1 for kw in keywords if kw in text_lower)
            features.append(matches / len(keywords))  # Normalized count

        # Question features
        features.append(1.0 if '?' in text else 0.0)
        features.append(1.0 if text.startswith('how') else 0.0)
        features.append(1.0 if text.startswith('what') else 0.0)
        features.append(1.0 if text.startswith('show') else 0.0)

        # Text complexity
        word_count = len(text.split())
        features.append(min(word_count / 50.0, 1.0))  # Normalized word count

        # Entity mentions
        features.append(1.0 if re.search(r'\b[A-Z]{2,}(?:-\d+)?(?:\s+[A-Z]{2,}\d+)*\b', text) else 0.0)
        features.append(1.0 if re.search(r'\d+\.\d+\.\d+\.\d+', text) else 0.0)  # IP address
        features.append(1.0 if re.search(r'vlan\s+\d+', text) else 0.0)  # VLAN

        return np.array(features, dtype=np.float32)

    def train(self, texts: List[str], labels: List[int]):
        """
        Train classifier on labeled texts.

        Args:
            texts: List of text examples
            labels: List of intent indices (0-4)
        """
        # Extract features for all texts
        X = np.array([self._extract_features(text) for text in texts])
        n_features = X.shape[1]
        n_classes = len(self.INTENTS)

        # Initialize weights and bias
        self.weights = np.zeros((n_classes, n_features))
        self.bias = np.zeros(n_classes)

        # Training loop
        for iteration in range(self.iterations):
            # Forward pass: compute logits
            logits = np.dot(X, self.weights.T) + self.bias

            # Compute probabilities using softmax
            exp_logits = np.exp(logits - np.max(logits, axis=1, keepdims=True))
            probs = exp_logits / np.sum(exp_logits, axis=1, keepdims=True)

            # Compute gradients
            one_hot = np.eye(n_classes)[labels]
            error = probs - one_hot

            grad_w = np.dot(error.T, X) / len(texts)
            grad_b = np.mean(error, axis=0)

            # Update weights and bias
            self.weights -= self.learning_rate * grad_w
            self.bias -= self.learning_rate * grad_b

        self.is_fitted = True

    def predict(self, text: str) -> Tuple[str, float]:
        """
        Predict intent for text.

        Args:
            text: Text to classify

        Returns:
            (intent_name, confidence_score)
        """
        if not self.is_fitted:
            return ('general', 0.5)  # Default fallback

        X = self._extract_features(text).reshape(1, -1)

        # Compute logits
        logits = np.dot(X, self.weights.T) + self.bias

        # Compute probabilities
        exp_logits = np.exp(logits - np.max(logits))
        probs = exp_logits / np.sum(exp_logits)

        # Get top prediction
        intent_idx = np.argmax(probs[0])
        confidence = float(probs[0, intent_idx])

        return (self.INTENTS[intent_idx], confidence)

    def predict_batch(self, texts: List[str]) -> List[Tuple[str, float]]:
        """Predict intents for multiple texts."""
        return [self.predict(text) for text in texts]

    def get_feature_importance(self) -> Dict[str, np.ndarray]:
        """Get feature importance for each intent."""
        if not self.is_fitted:
            return {}

        importance = {}
        for i, intent in enumerate(self.INTENTS):
            importance[intent] = np.abs(self.weights[i])

        return importance
