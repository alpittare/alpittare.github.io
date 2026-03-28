"""
Network topology graph generation and manipulation.

Implements graph data structures for network representation with
support for weighted edges, node attributes, and adjacency analysis.
"""

import numpy as np
from typing import Dict, List, Set, Tuple, Optional
from dataclasses import dataclass
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class Node:
    """Represents a network node (device)."""
    node_id: str
    name: str
    device_type: str  # router, switch, firewall, server
    location: str
    criticality: float  # 0.0 to 1.0
    capacity: float
    current_load: float
    services: List[str]  # Running services
    
    def __hash__(self):
        return hash(self.node_id)


@dataclass
class Edge:
    """Represents a network link."""
    source: str
    target: str
    bandwidth: float  # Gbps
    latency: float  # ms
    utilization: float  # 0.0 to 1.0
    protocol: str  # BGP, OSPF, IS-IS, etc.
    status: str  # up, down
    redundancy_level: int  # 1=no redundancy, 2+=redundant
    
    def __hash__(self):
        return hash((self.source, self.target))


class NetworkTopology:
    """
    Graph-based network topology representation.
    
    Implements adjacency list representation with weighted edges
    and node attributes for network analysis.
    """
    
    def __init__(self):
        """Initialize empty topology."""
        self.nodes: Dict[str, Node] = {}
        self.edges: List[Edge] = []
        self.adjacency: Dict[str, List[str]] = {}
        self.edge_map: Dict[Tuple[str, str], Edge] = {}
    
    def add_node(self, node: Node) -> None:
        """Add a node to topology."""
        self.nodes[node.node_id] = node
        if node.node_id not in self.adjacency:
            self.adjacency[node.node_id] = []
        logger.info(f"Added node {node.node_id} ({node.name})")
    
    def add_edge(self, edge: Edge) -> None:
        """Add an edge to topology."""
        if edge.source not in self.nodes or edge.target not in self.nodes:
            raise ValueError(f"Cannot add edge: nodes don't exist")
        
        self.edges.append(edge)
        self.edge_map[(edge.source, edge.target)] = edge
        
        # Add to adjacency list (both directions for undirected graph)
        if edge.target not in self.adjacency[edge.source]:
            self.adjacency[edge.source].append(edge.target)
        if edge.source not in self.adjacency[edge.target]:
            self.adjacency[edge.target].append(edge.source)
        
        logger.info(f"Added edge {edge.source} -> {edge.target} ({edge.bandwidth}Gbps)")
    
    def get_neighbors(self, node_id: str) -> List[str]:
        """Get all neighbors of a node."""
        return self.adjacency.get(node_id, [])
    
    def get_edge(self, source: str, target: str) -> Optional[Edge]:
        """Get edge between two nodes."""
        return self.edge_map.get((source, target))
    
    def get_node_degree(self, node_id: str) -> int:
        """Get degree of a node."""
        return len(self.adjacency.get(node_id, []))
    
    def bfs(self, start_node: str, max_depth: int = 5) -> Dict[str, int]:
        """
        Breadth-first search to find distance from start node.
        
        Args:
            start_node: Starting node ID
            max_depth: Maximum search depth
            
        Returns:
            Dictionary mapping node_id to distance
        """
        distances = {start_node: 0}
        queue = [(start_node, 0)]
        idx = 0
        
        while idx < len(queue):
            node, dist = queue[idx]
            idx += 1
            
            if dist >= max_depth:
                continue
            
            for neighbor in self.get_neighbors(node):
                if neighbor not in distances:
                    distances[neighbor] = dist + 1
                    queue.append((neighbor, dist + 1))
        
        return distances
    
    def dfs(self, start_node: str, visited: Optional[Set[str]] = None) -> Set[str]:
        """
        Depth-first search to find all reachable nodes.
        
        Args:
            start_node: Starting node ID
            visited: Set of already visited nodes
            
        Returns:
            Set of all reachable nodes
        """
        if visited is None:
            visited = set()
        
        visited.add(start_node)
        
        for neighbor in self.get_neighbors(start_node):
            if neighbor not in visited:
                self.dfs(neighbor, visited)
        
        return visited
    
    def get_connected_components(self) -> List[Set[str]]:
        """Get all connected components in the graph."""
        visited = set()
        components = []
        
        for node_id in self.nodes:
            if node_id not in visited:
                component = self.dfs(node_id)
                components.append(component)
                visited.update(component)
        
        return components
    
    def to_dict(self) -> Dict:
        """Convert topology to dictionary for serialization."""
        return {
            'nodes': {
                nid: {
                    'name': node.name,
                    'type': node.device_type,
                    'location': node.location,
                    'criticality': node.criticality,
                    'capacity': node.capacity,
                    'load': node.current_load,
                    'services': node.services
                }
                for nid, node in self.nodes.items()
            },
            'edges': [
                {
                    'source': e.source,
                    'target': e.target,
                    'bandwidth': e.bandwidth,
                    'latency': e.latency,
                    'utilization': e.utilization,
                    'protocol': e.protocol,
                    'status': e.status,
                    'redundancy': e.redundancy_level
                }
                for e in self.edges
            ]
        }
    
    def __len__(self) -> int:
        """Return number of nodes."""
        return len(self.nodes)


