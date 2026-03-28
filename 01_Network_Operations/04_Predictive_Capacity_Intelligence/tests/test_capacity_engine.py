"""
Unit tests for capacity engine.
"""

import pytest
import numpy as np
from datetime import datetime

from src.services.capacity_engine import CapacityEngine, AlertManager


class TestCapacityEngine:
    """Test capacity analysis engine."""

    @pytest.fixture
    def engine(self):
        """Create capacity engine instance."""
        return CapacityEngine(
            threshold_info=60,
            threshold_warning=75,
            threshold_critical=85,
            amdl_trigger_threshold=85
        )

    @pytest.fixture
    def sample_forecast(self):
        """Generate sample forecast data."""
        # 24-hour forecast with increasing trend
        forecast_24h = np.linspace(50, 92, 24)
        forecast_72h = np.linspace(50, 96, 72)
        return forecast_24h, forecast_72h

    def test_engine_initialization(self, engine):
        """Test engine initialization."""
        assert engine.threshold_critical == 85
        assert engine.threshold_warning == 75
        assert engine.threshold_info == 60

    def test_capacity_analysis(self, engine, sample_forecast):
        """Test capacity analysis."""
        forecast_24h, forecast_72h = sample_forecast

        analysis = engine.analyze_capacity(
            device_id="router-001",
            interface_name="eth0",
            current_utilization=50.0,
            link_capacity_mbps=10000,
            forecast_24h=forecast_24h.tolist(),
            forecast_72h=forecast_72h.tolist()
        )

        assert analysis['device_id'] == "router-001"
        assert analysis['interface_name'] == "eth0"
        assert 'forecast_peak_24h' in analysis
        assert 'forecast_peak_72h' in analysis
        assert 'risk_score' in analysis
        assert 'recommended_actions' in analysis

    def test_peak_detection(self, engine, sample_forecast):
        """Test peak utilization detection."""
        forecast_24h, forecast_72h = sample_forecast

        analysis = engine.analyze_capacity(
            device_id="router-001",
            interface_name="eth0",
            current_utilization=50.0,
            link_capacity_mbps=10000,
            forecast_24h=forecast_24h.tolist(),
            forecast_72h=forecast_72h.tolist()
        )

        assert analysis['forecast_peak_24h'] == pytest.approx(92, abs=1)
        assert analysis['forecast_peak_72h'] == pytest.approx(96, abs=1)

    def test_risk_score_calculation(self, engine, sample_forecast):
        """Test risk score calculation."""
        forecast_24h, forecast_72h = sample_forecast

        analysis = engine.analyze_capacity(
            device_id="router-001",
            interface_name="eth0",
            current_utilization=50.0,
            link_capacity_mbps=10000,
            forecast_24h=forecast_24h.tolist(),
            forecast_72h=forecast_72h.tolist()
        )

        risk_score = analysis['risk_score']
        assert 0 <= risk_score <= 1
        assert risk_score > 0.9  # High utilization expected

    def test_trend_detection(self, engine):
        """Test trend detection."""
        forecast_24h = np.linspace(40, 80, 24)  # Increasing trend

        analysis = engine.analyze_capacity(
            device_id="router-001",
            interface_name="eth0",
            current_utilization=40.0,
            link_capacity_mbps=10000,
            forecast_24h=forecast_24h.tolist(),
            forecast_72h=forecast_24h.tolist()
        )

        assert analysis['trend'] == "INCREASING"

    def test_alert_evaluation_critical(self, engine):
        """Test CRITICAL alert evaluation."""
        forecast_24h = np.linspace(50, 92, 24)

        alert = engine.evaluate_alerts(
            device_id="router-001",
            interface_name="eth0",
            current_utilization=50.0,
            forecast_24h=forecast_24h.tolist()
        )

        assert alert is not None
        assert alert['severity'] == "CRITICAL"
        assert alert['predicted_utilization'] == pytest.approx(92, abs=1)

    def test_alert_evaluation_warning(self, engine):
        """Test WARNING alert evaluation."""
        forecast_24h = np.linspace(50, 78, 24)

        alert = engine.evaluate_alerts(
            device_id="router-001",
            interface_name="eth0",
            current_utilization=50.0,
            forecast_24h=forecast_24h.tolist()
        )

        assert alert is not None
        assert alert['severity'] == "WARNING"

    def test_alert_evaluation_info(self, engine):
        """Test INFO alert evaluation."""
        forecast_24h = np.linspace(50, 65, 24)

        alert = engine.evaluate_alerts(
            device_id="router-001",
            interface_name="eth0",
            current_utilization=50.0,
            forecast_24h=forecast_24h.tolist()
        )

        assert alert is not None
        assert alert['severity'] == "INFO"

    def test_no_alert(self, engine):
        """Test no alert when below threshold."""
        forecast_24h = np.linspace(40, 55, 24)

        alert = engine.evaluate_alerts(
            device_id="router-001",
            interface_name="eth0",
            current_utilization=40.0,
            forecast_24h=forecast_24h.tolist()
        )

        assert alert is None

    def test_alert_suppression(self, engine):
        """Test alert suppression."""
        forecast_24h = np.linspace(50, 92, 24)

        # First alert should be generated
        alert1 = engine.evaluate_alerts(
            device_id="router-001",
            interface_name="eth0",
            current_utilization=50.0,
            forecast_24h=forecast_24h.tolist()
        )
        assert alert1 is not None

        # Duplicate should be suppressed
        alert2 = engine.evaluate_alerts(
            device_id="router-001",
            interface_name="eth0",
            current_utilization=50.0,
            forecast_24h=forecast_24h.tolist()
        )
        assert alert2 is None

    def test_amdl_trigger(self, engine):
        """Test AMDL action trigger."""
        forecast_24h = np.linspace(50, 92, 24)

        alert = engine.evaluate_alerts(
            device_id="router-001",
            interface_name="eth0",
            current_utilization=50.0,
            forecast_24h=forecast_24h.tolist()
        )

        assert alert is not None
        assert alert['amdl_action_triggered'] is True

    def test_recommendation_generation(self, engine):
        """Test recommendation generation."""
        forecast_24h = np.linspace(50, 96, 24)
        forecast_72h = np.linspace(50, 96, 72)

        analysis = engine.analyze_capacity(
            device_id="router-001",
            interface_name="eth0",
            current_utilization=50.0,
            link_capacity_mbps=1000,  # Small capacity for high headroom usage
            forecast_24h=forecast_24h.tolist(),
            forecast_72h=forecast_72h.tolist()
        )

        recommendations = analysis['recommended_actions']
        assert len(recommendations) > 0
        assert any('Increase' in r for r in recommendations)


