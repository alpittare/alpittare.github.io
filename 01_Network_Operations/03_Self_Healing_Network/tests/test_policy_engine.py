"""
Tests for Policy Engine - Policy evaluation and decision-making.

Tests policy matching, risk assessment, and decision generation.
"""

import pytest
from datetime import datetime
from src.engine.policy_engine import (
    PolicyEngine,
    PolicyEvaluator,
    HealingPolicy,
    PolicyCondition,
    PolicyAction,
    ActionType,
    PolicyPriority
)


class TestPolicyEvaluator:
    """Test policy evaluation logic"""

    def setup_method(self):
        """Setup test fixtures"""
        self.evaluator = PolicyEvaluator()

    def test_add_policy(self):
        """Test adding a new policy"""
        policy = HealingPolicy(
            policy_id="test-policy-1",
            name="Test Policy",
            description="Test policy description",
            priority=50,
            enabled=True,
            trigger="anomaly_detected",
            conditions=[
                PolicyCondition(metric="latency_ms", operator=">", value=100)
            ],
            actions=[
                PolicyAction(
                    action_type=ActionType.REROUTE_TRAFFIC,
                    parameters={"max_bandwidth_percent": 110}
                )
            ]
        )

        self.evaluator.add_policy(policy)

        assert "test-policy-1" in self.evaluator.policies
        assert self.evaluator.policies["test-policy-1"].name == "Test Policy"

    def test_remove_policy(self):
        """Test removing a policy"""
        policies_before = len(self.evaluator.policies)

        # Remove first policy
        first_policy_id = list(self.evaluator.policies.keys())[0]
        self.evaluator.remove_policy(first_policy_id)

        assert len(self.evaluator.policies) == policies_before - 1
        assert first_policy_id not in self.evaluator.policies

    def test_list_policies(self):
        """Test listing all policies"""
        policies = self.evaluator.list_policies()

        assert len(policies) > 0
        assert all(isinstance(p, HealingPolicy) for p in policies)

    def test_conditions_match(self):
        """Test condition matching logic"""
        policy = self.evaluator.get_policy("latency-spike-recovery")

        # Alert with matching condition
        alert = {
            "alert_id": "alert-1",
            "severity": "High",
            "metrics": {
                "latency_ms": 150,
                "latency_increase_percent": 60
            }
        }

        matches = self.evaluator._conditions_match(policy, alert)
        assert matches is True

    def test_conditions_no_match(self):
        """Test condition non-matching"""
        policy = self.evaluator.get_policy("latency-spike-recovery")

        # Alert without matching condition
        alert = {
            "alert_id": "alert-1",
            "severity": "Low",
            "metrics": {
                "latency_ms": 50,  # Below threshold
                "latency_increase_percent": 10
            }
        }

        matches = self.evaluator._conditions_match(policy, alert)
        assert matches is False

    def test_evaluate_alert_no_match(self):
        """Test alert evaluation with no matching policies"""
        alert = {
            "alert_id": "alert-1",
            "severity": "Low",
            "detection_method": "threshold",
            "metrics": {
                "unknown_metric": 50
            }
        }

        decision = self.evaluator.evaluate(alert)

        assert len(decision.matched_policies) == 0
        assert decision.overall_success is False

    def test_evaluate_alert_with_match(self):
        """Test alert evaluation with matching policy"""
        alert = {
            "alert_id": "alert-1",
            "severity": "High",
            "detection_method": "anomaly_detected",
            "confidence": 0.8,
            "metrics": {
                "latency_ms": 150,
                "latency_increase_percent": 60
            }
        }

        decision = self.evaluator.evaluate(alert)

        assert len(decision.matched_policies) > 0
        assert decision.confidence_score > 0

    def test_confidence_calculation(self):
        """Test confidence score calculation"""
        policies = [
            self.evaluator.get_policy("latency-spike-recovery")
        ]
        alert = {
            "alert_id": "alert-1",
            "confidence": 0.9,
            "metrics": {}
        }

        confidence = self.evaluator._calculate_confidence(policies, alert)

        assert 0.0 <= confidence <= 1.0
        assert confidence > 0.8

    def test_risk_assessment_high(self):
        """Test high-risk remediation assessment"""
        execution_plan = [
            {
                "policy_id": "policy-1",
                "action_type": "scale_capacity",
                "approval_required": True
            }
        ]
        alert = {
            "severity": "Critical",
            "metrics": {}
        }

        risk_level, approval_needed, reason = self.evaluator._assess_risk(
            execution_plan, alert
        )

        assert risk_level in ["Low", "Medium", "High", "Critical"]
        assert approval_needed is True

    def test_policy_priority_ordering(self):
        """Test policies are ordered by priority"""
        policies_list = self.evaluator.list_policies()

        # Check they have varying priorities
        priorities = [p.priority for p in policies_list]
        assert len(set(priorities)) > 1  # At least 2 different priorities


