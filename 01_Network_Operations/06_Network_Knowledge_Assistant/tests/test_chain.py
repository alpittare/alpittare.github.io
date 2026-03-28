"""
Tests for LangChain RAG chain.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from langchain.schema import Document
from src.llm.chain import RAGChain
from src.llm.prompt_templates import PromptManager
from src.llm.guardrails import OutputValidator


@pytest.fixture
def mock_llm_client():
    """Create mock OpenAI client."""
    client = AsyncMock()
    return client


@pytest.fixture
def mock_retriever():
    """Create mock retriever."""
    retriever = AsyncMock()
    return retriever


@pytest.fixture
def prompt_manager():
    """Create prompt manager."""
    return PromptManager()


@pytest.fixture
def guardrails():
    """Create guardrails validator."""
    return OutputValidator()


@pytest.fixture
def rag_chain(mock_llm_client, mock_retriever, prompt_manager, guardrails):
    """Create RAG chain."""
    return RAGChain(
        llm_client=mock_llm_client,
        retriever=mock_retriever,
        prompt_manager=prompt_manager,
        guardrails=guardrails
    )


@pytest.mark.asyncio
async def test_rag_chain_initialization(mock_llm_client, mock_retriever, prompt_manager, guardrails):
    """Test RAG chain initialization."""
    chain = RAGChain(
        llm_client=mock_llm_client,
        retriever=mock_retriever,
        prompt_manager=prompt_manager,
        guardrails=guardrails
    )

    assert chain is not None
    assert chain.temperature == 0.3
    assert chain.max_tokens == 2000


@pytest.mark.asyncio
async def test_rag_chain_no_documents(rag_chain):
    """Test RAG chain with no retrieved documents."""
    rag_chain.retriever.retrieve = AsyncMock(return_value=[])

    result = await rag_chain.run(
        query="What is VLAN 29?",
        query_embedding=[0.1] * 1536
    )

    assert result["status"] == "no_sources"
    assert "couldn't find" in result["answer"].lower()


@pytest.mark.asyncio
async def test_rag_chain_document_formatting(rag_chain):
    """Test context formatting from retrieved documents."""
    docs = [
        Document(
            page_content="VLAN 29 is engineering network",
            metadata={"title": "VLAN Config", "source": "confluence://vlan"}
        )
    ]

    context = rag_chain._format_context(docs)

    assert "VLAN Config" in context
    assert "VLAN 29" in context
    assert "confluence://vlan" in context


@pytest.mark.asyncio
async def test_rag_chain_message_building(rag_chain):
    """Test building messages for LLM."""
    system_prompt = "You are a network expert"
    query = "What is VLAN 29?"

    messages = rag_chain._build_messages(system_prompt, query)

    assert len(messages) >= 2
    assert messages[0]["role"] == "system"
    assert messages[-1]["role"] == "user"
    assert messages[-1]["content"] == query


@pytest.mark.asyncio
async def test_rag_chain_conversation_history(rag_chain):
    """Test conversation history management."""
    rag_chain._add_to_history(
        query="What is VLAN 29?",
        response="VLAN 29 is engineering network"
    )

    history = rag_chain.get_history()

    assert len(history) == 1
    assert history[0]["query"] == "What is VLAN 29?"
    assert history[0]["response"] == "VLAN 29 is engineering network"


@pytest.mark.asyncio
async def test_rag_chain_history_reset(rag_chain):
    """Test conversation history reset."""
    rag_chain._add_to_history("Query 1", "Response 1")
    rag_chain._add_to_history("Query 2", "Response 2")

    assert len(rag_chain.get_history()) == 2

    rag_chain.reset_history()

    assert len(rag_chain.get_history()) == 0


@pytest.mark.asyncio
async def test_prompt_template_selection():
    """Test prompt template selection based on query."""
    manager = PromptManager()

    # Topology query
    template = manager.select_template("What services depend on VLAN 29?")
    assert template.name == "topology"

    # Impact query
    template = manager.select_template("What happens if router X fails?")
    assert template.name == "impact"

    # Config query
    template = manager.select_template("Show me the BGP configuration")
    assert template.name == "config"


@pytest.mark.asyncio
async def test_guardrails_credential_detection():
    """Test credential detection in guardrails."""
    validator = OutputValidator(enable_credential_detection=True)

    text_with_secrets = "Connect using password=secretpassword123"

    sanitized, violations = await validator.validate(text_with_secrets)

    assert "[REDACTED_PASSWORD]" in sanitized
    assert len(violations) > 0


@pytest.mark.asyncio
async def test_guardrails_pii_masking():
    """Test PII masking in guardrails."""
    validator = OutputValidator(enable_pii_masking=True)

    text_with_pii = "Contact john.doe@company.com for more info"

    sanitized, violations = await validator.validate(text_with_pii)

    # Should be masked
    assert "john.doe@company.com" not in sanitized or "[REDACTED" in sanitized


@pytest.mark.asyncio
async def test_guardrails_response_rejection():
    """Test response rejection on critical violations."""
    validator = OutputValidator(enable_credential_detection=True)

    # API key is critical violation
    critical_text = "API_KEY: sk-1234567890abcdef"

    sanitized, violations = await validator.validate(critical_text)

    # Check if rejection would occur
    should_reject = validator.should_reject_response(violations)
    assert should_reject or len(violations) > 0


class TestPromptManager:
    """Test prompt manager functionality."""

    def test_template_availability(self):
        """Test all templates are available."""
        manager = PromptManager()

        assert "topology" in manager.templates
        assert "config" in manager.templates
        assert "impact" in manager.templates

    def test_system_prompt_formatting(self):
        """Test system prompt formatting."""
        manager = PromptManager()

        prompt = manager.get_system_prompt(
            template_name="topology",
            context="Sample context",
            question="Sample question"
        )

        assert "Sample context" in prompt
        assert "Sample question" in prompt

    def test_few_shot_examples(self):
        """Test few-shot examples availability."""
        manager = PromptManager()

        examples = manager.get_few_shot_prompt("topology")

        assert "Example" in examples or "Q:" in examples

    def test_output_format_instructions(self):
        """Test output format instructions."""
        manager = PromptManager()

        format_str = manager.get_output_format("topology")

        assert len(format_str) > 0
