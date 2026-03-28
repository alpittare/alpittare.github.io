"""
Multi-dimensional event correlation engine
Temporal, spatial, and causal correlation
"""

from typing import List, Dict, Set, Tuple, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, field
import math

@dataclass
class CorrelatedIncident:
    """Group of correlated alarms representing a single incident"""
    incident_id: str
    root_cause: Optional[str] = None
    alarms: List = field(default_factory=list)
    confidence_score: float = 0.0
    affected_devices: Set[str] = field(default_factory=set)
    affected_services: Set[str] = field(default_factory=set)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    
    def add_alarm(self, alarm):
        self.alarms.append(alarm)
        self.affected_devices.add(alarm.device_id)
        if not self.start_time or alarm.timestamp < self.start_time:
            self.start_time = alarm.timestamp
        if not self.end_time or alarm.timestamp > self.end_time:
            self.end_time = alarm.timestamp

class CorrelationEngine:
    """
    Correlate alarms across multiple dimensions:
    - Temporal: events within time window
    - Spatial: events on topologically connected devices
    - Causal: known cause-effect patterns
    """
    
    # Known cause-effect patterns
    CAUSAL_PATTERNS = {
        ('POWER_SUPPLY_FAILURE', 'TEMPERATURE_CRITICAL'): 0.9,
        ('POWER_SUPPLY_FAILURE', 'MODULE_FAILURE'): 0.85,
        ('POWER_SUPPLY_FAILURE', 'INTERFACE_ERROR'): 0.8,
        ('POWER_SUPPLY_FAILURE', 'BGP_SESSION_DOWN'): 0.7,
        ('MODULE_FAILURE', 'INTERFACE_ERROR'): 0.85,
        ('INTERFACE_ERROR', 'LINK_FLAP'): 0.8,
        ('LINK_FLAP', 'STP_TOPOLOGY_CHANGE'): 0.85,
        ('STP_TOPOLOGY_CHANGE', 'TRAFFIC_LOSS'): 0.8,
        ('BGP_SESSION_DOWN', 'ROUTE_WITHDRAW'): 0.9,
    }
    
    def __init__(self, temporal_window_sec: int = 300, topology=None):
        """
        Args:
            temporal_window_sec: Time window for temporal correlation (default 5 min)
            topology: NetworkTopology object for spatial correlation
        """
        self.temporal_window = timedelta(seconds=temporal_window_sec)
        self.topology = topology
        self.incidents = []
    
    def correlate(self, alarms: List) -> List[CorrelatedIncident]:
        """
        Correlate alarms into incident groups.
        
        Args:
            alarms: List of alarm objects (should be deduplicated)
        
        Returns:
            List of CorrelatedIncident objects
        """
        sorted_alarms = sorted(alarms, key=lambda x: x.timestamp)
        self.incidents = []
        processed = set()
        
        for i, alarm in enumerate(sorted_alarms):
            if i in processed:
                continue
            
            # Start new incident with this alarm
            incident = CorrelatedIncident(
                incident_id=f"INC-{len(self.incidents)}",
                alarms=[]
            )
            incident.add_alarm(alarm)
            processed.add(i)
            
            # Find correlated alarms
            for j in range(i + 1, len(sorted_alarms)):
                if j in processed:
                    continue
                
                candidate = sorted_alarms[j]
                
                # Check temporal correlation
                if not self._temporal_correlation(alarm, candidate):
                    break  # No more temporal correlation in sorted list
                
                # Check spatial correlation
                spatial_score = self._spatial_correlation(
                    incident.affected_devices,
                    candidate.device_id
                )
                
                # Check causal correlation
                causal_score = self._causal_correlation(
                    incident.alarms,
                    candidate
                )
                
                # Correlation threshold
                total_score = (
                    0.3 * (1.0 if self._temporal_correlation(alarm, candidate) else 0.0) +
                    0.3 * spatial_score +
                    0.4 * causal_score
                )
                
                if total_score > 0.5:
                    incident.add_alarm(candidate)
                    processed.add(j)
            
            # Calculate incident confidence
            incident.confidence_score = self._calculate_confidence(incident)
            self.incidents.append(incident)
        
        return self.incidents
    
    def _temporal_correlation(self, alarm1, alarm2) -> bool:
        """Check if two alarms are temporally correlated"""
        time_diff = abs((alarm1.timestamp - alarm2.timestamp).total_seconds())
        return time_diff <= self.temporal_window.total_seconds()
    
    def _spatial_correlation(self, affected_devices: Set[str], device_id: str) -> float:
        """Check spatial correlation based on topology"""
        if not self.topology:
            return 0.5 if device_id in affected_devices else 0.1
        
        if device_id in affected_devices:
            return 0.9
        
        # Check if device is adjacent to affected devices
        for affected in affected_devices:
            neighbors = self.topology.get_neighbors(affected)
            if device_id in neighbors:
                return 0.7
            
            # Check 2-hop distance
            distance = self.topology.get_distance(affected, device_id)
            if distance == 2:
                return 0.4
            elif distance == 3:
                return 0.2
        
        return 0.1
    
    def _causal_correlation(self, previous_alarms: List, new_alarm) -> float:
        """Check causal relationship with previous alarms"""
        if not previous_alarms:
            return 0.5
        
        max_score = 0.0
        for prev_alarm in previous_alarms:
            pattern = (prev_alarm.alarm_type, new_alarm.alarm_type)
            score = self.CAUSAL_PATTERNS.get(pattern, 0.0)
            max_score = max(max_score, score)
        
        return max_score
    
    def _calculate_confidence(self, incident: CorrelatedIncident) -> float:
        """Calculate confidence score for incident grouping"""
        if not incident.alarms:
            return 0.0
        
        # Factor 1: Number of alarms (more = higher confidence)
        alarm_factor = min(len(incident.alarms) / 10.0, 1.0)
        
        # Factor 2: Severity (critical incidents more likely grouped correctly)
        avg_severity = sum(
            self._severity_to_score(a.severity)
            for a in incident.alarms
        ) / len(incident.alarms)
        severity_factor = avg_severity
        
        # Factor 3: Temporal coherence (events closer in time = higher confidence)
        if incident.end_time and incident.start_time:
            duration = (incident.end_time - incident.start_time).total_seconds()
            temporal_factor = 1.0 - min(duration / 3600.0, 1.0)  # 1 hour = very low confidence
        else:
            temporal_factor = 1.0
        
        confidence = (alarm_factor * 0.3 + severity_factor * 0.4 + temporal_factor * 0.3)
        return confidence
    
    @staticmethod
    def _severity_to_score(severity: str) -> float:
        """Convert severity to numeric score"""
        severity_scores = {
            'CRITICAL': 1.0,
            'ERROR': 0.8,
            'WARNING': 0.6,
            'NOTICE': 0.4,
            'INFO': 0.2,
            'DEBUG': 0.1
        }
        return severity_scores.get(severity, 0.5)
