"""
LLM prompt templates for RCA explanation generation
"""

class PromptTemplates:
    """Collection of prompt templates for RCA explanations"""
    
    @staticmethod
    def incident_summary_prompt(incident) -> str:
        """Generate prompt for incident summary"""
        device_count = len(incident.affected_devices)
        alarm_count = len(incident.alarms)
        severity_list = [a.severity for a in incident.alarms]
        
        return f"""Summarize this network incident:
- Duration: {incident.start_time.isoformat()} to {incident.end_time.isoformat()}
- Affected devices: {', '.join(sorted(incident.affected_devices))}
- Total alarms: {alarm_count}
- Severity distribution: {', '.join(set(severity_list))}
- First alarm: {incident.alarms[0].alarm_type if incident.alarms else 'N/A'}

Provide a 2-3 sentence summary describing what happened during this incident."""
    
    @staticmethod
    def root_cause_prompt(incident, root_causes) -> str:
        """Generate prompt for root cause explanation"""
        rc_text = "\n".join([
            f"- {rc.alarm_type} on {rc.device_id} (confidence: {rc.score:.1%})"
            for rc in root_causes[:3]
        ])
        
        return f"""Based on the following root cause analysis:
{rc_text}

Explain in 2-3 sentences why you believe this is the root cause and what system component failed."""
    
    @staticmethod
    def blast_radius_prompt(incident) -> str:
        """Generate prompt for blast radius analysis"""
        return f"""This incident affected {len(incident.affected_devices)} devices:
{', '.join(sorted(incident.affected_devices))}

Explain what services and customers might have been impacted based on these device types and locations."""
    
    @staticmethod
    def remediation_prompt(root_causes, incident) -> str:
        """Generate prompt for remediation steps"""
        primary_cause = root_causes[0] if root_causes else None
        
        return f"""The root cause of this incident was identified as: {primary_cause.alarm_type if primary_cause else 'Unknown'}

Based on this, provide 3-4 concrete remediation steps to:
1. Immediately restore service
2. Prevent this incident from recurring
3. Improve monitoring and alerting"""
    
    @staticmethod
    def full_rca_report_prompt(incident, root_causes) -> str:
        """Generate comprehensive RCA report prompt"""
        return f"""Generate a comprehensive root cause analysis report for this network incident:

INCIDENT SUMMARY:
- ID: {incident.incident_id}
- Duration: {incident.start_time.isoformat()} to {incident.end_time.isoformat()}
- Affected devices: {', '.join(sorted(incident.affected_devices))}
- Total alarms: {len(incident.alarms)}
- Confidence: {incident.confidence_score:.1%}

ROOT CAUSE CANDIDATES:
{chr(10).join([f'- {rc.alarm_type} on {rc.device_id} (score: {rc.score:.1%})' for rc in root_causes[:5]])}

Provide a 5-7 sentence RCA report including:
1. What happened (incident timeline)
2. Why it happened (root cause analysis)
3. Impact assessment
4. Remediation steps

Use technical but understandable language."""


