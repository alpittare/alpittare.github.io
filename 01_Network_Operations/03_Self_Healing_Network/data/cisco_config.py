"""
Cisco Device Config Parser + Remediation Command Generator
Supports Nexus 9000 (NX-OS) and Catalyst 6509 (IOS)
"""

import re
from dataclasses import dataclass
from typing import Dict, List, Tuple, Optional
from enum import Enum


class DeviceType(Enum):
    """Supported Cisco device types"""
    NEXUS_9000 = "nexus_9000"
    CATALYST_6509 = "catalyst_6509"


@dataclass
class InterfaceState:
    """Interface state from device"""
    name: str
    status: str  # up, down, notconnect
    protocol: str  # up, down
    description: str = ""
    mtu: int = 1500
    bandwidth: int = 1000000
    input_rate: float = 0.0
    output_rate: float = 0.0
    input_errors: int = 0
    output_errors: int = 0
    crc_errors: int = 0


@dataclass
class BGPState:
    """BGP neighbor state"""
    neighbor_ip: str
    remote_as: int
    state: str  # Established, Idle, Active, Connect
    uptime: str = "00:00:00"
    messages_sent: int = 0
    messages_received: int = 0
    in_queue: int = 0
    out_queue: int = 0


@dataclass
class STPState:
    """Spanning Tree Protocol state"""
    vlan: int
    root_id: str
    local_priority: int
    bridge_id: str
    priority: int = 32768


class CiscoConfigParser:
    """Parse Cisco CLI output"""

    def __init__(self, device_type: DeviceType):
        self.device_type = device_type

    def parse_show_interface(self, output: str) -> List[InterfaceState]:
        """Parse 'show interface' output"""
        interfaces = []
        # Split by interface blocks
        blocks = re.split(r'^(\S+\s+\d+/\d+/\d+|\S+\d+)', output, flags=re.MULTILINE)
        
        for i in range(1, len(blocks), 2):
            if i + 1 < len(blocks):
                iface_name = blocks[i].strip()
                iface_data = blocks[i + 1]
                
                # Parse status line
                status_match = re.search(r'is\s+(\w+),\s+line protocol is\s+(\w+)', iface_data)
                if status_match:
                    status, protocol = status_match.groups()
                    
                    # Parse description
                    desc_match = re.search(r'Description:\s*(.+?)$', iface_data, re.MULTILINE)
                    description = desc_match.group(1).strip() if desc_match else ""
                    
                    # Parse errors
                    input_errors = 0
                    output_errors = 0
                    crc_errors = 0
                    
                    errors_match = re.search(r'(\d+)\s+input errors', iface_data)
                    if errors_match:
                        input_errors = int(errors_match.group(1))
                    
                    errors_match = re.search(r'(\d+)\s+output errors', iface_data)
                    if errors_match:
                        output_errors = int(errors_match.group(1))
                    
                    crc_match = re.search(r'(\d+)\s+CRC', iface_data)
                    if crc_match:
                        crc_errors = int(crc_match.group(1))
                    
                    interfaces.append(InterfaceState(
                        name=iface_name,
                        status=status.lower(),
                        protocol=protocol.lower(),
                        description=description,
                        input_errors=input_errors,
                        output_errors=output_errors,
                        crc_errors=crc_errors
                    ))
        
        return interfaces

    def parse_show_ip_bgp_summary(self, output: str) -> List[BGPState]:
        """Parse 'show ip bgp summary' output"""
        neighbors = []
        
        # Match neighbor lines
        neighbor_pattern = r'(\d+\.\d+\.\d+\.\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\w+)'
        
        for match in re.finditer(neighbor_pattern, output):
            ip, remote_as, sent, rcvd, uptime, state, inq, outq = match.groups()
            neighbors.append(BGPState(
                neighbor_ip=ip,
                remote_as=int(remote_as),
                state=state if state in ['Established', 'Idle', 'Active', 'Connect'] else 'Down',
                messages_sent=int(sent),
                messages_received=int(rcvd),
                in_queue=0,
                out_queue=0
            ))
        
        return neighbors

    def parse_show_spanning_tree(self, output: str) -> List[STPState]:
        """Parse 'show spanning-tree' output"""
        stp_states = []
        
        # Match VLAN blocks
        vlan_pattern = r'VLAN(\d+).*?Root ID.*?Priority\s+(\d+)'
        
        for match in re.finditer(vlan_pattern, output, re.DOTALL):
            vlan_id = int(match.group(1))
            priority = int(match.group(2))
            
            stp_states.append(STPState(
                vlan=vlan_id,
                root_id="",
                local_priority=priority,
                bridge_id="",
                priority=priority
            ))
        
        return stp_states


