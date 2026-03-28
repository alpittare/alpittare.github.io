"""
Policy-Based Remediation Engine
Evaluates network metrics against defined policies to determine optimal remediation actions
"""

from enum import Enum
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import logging


class ActionType(Enum):
    """Remediation action types"""
    ALERT_ONLY = "alert_only"
    INTERFACE_BOUNCE = "interface_bounce"
    BGP_SOFT_RESET = "bgp_soft_reset"
    BGP_RESET = "bgp_reset"
    CPU_MITIGATION = "cpu_mitigation"
    STP_PRIORITY_ADJUST = "stp_priority_adjust"
    ROLLBACK = "rollback"


@dataclass
class RemediationAction:
    """Remediation action to be executed"""
    action_type: str
    description: str
    priority: int = 0
    auto_execute: bool = False
    commands: List[str] = field(default_factory=list)


@dataclass
class PolicyRecommendation:
    """Policy-based recommendation"""
    policy_name: str
    action_type: str
    confidence: float
    description: str
    auto_execute: bool


@dataclass
class PolicyEvaluationResult:
    """Result of policy evaluation"""
    recommended_action: ActionType
    matched_policies: List['HealingPolicy']
    confidence: float
    reasoning: str
    approval_required: bool


class HealingPolicy:
    """Defines a policy for automatic healing actions"""

    def __init__(self, name: str, priority: int, conditions: Dict[str, Tuple],
                 action: ActionType, auto_execute: bool, description: str = ""):
        self.name = name
        self.priority = priority
        self.conditions = conditions  # metric -> (operator, threshold)
        self.action = action
        self.auto_execute = auto_execute
        self.description = description

    def matches(self, metrics: Dict[str, float]) -> bool:
        """Check if all conditions match"""
        for metric, (operator, threshold) in self.conditions.items():
            value = metrics.get(metric, 0)

            if operator == ">":
                if not (value > threshold):
                    return False
            elif operator == "<":
                if not (value < threshold):
                    return False
            elif operator == ">=":
                if not (value >= threshold):
                    return False
            elif operator == "<=":
                if not (value <= threshold):
                    return False
            elif operator == "==":
                if not (value == threshold):
                    return False

        return True


class PolicyEngine:
    """
    Policy evaluation engine for determining remediation actions
    Evaluates network metrics against predefined healing policies
    """

    def __init__(self):
        self.policies: List[HealingPolicy] = []
        self.logger = logging.getLogger(__name__)
        self._initialize_default_policies()

    def _initialize_default_policies(self):
        """Initialize default healing policies"""

        # Link down policy
        self.policies.append(HealingPolicy(
            name="Link Down Recovery",
            priority=10,
            conditions={
                'link_utilization_percent': ('<', 1),
                'interface_errors': ('>', 50)
            },
            action=ActionType.INTERFACE_BOUNCE,
            auto_execute=True,
            description="Bounce interface to recover from link down"
        ))

        # BGP flap policy
        self.policies.append(HealingPolicy(
            name="BGP Flap Recovery",
            priority=9,
            conditions={
                'bgp_neighbors_down': ('>', 2),
                'packet_loss_percent': ('>', 10)
            },
            action=ActionType.BGP_SOFT_RESET,
            auto_execute=True,
            description="Soft reset BGP to recover from flapping sessions"
        ))

        # High CPU policy
        self.policies.append(HealingPolicy(
            name="High CPU Mitigation",
            priority=8,
            conditions={
                'cpu_percent': ('>', 80),
                'memory_percent': ('>', 60)
            },
            action=ActionType.CPU_MITIGATION,
            auto_execute=False,
            description="Mitigate high CPU through process management"
        ))

        # High memory policy
        self.policies.append(HealingPolicy(
            name="High Memory Mitigation",
            priority=8,
            conditions={
                'memory_percent': ('>', 85)
            },
            action=ActionType.CPU_MITIGATION,
            auto_execute=False,
            description="Mitigate high memory usage"
        ))

        # Interface errors policy
        self.policies.append(HealingPolicy(
            name="Interface Error Recovery",
            priority=7,
            conditions={
                'interface_errors': ('>', 300)
            },
            action=ActionType.INTERFACE_BOUNCE,
            auto_execute=True,
            description="Bounce interface to clear error counters"
        ))

        # STP loop policy
        self.policies.append(HealingPolicy(
            name="STP Loop Detection",
            priority=9,
            conditions={
                'stp_blocked_ports': ('>', 3),
                'interface_errors': ('>', 500)
            },
            action=ActionType.STP_PRIORITY_ADJUST,
            auto_execute=False,
            description="Adjust STP priority to break spanning tree loop"
        ))

    def evaluate(self, metrics: Dict[str, float]) -> PolicyEvaluationResult:
        """
        Evaluate metrics against all policies and determine recommended action

        Args:
            metrics: Dictionary of current network metrics

        Returns:
            PolicyEvaluationResult with recommended action and confidence
        """

        # Find all matching policies
        matched = []
        for policy in self.policies:
            if policy.matches(metrics):
                matched.append(policy)

        if not matched:
            return PolicyEvaluationResult(
                recommended_action=ActionType.ALERT_ONLY,
                matched_policies=[],
                confidence=0.0,
                reasoning="No policies matched current metrics - alerting only",
                approval_required=False
            )

        # Sort by priority (higher = more important)
        matched.sort(key=lambda p: p.priority, reverse=True)

        # Select highest priority action
        best_policy = matched[0]

        # Calculate confidence (simple: higher priority = higher confidence)
        confidence = min(1.0, (best_policy.priority / 10.0) * 0.9 + 0.1)

        return PolicyEvaluationResult(
            recommended_action=best_policy.action,
            matched_policies=matched,
            confidence=confidence,
            reasoning=f"Policy '{best_policy.name}' matched with {len(matched)} total matches",
            approval_required=not best_policy.auto_execute
        )

    def get_policy_recommendations(self, metrics: Dict[str, float]) -> List[str]:
        """
        Get list of policy recommendations for current metrics

        Args:
            metrics: Current network metrics

        Returns:
            List of recommendation strings
        """

        recommendations = []

        for policy in self.policies:
            if policy.matches(metrics):
                rec = f"Policy '{policy.name}': {policy.description} (Action: {policy.action.value})"
                recommendations.append(rec)

        if not recommendations:
            recommendations.append("No policy recommendations at this time")

        return recommendations
