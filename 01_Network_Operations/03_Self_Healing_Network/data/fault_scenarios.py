"""
Pre-defined network fault scenarios for testing
"""

from dataclasses import dataclass
from typing import List, Dict, Callable
from enum import Enum


class FaultType(Enum):
    """Network fault types"""
    LINK_DOWN = "link_down"
    BGP_FLAP = "bgp_flap"
    INTERFACE_FLAP = "interface_flap"
    HIGH_CPU = "high_cpu"
    STP_LOOP = "stp_loop"


@dataclass
class FaultScenario:
    """Definition of a fault scenario"""
    name: str
    fault_type: FaultType
    description: str
    expected_indicators: Dict[str, float]  # metric -> threshold
    remediation_commands: List[str]
    detection_method: str
    recovery_time_seconds: int


def get_fault_scenarios() -> Dict[str, FaultScenario]:
    """Return all pre-defined fault scenarios"""
    
    scenarios = {
        'link_down': FaultScenario(
            name='Link Down',
            fault_type=FaultType.LINK_DOWN,
            description='Interface Ethernet1/1 goes down due to cable disconnection',
            expected_indicators={
                'interface_errors': 100,
                'packet_loss_percent': 80,
                'link_utilization_percent': 5
            },
            remediation_commands=[
                'interface Ethernet1/1',
                'shutdown',
                'no shutdown',
                'exit'
            ],
            detection_method='interface_status_monitor',
            recovery_time_seconds=30
        ),
        'bgp_flap': FaultScenario(
            name='BGP Session Flapping',
            fault_type=FaultType.BGP_FLAP,
            description='BGP neighbor 10.0.0.2 flapping due to network instability',
            expected_indicators={
                'bgp_neighbors_down': 3,
                'packet_loss_percent': 25,
                'interface_errors': 200
            },
            remediation_commands=[
                'clear ip bgp 10.0.0.2 soft in'
            ],
            detection_method='bgp_session_stability',
            recovery_time_seconds=45
        ),
        'interface_flap': FaultScenario(
            name='Interface Flapping',
            fault_type=FaultType.INTERFACE_FLAP,
            description='Interface Ethernet1/2 flapping due to transceiver issue',
            expected_indicators={
                'interface_errors': 2000,
                'packet_loss_percent': 20
            },
            remediation_commands=[
                'interface Ethernet1/2',
                'shutdown',
                'no shutdown',
                'exit'
            ],
            detection_method='interface_flap_detection',
            recovery_time_seconds=60
        ),
        'high_cpu': FaultScenario(
            name='High CPU Utilization',
            fault_type=FaultType.HIGH_CPU,
            description='CPU usage exceeds 80% due to routing table explosion',
            expected_indicators={
                'cpu_percent': 85,
                'memory_percent': 70,
                'packet_loss_percent': 10
            },
            remediation_commands=[
                'clear ip bgp * soft'
            ],
            detection_method='cpu_threshold_monitor',
            recovery_time_seconds=120
        ),
        'stp_loop': FaultScenario(
            name='Spanning Tree Loop Detection',
            fault_type=FaultType.STP_LOOP,
            description='STP loop detected on VLAN 100 due to misconfiguration',
            expected_indicators={
                'stp_blocked_ports': 5,
                'interface_errors': 5000,
                'packet_loss_percent': 50
            },
            remediation_commands=[
                'spanning-tree vlan 100 priority 4096',
                'exit'
            ],
            detection_method='stp_loop_detection',
            recovery_time_seconds=90
        )
    }
    
    return scenarios


def get_remediation_for_fault(fault_type: FaultType) -> List[str]:
    """Get standard remediation commands for a fault type"""
    scenarios = get_fault_scenarios()
    
    for scenario in scenarios.values():
        if scenario.fault_type == fault_type:
            return scenario.remediation_commands
    
    return []
