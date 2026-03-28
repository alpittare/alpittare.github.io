"""Cosine similarity search implementation."""
import numpy as np
from typing import List, Tuple


class CosineSimilaritySearch:
    """Efficient cosine similarity search with top-K retrieval."""

    @staticmethod
    def cosine_similarity(vector1: np.ndarray, vector2: np.ndarray) -> float:
        """
        Calculate cosine similarity between two vectors.

        Formula: sim(A,B) = (A·B) / (||A|| * ||B||)

        Args:
            vector1: First vector
            vector2: Second vector

        Returns:
            Cosine similarity score (0-1)
        """
        # Compute dot product
        dot_product = np.dot(vector1, vector2)

        # Compute norms
        norm1 = np.linalg.norm(vector1)
        norm2 = np.linalg.norm(vector2)

        # Avoid division by zero
        if norm1 == 0 or norm2 == 0:
            return 0.0

        return float(dot_product / (norm1 * norm2))

    @staticmethod
    def cosine_similarity_batch(
        query_vector: np.ndarray,
        document_vectors: np.ndarray
    ) -> np.ndarray:
        """
        Calculate cosine similarity between a query and multiple documents.

        Args:
            query_vector: Query vector of shape (n_features,)
            document_vectors: Document vectors of shape (n_docs, n_features)

        Returns:
            Array of similarities of shape (n_docs,)
        """
        # Normalize query vector
        query_norm = np.linalg.norm(query_vector)
        if query_norm == 0:
            return np.zeros(len(document_vectors))

        query_normalized = query_vector / query_norm

        # Normalize all document vectors
        doc_norms = np.linalg.norm(document_vectors, axis=1, keepdims=True)
        doc_norms[doc_norms == 0] = 1  # Avoid division by zero
        docs_normalized = document_vectors / doc_norms

        # Batch dot product
        similarities = np.dot(docs_normalized, query_normalized)
        return np.clip(similarities, 0, 1)  # Ensure [0, 1] range

    @staticmethod
    def top_k_search(
        query_vector: np.ndarray,
        document_vectors: np.ndarray,
        document_ids: List[str],
        k: int = 5
    ) -> List[Tuple[str, float, int]]:
        """
        Find top-K most similar documents.

        Args:
            query_vector: Query vector
            document_vectors: All document vectors
            document_ids: Identifiers for documents
            k: Number of results to return

        Returns:
            List of (doc_id, similarity_score, doc_index) sorted by similarity DESC
        """
        similarities = CosineSimilaritySearch.cosine_similarity_batch(
            query_vector,
            document_vectors
        )

        # Get top-K indices
        top_k_indices = np.argsort(similarities)[::-1][:k]

        # Return results with doc_id and original index
        results = [
            (
                document_ids[idx],
                float(similarities[idx]),
                int(idx)
            )
            for idx in top_k_indices
            if similarities[idx] > 0
        ]

        return results

    @staticmethod
    def search_with_threshold(
        query_vector: np.ndarray,
        document_vectors: np.ndarray,
        document_ids: List[str],
        threshold: float = 0.3
    ) -> List[Tuple[str, float, int]]:
        """
        Find all documents above similarity threshold.

        Args:
            query_vector: Query vector
            document_vectors: All document vectors
            document_ids: Identifiers for documents
            threshold: Minimum similarity score

        Returns:
            List of (doc_id, similarity_score, doc_index) filtered by threshold
        """
        similarities = CosineSimilaritySearch.cosine_similarity_batch(
            query_vector,
            document_vectors
        )

        results = []
        for idx in np.argsort(similarities)[::-1]:
            if similarities[idx] >= threshold:
                results.append((
                    document_ids[idx],
                    float(similarities[idx]),
                    int(idx)
                ))

        return results

    @staticmethod
    def batch_similarity_matrix(
        query_vectors: np.ndarray,
        document_vectors: np.ndarray
    ) -> np.ndarray:
        """
        Compute full similarity matrix between multiple queries and documents.

        Args:
            query_vectors: Query vectors of shape (n_queries, n_features)
            document_vectors: Document vectors of shape (n_docs, n_features)

        Returns:
            Similarity matrix of shape (n_queries, n_docs)
        """
        n_queries = query_vectors.shape[0]
        n_docs = document_vectors.shape[0]
        similarities = np.zeros((n_queries, n_docs))

        for i in range(n_queries):
            similarities[i] = CosineSimilaritySearch.cosine_similarity_batch(
                query_vectors[i],
                document_vectors
            )

        return similarities
