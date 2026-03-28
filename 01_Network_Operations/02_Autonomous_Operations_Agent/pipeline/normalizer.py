"""
Data Normalizer - Normalize telemetry for ML models
"""

import numpy as np
from typing import Dict, Any, List, Optional, Tuple


class StandardScaler:
    """StandardScaler implementation"""

    def __init__(self):
        self.mean = None
        self.std = None
        self.fitted = False

    def fit(self, X: np.ndarray) -> None:
        """Calculate mean and std"""
        self.mean = np.mean(X, axis=0)
        self.std = np.std(X, axis=0)
        self.std[self.std == 0] = 1  # Avoid division by zero
        self.fitted = True

    def transform(self, X: np.ndarray) -> np.ndarray:
        """Normalize data"""
        if not self.fitted:
            raise ValueError("Scaler not fitted yet")
        return (X - self.mean) / self.std

    def fit_transform(self, X: np.ndarray) -> np.ndarray:
        """Fit and transform"""
        self.fit(X)
        return self.transform(X)

    def inverse_transform(self, X: np.ndarray) -> np.ndarray:
        """Denormalize data"""
        return X * self.std + self.mean


class MinMaxScaler:
    """MinMax scaling"""

    def __init__(self, feature_range: Tuple[float, float] = (0, 1)):
        self.feature_range = feature_range
        self.min = None
        self.max = None
        self.fitted = False

    def fit(self, X: np.ndarray) -> None:
        """Calculate min and max"""
        self.min = np.min(X, axis=0)
        self.max = np.max(X, axis=0)
        self.fitted = True

    def transform(self, X: np.ndarray) -> np.ndarray:
        """Scale to range"""
        if not self.fitted:
            raise ValueError("Scaler not fitted yet")

        X_scaled = (X - self.min) / (self.max - self.min + 1e-10)
        a, b = self.feature_range
        return X_scaled * (b - a) + a

    def fit_transform(self, X: np.ndarray) -> np.ndarray:
        """Fit and transform"""
        self.fit(X)
        return self.transform(X)


class Normalizer:
    """Telemetry data normalizer"""

    # Feature definitions
    FEATURE_NAMES = [
        'cpu_utilization',
        'memory_utilization',
        'interface_errors',
        'bgp_neighbor_flaps',
        'latency_ms',
        'jitter_ms',
        'packet_loss_percent'
    ]

    def __init__(self):
        self.scaler = StandardScaler()
        self.fitted = False

    def extract_features(self, telemetry: Dict[str, Any]) -> np.ndarray:
        """Extract feature vector from telemetry dict"""
        features = []
        for name in self.FEATURE_NAMES:
            value = telemetry.get(name, 0)
            features.append(float(value))
        return np.array(features)

    def extract_features_batch(self, telemetry_list: List[Dict[str, Any]]) -> np.ndarray:
        """Extract feature matrix from list of telemetry"""
        features = []
        for telemetry in telemetry_list:
            features.append(self.extract_features(telemetry))
        return np.array(features)

    def fit(self, telemetry_list: List[Dict[str, Any]]) -> None:
        """Fit scaler on telemetry"""
        X = self.extract_features_batch(telemetry_list)
        self.scaler.fit(X)
        self.fitted = True

    def normalize(self, telemetry_list: List[Dict[str, Any]]) -> np.ndarray:
        """Normalize telemetry list"""
        if not self.fitted:
            raise ValueError("Normalizer not fitted")

        X = self.extract_features_batch(telemetry_list)
        return self.scaler.transform(X)

    def fit_normalize(self, telemetry_list: List[Dict[str, Any]]) -> np.ndarray:
        """Fit and normalize"""
        self.fit(telemetry_list)
        return self.normalize(telemetry_list)

    def denormalize(self, X: np.ndarray) -> np.ndarray:
        """Reverse normalization"""
        return self.scaler.inverse_transform(X)

    def normalize_single(self, telemetry: Dict[str, Any]) -> np.ndarray:
        """Normalize single sample"""
        if not self.fitted:
            raise ValueError("Normalizer not fitted")

        X = self.extract_features(telemetry)
        return self.scaler.transform(X.reshape(1, -1))[0]

    def get_feature_names(self) -> List[str]:
        """Get feature names"""
        return self.FEATURE_NAMES

    def get_feature_importance(self) -> Dict[str, float]:
        """Get feature statistics for importance ranking"""
        return {
            name: float(std) for name, std in zip(
                self.FEATURE_NAMES,
                self.scaler.std if self.scaler.std is not None else np.ones(len(self.FEATURE_NAMES))
            )
        }