class RCAExplainer:
    """Generate natural language RCA explanations"""
    
    @staticmethod
    def explain_incident(incident, root_causes) -> str:
        """Generate complete RCA explanation"""
        sections = {
            'summary': RCAExplainer._generate_summary(incident),
            'root_cause': RCAExplainer._generate_root_cause_explanation(root_causes),
            'impact': RCAExplainer._generate_impact_analysis(incident),
            'remediation': RCAExplainer._generate_remediation(root_causes)
        }
        
        return f"""
INCIDENT ROOT CAUSE ANALYSIS REPORT
===================================

{sections['summary']}

ROOT CAUSE ANALYSIS:
{sections['root_cause']}

IMPACT ASSESSMENT:
{sections['impact']}

REMEDIATION STEPS:
{sections['remediation']}
"""
    
    @staticmethod
    def _generate_summary(incident) -> str:
        """Generate incident summary section"""
        duration_sec = (incident.end_time - incident.start_time).total_seconds()
        
        return f"""Incident ID: {incident.incident_id}
Time: {incident.start_time.isoformat()} to {incident.end_time.isoformat()}
Duration: {int(duration_sec)} seconds
Devices: {len(incident.affected_devices)} affected
Total Events: {len(incident.alarms)} alarms
Confidence: {incident.confidence_score:.1%}

Initial symptoms detected: {incident.alarms[0].alarm_type if incident.alarms else 'Unknown'}"""
    
    @staticmethod
    def _generate_root_cause_explanation(root_causes) -> str:
        """Generate root cause section"""
        if not root_causes:
            return "Unable to determine root cause."
        
        primary = root_causes[0]
        
        explanations = {
            'POWER_SUPPLY_FAILURE': f"Primary cause: Power supply failure on {primary.device_id}. This cascaded to temperature increases, module failures, and ultimately BGP session drops as the device became unstable.",
            'MODULE_FAILURE': f"Primary cause: Hardware module failure on {primary.device_id}. This caused interface errors and BGP session instability.",
            'TEMPERATURE_CRITICAL': f"Primary cause: Critical temperature condition on {primary.device_id}. This indicates potential power or cooling issues leading to device instability.",
            'LINK_FLAP': f"Primary cause: Link flapping on {primary.device_id}. This triggered STP topology changes affecting network convergence.",
            'BGP_SESSION_DOWN': f"Primary cause: BGP session failure on {primary.device_id}. This prevented route propagation affecting network connectivity.",
        }
        
        base_explanation = explanations.get(
            primary.alarm_type,
            f"Primary cause: {primary.alarm_type} on {primary.device_id}"
        )
        
        confidence_text = "High confidence" if primary.score > 0.7 else "Medium confidence" if primary.score > 0.5 else "Low confidence"
        
        return f"{base_explanation}\nConfidence Score: {primary.score:.1%} ({confidence_text})"
    
    @staticmethod
    def _generate_impact_analysis(incident) -> str:
        """Generate impact assessment section"""
        core_devices = [d for d in incident.affected_devices if 'CORE' in d]
        dist_devices = [d for d in incident.affected_devices if 'DIST' in d]
        access_devices = [d for d in incident.affected_devices if 'ACC' in d]
        
        impact_summary = "Impact Level: "
        if core_devices:
            impact_summary += "CRITICAL (Core network affected)"
        elif dist_devices:
            impact_summary += "HIGH (Distribution layer affected)"
        else:
            impact_summary += "MEDIUM (Access layer affected)"
        
        return f"""{impact_summary}

Affected Network Layers:
- Core devices: {', '.join(core_devices) if core_devices else 'None'}
- Distribution: {', '.join(dist_devices) if dist_devices else 'None'}
- Access: {', '.join(access_devices) if access_devices else 'None'}

Customer Impact: Potential service disruption for endpoints connected to affected devices."""
    
    @staticmethod
    def _generate_remediation(root_causes) -> str:
        """Generate remediation steps section"""
        primary = root_causes[0] if root_causes else None
        
        steps = [
            "1. IMMEDIATE (0-5 min):",
            "   - Verify incident is still active via direct device access",
            "   - Check standby/redundant devices are carrying traffic",
            "   - Engage hardware support if PSU/module failure is confirmed",
            "",
            "2. SHORT TERM (5-30 min):",
            "   - Replace failed hardware components or power supplies",
            "   - Verify device comes back online and re-establishes BGP",
            "   - Monitor for stability on affected interfaces for 5 minutes",
            "",
            "3. MEDIUM TERM (30 min - 2 hours):",
            "   - Perform full configuration verification",
            "   - Check for any configuration loss or drift",
            "   - Verify all VLANs and routing are restored",
            "",
            "4. LONG TERM (preventive):",
            "   - Schedule hardware replacement if power supply is aging",
            "   - Increase monitoring sensitivity for temperature thresholds",
            "   - Review link flap detection parameters",
            "   - Consider redundancy improvements for affected network segment",
        ]
        
        return "\n".join(steps)
