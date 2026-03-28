"""
DBSCAN clustering implementation from scratch using numpy
Density-based spatial clustering with temporal dimension
"""

import numpy as np
from typing import List, Tuple, Optional
from dataclasses import dataclass

@dataclass
class DBSCANResult:
    labels: np.ndarray  # Cluster label for each point (-1 for noise)
    n_clusters: int
    core_points: np.ndarray
    n_core_points: int

class DBSCAN:
    """
    DBSCAN clustering from scratch.
    Features: normalized_timestamp, device_hash, severity_code, alarm_type_code
    """
    
    def __init__(self, eps: float = 0.5, min_pts: int = 3, temporal_weight: float = 0.3):
        """
        Args:
            eps: Maximum distance for two points to be neighbors
            min_pts: Minimum points in eps-radius to form core point
            temporal_weight: Weight for temporal distance vs spatial distance
        """
        self.eps = eps
        self.min_pts = min_pts
        self.temporal_weight = temporal_weight
        self.X = None
        self.labels = None
        self.core_points = None
    
    def fit(self, X: np.ndarray) -> DBSCANResult:
        """
        Fit DBSCAN to data.
        
        Args:
            X: n_samples x n_features array
        
        Returns:
            DBSCANResult with cluster labels
        """
        self.X = X
        n_samples = X.shape[0]
        
        # Initialize labels (-1 means unvisited/noise)
        self.labels = np.full(n_samples, -1)
        
        # Compute pairwise distances
        distances = self._compute_distances(X)
        
        # Identify core points
        self.core_points = np.where(
            np.sum(distances <= self.eps, axis=1) >= self.min_pts
        )[0]
        
        # Cluster expansion
        cluster_id = 0
        for point_idx in self.core_points:
            if self.labels[point_idx] != -1:
                continue  # Already assigned
            
            self._expand_cluster(distances, point_idx, cluster_id)
            cluster_id += 1
        
        return DBSCANResult(
            labels=self.labels,
            n_clusters=cluster_id,
            core_points=self.core_points,
            n_core_points=len(self.core_points)
        )
    
    def _compute_distances(self, X: np.ndarray) -> np.ndarray:
        """
        Compute pairwise distances with temporal weighting.
        Distance metric: weighted euclidean with temporal dimension
        """
        n_samples = X.shape[0]
        distances = np.zeros((n_samples, n_samples))
        
        for i in range(n_samples):
            for j in range(i + 1, n_samples):
                # Temporal distance (normalized timestamp is first feature)
                temporal_dist = abs(X[i, 0] - X[j, 0])
                
                # Spatial distance (other features)
                spatial_dist = np.sqrt(np.sum((X[i, 1:] - X[j, 1:]) ** 2))
                
                # Combined weighted distance
                combined = (
                    self.temporal_weight * temporal_dist +
                    (1 - self.temporal_weight) * spatial_dist
                )
                
                distances[i, j] = combined
                distances[j, i] = combined
        
        return distances
    
    def _expand_cluster(self, distances: np.ndarray, point_idx: int, cluster_id: int):
        """
        Expand cluster from a core point using BFS.
        """
        self.labels[point_idx] = cluster_id
        seeds = [point_idx]
        
        while seeds:
            current = seeds.pop(0)
            neighbors = np.where(distances[current] <= self.eps)[0]
            
            for neighbor_idx in neighbors:
                if self.labels[neighbor_idx] == -1:
                    # Unvisited point
                    self.labels[neighbor_idx] = cluster_id
                    
                    # If neighbor is core point, expand further
                    if neighbor_idx in self.core_points:
                        seeds.append(neighbor_idx)


class DBSCANFeatureEncoder:
    """
    Encode alarm data into feature vectors for DBSCAN
    """
    
    def __init__(self):
        self.timestamp_min = None
        self.timestamp_max = None
        self.device_to_code = {}
        self.severity_to_code = {'CRITICAL': 0, 'ERROR': 1, 'WARNING': 2, 'NOTICE': 3, 'INFO': 4}
        self.alarm_type_to_code = {}
    
    def fit_transform(self, alarms: List) -> np.ndarray:
        """
        Convert alarms to feature matrix.
        Features: [normalized_timestamp, device_code, severity_code, alarm_type_code]
        """
        features = []
        
        # First pass: collect metadata
        timestamps = [a.timestamp.timestamp() for a in alarms]
        self.timestamp_min = min(timestamps)
        self.timestamp_max = max(timestamps)
        
        devices = set(a.device_id for a in alarms)
        self.device_to_code = {dev: i for i, dev in enumerate(sorted(devices))}
        
        alarm_types = set(a.alarm_type for a in alarms)
        self.alarm_type_to_code = {atype: i for i, atype in enumerate(sorted(alarm_types))}
        
        # Second pass: encode features
        for alarm in alarms:
            ts_norm = (alarm.timestamp.timestamp() - self.timestamp_min) / (
                self.timestamp_max - self.timestamp_min + 1e-6
            )
            device_code = self.device_to_code[alarm.device_id]
            severity_code = self.severity_to_code.get(alarm.severity, 4)
            alarm_type_code = self.alarm_type_to_code[alarm.alarm_type]
            
            features.append([ts_norm, device_code, severity_code, alarm_type_code])
        
        return np.array(features)
