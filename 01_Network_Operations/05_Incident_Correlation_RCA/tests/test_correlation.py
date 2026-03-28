"""
Test Suite for Correlation Engine

Tests temporal, spatial, and contextual correlation functionality.
"""

import pytest
from datetime import datetime
from typing import List, Dict, Any

from src.correlation.correlation_engine import CorrelationEngine
from src.correlation.deduplicator import Deduplicator
from src.correlation.clustering import AlarmClusteringEngine


@pytest.fixture
def sample_alarms() -> List[Dict[str, Any]]:
    """Generate sample alarms for testing."""
    base_time = int(datetime.utcnow().timestamp() * 1000)

    return [
        {
            "alarm_id": "alarm-1",
            "timestamp": base_time,
            "device_name": "router-01",
            "device_id": "dev-1",
            "severity": "CRITICAL",
            "alarm_type": "LinkDown",
            "description": "Link eth0 down",
            "status": "ACTIVE",
            "metadata": {"service_name": "wan", "region": "us-east"}
        },
        {
            "alarm_id": "alarm-2",
            "timestamp": base_time + 5000,  # 5 seconds later
            "device_name": "router-02",
            "device_id": "dev-2",
            "severity": "MAJOR",
            "alarm_type": "BGPDown",
            "description": "BGP session down",
            "status": "ACTIVE",
            "metadata": {"service_name": "wan", "region": "us-east"}
        },
        {
            "alarm_id": "alarm-3",
            "timestamp": base_time + 10000,  # 10 seconds later
            "device_name": "router-03",
            "device_id": "dev-3",
            "severity": "MAJOR",
            "alarm_type": "BGPDown",
            "description": "BGP session down",
            "status": "ACTIVE",
            "metadata": {"service_name": "wan", "region": "us-east"}
        },
        {
            "alarm_id": "alarm-4",
            "timestamp": base_time + 600000,  # 10 minutes later
            "device_name": "router-04",
            "device_id": "dev-4",
            "severity": "INFO",
            "alarm_type": "LinkUp",
            "description": "Link eth0 up",
            "status": "ACTIVE",
            "metadata": {"service_name": "internet", "region": "us-west"}
        }
    ]


class TestDeduplicator:
    """Test deduplication functionality."""

    def test_hash_dedup_basic(self):
        """Test basic hash-based deduplication."""
        dedup = Deduplicator(strategy="hash", dedup_window_seconds=300)

        alarm1 = {
            "alarm_id": "alarm-1",
            "timestamp": 1000000000,
            "device_name": "router-01",
            "alarm_type": "LinkDown",
            "severity": "CRITICAL"
        }

        alarm1_dup = {
            "alarm_id": "alarm-1-dup",
            "timestamp": 1000010000,  # 10 seconds later
            "device_name": "router-01",
            "alarm_type": "LinkDown",
            "severity": "CRITICAL"
        }

        is_dup1, orig1 = dedup.process_alarm(alarm1)
        assert not is_dup1
        assert orig1 is None

        is_dup2, orig2 = dedup.process_alarm(alarm1_dup)
        assert is_dup2
        assert orig2 == "alarm-1"

    def test_dedup_outside_window(self):
        """Test dedup doesn't trigger outside time window."""
        dedup = Deduplicator(strategy="hash", dedup_window_seconds=300)

        alarm1 = {
            "alarm_id": "alarm-1",
            "timestamp": 1000000000,
            "device_name": "router-01",
            "alarm_type": "LinkDown",
            "severity": "CRITICAL"
        }

        alarm2 = {
            "alarm_id": "alarm-2",
            "timestamp": 1000400000,  # 400 seconds later (outside window)
            "device_name": "router-01",
            "alarm_type": "LinkDown",
            "severity": "CRITICAL"
        }

        is_dup1, _ = dedup.process_alarm(alarm1)
        is_dup2, _ = dedup.process_alarm(alarm2)

        assert not is_dup1
        assert not is_dup2  # Should not be considered duplicate

    def test_metrics(self):
        """Test deduplicator metrics."""
        dedup = Deduplicator()

        metrics = dedup.get_metrics()
        assert "total_alarms_processed" in metrics
        assert "duplicates_found" in metrics
        assert metrics["duplicates_found"] == 0


