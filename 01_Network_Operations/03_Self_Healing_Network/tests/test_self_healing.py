"""
Unit Tests for Self-Healing Network Components
"""

import sys
sys.path.insert(0, '/sessions/epic-stoic-mendel/mnt/claude_folder/03_Self_Healing_Network/models')
sys.path.insert(0, '/sessions/epic-stoic-mendel/mnt/claude_folder/03_Self_Healing_Network/engine')
sys.path.insert(0, '/sessions/epic-stoic-mendel/mnt/claude_folder/03_Self_Healing_Network/data')

import unittest
from fault_detector import FaultDetector, AnomalyLevel
from anomaly_classifier import FaultClassifier, FaultClass
from health_scorer import HealthScorer
from failure_predictor import LogisticRegressionPredictor
from policy_engine import PolicyEngine, ActionType as PolicyActionType
from guardrails import GuardrailManager, RateLimiter
from remediation import RemediationExecutor
from verification import RemediationVerifier


class TestAnomalyDetection(unittest.TestCase):
    """Test anomaly detection"""
    
    def setUp(self):
        self.detector = FaultDetector()
    
    def test_normal_metrics(self):
        """Test normal metrics don't trigger anomalies"""
        result = self.detector.detect_anomaly(
            timestamp="2026-01-01T00:00:00",
            metric_name="cpu_percent",
            value=35.0
        )
        self.assertIsNone(result)
    
    def test_critical_anomaly(self):
        """Test critical metric triggers anomaly"""
        # Add some baseline data
        for i in range(20):
            self.detector.add_metric("cpu_percent", 30.0)
        
        result = self.detector.detect_anomaly(
            timestamp="2026-01-01T00:00:00",
            metric_name="cpu_percent",
            value=95.0
        )
        self.assertIsNotNone(result)
        self.assertEqual(result.anomaly_level, AnomalyLevel.CRITICAL)


class TestFaultClassification(unittest.TestCase):
    """Test fault classification"""
    
    def setUp(self):
        self.classifier = FaultClassifier()
    
    def test_interface_down_classification(self):
        """Test interface down detection"""
        metrics = {
            'cpu_percent': 30,
            'memory_percent': 40,
            'interface_errors': 500,
            'packet_loss_percent': 80,
            'bgp_neighbors_up': 8,
            'bgp_neighbors_down': 0,
            'stp_blocked_ports': 0,
            'link_utilization_percent': 0.5
        }
        result = self.classifier.classify(metrics)
        self.assertEqual(result.fault_class, FaultClass.INTERFACE_DOWN)
        self.assertGreater(result.confidence, 0.8)
    
    def test_high_cpu_classification(self):
        """Test high CPU detection"""
        metrics = {
            'cpu_percent': 90,
            'memory_percent': 80,
            'interface_errors': 50,
            'packet_loss_percent': 2,
            'bgp_neighbors_up': 8,
            'bgp_neighbors_down': 0,
            'stp_blocked_ports': 0,
            'link_utilization_percent': 50
        }
        result = self.classifier.classify(metrics)
        self.assertEqual(result.fault_class, FaultClass.HIGH_CPU)


class TestHealthScoring(unittest.TestCase):
    """Test health scoring"""
    
    def setUp(self):
        self.scorer = HealthScorer()
    
    def test_healthy_device(self):
        """Test healthy device scoring"""
        metrics = {
            'cpu_percent': 30,
            'memory_percent': 40,
            'interface_errors': 10,
            'packet_loss_percent': 0.5,
            'bgp_neighbors_up': 8,
            'bgp_neighbors_down': 0,
            'link_utilization_percent': 45
        }
        score = self.scorer.calculate_health(metrics)
        self.assertGreater(score.overall_score, 80)
        self.assertEqual(score.risk_level, "low")
    
    def test_critical_device(self):
        """Test critical device scoring"""
        metrics = {
            'cpu_percent': 95,
            'memory_percent': 95,
            'interface_errors': 2000,
            'packet_loss_percent': 50,
            'bgp_neighbors_up': 2,
            'bgp_neighbors_down': 6,
            'link_utilization_percent': 2
        }
        score = self.scorer.calculate_health(metrics)
        self.assertLess(score.overall_score, 40)
        self.assertEqual(score.risk_level, "critical")


class TestPolicyEngine(unittest.TestCase):
    """Test policy engine"""
    
    def setUp(self):
        self.engine = PolicyEngine()
    
    def test_bgp_flap_policy_match(self):
        """Test BGP flap policy matching"""
        metrics = {
            'bgp_neighbors_down': 3,
            'packet_loss_percent': 20,
            'cpu_percent': 30,
            'memory_percent': 40,
            'interface_errors': 50,
            'link_utilization_percent': 50,
            'stp_blocked_ports': 0,
            'bgp_neighbors_up': 5
        }
        result = self.engine.evaluate(metrics)
        self.assertEqual(result.recommended_action, PolicyActionType.BGP_SOFT_RESET)
    
    def test_stp_loop_policy_match(self):
        """Test STP loop policy matching"""
        metrics = {
            'stp_blocked_ports': 5,
            'interface_errors': 2000,
            'cpu_percent': 30,
            'memory_percent': 40,
            'bgp_neighbors_down': 0,
            'packet_loss_percent': 20,
            'link_utilization_percent': 50,
            'bgp_neighbors_up': 8
        }
        result = self.engine.evaluate(metrics)
        self.assertEqual(result.recommended_action, PolicyActionType.STP_PRIORITY_ADJUST)


class TestGuardrails(unittest.TestCase):
    """Test safety guardrails"""
    
    def test_rate_limiter(self):
        """Test rate limiting"""
        limiter = RateLimiter(max_per_hour=2)
        
        # First action should succeed
        self.assertTrue(limiter.can_execute())
        limiter.record_action("test1")
        
        # Second action should succeed
        self.assertTrue(limiter.can_execute())
        limiter.record_action("test2")
        
        # Third action should fail
        self.assertFalse(limiter.can_execute())


class TestRemediationExecutor(unittest.TestCase):
    """Test remediation execution"""
    
    def setUp(self):
        self.executor = RemediationExecutor()
    
    def test_interface_bounce_action_generation(self):
        """Test interface bounce action generation"""
        action = self.executor.generate_interface_bounce_action("Ethernet1/1")
        self.assertEqual(action.action_type, "interface_bounce")
        self.assertEqual(action.target, "Ethernet1/1")
        self.assertGreater(len(action.commands), 0)
        self.assertEqual(action.risk_level, "low")
    
    def test_action_validation(self):
        """Test action validation"""
        action = self.executor.generate_interface_bounce_action("Ethernet1/1")
        self.assertTrue(self.executor.validate_action(action))


class TestVerification(unittest.TestCase):
    """Test post-remediation verification"""
    
    def setUp(self):
        self.verifier = RemediationVerifier()
    
    def test_interface_bounce_verification(self):
        """Test interface bounce verification"""
        before = {
            'link_utilization_percent': 0.5,
            'interface_errors': 500,
            'packet_loss_percent': 80
        }
        after = {
            'link_utilization_percent': 50,
            'interface_errors': 50,
            'packet_loss_percent': 10
        }
        result = self.verifier.verify('interface_bounce', before, after)
        self.assertEqual(result.status.value, 'success')
        self.assertGreater(result.improvement_score, 50)


def run_tests():
    """Run all tests"""
    unittest.main(argv=[''], exit=False, verbosity=2)


if __name__ == '__main__':
    run_tests()
