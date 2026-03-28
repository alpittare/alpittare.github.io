"""
Cisco device configuration parser for NX-OS and IOS.

Parses CLI output from Cisco Nexus 9000 and Catalyst 6509 switches.
Extracts interface metrics, BGP sessions, VLAN configs, and routes.
"""

import re
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class InterfaceMetrics:
    """Parsed interface metrics from 'show interface' command."""
    interface_name: str
    status: str  # up, down
    protocol_status: str
    speed: str  # e.g., "100Gbit/sec"
    duplex: str  # full, half
    input_errors: int
    output_errors: int
    crc_errors: int
    input_packets: int
    output_packets: int
    input_bytes: int
    output_bytes: int
    utilization: float  # percentage
    
    def error_rate(self) -> float:
        """Calculate error rate as percentage of input packets."""
        if self.input_packets == 0:
            return 0.0
        return (self.input_errors / self.input_packets) * 100.0


@dataclass
class BGPSession:
    """Parsed BGP neighbor session."""
    neighbor_ip: str
    remote_as: int
    state: str  # Established, Active, Idle, etc.
    uptime: str
    prefixes_received: int
    prefixes_sent: int


@dataclass
class Route:
    """Parsed route entry."""
    destination: str  # CIDR
    next_hop: str
    protocol: str  # BGP, OSPF, static
    metric: int
    admin_distance: int
    uptime: str