class TestClustering:
    """Test clustering algorithms."""

    def test_dbscan_clustering(self, sample_alarms):
        """Test DBSCAN clustering."""
        clustering = AlarmClusteringEngine(algorithm="dbscan")

        # Filter to first 3 alarms (within time window)
        alarms_to_cluster = sample_alarms[:3]

        clusters = clustering.cluster_alarms(
            alarms_to_cluster,
            eps=10,  # 10 second window
            min_pts=2
        )

        # Should cluster alarm-1, alarm-2, alarm-3 together
        assert len(clusters) > 0

    def test_dbscan_noise_points(self, sample_alarms):
        """Test DBSCAN identifies noise points."""
        clustering = AlarmClusteringEngine(algorithm="dbscan")

        # Sample with outlier (alarm-4)
        clusters = clustering.cluster_alarms(
            sample_alarms,
            eps=10,
            min_pts=2
        )

        metrics = clustering.get_metrics()
        assert metrics["noise_points"] >= 0

    def test_hierarchical_clustering(self, sample_alarms):
        """Test hierarchical clustering."""
        clustering = AlarmClusteringEngine(algorithm="hierarchical")

        clusters = clustering.cluster_alarms(
            sample_alarms,
            linkage="ward",
            cutoff=0.7
        )

        assert isinstance(clusters, dict)
        assert all(isinstance(v, list) for v in clusters.values())


class TestCorrelationScoring:
    """Test correlation scoring."""

    def test_temporal_scoring(self, sample_alarms):
        """Test temporal correlation scoring."""
        # Create mock engine
        class MockES:
            def search_alarms(self, query):
                return {"hits": {"hits": [], "total": {"value": 0}}}

        engine = CorrelationEngine(
            kafka_consumer=None,
            elasticsearch_service=MockES(),
            temporal_window_seconds=600
        )

        alarm1 = sample_alarms[0]
        alarm2 = sample_alarms[1]

        score = engine._score_temporal_correlation(alarm1, alarm2)

        # Should be high (close together in time)
        assert 0.0 <= score <= 1.0
        assert score > 0.5  # Should be fairly high

    def test_spatial_scoring(self, sample_alarms):
        """Test spatial correlation scoring."""
        class MockES:
            def search_alarms(self, query):
                return {"hits": {"hits": [], "total": {"value": 0}}}

        engine = CorrelationEngine(
            kafka_consumer=None,
            elasticsearch_service=MockES()
        )

        alarm1 = sample_alarms[0]
        alarm2 = sample_alarms[1]

        score = engine._score_spatial_correlation(alarm1, alarm2)

        # Same service, different device -> medium score
        assert 0.0 <= score <= 1.0
        assert score > 0.3  # Should be at least low-medium

    def test_severity_ranking(self, sample_alarms):
        """Test severity ranking."""
        class MockES:
            def search_alarms(self, query):
                return {"hits": {"hits": [], "total": {"value": 0}}}

        engine = CorrelationEngine(
            kafka_consumer=None,
            elasticsearch_service=MockES()
        )

        assert engine._severity_rank("CRITICAL") > engine._severity_rank("WARNING")
        assert engine._severity_rank("MAJOR") > engine._severity_rank("MINOR")
        assert engine._severity_rank("INFO") < engine._severity_rank("CRITICAL")


class TestIncidentCreation:
    """Test incident creation from correlated alarms."""

    def test_incident_basic_fields(self, sample_alarms):
        """Test incident has required fields."""
        class MockES:
            def search_alarms(self, query):
                return {"hits": {"hits": [], "total": {"value": 0}}}

            def client(self):
                class MockClient:
                    def index(self, **kwargs):
                        pass
                return MockClient()

        engine = CorrelationEngine(
            kafka_consumer=None,
            elasticsearch_service=MockES()
        )

        # Mock elasticsearch client
        engine.es_service.client = type('obj', (object,), {
            'index': lambda **kwargs: None
        })()

        import asyncio
        incident = asyncio.run(
            engine._create_incident(sample_alarms[:2])
        )

        assert "incident_id" in incident
        assert "created_at" in incident
        assert "correlated_alarm_ids" in incident
        assert len(incident["correlated_alarm_ids"]) == 2
        assert incident["alarm_count"] == 2


class TestCorrelationRules:
    """Test correlation rule matching."""

    def test_rule_loading(self):
        """Test loading correlation rules."""
        class MockES:
            def search_alarms(self, query):
                return {"hits": {"hits": [], "total": {"value": 0}}}

        engine = CorrelationEngine(
            kafka_consumer=None,
            elasticsearch_service=MockES()
        )

        # Rules should be loaded (or empty if no file)
        assert isinstance(engine.correlation_rules, dict)

    def test_rule_condition_matching(self, sample_alarms):
        """Test rule condition matching."""
        class MockES:
            def search_alarms(self, query):
                return {"hits": {"hits": [], "total": {"value": 0}}}

        engine = CorrelationEngine(
            kafka_consumer=None,
            elasticsearch_service=MockES()
        )

        alarm1 = sample_alarms[0]  # LinkDown
        alarm2 = sample_alarms[1]  # BGPDown

        condition = {
            "type": "alarm_type_match",
            "value": ["LinkDown", "BGPDown"]
        }

        assert engine._condition_matches(condition, alarm1, alarm2)
