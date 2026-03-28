"""
LLM prompt templates for blast radius explanation.
"""

BLAST_RADIUS_ANALYSIS_PROMPT = """
You are a network engineer analyzing the blast radius of a network change.

**Topology Context:**
{topology_summary}

**Change Request:**
- Device: {device_id}
- Change Type: {change_type}
- Severity: {severity}

**Blast Radius Analysis Results:**
- Directly Affected Nodes: {directly_affected}
- Cascading Failure Risk: {cascading_affected}
- Total Affected Services: {affected_services}
- Estimated Downtime: {estimated_downtime} minutes
- Recovery Time: {recovery_time} minutes

**Relevant Network Documentation:**
{rag_context}

**Your Task:**
Provide a detailed but concise explanation of:
1. Why this change has the calculated blast radius
2. Which critical services could be affected
3. Mitigation strategies to reduce impact
4. Recommended timing and procedures

Keep response to 3-4 paragraphs, technical but accessible.
"""

RISK_ASSESSMENT_PROMPT = """
You are a network change risk assessment expert.

**Change Details:**
- Change ID: {change_id}
- Affected Services: {affected_services}
- Affected Nodes: {affected_nodes}
- Complexity: {complexity}/1.0
- Dependencies: {dependencies_count}

**Risk Prediction Results:**
- Risk Score: {risk_score}/1.0
- Severity Level: {severity}

**Network Context:**
{topology_summary}

Provide:
1. Key risk factors for this change
2. Probability and impact of failure scenarios
3. Specific precautions and testing required
4. Rollback procedure overview
"""

SERVICE_DEPENDENCY_PROMPT = """
You are analyzing service dependencies in a network.

**Services Affected by Change:**
{services_list}

**Network Context:**
{topology_summary}

**Dependencies Found:**
{dependencies_list}

Analyze and explain:
1. Service dependency chains
2. Cascading failure risks
3. Critical service pairs
4. Recommended monitoring during change
"""

MITIGATION_STRATEGY_PROMPT = """
You are a network resilience architect.

**Proposed Change:**
{change_description}

**Current Impact Assessment:**
- Affected Nodes: {affected_count}
- Critical Services at Risk: {critical_services}
- Potential Downtime: {downtime_minutes} minutes

Recommend:
1. Technical mitigations (config changes, redundancy)
2. Procedural mitigations (staging, validation)
3. Communication and notification strategy
4. Monitoring and rollback triggers

Be specific and actionable.
"""


def format_blast_radius_prompt(change_data: dict, impact_result: dict,
                               topology_summary: str, rag_context: str) -> str:
    """
    Format prompt for blast radius analysis.
    
    Args:
        change_data: Change request details
        impact_result: Impact analysis results
        topology_summary: High-level topology description
        rag_context: Retrieved relevant documentation
        
    Returns:
        Formatted prompt string
    """
    return BLAST_RADIUS_ANALYSIS_PROMPT.format(
        topology_summary=topology_summary,
        device_id=change_data.get('device_id', 'Unknown'),
        change_type=change_data.get('change_type', 'Unknown'),
        severity=change_data.get('severity', 'Unknown'),
        directly_affected=', '.join(impact_result.get('directly_affected', [])),
        cascading_affected=', '.join(impact_result.get('cascading_affected', [])),
        affected_services=', '.join(impact_result.get('affected_services', [])),
        estimated_downtime=impact_result.get('estimated_downtime', 0),
        recovery_time=impact_result.get('recovery_time', 0),
        rag_context=rag_context
    )


def format_risk_assessment_prompt(change_data: dict, risk_result: dict,
                                 topology_summary: str) -> str:
    """Format prompt for risk assessment."""
    return RISK_ASSESSMENT_PROMPT.format(
        change_id=change_data.get('change_id', 'Unknown'),
        affected_services=', '.join(change_data.get('affected_services', [])),
        affected_nodes=', '.join(change_data.get('affected_nodes', [])),
        complexity=change_data.get('change_complexity', 0),
        dependencies_count=change_data.get('dependencies_count', 0),
        risk_score=risk_result.get('risk_score', 0),
        severity=risk_result.get('severity_estimate', 'Unknown'),
        topology_summary=topology_summary
    )
