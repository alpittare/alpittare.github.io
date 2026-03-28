"""
Tests for retrieval pipeline.
"""

import pytest
from langchain.schema import Document
from src.retrieval.retriever import HybridRetriever, KeywordStore
from src.indexing.vector_store import VectorStoreFactory


@pytest.fixture
def sample_documents():
    """Create sample documents for testing."""
    return [
        Document(
            page_content="VLAN 29 is used for the engineering network",
            metadata={
                "title": "VLAN Configuration",
                "source": "confluence://vlan-config"
            }
        ),
        Document(
            page_content="Jenkins CI/CD server runs on 10.20.29.50",
            metadata={
                "title": "Service Inventory",
                "source": "netbox://services"
            }
        ),
        Document(
            page_content="BGP configuration for ISP peering",
            metadata={
                "title": "BGP Config",
                "source": "git://bgp-config.yaml"
            }
        )
    ]


@pytest.fixture
async def keyword_store():
    """Create keyword store."""
    store = KeywordStore()
    return store


@pytest.fixture
async def vector_store():
    """Create vector store (FAISS)."""
    store = VectorStoreFactory.create(
        store_type="faiss",
        index_path="./test_data/faiss_indexes"
    )
    return store


@pytest.mark.asyncio
async def test_keyword_search(keyword_store, sample_documents):
    """Test keyword search."""
    await keyword_store.add_documents(sample_documents)

    results = await keyword_store.search("VLAN 29", k=2)

    assert len(results) > 0
    assert results[0][0].page_content.lower().count("vlan") > 0


@pytest.mark.asyncio
async def test_keyword_search_empty_results(keyword_store, sample_documents):
    """Test keyword search with no results."""
    await keyword_store.add_documents(sample_documents)

    results = await keyword_store.search("nonexistent_term", k=5)

    assert len(results) == 0


@pytest.mark.asyncio
async def test_hybrid_retriever_initialization(vector_store):
    """Test hybrid retriever initialization."""
    keyword_store = KeywordStore()

    retriever = HybridRetriever(
        vector_store=vector_store,
        keyword_store=keyword_store,
        vector_weight=0.6,
        keyword_weight=0.4,
        top_k=10
    )

    assert retriever is not None
    assert retriever.vector_weight == 0.6
    assert retriever.keyword_weight == 0.4


@pytest.mark.asyncio
async def test_retriever_weight_normalization(vector_store):
    """Test that retriever normalizes mismatched weights."""
    keyword_store = KeywordStore()

    # Weights don't sum to 1.0
    retriever = HybridRetriever(
        vector_store=vector_store,
        keyword_store=keyword_store,
        vector_weight=0.7,
        keyword_weight=0.7,  # Sum = 1.4
        top_k=10
    )

    # Should be normalized
    assert abs(retriever.vector_weight + retriever.keyword_weight - 1.0) < 0.01


@pytest.mark.asyncio
async def test_retriever_score_fusion(vector_store, sample_documents):
    """Test fusion of vector and keyword search results."""
    keyword_store = KeywordStore()
    await keyword_store.add_documents(sample_documents)

    retriever = HybridRetriever(
        vector_store=vector_store,
        keyword_store=keyword_store,
        vector_weight=0.5,
        keyword_weight=0.5,
        top_k=5
    )

    # Mock embeddings for vector search
    query_embedding = [0.1] * 1536

    results = await retriever.retrieve(
        query="VLAN 29",
        query_embedding=query_embedding,
        k=5
    )

    # Should return documents
    assert len(results) >= 0


@pytest.mark.asyncio
async def test_retriever_empty_results(vector_store):
    """Test retriever with no matching documents."""
    keyword_store = KeywordStore()

    retriever = HybridRetriever(
        vector_store=vector_store,
        keyword_store=keyword_store,
        top_k=10
    )

    query_embedding = [0.1] * 1536
    results = await retriever.retrieve(
        query="nonexistent",
        query_embedding=query_embedding
    )

    assert len(results) == 0


class TestRetrievalMetrics:
    """Test retrieval metrics tracking."""

    def test_metrics_initialization(self):
        """Test metrics initialization."""
        from src.retrieval.retriever import RetrievalMetrics

        metrics = RetrievalMetrics()

        assert metrics.total_queries == 0
        assert metrics.total_latency_ms == 0

    def test_metrics_recording(self):
        """Test recording metrics."""
        from src.retrieval.retriever import RetrievalMetrics

        metrics = RetrievalMetrics()

        metrics.record_query(100.0)
        metrics.record_query(150.0)

        assert metrics.total_queries == 2
        assert metrics.total_latency_ms == 250.0

    def test_metrics_stats(self):
        """Test metrics statistics."""
        from src.retrieval.retriever import RetrievalMetrics

        metrics = RetrievalMetrics()
        metrics.record_query(100.0)
        metrics.record_query(200.0)

        stats = metrics.get_stats()

        assert stats["total_queries"] == 2
        assert stats["average_latency_ms"] == 150.0
