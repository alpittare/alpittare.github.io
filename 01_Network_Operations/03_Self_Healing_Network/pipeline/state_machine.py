"""
Healing State Machine - DETECT → ANALYZE → DECIDE → ACT → VERIFY → ROLLBACK
Implements closed-loop automation workflow
"""

from enum import Enum
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime
import sys
sys.path.insert(0, '/sessions/epic-stoic-mendel/mnt/claude_folder/03_Self_Healing_Network/models')
sys.path.insert(0, '/sessions/epic-stoic-mendel/mnt/claude_folder/03_Self_Healing_Network/engine')

from fault_detector import FaultDetector, AnomalyLevel
from anomaly_classifier import FaultClassifier
from health_scorer import HealthScorer
from failure_predictor import LogisticRegressionPredictor
from policy_engine import PolicyEngine
from guardrails import GuardrailManager
from remediation import RemediationExecutor
from verification import RemediationVerifier


class HealingState(Enum):
    """State machine states"""
    IDLE = "idle"
    DETECTING = "detecting"
    ANALYZING = "analyzing"
    DECIDING = "deciding"
    ACTING = "acting"
    VERIFYING = "verifying"
    ROLLING_BACK = "rolling_back"
    FAILED = "failed"


@dataclass
class HealingEvent:
    """Event in healing workflow"""
    timestamp: str
    state: HealingState
    description: str
    data: Dict = field(default_factory=dict)


@dataclass
class HealingReport:
    """Complete healing workflow report"""
    start_time: str
    end_time: str
    states_traversed: List[HealingState]
    fault_detected: str
    actions_taken: List[str]
    verification_result: str
    success: bool
    messages: List[str]


