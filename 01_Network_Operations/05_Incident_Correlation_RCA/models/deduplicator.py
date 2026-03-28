"""
Alarm deduplication using fingerprinting and time windowing
"""

import hashlib
from typing import List, Dict, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass

@dataclass
class DeduplicationStats:
    original_count: int
    unique_count: int
    suppressed_count: int
    reduction_ratio: float
    suppressions_by_alarm_type: Dict[str, int]

class AlarmDeduplicator:
    """
    Deduplicate alarms using fingerprinting and time window suppression.
    Fingerprint: hash(device_id + alarm_type + interface)
    Time window: suppress duplicate within 5 minutes
    """
    
    def __init__(self, time_window_seconds: int = 300):
        """
        Args:
            time_window_seconds: Time window for duplicate suppression (default 5 min)
        """
        self.time_window = timedelta(seconds=time_window_seconds)
        self.fingerprints = {}  # fingerprint -> last seen timestamp
        self.deduped_alarms = []
        self.stats = None
    
    @staticmethod
    def _create_fingerprint(alarm) -> str:
        """Create unique fingerprint for alarm"""
        key = f"{alarm.device_id}#{alarm.alarm_type}#{alarm.interface}"
        return hashlib.md5(key.encode()).hexdigest()
    
    def deduplicate(self, alarms: List) -> Tuple[List, DeduplicationStats]:
        """
        Deduplicate alarms based on fingerprint and time window.
        
        Args:
            alarms: List of alarm objects
        
        Returns:
            Tuple of (deduped_alarms, stats)
        """
        original_count = len(alarms)
        self.deduped_alarms = []
        self.fingerprints = {}
        suppressions_by_type = {}
        
        # Sort by timestamp
        sorted_alarms = sorted(alarms, key=lambda x: x.timestamp)
        
        for alarm in sorted_alarms:
            fingerprint = self._create_fingerprint(alarm)
            
            # Check if we've seen this fingerprint recently
            if fingerprint in self.fingerprints:
                last_seen = self.fingerprints[fingerprint]
                if alarm.timestamp - last_seen < self.time_window:
                    # Suppress this duplicate
                    suppressions_by_type[alarm.alarm_type] = \
                        suppressions_by_type.get(alarm.alarm_type, 0) + 1
                    continue
            
            # Keep this alarm (unique or outside time window)
            self.deduped_alarms.append(alarm)
            self.fingerprints[fingerprint] = alarm.timestamp
        
        unique_count = len(self.deduped_alarms)
        suppressed_count = original_count - unique_count
        reduction_ratio = suppressed_count / original_count if original_count > 0 else 0.0
        
        self.stats = DeduplicationStats(
            original_count=original_count,
            unique_count=unique_count,
            suppressed_count=suppressed_count,
            reduction_ratio=reduction_ratio,
            suppressions_by_alarm_type=suppressions_by_type
        )
        
        return self.deduped_alarms, self.stats


class AlarmNormalizer:
    """
    Normalize alarms to standard format for downstream processing
    """
    
    SEVERITY_ORDER = {
        'CRITICAL': 0,
        'ERROR': 1,
        'WARNING': 2,
        'NOTICE': 3,
        'INFO': 4,
        'DEBUG': 5
    }
    
    @staticmethod
    def normalize_severity(severity: str) -> int:
        """Convert severity string to numeric code"""
        return AlarmNormalizer.SEVERITY_ORDER.get(severity, 5)
    
    @staticmethod
    def normalize(alarm) -> Dict:
        """Convert alarm to normalized dictionary"""
        return {
            'timestamp': alarm.timestamp,
            'device_id': alarm.device_id,
            'alarm_type': alarm.alarm_type,
            'severity': alarm.severity,
            'severity_code': AlarmNormalizer.normalize_severity(alarm.severity),
            'message': alarm.message,
            'interface': alarm.interface,
            'bgp_neighbor': alarm.bgp_neighbor,
        }
