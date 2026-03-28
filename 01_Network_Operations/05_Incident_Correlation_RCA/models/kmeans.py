"""
K-Means clustering implementation from scratch using numpy
Lloyd's algorithm with elbow method
"""

import numpy as np
from typing import List, Tuple, Optional
from dataclasses import dataclass

@dataclass
class KMeansResult:
    labels: np.ndarray
    centroids: np.ndarray
    inertia: float
    n_clusters: int
    n_iter: int

class KMeans:
    """
    K-Means clustering from scratch using Lloyd's algorithm.
    """
    
    def __init__(self, n_clusters: int = 3, max_iter: int = 100, tol: float = 1e-4, random_state: int = 42):
        """
        Args:
            n_clusters: Number of clusters
            max_iter: Maximum iterations
            tol: Convergence tolerance
            random_state: Random seed
        """
        self.n_clusters = n_clusters
        self.max_iter = max_iter
        self.tol = tol
        self.random_state = random_state
        self.centroids = None
        self.labels = None
        self.inertia = None
        self.n_iter = 0
    
    def fit(self, X: np.ndarray) -> KMeansResult:
        """
        Fit K-Means to data using Lloyd's algorithm.
        
        Args:
            X: n_samples x n_features array
        
        Returns:
            KMeansResult with cluster assignments
        """
        np.random.seed(self.random_state)
        n_samples, n_features = X.shape
        
        # Initialize centroids by random selection
        indices = np.random.choice(n_samples, self.n_clusters, replace=False)
        self.centroids = X[indices].copy()
        
        prev_inertia = float('inf')
        
        for iteration in range(self.max_iter):
            # Assignment step: assign each point to nearest centroid
            distances = self._compute_distances(X, self.centroids)
            self.labels = np.argmin(distances, axis=1)
            
            # Update step: recalculate centroids
            new_centroids = np.zeros_like(self.centroids)
            for k in range(self.n_clusters):
                cluster_points = X[self.labels == k]
                if len(cluster_points) > 0:
                    new_centroids[k] = cluster_points.mean(axis=0)
                else:
                    # Empty cluster, reinitialize randomly
                    new_centroids[k] = X[np.random.choice(n_samples)]
            
            # Calculate inertia (sum of squared distances to centroids)
            self.inertia = np.sum(
                np.min(self._compute_distances(X, new_centroids) ** 2, axis=1)
            )
            
            # Check convergence
            if abs(prev_inertia - self.inertia) < self.tol:
                self.centroids = new_centroids
                self.n_iter = iteration + 1
                break
            
            prev_inertia = self.inertia
            self.centroids = new_centroids
        else:
            self.n_iter = self.max_iter
        
        return KMeansResult(
            labels=self.labels,
            centroids=self.centroids,
            inertia=self.inertia,
            n_clusters=self.n_clusters,
            n_iter=self.n_iter
        )
    
    @staticmethod
    def _compute_distances(X: np.ndarray, centroids: np.ndarray) -> np.ndarray:
        """
        Compute euclidean distances from each point to each centroid.
        Returns: n_samples x n_centroids array
        """
        n_samples = X.shape[0]
        n_centroids = centroids.shape[0]
        distances = np.zeros((n_samples, n_centroids))
        
        for i in range(n_samples):
            for j in range(n_centroids):
                distances[i, j] = np.sqrt(np.sum((X[i] - centroids[j]) ** 2))
        
        return distances


class ElbowMethod:
    """
    Elbow method to find optimal number of clusters
    """
    
    @staticmethod
    def find_optimal_k(X: np.ndarray, k_range: range, random_state: int = 42) -> Tuple[int, List[float]]:
        """
        Run K-Means for range of k values and return optimal k.
        
        Args:
            X: Feature matrix
            k_range: Range of k values to try (e.g., range(1, 11))
            random_state: Random seed
        
        Returns:
            Tuple of (optimal_k, inertias)
        """
        inertias = []
        
        for k in k_range:
            kmeans = KMeans(n_clusters=k, random_state=random_state)
            result = kmeans.fit(X)
            inertias.append(result.inertia)
        
        # Elbow detection: find the point with maximum curvature
        # Simple method: 2nd derivative
        if len(inertias) < 3:
            return k_range[0], inertias
        
        differences = np.diff(inertias)
        second_diff = np.diff(differences)
        optimal_idx = np.argmax(second_diff) + 1  # +1 for offset
        
        optimal_k = list(k_range)[optimal_idx]
        
        return optimal_k, inertias
