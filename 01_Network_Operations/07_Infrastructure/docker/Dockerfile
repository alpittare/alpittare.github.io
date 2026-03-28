# CMI NaaP AI Network Intelligence Platform - Unified Dockerfile
# Multi-stage build for optimal image size and security

# ============================================================================
# Stage 1: Base Stage - Core Python Runtime
# ============================================================================
FROM python:3.10-slim as base

LABEL maintainer="CMI Networks <network-ai-platform@cmi.com>"
LABEL version="1.0.0"
LABEL description="CMI NaaP AI Network Intelligence Platform"

# Set working directory
WORKDIR /app

# Update package manager and install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    wget \
    git \
    libssl-dev \
    libffi-dev \
    libpq-dev \
    netcat \
    iputils-ping \
    net-tools \
    dnsutils \
    telnet \
    openssh-client \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r naap && useradd -r -g naap naap

# ============================================================================
# Stage 2: Dependencies Stage - ML and Base Libraries
# ============================================================================
FROM base as dependencies

WORKDIR /app

# Copy unified requirements
COPY requirements.txt /tmp/

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r /tmp/requirements.txt

# ============================================================================
# Stage 3: Projects Stage - Copy All Project Code
# ============================================================================
FROM dependencies as projects

WORKDIR /app

# Copy all project directories
COPY 01_Blast_Radius_Analysis /app/01_Blast_Radius_Analysis
COPY 02_Autonomous_Operations_Agent /app/02_Autonomous_Operations_Agent
COPY 03_Self_Healing_Network /app/03_Self_Healing_Network
COPY 04_Predictive_Capacity_Intelligence /app/04_Predictive_Capacity_Intelligence
COPY 05_Incident_Correlation_RCA /app/05_Incident_Correlation_RCA
COPY 06_Network_Knowledge_Assistant /app/06_Network_Knowledge_Assistant

# Install project-specific dependencies
RUN for project in 01_Blast_Radius_Analysis 02_Autonomous_Operations_Agent \
    03_Self_Healing_Network 04_Predictive_Capacity_Intelligence \
    05_Incident_Correlation_RCA 06_Network_Knowledge_Assistant; do \
    if [ -f /app/$project/requirements.txt ]; then \
      pip install --no-cache-dir -r /app/$project/requirements.txt; \
    fi; \
  done

# Create necessary directories
RUN mkdir -p /app/models /app/data /app/logs /app/configs /app/knowledge-base && \
    chown -R naap:naap /app

# ============================================================================
# Stage 4: Production Stage - Final Runtime Image
# ============================================================================
FROM dependencies as production

WORKDIR /app

# Copy project code from projects stage
COPY --from=projects /app/01_Blast_Radius_Analysis /app/01_Blast_Radius_Analysis
COPY --from=projects /app/02_Autonomous_Operations_Agent /app/02_Autonomous_Operations_Agent
COPY --from=projects /app/03_Self_Healing_Network /app/03_Self_Healing_Network
COPY --from=projects /app/04_Predictive_Capacity_Intelligence /app/04_Predictive_Capacity_Intelligence
COPY --from=projects /app/05_Incident_Correlation_RCA /app/05_Incident_Correlation_RCA
COPY --from=projects /app/06_Network_Knowledge_Assistant /app/06_Network_Knowledge_Assistant

# Copy configuration files
COPY docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

# Create necessary directories and set permissions
RUN mkdir -p /app/models /app/data /app/logs /app/configs /app/knowledge-base && \
    chown -R naap:naap /app

# Switch to non-root user
USER naap

# Health check script
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=15s \
    CMD curl -f http://localhost:${SERVICE_PORT:-8001}/health || exit 1

# Default environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    LOG_LEVEL=INFO \
    WORKERS=4 \
    TIMEOUT=30

# Expose service ports
EXPOSE 8000 8001 8002 8003 8004 8005 8006

# Default entrypoint
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# ============================================================================
# Stage 5: Dashboard Stage - Lightweight Dashboard Container
# ============================================================================
FROM python:3.10-slim as dashboard

WORKDIR /app

# Install minimal dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Flask only (lightweight)
RUN pip install --no-cache-dir Flask==2.3.0 Werkzeug==2.3.0 requests==2.31.0

# Copy dashboard files
COPY master_dashboard.html /app/
COPY docker-entrypoint.sh /app/

# Create non-root user
RUN groupadd -r naap && useradd -r -g naap naap && \
    chown -R naap:naap /app

USER naap

ENV PYTHONUNBUFFERED=1 PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=10s \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "-m", "http.server", "8000"]

# ============================================================================
# Stage 6: Development Stage - Full Dev Environment
# ============================================================================
FROM projects as development

WORKDIR /app

# Install development tools
RUN pip install --no-cache-dir \
    pytest==7.4.0 \
    pytest-cov==4.1.0 \
    pytest-asyncio==0.21.0 \
    black==23.7.0 \
    flake8==6.0.0 \
    mypy==1.4.0 \
    pylint==2.17.5 \
    bandit==1.7.5 \
    ipython==8.14.0 \
    jupyter==1.0.0 \
    jupyterlab==4.0.3

# Copy test files and development scripts
COPY tests /app/tests
COPY scripts /app/scripts

USER naap

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000-8006 8888

CMD ["bash"]
