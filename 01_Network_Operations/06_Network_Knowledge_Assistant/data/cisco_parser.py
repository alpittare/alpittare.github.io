"""Comprehensive Cisco configuration parser."""
import re
from typing import Dict, List, Any, Tuple
from dataclasses import dataclass, asdict, field
from enum import Enum


@dataclass
class CiscoInterface:
    """Cisco interface configuration."""
    name: str
    description: str = ""
    ip_address: str = ""
    subnet_mask: str = ""
    vlan: int = 0
    speed: str = "auto"
    duplex: str = "auto"
    mtu: int = 1500
    enabled: bool = True
    acl_in: str = ""
    acl_out: str = ""
    neighbors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class BGPNeighbor:
    """BGP neighbor configuration."""
    neighbor_ip: str
    remote_as: int = 0
    description: str = ""
    local_as: int = 0
    enabled: bool = True
    prefix_list_in: str = ""
    prefix_list_out: str = ""
    route_map_in: str = ""
    route_map_out: str = ""

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class VLAN:
    """VLAN configuration."""
    vlan_id: int
    name: str = ""
    description: str = ""
    status: str = "active"
    interfaces: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class ACLRule:
    """ACL rule."""
    sequence: int
    action: str  # permit/deny
    protocol: str
    source: str
    destination: str = ""
    port: str = ""

    def to_dict(self) -> Dict:
        return asdict(self)