class TestPolicyEngine:
    """Test main PolicyEngine component"""

    def setup_method(self):
        """Setup test fixtures"""
        from config.settings import Settings
        settings = Settings()
        self.engine = PolicyEngine(settings)

    def test_engine_initialization(self):
        """Test engine initializes correctly"""
        assert self.engine.evaluator is not None
        assert len(self.engine.list_policies()) > 0

    def test_evaluate_alert(self):
        """Test alert evaluation through engine"""
        alert = {
            "alert_id": "alert-1",
            "severity": "High",
            "detection_method": "threshold",
            "metrics": {
                "cpu_utilization": 90
            }
        }

        decision = self.engine.evaluate_alert(alert)

        assert decision is not None
        assert decision.alert_id == "alert-1"

    def test_policy_crud_operations(self):
        """Test CRUD operations on policies"""
        policy = HealingPolicy(
            policy_id="test-crud",
            name="CRUD Test Policy",
            description="Test policy",
            priority=50,
            enabled=True,
            trigger="anomaly_detected",
            conditions=[],
            actions=[]
        )

        # Create
        self.engine.add_policy(policy)
        assert self.engine.get_policy("test-crud") is not None

        # Read
        retrieved = self.engine.get_policy("test-crud")
        assert retrieved.name == "CRUD Test Policy"

        # Delete
        self.engine.remove_policy("test-crud")
        assert self.engine.get_policy("test-crud") is None


class TestPolicyDecision:
    """Test policy decision making"""

    def setup_method(self):
        """Setup test fixtures"""
        from config.settings import Settings
        settings = Settings()
        self.engine = PolicyEngine(settings)

    def test_decision_has_execution_plan(self):
        """Test decision includes execution plan"""
        alert = {
            "alert_id": "alert-1",
            "severity": "High",
            "detection_method": "anomaly_detected",
            "confidence": 0.8,
            "metrics": {
                "bgp_flaps": 10,
                "convergence_time": 90
            }
        }

        decision = self.engine.evaluate_alert(alert)

        if len(decision.matched_policies) > 0:
            assert len(decision.execution_plan) > 0
            assert all("action_type" in action for action in decision.execution_plan)

    def test_decision_to_dict(self):
        """Test decision can be serialized"""
        alert = {
            "alert_id": "alert-1",
            "severity": "Medium",
            "detection_method": "threshold",
            "metrics": {}
        }

        decision = self.engine.evaluate_alert(alert)

        decision_dict = decision.to_dict()

        assert isinstance(decision_dict, dict)
        assert "decision_id" in decision_dict
        assert "alert_id" in decision_dict
        assert decision_dict["alert_id"] == "alert-1"


class TestPolicyConditions:
    """Test policy condition evaluation"""

    def test_greater_than_operator(self):
        """Test > operator"""
        condition = PolicyCondition(metric="latency", operator=">", value=100)

        assert condition.operator == ">"

    def test_less_than_operator(self):
        """Test < operator"""
        condition = PolicyCondition(metric="availability", operator="<", value=0.9)

        assert condition.operator == "<"

    def test_equals_operator(self):
        """Test = operator"""
        condition = PolicyCondition(metric="status", operator="=", value="down")

        assert condition.operator == "="


class TestPolicyActions:
    """Test policy actions"""

    def test_action_creation(self):
        """Test creating policy actions"""
        action = PolicyAction(
            action_type=ActionType.REROUTE_TRAFFIC,
            parameters={"max_bandwidth_percent": 110},
            timeout_seconds=120
        )

        assert action.action_type == ActionType.REROUTE_TRAFFIC
        assert action.timeout_seconds == 120

    def test_action_to_dict(self):
        """Test action serialization"""
        action = PolicyAction(
            action_type=ActionType.APPLY_QOS,
            parameters={"rate_limit": 80}
        )

        action_dict = action.to_dict()

        assert action_dict["action_type"] == "apply_qos"
        assert "rate_limit" in action_dict["parameters"]

    def test_rollback_on_failure(self):
        """Test rollback flag on actions"""
        action = PolicyAction(
            action_type=ActionType.RESET_INTERFACE,
            rollback_on_failure=True
        )

        assert action.rollback_on_failure is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