def create_sample_topology() -> NetworkTopology:
    """
    Create a realistic sample network topology.
    
    Simulates a multi-tier data center network with:
    - Core routers
    - Aggregation switches
    - Access switches
    - Servers
    - Firewalls
    """
    topo = NetworkTopology()
    
    # Core nodes
    core_nodes = [
        Node('CORE-01', 'NEXUS-CORE-01', 'router', 'DC-Primary', 0.95, 100.0, 75.0, 
             ['BGP', 'OSPF', 'DNS']),
        Node('CORE-02', 'NEXUS-CORE-02', 'router', 'DC-Primary', 0.95, 100.0, 72.0,
             ['BGP', 'OSPF', 'DNS']),
    ]
    
    # Aggregation switches
    agg_nodes = [
        Node('AGG-01', 'NX-5K-AGG-01', 'switch', 'DC-Pod-1', 0.85, 80.0, 60.0,
             ['VLAN', 'STP', 'LLDP']),
        Node('AGG-02', 'NX-5K-AGG-02', 'switch', 'DC-Pod-2', 0.85, 80.0, 58.0,
             ['VLAN', 'STP', 'LLDP']),
        Node('AGG-03', 'CAT-6509-AGG-03', 'switch', 'DC-Pod-3', 0.80, 70.0, 55.0,
             ['VLAN', 'STP', 'LLDP']),
    ]
    
    # Access switches
    access_nodes = [
        Node('ACCESS-01', 'NX-3K-ACCESS-01', 'switch', 'Rack-A1', 0.75, 40.0, 32.0,
             ['VLAN', 'STP']),
        Node('ACCESS-02', 'NX-3K-ACCESS-02', 'switch', 'Rack-A2', 0.75, 40.0, 35.0,
             ['VLAN', 'STP']),
        Node('ACCESS-03', 'CAT-2960-ACCESS-03', 'switch', 'Rack-B1', 0.70, 30.0, 28.0,
             ['VLAN', 'STP']),
        Node('ACCESS-04', 'CAT-2960-ACCESS-04', 'switch', 'Rack-B2', 0.70, 30.0, 26.0,
             ['VLAN', 'STP']),
    ]
    
    # Servers
    server_nodes = [
        Node('SRV-01', 'APP-SRV-01', 'server', 'Rack-A1', 0.90, 64.0, 48.0,
             ['HTTP', 'HTTPS', 'SSH', 'MySQL']),
        Node('SRV-02', 'WEB-SRV-02', 'server', 'Rack-A2', 0.88, 64.0, 45.0,
             ['HTTP', 'HTTPS', 'SSH', 'MySQL']),
        Node('SRV-03', 'DB-PRIMARY', 'server', 'Rack-B1', 0.95, 96.0, 85.0,
             ['MySQL', 'Replication', 'SSH']),
        Node('SRV-04', 'DB-SECONDARY', 'server', 'Rack-B2', 0.92, 96.0, 75.0,
             ['MySQL', 'Replication', 'SSH']),
        Node('SRV-05', 'CACHE-01', 'server', 'Rack-A1', 0.85, 32.0, 28.0,
             ['Redis', 'HTTP']),
    ]
    
    # Firewall
    fw_nodes = [
        Node('FW-01', 'ASA-5585-01', 'firewall', 'DMZ', 0.90, 50.0, 40.0,
             ['Firewall', 'IDS', 'VPN']),
    ]
    
    # Add all nodes
    for node in core_nodes + agg_nodes + access_nodes + server_nodes + fw_nodes:
        topo.add_node(node)
    
    # Add edges - core to aggregation (redundant)
    edges = [
        Edge('CORE-01', 'AGG-01', 40.0, 1.5, 0.72, 'BGP', 'up', 2),
        Edge('CORE-01', 'AGG-02', 40.0, 1.5, 0.68, 'BGP', 'up', 2),
        Edge('CORE-02', 'AGG-01', 40.0, 1.5, 0.70, 'BGP', 'up', 2),
        Edge('CORE-02', 'AGG-02', 40.0, 1.5, 0.65, 'BGP', 'up', 2),
        Edge('CORE-01', 'AGG-03', 40.0, 2.0, 0.62, 'BGP', 'up', 1),
        Edge('CORE-02', 'FW-01', 10.0, 0.5, 0.75, 'Static', 'up', 2),
        
        # Aggregation to access (some redundancy)
        Edge('AGG-01', 'ACCESS-01', 10.0, 0.5, 0.80, 'OSPF', 'up', 1),
        Edge('AGG-01', 'ACCESS-02', 10.0, 0.5, 0.85, 'OSPF', 'up', 1),
        Edge('AGG-02', 'ACCESS-02', 10.0, 0.5, 0.70, 'OSPF', 'up', 1),
        Edge('AGG-03', 'ACCESS-03', 10.0, 1.0, 0.78, 'OSPF', 'up', 1),
        Edge('AGG-03', 'ACCESS-04', 10.0, 1.0, 0.75, 'OSPF', 'up', 1),
        
        # Access to servers
        Edge('ACCESS-01', 'SRV-01', 1.0, 0.1, 0.95, 'Direct', 'up', 1),
        Edge('ACCESS-01', 'SRV-05', 1.0, 0.1, 0.85, 'Direct', 'up', 1),
        Edge('ACCESS-02', 'SRV-02', 1.0, 0.1, 0.92, 'Direct', 'up', 1),
        Edge('ACCESS-03', 'SRV-03', 1.0, 0.1, 0.98, 'Direct', 'up', 1),
        Edge('ACCESS-04', 'SRV-04', 1.0, 0.1, 0.95, 'Direct', 'up', 1),
        
        # Firewall connections
        Edge('FW-01', 'SRV-01', 1.0, 0.2, 0.50, 'Static', 'up', 2),
        Edge('FW-01', 'SRV-02', 1.0, 0.2, 0.48, 'Static', 'up', 2),
    ]
    
    for edge in edges:
        topo.add_edge(edge)
    
    return topo
