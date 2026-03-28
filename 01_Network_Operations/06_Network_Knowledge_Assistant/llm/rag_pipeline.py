"""Complete RAG (Retrieval-Augmented Generation) pipeline."""
import numpy as np
from typing import Dict, List, Tuple, Any
from models.tfidf_vectorizer import TFIDFVectorizer
from models.cosine_similarity import CosineSimilaritySearch
from models.intent_classifier import IntentClassifier
from llm.prompt_templates import PromptTemplates, ResponseFormatter


class ReRanker:
    """Re-rank retrieved documents by multiple criteria."""

    @staticmethod
    def score_documents(
        retrieved_docs: List[Dict],
        query: str,
        relevance_scores: List[float]
    ) -> List[Tuple[Dict, float]]:
        """
        Re-rank documents using multiple signals.

        Args:
            retrieved_docs: Retrieved documents with metadata
            query: Original query
            relevance_scores: TF-IDF similarity scores

        Returns:
            List of (doc, final_score) tuples sorted by score
        """
        reranked = []

        for i, doc in enumerate(retrieved_docs):
            score = relevance_scores[i]  # Base TF-IDF score

            # Boost by document category
            category_boost = {
                'troubleshooting': 1.3,
                'operations': 1.1,
                'configuration': 1.2,
                'architecture': 1.0,
                'capacity': 0.9
            }.get(doc.get('category', 'general'), 1.0)

            # Check for query keyword in title
            title_boost = 1.2 if any(
                word in doc.get('title', '').lower()
                for word in query.lower().split()
                if len(word) > 3
            ) else 1.0

            # Recency boost (if available)
            freshness_boost = 1.0  # Can be enhanced with dates

            # Combine signals with weights
            final_score = (
                score * 0.6 +  # Base relevance
                (category_boost / 2.0) * 0.2 +  # Category match
                (title_boost / 2.0) * 0.2  # Title match
            )

            reranked.append((doc, final_score))

        # Sort by score descending
        reranked.sort(key=lambda x: x[1], reverse=True)
        return reranked


class ContextBuilder:
    """Build context from retrieved documents."""

    @staticmethod
    def build_context(
        documents: List[Dict],
        max_tokens: int = 2000
    ) -> str:
        """
        Build context string from documents.

        Args:
            documents: Retrieved documents
            max_tokens: Maximum context token budget

        Returns:
            Formatted context string
        """
        context_parts = []
        token_count = 0

        for doc in documents:
            # Estimate tokens
            doc_tokens = len(doc.get('content', '').split()) * 1.3

            if token_count + doc_tokens > max_tokens:
                break

            # Format document for context
            title = doc.get('title', 'Document')
            content = doc.get('content', '')
            category = doc.get('category', '')

            formatted = f"""
## {title}
[Category: {category}]

{content[:1000]}  {"..." if len(content) > 1000 else ""}
"""
            context_parts.append(formatted)
            token_count += int(doc_tokens)

        return "\n".join(context_parts)

    @staticmethod
    def build_device_context(
        parsed_configs: Dict[str, Dict],
        device_names: List[str]
    ) -> str:
        """Build context from parsed device configurations."""
        context_parts = []

        for device_name in device_names:
            if device_name not in parsed_configs:
                continue

            config = parsed_configs[device_name]

            # Format device info
            info = f"## Device: {device_name}\n\n"

            # Add device info
            if config.get('device_info'):
                info += "**Device Info:**\n"
                for k, v in config['device_info'].items():
                    info += f"- {k}: {v}\n"

            # Add interfaces
            if config.get('interfaces'):
                info += "\n**Key Interfaces:**\n"
                for name, iface in list(config['interfaces'].items())[:5]:
                    info += f"- {name}: {iface.get('description', 'No description')}\n"
                    if iface.get('ip_address'):
                        info += f"  IP: {iface['ip_address']}/{iface['subnet_mask']}\n"

            # Add BGP info
            if config.get('bgp_neighbors'):
                info += "\n**BGP Neighbors:**\n"
                for ip, neighbor in list(config['bgp_neighbors'].items())[:3]:
                    info += f"- {ip}: AS {neighbor.get('remote_as')} - {neighbor.get('description', '')}\n"

            # Add VLANs
            if config.get('vlans'):
                info += "\n**VLANs:**\n"
                for vlan_id, vlan in list(config['vlans'].items())[:5]:
                    info += f"- VLAN {vlan_id}: {vlan.get('name', 'Unnamed')}\n"

            context_parts.append(info)

        return "\n".join(context_parts)