class CiscoConfigParser:
    """
    Parser for Cisco NX-OS and IOS CLI output.
    """
    
    def parse_interface_metrics(self, output: str) -> Optional[InterfaceMetrics]:
        """
        Parse 'show interface' output.
        
        Args:
            output: Raw CLI output from show interface command
            
        Returns:
            InterfaceMetrics object or None if parsing fails
        """
        metrics = {}
        
        # Extract interface name - handle both "is up" and standalone interface line
        match = re.search(r'^(\S+)\s+is\s+(\w+)', output, re.MULTILINE)
        if not match:
            # Try alternate format
            lines = output.split('\n')
            if lines:
                iface_name = lines[0].split()[0]
                metrics['interface_name'] = iface_name
                metrics['status'] = 'up' if 'up' in lines[0].lower() else 'down'
        else:
            metrics['interface_name'] = match.group(1)
            metrics['status'] = match.group(2).lower()
        
        if not metrics.get('interface_name'):
            logger.warning("Could not parse interface status")
            return None
        
        # Protocol status
        match = re.search(r'protocol is (\w+)', output)
        metrics['protocol_status'] = match.group(1).lower() if match else 'unknown'
        
        # Speed
        match = re.search(r'(\d+[GT]bit/sec)', output)
        metrics['speed'] = match.group(1) if match else 'unknown'
        
        # Duplex
        match = re.search(r'Duplex:\s+(\w+)', output)
        metrics['duplex'] = match.group(1).lower() if match else 'unknown'
        
        # Input errors
        match = re.search(r'input errors\s+(\d+)', output)
        metrics['input_errors'] = int(match.group(1)) if match else 0
        
        # Output errors
        match = re.search(r'output errors?\s+(\d+)', output)
        metrics['output_errors'] = int(match.group(1)) if match else 0
        
        # CRC errors
        match = re.search(r'CRC:\s+(\d+)', output)
        metrics['crc_errors'] = int(match.group(1)) if match else 0
        
        # Input packets
        match = re.search(r'(\d+)\s+packets input', output)
        metrics['input_packets'] = int(match.group(1)) if match else 0
        
        # Output packets
        match = re.search(r'(\d+)\s+packets output', output)
        metrics['output_packets'] = int(match.group(1)) if match else 0
        
        # Input/output bytes
        match = re.search(r'(\d+)\s+bytes input', output)
        metrics['input_bytes'] = int(match.group(1)) if match else 0
        
        match = re.search(r'(\d+)\s+bytes.*output', output)
        metrics['output_bytes'] = int(match.group(1)) if match else 0
        
        # Utilization
        match = re.search(r'Bandwidth utilization:\s+(\d+\.?\d*)%', output)
        metrics['utilization'] = float(match.group(1)) if match else 0.0
        
        return InterfaceMetrics(**metrics)
    
    def parse_bgp_summary(self, output: str) -> List[BGPSession]:
        """
        Parse 'show ip bgp summary' output.
        
        Args:
            output: Raw CLI output
            
        Returns:
            List of BGPSession objects
        """
        sessions = []
        
        # Split by lines and find neighbor entries
        lines = output.split('\n')
        for line in lines:
            # Match lines with IP address and session info
            match = re.search(
                r'(\d+\.\d+\.\d+\.\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\w+)',
                line
            )
            if match:
                neighbor_ip = match.group(1)
                remote_as = int(match.group(2))
                prefixes_sent = int(match.group(3))
                prefixes_received = int(match.group(4))
                state = match.group(6)
                
                # Extract uptime - look for timestamp pattern
                uptime_match = re.search(r'(\d+w\d+d|\d+d\d+h|\d+:\d+:\d+)', line)
                uptime = uptime_match.group(1) if uptime_match else 'unknown'
                
                session = BGPSession(
                    neighbor_ip=neighbor_ip,
                    remote_as=remote_as,
                    state=state,
                    uptime=uptime,
                    prefixes_received=prefixes_received,
                    prefixes_sent=prefixes_sent
                )
                sessions.append(session)
        
        return sessions
    
    def parse_running_config(self, output: str) -> Dict[str, List[str]]:
        """
        Parse 'show running-config' output.
        
        Args:
            output: Raw CLI output
            
        Returns:
            Dictionary with config sections (interfaces, bgp, vlans, acls)
        """
        config = {
            'interfaces': [],
            'bgp': [],
            'vlans': [],
            'acls': [],
            'routes': []
        }
        
        current_section = None
        current_block = []
        
        lines = output.split('\n')
        for line in lines:
            # Detect section headers
            if re.match(r'^interface\s+', line):
                if current_block:
                    config['interfaces'].append('\n'.join(current_block))
                current_block = [line]
                current_section = 'interface'
            elif re.match(r'^router\s+bgp\s+', line):
                if current_block:
                    config['bgp'].append('\n'.join(current_block))
                current_block = [line]
                current_section = 'bgp'
            elif re.match(r'^vlan\s+', line):
                if current_block:
                    config['vlans'].append('\n'.join(current_block))
                current_block = [line]
                current_section = 'vlan'
            elif re.match(r'^ip\s+access-list\s+', line):
                if current_block:
                    config['acls'].append('\n'.join(current_block))
                current_block = [line]
                current_section = 'acl'
            elif re.match(r'^ip\s+route\s+', line):
                config['routes'].append(line)
            elif current_section and line.startswith(' '):
                # Continuation of current block
                current_block.append(line)
        
        # Add final block
        if current_block:
            if current_section == 'interface':
                config['interfaces'].append('\n'.join(current_block))
            elif current_section == 'bgp':
                config['bgp'].append('\n'.join(current_block))
            elif current_section == 'vlan':
                config['vlans'].append('\n'.join(current_block))
            elif current_section == 'acl':
                config['acls'].append('\n'.join(current_block))
        
        return config
    
    def parse_routes(self, output: str) -> List[Route]:
        """
        Parse 'show ip route' output.
        
        Args:
            output: Raw CLI output
            
        Returns:
            List of Route objects
        """
        routes = []
        lines = output.split('\n')
        
        for line in lines:
            # Match route lines: [protocol] destination via next-hop
            match = re.search(
                r'\[(\d+)/(\d+)\]\s+via\s+(\d+\.\d+\.\d+\.\d+),\s+(\S+),\s+(\S+)',
                line
            )
            if match:
                # Extract destination from beginning of line
                dest_match = re.search(r'[COBDE]\s+(\d+\.\d+\.\d+\.\d+/\d+)', line)
                if dest_match:
                    protocol_char = line[0]
                    protocol_map = {'C': 'connected', 'O': 'ospf', 'B': 'bgp',
                                   'D': 'eigrp', 'E': 'egp', 'S': 'static'}
                    
                    route = Route(
                        destination=dest_match.group(1),
                        next_hop=match.group(3),
                        protocol=protocol_map.get(protocol_char, 'unknown'),
                        admin_distance=int(match.group(1)),
                        metric=int(match.group(2)),
                        uptime=match.group(4)
                    )
                    routes.append(route)
        
        return routes


# Sample CLI outputs for testing
NEXUS_SHOW_INTERFACE = """Ethernet1/1 is up
  admin state is up, Flags: --U--P-------
  Hardware: 100/1000/10000 Ethernet, address: aabb.cc00.1001 (bia aabb.cc00.1001)
  Description: Link to CORE-02
  MTU 1500 bytes, BW 100000000 Kbit/sec
  Duplex: full, Speed: 100Gbit/sec
  Bandwidth utilization: 75.3%
  Encapsulation ARPA, medium is broadcast
  Port mode is routed
  IP address is 10.0.1.1, IP subnet mask is 255.255.255.0
  30 second input rate 3500000 bits/sec, 3500 packets/sec
  30 second output rate 2800000 bits/sec, 2800 packets/sec
  input packets 15234567, bytes 8934123456
  input errors 125, short, 0, symbol, 0, ignored 10
  input runts 0, giants 0, CRC: 115, frame 0, fifo 0, miss 0, deferred 0
  output packets 14876543, bytes 7123456789
  output errors 45, collisions 0, interface resets 2
"""

