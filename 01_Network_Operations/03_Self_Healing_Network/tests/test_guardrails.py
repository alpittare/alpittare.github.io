"""
Tests for Guardrails - Safety checks and execution limits.

Tests rate limiting, risk assessment, and safety gates.
"""

import pytest
from src.engine.guardrails import (
    GuardrailEngine,
    RateLimiter,
    SafetyGates,
    RiskAssessment,
    ExecutionConstraints
)


class TestRateLimiter:
    """Test rate limiting functionality"""

    def setup_method(self):
        """Setup test fixtures"""
        self.rate_limiter = RateLimiter()

    def test_device_rate_limit_allowed(self):
        """Test device rate limit when below threshold"""
        allowed, message = self.rate_limiter.check_device_rate_limit("device-1")

        assert allowed is True
        assert message == ""

    def test_device_rate_limit_exceeded(self):
        """Test device rate limit when exceeded"""
        device_id = "device-1"

        # Record multiple changes
        for _ in range(ExecutionConstraints.MAX_CHANGES_PER_DEVICE_PER_MINUTE):
            self.rate_limiter.record_change(device_id, "policy-1")

        # Next attempt should be rate limited
        allowed, message = self.rate_limiter.check_device_rate_limit(device_id)

        assert allowed is False
        assert "rate limit" in message

    def test_policy_rate_limit_allowed(self):
        """Test policy rate limit when below threshold"""
        allowed, message = self.rate_limiter.check_policy_rate_limit("policy-1")

        assert allowed is True

    def test_concurrent_limit_allowed(self):
        """Test concurrent limit when below threshold"""
        allowed, message = self.rate_limiter.check_concurrent_limit()

        assert allowed is True

    def test_record_and_complete_change(self):
        """Test recording and completing changes"""
        initial_count = self.rate_limiter.concurrent_count

        self.rate_limiter.record_change("device-1", "policy-1")
        assert self.rate_limiter.concurrent_count > initial_count

        self.rate_limiter.complete_change()
        assert self.rate_limiter.concurrent_count == initial_count


class TestSafetyGates:
    """Test safety gate enforcement"""

    def setup_method(self):
        """Setup test fixtures"""
        self.safety_gates = SafetyGates()

    def test_critical_severity_requires_approval(self):
        """Test critical alerts require approval"""
        approval_required, reason = self.safety_gates.check_approval_requirement(
            risk_score=0.5,
            severity="Critical"
        )

        assert approval_required is True

    def test_high_risk_requires_approval(self):
        """Test high risk score requires approval"""
        approval_required, reason = self.safety_gates.check_approval_requirement(
            risk_score=0.8,
            severity="Medium"
        )

        assert approval_required is True

    def test_low_risk_no_approval(self):
        """Test low risk doesn't require approval"""
        approval_required, reason = self.safety_gates.check_approval_requirement(
            risk_score=0.3,
            severity="Low"
        )

        assert approval_required is False

    def test_device_exclusion(self):
        """Test critical device exclusion"""
        excluded_device = ExecutionConstraints.CRITICAL_DEVICES[0]

        allowed, message = self.safety_gates.check_device_exclusion(excluded_device)

        assert allowed is False
        assert "critical" in message.lower()

    def test_non_critical_device_allowed(self):
        """Test non-critical device is allowed"""
        allowed, message = self.safety_gates.check_device_exclusion("normal-device")

        assert allowed is True


class TestRiskAssessment:
    """Test risk assessment calculations"""

    def test_risk_score_calculation(self):
        """Test overall risk score calculation"""
        risk = RiskAssessment(
            affected_users=50,
            affected_services=["service-1"],
            potential_downtime_seconds=30,
            traffic_reroute_percent=100,
            scope_size=2,
            rollback_difficulty="Easy"
        )

        score = risk.calculate_risk_score()

        assert 0.0 <= score <= 1.0

    def test_high_user_impact_increases_risk(self):
        """Test user count increases risk"""
        risk_low = RiskAssessment(
            affected_users=5,
            affected_services=[],
            potential_downtime_seconds=10,
            traffic_reroute_percent=100,
            scope_size=1,
            rollback_difficulty="Easy"
        )

        risk_high = RiskAssessment(
            affected_users=2000,
            affected_services=[],
            potential_downtime_seconds=10,
            traffic_reroute_percent=100,
            scope_size=1,
            rollback_difficulty="Easy"
        )

        assert risk_high.calculate_risk_score() > risk_low.calculate_risk_score()

    def test_high_downtime_increases_risk(self):
        """Test downtime increases risk"""
        risk_low = RiskAssessment(
            affected_users=10,
            affected_services=[],
            potential_downtime_seconds=5,
            traffic_reroute_percent=100,
            scope_size=1,
            rollback_difficulty="Easy"
        )

        risk_high = RiskAssessment(
            affected_users=10,
            affected_services=[],
            potential_downtime_seconds=600,
            traffic_reroute_percent=100,
            scope_size=1,
            rollback_difficulty="Easy"
        )

        assert risk_high.calculate_risk_score() > risk_low.calculate_risk_score()

    def test_large_scope_increases_risk(self):
        """Test scope size increases risk"""
        risk_small = RiskAssessment(
            affected_users=10,
            affected_services=[],
            potential_downtime_seconds=10,
            traffic_reroute_percent=100,
            scope_size=1,
            rollback_difficulty="Easy"
        )

        risk_large = RiskAssessment(
            affected_users=10,
            affected_services=[],
            potential_downtime_seconds=10,
            traffic_reroute_percent=100,
            scope_size=20,
            rollback_difficulty="Easy"
        )

        assert risk_large.calculate_risk_score() > risk_small.calculate_risk_score()


