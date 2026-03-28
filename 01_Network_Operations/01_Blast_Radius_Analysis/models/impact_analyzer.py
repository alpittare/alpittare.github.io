"""
Blast radius and cascading failure analysis.

Simulates impact propagation through network topology
using BFS/DFS with probability-weighted failure models.
"""

import numpy as np
from typing import Dict, List, Set, Tuple, Optional
from dataclasses import dataclass
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class ImpactResult:
    """Result of blast radius analysis."""
    changed_node: str
    directly_affected: Set[str]
    cascading_affected: Set[str]
    total_affected: Set[str]
    affected_services: List[str]
    blast_radius_distance: Dict[str, int]
    failure_probability: Dict[str, float]
    estimated_downtime_minutes: float
    recovery_time_minutes: float


class ImpactAnalyzer:
    """
    Analyzes blast radius and cascading failures in network topology.
    """
    
    def __init__(self, topology):
        """
        Initialize impact analyzer with topology.
        
        Args:
            topology: NetworkTopology object
        """
        self.topology = topology
        self.nodes = topology.nodes
        self.adjacency = topology.adjacency
    
    def analyze_node_failure(self, node_id: str, max_cascade_depth: int = 5,
                            failure_threshold: float = 0.5) -> ImpactResult:
        """
        Analyze impact of a node failure using cascading failure simulation.
        
        Algorithm:
        1. Mark node as failed
        2. BFS to find directly affected neighbors
        3. Propagate failure probability through network
        4. DFS to identify service dependencies
        5. Calculate blast radius metrics
        
        Args:
            node_id: Node to simulate failure
            max_cascade_depth: Maximum depth for cascade propagation
            failure_threshold: Probability threshold for considering cascade
            
        Returns:
            ImpactResult with blast radius metrics
        """
        if node_id not in self.nodes:
            raise ValueError(f"Node {node_id} not found")
        
        # Step 1: Direct impact
        directly_affected = set(self.adjacency.get(node_id, []))
        
        # Step 2: Cascading failure analysis
        cascading = self._simulate_cascading_failure(
            node_id, directly_affected, max_cascade_depth, failure_threshold
        )
        
        # Step 3: Service impact
        affected_services = self._get_affected_services(
            {node_id} | directly_affected | cascading
        )
        
        # Step 4: Calculate metrics
        blast_distances = self.topology.bfs(node_id, max_cascade_depth)
        failure_probs = self._calculate_failure_probability(
            node_id, directly_affected | cascading
        )
        
        # Step 5: Time estimate
        downtime = self._estimate_downtime(
            node_id, directly_affected | cascading
        )
        recovery_time = self._estimate_recovery_time(
            node_id, affected_services
        )
        
        return ImpactResult(
            changed_node=node_id,
            directly_affected=directly_affected,
            cascading_affected=cascading,
            total_affected={node_id} | directly_affected | cascading,
            affected_services=affected_services,
            blast_radius_distance=blast_distances,
            failure_probability=failure_probs,
            estimated_downtime_minutes=downtime,
            recovery_time_minutes=recovery_time
        )
    
    def _simulate_cascading_failure(self, initial_node: str,
                                   direct_neighbors: Set[str],
                                   max_depth: int,
                                   threshold: float) -> Set[str]:
        """
        Simulate cascading failures using BFS with probability propagation.
        
        Failure propagation model:
        P(node fails | neighbor failed) = base_prob * node_criticality * load_factor
        
        Args:
            initial_node: Node that fails
            direct_neighbors: Directly affected neighbors
            max_depth: Maximum cascade depth
            threshold: Probability threshold to consider node at risk
            
        Returns:
            Set of nodes affected by cascading failures
        """
        cascading = set()
        failure_probs = {initial_node: 1.0}
        
        # Initialize direct neighbors
        for neighbor in direct_neighbors:
            # Base failure probability depends on link characteristics
            edge = self.topology.get_edge(initial_node, neighbor)
            if edge:
                base_prob = (1 - edge.redundancy_level * 0.2) * edge.utilization
            else:
                base_prob = 0.5
            
            failure_probs[neighbor] = base_prob
        
        # BFS propagation
        queue = [(node, 1) for node in direct_neighbors]
        visited = {initial_node} | direct_neighbors
        
        idx = 0
        while idx < len(queue):
            current_node, depth = queue[idx]
            idx += 1
            
            if depth >= max_depth:
                continue
            
            current_prob = failure_probs[current_node]
            neighbors = self.adjacency.get(current_node, [])
            
            for neighbor in neighbors:
                if neighbor not in visited:
                    visited.add(neighbor)
                    
                    # Calculate propagation probability
                    neighbor_obj = self.nodes[neighbor]
                    load_factor = neighbor_obj.current_load / neighbor_obj.capacity
                    criticality_factor = neighbor_obj.criticality
                    
                    # Probability attenuates with distance and redundancy
                    attenuation = 1.0 / (2 ** depth)
                    
                    edge = self.topology.get_edge(current_node, neighbor)
                    redundancy_factor = 1.0 / (edge.redundancy_level + 1) if edge else 0.5
                    
                    prop_prob = (current_prob * attenuation * load_factor * 
                                criticality_factor * redundancy_factor)
                    
                    failure_probs[neighbor] = prop_prob
                    
                    if prop_prob >= threshold:
                        cascading.add(neighbor)
                        queue.append((neighbor, depth + 1))
        
        return cascading
    
    def _get_affected_services(self, affected_nodes: Set[str]) -> List[str]:
        """
        Identify services running on affected nodes.
        
        Args:
            affected_nodes: Set of node IDs
            
        Returns:
            List of affected service names
        """
        services = set()
        
        for node_id in affected_nodes:
            if node_id in self.nodes:
                node = self.nodes[node_id]
                services.update(node.services)
        
        return sorted(list(services))
    
    def _calculate_failure_probability(self, failed_node: str,
                                       at_risk_nodes: Set[str]) -> Dict[str, float]:
        """
        Calculate failure probability for each affected node.
        
        Args:
            failed_node: The initial failed node
            at_risk_nodes: Nodes at risk from cascading failure
            
        Returns:
            Dictionary mapping node_id to failure probability
        """
        probs = {failed_node: 1.0}
        
        for node_id in at_risk_nodes:
            if node_id in self.nodes:
                # Combine multiple factors
                node = self.nodes[node_id]
                
                # Distance-based attenuation
                distances = self.topology.bfs(failed_node)
                distance = distances.get(node_id, 999)
                distance_factor = 1.0 / (1.0 + distance)
                
                # Load-based factor
                load_factor = node.current_load / node.capacity
                
                # Criticality factor
                criticality_factor = node.criticality
                
                prob = min(1.0, distance_factor * load_factor * criticality_factor)
                probs[node_id] = prob
        
        return probs
    
    def _estimate_downtime(self, failed_node: str, affected_nodes: Set[str]) -> float:
        """
        Estimate total downtime in minutes.
        
        Based on number of affected nodes and their criticality.
        
        Args:
            failed_node: Initial failed node
            affected_nodes: All affected nodes
            
        Returns:
            Estimated downtime in minutes
        """
        if failed_node not in self.nodes:
            return 0.0
        
        node = self.nodes[failed_node]
        
        # Base downtime on node criticality
        base_downtime = {
            'router': 30,
            'switch': 20,
            'firewall': 45,
            'server': 10
        }.get(node.device_type, 15)
        
        # Add time for cascading failures
        cascade_penalty = len(affected_nodes) * 5
        
        # Criticality multiplier
        criticality_mult = 1.0 + node.criticality
        
        return base_downtime + cascade_penalty * criticality_mult
    
    def _estimate_recovery_time(self, failed_node: str,
                               affected_services: List[str]) -> float:
        """
        Estimate recovery time based on service complexity.
        
        Args:
            failed_node: Initial failed node
            affected_services: List of affected service names
            
        Returns:
            Estimated recovery time in minutes
        """
        # Service-specific recovery times
        service_recovery_times = {
            'BGP': 15,
            'OSPF': 10,
            'DNS': 5,
            'HTTP': 5,
            'HTTPS': 5,
            'MySQL': 30,
            'Redis': 5,
            'SSH': 2,
            'Replication': 20,
            'VLAN': 5,
            'STP': 10,
            'LLDP': 2,
            'VPN': 15,
            'IDS': 5,
            'Firewall': 10
        }
        
        total_recovery = 0.0
        for service in affected_services:
            total_recovery += service_recovery_times.get(service, 10)
        
        # Add base recovery time
        return max(5.0, total_recovery * 1.5)
    
    def analyze_link_failure(self, source_id: str, target_id: str) -> ImpactResult:
        """
        Analyze impact of a link failure.
        
        Args:
            source_id: Source node of link
            target_id: Target node of link
            
        Returns:
            ImpactResult with link failure impact
        """
        # Simulate link failure by removing edge temporarily
        edge = self.topology.get_edge(source_id, target_id)
        if not edge:
            raise ValueError(f"Link {source_id}-{target_id} not found")
        
        # Impact depends on redundancy
        if edge.redundancy_level > 1:
            # Redundant link - lower impact
            directly_affected = set()
            cascading = set()
        else:
            # Non-redundant link - check if it's critical path
            directly_affected = {target_id, source_id}
            cascading = set()
        
        affected_services = self._get_affected_services(directly_affected | cascading)
        
        return ImpactResult(
            changed_node=f"{source_id}-{target_id}",
            directly_affected=directly_affected,
            cascading_affected=cascading,
            total_affected=directly_affected | cascading,
            affected_services=affected_services,
            blast_radius_distance={source_id: 0, target_id: 1},
            failure_probability={source_id: 0.5, target_id: 0.7},
            estimated_downtime_minutes=float(5 + edge.redundancy_level * 10),
            recovery_time_minutes=float(10 + edge.redundancy_level * 5)
        )
    
    def get_critical_nodes(self, top_n: int = 5) -> List[Tuple[str, float]]:
        """
        Identify most critical nodes using betweenness centrality.
        
        Args:
            top_n: Number of top critical nodes to return
            
        Returns:
            List of (node_id, criticality_score) tuples
        """
        from models.graph_ml import GraphML
        
        ml = GraphML(self.adjacency, list(self.nodes.keys()))
        betweenness = ml.betweenness_centrality()
        
        # Combine with node criticality attribute
        combined_scores = {}
        for node_id, betweenness_score in betweenness.items():
            node = self.nodes[node_id]
            combined_score = 0.6 * betweenness_score + 0.4 * node.criticality
            combined_scores[node_id] = combined_score
        
        # Sort and return top N
        sorted_nodes = sorted(combined_scores.items(), key=lambda x: x[1], reverse=True)
        return sorted_nodes[:top_n]
