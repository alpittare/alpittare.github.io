"""
Remediation Verification Engine
Verifies effectiveness of remediation actions by comparing before/after metrics
"""

from enum import Enum
from typing import Dict, Optional
from dataclasses import dataclass
from datetime import datetime
import logging


class VerificationStatus(Enum):
    """Status of remediation verification"""
    PENDING = "pending"
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"
    INCONCLUSIVE = "inconclusive"


@dataclass
class VerificationResult:
    """Result of verifying a remediation action"""
    action_type: str
    status: VerificationStatus
    improvement_score: float  # 0-100, percent improvement
    before_metrics: Dict[str, float]
    after_metrics: Dict[str, float]
    key_improvements: Dict[str, float]  # metric -> improvement percent
    analysis: str
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()


class RemediationVerifier:
    """
    Verifies the effectiveness of remediation actions
    Compares metrics before and after remediation
    """

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.verification_history = []

        # Thresholds for what constitutes successful remediation
        self.success_threshold = 50.0  # 50% improvement needed
        self.partial_threshold = 20.0  # 20% improvement = partial success

    def verify(self, action_type: str, before_metrics: Dict[str, float],
               after_metrics: Dict[str, float]) -> VerificationResult:
        """
        Verify effectiveness of a remediation action

        Args:
            action_type: Type of action that was executed
            before_metrics: Metrics before remediation
            after_metrics: Metrics after remediation

        Returns:
            VerificationResult with verification status and metrics
        """

        # Calculate improvements for key metrics based on action type
        key_improvements = self._calculate_improvements(action_type, before_metrics, after_metrics)

        # Calculate overall improvement score
        overall_improvement = self._calculate_overall_improvement(action_type, key_improvements)

        # Determine status based on improvement
        status = self._determine_status(overall_improvement)

        # Generate analysis
        analysis = self._generate_analysis(action_type, key_improvements, status)

        result = VerificationResult(
            action_type=action_type,
            status=status,
            improvement_score=overall_improvement,
            before_metrics=before_metrics.copy(),
            after_metrics=after_metrics.copy(),
            key_improvements=key_improvements,
            analysis=analysis
        )

        self.verification_history.append(result)
        return result

    def check_health_restored(self) -> bool:
        """
        Check if system health has been restored to acceptable levels

        Returns:
            True if health is acceptable, False otherwise
        """

        if not self.verification_history:
            return False

        # Check if most recent verification was successful
        latest = self.verification_history[-1]
        return latest.status in [VerificationStatus.SUCCESS, VerificationStatus.PARTIAL]

    def get_verification_report(self) -> Dict:
        """
        Generate comprehensive verification report

        Returns:
            Dictionary containing verification statistics
        """

        if not self.verification_history:
            return {
                'total_verifications': 0,
                'successful': 0,
                'partial': 0,
                'failed': 0,
                'success_rate': 0.0,
                'average_improvement': 0.0,
            }

        total = len(self.verification_history)
        successful = sum(1 for v in self.verification_history
                        if v.status == VerificationStatus.SUCCESS)
        partial = sum(1 for v in self.verification_history
                     if v.status == VerificationStatus.PARTIAL)
        failed = sum(1 for v in self.verification_history
                    if v.status == VerificationStatus.FAILED)

        avg_improvement = sum(v.improvement_score for v in self.verification_history) / total

        return {
            'total_verifications': total,
            'successful': successful,
            'partial': partial,
            'failed': failed,
            'inconclusive': total - (successful + partial + failed),
            'success_rate': (successful / total * 100) if total > 0 else 0.0,
            'average_improvement': avg_improvement,
            'last_verification': self.verification_history[-1] if self.verification_history else None
        }

    def _calculate_improvements(self, action_type: str, before: Dict[str, float],
                               after: Dict[str, float]) -> Dict[str, float]:
        """
        Calculate metric improvements for specific action type

        Args:
            action_type: Type of remediation action
            before: Before metrics
            after: After metrics

        Returns:
            Dictionary of metric improvements (percent)
        """

        improvements = {}

        # Define which metrics to check based on action type
        metric_map = {
            'interface_bounce': [
                'link_utilization_percent',
                'interface_errors',
                'packet_loss_percent'
            ],
            'bgp_soft_reset': [
                'bgp_neighbors_down',
                'bgp_neighbors_up',
                'packet_loss_percent'
            ],
            'bgp_reset': [
                'bgp_neighbors_down',
                'bgp_neighbors_up',
                'packet_loss_percent'
            ],
            'cpu_mitigation': [
                'cpu_percent',
                'memory_percent'
            ],
            'stp_priority_adjust': [
                'stp_blocked_ports',
                'interface_errors'
            ]
        }

        metrics_to_check = metric_map.get(action_type, [])

        for metric in metrics_to_check:
            before_val = before.get(metric, 0)
            after_val = after.get(metric, 0)

            # Calculate improvement (different logic for different metrics)
            if metric in ['cpu_percent', 'memory_percent', 'interface_errors',
                         'packet_loss_percent', 'stp_blocked_ports', 'bgp_neighbors_down']:
                # Lower is better
                if before_val > 0:
                    improvement = ((before_val - after_val) / before_val) * 100
                else:
                    improvement = 0.0
            else:
                # Higher is better (utilization, neighbors up, etc)
                if before_val > 0:
                    improvement = ((after_val - before_val) / before_val) * 100
                else:
                    improvement = 0.0

            improvements[metric] = max(0, improvement)  # Don't report negative improvements

        return improvements

    def _calculate_overall_improvement(self, action_type: str,
                                     key_improvements: Dict[str, float]) -> float:
        """
        Calculate overall improvement score

        Args:
            action_type: Type of remediation action
            key_improvements: Dictionary of metric improvements

        Returns:
            Overall improvement score (0-100)
        """

        if not key_improvements:
            return 0.0

        # Average the improvements
        total_improvement = sum(key_improvements.values())
        avg_improvement = total_improvement / len(key_improvements)

        return min(100.0, avg_improvement)

    def _determine_status(self, improvement_score: float) -> VerificationStatus:
        """Determine verification status based on improvement score"""
        if improvement_score >= self.success_threshold:
            return VerificationStatus.SUCCESS
        elif improvement_score >= self.partial_threshold:
            return VerificationStatus.PARTIAL
        elif improvement_score > 0:
            return VerificationStatus.INCONCLUSIVE
        else:
            return VerificationStatus.FAILED

    def _generate_analysis(self, action_type: str, improvements: Dict[str, float],
                          status: VerificationStatus) -> str:
        """
        Generate human-readable analysis of verification results

        Args:
            action_type: Type of action
            improvements: Dictionary of improvements
            status: Overall status

        Returns:
            Analysis string
        """

        if not improvements:
            return f"No measurable improvements detected for {action_type}"

        top_metrics = sorted(improvements.items(), key=lambda x: x[1], reverse=True)[:3]

        analysis = f"Remediation {status.value.lower()}: "
        analysis += f"Action '{action_type}' resulted in improvements: "
        analysis += ", ".join([f"{metric}={improvement:.1f}%" for metric, improvement in top_metrics])

        return analysis

    def reset_history(self):
        """Clear verification history"""
        self.verification_history = []
        self.logger.info("Cleared verification history")

    def get_latest_result(self) -> Optional[VerificationResult]:
        """Get the most recent verification result"""
        return self.verification_history[-1] if self.verification_history else None