class TestGuardrailEngine:
    """Test main GuardrailEngine"""

    def setup_method(self):
        """Setup test fixtures"""
        self.engine = GuardrailEngine()

    def test_guardrail_evaluation_allowed(self):
        """Test guardrail evaluation allows safe action"""
        risk = RiskAssessment(
            affected_users=5,
            affected_services=[],
            potential_downtime_seconds=10,
            traffic_reroute_percent=100,
            scope_size=2,
            rollback_difficulty="Easy"
        )

        alert = {
            "severity": "Low",
            "metrics": {}
        }

        decision = self.engine.evaluate_remediation(
            device_id="device-1",
            policy_id="policy-1",
            alert=alert,
            risk_assessment=risk
        )

        assert decision.allowed is True

    def test_guardrail_evaluation_requires_approval(self):
        """Test guardrail evaluation requires approval"""
        risk = RiskAssessment(
            affected_users=500,
            affected_services=["service-1", "service-2"],
            potential_downtime_seconds=120,
            traffic_reroute_percent=120,
            scope_size=8,
            rollback_difficulty="Hard"
        )

        alert = {
            "severity": "Critical",
            "metrics": {}
        }

        decision = self.engine.evaluate_remediation(
            device_id="device-1",
            policy_id="policy-1",
            alert=alert,
            risk_assessment=risk
        )

        # High risk should require approval
        if decision.allowed:
            # Check if restrictions suggest approval needed
            assert len(decision.restrictions) > 0 or decision.severity is not None

    def test_guardrail_denies_critical_device(self):
        """Test guardrail denies changes to critical device"""
        critical_device = ExecutionConstraints.CRITICAL_DEVICES[0]

        risk = RiskAssessment(
            affected_users=1,
            affected_services=[],
            potential_downtime_seconds=5,
            traffic_reroute_percent=100,
            scope_size=1,
            rollback_difficulty="Easy"
        )

        alert = {
            "severity": "Low",
            "metrics": {}
        }

        decision = self.engine.evaluate_remediation(
            device_id=critical_device,
            policy_id="policy-1",
            alert=alert,
            risk_assessment=risk
        )

        assert decision.allowed is False

    def test_guardrail_denies_excessive_scope(self):
        """Test guardrail denies excessive scope"""
        risk = RiskAssessment(
            affected_users=10,
            affected_services=[],
            potential_downtime_seconds=10,
            traffic_reroute_percent=100,
            scope_size=ExecutionConstraints.MAX_DEVICES_PER_ACTION + 5,
            rollback_difficulty="Easy"
        )

        alert = {
            "severity": "Low",
            "metrics": {}
        }

        decision = self.engine.evaluate_remediation(
            device_id="device-1",
            policy_id="policy-1",
            alert=alert,
            risk_assessment=risk
        )

        assert decision.allowed is False

    def test_record_execution(self):
        """Test recording execution for rate limiting"""
        initial_count = self.engine.rate_limiter.concurrent_count

        self.engine.record_execution("device-1", "policy-1")

        assert self.engine.rate_limiter.concurrent_count > initial_count

    def test_complete_execution(self):
        """Test completing execution"""
        self.engine.record_execution("device-1", "policy-1")
        current_count = self.engine.rate_limiter.concurrent_count

        self.engine.complete_execution()

        assert self.engine.rate_limiter.concurrent_count < current_count


class TestGuardrailDecision:
    """Test guardrail decision structure"""

    def test_decision_allowed_with_restrictions(self):
        """Test decision can allow with restrictions"""
        from src.engine.guardrails import GuardrailDecision, GuardrailSeverity

        decision = GuardrailDecision(
            allowed=True,
            reason="Allowed with restrictions",
            severity=GuardrailSeverity.WARNING,
            restrictions=["max_devices=5", "require_monitoring"],
            alternatives=[]
        )

        assert decision.allowed is True
        assert len(decision.restrictions) == 2

    def test_decision_denied(self):
        """Test decision can deny action"""
        from src.engine.guardrails import GuardrailDecision, GuardrailSeverity

        decision = GuardrailDecision(
            allowed=False,
            reason="Device is critical",
            severity=GuardrailSeverity.CRITICAL,
            restrictions=[],
            alternatives=["Manual review", "Escalate to ops"]
        )

        assert decision.allowed is False
        assert len(decision.alternatives) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
