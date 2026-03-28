"""
Cisco CLI Output Parser
Parses Nexus 9000 and Catalyst 6509 command outputs
"""

import re
from typing import Dict, List, Any, Optional


class CiscoInterfaceParser:
    """Parse 'show interface' output"""

    @staticmethod
    def parse(output: str) -> List[Dict[str, Any]]:
        """Parse show interface output"""
        interfaces = []
        current_intf = None

        for line in output.strip().split('\n'):
            # Interface header line
            if re.match(r'^[A-Za-z0-9/]+\s+is\s+(up|down)', line):
                if current_intf:
                    interfaces.append(current_intf)

                match = re.match(r'^([A-Za-z0-9/]+)\s+is\s+(up|down)', line)
                if match:
                    current_intf = {
                        'interface': match.group(1),
                        'status': match.group(2),
                        'admin_status': 'admin down' in line.lower() and 'down' or 'up'
                    }

            if not current_intf:
                continue

            # Parse bandwidth
            if 'BW' in line and 'Kbit/sec' in line:
                match = re.search(r'BW\s+(\d+)', line)
                if match:
                    current_intf['bandwidth_kbps'] = int(match.group(1))

            # Parse MTU
            if 'MTU' in line:
                match = re.search(r'MTU\s+(\d+)', line)
                if match:
                    current_intf['mtu'] = int(match.group(1))

            # Parse duplex and speed
            if 'Full-duplex' in line or 'Half-duplex' in line:
                duplex = 'Full' if 'Full-duplex' in line else 'Half'
                current_intf['duplex'] = duplex
                match = re.search(r'(\d+)\s+(Gb|Mb)/s', line)
                if match:
                    speed = int(match.group(1))
                    unit = match.group(2)
                    current_intf['speed_gbps'] = speed if unit == 'Gb' else speed / 1000

            # Parse last link flapped
            if 'Last link flapped' in line:
                current_intf['link_flapped'] = line.split('Last link flapped')[1].strip()

            # Parse input/output rates
            if '5 minute input rate' in line:
                match = re.search(r'(\d+)\s+bits/sec', line)
                if match:
                    current_intf['input_rate_bps'] = int(match.group(1))

            if '5 minute output rate' in line:
                match = re.search(r'(\d+)\s+bits/sec', line)
                if match:
                    current_intf['output_rate_bps'] = int(match.group(1))

            # Parse received packets
            if 'Received' in line and 'bytes' in line and 'unicast' in line:
                match = re.search(r'Received\s+(\d+)\s+bytes.*?(\d+)\s+unicast', line)
                if match:
                    current_intf['rx_bytes'] = int(match.group(1))
                    current_intf['rx_unicast'] = int(match.group(2))

            # Parse sent packets
            if 'Sent' in line and 'bytes' in line and 'unicast' in line:
                match = re.search(r'Sent\s+(\d+)\s+bytes.*?(\d+)\s+unicast', line)
                if match:
                    current_intf['tx_bytes'] = int(match.group(1))
                    current_intf['tx_unicast'] = int(match.group(2))

            # Parse CRC errors
            if 'CRC' in line and 'Input errors' in line:
                match = re.search(r'CRC\s+(\d+)', line)
                if match:
                    current_intf['crc_errors'] = int(match.group(1))

            # Parse output drops
            if 'Interface drops:' in line:
                match = re.search(r'(\d+)\s+bytes', line)
                if match:
                    current_intf['output_drops'] = int(match.group(1))

        if current_intf:
            interfaces.append(current_intf)

        return interfaces


class CiscoBGPParser:
    """Parse 'show ip bgp summary' output"""

    @staticmethod
    def parse(output: str) -> Dict[str, Any]:
        """Parse BGP summary output"""
        result = {
            'router_id': None,
            'local_as': None,
            'neighbors': [],
            'total_prefixes': None
        }

        lines = output.strip().split('\n')

        for line in lines:
            # Parse router ID and local AS
            if 'router identifier' in line:
                match = re.search(r'identifier\s+([\d.]+).*?AS\s+(\d+)', line)
                if match:
                    result['router_id'] = match.group(1)
                    result['local_as'] = int(match.group(2))

            # Parse neighbor lines
            if re.match(r'^\s*[\d.]+\s+\d+\s+\d+', line):
                parts = line.split()
                if len(parts) >= 7:
                    try:
                        neighbor = {
                            'neighbor_ip': parts[0],
                            'version': int(parts[1]),
                            'remote_as': int(parts[2]),
                            'msg_rcvd': int(parts[3]),
                            'msg_sent': int(parts[4]),
                            'state_or_prefixes': parts[-1]
                        }
                        # Determine if Down or Up
                        if neighbor['state_or_prefixes'].lower() == 'down':
                            neighbor['state'] = 'Down'
                            neighbor['prefixes'] = 0
                        else:
                            neighbor['state'] = 'Up'
                            try:
                                neighbor['prefixes'] = int(neighbor['state_or_prefixes'])
                            except:
                                neighbor['prefixes'] = 0
                        result['neighbors'].append(neighbor)
                    except (ValueError, IndexError):
                        pass

            # Parse total prefixes
            if 'Total prefixes:' in line:
                match = re.search(r'Total prefixes:\s+(\d+)', line)
                if match:
                    result['total_prefixes'] = int(match.group(1))

        return result


