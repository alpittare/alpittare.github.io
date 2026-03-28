"""
Isolation Forest Anomaly Detection - Pure NumPy Implementation
Based on: "Isolation Forest" by Liu et al. (2008)
"""

import numpy as np
from typing import List, Tuple, Optional


class IsolationTree:
    """Single isolation tree"""

    def __init__(self, max_depth: int = 20, random_state: Optional[int] = None):
        self.max_depth = max_depth
        self.random_state = random_state
        self.rng = np.random.RandomState(random_state)
        self.feature = None
        self.threshold = None
        self.left = None
        self.right = None
        self.size = 0

    def build(self, X: np.ndarray, current_depth: int = 0) -> None:
        """Recursively build isolation tree"""
        n_samples, n_features = X.shape
        self.size = n_samples

        # Stop conditions
        if current_depth >= self.max_depth or n_samples <= 1:
            return

        # Randomly select feature
        self.feature = self.rng.randint(n_features)

        # Get min and max for feature
        feature_data = X[:, self.feature]
        min_val = feature_data.min()
        max_val = feature_data.max()

        # Stop if all values are the same
        if min_val == max_val:
            return

        # Random split point
        self.threshold = self.rng.uniform(min_val, max_val)

        # Partition data
        left_mask = X[:, self.feature] < self.threshold
        right_mask = ~left_mask

        X_left = X[left_mask]
        X_right = X[right_mask]

        # Create child nodes
        if X_left.shape[0] > 0:
            self.left = IsolationTree(self.max_depth, self.random_state)
            self.left.build(X_left, current_depth + 1)

        if X_right.shape[0] > 0:
            self.right = IsolationTree(self.max_depth, self.random_state)
            self.right.build(X_right, current_depth + 1)

    def predict_path_length(self, x: np.ndarray, current_depth: int = 0) -> float:
        """Predict path length for a single sample"""
        if self.feature is None or self.threshold is None:
            return current_depth

        if x[self.feature] < self.threshold:
            if self.left is None:
                return current_depth
            return self.left.predict_path_length(x, current_depth + 1)
        else:
            if self.right is None:
                return current_depth
            return self.right.predict_path_length(x, current_depth + 1)


class IsolationForest:
    """Isolation Forest Anomaly Detector"""

    def __init__(self, n_trees: int = 100, max_depth: int = 20, contamination: float = 0.1,
                 random_state: Optional[int] = None):
        """
        Initialize Isolation Forest

        Args:
            n_trees: Number of isolation trees
            max_depth: Max depth of each tree
            contamination: Expected fraction of anomalies
            random_state: Random seed
        """
        self.n_trees = n_trees
        self.max_depth = max_depth
        self.contamination = contamination
        self.random_state = random_state
        self.rng = np.random.RandomState(random_state)
        self.trees = []
        self.c_factor = None

    def fit(self, X: np.ndarray) -> None:
        """Train the forest"""
        n_samples, n_features = X.shape

        # Calculate average path length
        self.c_factor = self._calculate_c_factor(n_samples)

        # Build trees with bootstrap samples
        for i in range(self.n_trees):
            # Random subsample size (typically 256)
            sample_size = min(256, n_samples)
            indices = self.rng.choice(n_samples, size=sample_size, replace=False)
            X_sample = X[indices]

            tree = IsolationTree(self.max_depth, self.random_state)
            tree.build(X_sample)
            self.trees.append(tree)

    def _calculate_c_factor(self, n: int) -> float:
        """Average path length of unsuccessful search in BST"""
        if n <= 1:
            return 0.0
        return 2 * (np.log(n - 1) + 0.5772156649) - 2 * (n - 1) / n

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Predict anomaly scores"""
        n_samples = X.shape[0]
        scores = np.zeros(n_samples)

        for i in range(n_samples):
            # Calculate average path length across trees
            total_path_length = 0
            for tree in self.trees:
                total_path_length += tree.predict_path_length(X[i])

            avg_path_length = total_path_length / self.n_trees

            # Calculate anomaly score
            # score = 2^(-E(h(x))/c(n))
            score = 2 ** (-(avg_path_length / self.c_factor))
            scores[i] = score

        return scores

    def predict_binary(self, X: np.ndarray, threshold: float = 0.5) -> np.ndarray:
        """Predict binary anomalies (1=anomaly, 0=normal)"""
        scores = self.predict(X)
        return (scores > threshold).astype(int)

    def get_anomaly_indices(self, X: np.ndarray, threshold: float = 0.5) -> np.ndarray:
        """Get indices of anomalies"""
        predictions = self.predict_binary(X, threshold)
        return np.where(predictions == 1)[0]