class CiscoConfigParser:
    """Parser for Cisco running-config."""

    def __init__(self, config_text: str = ""):
        """Initialize parser."""
        self.config_text = config_text
        self.lines = config_text.split('\n') if config_text else []

        # Parsed data structures
        self.interfaces: Dict[str, CiscoInterface] = {}
        self.vlans: Dict[int, VLAN] = {}
        self.bgp_neighbors: Dict[str, BGPNeighbor] = {}
        self.acls: Dict[str, List[ACLRule]] = {}
        self.routing_config = {}
        self.device_info = {}

    def parse(self) -> Dict[str, Any]:
        """Parse entire configuration."""
        self._parse_device_info()
        self._parse_interfaces()
        self._parse_vlans()
        self._parse_bgp()
        self._parse_acls()
        self._parse_routing()

        return {
            'device_info': self.device_info,
            'interfaces': {k: v.to_dict() for k, v in self.interfaces.items()},
            'vlans': {str(k): v.to_dict() for k, v in self.vlans.items()},
            'bgp_neighbors': {k: v.to_dict() for k, v in self.bgp_neighbors.items()},
            'acls': {k: [r.to_dict() for r in v] for k, v in self.acls.items()},
            'routing_config': self.routing_config
        }

    def _parse_device_info(self):
        """Extract device information."""
        for line in self.lines:
            if 'hostname' in line.lower():
                self.device_info['hostname'] = line.split()[-1]
            elif 'version' in line.lower():
                self.device_info['version'] = line.split()[-1]
            elif 'model' in line.lower():
                self.device_info['model'] = line.split()[-1]

    def _parse_interfaces(self):
        """Parse interface configurations."""
        current_interface = None
        current_config = []

        for line in self.lines:
            line = line.strip()

            # Interface declaration
            if re.match(r'^interface\s+(.+)$', line):
                if current_interface:
                    self._process_interface_config(current_interface, current_config)

                match = re.match(r'^interface\s+(.+)$', line)
                current_interface = match.group(1)
                current_config = []
            elif current_interface and line and not line.startswith('!'):
                current_config.append(line)
            elif line.startswith('!') and current_interface:
                self._process_interface_config(current_interface, current_config)
                current_interface = None
                current_config = []

        # Process last interface
        if current_interface:
            self._process_interface_config(current_interface, current_config)

    def _process_interface_config(self, name: str, config_lines: List[str]):
        """Process individual interface configuration."""
        iface = CiscoInterface(name=name)

        for line in config_lines:
            if 'description' in line.lower():
                iface.description = re.sub(r'^description\s+', '', line, flags=re.IGNORECASE)
            elif 'ip address' in line.lower():
                match = re.search(r'ip\s+address\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)', line, re.IGNORECASE)
                if match:
                    iface.ip_address = match.group(1)
                    iface.subnet_mask = match.group(2)
            elif 'switchport access vlan' in line.lower():
                match = re.search(r'vlan\s+(\d+)', line, re.IGNORECASE)
                if match:
                    iface.vlan = int(match.group(1))
            elif 'speed' in line.lower():
                iface.speed = line.split()[-1]
            elif 'duplex' in line.lower():
                iface.duplex = line.split()[-1]
            elif 'mtu' in line.lower():
                match = re.search(r'mtu\s+(\d+)', line, re.IGNORECASE)
                if match:
                    iface.mtu = int(match.group(1))
            elif 'shutdown' in line.lower():
                iface.enabled = False
            elif re.match(r'^ip\s+access-group.*in', line, re.IGNORECASE):
                iface.acl_in = line.split()[-2]
            elif re.match(r'^ip\s+access-group.*out', line, re.IGNORECASE):
                iface.acl_out = line.split()[-2]

        self.interfaces[name] = iface

    def _parse_vlans(self):
        """Parse VLAN configurations."""
        vlan_pattern = r'^vlan\s+(\d+)'

        for i, line in enumerate(self.lines):
            match = re.match(vlan_pattern, line, re.IGNORECASE)
            if match:
                vlan_id = int(match.group(1))
                vlan = VLAN(vlan_id=vlan_id)

                # Look ahead for VLAN details
                for j in range(i + 1, min(i + 10, len(self.lines))):
                    next_line = self.lines[j].strip()
                    if 'name' in next_line.lower():
                        vlan.name = re.sub(r'^name\s+', '', next_line, flags=re.IGNORECASE)
                    elif 'description' in next_line.lower():
                        vlan.description = re.sub(r'^description\s+', '', next_line, flags=re.IGNORECASE)
                    elif next_line.startswith('!'):
                        break

                # Find interfaces in this VLAN
                vlan.interfaces = [
                    name for name, iface in self.interfaces.items()
                    if iface.vlan == vlan_id
                ]

                self.vlans[vlan_id] = vlan

    def _parse_bgp(self):
        """Parse BGP configuration."""
        in_bgp_section = False
        local_as = None
        neighbor_pattern = r'^neighbor\s+(\d+\.\d+\.\d+\.\d+)'

        for i, line in enumerate(self.lines):
            line = line.strip()

            # Enter BGP section
            if re.match(r'^router\s+bgp\s+(\d+)', line, re.IGNORECASE):
                match = re.match(r'^router\s+bgp\s+(\d+)', line, re.IGNORECASE)
                local_as = int(match.group(1))
                self.routing_config['bgp_as'] = local_as
                in_bgp_section = True
                continue

            if in_bgp_section:
                if line.startswith('router'):
                    in_bgp_section = False
                    continue

                if re.match(neighbor_pattern, line):
                    match = re.match(r'^neighbor\s+(\d+\.\d+\.\d+\.\d+)', line)
                    neighbor_ip = match.group(1)
                    neighbor = BGPNeighbor(neighbor_ip=neighbor_ip, local_as=local_as or 0)

                    # Look for remote-as
                    for j in range(i + 1, min(i + 20, len(self.lines))):
                        next_line = self.lines[j].strip()
                        if f'neighbor {neighbor_ip}' in next_line:
                            if 'remote-as' in next_line:
                                match = re.search(r'remote-as\s+(\d+)', next_line)
                                if match:
                                    neighbor.remote_as = int(match.group(1))
                            elif 'description' in next_line:
                                neighbor.description = re.sub(r'^.*description\s+', '', next_line)
                        elif not next_line.startswith('neighbor'):
                            break

                    self.bgp_neighbors[neighbor_ip] = neighbor

    def _parse_acls(self):
        """Parse ACL configurations."""
        acl_pattern = r'^(ip\s+)?access-list\s+(\S+)'
        current_acl = None
        seq_num = 10

        for line in self.lines:
            line = line.strip()

            match = re.match(acl_pattern, line, re.IGNORECASE)
            if match:
                current_acl = match.group(2)
                self.acls[current_acl] = []
                seq_num = 10
                continue

            if current_acl and line and not line.startswith('!'):
                # Parse ACL rule
                if re.match(r'(permit|deny)', line, re.IGNORECASE):
                    rule = self._parse_acl_rule(line, seq_num)
                    if rule:
                        self.acls[current_acl].append(rule)
                        seq_num += 10

    def _parse_acl_rule(self, line: str, seq: int) -> ACLRule:
        """Parse individual ACL rule."""
        parts = line.split()
        action = parts[0].lower()
        protocol = parts[1] if len(parts) > 1 else 'ip'
        source = parts[2] if len(parts) > 2 else 'any'
        destination = parts[3] if len(parts) > 3 else 'any'

        return ACLRule(
            sequence=seq,
            action=action,
            protocol=protocol,
            source=source,
            destination=destination
        )

    def _parse_routing(self):
        """Parse routing configuration."""
        route_pattern = r'^ip\s+route\s+'
        ospf_pattern = r'^router\s+ospf\s+(\d+)'

        for line in self.lines:
            line = line.strip()

            if re.match(route_pattern, line, re.IGNORECASE):
                parts = line.split()
                self.routing_config.setdefault('static_routes', []).append(
                    {'destination': parts[2], 'mask': parts[3], 'gateway': parts[4]}
                )

            if re.match(ospf_pattern, line, re.IGNORECASE):
                match = re.match(ospf_pattern, line, re.IGNORECASE)
                self.routing_config['ospf_process_id'] = int(match.group(1))


def parse_cisco_config(config_text: str) -> Dict[str, Any]:
    """Parse Cisco configuration and return structured data."""
    parser = CiscoConfigParser(config_text)
    return parser.parse()
