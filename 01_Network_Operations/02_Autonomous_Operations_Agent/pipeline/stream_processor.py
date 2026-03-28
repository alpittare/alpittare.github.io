"""
Stream Processor - Kafka-like stream processing simulation
"""

import json
from typing import List, Dict, Any, Callable, Optional
from collections import deque


class StreamProcessor:
    """Simple stream processing pipeline"""

    def __init__(self, buffer_size: int = 1000):
        self.buffer_size = buffer_size
        self.buffer = deque(maxlen=buffer_size)
        self.operations = []
        self.results = []

    def add_source(self, data: List[Dict[str, Any]]) -> None:
        """Add data source"""
        for item in data:
            self.buffer.append(item)

    def add_operation(self, operation: Callable) -> None:
        """Add processing operation"""
        self.operations.append(operation)

    def process(self) -> List[Dict[str, Any]]:
        """Execute processing pipeline"""
        self.results = []

        for item in self.buffer:
            result = item.copy()

            # Apply each operation
            for operation in self.operations:
                result = operation(result)

            if result is not None:
                self.results.append(result)

        return self.results

    def get_results(self) -> List[Dict[str, Any]]:
        """Get processing results"""
        return self.results

    def filter(self, predicate: Callable) -> 'StreamProcessor':
        """Filter stream"""
        self.operations.append(lambda x: x if predicate(x) else None)
        return self

    def map(self, mapper: Callable) -> 'StreamProcessor':
        """Map over stream"""
        self.operations.append(mapper)
        return self

    def stateful_aggregate(self, key_fn: Callable, agg_fn: Callable) -> Dict[str, Any]:
        """Aggregate by key"""
        aggregates = {}

        for item in self.buffer:
            key = key_fn(item)
            if key not in aggregates:
                aggregates[key] = []
            aggregates[key].append(item)

        return {k: agg_fn(v) for k, v in aggregates.items()}


class AnomalyStream:
    """Stream specifically for anomaly events"""

    def __init__(self):
        self.events = []
        self.processed = False

    def add_event(self, event: Dict[str, Any]) -> None:
        """Add anomaly event"""
        self.events.append(event)

    def add_events(self, events: List[Dict[str, Any]]) -> None:
        """Add multiple events"""
        self.events.extend(events)

    def filter_by_device(self, device_id: str) -> List[Dict[str, Any]]:
        """Filter events by device"""
        return [e for e in self.events if e.get('device_id') == device_id]

    def filter_by_type(self, anomaly_type: str) -> List[Dict[str, Any]]:
        """Filter events by anomaly type"""
        return [e for e in self.events if e.get('anomaly_type') == anomaly_type]

    def filter_by_severity(self, min_severity: float) -> List[Dict[str, Any]]:
        """Filter by severity threshold"""
        return [e for e in self.events if e.get('severity', 1.0) >= min_severity]

    def get_timeline(self, device_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get chronological timeline"""
        events = self.filter_by_device(device_id) if device_id else self.events
        return sorted(events, key=lambda x: x.get('timestamp', ''))

    def get_stats(self) -> Dict[str, Any]:
        """Get stream statistics"""
        if not self.events:
            return {
                'total_events': 0,
                'by_type': {},
                'by_device': {},
                'avg_severity': 0
            }

        by_type = {}
        by_device = {}
        severities = []

        for event in self.events:
            atype = event.get('anomaly_type', 'unknown')
            by_type[atype] = by_type.get(atype, 0) + 1

            device = event.get('device_id', 'unknown')
            by_device[device] = by_device.get(device, 0) + 1

            severities.append(event.get('severity', 1.0))

        return {
            'total_events': len(self.events),
            'by_type': by_type,
            'by_device': by_device,
            'avg_severity': sum(severities) / len(severities) if severities else 0
        }
