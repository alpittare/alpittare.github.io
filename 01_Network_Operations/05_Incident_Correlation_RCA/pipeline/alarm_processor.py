"""
Alarm ingestion and normalization pipeline
"""

from typing import List, Dict
from datetime import datetime
from dataclasses import dataclass

@dataclass
class ProcessedAlarm:
    timestamp: datetime
    device_id: str
    alarm_type: str
    severity: str
    severity_code: int
    message: str
    interface: str
    bgp_neighbor: str
    original_alarm: object

class AlarmProcessor:
    """Process and normalize incoming alarms"""
    
    SEVERITY_CODES = {
        'CRITICAL': 0,
        'ERROR': 1,
        'WARNING': 2,
        'NOTICE': 3,
        'INFO': 4,
        'DEBUG': 5
    }
    
    @staticmethod
    def process(alarm) -> ProcessedAlarm:
        """Process a single alarm"""
        return ProcessedAlarm(
            timestamp=alarm.timestamp,
            device_id=alarm.device_id,
            alarm_type=alarm.alarm_type,
            severity=alarm.severity,
            severity_code=AlarmProcessor.SEVERITY_CODES.get(alarm.severity, 5),
            message=alarm.message,
            interface=alarm.interface,
            bgp_neighbor=alarm.bgp_neighbor,
            original_alarm=alarm
        )
    
    @staticmethod
    def process_batch(alarms: List) -> List[ProcessedAlarm]:
        """Process batch of alarms"""
        return [AlarmProcessor.process(alarm) for alarm in alarms]


class AlarmValidator:
    """Validate alarm data quality"""
    
    REQUIRED_FIELDS = ['timestamp', 'device_id', 'alarm_type', 'severity', 'message']
    VALID_SEVERITIES = {'CRITICAL', 'ERROR', 'WARNING', 'NOTICE', 'INFO', 'DEBUG'}
    
    @staticmethod
    def validate(alarm) -> bool:
        """Check if alarm has required fields"""
        for field in AlarmValidator.REQUIRED_FIELDS:
            if not hasattr(alarm, field) or getattr(alarm, field) is None:
                return False
        
        if alarm.severity not in AlarmValidator.VALID_SEVERITIES:
            return False
        
        return True
    
    @staticmethod
    def validate_batch(alarms: List) -> List:
        """Filter batch to valid alarms"""
        return [a for a in alarms if AlarmValidator.validate(a)]
