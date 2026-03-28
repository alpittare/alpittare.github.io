"""
Event Correlator - Temporal and Spatial Event Correlation
Detects related anomalies across devices and time windows
"""

import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any, Set, Tuple


class EventCorrelator:
    """Correlate anomalies across devices and time"""

    def __init__(self, time_window_minutes: int = 5, spatial_threshold: int = 2):
        """
        Initialize correlator

        Args:
            time_window_minutes: Time window for temporal correlation
            spatial_threshold: Number of hops for spatial correlation
        """
        self.time_window_minutes = time_window_minutes
        self.spatial_threshold = spatial_threshold

        # Device topology (simple: device name similarity)
        self.topology = {}

    def add_topology(self, device_id: str, neighbors: List[str]) -> None:
        """Define device neighbors"""
        self.topology[device_id] = neighbors

    def _parse_timestamp(self, ts_str: str) -> datetime:
        """Parse ISO timestamp"""
        try:
            return datetime.fromisoformat(ts_str)
        except:
            return datetime.now()

    def temporal_correlation(self, anomalies: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
        """Group anomalies by time window"""
        if not anomalies:
            return []

        anomalies_sorted = sorted(anomalies, key=lambda x: self._parse_timestamp(x['timestamp']))

        groups = []
        current_group = [anomalies_sorted[0]]
        base_time = self._parse_timestamp(anomalies_sorted[0]['timestamp'])

        for anomaly in anomalies_sorted[1:]:
            anom_time = self._parse_timestamp(anomaly['timestamp'])
            time_diff = (anom_time - base_time).total_seconds() / 60

            if time_diff <= self.time_window_minutes:
                current_group.append(anomaly)
            else:
                groups.append(current_group)
                current_group = [anomaly]
                base_time = anom_time

        if current_group:
            groups.append(current_group)

        return groups

    def spatial_correlation(self, device_id: str, target_devices: List[str],
                           max_hops: int = 3) -> Set[str]:
        """Find topologically adjacent devices"""
        if device_id not in self.topology:
            return set(target_devices)

        correlated = {device_id}
        to_visit = [device_id]
        visited = set()

        for hop in range(max_hops):
            next_to_visit = []
            for dev in to_visit:
                if dev in visited:
                    continue
                visited.add(dev)

                if dev in self.topology:
                    for neighbor in self.topology[dev]:
                        if neighbor in target_devices:
                            correlated.add(neighbor)
                        if neighbor not in visited:
                            next_to_visit.append(neighbor)

            to_visit = next_to_visit

        return correlated

    def detect_causal_chains(self, anomalies: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Detect sequences of related anomalies"""
        temporal_groups = self.temporal_correlation(anomalies)
        chains = []

        for group in temporal_groups:
            if len(group) < 2:
                continue

            # Check for root cause patterns
            chain = {
                'timestamp': group[0]['timestamp'],
                'anomalies': group,
                'probable_root_cause': self._identify_root_cause(group),
                'affected_devices': list(set(a.get('device_id', 'unknown') for a in group))
            }
            chains.append(chain)

        return chains

    def _identify_root_cause(self, anomalies: List[Dict[str, Any]]) -> str:
        """Heuristic root cause identification"""
        anomaly_types = [a.get('anomaly_type', '') for a in anomalies]

        # Count types
        type_counts = {}
        for atype in anomaly_types:
            type_counts[atype] = type_counts.get(atype, 0) + 1

        most_common = max(type_counts.items(), key=lambda x: x[1], default=('unknown', 0))

        # Pattern matching
        if 'bgp_flap' in anomaly_types and 'latency_spike' in anomaly_types:
            return 'BGP_session_instability'
        elif 'cpu_spike' in anomaly_types and 'memory_leak' in anomaly_types:
            return 'process_runaway'
        elif 'interface_errors' in anomaly_types:
            return 'link_degradation'
        elif 'cpu_spike' in anomaly_types:
            return 'high_cpu_load'
        elif 'memory_leak' in anomaly_types:
            return 'memory_exhaustion'
        elif 'combined_failure' in anomaly_types:
            return 'system_overload'
        else:
            return most_common[0] if most_common[1] > 0 else 'unknown'

    def correlate(self, anomalies: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Full correlation analysis"""
        return {
            'temporal_groups': self.temporal_correlation(anomalies),
            'causal_chains': self.detect_causal_chains(anomalies),
            'total_anomalies': len(anomalies)
        }