class CiscoEnvironmentParser:
    """Parse 'show environment' output"""

    @staticmethod
    def parse(output: str) -> Dict[str, Any]:
        """Parse environment output"""
        result = {
            'power_supplies': [],
            'fans': [],
            'temperatures': {},
            'module_status': None
        }

        lines = output.strip().split('\n')
        current_ps = None

        for line in lines:
            line = line.strip()

            # Parse power supplies
            if line.startswith('PS') and ('Normal' in line or 'Warning' in line or 'Critical' in line):
                match = re.match(r'(PS\d+).*?\(Power Supply \d+\)\s+(\w+)', line)
                if match:
                    result['power_supplies'].append({
                        'name': match.group(1),
                        'status': match.group(2)
                    })

            # Parse fans
            if line.startswith('FAN') and ('Normal' in line or 'Warning' in line):
                match = re.match(r'(FAN\d+).*?\(Fan Module \d+\)\s+(\w+)', line)
                if match:
                    result['fans'].append({
                        'name': match.group(1),
                        'status': match.group(2)
                    })

            # Parse temperature sensors
            if 'Temp Sensor' in line and ':' in line:
                match = re.match(r'(\w+\s+\w+\s+Sensor)\s*:\s+(\d+)', line)
                if match:
                    sensor_name = match.group(1).strip()
                    temp_value = int(match.group(2))
                    result['temperatures'][sensor_name] = temp_value

            # Parse power supply details
            if line.startswith('PS') and 'Model' in line:
                match = re.search(r'PS(\d+)\s+Model\s*:\s+(.+)', line)
                if match:
                    current_ps = {'ps_id': match.group(1), 'model': match.group(2)}

            if current_ps and 'Power Used' in line:
                match = re.search(r'(\d+)\s+W\s+\((\d+)%\)', line)
                if match:
                    current_ps['power_used_w'] = int(match.group(1))
                    current_ps['power_used_percent'] = int(match.group(2))

        return result


class CiscoLoggingParser:
    """Parse 'show logging last 100' output"""

    @staticmethod
    def parse(output: str) -> List[Dict[str, Any]]:
        """Parse syslog output"""
        logs = []

        for line in output.strip().split('\n'):
            if not line.strip():
                continue

            # Parse timestamp and message
            match = re.match(
                r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\s+(\w+)\s+([A-Z_]+)-(\d+)-(.+)',
                line
            )
            if match:
                timestamp, host, facility, severity, message = match.groups()
                logs.append({
                    'timestamp': timestamp,
                    'host': host,
                    'facility': facility,
                    'severity': int(severity),
                    'message': message.strip()
                })

        return logs


class CiscoCPUParser:
    """Parse 'show processes cpu' output"""

    @staticmethod
    def parse(output: str) -> Dict[str, Any]:
        """Parse CPU utilization output"""
        result = {
            'cpu_5sec': None,
            'cpu_1min': None,
            'cpu_5min': None,
            'processes': []
        }

        lines = output.strip().split('\n')

        for line in lines:
            # Parse CPU summary line
            if 'five seconds:' in line:
                match = re.search(r'five seconds:\s+(\d+)%', line)
                if match:
                    result['cpu_5sec'] = int(match.group(1))

            if 'one minute:' in line:
                match = re.search(r'one minute:\s+(\d+)%', line)
                if match:
                    result['cpu_1min'] = int(match.group(1))

            if 'five minutes:' in line:
                match = re.search(r'five minutes:\s+(\d+)%', line)
                if match:
                    result['cpu_5min'] = int(match.group(1))

            # Parse process lines
            if re.match(r'^\d+\s+\w', line):
                parts = line.split()
                if len(parts) >= 8:
                    try:
                        process = {
                            'pid': int(parts[0]),
                            'name': parts[1],
                            'cpu_5sec': float(parts[-3].rstrip('%')),
                            'cpu_1min': float(parts[-2].rstrip('%')),
                            'cpu_5min': float(parts[-1].rstrip('%'))
                        }
                        result['processes'].append(process)
                    except (ValueError, IndexError):
                        pass

        return result


def parse_cisco_output(command_type: str, output: str) -> Dict[str, Any]:
    """
    Main parser dispatcher

    Args:
        command_type: 'interface', 'bgp', 'environment', 'logging', or 'cpu'
        output: Raw CLI output string

    Returns:
        Parsed data structure
    """
    if command_type == 'interface':
        return {'interfaces': CiscoInterfaceParser.parse(output)}
    elif command_type == 'bgp':
        return CiscoBGPParser.parse(output)
    elif command_type == 'environment':
        return CiscoEnvironmentParser.parse(output)
    elif command_type == 'logging':
        return {'logs': CiscoLoggingParser.parse(output)}
    elif command_type == 'cpu':
        return CiscoCPUParser.parse(output)
    else:
        raise ValueError(f"Unknown command type: {command_type}")
