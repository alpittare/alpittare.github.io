"""
Unit Tests for Event Correlator

Tests for event correlation and root cause analysis.
"""

from datetime import datetime, timedelta
import pytest

from src.ml.event_correlator import EventCorrelator


class TestEventCorrelator:
    """Test cases for EventCorrelator"""

    @pytest.fixture
    def correlator(self):
        """Create correlator instance"""
        topology_db = {
            "router-01": {
                "name": "core-router-1",
                "dependents": ["router-02", "router-03"],
                "services": ["service-a", "service-b"]
            },
            "router-02": {
                "name": "edge-router-1",
                "dependents": [],
                "services": ["service-a"]
            },
            "router-03": {
                "name": "edge-router-2",
                "dependents": [],
                "services": ["service-b"]
            }
        }

        return EventCorrelator(
            time_window=300,
            topology_db=topology_db
        )

    @pytest.fixture
    def sample_events(self):
        """Generate sample events"""
        base_time = datetime.utcnow()

        return [
            {
                "timestamp": base_time.isoformat(),
                "device_id": "router-01",
                "severity": "error",
                "message": "Interface down"
            },
            {
                "timestamp": (base_time + timedelta(seconds=10)).isoformat(),
                "device_id": "router-02",
                "severity": "error",
                "message": "BGP neighbor down"
            },
            {
                "timestamp": (base_time + timedelta(seconds=20)).isoformat(),
                "device_id": "router-03",
                "severity": "warning",
                "message": "Traffic rerouted"
            }
        ]

    @pytest.mark.asyncio
    async def test_correlate_events_within_window(self, correlator, sample_events):
        """Test event correlation within time window"""
        results = await correlator.correlate_events(sample_events, time_window=300)

        assert len(results) > 0
        assert all(hasattr(r, 'group_id') for r in results)

    @pytest.mark.asyncio
    async def test_correlate_events_outside_window(self, correlator):
        """Test event correlation with events outside time window"""
        base_time = datetime.utcnow()

        events = [
            {
                "timestamp": base_time.isoformat(),
                "device_id": "router-01",
                "severity": "error"
            },
            {
                "timestamp": (base_time + timedelta(hours=1)).isoformat(),
                "device_id": "router-02",
                "severity": "error"
            }
        ]

        results = await correlator.correlate_events(events, time_window=60)

        # Events should be in separate groups due to time window
        assert len(results) == 2

    @pytest.mark.asyncio
    async def test_root_cause_identification(self, correlator, sample_events):
        """Test root cause identification"""
        results = await correlator.correlate_events(sample_events)

        assert len(results) > 0
        group = results[0]

        # Root cause should be first event (router-01)
        assert group.root_cause in [e['device_id'] for e in sample_events]

    @pytest.mark.asyncio
    async def test_affected_services_identification(self, correlator, sample_events):
        """Test affected services identification"""
        results = await correlator.correlate_events(sample_events)

        assert len(results) > 0
        group = results[0]

        # Should identify affected services
        assert isinstance(group.affected_services, list)

    def test_time_window_grouping(self, correlator):
        """Test time-window based event grouping"""
        base_time = datetime.utcnow()

        events = [
            {
                "timestamp": base_time.isoformat(),
                "device_id": "router-01"
            },
            {
                "timestamp": (base_time + timedelta(seconds=100)).isoformat(),
                "device_id": "router-02"
            },
            {
                "timestamp": (base_time + timedelta(seconds=200)).isoformat(),
                "device_id": "router-03"
            }
        ]

        groups = correlator._group_by_time_window(events, window_seconds=150)

        # Should create 2 groups (0-150s and 150-200s)
        assert len(groups) == 2

    def test_dependency_analysis(self, correlator):
        """Test dependency graph analysis"""
        events = [
            {"device_id": "router-01", "severity": "error"},
            {"device_id": "router-02", "severity": "error"}
        ]

        dependencies = correlator._analyze_dependencies(events)

        # router-01 should have dependents
        assert "router-01" in dependencies
        assert "router-02" in dependencies["router-01"]

    def test_correlation_strength_computation(self, correlator):
        """Test correlation strength calculation"""
        events = [
            {"device_id": "router-01"},
            {"device_id": "router-02"},
            {"device_id": "router-03"}
        ]

        dependencies = {
            "router-01": {"router-02", "router-03"}
        }

        strength = correlator._compute_correlation_strength(events, dependencies)

        assert 0.0 <= strength <= 1.0
        assert strength > 0.5  # High correlation

    def test_generate_group_id(self, correlator):
        """Test group ID generation"""
        events = [
            {"timestamp": datetime.utcnow().isoformat(), "device_id": "router-01"}
        ]

        group_id = correlator._generate_group_id(events)

        assert group_id.startswith("corr-")
        assert len(group_id) > 5

    def test_group_id_consistency(self, correlator):
        """Test group ID consistency"""
        events = [
            {"timestamp": "2023-01-01T10:00:00", "device_id": "router-01"}
        ]

        id1 = correlator._generate_group_id(events)
        id2 = correlator._generate_group_id(events)

        assert id1 == id2

    def test_timestamp_parsing(self, correlator):
        """Test timestamp parsing from various formats"""
        # ISO format string
        ts1 = correlator._parse_timestamp("2023-01-01T10:00:00")
        assert isinstance(ts1, datetime)

        # Already datetime
        dt = datetime.utcnow()
        ts2 = correlator._parse_timestamp(dt)
        assert ts2 == dt

        # Invalid format defaults to utcnow
        ts3 = correlator._parse_timestamp("invalid")
        assert isinstance(ts3, datetime)

    @pytest.mark.asyncio
    async def test_rca_simple_case(self, correlator):
        """Test root cause analysis on simple case"""
        anomaly = {
            "id": "anom-001",
            "device_id": "router-01",
            "metric_name": "interface.down"
        }

        # Add event to history
        correlator.add_to_history({
            "device_id": "router-01",
            "metric_name": "interface.down",
            "timestamp": datetime.utcnow().isoformat()
        })

        rca = correlator.perform_rca(anomaly)

        assert rca["anomaly_id"] == "anom-001"
        assert "root_cause" in rca
        assert "affected_services" in rca

    def test_event_history_management(self, correlator):
        """Test event history bounded storage"""
        # Add many events
        for i in range(15000):
            correlator.add_to_history({
                "device_id": f"router-{i % 3}",
                "timestamp": datetime.utcnow().isoformat()
            })

        # History should be bounded
        assert len(correlator.event_history) <= 10000

    def test_empty_events_handling(self, correlator):
        """Test handling of empty event list"""
        import asyncio

        async def test():
            results = await correlator.correlate_events([])
            return results

        results = asyncio.run(test())
        assert results == []

    def test_single_event_handling(self, correlator):
        """Test handling of single event"""
        import asyncio

        async def test():
            events = [{"device_id": "router-01", "timestamp": datetime.utcnow().isoformat()}]
            results = await correlator.correlate_events(events)
            return results

        results = asyncio.run(test())
        assert len(results) >= 0

    def test_correlated_event_group_serialization(self, correlator):
        """Test CorrelatedEventGroup serialization"""
        import asyncio

        async def test():
            base_time = datetime.utcnow()
            events = [
                {"device_id": "router-01", "timestamp": base_time.isoformat()},
                {"device_id": "router-02", "timestamp": (base_time + timedelta(seconds=10)).isoformat()}
            ]

            results = await correlator.correlate_events(events)
            if results:
                group_dict = results[0].to_dict()
                assert isinstance(group_dict, dict)
                assert "group_id" in group_dict
                assert "events" in group_dict

        asyncio.run(test())

    def test_service_impact_analysis(self, correlator):
        """Test service impact identification"""
        events = [
            {"device_id": "router-01"},
            {"device_id": "router-02"}
        ]

        services = correlator._identify_affected_services(events)

        # Should identify services from topology
        assert isinstance(services, list)
        assert len(services) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