NEXUS_SHOW_BGP = """BGP router identifier 10.0.0.1, local AS number 65001

BGP table version is 1234, main routing table version 1234
5432 network entries using 890123 bytes of memory
2345 path entries using 456789 bytes of memory

Neighbor        V    AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd
10.0.0.2        4 65001   45678   45123    1234    0    0 5w2d      2345
10.0.0.3        4 65002   23456   23234    1234    0    0 3w4d      1234
10.0.0.4        4 65003   12345   12123    1234    0    0 2d5h       567
10.0.1.1        4 65004    5678    5534    1234    0    0 18h22m     345
"""

NEXUS_RUNNING_CONFIG = """version 7.0(3)I7(6)

interface Ethernet1/1
  description Link to CORE-02
  speed 100000
  duplex full
  no shutdown

interface Ethernet1/2
  description Link to AGG-02
  speed 40000
  duplex full
  no shutdown

router bgp 65001
  neighbor 10.0.0.2
    remote-as 65001
    description internal-peer
  neighbor 10.0.0.3
    remote-as 65002
    description external-peer

ip route 192.168.0.0/16 10.0.0.2
ip route 192.168.1.0/24 10.0.0.3 ad 200
"""

CAT6509_SHOW_INTERFACE = """GigabitEthernet1/1 is up, line protocol is up
  Hardware is C6k 1000Mb 802.3, address is aabb.cc00.0501 (bia aabb.cc00.0501)
  Description: Link to AGG-03
  Internet address is 10.0.1.2/24
  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec,
     reliability 255/255, txload 45/255, rxload 55/255
  Encapsulation ARPA, loopback not set
  Keepalive set (10 sec)
  Full-duplex, 1000Mb/s, media type is RJ45
  output flow-control is on, input flow-control is on
  ARP type: ARPA, ARP Timeout 04:00:00
  Last input 00:00:02, output 00:00:00, output hang never
  Last clearing of "show interface" counters 10d02h
  Input queue: 0/75/0/0 (size/max/drops/flushes); Total output drops: 0
  Queueing strategy: fifo
  Output queue: 0/40 (size/max)
  5 minute input rate 2000000 bits/sec, 1500 packets/sec
  5 minute output rate 1500000 bits/sec, 1200 packets/sec
  8234567 packets input, 5123456789 bytes, 0 no buffer
  Received 234 broadcasts, 0 runts, 0 giants, 234 throttles
  45 input errors, 23 CRC: 115, frame 0, overrun 0, ignored 0
  1023456 packets output, 7234567890 bytes, 0 underruns
  0 output errors, 0 collisions, 0 interface resets
  0 babbles, 0 late collision, 0 deferred
  0 lost carrier, 0 no carrier
  0 output buffer failures, 0 output buffers swapped out
  Bandwidth utilization: 65.4%
"""

CAT6509_SHOW_BGP = """BGP router identifier 10.0.1.2, local AS number 65001

BGP table version is 890, main routing table version 890
2341 network entries using 456789 bytes of memory
1234 path entries using 234567 bytes of memory

Neighbor        V    AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd
10.0.0.2        4 65001   34567   34345    890     0    0 4w1d      1234
10.0.0.3        4 65002   23456   23234    890     0    0 3w4d       876
"""

CAT6509_RUNNING_CONFIG = """version 12.2
!
interface GigabitEthernet1/1
 description Link to AGG-03
 speed 1000
 duplex full
 no shutdown
!
interface GigabitEthernet1/2
 description Backup link
 speed 1000
 duplex full
 no shutdown
!
router bgp 65001
 neighbor 10.0.0.2 remote-as 65001
 neighbor 10.0.0.3 remote-as 65002
!
ip route 192.168.0.0 255.255.0.0 10.0.0.2
ip route 192.168.1.0 255.255.255.0 10.0.0.3
"""


def parse_cisco_device(device_type: str, show_interface: str, show_bgp: str,
                      running_config: str) -> Dict:
    """
    Parse complete Cisco device configuration.
    
    Args:
        device_type: 'nexus' or 'catalyst'
        show_interface: Output from 'show interface' command
        show_bgp: Output from 'show ip bgp summary' command
        running_config: Output from 'show running-config' command
        
    Returns:
        Dictionary with parsed device configuration
    """
    parser = CiscoConfigParser()
    
    return {
        'device_type': device_type,
        'interfaces': parser.parse_interface_metrics(show_interface),
        'bgp_sessions': parser.parse_bgp_summary(show_bgp),
        'config': parser.parse_running_config(running_config)
    }
