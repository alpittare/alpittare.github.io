"""
Remediation Execution Engine
Generates and executes Cisco CLI commands for network remediation
"""

from enum import Enum
from typing import Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime
import logging


class RemediationStatus(Enum):
    """Status of a remediation action"""
    PENDING = "pending"
    EXECUTING = "executing"
    SUCCESS = "success"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


@dataclass
class RemediationAction:
    """Remediation action to execute"""
    action_type: str
    device_id: str = "nexus-01"
    description: str = ""
    commands: List[str] = None
    status: RemediationStatus = RemediationStatus.PENDING
    timestamp: str = ""

    def __post_init__(self):
        if self.commands is None:
            self.commands = []
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()


@dataclass
class ExecutionResult:
    """Result of executing a remediation action"""
    action_type: str
    status: str
    device_id: str
    commands_sent: List[str]
    output: str = ""
    error: str = ""
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()


class RemediationExecutor:
    """
    Executes remediation actions by generating Cisco CLI commands
    Supports Nexus 7000/9000 and Catalyst 6509 platforms
    """

    def __init__(self, device_type: str = "nexus"):
        self.device_type = device_type
        self.logger = logging.getLogger(__name__)
        self.executed_actions: Dict[str, RemediationAction] = {}
        self.rollback_stack: List[RemediationAction] = []

    def execute_action(self, action: RemediationAction) -> ExecutionResult:
        """
        Execute a remediation action

        Args:
            action: RemediationAction to execute

        Returns:
            ExecutionResult with execution status and details
        """

        self.logger.info(f"Executing action: {action.action_type}")

        # Generate commands for the action
        if not action.commands:
            action.commands = self.generate_commands(action.action_type)

        # Record in history for potential rollback
        self.executed_actions[action.action_type] = action
        self.rollback_stack.append(action)

        # Simulate execution (in production: send to device via SSH/NetConf)
        return ExecutionResult(
            action_type=action.action_type,
            status="success",
            device_id=action.device_id,
            commands_sent=action.commands,
            output=f"Commands executed successfully on {action.device_id}"
        )

    def execute(self, action: str, device_id: str = "nexus-01") -> ExecutionResult:
        """
        Execute remediation action on specified device

        Args:
            action: Action type to execute
            device_id: Target device ID

        Returns:
            ExecutionResult with status and details
        """

        remediation_action = RemediationAction(
            action_type=action,
            device_id=device_id
        )

        return self.execute_action(remediation_action)

    def generate_commands(self, action_type: str) -> List[str]:
        """
        Generate Cisco CLI commands for remediation action

        Args:
            action_type: Type of action to generate commands for

        Returns:
            List of CLI commands
        """

        commands_map = {
            'interface_bounce': self._generate_interface_bounce_commands(),
            'bgp_soft_reset': self._generate_bgp_soft_reset_commands(),
            'bgp_reset': self._generate_bgp_reset_commands(),
            'cpu_mitigation': self._generate_cpu_mitigation_commands(),
            'stp_priority_adjust': self._generate_stp_priority_commands(),
        }

        return commands_map.get(action_type, [])

    def generate_interface_bounce_action(self, interface: str) -> RemediationAction:
        """Generate action to bounce an interface"""
        commands = [
            f"interface {interface}",
            "shutdown",
            "no shutdown",
            "exit"
        ]

        return RemediationAction(
            action_type="interface_bounce",
            description=f"Bounce interface {interface}",
            commands=commands
        )

    def generate_bgp_soft_reset_action(self, neighbor_ip: str) -> RemediationAction:
        """Generate action for BGP soft reset on specific neighbor"""
        commands = [
            "config t",
            f"clear ip bgp {neighbor_ip} soft in",
            "end"
        ]

        return RemediationAction(
            action_type="bgp_soft_reset",
            description=f"Soft reset BGP to {neighbor_ip}",
            commands=commands
        )

    def generate_cpu_mitigation_action(self) -> RemediationAction:
        """Generate action to mitigate high CPU"""
        commands = [
            "config t",
            "no process cpu threshold type total rising 90 falling 80",
            "process cpu threshold type total rising 95 falling 85",
            "end"
        ]

        return RemediationAction(
            action_type="cpu_mitigation",
            description="Mitigate high CPU utilization",
            commands=commands
        )

    def generate_stp_priority_action(self, priority: int) -> RemediationAction:
        """Generate action to adjust STP priority"""
        commands = [
            "config t",
            f"spanning-tree vlan 100 priority {priority}",
            f"spanning-tree vlan 1 priority {priority}",
            "end"
        ]

        return RemediationAction(
            action_type="stp_priority_adjust",
            description=f"Adjust STP priority to {priority}",
            commands=commands
        )

    def validate_action(self, action: RemediationAction) -> bool:
        """
        Validate that an action is properly formed

        Args:
            action: Action to validate

        Returns:
            True if action is valid, False otherwise
        """

        if not action.action_type:
            self.logger.warning("Action missing action_type")
            return False

        if not action.commands:
            self.logger.warning(f"Action {action.action_type} has no commands")
            return False

        return True

    def rollback(self, action: str) -> ExecutionResult:
        """
        Rollback a previously executed action

        Args:
            action: Action type to rollback

        Returns:
            ExecutionResult with rollback status
        """

        if action not in self.executed_actions:
            return ExecutionResult(
                action_type=action,
                status="failed",
                device_id="unknown",
                commands_sent=[],
                error=f"No executed action found for {action}"
            )

        original_action = self.executed_actions[action]

        # Generate rollback commands (reverse of original)
        rollback_commands = self._generate_rollback_commands(action, original_action.commands)

        self.logger.info(f"Rolling back action: {action}")

        return ExecutionResult(
            action_type=f"{action}_rollback",
            status="success",
            device_id=original_action.device_id,
            commands_sent=rollback_commands,
            output=f"Rollback completed for {action}"
        )

    def _generate_interface_bounce_commands(self) -> List[str]:
        """Generate generic interface bounce commands"""
        return [
            "interface Ethernet1/1",
            "shutdown",
            "no shutdown",
            "exit"
        ]

    def _generate_bgp_soft_reset_commands(self) -> List[str]:
        """Generate BGP soft reset commands"""
        return [
            "config t",
            "clear ip bgp * soft in",
            "end"
        ]

    def _generate_bgp_reset_commands(self) -> List[str]:
        """Generate BGP hard reset commands"""
        return [
            "config t",
            "clear ip bgp * in",
            "end"
        ]

    def _generate_cpu_mitigation_commands(self) -> List[str]:
        """Generate CPU mitigation commands"""
        return [
            "config t",
            "no process cpu threshold type total rising 90 falling 80",
            "process cpu threshold type total rising 95 falling 85",
            "end"
        ]

    def _generate_stp_priority_commands(self) -> List[str]:
        """Generate STP priority adjustment commands"""
        return [
            "config t",
            "spanning-tree vlan 100 priority 4096",
            "spanning-tree vlan 1 priority 4096",
            "end"
        ]

    def _generate_rollback_commands(self, action_type: str, original_commands: List[str]) -> List[str]:
        """
        Generate rollback commands for an action

        Args:
            action_type: Type of action to rollback
            original_commands: Original commands that were executed

        Returns:
            List of rollback commands
        """

        rollback_map = {
            'interface_bounce': ["config t", "interface Ethernet1/1", "no shutdown", "end"],
            'bgp_soft_reset': ["config t", "clear ip bgp * soft in", "end"],
            'bgp_reset': ["config t", "clear ip bgp * soft in", "end"],
            'cpu_mitigation': ["config t", "no process cpu threshold type total rising 95 falling 85", "end"],
            'stp_priority_adjust': ["config t", "no spanning-tree vlan 100 priority", "end"],
        }

        return rollback_map.get(action_type, ["! No rollback available"])
