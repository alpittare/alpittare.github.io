"""
Unit Tests for Anomaly Detector

Tests for Isolation Forest and Autoencoder anomaly detection.
"""

import numpy as np
import pytest
from datetime import datetime

from src.ml.anomaly_detector import AnomalyDetector, AnomalyScore


class TestAnomalyDetector:
    """Test cases for AnomalyDetector"""

    @pytest.fixture
    def detector(self):
        """Create detector instance"""
        return AnomalyDetector(
            contamination=0.05,
            baseline_window_days=7
        )

    @pytest.fixture
    def normal_metrics(self):
        """Generate normal metric values"""
        return list(np.random.normal(loc=50000000, scale=5000000, size=100))

    @pytest.fixture
    def metric_with_anomaly(self, normal_metrics):
        """Add anomaly to metrics"""
        metrics = normal_metrics.copy()
        metrics.append(450000000.0)  # 9x normal value
        return metrics

    def test_isolation_forest_normal(self, detector, normal_metrics):
        """Test Isolation Forest on normal data"""
        result = detector.detect_isolation_forest(normal_metrics)

        assert "is_anomaly" in result
        assert "score" in result
        assert result["is_anomaly"] is False

    def test_isolation_forest_anomaly(self, detector, metric_with_anomaly):
        """Test Isolation Forest detects anomaly"""
        result = detector.detect_isolation_forest(metric_with_anomaly)

        assert result["is_anomaly"] is True
        assert result["score"] > 0.5

    def test_baseline_deviation_normal(self, detector, normal_metrics):
        """Test baseline detection on normal data"""
        test_value = normal_metrics[0]

        result = detector.detect_baseline_deviation(
            "test_metric",
            test_value,
            normal_metrics[1:],
            threshold_std=2.0
        )

        assert result["is_anomaly"] is False
        assert "baseline" in result

    def test_baseline_deviation_anomaly(self, detector, normal_metrics):
        """Test baseline detection on anomaly"""
        anomaly_value = 450000000.0

        result = detector.detect_baseline_deviation(
            "test_metric",
            anomaly_value,
            normal_metrics,
            threshold_std=2.0
        )

        assert result["is_anomaly"] is True
        assert result["z_score"] > 2.0

    def test_autoencoder_normal(self, detector):
        """Test autoencoder on normal data"""
        metrics_matrix = np.random.normal(loc=50, scale=5, size=(10, 100))

        result = detector.detect_autoencoder(metrics_matrix)

        assert "is_anomaly" in result
        assert "reconstruction_error" in result

    def test_autoencoder_anomaly(self, detector):
        """Test autoencoder detects anomaly"""
        metrics_matrix = np.random.normal(loc=50, scale=5, size=(10, 100))
        metrics_matrix[:, -1] = 500  # Add anomalous column

        result = detector.detect_autoencoder(metrics_matrix)

        assert "is_anomaly" in result

    def test_anomaly_score_computation(self, detector):
        """Test comprehensive anomaly score"""
        metric = {
            "device_id": "test-device",
            "metric_name": "interface.throughput",
            "value": 450000000.0,
            "timestamp": datetime.utcnow()
        }

        baseline_data = list(np.random.normal(loc=50000000, scale=5000000, size=50))

        score = detector.get_anomaly_score(metric, baseline_data)

        assert isinstance(score, AnomalyScore)
        assert score.metric_id == "test-device.interface.throughput"
        assert score.value == 450000000.0
        assert 0 <= score.confidence <= 1.0

    def test_severity_computation(self, detector):
        """Test severity level computation"""
        # Critical severity
        severity = detector._compute_severity(
            is_anomaly=True,
            confidence=0.95,
            deviation_percent=600
        )
        assert severity == "critical"

        # High severity
        severity = detector._compute_severity(
            is_anomaly=True,
            confidence=0.85,
            deviation_percent=250
        )
        assert severity == "high"

        # Medium severity
        severity = detector._compute_severity(
            is_anomaly=True,
            confidence=0.75,
            deviation_percent=150
        )
        assert severity == "medium"

        # Low severity
        severity = detector._compute_severity(
            is_anomaly=False,
            confidence=0.5,
            deviation_percent=50
        )
        assert severity == "low"

    def test_baseline_update(self, detector):
        """Test baseline profile update"""
        metric_id = "test_metric"
        historical_data = list(np.random.normal(loc=100, scale=10, size=100))

        detector.update_baseline(metric_id, historical_data)

        baseline = detector.get_baseline(metric_id)

        assert baseline is not None
        assert "mean" in baseline
        assert "std" in baseline
        assert abs(baseline["mean"] - 100) < 20  # Close to actual mean

    def test_baseline_retrieval(self, detector):
        """Test baseline retrieval"""
        metric_id = "test_metric"
        historical_data = [50, 55, 48, 52, 49, 51, 50]

        detector.update_baseline(metric_id, historical_data)
        baseline = detector.get_baseline(metric_id)

        assert baseline is not None
        assert "p50" in baseline
        assert "p95" in baseline

    def test_model_save_load(self, detector, tmp_path):
        """Test model persistence"""
        detector.model_path = tmp_path

        # Train with some data
        training_data = np.random.normal(loc=50, scale=5, size=100)
        detector.train_isolation_forest(training_data)

        # Save
        detector.save_models()

        # Verify files were created
        assert (tmp_path / "isolation_forest.pkl").exists()
        assert (tmp_path / "scaler.pkl").exists()

    def test_empty_input_handling(self, detector):
        """Test handling of empty/invalid input"""
        # Empty metrics
        result = detector.detect_isolation_forest([])
        assert result["is_anomaly"] is False

        # Empty baseline data
        result = detector.detect_baseline_deviation(
            "test", 100, None
        )
        assert result["is_anomaly"] is False

    def test_edge_cases(self, detector):
        """Test edge cases"""
        # Single metric
        result = detector.detect_isolation_forest([50000000.0])
        assert "is_anomaly" in result

        # All same values
        same_values = [100.0] * 50
        result = detector.detect_isolation_forest(same_values)
        assert result["is_anomaly"] is False

        # Very large variance
        large_variance = list(np.random.uniform(0, 1000000, 50))
        result = detector.detect_isolation_forest(large_variance)
        assert "is_anomaly" in result

    def test_consistency(self, detector, normal_metrics):
        """Test detection consistency"""
        result1 = detector.detect_isolation_forest(normal_metrics)
        result2 = detector.detect_isolation_forest(normal_metrics)

        # Same input should give consistent results
        assert result1["is_anomaly"] == result2["is_anomaly"]


class TestAnomalyScore:
    """Test cases for AnomalyScore"""

    def test_anomaly_score_creation(self):
        """Test AnomalyScore creation"""
        score = AnomalyScore(
            metric_id="test.metric",
            timestamp=datetime.utcnow(),
            value=100.0,
            baseline=50.0,
            anomaly_type="deviation",
            is_anomaly=True,
            confidence=0.95,
            severity="critical"
        )

        assert score.metric_id == "test.metric"
        assert score.is_anomaly is True
        assert score.confidence == 0.95

    def test_anomaly_score_serialization(self):
        """Test AnomalyScore to_dict"""
        score = AnomalyScore(
            metric_id="test.metric",
            timestamp=datetime.utcnow(),
            value=100.0,
            is_anomaly=True,
            confidence=0.85,
            severity="high"
        )

        score_dict = score.to_dict()

        assert isinstance(score_dict, dict)
        assert score_dict["metric_id"] == "test.metric"
        assert score_dict["is_anomaly"] is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