class TestAlertManager:
    """Test alert management."""

    @pytest.fixture
    def manager(self):
        """Create alert manager instance."""
        return AlertManager()

    @pytest.fixture
    def sample_alert(self):
        """Generate sample alert."""
        return {
            'alert_id': 'test-alert-001',
            'device_id': 'router-001',
            'interface_name': 'eth0',
            'severity': 'CRITICAL',
            'status': 'ACTIVE',
            'predicted_utilization': 92.0,
            'message': 'High utilization forecast'
        }

    def test_add_alert(self, manager, sample_alert):
        """Test adding alert."""
        alert_id = manager.add_alert(sample_alert)
        assert alert_id == 'test-alert-001'
        assert 'test-alert-001' in manager.active_alerts

    def test_acknowledge_alert(self, manager, sample_alert):
        """Test acknowledging alert."""
        manager.add_alert(sample_alert)
        success = manager.acknowledge_alert(
            'test-alert-001',
            'operator@company.com',
            'Acknowledged'
        )
        assert success is True
        assert manager.active_alerts['test-alert-001']['status'] == 'ACKNOWLEDGED'

    def test_resolve_alert(self, manager, sample_alert):
        """Test resolving alert."""
        manager.add_alert(sample_alert)
        success = manager.resolve_alert(
            'test-alert-001',
            'operator@company.com',
            'Congestion relieved'
        )
        assert success is True
        assert 'test-alert-001' not in manager.active_alerts

    def test_get_active_alerts(self, manager, sample_alert):
        """Test getting active alerts."""
        manager.add_alert(sample_alert)
        active = manager.get_active_alerts()
        assert len(active) == 1
        assert active[0]['alert_id'] == 'test-alert-001'

    def test_alert_statistics(self, manager, sample_alert):
        """Test alert statistics."""
        manager.add_alert(sample_alert)

        stats = manager.get_alert_statistics()
        assert stats['active_count'] == 1
        assert stats['total_count'] == 1
        assert stats['critical_count'] == 1

    def test_unknown_alert_operations(self, manager):
        """Test operations on non-existent alerts."""
        success = manager.acknowledge_alert('unknown', 'user@company.com')
        assert success is False

        success = manager.resolve_alert('unknown', 'user@company.com')
        assert success is False


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
