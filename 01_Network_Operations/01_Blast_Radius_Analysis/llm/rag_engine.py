"""
RAG (Retrieval Augmented Generation) engine for network documentation.

Implements TF-IDF based document retrieval and relevance scoring
for network architecture documents.
"""

import numpy as np
from typing import List, Dict, Tuple
import logging
import math

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TFIDFEncoder:
    """
    Simple TF-IDF encoder for document retrieval.
    
    TF = (term frequency) / (total terms in document)
    IDF = log(total documents / documents containing term)
    TF-IDF = TF * IDF
    """
    
    def __init__(self):
        """Initialize TF-IDF encoder."""
        self.vocab = {}
        self.idf = {}
        self.documents = []
        self.doc_vectors = []
    
    def _tokenize(self, text: str) -> List[str]:
        """Simple word tokenization."""
        return text.lower().split()
    
    def fit(self, documents: List[str]) -> None:
        """
        Fit TF-IDF model on documents.
        
        Args:
            documents: List of document texts
        """
        self.documents = documents
        
        # Build vocabulary and document frequency
        doc_freq = {}
        all_tokens = set()
        
        for doc in documents:
            tokens = set(self._tokenize(doc))
            all_tokens.update(tokens)
            
            for token in tokens:
                doc_freq[token] = doc_freq.get(token, 0) + 1
        
        # Create vocabulary
        self.vocab = {token: idx for idx, token in enumerate(sorted(all_tokens))}
        
        # Calculate IDF
        n_docs = len(documents)
        for token, freq in doc_freq.items():
            self.idf[token] = math.log(n_docs / freq)
        
        # Build document vectors
        self.doc_vectors = []
        for doc in documents:
            vector = self._get_vector(doc)
            self.doc_vectors.append(vector)
        
        logger.info(f"TF-IDF fitted on {n_docs} documents, vocabulary size: {len(self.vocab)}")
    
    def _get_vector(self, text: str) -> np.ndarray:
        """Convert text to TF-IDF vector."""
        vector = np.zeros(len(self.vocab))
        tokens = self._tokenize(text)
        token_freq = {}
        
        # Count token frequencies
        for token in tokens:
            token_freq[token] = token_freq.get(token, 0) + 1
        
        # Calculate TF-IDF
        for token, freq in token_freq.items():
            if token in self.vocab:
                idx = self.vocab[token]
                tf = freq / len(tokens)
                idf = self.idf.get(token, 0)
                vector[idx] = tf * idf
        
        # Normalize
        norm = np.linalg.norm(vector)
        if norm > 0:
            vector = vector / norm
        
        return vector
    
    def cosine_similarity(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """Calculate cosine similarity between vectors."""
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return dot_product / (norm1 * norm2)
    
    def retrieve(self, query: str, top_k: int = 3) -> List[Tuple[str, float]]:
        """
        Retrieve most relevant documents for query.
        
        Args:
            query: Query text
            top_k: Number of documents to return
            
        Returns:
            List of (document, relevance_score) tuples
        """
        query_vector = self._get_vector(query)
        
        scores = []
        for i, doc_vector in enumerate(self.doc_vectors):
            similarity = self.cosine_similarity(query_vector, doc_vector)
            scores.append((self.documents[i], similarity))
        
        # Sort by relevance
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]


class RAGEngine:
    """
    RAG engine for retrieving relevant network documentation.
    """
    
    def __init__(self):
        """Initialize RAG engine."""
        self.encoder = TFIDFEncoder()
        self.documents = {}
        self.initialized = False
    
    def add_documents(self, doc_dict: Dict[str, str]) -> None:
        """
        Add documents to the RAG engine.
        
        Args:
            doc_dict: Dictionary mapping doc_id to doc_text
        """
        self.documents = doc_dict
        doc_list = list(doc_dict.values())
        self.encoder.fit(doc_list)
        self.initialized = True
        logger.info(f"Added {len(doc_dict)} documents to RAG engine")
    
    def retrieve_context(self, query: str, top_k: int = 3) -> List[Dict]:
        """
        Retrieve relevant context for a query.
        
        Args:
            query: Query text
            top_k: Number of results to return
            
        Returns:
            List of context dicts with 'text' and 'relevance' keys
        """
        if not self.initialized:
            return []
        
        results = self.encoder.retrieve(query, top_k)
        
        return [
            {
                'text': text,
                'relevance': float(score)
            }
            for text, score in results
        ]


# Sample network documentation
NETWORK_DOCUMENTATION = {
    'bgp_overview': '''BGP (Border Gateway Protocol) is an exterior gateway protocol
    used for routing between autonomous systems. Key concepts:
    - BGP peers exchange reachability information
    - AS numbers identify autonomous systems
    - Route selection based on BGP attributes (AS path, local preference, MED)
    - BGP session requires TCP 179 connectivity
    - Graceful restart allows rapid convergence on failures''',
    
    'ospf_overview': '''OSPF (Open Shortest Path First) is an interior gateway protocol.
    Key features:
    - Link-state routing protocol, uses Dijkstra algorithm
    - Supports hierarchical design with areas
    - Fast convergence compared to RIP
    - Uses multicast (224.0.0.5, 224.0.0.6) for hello/flooding
    - Cost metric based on interface speed
    - OSPF adjacency requires matching network masks, hello intervals''',
    
    'vlan_configuration': '''VLAN (Virtual LAN) segmentation best practices:
    - Assign each business function to separate VLAN
    - Use trunk links (802.1Q) for inter-switch VLAN traffic
    - Implement VLAN access lists (VACL) for security
    - Spanning Tree Protocol prevents loops in VLAN topology
    - Management VLAN should be isolated for security''',
    
    'failure_recovery': '''Network failure recovery procedures:
    - BGP graceful restart preserves routes during convergence
    - Fast failover mechanisms reduce blackhole duration
    - Redundant links eliminate single points of failure
    - Service dependencies must be mapped for impact analysis
    - Recovery time depends on protocol convergence times
    - Automated failover requires careful configuration''',
    
    'device_roles': '''Network device roles and responsibilities:
    - Core routers: Connect multiple aggregation layers, handle BGP
    - Aggregation switches: Connect access layer, provide VLAN services
    - Access switches: Connect end devices, implement VLAN membership
    - Firewalls: Stateful packet filtering, DDoS protection
    - Servers: Application services, database replication''',
    
    'change_management': '''Best practices for network changes:
    - Implement changes during maintenance windows
    - Validate configuration changes in test environment first
    - Have rollback plan prepared before implementation
    - Monitor system behavior during and after changes
    - Communicate changes to dependent teams
    - Document change details for audit trail''',
    
    'monitoring': '''Network monitoring and alerting:
    - Monitor interface utilization, errors, and discards
    - Track BGP session state and route counts
    - Alert on spanning tree topology changes
    - Monitor CPU and memory on network devices
    - Implement syslog collection for centralized logging
    - Use SNMP for performance metric collection''',
    
    'security': '''Network security best practices:
    - Implement access control lists (ACLs) on all interfaces
    - Use VLANs to isolate security zones
    - Implement rate limiting to prevent DDoS
    - Monitor for unauthorized access attempts
    - Encrypt management access (SSH, not Telnet)
    - Regular security audits of configurations'''
}


def create_rag_engine() -> RAGEngine:
    """Create initialized RAG engine with sample documentation."""
    engine = RAGEngine()
    engine.add_documents(NETWORK_DOCUMENTATION)
    return engine
