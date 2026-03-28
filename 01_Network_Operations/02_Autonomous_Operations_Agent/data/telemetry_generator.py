"""
Realistic Telemetry Data Generator
Simulates SNMP/gNMI telemetry from network devices
"""

import random
import math
from datetime import datetime, timedelta
from typing import List, Dict, Any


class TelemetryGenerator:
    """Generate realistic network telemetry data"""

    def __init__(self, num_devices: int = 10, num_samples: int = 100):
        self.num_devices = num_devices
        self.num_samples = num_samples
        self.devices = self._create_devices()

    def _create_devices(self) -> List[Dict[str, str]]:
        """Create list of network devices"""
        devices = []
        for i in range(self.num_devices):
            device_type = random.choice(['NEXUS-SPINE', 'NEXUS-LEAF', 'CAT6509'])
            devices.append({
                'device_id': f"{device_type}-{i:02d}",
                'type': device_type,
                'ip': f"10.{i}.{random.randint(0, 255)}.{random.randint(1, 254)}"
            })
        return devices

    def generate_telemetry(self) -> List[Dict[str, Any]]:
        """Generate telemetry samples"""
        telemetry = []
        base_time = datetime.now() - timedelta(hours=self.num_samples)

        for sample_idx in range(self.num_samples):
            timestamp = base_time + timedelta(minutes=sample_idx)

            for device in self.devices:
                device_id = device['device_id']

                # Base metrics with normal variance
                base_cpu = 35 + random.gauss(0, 8)
                base_mem = 45 + random.gauss(0, 10)
                base_latency = 2 + random.gauss(0, 0.5)
                base_jitter = 0.3 + random.gauss(0, 0.1)
                base_packet_loss = 0.1 + random.gauss(0, 0.05)

                # Interface metrics
                interface_errors = max(0, int(random.gauss(5, 3)))
                bgp_flaps = max(0, int(random.gauss(2, 1)))

                sample = {
                    'timestamp': timestamp.isoformat(),
                    'device_id': device_id,
                    'device_type': device['type'],
                    'cpu_utilization': max(0, min(100, base_cpu)),
                    'memory_utilization': max(0, min(100, base_mem)),
                    'interface_errors': interface_errors,
                    'interface_crc': max(0, int(random.gauss(2, 1))),
                    'bgp_neighbor_flaps': bgp_flaps,
                    'latency_ms': max(0.1, base_latency),
                    'jitter_ms': max(0, base_jitter),
                    'packet_loss_percent': max(0, min(100, base_packet_loss)),
                    'temperature_celsius': 25 + random.gauss(15, 3),
                    'input_bandwidth_util': random.uniform(10, 80),
                    'output_bandwidth_util': random.uniform(10, 80),
                    'qos_drops': max(0, int(random.gauss(1, 1))),
                    'power_supply_status': random.choice(['ok', 'ok']),  # Usually ok
                    'fan_status': random.choice(['ok', 'ok', 'ok', 'warning'])  # Mostly ok
                }

                telemetry.append(sample)

        return telemetry

    def inject_anomalies(self, telemetry: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Inject anomalies into telemetry data"""
        anomaly_samples = random.sample(range(len(telemetry)), k=max(5, len(telemetry) // 20))

        anomaly_types = [
            'cpu_spike',
            'memory_leak',
            'bgp_flap',
            'interface_errors',
            'latency_spike',
            'combined_failure'
        ]

        for idx in anomaly_samples:
            anomaly_type = random.choice(anomaly_types)
            sample = telemetry[idx]

            if anomaly_type == 'cpu_spike':
                sample['cpu_utilization'] = 85 + random.uniform(0, 15)
                sample['anomaly_type'] = 'cpu_spike'

            elif anomaly_type == 'memory_leak':
                sample['memory_utilization'] = 88 + random.uniform(0, 10)
                sample['anomaly_type'] = 'memory_leak'

            elif anomaly_type == 'bgp_flap':
                sample['bgp_neighbor_flaps'] = 15 + random.randint(0, 20)
                sample['anomaly_type'] = 'bgp_flap'

            elif anomaly_type == 'interface_errors':
                sample['interface_errors'] = 50 + random.randint(0, 100)
                sample['interface_crc'] = 30 + random.randint(0, 50)
                sample['anomaly_type'] = 'interface_errors'

            elif anomaly_type == 'latency_spike':
                sample['latency_ms'] = 50 + random.uniform(0, 100)
                sample['jitter_ms'] = 10 + random.uniform(0, 20)
                sample['packet_loss_percent'] = 5 + random.uniform(0, 10)
                sample['anomaly_type'] = 'latency_spike'

            elif anomaly_type == 'combined_failure':
                sample['cpu_utilization'] = 90 + random.uniform(0, 10)
                sample['memory_utilization'] = 85 + random.uniform(0, 10)
                sample['interface_errors'] = 40 + random.randint(0, 60)
                sample['bgp_neighbor_flaps'] = 12 + random.randint(0, 15)
                sample['anomaly_type'] = 'combined_failure'

        return telemetry

    def get_device_trajectory(self, device_id: str, telemetry: List[Dict[str, Any]]) -> Dict[str, List[float]]:
        """Extract time series for a specific device"""
        device_data = [t for t in telemetry if t['device_id'] == device_id]

        trajectory = {
            'timestamps': [t['timestamp'] for t in device_data],
            'cpu_utilization': [t['cpu_utilization'] for t in device_data],
            'memory_utilization': [t['memory_utilization'] for t in device_data],
            'interface_errors': [t['interface_errors'] for t in device_data],
            'bgp_neighbor_flaps': [t['bgp_neighbor_flaps'] for t in device_data],
            'latency_ms': [t['latency_ms'] for t in device_data],
            'jitter_ms': [t['jitter_ms'] for t in device_data],
            'packet_loss_percent': [t['packet_loss_percent'] for t in device_data],
        }

        return trajectory