class RAGPipeline:
    """Complete Retrieval-Augmented Generation pipeline."""

    def __init__(
        self,
        vectorizer: TFIDFVectorizer,
        intent_classifier: IntentClassifier,
        documents: List[Dict],
        parsed_configs: Dict = None
    ):
        """
        Initialize RAG pipeline.

        Args:
            vectorizer: TF-IDF vectorizer (fitted)
            intent_classifier: Intent classifier (trained)
            documents: All knowledge base documents
            parsed_configs: Parsed device configurations
        """
        self.vectorizer = vectorizer
        self.intent_classifier = intent_classifier
        self.documents = documents
        self.parsed_configs = parsed_configs or {}

        # Create document vectors
        doc_texts = [doc.get('content', '') for doc in documents]
        self.doc_vectors = vectorizer.transform(doc_texts)

        # Create doc IDs for search
        self.doc_ids = [doc.get('doc_id', f'doc_{i}') for i, doc in enumerate(documents)]

    def retrieve(
        self,
        query: str,
        k: int = 5,
        threshold: float = 0.2
    ) -> List[Tuple[Dict, float]]:
        """
        Retrieve relevant documents for query.

        Args:
            query: User query
            k: Number of results
            threshold: Minimum relevance threshold

        Returns:
            List of (document, relevance_score) tuples
        """
        # Vectorize query
        query_vector = self.vectorizer.transform([query])[0]

        # Search for similar documents
        results = CosineSimilaritySearch.top_k_search(
            query_vector,
            self.doc_vectors,
            self.doc_ids,
            k=k
        )

        # Filter by threshold and map to documents
        retrieved = []
        for doc_id, score, doc_idx in results:
            if score >= threshold:
                doc = self.documents[doc_idx]
                retrieved.append((doc, score))

        return retrieved

    def rerank(
        self,
        retrieved: List[Tuple[Dict, float]],
        query: str,
        top_k: int = 3
    ) -> List[Tuple[Dict, float]]:
        """
        Re-rank retrieved documents.

        Args:
            retrieved: Retrieved documents with scores
            query: Original query
            top_k: Return top K documents

        Returns:
            Re-ranked documents
        """
        if not retrieved:
            return []

        docs = [doc for doc, _ in retrieved]
        scores = [score for _, score in retrieved]

        # Re-rank
        reranked = ReRanker.score_documents(docs, query, scores)

        return reranked[:top_k]

    def process_query(
        self,
        query: str,
        retrieve_k: int = 5,
        rerank_k: int = 3,
        return_context: bool = True
    ) -> Dict[str, Any]:
        """
        Process a complete query through RAG pipeline.

        Args:
            query: User query
            retrieve_k: Documents to retrieve
            rerank_k: Documents to rerank to
            return_context: Include built context in result

        Returns:
            {
                'query': original query,
                'intent': detected intent,
                'intent_confidence': confidence,
                'retrieved_docs': retrieved documents,
                'reranked_docs': reranked documents,
                'context': built context string,
                'template_func': template function to use,
                'device_mentions': mentioned devices
            }
        """
        # Classify intent
        intent, intent_confidence = self.intent_classifier.predict(query)

        # Retrieve documents
        retrieved = self.retrieve(query, k=retrieve_k)

        # Re-rank
        reranked = self.rerank(retrieved, query, top_k=rerank_k)

        # Extract device mentions
        device_mentions = self._extract_device_mentions(query)

        # Build context
        context_docs = [doc for doc, _ in reranked]
        context = ContextBuilder.build_context(context_docs) if return_context else ""

        # Add device context if devices mentioned
        if device_mentions and self.parsed_configs:
            device_context = ContextBuilder.build_device_context(
                self.parsed_configs,
                device_mentions
            )
            context += "\n" + device_context

        # Get template function
        template_func = PromptTemplates.get_template(intent)

        return {
            'query': query,
            'intent': intent,
            'intent_confidence': float(intent_confidence),
            'retrieved_docs': retrieved,
            'reranked_docs': reranked,
            'context': context,
            'template_func': template_func,
            'device_mentions': device_mentions,
            'num_sources': len(reranked)
        }

    @staticmethod
    def _extract_device_mentions(query: str) -> List[str]:
        """Extract device names from query."""
        import re

        # Common device patterns
        patterns = [
            r'NEXUS-\w+-\d+',
            r'CAT6509-\w+-\d+',
            r'SPINE-\d+',
            r'LEAF-\d+',
            r'ACCESS-\w+-\d+',
        ]

        devices = []
        for pattern in patterns:
            matches = re.findall(pattern, query, re.IGNORECASE)
            devices.extend(matches)

        return list(set(devices))  # Remove duplicates
