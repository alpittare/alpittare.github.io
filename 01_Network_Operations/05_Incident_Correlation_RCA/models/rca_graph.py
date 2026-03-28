"""
Graph-based root cause analysis using network topology
"""

from typing import List, Dict, Tuple, Optional, Set
from dataclasses import dataclass
import heapq

@dataclass
class RootCauseCandidate:
    """Candidate root cause with scoring"""
    device_id: str
    alarm_type: str
    score: float
    evidence: List[str]

class RCAGraph:
    """
    Graph-based root cause analysis.
    Walk topology backward from symptoms to find probable root causes.
    """
    
    def __init__(self, topology):
        """
        Args:
            topology: NetworkTopology object
        """
        self.topology = topology
    
    def analyze_incident(self, incident) -> List[RootCauseCandidate]:
        """
        Analyze incident to find root causes.
        
        Args:
            incident: CorrelatedIncident object
        
        Returns:
            List of RootCauseCandidate objects sorted by score
        """
        candidates = {}
        
        for alarm in incident.alarms:
            # Backward walk from this symptom
            upstream_causes = self._walk_upstream(
                alarm.device_id,
                alarm.alarm_type,
                alarm.timestamp,
                incident.alarms
            )
            
            for cause in upstream_causes:
                key = (cause['device_id'], cause['alarm_type'])
                if key not in candidates:
                    candidates[key] = {
                        'device_id': cause['device_id'],
                        'alarm_type': cause['alarm_type'],
                        'score': 0.0,
                        'evidence': []
                    }
                
                candidates[key]['score'] += cause['score']
                candidates[key]['evidence'].extend(cause['evidence'])
        
        # Convert to sorted list
        result = [
            RootCauseCandidate(
                device_id=c['device_id'],
                alarm_type=c['alarm_type'],
                score=min(c['score'], 1.0),  # Normalize to [0, 1]
                evidence=c['evidence']
            )
            for c in candidates.values()
        ]
        
        result.sort(key=lambda x: x.score, reverse=True)
        return result
    
    def _walk_upstream(self, device_id: str, alarm_type: str,
                       alarm_time, all_alarms: List,
                       visited: Optional[Set] = None,
                       depth: int = 0) -> List[Dict]:
        """
        Walk upstream in topology to find root causes.
        Uses backward BFS from symptom location.
        """
        if visited is None:
            visited = set()
        
        if depth > 3:  # Limit depth to avoid infinite loops
            return []
        
        results = []
        visited.add(device_id)
        
        # Look for upstream alerts
        neighbors = self.topology.get_neighbors(device_id)
        for neighbor in neighbors:
            if neighbor in visited:
                continue
            
            # Find if neighbor has prior alarms that could be root cause
            neighbor_alarms = [a for a in all_alarms
                              if a.device_id == neighbor
                              and a.timestamp < alarm_time]
            
            for neighbor_alarm in neighbor_alarms:
                # Score based on temporal proximity and alarm severity
                time_diff = (alarm_time - neighbor_alarm.timestamp).total_seconds()
                if time_diff < 60:  # Within 1 minute = strong signal
                    temporal_score = 1.0 - (time_diff / 60.0)
                else:
                    temporal_score = max(0.1, 1.0 - (time_diff / 300.0))
                
                severity_score = self._severity_to_score(neighbor_alarm.severity)
                
                # Causal likelihood
                causal_score = self._causal_likelihood(
                    neighbor_alarm.alarm_type,
                    alarm_type
                )
                
                score = (temporal_score * 0.3 +
                        severity_score * 0.4 +
                        causal_score * 0.3)
                
                results.append({
                    'device_id': neighbor,
                    'alarm_type': neighbor_alarm.alarm_type,
                    'score': score,
                    'evidence': [
                        f"Upstream device {neighbor} had {neighbor_alarm.alarm_type}",
                        f"Time offset: {time_diff}s before current alarm",
                        f"Topologically adjacent to {device_id}"
                    ]
                })
            
            # Recursive search
            if neighbor_alarms:  # Only recurse if neighbor has alarms
                upstream = self._walk_upstream(
                    neighbor, alarm_type, alarm_time, all_alarms,
                    visited, depth + 1
                )
                results.extend(upstream)
        
        return results
    
    @staticmethod
    def _severity_to_score(severity: str) -> float:
        """Convert severity to probability score"""
        scores = {
            'CRITICAL': 1.0,
            'ERROR': 0.8,
            'WARNING': 0.5,
            'NOTICE': 0.3,
            'INFO': 0.1,
        }
        return scores.get(severity, 0.3)
    
    @staticmethod
    def _causal_likelihood(root_cause_type: str, symptom_type: str) -> float:
        """Score likelihood that root_cause_type causes symptom_type"""
        causal_relationships = {
            ('POWER_SUPPLY_FAILURE', 'TEMPERATURE_CRITICAL'): 1.0,
            ('POWER_SUPPLY_FAILURE', 'MODULE_FAILURE'): 0.95,
            ('POWER_SUPPLY_FAILURE', 'INTERFACE_ERROR'): 0.8,
            ('POWER_SUPPLY_FAILURE', 'BGP_SESSION_DOWN'): 0.6,
            ('POWER_SUPPLY_FAILURE', 'ROUTE_WITHDRAW'): 0.5,
            ('MODULE_FAILURE', 'INTERFACE_ERROR'): 0.95,
            ('MODULE_FAILURE', 'BGP_SESSION_DOWN'): 0.8,
            ('TEMPERATURE_CRITICAL', 'MODULE_FAILURE'): 0.9,
            ('INTERFACE_ERROR', 'LINK_FLAP'): 0.85,
            ('LINK_FLAP', 'STP_TOPOLOGY_CHANGE'): 0.9,
            ('LINK_FLAP', 'TRAFFIC_LOSS'): 0.8,
            ('STP_TOPOLOGY_CHANGE', 'TRAFFIC_LOSS'): 0.85,
            ('BGP_SESSION_DOWN', 'ROUTE_WITHDRAW'): 0.95,
        }
        
        return causal_relationships.get(
            (root_cause_type, symptom_type),
            0.2
        )
