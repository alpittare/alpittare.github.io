"""
LLM client for blast radius explanation generation.

Provides interface to LLM with graceful fallback to simulation.
"""

import logging
from typing import Dict, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class LLMClient:
    """
    Client for LLM-based blast radius explanation.
    
    Falls back to simulated responses when API is unavailable.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize LLM client.
        
        Args:
            api_key: OpenAI API key (optional, uses simulation if None)
        """
        self.api_key = api_key
        self.use_simulation = api_key is None
        
        if self.use_simulation:
            logger.info("Using simulated LLM responses (no API key provided)")
        else:
            logger.info("Using real LLM API for explanations")
    
    def explain_blast_radius(self, change_id: str, device_id: str,
                            change_type: str, affected_services: list,
                            blast_radius: int, risk_score: float) -> str:
        """
        Generate explanation for blast radius analysis.
        
        Args:
            change_id: Change request ID
            device_id: Device being changed
            change_type: Type of change
            affected_services: List of affected services
            blast_radius: Number of affected nodes
            risk_score: Risk prediction score (0.0-1.0)
            
        Returns:
            LLM-generated explanation
        """
        if self.use_simulation:
            return self._generate_simulated_explanation(
                change_id, device_id, change_type, affected_services,
                blast_radius, risk_score
            )
        else:
            return self._call_openai_api(
                change_id, device_id, change_type, affected_services,
                blast_radius, risk_score
            )
    
    def _generate_simulated_explanation(self, change_id: str, device_id: str,
                                       change_type: str, affected_services: list,
                                       blast_radius: int, risk_score: float) -> str:
        """Generate realistic simulated LLM response."""
        
        # Risk level interpretation
        if risk_score < 0.25:
            risk_level = "Low"
            confidence = "High"
        elif risk_score < 0.50:
            risk_level = "Medium"
            confidence = "Medium"
        elif risk_score < 0.75:
            risk_level = "High"
            confidence = "Medium-High"
        else:
            risk_level = "Critical"
            confidence = "High"
        
        # Service-specific impact assessment
        service_impacts = []
        for service in affected_services[:3]:  # Top 3 services
            if service in ['MySQL', 'Database', 'Replication']:
                impact = f"{service} operations could experience brief interruption"
            elif service in ['BGP', 'OSPF']:
                impact = f"{service} routing may converge during failover"
            elif service in ['HTTP', 'HTTPS']:
                impact = f"{service} traffic could be briefly unavailable"
            else:
                impact = f"{service} may be affected by cascading failures"
            service_impacts.append(impact)
        
        explanation = f"""
BLAST RADIUS ANALYSIS: {change_id}
{'='*60}

CHANGE OVERVIEW:
This {change_type} on {device_id} affects {blast_radius} nodes in the network topology.
Risk Assessment: {risk_level} (Score: {risk_score:.2f}, Confidence: {confidence})

AFFECTED SERVICES:
{chr(10).join(f'  • {service}' for service in affected_services[:5])}

SERVICE IMPACT ASSESSMENT:
{chr(10).join(f'  • {impact}' for impact in service_impacts)}

BLAST RADIUS EXPLANATION:
The {blast_radius}-node blast radius reflects the direct impact zone and potential
cascading failures through service dependencies. Key factors:

1. TOPOLOGY PROXIMITY: The change on {device_id} directly impacts {min(blast_radius, 3)}
   adjacent nodes in the network tier structure, with secondary effects through
   dependent services.

2. SERVICE DEPENDENCIES: {len(affected_services)} services are identified as
   dependent on the changed infrastructure, creating risk of downstream impacts.

3. REDUNDANCY ASSESSMENT: Current network redundancy level provides some mitigation,
   but single points of failure are present in the {change_type.upper()} path.

MITIGATION RECOMMENDATIONS:
  • Execute change during {('maintenance window' if risk_level != 'Critical' else 'scheduled maintenance window with extended notification')}
  • Verify rollback procedure covers all {blast_radius} affected nodes
  • Monitor the affected services closely for {(30 if risk_score < 0.5 else 60)} minutes post-change
  • Have a communication plan ready for {"potentially affected" if risk_score > 0.5 else "minimally affected"} customers

RECOVERY STRATEGY:
Expected recovery time: {(5 + int(risk_score * 60))} minutes if rollback required.
Service restoration will proceed tier-by-tier starting with critical dependencies.
"""
        return explanation
    
    def _call_openai_api(self, change_id: str, device_id: str, change_type: str,
                        affected_services: list, blast_radius: int,
                        risk_score: float) -> str:
        """Call OpenAI API for real LLM response."""
        try:
            import openai
            openai.api_key = self.api_key
            
            prompt = f"""Analyze this network change impact:
            
Change ID: {change_id}
Device: {device_id}
Change Type: {change_type}
Blast Radius (affected nodes): {blast_radius}
Risk Score: {risk_score:.2f}
Affected Services: {', '.join(affected_services)}

Provide a technical but concise blast radius analysis explanation (3-4 paragraphs).
Focus on: why this radius exists, service impact, and mitigation recommendations."""
            
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a network engineer expert."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=500
            )
            
            return response.choices[0].message.content
        
        except Exception as e:
            logger.warning(f"OpenAI API call failed: {e}, falling back to simulation")
            return self._generate_simulated_explanation(
                change_id, device_id, change_type, affected_services,
                blast_radius, risk_score
            )
    
    def generate_change_summary(self, change_request: Dict) -> str:
        """Generate executive summary of change impact."""
        change_id = change_request.get('change_id', 'Unknown')
        severity = change_request.get('severity', 'Unknown').upper()
        device = change_request.get('device_id', 'Unknown')
        services = change_request.get('affected_services', [])
        
        summary = f"""
CHANGE REQUEST SUMMARY
{'='*50}
Change ID: {change_id}
Severity Level: {severity}
Target Device: {device}
Affected Services: {', '.join(services) if services else 'None'}
Complexity: {change_request.get('change_complexity', 0):.1%}

REQUIRED APPROVALS: {'Executive' if severity == 'CRITICAL' else 'Manager'}
CHANGE WINDOW: {'Immediate' if severity == 'CRITICAL' else 'Scheduled'}
ROLLBACK TIME: {'< 5 min' if not services else '5-15 min'}
"""
        return summary
