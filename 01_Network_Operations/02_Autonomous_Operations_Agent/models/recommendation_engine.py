"""
Recommendation Engine - ML-powered remediation recommendations
Rule-based with ML confidence scoring
"""

import numpy as np
from typing import List, Dict, Any, Tuple


class RecommendationEngine:
    """Generate remediation recommendations for detected anomalies"""

    # Rule-based knowledge base
    RULES = {
        'cpu_spike': {
            'description': 'CPU utilization exceeds safe threshold',
            'recommendations': [
                {
                    'action': 'Check top processes by CPU usage',
                    'command': 'show processes cpu sorted',
                    'priority': 'HIGH',
                    'severity': 'cpu_spike'
                },
                {
                    'action': 'Reduce BGP prefix load if BGP process consuming CPU',
                    'command': 'router bgp <AS> | maximum-paths 4',
                    'priority': 'HIGH',
                    'severity': 'cpu_spike'
                },
                {
                    'action': 'Enable CPU monitoring and alerting',
                    'command': 'snmp-server enable traps cpu',
                    'priority': 'MEDIUM',
                    'severity': 'cpu_spike'
                }
            ]
        },
        'memory_leak': {
            'description': 'Memory utilization continuously increasing',
            'recommendations': [
                {
                    'action': 'Identify memory-consuming processes',
                    'command': 'show memory',
                    'priority': 'HIGH',
                    'severity': 'memory_leak'
                },
                {
                    'action': 'Check for memory leaks in BGP/OSPF processes',
                    'command': 'debug ip bgp keepalives',
                    'priority': 'MEDIUM',
                    'severity': 'memory_leak'
                },
                {
                    'action': 'Restart affected service if safe',
                    'command': 'restart bgp',
                    'priority': 'HIGH',
                    'severity': 'memory_leak'
                },
                {
                    'action': 'Plan device reload during maintenance window',
                    'command': 'reload',
                    'priority': 'MEDIUM',
                    'severity': 'memory_leak'
                }
            ]
        },
        'bgp_flap': {
            'description': 'BGP sessions flapping/resetting frequently',
            'recommendations': [
                {
                    'action': 'Check BGP neighbor connectivity',
                    'command': 'show ip bgp neighbors',
                    'priority': 'HIGH',
                    'severity': 'bgp_flap'
                },
                {
                    'action': 'Verify BGP timers are appropriate',
                    'command': 'show ip bgp neighbors | include timers',
                    'priority': 'MEDIUM',
                    'severity': 'bgp_flap'
                },
                {
                    'action': 'Check link quality metrics to BGP peer',
                    'command': 'show interface <intf> | include CRC|error',
                    'priority': 'HIGH',
                    'severity': 'bgp_flap'
                },
                {
                    'action': 'Increase BGP hold timer to stabilize session',
                    'command': 'neighbor <ip> timers 10 60',
                    'priority': 'MEDIUM',
                    'severity': 'bgp_flap'
                }
            ]
        },
        'interface_errors': {
            'description': 'High number of CRC/framing errors on interface',
            'recommendations': [
                {
                    'action': 'Verify physical link stability',
                    'command': 'show interface <intf> | include Last link flapped',
                    'priority': 'HIGH',
                    'severity': 'interface_errors'
                },
                {
                    'action': 'Check optical power levels if fiber link',
                    'command': 'show interface transceiver properties',
                    'priority': 'HIGH',
                    'severity': 'interface_errors'
                },
                {
                    'action': 'Disable and re-enable interface',
                    'command': 'shutdown | no shutdown',
                    'priority': 'MEDIUM',
                    'severity': 'interface_errors'
                },
                {
                    'action': 'Contact ISP/peer if external link',
                    'command': 'escalate_to_isp',
                    'priority': 'HIGH',
                    'severity': 'interface_errors'
                },
                {
                    'action': 'Replace cable or transceiver if internal',
                    'command': 'replace_hardware',
                    'priority': 'HIGH',
                    'severity': 'interface_errors'
                }
            ]
        },
        'latency_spike': {
            'description': 'Increased latency and jitter detected',
            'recommendations': [
                {
                    'action': 'Check for congestion on critical paths',
                    'command': 'show int | include utilization',
                    'priority': 'HIGH',
                    'severity': 'latency_spike'
                },
                {
                    'action': 'Verify QoS policies are correctly applied',
                    'command': 'show qos map | include traffic|class',
                    'priority': 'MEDIUM',
                    'severity': 'latency_spike'
                },
                {
                    'action': 'Redistribute traffic using ECMP',
                    'command': 'ip route <dest> <mask> <nh1> <nh2>',
                    'priority': 'HIGH',
                    'severity': 'latency_spike'
                }
            ]
        },
        'combined_failure': {
            'description': 'Multiple metrics degraded simultaneously - potential system overload',
            'recommendations': [
                {
                    'action': 'URGENT: Assess system health - multiple metrics failing',
                    'command': 'show version | show system resources',
                    'priority': 'CRITICAL',
                    'severity': 'combined_failure'
                },
                {
                    'action': 'Consider graceful shutdown of non-critical services',
                    'command': 'shutdown service <service_name>',
                    'priority': 'HIGH',
                    'severity': 'combined_failure'
                },
                {
                    'action': 'Prepare for device reload if overload continues',
                    'command': 'write memory | reload',
                    'priority': 'CRITICAL',
                    'severity': 'combined_failure'
                },
                {
                    'action': 'Escalate to NOC immediately',
                    'command': 'page_on_call_engineer',
                    'priority': 'CRITICAL',
                    'severity': 'combined_failure'
                }
            ]
        }
    }

    def __init__(self):
        self.confidence_model = self._init_confidence_model()

    def _init_confidence_model(self) -> Dict[str, float]:
        """Simple ML confidence scoring model"""
        return {
            'cpu_spike': 0.92,
            'memory_leak': 0.88,
            'bgp_flap': 0.85,
            'interface_errors': 0.90,
            'latency_spike': 0.82,
            'combined_failure': 0.95
        }

    def get_recommendations(self, anomaly_type: str, severity: float = 1.0) -> List[Dict[str, Any]]:
        """Get recommendations for an anomaly type"""
        if anomaly_type not in self.RULES:
            return [{
                'action': 'Unknown anomaly type - manual investigation required',
                'priority': 'MEDIUM',
                'confidence': 0.5
            }]

        rule = self.RULES[anomaly_type]
        recommendations = []

        for rec in rule['recommendations']:
            rec_copy = rec.copy()
            # Adjust confidence based on severity
            base_confidence = self.confidence_model.get(anomaly_type, 0.7)
            rec_copy['confidence'] = min(1.0, base_confidence * severity)
            recommendations.append(rec_copy)

        return recommendations

    def rank_recommendations(self, recommendations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Rank recommendations by priority and confidence"""
        priority_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}

        def sort_key(rec):
            priority_val = priority_order.get(rec.get('priority', 'MEDIUM'), 99)
            confidence = rec.get('confidence', 0.5)
            return (priority_val, -confidence)

        return sorted(recommendations, key=sort_key)

    def generate_remediation_plan(self, anomalies: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate full remediation plan"""
        all_recommendations = []
        device_actions = {}

        for anomaly in anomalies:
            device_id = anomaly.get('device_id', 'unknown')
            anomaly_type = anomaly.get('anomaly_type', 'unknown')
            severity = anomaly.get('severity', 1.0)

            recommendations = self.get_recommendations(anomaly_type, severity)

            for rec in recommendations:
                rec['device_id'] = device_id
                rec['anomaly_type'] = anomaly_type
                all_recommendations.append(rec)

            if device_id not in device_actions:
                device_actions[device_id] = []
            device_actions[device_id].extend(recommendations)

        # Rank all recommendations
        ranked = self.rank_recommendations(all_recommendations)

        # Group by device
        grouped = {}
        for rec in ranked:
            device = rec['device_id']
            if device not in grouped:
                grouped[device] = []
            grouped[device].append(rec)

        return {
            'all_recommendations': ranked,
            'by_device': grouped,
            'total_recommendations': len(ranked),
            'critical_count': sum(1 for r in ranked if r.get('priority') == 'CRITICAL'),
            'high_count': sum(1 for r in ranked if r.get('priority') == 'HIGH')
        }

    def explain_anomaly(self, anomaly_type: str) -> str:
        """Generate natural language explanation"""
        descriptions = {
            'cpu_spike': 'The device CPU utilization has spiked above normal operating levels, '
                        'indicating high computational load. This may be due to BGP route processing, '
                        'packet forwarding overhead, or malicious traffic.',
            'memory_leak': 'Memory utilization is continuously increasing without decreasing, '
                          'suggesting a memory leak in one or more processes. This could eventually '
                          'lead to device crash or performance degradation.',
            'bgp_flap': 'BGP neighbor sessions are flapping (resetting repeatedly), causing route '
                       'instability and potential traffic loss. This is usually due to link instability, '
                       'configuration issues, or CPU overload.',
            'interface_errors': 'An interface is reporting CRC and framing errors, indicating physical '
                               'or link layer issues. This could be caused by cable problems, transceiver '
                               'failure, or excessive noise.',
            'latency_spike': 'Network latency and jitter have increased significantly, suggesting '
                            'congestion, suboptimal routing, or QoS policy issues.',
            'combined_failure': 'Multiple system metrics have degraded simultaneously, suggesting '
                               'system overload or critical failure condition. Immediate action required.'
        }

        return descriptions.get(anomaly_type, 'Unknown anomaly detected.')
