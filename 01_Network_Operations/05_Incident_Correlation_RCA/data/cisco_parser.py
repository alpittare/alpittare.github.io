"""
Cisco device log parser for Nexus 9000 and Catalyst 6509
Extracts structured data from CLI outputs
"""

import re
import json
from datetime import datetime
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, asdict
from enum import Enum

class Severity(Enum):
    EMERGENCY = 0
    ALERT = 1
    CRITICAL = 2
    ERROR = 3
    WARNING = 4
    NOTICE = 5
    INFO = 6
    DEBUG = 7

@dataclass
class LogEntry:
    timestamp: datetime
    severity: str
    facility: str
    message: str
    device_id: str
    raw: str

@dataclass
class InterfaceError:
    interface: str
    device_id: str
    input_errors: int
    output_errors: int
    crc_errors: int
    timestamp: datetime

@dataclass
class BGPNeighbor:
    device_id: str
    neighbor_ip: str
    asn: int
    state: str
    up_down: str
    timestamp: datetime

@dataclass
class EnvironmentAlert:
    device_id: str
    component: str
    status: str
    value: Optional[str]
    timestamp: datetime

class CiscoLogParser:
    """Parse Cisco device logs from syslog format"""
    
    SYSLOG_PATTERN = r'^%(\w+)-(\d)-(\w+):\s*(.*)$'
    TIMESTAMP_PATTERN = r'^(\w+\s+\d+\s+\d+:\d+:\d+)'
    
    SEVERITY_MAP = {
        '0': 'EMERGENCY',
        '1': 'ALERT',
        '2': 'CRITICAL',
        '3': 'ERROR',
        '4': 'WARNING',
        '5': 'NOTICE',
        '6': 'INFO',
        '7': 'DEBUG'
    }
    
    def __init__(self, device_id: str):
        self.device_id = device_id
    
    def parse_logging_output(self, raw_logs: str) -> List[LogEntry]:
        """Parse 'show logging last 100' output"""
        entries = []
        lines = raw_logs.strip().split('\n')
        
        for line in lines:
            if not line.strip():
                continue
            
            # Extract timestamp
            ts_match = re.match(self.TIMESTAMP_PATTERN, line)
            if not ts_match:
                continue
            
            # Parse syslog format
            syslog_match = re.search(self.SYSLOG_PATTERN, line)
            if syslog_match:
                facility = syslog_match.group(1)
                severity_code = syslog_match.group(2)
                message_type = syslog_match.group(3)
                message = syslog_match.group(4)
                severity = self.SEVERITY_MAP.get(severity_code, 'UNKNOWN')
                
                try:
                    ts = datetime.strptime(ts_match.group(1), '%b %d %H:%M:%S')
                    entry = LogEntry(
                        timestamp=ts,
                        severity=severity,
                        facility=facility,
                        message=message,
                        device_id=self.device_id,
                        raw=line
                    )
                    entries.append(entry)
                except ValueError:
                    pass
        
        return entries
    
    def parse_interface_stats(self, show_int_output: str) -> List[InterfaceError]:
        """Parse 'show interface' output for error counters"""
        errors = []
        
        # Split by interface blocks
        interface_blocks = re.split(r'^(\S+\s+is\s+)', show_int_output, flags=re.MULTILINE)[1:]
        
        i = 0
        while i < len(interface_blocks):
            if i + 1 < len(interface_blocks):
                interface_name = interface_blocks[i].strip()
                interface_block = interface_blocks[i + 1]
                
                input_errs = self._extract_number(interface_block, r'Input errors:\s+(\d+)')
                output_errs = self._extract_number(interface_block, r'Output errors:\s+(\d+)')
                crc_errs = self._extract_number(interface_block, r'CRC:\s+(\d+)')
                
                if input_errs or output_errs or crc_errs:
                    error = InterfaceError(
                        interface=interface_name,
                        device_id=self.device_id,
                        input_errors=input_errs or 0,
                        output_errors=output_errs or 0,
                        crc_errors=crc_errs or 0,
                        timestamp=datetime.now()
                    )
                    errors.append(error)
            i += 2
        
        return errors
    
    def parse_bgp_summary(self, show_bgp_output: str) -> List[BGPNeighbor]:
        """Parse 'show ip bgp summary' output"""
        neighbors = []
        
        # BGP summary format:
        # Neighbor     V    AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd
        lines = show_bgp_output.strip().split('\n')
        
        for line in lines:
            if not line.strip() or line.startswith('Neighbor'):
                continue
            
            parts = line.split()
            if len(parts) >= 10:
                try:
                    neighbor_ip = parts[0]
                    asn = int(parts[2])
                    state = parts[9]
                    up_down = parts[8]
                    
                    neighbor = BGPNeighbor(
                        device_id=self.device_id,
                        neighbor_ip=neighbor_ip,
                        asn=asn,
                        state=state,
                        up_down=up_down,
                        timestamp=datetime.now()
                    )
                    neighbors.append(neighbor)
                except (ValueError, IndexError):
                    pass
        
        return neighbors
    
    def parse_environment(self, show_env_output: str) -> List[EnvironmentAlert]:
        """Parse 'show environment' output for hardware alerts"""
        alerts = []
        
        lines = show_env_output.strip().split('\n')
        current_component = None
        
        for line in lines:
            if not line.strip():
                continue
            
            # Detect component headers
            if 'Power Supply' in line or 'Fan' in line or 'Temperature' in line:
                current_component = line.strip()
                continue
            
            # Look for alert patterns
            if current_component:
                if any(word in line.lower() for word in ['critical', 'warning', 'failed', 'failure']):
                    status = 'CRITICAL' if 'critical' in line.lower() else 'WARNING'
                    alert = EnvironmentAlert(
                        device_id=self.device_id,
                        component=current_component,
                        status=status,
                        value=line.strip(),
                        timestamp=datetime.now()
                    )
                    alerts.append(alert)
        
        return alerts
    
    @staticmethod
    def _extract_number(text: str, pattern: str) -> Optional[int]:
        """Extract integer from text using regex pattern"""
        match = re.search(pattern, text)
        return int(match.group(1)) if match else None


def convert_to_dict(obj) -> dict:
    """Convert dataclass to dictionary recursively"""
    if hasattr(obj, '__dataclass_fields__'):
        result = {}
        for key, value in asdict(obj).items():
            if isinstance(value, datetime):
                result[key] = value.isoformat()
            elif isinstance(value, Enum):
                result[key] = value.value
            else:
                result[key] = value
        return result
    return obj
