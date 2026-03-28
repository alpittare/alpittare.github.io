"""
Telemetry Data Simulator - Generate synthetic network device metrics
"""

import random
import time
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from typing import Dict, List
import json


@dataclass
class TelemetrySnapshot:
    """Single telemetry reading from a device"""
    timestamp: str
    device_id: str
    device_name: str
    cpu_percent: float
    memory_percent: float
    interface_errors: int
    packet_loss_percent: float
    bgp_neighbors_up: int
    bgp_neighbors_down: int
    stp_blocked_ports: int
    link_utilization_percent: float


class TelemetrySimulator:
    """Simulate network device telemetry"""
    
    def __init__(self, device_name: str = "nexus-01", device_id: str = "nx-001"):
        self.device_name = device_name
        self.device_id = device_id
        self.baseline_cpu = 25.0
        self.baseline_memory = 45.0
        self.baseline_errors = 0
        self.baseline_loss = 0.0
        self.baseline_bgp_up = 8
        self.baseline_bgp_down = 0
        self.baseline_link_util = 35.0
        
        # State for anomalies
        self.anomaly_active = False
        self.anomaly_type = None
        self.anomaly_start_time = None
        self.anomaly_duration = 0

    def inject_anomaly(self, anomaly_type: str, duration: int = 5):
        """Inject network fault scenario"""
        self.anomaly_active = True
        self.anomaly_type = anomaly_type
        self.anomaly_start_time = datetime.now()
        self.anomaly_duration = duration

    def check_anomaly_expired(self) -> bool:
        """Check if anomaly should be resolved"""
        if not self.anomaly_active:
            return False
        
        elapsed = (datetime.now() - self.anomaly_start_time).total_seconds()
        if elapsed > self.anomaly_duration:
            self.anomaly_active = False
            return True
        return False

    def _apply_anomaly(self, metrics: Dict) -> Dict:
        """Modify metrics based on active anomaly"""
        if not self.anomaly_active:
            return metrics
        
        anomaly_map = {
            'link_down': lambda m: {
                **m,
                'interface_errors': m['interface_errors'] + random.randint(100, 500),
                'packet_loss_percent': min(100.0, m['packet_loss_percent'] + 80),
                'link_utilization_percent': 0.1
            },
            'bgp_flap': lambda m: {
                **m,
                'bgp_neighbors_down': random.randint(2, 4),
                'bgp_neighbors_up': max(0, m['bgp_neighbors_up'] - random.randint(2, 4)),
                'packet_loss_percent': m['packet_loss_percent'] + random.uniform(20, 40)
            },
            'interface_flap': lambda m: {
                **m,
                'interface_errors': m['interface_errors'] + random.randint(500, 2000),
                'packet_loss_percent': m['packet_loss_percent'] + random.uniform(10, 30),
                'link_utilization_percent': random.uniform(10, 90)
            },
            'high_cpu': lambda m: {
                **m,
                'cpu_percent': min(99.0, m['cpu_percent'] + random.uniform(40, 60)),
                'memory_percent': min(95.0, m['memory_percent'] + random.uniform(20, 40)),
                'packet_loss_percent': m['packet_loss_percent'] + random.uniform(5, 15)
            },
            'stp_loop': lambda m: {
                **m,
                'stp_blocked_ports': random.randint(3, 8),
                'interface_errors': m['interface_errors'] + random.randint(1000, 5000),
                'packet_loss_percent': min(100.0, m['packet_loss_percent'] + 50)
            }
        }
        
        if self.anomaly_type in anomaly_map:
            return anomaly_map[self.anomaly_type](metrics)
        
        return metrics

    def get_snapshot(self) -> TelemetrySnapshot:
        """Generate single telemetry snapshot"""
        # Base metrics with small drift
        cpu = self.baseline_cpu + random.gauss(0, 2)
        memory = self.baseline_memory + random.gauss(0, 1.5)
        errors = max(0, int(self.baseline_errors + random.gauss(0, 5)))
        loss = max(0.0, self.baseline_loss + random.gauss(0, 0.1))
        bgp_up = max(0, int(self.baseline_bgp_up + random.randint(-1, 1)))
        bgp_down = max(0, int(self.baseline_bgp_down + random.randint(0, 1)))
        link_util = self.baseline_link_util + random.gauss(0, 5)
        
        metrics = {
            'cpu_percent': max(0, min(100, cpu)),
            'memory_percent': max(0, min(100, memory)),
            'interface_errors': errors,
            'packet_loss_percent': max(0.0, min(100.0, loss)),
            'bgp_neighbors_up': bgp_up,
            'bgp_neighbors_down': bgp_down,
            'stp_blocked_ports': 0,
            'link_utilization_percent': max(0, min(100, link_util))
        }
        
        # Apply anomaly if active
        metrics = self._apply_anomaly(metrics)
        
        return TelemetrySnapshot(
            timestamp=datetime.now().isoformat(),
            device_id=self.device_id,
            device_name=self.device_name,
            cpu_percent=metrics['cpu_percent'],
            memory_percent=metrics['memory_percent'],
            interface_errors=metrics['interface_errors'],
            packet_loss_percent=metrics['packet_loss_percent'],
            bgp_neighbors_up=metrics['bgp_neighbors_up'],
            bgp_neighbors_down=metrics['bgp_neighbors_down'],
            stp_blocked_ports=metrics['stp_blocked_ports'],
            link_utilization_percent=metrics['link_utilization_percent']
        )

    def get_timeline(self, samples: int = 100) -> List[TelemetrySnapshot]:
        """Generate timeline of telemetry data"""
        snapshots = []
        for _ in range(samples):
            snapshots.append(self.get_snapshot())
        return snapshots

    def export_json(self, snapshot: TelemetrySnapshot) -> str:
        """Export snapshot as JSON"""
        return json.dumps(asdict(snapshot), indent=2)