class ClosedLoopHealingMachine:
    """Closed-loop self-healing state machine"""
    
    def __init__(self):
        self.state = HealingState.IDLE
        self.events = []
        
        # Initialize components
        self.fault_detector = FaultDetector()
        self.classifier = FaultClassifier()
        self.health_scorer = HealthScorer()
        self.failure_predictor = LogisticRegressionPredictor()
        self.policy_engine = PolicyEngine()
        self.guardrails = GuardrailManager()
        self.remediation_executor = RemediationExecutor()
        self.verifier = RemediationVerifier()
        
        # State
        self.current_metrics = {}
        self.detected_anomalies = []
        self.classified_fault = None
        self.recommended_action = None
        self.executed_actions = []
        self.verification_results = []
        self.workflow_start_time = None

    def _transition(self, new_state: HealingState, description: str, data: Dict = None):
        """Transition to new state"""
        self.state = new_state
        event = HealingEvent(
            timestamp=datetime.now().isoformat(),
            state=new_state,
            description=description,
            data=data or {}
        )
        self.events.append(event)

    def process_metrics(self, metrics: Dict[str, float]) -> HealingReport:
        """Process incoming metrics through full healing workflow"""
        self.workflow_start_time = datetime.now()
        self.current_metrics = metrics
        self.executed_actions = []
        self.verification_results = []
        
        messages = []
        
        # DETECT
        self._transition(HealingState.DETECTING, "Fault detection started")
        self.detected_anomalies = self.fault_detector.get_all_anomalies(
            datetime.now().isoformat(),
            metrics
        )
        
        if not self.detected_anomalies:
            self._transition(HealingState.IDLE, "No anomalies detected")
            return HealingReport(
                start_time=self.workflow_start_time.isoformat(),
                end_time=datetime.now().isoformat(),
                states_traversed=[HealingState.DETECTING, HealingState.IDLE],
                fault_detected="None",
                actions_taken=[],
                verification_result="N/A",
                success=True,
                messages=["System operating normally"]
            )
        
        messages.append(f"Detected {len(self.detected_anomalies)} anomalies")
        
        # ANALYZE
        self._transition(HealingState.ANALYZING, f"Analyzing {len(self.detected_anomalies)} anomaly(ies)")
        self.classified_fault = self.classifier.classify(metrics)
        messages.append(f"Fault classified as: {self.classified_fault.fault_class.value} (confidence: {self.classified_fault.confidence:.2f})")
        
        # Calculate health
        health_score = self.health_scorer.calculate_health(metrics)
        messages.append(f"Health score: {health_score.overall_score:.1f} ({health_score.risk_level})")
        
        # Predict future failures
        prediction = self.failure_predictor.predict(metrics)
        messages.append(f"Failure probability (4h): {prediction.failure_probability_4h:.2%}")
        
        # DECIDE
        self._transition(HealingState.DECIDING, "Decision engine evaluating policies")
        policy_result = self.policy_engine.evaluate(metrics)
        self.recommended_action = policy_result.recommended_action
        messages.append(f"Recommended action: {policy_result.recommended_action.value}")
        
        # Check guardrails
        guardrail_check = self.guardrails.check_all_guardrails(health_score.overall_score)
        can_remediate = guardrail_check['action_allowed']
        
        if not can_remediate:
            violations = [v for v in guardrail_check['violations'].values() if not v.action_allowed]
            messages.append(f"Guardrail violations: {', '.join([v.guardrail_name for v in violations])}")
        
        # ACT
        if can_remediate and self.recommended_action.value != 'alert_only':
            self._transition(HealingState.ACTING, "Executing remediation action")
            
            action = self._generate_action_for_fault()
            if action:
                execution_result = self.remediation_executor.execute_action(action)
                self.executed_actions.append(action.action_type)
                messages.append(f"Executed: {action.description}")
                
                # Record guardrail state
                self.guardrails.record_remediation_action(action.action_type, health_score.overall_score)
            else:
                self._transition(HealingState.FAILED, "Could not generate appropriate action")
                messages.append("ERROR: Unable to generate remediation action")
        else:
            self._transition(HealingState.ACTING, "No automatic remediation (alert only or blocked)")
            messages.append("Remediation blocked or not needed - manual review recommended")
        
        # VERIFY
        if self.executed_actions:
            self._transition(HealingState.VERIFYING, "Verifying remediation effectiveness")
            
            # Simulate post-remediation metrics (in production: re-poll device)
            post_metrics = self._simulate_remediation_effect()
            
            for action_type in self.executed_actions:
                verification = self.verifier.verify(action_type, self.current_metrics, post_metrics)
                self.verification_results.append(verification)
                messages.append(f"Verification ({action_type}): {verification.status.value} - improvement: {verification.improvement_score:.1f}%")
                
                # Check for rollback need
                if verification.status.value == 'failed':
                    self._transition(HealingState.ROLLING_BACK, "Remediation failed, rollback triggered")
                    messages.append("WARNING: Remediation was ineffective, rollback may be needed")
        
        # Final state
        success = len(self.verification_results) > 0 and any(v.status.value == 'success' for v in self.verification_results)
        final_state = HealingState.IDLE if success else HealingState.FAILED
        self._transition(final_state, f"Workflow complete - {final_state.value}")
        
        return HealingReport(
            start_time=self.workflow_start_time.isoformat(),
            end_time=datetime.now().isoformat(),
            states_traversed=[e.state for e in self.events],
            fault_detected=self.classified_fault.fault_class.value if self.classified_fault else "None",
            actions_taken=self.executed_actions,
            verification_result=self.verification_results[0].status.value if self.verification_results else "N/A",
            success=success,
            messages=messages
        )

    def _generate_action_for_fault(self):
        """Generate appropriate remediation action for detected fault"""
        if not self.classified_fault:
            return None
        
        fault_map = {
            'interface_down': lambda: self.remediation_executor.generate_interface_bounce_action('Ethernet1/1'),
            'bgp_flap': lambda: self.remediation_executor.generate_bgp_soft_reset_action('10.0.0.2'),
            'interface_flap': lambda: self.remediation_executor.generate_interface_bounce_action('Ethernet1/2'),
            'high_cpu': lambda: self.remediation_executor.generate_cpu_mitigation_action(),
            'stp_loop': lambda: self.remediation_executor.generate_stp_priority_action(100),
            'link_error': lambda: self.remediation_executor.generate_interface_bounce_action('Ethernet1/1'),
            'packet_loss': lambda: self.remediation_executor.generate_bgp_soft_reset_action('10.0.0.2')
        }
        
        generator = fault_map.get(self.classified_fault.fault_class.value)
        if generator:
            action = generator()
            if self.remediation_executor.validate_action(action):
                return action
        
        return None

    def _simulate_remediation_effect(self) -> Dict[str, float]:
        """Simulate metrics improvement after remediation"""
        post_metrics = self.current_metrics.copy()
        
        # Simulate improvement based on action type
        if 'interface_bounce' in self.executed_actions:
            post_metrics['link_utilization_percent'] = max(10, post_metrics.get('link_utilization_percent', 0) + 40)
            post_metrics['interface_errors'] = max(0, post_metrics.get('interface_errors', 0) - 50)
            post_metrics['packet_loss_percent'] = max(0, post_metrics.get('packet_loss_percent', 0) - 30)
        
        if 'bgp_soft_reset' in self.executed_actions or 'bgp_reset' in self.executed_actions:
            post_metrics['bgp_neighbors_down'] = max(0, post_metrics.get('bgp_neighbors_down', 0) - 2)
            post_metrics['bgp_neighbors_up'] = min(8, post_metrics.get('bgp_neighbors_up', 0) + 2)
            post_metrics['packet_loss_percent'] = max(0, post_metrics.get('packet_loss_percent', 0) - 15)
        
        if 'cpu_mitigation' in self.executed_actions:
            post_metrics['cpu_percent'] = max(0, post_metrics.get('cpu_percent', 0) - 25)
            post_metrics['memory_percent'] = max(0, post_metrics.get('memory_percent', 0) - 15)
        
        if 'stp_priority_adjust' in self.executed_actions:
            post_metrics['stp_blocked_ports'] = max(0, post_metrics.get('stp_blocked_ports', 0) - 3)
            post_metrics['interface_errors'] = max(0, post_metrics.get('interface_errors', 0) // 2)
        
        return post_metrics

    def get_workflow_log(self) -> List[HealingEvent]:
        """Get complete workflow event log"""
        return self.events.copy()
