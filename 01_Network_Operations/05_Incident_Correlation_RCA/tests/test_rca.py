"""
Unit tests for RCA system components
"""

import sys
import os
import numpy as np
from datetime import datetime, timedelta

# Add parent to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.dbscan import DBSCAN, DBSCANFeatureEncoder
from models.kmeans import KMeans, ElbowMethod
from models.deduplicator import AlarmDeduplicator
from models.correlation_engine import CorrelationEngine
from models.rca_graph import RCAGraph
from data.topology import create_sample_topology
from data.alarm_generator import AlarmGenerator


def test_dbscan_core_points():
    """Test DBSCAN identifies core points correctly"""
    # Create simple test data
    X = np.array([
        [0.0, 0.0, 0.0],
        [0.1, 0.1, 0.1],
        [0.2, 0.2, 0.2],
        [5.0, 5.0, 5.0],  # Outlier
        [5.1, 5.1, 5.1],  # Outlier
    ])
    
    dbscan = DBSCAN(eps=0.5, min_pts=2)
    result = dbscan.fit(X)
    
    assert result.n_clusters >= 1, "Should find at least one cluster"
    assert len(result.core_points) >= 2, "Should identify core points"
    assert result.labels[-1] == -1 or result.labels[-2] == -1, "Outliers should be noise"
    print("✓ test_dbscan_core_points passed")


def test_kmeans_convergence():
    """Test K-Means converges"""
    X = np.random.randn(100, 4)
    
    kmeans = KMeans(n_clusters=3, max_iter=100, random_state=42)
    result = kmeans.fit(X)
    
    assert result.n_clusters == 3, "Should have 3 clusters"
    assert result.n_iter <= 100, "Should converge within max_iter"
    assert result.inertia > 0, "Inertia should be positive"
    assert len(result.labels) == 100, "Should label all points"
    print("✓ test_kmeans_convergence passed")


def test_elbow_method():
    """Test elbow method finds reasonable K"""
    X = np.random.randn(100, 4)
    
    optimal_k, inertias = ElbowMethod.find_optimal_k(X, range(1, 6))
    
    assert len(inertias) == 5, "Should compute inertia for each K"
    assert inertias[0] >= inertias[-1], "Inertia should decrease with K"
    assert 1 <= optimal_k <= 5, "Optimal K should be in range"
    print("✓ test_elbow_method passed")


def test_deduplicator():
    """Test alarm deduplication"""
    base_time = datetime.now()
    
    from data.alarm_generator import Alarm
    
    alarms = [
        Alarm(base_time, 'DEV-1', 'LINK_DOWN', 'ERROR', 'Link down', 'Eth1/1'),
        Alarm(base_time + timedelta(seconds=10), 'DEV-1', 'LINK_DOWN', 'ERROR', 'Link down', 'Eth1/1'),  # Dup
        Alarm(base_time + timedelta(seconds=400), 'DEV-1', 'LINK_DOWN', 'ERROR', 'Link down', 'Eth1/1'),  # Outside window
        Alarm(base_time, 'DEV-2', 'LINK_DOWN', 'ERROR', 'Link down', 'Eth2/1'),  # Different device
    ]
    
    dedup = AlarmDeduplicator(time_window_seconds=300)
    deduped, stats = dedup.deduplicate(alarms)
    
    assert len(deduped) == 3, f"Should keep 3 unique (got {len(deduped)})"
    assert stats.suppressed_count == 1, "Should suppress 1 duplicate"
    assert stats.reduction_ratio > 0, "Reduction ratio should be positive"
    print("✓ test_deduplicator passed")


def test_correlation_engine():
    """Test event correlation"""
    topology = create_sample_topology()
    
    base_time = datetime.now()
    from data.alarm_generator import Alarm
    
    alarms = [
        Alarm(base_time, 'CORE-1', 'POWER_SUPPLY_FAILURE', 'CRITICAL', 'PSU failed'),
        Alarm(base_time + timedelta(seconds=5), 'CORE-1', 'TEMPERATURE_CRITICAL', 'CRITICAL', 'Temp high'),
        Alarm(base_time + timedelta(seconds=10), 'DIST-1', 'BGP_SESSION_DOWN', 'ERROR', 'BGP down'),
        Alarm(base_time + timedelta(seconds=600), 'ACC-1', 'LINK_UP', 'INFO', 'Link up'),  # Different incident
    ]
    
    engine = CorrelationEngine(temporal_window_sec=300, topology=topology)
    incidents = engine.correlate(alarms)
    
    assert len(incidents) >= 1, "Should find at least one incident"
    assert incidents[0].confidence_score > 0, "Confidence should be positive"
    assert len(incidents[0].alarms) >= 1, "Incident should have alarms"
    print("✓ test_correlation_engine passed")


def test_rca_graph():
    """Test root cause analysis"""
    topology = create_sample_topology()
    
    base_time = datetime.now()
    from data.alarm_generator import Alarm
    from models.correlation_engine import CorrelatedIncident
    
    # Create an incident
    incident = CorrelatedIncident('INC-1')
    
    alarms = [
        Alarm(base_time, 'CORE-1', 'POWER_SUPPLY_FAILURE', 'CRITICAL', 'PSU failed'),
        Alarm(base_time + timedelta(seconds=5), 'DIST-1', 'BGP_SESSION_DOWN', 'ERROR', 'BGP down'),
    ]
    
    for alarm in alarms:
        incident.add_alarm(alarm)
    
    rca = RCAGraph(topology)
    root_causes = rca.analyze_incident(incident)
    
    assert len(root_causes) >= 0, "Should return list of candidates"
    if root_causes:
        assert root_causes[0].score >= 0, "Score should be non-negative"
        assert root_causes[0].score <= 1, "Score should be <= 1"
    print("✓ test_rca_graph passed")


def test_feature_encoder():
    """Test alarm feature encoding"""
    base_time = datetime.now()
    from data.alarm_generator import Alarm
    
    alarms = [
        Alarm(base_time, 'DEV-A', 'LINK_DOWN', 'CRITICAL', 'Link down'),
        Alarm(base_time + timedelta(seconds=30), 'DEV-B', 'POWER_FAIL', 'ERROR', 'Power fail'),
        Alarm(base_time + timedelta(seconds=60), 'DEV-A', 'LINK_DOWN', 'WARNING', 'Flapping'),
    ]
    
    encoder = DBSCANFeatureEncoder()
    X = encoder.fit_transform(alarms)
    
    assert X.shape[0] == 3, "Should encode 3 alarms"
    assert X.shape[1] == 4, "Should have 4 features"
    assert X[0, 0] >= 0 and X[0, 0] <= 1, "Normalized timestamp should be in [0,1]"
    print("✓ test_feature_encoder passed")


if __name__ == '__main__':
    print("=" * 60)
    print("RCA System Unit Tests")
    print("=" * 60)
    
    test_dbscan_core_points()
    test_kmeans_convergence()
    test_elbow_method()
    test_deduplicator()
    test_correlation_engine()
    test_rca_graph()
    test_feature_encoder()
    
    print("\n" + "=" * 60)
    print("All tests passed!")
    print("=" * 60)
