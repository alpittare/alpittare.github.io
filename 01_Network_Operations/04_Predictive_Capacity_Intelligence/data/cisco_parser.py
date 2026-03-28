"""
Cisco CLI output parser for Nexus 9000 and Catalyst 6509 devices.
Extracts interface utilization, routing stats, and system resources.
"""
import re
from typing import Dict, List, Tuple
import logging

logger = logging.getLogger(__name__)


class CiscoParser:
    """Parse Cisco device CLI outputs."""

    @staticmethod
    def parse_interface(output: str) -> Dict[str, Dict]:
        """
        Parse 'show interface' command output.
        
        Extracts:
        - Interface name
        - Admin/Operational status
        - Input/Output bytes
        - Errors
        - MTU
        - Speed
        
        Returns:
            Dictionary keyed by interface name with parsed data
        """
        interfaces = {}
        
        # Split by interface blocks
        interface_pattern = r'(\w+[\d/]+)\s+is\s+(\w+).*?\n.*?Description:\s+(.*?)\n'
        
        # More flexible parsing for various Cisco formats
        lines = output.strip().split('\n')
        current_interface = None
        
        for line in lines:
            # Match interface line
            iface_match = re.match(r'^(\w+[\d/\.]+)\s+is\s+(\w+)', line)
            if iface_match:
                current_interface = iface_match.group(1)
                status = iface_match.group(2)
                interfaces[current_interface] = {
                    'name': current_interface,
                    'admin_status': status,
                    'operational_status': status
                }
            
            if current_interface:
                # Extract input/output bytes
                io_bytes = re.search(r'(\d+)\s+input\s+bytes.*?(\d+)\s+output\s+bytes', line)
                if io_bytes:
                    interfaces[current_interface]['input_bytes'] = int(io_bytes.group(1))
                    interfaces[current_interface]['output_bytes'] = int(io_bytes.group(2))
                
                # Extract errors
                error_match = re.search(r'(\d+)\s+input\s+errors.*?(\d+)\s+output\s+errors', line)
                if error_match:
                    interfaces[current_interface]['input_errors'] = int(error_match.group(1))
                    interfaces[current_interface]['output_errors'] = int(error_match.group(2))
                
                # Extract MTU
                mtu_match = re.search(r'MTU\s+(\d+)', line)
                if mtu_match:
                    interfaces[current_interface]['mtu'] = int(mtu_match.group(1))
                
                # Extract speed
                speed_match = re.search(r'(\d+)\s+(Mbps|Gbps|Kbps)', line)
                if speed_match:
                    speed = int(speed_match.group(1))
                    unit = speed_match.group(2)
                    if unit == 'Gbps':
                        speed *= 1000
                    elif unit == 'Kbps':
                        speed /= 1000
                    interfaces[current_interface]['speed_mbps'] = speed
                
                # Extract utilization
                util_match = re.search(r'(?:txload|rxload|utilization).*?(\d+)%', line, re.IGNORECASE)
                if util_match:
                    interfaces[current_interface]['utilization_percent'] = float(util_match.group(1))
        
        return interfaces

    @staticmethod
    def parse_routing_summary(output: str) -> Dict[str, int]:
        """
        Parse 'show ip route summary' output.
        
        Returns:
            Dictionary with route counts per protocol
        """
        routes = {
            'connected': 0,
            'static': 0,
            'bgp': 0,
            'ospf': 0,
            'eigrp': 0,
            'rip': 0,
            'isis': 0,
            'total': 0
        }
        
        # Extract connected routes
        connected = re.search(r'(\d+)\s+connected\s+routes', output, re.IGNORECASE)
        if connected:
            routes['connected'] = int(connected.group(1))
        
        # Extract static routes
        static = re.search(r'(\d+)\s+static\s+routes', output, re.IGNORECASE)
        if static:
            routes['static'] = int(static.group(1))
        
        # Extract BGP routes
        bgp = re.search(r'(\d+)\s+bgp\s+routes', output, re.IGNORECASE)
        if bgp:
            routes['bgp'] = int(bgp.group(1))
        
        # Extract OSPF routes
        ospf = re.search(r'(\d+)\s+ospf\s+routes', output, re.IGNORECASE)
        if ospf:
            routes['ospf'] = int(ospf.group(1))
        
        # Extract EIGRP routes
        eigrp = re.search(r'(\d+)\s+eigrp\s+routes', output, re.IGNORECASE)
        if eigrp:
            routes['eigrp'] = int(eigrp.group(1))
        
        # Calculate total
        routes['total'] = sum(v for k, v in routes.items() if k != 'total')
        
        return routes

    @staticmethod
    def parse_system_resources(output: str) -> Dict[str, float]:
        """
        Parse 'show system resources' output.
        
        Returns:
            Dictionary with CPU and memory utilization
        """
        resources = {
            'cpu_user_percent': 0.0,
            'cpu_kernel_percent': 0.0,
            'cpu_total_percent': 0.0,
            'memory_used_mb': 0,
            'memory_total_mb': 0,
            'memory_percent': 0.0
        }
        
        # Extract CPU utilization
        cpu_match = re.search(r'CPU\s+utilization:.*?(\d+(?:\.\d+)?)\s*%.*?(?:user|sys)?.*?(\d+(?:\.\d+)?)\s*%', 
                            output, re.IGNORECASE | re.DOTALL)
        if cpu_match:
            resources['cpu_user_percent'] = float(cpu_match.group(1))
            resources['cpu_kernel_percent'] = float(cpu_match.group(2))
            resources['cpu_total_percent'] = (float(cpu_match.group(1)) + float(cpu_match.group(2))) / 2
        
        # Extract memory utilization
        mem_match = re.search(r'Memory\s+usage:.*?(\d+)\s*(?:MB|K).*?(\d+)\s*(?:MB|K)', 
                            output, re.IGNORECASE | re.DOTALL)
        if mem_match:
            resources['memory_used_mb'] = int(mem_match.group(1))
            resources['memory_total_mb'] = int(mem_match.group(2))
            if resources['memory_total_mb'] > 0:
                resources['memory_percent'] = (resources['memory_used_mb'] / resources['memory_total_mb']) * 100
        
        return resources

    @staticmethod
    def calculate_utilization(input_bytes: int, output_bytes: int, 
                             speed_mbps: float, interval_seconds: int = 300) -> float:
        """
        Calculate interface utilization percentage.
        
        Args:
            input_bytes: Input bytes counter
            output_bytes: Output bytes counter
            speed_mbps: Interface speed in Mbps
            interval_seconds: Time interval for calculation
        
        Returns:
            Utilization percentage (0-100)
        """
        if speed_mbps <= 0 or interval_seconds <= 0:
            return 0.0
        
        # Total bytes transferred
        total_bytes = input_bytes + output_bytes
        
        # Convert to bits
        total_bits = total_bytes * 8
        
        # Maximum bits for interval
        max_bits = speed_mbps * 1_000_000 * interval_seconds
        
        # Utilization percentage
        utilization = (total_bits / max_bits) * 100 if max_bits > 0 else 0
        
        return min(utilization, 100.0)
