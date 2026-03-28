"""
Realistic network alarm generator based on incident scenarios
"""

import random
import json
from datetime import datetime, timedelta
from typing import List, Dict
from dataclasses import dataclass, asdict

@dataclass
class Alarm:
    timestamp: datetime
    device_id: str
    alarm_type: str
    severity: str
    message: str
    interface: str = ""
    bgp_neighbor: str = ""
    
    def to_dict(self):
        d = asdict(self)
        d['timestamp'] = self.timestamp.isoformat()
        return d

class AlarmGenerator:
    """Generate realistic network alarms simulating major incidents"""
    
    SEVERITIES = ['CRITICAL', 'ERROR', 'WARNING', 'NOTICE', 'INFO']
    DEVICES = [
        'CORE-1', 'CORE-2', 'DIST-1', 'DIST-2', 'DIST-3',
        'ACC-1', 'ACC-2', 'ACC-3', 'ACC-4', 'ACC-5'
    ]
    
    INTERFACES = {
        'CORE-1': ['Eth1/1', 'Eth2/1', 'Eth2/2', 'Eth1/48'],
        'CORE-2': ['Eth1/1', 'Eth2/1', 'Eth2/2', 'Eth1/48'],
        'DIST-1': ['Eth1/1', 'Eth1/2', 'Eth2/1', 'Eth3/1', 'Eth3/2'],
        'DIST-2': ['Eth1/1', 'Eth1/2', 'Eth2/1', 'Eth3/1'],
        'DIST-3': ['Eth1/1', 'Eth1/2', 'Eth3/1', 'Eth3/2'],
        'ACC-1': ['Eth1/1', 'Eth1/2', 'Eth1/3', 'Eth1/4'],
        'ACC-2': ['Eth1/1', 'Eth1/2', 'Eth1/3'],
        'ACC-3': ['Eth1/1', 'Eth1/2', 'Eth1/3', 'Eth1/4'],
        'ACC-4': ['Eth1/1', 'Eth1/2', 'Eth1/3'],
        'ACC-5': ['Eth1/1', 'Eth1/2', 'Eth1/3'],
    }
    
    BGP_NEIGHBORS = {
        'CORE-1': ['10.0.0.2', '10.1.0.1'],
        'CORE-2': ['10.0.0.1', '10.1.0.1'],
        'DIST-1': ['10.0.1.1', '10.0.1.2'],
        'DIST-2': ['10.0.1.1', '10.0.1.2'],
        'DIST-3': ['10.2.0.1', '10.2.0.2'],
    }
    
    def __init__(self):
        self.base_time = datetime.now() - timedelta(hours=2)
        self.alarms = []
    
    def generate_incident_1(self, start_offset_sec: int = 0) -> List[Alarm]:
        """
        Incident 1: Core router failure (CORE-1)
        Cascading: BGP drops → Route withdrawals → Packet loss
        """
        incident_time = self.base_time + timedelta(seconds=start_offset_sec)
        incident_alarms = []
        
        # T+0s: Power Supply Failure
        incident_alarms.append(Alarm(
            timestamp=incident_time,
            device_id='CORE-1',
            alarm_type='POWER_SUPPLY_FAILURE',
            severity='CRITICAL',
            message='Power Supply 1 failed'
        ))
        
        # T+2s: CPU overheating due to power issue
        incident_alarms.append(Alarm(
            timestamp=incident_time + timedelta(seconds=2),
            device_id='CORE-1',
            alarm_type='TEMPERATURE_CRITICAL',
            severity='CRITICAL',
            message='CPU temperature critical: 95C'
        ))
        
        # T+5s: BGP session loss to CORE-2
        for i in range(3):
            incident_alarms.append(Alarm(
                timestamp=incident_time + timedelta(seconds=5),
                device_id='CORE-1',
                alarm_type='BGP_SESSION_DOWN',
                severity='CRITICAL',
                message='BGP session to 10.0.0.2 (CORE-2) down',
                bgp_neighbor='10.0.0.2'
            ))
        
        # T+5s: BGP session loss to distribution
        for neighbor in ['10.1.0.1']:
            incident_alarms.append(Alarm(
                timestamp=incident_time + timedelta(seconds=5),
                device_id='CORE-1',
                alarm_type='BGP_SESSION_DOWN',
                severity='CRITICAL',
                message=f'BGP session to {neighbor} (DIST) down',
                bgp_neighbor=neighbor
            ))
        
        # T+6s: Route withdrawal (many routes)
        for i in range(5):
            incident_alarms.append(Alarm(
                timestamp=incident_time + timedelta(seconds=6),
                device_id='CORE-1',
                alarm_type='ROUTE_WITHDRAW',
                severity='ERROR',
                message='Multiple BGP route withdrawals'
            ))
        
        # T+10s: Secondary effects on DIST-1 and DIST-2
        for dist in ['DIST-1', 'DIST-2']:
            incident_alarms.append(Alarm(
                timestamp=incident_time + timedelta(seconds=10),
                device_id=dist,
                alarm_type='BGP_SESSION_DOWN',
                severity='ERROR',
                message=f'BGP session to CORE-1 down (peer unreachable)',
                bgp_neighbor='10.0.1.1'
            ))
        
        # T+12s: Packet loss on access interfaces
        for i in range(3):
            incident_alarms.append(Alarm(
                timestamp=incident_time + timedelta(seconds=12),
                device_id='ACC-1',
                alarm_type='PACKET_LOSS',
                severity='WARNING',
                message='High packet loss detected on uplink',
                interface='Eth1/1'
            ))
        
        return incident_alarms
    
    def generate_incident_2(self, start_offset_sec: int = 3600) -> List[Alarm]:
        """
        Incident 2: Power supply failure cascading to line cards
        Cascading: PSU failure → Multiple module failures → Interface errors
        """
        incident_time = self.base_time + timedelta(seconds=start_offset_sec)
        incident_alarms = []
        
        # T+0s: PSU failure on DIST-1
        incident_alarms.append(Alarm(
            timestamp=incident_time,
            device_id='DIST-1',
            alarm_type='POWER_SUPPLY_FAILURE',
            severity='CRITICAL',
            message='Power Supply redundancy lost'
        ))
        
        # T+1s: Second PSU degraded
        incident_alarms.append(Alarm(
            timestamp=incident_time + timedelta(seconds=1),
            device_id='DIST-1',
            alarm_type='POWER_DEGRADED',
            severity='ERROR',
            message='Power Supply 2 operating at reduced capacity'
        ))
        
        # T+3s: Line card failures
        for lc in range(3):
            incident_alarms.append(Alarm(
                timestamp=incident_time + timedelta(seconds=3),
                device_id='DIST-1',
                alarm_type='MODULE_FAILURE',
                severity='CRITICAL',
                message=f'Supervisor Module {lc} failure detected'
            ))
        
        # T+5s: Interface errors cascading
        interfaces = ['Eth3/1', 'Eth3/2', 'Eth1/1', 'Eth1/2']
        for intf in interfaces:
            for i in range(2):
                incident_alarms.append(Alarm(
                    timestamp=incident_time + timedelta(seconds=5 + i),
                    device_id='DIST-1',
                    alarm_type='INTERFACE_ERROR',
                    severity='ERROR',
                    message=f'{intf} CRC errors increasing',
                    interface=intf
                ))
        
        # T+8s: BGP impact
        incident_alarms.append(Alarm(
            timestamp=incident_time + timedelta(seconds=8),
            device_id='DIST-1',
            alarm_type='BGP_SESSION_DOWN',
            severity='ERROR',
            message='BGP session flapping'
        ))
        
        # T+10s: Downstream effects on ACC-1 and ACC-2
        for acc in ['ACC-1', 'ACC-2']:
            incident_alarms.append(Alarm(
                timestamp=incident_time + timedelta(seconds=10),
                device_id=acc,
                alarm_type='UPLINK_UNREACHABLE',
                severity='ERROR',
                message='Uplink to DIST-1 unreachable',
                interface='Eth1/1'
            ))
        
        return incident_alarms
    
    def generate_incident_3(self, start_offset_sec: int = 7200) -> List[Alarm]:
        """
        Incident 3: Interface flapping causing STP reconvergence
        Cascading: Link flapping → STP events → Brief traffic loss
        """
        incident_time = self.base_time + timedelta(seconds=start_offset_sec)
        incident_alarms = []
        
        # T+0s: Interface begins flapping on DIST-2
        for i in range(5):
            incident_alarms.append(Alarm(
                timestamp=incident_time + timedelta(milliseconds=i*200),
                device_id='DIST-2',
                alarm_type='LINK_FLAP',
                severity='WARNING',
                message='Eth3/1 link flapping',
                interface='Eth3/1'
            ))
        
        # T+1s: STP topology change
        incident_alarms.append(Alarm(
            timestamp=incident_time + timedelta(seconds=1),
            device_id='DIST-2',
            alarm_type='STP_TOPOLOGY_CHANGE',
            severity='WARNING',
            message='STP topology change detected'
        ))
        
        # T+1.5s: Root bridge election
        incident_alarms.append(Alarm(
            timestamp=incident_time + timedelta(seconds=1.5),
            device_id='DIST-2',
            alarm_type='STP_ROOT_CHANGE',
            severity='WARNING',
            message='STP Root Bridge changed'
        ))
        
        # T+2s: Multiple interfaces experiencing flapping
        for i in range(8):
            incident_alarms.append(Alarm(
                timestamp=incident_time + timedelta(seconds=2 + i*0.5),
                device_id='DIST-2',
                alarm_type='LINK_FLAP',
                severity='WARNING',
                message='Eth3/1 link flapping (repeated)',
                interface='Eth3/1'
            ))
        
        # T+6s: Traffic loss on dependent VLANs
        for vlan in [10, 20, 30]:
            incident_alarms.append(Alarm(
                timestamp=incident_time + timedelta(seconds=6),
                device_id='ACC-3',
                alarm_type='TRAFFIC_LOSS',
                severity='ERROR',
                message=f'VLAN {vlan} traffic loss detected',
                interface='Eth1/1'
            ))
        
        # T+8s: Recovery begins
        incident_alarms.append(Alarm(
            timestamp=incident_time + timedelta(seconds=8),
            device_id='DIST-2',
            alarm_type='LINK_UP',
            severity='INFO',
            message='Eth3/1 link stabilized',
            interface='Eth3/1'
        ))
        
        return incident_alarms
    
    def generate_all_incidents(self) -> List[Alarm]:
        """Generate all three incidents with some background noise"""
        alarms = []
        
        # Generate main incidents
        alarms.extend(self.generate_incident_1(0))
        alarms.extend(self.generate_incident_2(3600))
        alarms.extend(self.generate_incident_3(7200))
        
        # Add background noise (normal operations)
        for _ in range(100):
            device = random.choice(self.DEVICES)
            alarms.append(Alarm(
                timestamp=self.base_time + timedelta(seconds=random.randint(0, 10800)),
                device_id=device,
                alarm_type=random.choice(['LINK_UP', 'CONFIG_CHANGE', 'MEMORY_WARNING']),
                severity=random.choice(['INFO', 'NOTICE', 'WARNING']),
                message='Normal operational event',
                interface=random.choice(self.INTERFACES[device])
            ))
        
        return sorted(alarms, key=lambda x: x.timestamp)
