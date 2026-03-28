"""
Configuration management for Network Knowledge Assistant.

Environment-based configuration with validation.
"""

import os
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field, validator


class Settings(BaseSettings):
    """Application settings from environment variables."""

    # Server Configuration
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000)
    debug: bool = Field(default=False)
    log_level: str = Field(default="INFO")

    # OpenAI Configuration
    openai_api_key: str = Field(...)
    openai_model: str = Field(default="gpt-4-turbo-preview")
    embedding_model: str = Field(default="text-embedding-3-small")
    embedding_dimension: int = Field(default=1536)

    # Vector Store Configuration
    vector_store_type: str = Field(default="faiss")  # "faiss" or "pinecone"
    faiss_index_path: str = Field(default="./data/faiss_indexes")
    pinecone_api_key: Optional[str] = Field(default=None)
    pinecone_environment: Optional[str] = Field(default=None)
    pinecone_index_name: str = Field(default="network-knowledge")
    pinecone_namespace: str = Field(default="prod")

    # Elasticsearch Configuration
    elasticsearch_url: str = Field(default="http://localhost:9200")
    elasticsearch_user: str = Field(default="elastic")
    elasticsearch_password: str = Field(default="password")
    elasticsearch_index: str = Field(default="network-docs")

    # Confluence Configuration
    confluence_url: str = Field(...)
    confluence_user: str = Field(...)
    confluence_api_token: str = Field(...)
    confluence_spaces: list[str] = Field(default=["NETWORK", "DOCS"])
    confluence_sync_interval_minutes: int = Field(default=60)

    # Git Configuration
    git_repo_urls: list[str] = Field(default=[])
    git_ssh_key_path: Optional[str] = Field(default=None)
    git_local_path: str = Field(default="./data/git_repos")
    git_webhook_secret: str = Field(...)
    git_sync_interval_minutes: int = Field(default=30)

    # NetBox Configuration
    netbox_url: str = Field(...)
    netbox_api_token: str = Field(...)
    netbox_sync_interval_minutes: int = Field(default=30)

    # Database Configuration
    database_url: str = Field(default="sqlite:///./data/nka.db")
    database_echo: bool = Field(default=False)

    # LLM Configuration
    llm_temperature: float = Field(default=0.3, ge=0, le=1)
    llm_max_tokens: int = Field(default=2000)
    llm_top_p: float = Field(default=0.9)
    llm_timeout_seconds: int = Field(default=30)
    llm_request_timeout_seconds: int = Field(default=60)

    # Retrieval Configuration
    retrieval_top_k: int = Field(default=10)
    retrieval_rerank_top_k: int = Field(default=5)
    retrieval_vector_weight: float = Field(default=0.6, ge=0, le=1)
    retrieval_keyword_weight: float = Field(default=0.4, ge=0, le=1)

    # Chunking Configuration
    chunk_size_tokens: int = Field(default=512)
    chunk_overlap_tokens: int = Field(default=50)
    min_chunk_size_tokens: int = Field(default=100)

    # Security & Guardrails
    enable_credential_detection: bool = Field(default=True)
    enable_pii_masking: bool = Field(default=True)
    enable_hallucination_detection: bool = Field(default=True)
    max_query_length: int = Field(default=2000)
    rate_limit_requests_per_minute: int = Field(default=100)
    rate_limit_tokens_per_minute: int = Field(default=40000)

    # Audit & Compliance
    enable_audit_logging: bool = Field(default=True)
    audit_log_retention_days: int = Field(default=90)
    index_change_retention_days: int = Field(default=365)

    # Caching Configuration
    enable_caching: bool = Field(default=True)
    cache_ttl_seconds: int = Field(default=3600)
    cache_max_size_mb: int = Field(default=1000)

    # Performance Configuration
    batch_size_documents: int = Field(default=1000)
    batch_size_embeddings: int = Field(default=100)
    number_of_workers: int = Field(default=4)
    embedding_batch_parallelism: int = Field(default=2)

    # Monitoring
    enable_prometheus_metrics: bool = Field(default=True)
    prometheus_port: int = Field(default=9090)

    class Config:
        """Pydantic config."""
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

    @validator("confluence_spaces", pre=True)
    def parse_confluence_spaces(cls, v):
        """Parse comma-separated spaces."""
        if isinstance(v, str):
            return [s.strip() for s in v.split(",")]
        return v

    @validator("git_repo_urls", pre=True)
    def parse_git_repos(cls, v):
        """Parse comma-separated Git URLs."""
        if isinstance(v, str):
            return [u.strip() for u in v.split(",") if u.strip()]
        return v

    def __init__(self, **data):
        """Initialize settings with validation."""
        super().__init__(**data)

        # Ensure required directories exist
        os.makedirs(self.faiss_index_path, exist_ok=True)
        os.makedirs(self.git_local_path, exist_ok=True)
        os.makedirs("./data", exist_ok=True)

    @property
    def is_production(self) -> bool:
        """Check if running in production."""
        return not self.debug


# Load settings on module import
settings = Settings()
