"""
Safety Guardrails for Self-Healing Actions
Enforces rate limiting, safety thresholds, and maintenance windows
"""

from enum import Enum
from typing import Dict, List, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
from collections import defaultdict
import logging


class GuardrailStatus(Enum):
    """Guardrail status"""
    ALLOWED = "allowed"
    RESTRICTED = "restricted"
    BLOCKED = "blocked"


@dataclass
class GuardrailCheck:
    """Result of a single guardrail check"""
    guardrail_name: str
    action_allowed: bool
    reason: str
    severity: str


@dataclass
class GuardrailCheckResult:
    """Overall guardrail check result"""
    action_allowed: bool
    violations: Dict[str, GuardrailCheck]

    def __getitem__(self, key):
        """Support dictionary-style access"""
        if key == 'action_allowed':
            return self.action_allowed
        elif key == 'violations':
            return self.violations
        raise KeyError(f"Unknown key: {key}")


class GuardrailManager:
    """
    Manages safety guardrails for remediation actions
    Enforces rate limiting, thresholds, and maintenance windows
    """

    def __init__(self):
        self.logger = logging.getLogger(__name__)

        # Rate limiting
        self.max_actions_per_hour = 5
        self.action_history: List[Tuple[str, datetime]] = []

        # Safety thresholds
        self.min_health_score_for_action = 20.0
        self.max_consecutive_actions = 3

        # Maintenance windows (UTC)
        self.maintenance_window_start_hour = 2
        self.maintenance_window_end_hour = 6

        # Action tracking
        self.consecutive_action_count = 0
        self.last_action_time: Dict[str, datetime] = {}

    def check_all_guardrails(self, health_score: float) -> GuardrailCheckResult:
        """
        Check all safety guardrails

        Args:
            health_score: Current system health score (0-100)

        Returns:
            GuardrailCheckResult with status and violations
        """

        violations = {}

        # Check rate limiting
        rate_check = self._check_rate_limit()
        if not rate_check[0]:
            violations['rate_limit'] = GuardrailCheck(
                guardrail_name="Rate Limiting",
                action_allowed=False,
                reason=rate_check[1],
                severity="HIGH"
            )

        # Check health threshold
        health_check = self._check_health_threshold(health_score)
        if not health_check[0]:
            violations['health_threshold'] = GuardrailCheck(
                guardrail_name="Health Threshold",
                action_allowed=False,
                reason=health_check[1],
                severity="CRITICAL"
            )

        # Check maintenance window
        maint_check = self._check_maintenance_window()
        if not maint_check[0]:
            violations['maintenance_window'] = GuardrailCheck(
                guardrail_name="Maintenance Window",
                action_allowed=False,
                reason=maint_check[1],
                severity="MEDIUM"
            )

        # Check consecutive actions
        conseq_check = self._check_consecutive_actions()
        if not conseq_check[0]:
            violations['consecutive_actions'] = GuardrailCheck(
                guardrail_name="Consecutive Actions",
                action_allowed=False,
                reason=conseq_check[1],
                severity="HIGH"
            )

        return GuardrailCheckResult(
            action_allowed=len(violations) == 0,
            violations=violations
        )

    def check_safe(self, action: str) -> Tuple[bool, str]:
        """
        Check if an action is safe to execute

        Args:
            action: Action type to check

        Returns:
            Tuple of (allowed, reason)
        """

        # Basic rate limit check
        if not self._check_rate_limit()[0]:
            return False, "Rate limit exceeded"

        # Maintenance window check
        if not self._check_maintenance_window()[0]:
            return False, "Outside allowed maintenance window"

        return True, "Action is safe to execute"

    def is_within_limits(self) -> bool:
        """Check if within rate limits"""
        return self._check_rate_limit()[0]

    def get_guardrail_status(self) -> Dict[str, any]:
        """Get current guardrail status"""
        return {
            'rate_limited': not self._check_rate_limit()[0],
            'actions_this_hour': self._count_actions_this_hour(),
            'max_actions_per_hour': self.max_actions_per_hour,
            'consecutive_actions': self.consecutive_action_count,
            'in_maintenance_window': self._is_in_maintenance_window(),
            'maintenance_window': f"UTC {self.maintenance_window_start_hour:02d}:00-{self.maintenance_window_end_hour:02d}:00"
        }

    def record_remediation_action(self, action_type: str, health_score: float):
        """
        Record that a remediation action was executed

        Args:
            action_type: Type of action executed
            health_score: Health score at time of action
        """

        now = datetime.utcnow()
        self.action_history.append((action_type, now))
        self.consecutive_action_count += 1
        self.last_action_time[action_type] = now

        self.logger.info(
            f"Recorded action: {action_type} at {now.isoformat()}, health={health_score:.1f}"
        )

    def _check_rate_limit(self) -> Tuple[bool, str]:
        """Check if rate limit is exceeded"""
        count = self._count_actions_this_hour()

        if count >= self.max_actions_per_hour:
            return False, f"Rate limit exceeded: {count}/{self.max_actions_per_hour} actions this hour"

        return True, ""

    def _check_health_threshold(self, health_score: float) -> Tuple[bool, str]:
        """Check if health score is above minimum threshold"""
        if health_score < self.min_health_score_for_action:
            return False, f"Health score {health_score:.1f} below minimum {self.min_health_score_for_action}"

        return True, ""

    def _check_maintenance_window(self) -> Tuple[bool, str]:
        """Check if current time is within maintenance window"""
        if self._is_in_maintenance_window():
            return True, ""

        return False, f"Outside maintenance window (UTC {self.maintenance_window_start_hour:02d}:00-{self.maintenance_window_end_hour:02d}:00)"

    def _check_consecutive_actions(self) -> Tuple[bool, str]:
        """Check consecutive action limit"""
        if self.consecutive_action_count >= self.max_consecutive_actions:
            return False, f"Maximum consecutive actions ({self.max_consecutive_actions}) reached"

        return True, ""

    def _count_actions_this_hour(self) -> int:
        """Count actions executed in the last hour"""
        now = datetime.utcnow()
        one_hour_ago = now - timedelta(hours=1)

        count = sum(1 for _, timestamp in self.action_history
                   if timestamp > one_hour_ago)

        return count

    def _is_in_maintenance_window(self) -> bool:
        """Check if current time is in maintenance window"""
        now = datetime.utcnow()
        current_hour = now.hour

        if self.maintenance_window_start_hour <= self.maintenance_window_end_hour:
            return self.maintenance_window_start_hour <= current_hour < self.maintenance_window_end_hour
        else:
            # Window wraps around midnight
            return current_hour >= self.maintenance_window_start_hour or current_hour < self.maintenance_window_end_hour

    def reset_consecutive_actions(self):
        """Reset consecutive action counter"""
        self.consecutive_action_count = 0
        self.logger.info("Reset consecutive action counter")

    def cleanup_old_history(self, hours: int = 24):
        """Clean up action history older than specified hours"""
        cutoff = datetime.utcnow() - timedelta(hours=hours)
        original_len = len(self.action_history)

        self.action_history = [(action, ts) for action, ts in self.action_history if ts > cutoff]

        removed = original_len - len(self.action_history)
        if removed > 0:
            self.logger.info(f"Cleaned up {removed} old action history entries")
