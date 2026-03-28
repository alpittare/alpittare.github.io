"""Prompt templates for different query types."""
from typing import Dict, List


class PromptTemplates:
    """Collection of prompt templates for different query types."""

    @staticmethod
    def topology_query(query: str, context: str) -> str:
        """Template for topology/connectivity questions."""
        return f"""You are a network topology expert. Answer the following question about network connectivity and topology using the provided context.

Question: {query}

Context:
{context}

Please provide a clear answer about the network topology. Include:
1. Direct answer to the question
2. Affected devices or paths
3. Any dependencies or related components
4. Relevant configuration details if applicable

Answer:"""

    @staticmethod
    def config_query(query: str, context: str) -> str:
        """Template for configuration questions."""
        return f"""You are a network configuration specialist. Answer the following question about network configuration using the provided context.

Question: {query}

Context:
{context}

Please provide:
1. The specific configuration details requested
2. Device names and interfaces involved
3. Configuration syntax or commands if relevant
4. Explanation of what each component does

Answer:"""

    @staticmethod
    def troubleshooting(query: str, context: str) -> str:
        """Template for troubleshooting questions."""
        return f"""You are a network troubleshooting expert. Answer the following troubleshooting question using the provided documentation and context.

Problem: {query}

Documentation:
{context}

Provide:
1. Root cause analysis of the issue
2. Diagnostic steps to confirm
3. Resolution steps in order
4. Prevention measures
5. Expected recovery time

Answer:"""

    @staticmethod
    def capacity_planning(query: str, context: str) -> str:
        """Template for capacity and performance questions."""
        return f"""You are a network capacity planning expert. Answer the following question about network capacity, performance, and scaling.

Question: {query}

Reference Data:
{context}

Include in your answer:
1. Current capacity status
2. Utilization metrics
3. Growth projections
4. Scaling recommendations
5. Timeline for action items

Answer:"""

    @staticmethod
    def general_knowledge(query: str, context: str) -> str:
        """Template for general network knowledge questions."""
        return f"""You are a network engineer providing knowledge about network concepts and best practices. Answer the following question using the provided reference material.

Question: {query}

Reference Material:
{context}

Please provide:
1. Definition or explanation of the concept
2. Relevance to our network
3. Best practices and recommendations
4. Example configurations or scenarios if applicable

Answer:"""

    @staticmethod
    def device_query(query: str, context: str, device_name: str = "") -> str:
        """Template for device-specific questions."""
        device_str = f" for device {device_name}" if device_name else ""
        return f"""You are a network device expert. Answer the following question about Cisco network devices{device_str}.

Question: {query}

Device Information:
{context}

Provide:
1. Direct answer to the question
2. Configuration details from the running config
3. Related interfaces or components
4. Current status of relevant components

Answer:"""

    @staticmethod
    def vlan_impact(query: str, context: str) -> str:
        """Template for VLAN impact analysis questions."""
        return f"""You are a network services expert specializing in VLAN design and service dependencies.

Question: {query}

VLAN and Service Documentation:
{context}

In your answer, include:
1. Direct answer about VLAN dependencies
2. Services and systems affected
3. Impact duration and severity
4. Recovery procedures
5. Notification and escalation requirements

Answer:"""

    @staticmethod
    def bgp_analysis(query: str, context: str) -> str:
        """Template for BGP and routing questions."""
        return f"""You are a BGP and routing configuration expert. Answer the following BGP/routing question.

Question: {query}

BGP Configuration and Documentation:
{context}

Include in your answer:
1. BGP configuration details
2. Neighbor relationships affected
3. Route impact and filtering
4. Convergence implications
5. Monitoring and verification steps

Answer:"""

    @staticmethod
    def get_template(intent: str) -> callable:
        """Get the appropriate template function for an intent."""
        templates = {
            'topology_query': PromptTemplates.topology_query,
            'config_query': PromptTemplates.config_query,
            'troubleshoot': PromptTemplates.troubleshooting,
            'capacity_planning': PromptTemplates.capacity_planning,
            'general': PromptTemplates.general_knowledge,
        }
        return templates.get(intent, PromptTemplates.general_knowledge)


class ResponseFormatter:
    """Format LLM responses with metadata."""

    @staticmethod
    def format_answer(
        answer: str,
        sources: List[str],
        relevance_scores: List[float],
        intent: str,
        query: str
    ) -> Dict:
        """
        Format final answer with sources and metadata.

        Returns:
            {
                'answer': formatted answer,
                'sources': [{'doc_id': str, 'relevance': float}],
                'intent': detected intent,
                'query': original query,
                'confidence': confidence score
            }
        """
        # Calculate average relevance
        avg_relevance = sum(relevance_scores) / len(relevance_scores) if relevance_scores else 0

        return {
            'answer': answer,
            'sources': [
                {'doc_id': src, 'relevance': float(score)}
                for src, score in zip(sources, relevance_scores)
            ],
            'intent': intent,
            'query': query,
            'confidence': float(avg_relevance),
            'has_sources': len(sources) > 0
        }

    @staticmethod
    def format_sources(sources: List[Dict], relevance_scores: List[float]) -> str:
        """Format sources as citations."""
        if not sources:
            return "No sources found."

        citations = "Sources:\n"
        for src, score in zip(sources, relevance_scores):
            title = src.get('title', 'Unknown')
            doc_id = src.get('doc_id', 'unknown')
            category = src.get('category', 'general')
            citations += f"- {title} (relevance: {score:.1%}) - {doc_id}\n"

        return citations

    @staticmethod
    def format_error_response(error_msg: str) -> Dict:
        """Format error response."""
        return {
            'answer': f'I encountered an error processing your query: {error_msg}',
            'error': error_msg,
            'sources': [],
            'confidence': 0.0
        }
