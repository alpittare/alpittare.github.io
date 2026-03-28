"""
Configuration settings for RCA system
"""

from dataclasses import dataclass

@dataclass
class DBSCANConfig:
    eps: float = 0.5
    min_pts: int = 3
    temporal_weight: float = 0.3

@dataclass
class KMeansConfig:
    n_clusters: int = 3
    max_iter: int = 100
    tol: float = 1e-4

@dataclass
class CorrelationConfig:
    temporal_window_seconds: int = 300  # 5 minutes
    confidence_threshold: float = 0.5

@dataclass
class DeduplicationConfig:
    time_window_seconds: int = 300  # 5 minutes

@dataclass
class RCAConfig:
    topology_depth: int = 3
    min_confidence: float = 0.3

@dataclass
class SystemConfig:
    dbscan: DBSCANConfig
    kmeans: KMeansConfig
    correlation: CorrelationConfig
    deduplication: DeduplicationConfig
    rca: RCAConfig
    
    @staticmethod
    def default():
        return SystemConfig(
            dbscan=DBSCANConfig(),
            kmeans=KMeansConfig(),
            correlation=CorrelationConfig(),
            deduplication=DeduplicationConfig(),
            rca=RCAConfig()
        )