class CiscoRemediationGenerator:
    """Generate Cisco CLI remediation commands"""

    def __init__(self, device_type: DeviceType):
        self.device_type = device_type
        self.commands = []

    def interface_down(self, interface_name: str) -> List[str]:
        """Generate commands to bounce interface (shut/noshut)"""
        commands = []
        
        if self.device_type == DeviceType.NEXUS_9000:
            commands.extend([
                f"interface {interface_name}",
                "shutdown",
                "no shutdown",
                "exit"
            ])
        else:  # CATALYST_6509
            commands.extend([
                f"interface {interface_name}",
                "shutdown",
                "no shutdown",
                "exit"
            ])
        
        return commands

    def bgp_flap_recovery(self, neighbor_ip: str, clear_soft: bool = True) -> List[str]:
        """Generate BGP recovery commands"""
        commands = []
        
        if clear_soft:
            if self.device_type == DeviceType.NEXUS_9000:
                commands.append(f"clear ip bgp {neighbor_ip} soft in")
            else:  # CATALYST_6509
                commands.append(f"clear ip bgp {neighbor_ip} soft")
        else:
            commands.append(f"clear ip bgp {neighbor_ip}")
        
        return commands

    def bgp_reset_all(self) -> List[str]:
        """Generate global BGP reset command"""
        commands = []
        
        if self.device_type == DeviceType.NEXUS_9000:
            commands.append("clear ip bgp * soft")
        else:  # CATALYST_6509
            commands.append("clear ip bgp * soft")
        
        return commands

    def add_vlan_to_trunk(self, interface_name: str, vlan_id: int) -> List[str]:
        """Add VLAN to trunk port (NX-OS only)"""
        if self.device_type != DeviceType.NEXUS_9000:
            return []
        
        commands = [
            f"interface {interface_name}",
            f"switchport trunk allowed vlan add {vlan_id}",
            "exit"
        ]
        return commands

    def stp_priority_adjust(self, vlan_id: int, priority: int = 4096) -> List[str]:
        """Adjust STP priority to prevent loops"""
        commands = []
        
        if self.device_type == DeviceType.CATALYST_6509:
            commands.extend([
                f"spanning-tree vlan {vlan_id} priority {priority}",
                "exit"
            ])
        elif self.device_type == DeviceType.NEXUS_9000:
            commands.extend([
                f"spanning-tree vlan {vlan_id} priority {priority}",
                "exit"
            ])
        
        return commands

    def cpu_mitigation(self, bgp_affected: bool = True) -> List[str]:
        """Mitigate high CPU conditions"""
        commands = []
        
        # Clear BGP if CPU spike is BGP-related
        if bgp_affected:
            commands.extend(self.bgp_reset_all())
        
        return commands

    def enable_interface(self, interface_name: str) -> List[str]:
        """Enable shutdown interface"""
        commands = [
            f"interface {interface_name}",
            "no shutdown",
            "exit"
        ]
        return commands

    def disable_interface(self, interface_name: str) -> List[str]:
        """Disable problematic interface"""
        commands = [
            f"interface {interface_name}",
            "shutdown",
            "exit"
        ]
        return commands


def simulate_command_execution(commands: List[str]) -> Dict[str, str]:
    """Simulate command execution on device (returns output)"""
    results = {}
    
    for cmd in commands:
        if "show" in cmd:
            # Simulate show command output
            if "interface" in cmd:
                results[cmd] = "Ethernet1/1 is up, line protocol is up\n  Description: Core Link\n  0 input errors, 0 output errors"
            elif "bgp" in cmd:
                results[cmd] = "BGP router identifier 10.0.0.1, local AS number 65001\n  Neighbor V AS MsgRcvd MsgSent TblVer InQ OutQ Up/Down State"
            elif "spanning-tree" in cmd:
                results[cmd] = "VLAN0100\n  Spanning tree enabled protocol ieee"
        else:
            # Config command
            results[cmd] = "OK"
    
    return results
