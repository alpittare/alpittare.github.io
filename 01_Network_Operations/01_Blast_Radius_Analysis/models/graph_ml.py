"""
Graph ML algorithms for network analysis.

Implements PageRank, betweenness centrality, and community detection
using pure NumPy without external graph libraries.
"""

import numpy as np
from typing import Dict, List, Set, Tuple
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class GraphML:
    """
    Graph Machine Learning algorithms.
    
    Implements graph algorithms for network topology analysis.
    """
    
    def __init__(self, adjacency_dict: Dict[str, List[str]],
                 node_ids: List[str]):
        """
        Initialize with adjacency list and node ordering.
        
        Args:
            adjacency_dict: {node_id: [neighbors]}
            node_ids: Ordered list of node IDs (for indexing)
        """
        self.adjacency = adjacency_dict
        self.node_ids = node_ids
        self.node_to_idx = {nid: i for i, nid in enumerate(node_ids)}
        self.n_nodes = len(node_ids)
        
        # Build adjacency matrix
        self.adj_matrix = self._build_adj_matrix()
    
    def _build_adj_matrix(self) -> np.ndarray:
        """Build sparse-like adjacency matrix from adjacency list."""
        adj = np.zeros((self.n_nodes, self.n_nodes))
        
        for node_id, neighbors in self.adjacency.items():
            i = self.node_to_idx[node_id]
            for neighbor in neighbors:
                j = self.node_to_idx[neighbor]
                adj[i, j] = 1.0
        
        return adj
    
    def pagerank(self, damping_factor: float = 0.85, max_iterations: int = 100,
                 tolerance: float = 1e-6) -> Dict[str, float]:
        """
        Calculate PageRank for all nodes.
        
        PageRank formula:
        PR(A) = (1-d)/N + d * Σ(PR(T) / C(T))
        where:
        - d = damping factor (probability of following a link)
        - N = number of nodes
        - T = pages that link to A
        - C(T) = number of outgoing links from T
        
        Args:
            damping_factor: Probability of following a link (0.85)
            max_iterations: Maximum iterations for convergence
            tolerance: Convergence threshold
            
        Returns:
            Dictionary mapping node_id to PageRank score
        """
        # Initialize ranks equally
        ranks = np.ones(self.n_nodes) / self.n_nodes
        
        # Calculate out-degree for each node
        out_degree = np.sum(self.adj_matrix, axis=1)
        # Avoid division by zero - dangling nodes
        out_degree = np.where(out_degree == 0, 1, out_degree)
        
        # Transition matrix: normalize each row by out-degree
        transition = self.adj_matrix / out_degree[:, np.newaxis]
        
        for iteration in range(max_iterations):
            prev_ranks = ranks.copy()
            
            # Apply PageRank formula
            # PR(i) = (1-d)/N + d * Σ(transition[j,i] * PR(j))
            ranks = (1 - damping_factor) / self.n_nodes + damping_factor * (transition.T @ prev_ranks)
            
            # Check convergence
            if np.sum(np.abs(ranks - prev_ranks)) < tolerance:
                logger.info(f"PageRank converged in {iteration + 1} iterations")
                break
        
        # Normalize to sum to 1
        ranks = ranks / np.sum(ranks)
        
        return {
            self.node_ids[i]: float(ranks[i])
            for i in range(self.n_nodes)
        }
    
    def betweenness_centrality(self) -> Dict[str, float]:
        """
        Calculate betweenness centrality for all nodes.
        
        Betweenness centrality of node v:
        BC(v) = Σ(σ(s,t|v) / σ(s,t))
        where σ(s,t) is the number of shortest paths from s to t,
        and σ(s,t|v) is the number passing through v.
        
        Uses BFS to find shortest paths.
        
        Returns:
            Dictionary mapping node_id to betweenness centrality
        """
        centrality = {nid: 0.0 for nid in self.node_ids}
        
        # For each source node
        for source_idx in range(self.n_nodes):
            source = self.node_ids[source_idx]
            
            # BFS to find shortest paths
            distances = [-1] * self.n_nodes
            distances[source_idx] = 0
            queue = [source_idx]
            paths = [0.0] * self.n_nodes
            paths[source_idx] = 1.0
            
            idx = 0
            while idx < len(queue):
                u_idx = queue[idx]
                idx += 1
                
                u = self.node_ids[u_idx]
                for v in self.adjacency.get(u, []):
                    v_idx = self.node_to_idx[v]
                    
                    if distances[v_idx] == -1:
                        distances[v_idx] = distances[u_idx] + 1
                        queue.append(v_idx)
                    
                    if distances[v_idx] == distances[u_idx] + 1:
                        paths[v_idx] += paths[u_idx]
            
            # Back-propagation to accumulate betweenness
            dependencies = [0.0] * self.n_nodes
            
            for t_idx in range(self.n_nodes):
                if t_idx != source_idx and distances[t_idx] > 0:
                    for v in self.adjacency.get(self.node_ids[t_idx], []):
                        v_idx = self.node_to_idx[v]
                        if distances[v_idx] == distances[t_idx] - 1:
                            dependencies[v_idx] += (paths[v_idx] / paths[t_idx]) * (1 + dependencies[t_idx])
            
            for node_idx in range(self.n_nodes):
                if node_idx != source_idx:
                    centrality[self.node_ids[node_idx]] += dependencies[node_idx]
        
        # Normalize
        norm_factor = 2.0 / ((self.n_nodes - 1) * (self.n_nodes - 2))
        centrality = {
            nid: score * norm_factor
            for nid, score in centrality.items()
        }
        
        return centrality
    
    def closeness_centrality(self) -> Dict[str, float]:
        """
        Calculate closeness centrality for all nodes.
        
        Closeness centrality of node v:
        CC(v) = (N-1) / Σ(distance(v, all other nodes))
        
        Returns:
            Dictionary mapping node_id to closeness centrality
        """
        centrality = {}
        
        for source_idx in range(self.n_nodes):
            # BFS to find distances from this node
            distances = [-1] * self.n_nodes
            distances[source_idx] = 0
            queue = [source_idx]
            
            idx = 0
            while idx < len(queue):
                u_idx = queue[idx]
                idx += 1
                
                u = self.node_ids[u_idx]
                for v in self.adjacency.get(u, []):
                    v_idx = self.node_to_idx[v]
                    if distances[v_idx] == -1:
                        distances[v_idx] = distances[u_idx] + 1
                        queue.append(v_idx)
            
            # Calculate closeness
            total_distance = sum(d for d in distances if d > 0)
            if total_distance > 0:
                closeness = (self.n_nodes - 1) / total_distance
            else:
                closeness = 0.0
            
            centrality[self.node_ids[source_idx]] = closeness
        
        return centrality
    
    def degree_centrality(self) -> Dict[str, float]:
        """
        Calculate degree centrality for all nodes.
        
        Degree centrality: DC(v) = degree(v) / (N-1)
        
        Returns:
            Dictionary mapping node_id to degree centrality
        """
        centrality = {}
        norm_factor = 1.0 / (self.n_nodes - 1) if self.n_nodes > 1 else 0.0
        
        for node_id in self.node_ids:
            degree = len(self.adjacency.get(node_id, []))
            centrality[node_id] = degree * norm_factor
        
        return centrality
    
    def label_propagation_communities(self, max_iterations: int = 100) -> Dict[str, int]:
        """
        Detect communities using label propagation algorithm.
        
        Nodes spread their labels to neighbors iteratively.
        Nodes adopt the most frequent label among their neighbors.
        
        Args:
            max_iterations: Maximum iterations for label stabilization
            
        Returns:
            Dictionary mapping node_id to community_id
        """
        # Initialize each node with unique label
        labels = {nid: i for i, nid in enumerate(self.node_ids)}
        
        for iteration in range(max_iterations):
            prev_labels = labels.copy()
            
            # Random order of nodes
            order = np.random.permutation(self.n_nodes)
            
            for idx in order:
                node_id = self.node_ids[idx]
                neighbors = self.adjacency.get(node_id, [])
                
                if neighbors:
                    # Get labels of neighbors
                    neighbor_labels = [labels[n] for n in neighbors]
                    
                    # Find most frequent label
                    from collections import Counter
                    label_counts = Counter(neighbor_labels)
                    most_common_label = label_counts.most_common(1)[0][0]
                    
                    # Update label to most frequent neighbor label
                    labels[node_id] = most_common_label
            
            # Check convergence
            if labels == prev_labels:
                logger.info(f"Label propagation converged in {iteration + 1} iterations")
                break
        
        return labels
    
    def eigenvector_centrality(self, max_iterations: int = 100,
                              tolerance: float = 1e-6) -> Dict[str, float]:
        """
        Calculate eigenvector centrality.
        
        Eigenvector centrality: EC(v) is the v-th component of the
        dominant eigenvector of the adjacency matrix.
        
        Uses power iteration method.
        
        Args:
            max_iterations: Maximum iterations for convergence
            tolerance: Convergence threshold
            
        Returns:
            Dictionary mapping node_id to eigenvector centrality
        """
        # Start with random vector
        x = np.random.randn(self.n_nodes)
        x = x / np.linalg.norm(x)
        
        for iteration in range(max_iterations):
            x_prev = x.copy()
            
            # x_new = A * x / ||A * x||
            x = self.adj_matrix @ x
            x_norm = np.linalg.norm(x)
            
            if x_norm > 0:
                x = x / x_norm
            
            # Check convergence
            if np.linalg.norm(x - x_prev) < tolerance:
                logger.info(f"Eigenvector centrality converged in {iteration + 1} iterations")
                break
        
        # Ensure positive values
        if np.sum(x) < 0:
            x = -x
        
        return {
            self.node_ids[i]: float(np.abs(x[i]))
            for i in range(self.n_nodes)
        }
