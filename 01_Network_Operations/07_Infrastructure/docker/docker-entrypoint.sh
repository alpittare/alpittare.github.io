#!/bin/bash

# CMI NaaP AI Network Intelligence Platform - Docker Entrypoint Script
# Handles service startup, health checks, and logging configuration

set -e

# Default environment variables
SERVICE_NAME=${SERVICE_NAME:-"unknown"}
SERVICE_PORT=${SERVICE_PORT:-8000}
LOG_LEVEL=${LOG_LEVEL:-"INFO"}
WORKERS=${WORKERS:-4}
TIMEOUT=${TIMEOUT:-30}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ${GREEN}INFO${NC}: $1"
}

log_warn() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ${YELLOW}WARN${NC}: $1"
}

log_error() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ${RED}ERROR${NC}: $1"
}

# Print startup header
log_info "======================================================================"
log_info "CMI NaaP AI Network Intelligence Platform - Docker Container"
log_info "======================================================================"
log_info "Service: $SERVICE_NAME"
log_info "Port: $SERVICE_PORT"
log_info "Log Level: $LOG_LEVEL"
log_info "Workers: $WORKERS"
log_info "Timeout: $TIMEOUT seconds"
log_info "======================================================================"

# Health check endpoint
health_check() {
    local port=$1
    local max_retries=30
    local retry_count=0

    while [ $retry_count -lt $max_retries ]; do
        if curl -sf "http://localhost:${port}/health" > /dev/null 2>&1; then
            log_info "Service is healthy on port ${port}"
            return 0
        fi
        retry_count=$((retry_count + 1))
        log_warn "Health check attempt $retry_count/$max_retries..."
        sleep 2
    done

    log_error "Service failed to become healthy after $max_retries attempts"
    return 1
}

# Create necessary directories
log_info "Creating necessary directories..."
mkdir -p /app/logs
mkdir -p /app/data
mkdir -p /app/models
mkdir -p /app/configs
mkdir -p /app/knowledge-base

# Ensure proper permissions
chown -R 1000:1000 /app/logs /app/data /app/configs /app/knowledge-base 2>/dev/null || true
chmod -R 755 /app/logs /app/data /app/configs /app/knowledge-base 2>/dev/null || true

log_info "Directories created and permissions set"

# Function to start FastAPI service
start_fastapi_service() {
    local project_dir=$1
    local service_name=$2
    local port=$3

    log_info "Starting FastAPI service: $service_name on port $port"

    if [ ! -f "$project_dir/main.py" ]; then
        log_error "main.py not found in $project_dir"
        return 1
    fi

    # Start the service
    cd "$project_dir"

    # Create environment file for service
    cat > .env << EOF
SERVICE_NAME=$service_name
SERVICE_PORT=$port
LOG_LEVEL=$LOG_LEVEL
WORKERS=$WORKERS
TIMEOUT=$TIMEOUT
EOF

    log_info "Starting uvicorn server..."

    # Start with uvicorn
    exec uvicorn main:app \
        --host 0.0.0.0 \
        --port $port \
        --workers $WORKERS \
        --log-level $(echo "$LOG_LEVEL" | tr '[:upper:]' '[:lower:]') \
        --access-log \
        --timeout-keep-alive $TIMEOUT
}

# Determine which service to start based on working directory or SERVICE_NAME
log_info "Current working directory: $(pwd)"

# Service routing based on SERVICE_NAME
case "$SERVICE_NAME" in
    "master-dashboard")
        log_info "Starting Master Dashboard service..."
        cd /app
        # Use Python's built-in HTTP server for dashboard
        exec python -m http.server $SERVICE_PORT
        ;;

    "blast-radius-analysis")
        start_fastapi_service "/app/01_Blast_Radius_Analysis" "Blast Radius Analysis" "8001"
        ;;

    "autonomous-ops-agent")
        start_fastapi_service "/app/02_Autonomous_Operations_Agent" "Autonomous Operations Agent" "8002"
        ;;

    "self-healing-network")
        start_fastapi_service "/app/03_Self_Healing_Network" "Self-Healing Network" "8003"
        ;;

    "predictive-capacity")
        start_fastapi_service "/app/04_Predictive_Capacity_Intelligence" "Predictive Capacity Intelligence" "8004"
        ;;

    "incident-correlation")
        start_fastapi_service "/app/05_Incident_Correlation_RCA" "Incident Correlation & RCA" "8005"
        ;;

    "knowledge-assistant")
        start_fastapi_service "/app/06_Network_Knowledge_Assistant" "Network Knowledge Assistant" "8006"
        ;;

    *)
        # Default: try to detect from pwd or use development mode
        if [ -f "main.py" ]; then
            log_info "Found main.py in current directory, starting as FastAPI service..."
            start_fastapi_service "$(pwd)" "$SERVICE_NAME" "$SERVICE_PORT"
        else
            log_warn "SERVICE_NAME not recognized and no main.py found"
            log_info "Starting interactive shell for debugging..."
            exec /bin/bash
        fi
        ;;
esac
