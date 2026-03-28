"""
Alarm enrichment with topology and historical context
"""

from typing import List, Dict, Optional

class AlarmEnricher:
    """Enrich alarms with topology and contextual information"""
    
    def __init__(self, topology=None, device_mapping: Dict = None):
        """
        Args:
            topology: NetworkTopology object
            device_mapping: Dict mapping device_id to device info
        """
        self.topology = topology
        self.device_mapping = device_mapping or {}
    
    def enrich(self, alarm) -> Dict:
        """Enrich single alarm with context"""
        enriched = {
            'original_alarm': alarm,
            'device_type': self._get_device_type(alarm.device_id),
            'device_location': self._get_device_location(alarm.device_id),
            'neighbors': self._get_neighbors(alarm.device_id),
            'criticality': self._assess_criticality(alarm),
        }
        
        return enriched
    
    def enrich_batch(self, alarms: List) -> List[Dict]:
        """Enrich batch of alarms"""
        return [self.enrich(alarm) for alarm in alarms]
    
    def _get_device_type(self, device_id: str) -> str:
        """Get device type from topology"""
        if not self.topology:
            return 'UNKNOWN'
        
        device = self.topology.devices.get(device_id)
        return device.device_type if device else 'UNKNOWN'
    
    def _get_device_location(self, device_id: str) -> str:
        """Get device location from topology"""
        if not self.topology:
            return 'UNKNOWN'
        
        device = self.topology.devices.get(device_id)
        return device.location if device else 'UNKNOWN'
    
    def _get_neighbors(self, device_id: str) -> List[str]:
        """Get topological neighbors"""
        if not self.topology:
            return []
        
        return self.topology.get_neighbors(device_id)
    
    def _assess_criticality(self, alarm) -> str:
        """Assess criticality based on device and alarm type"""
        if 'CORE' in alarm.device_id and alarm.severity == 'CRITICAL':
            return 'CRITICAL'
        elif 'DIST' in alarm.device_id and alarm.severity in ['CRITICAL', 'ERROR']:
            return 'HIGH'
        elif 'ACC' in alarm.device_id and alarm.severity == 'CRITICAL':
            return 'MEDIUM'
        else:
            return 'LOW'
