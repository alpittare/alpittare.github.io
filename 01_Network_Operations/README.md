# CMI NaaP AI/ML Network Operations - Infrastructure Configuration

Comprehensive infrastructure configuration files for 6 telecom AI/ML platform use cases.

## Structure

```
01_CMI_NaaP_AI_ML_Network_Operations/
├── 01_Blast_Radius_Analysis/
├── 02_Autonomous_Operations_Agent/
├── 03_Self_Healing_Network/
├── 04_Predictive_Capacity_Intelligence/
├── 05_Incident_Correlation_RCA/
└── 06_Network_Knowledge_Assistant/
```

## Configuration Files per Use Case

Each use case directory contains:

### monitoring/
- **prometheus_rules.yml**: Alert rules including:
  - Service health checks (up/down, response time)
  - Resource monitoring (CPU, memory, disk)
  - ML model metrics (drift, latency, accuracy)
  - UC-specific business logic alerts
  
- **grafana_dashboard.json**: Visualization dashboard with:
  - Service overview panels
  - Resource utilization metrics
  - ML performance indicators
  - UC-specific custom panels

### ci_cd/
- **github_actions.yml**: Automated CI/CD pipeline:
  - Code linting (Black, isort, Flake8)
  - Unit tests (pytest with coverage)
  - Security scanning (Bandit, Safety)
  - Docker image build and push
  - Kubernetes staging deployment

### config/
- **Dockerfile**: Container image specification
  - Python 3.10-slim base
  - Health check endpoints
  - FastAPI/uvicorn server
  
- **kubernetes.yaml**: Complete K8s deployment stack
  - Namespace, Deployment, Service
  - ConfigMap, HPA, NetworkPolicy
  - Resource limits and health probes

## Use Cases

### 01 - Blast Radius Analysis (Port 8001)
Network topology analysis for blast radius computation and cascade simulation.

**Key Metrics**: Topology graph metrics, risk score distribution, cascade simulations

### 02 - Autonomous Operations Agent (Port 8002)
Real-time anomaly detection and autonomous operations.

**Key Metrics**: Anomaly rate, Isolation Forest scores, Kafka consumer lag, autoencoder loss

### 03 - Self-Healing Network (Port 8003)
Automated network healing with remediation orchestration.

**Key Metrics**: Healing loop status, remediation success rate, guardrail compliance, health score

### 04 - Predictive Capacity Intelligence (Port 8004)
Time series forecasting for network capacity planning.

**Key Metrics**: Forecast accuracy, capacity headroom, ARIMA/LSTM/Prophet comparison

### 05 - Incident Correlation RCA (Port 8005)
Root cause analysis via incident correlation and clustering.

**Key Metrics**: Alarm rate, DBSCAN clusters, correlation confidence, RCA depth

### 06 - Network Knowledge Assistant (Port 8006)
RAG-powered NLP assistant for network operations.

**Key Metrics**: RAG retrieval relevance, intent classification accuracy, guardrail triggers

## Alert Rules Summary

Total: 62 alert rules configured

| Use Case | Rules | Key Alerts |
|----------|-------|-----------|
| UC1 | 11 | Blast radius timeout, graph traversal failure |
| UC2 | 12 | Anomaly rate spike, Kafka lag, autoencoder loss |
| UC3 | 9 | Remediation failure, guardrail breach, health critical |
| UC4 | 10 | Forecast drift, capacity breach, LSTM failure |
| UC5 | 10 | Alarm storm, cluster explosion, RCA timeout |
| UC6 | 11 | RAG failure, intent misclassification, guardrail triggers |

## Dashboard Panels

Total: 92 panels across all dashboards

Each dashboard includes:
- Service overview (uptime, request rate, error rate, latency)
- Resource utilization (CPU, memory, disk, network)
- ML model performance (inference latency, accuracy, drift)
- UC-specific custom panels (10-16 per dashboard)

## Kubernetes Deployment

All use cases deploy to namespace: `cmi-naap`

**Standard Configuration:**
- Replicas: 2 (initial) with HPA (min 2, max 10)
- Strategy: RollingUpdate with zero downtime
- Health Checks: liveness + readiness probes
- Scaling Target: CPU utilization 70%
- Network Policy: Namespace-scoped isolation

**Resource Specifications:**

| UC | CPU Request-Limit | Memory Request-Limit |
|----|-------------------|----------------------|
| 1 | 500m-2000m | 512Mi-2Gi |
| 2 | 1000m-4000m | 1Gi-4Gi |
| 3 | (pre-existing) | (pre-existing) |
| 4 | 1500m-4000m | 2Gi-4Gi |
| 5 | 2000m-4000m | 2Gi-4Gi |
| 6 | 1000m-3000m | 1.5Gi-3Gi |

## CI/CD Pipeline

All use cases use GitHub Actions with standard jobs:

1. **lint** - Code quality checks (Black, isort, Flake8)
2. **test** - Unit tests with coverage reporting
3. **security** - Vulnerability scanning (Bandit, Safety)
4. **build-docker** - Container image creation and push
5. **deploy-staging** - K8s staging environment deployment

**Matrix Testing:** Python 3.10 and 3.11

## Deployment Instructions

### Prerequisites
- Kubernetes cluster (1.20+)
- Prometheus + Grafana stack
- GitHub Actions enabled
- Container registry (GHCR, ECR, etc.)

### Deploy Use Case
```bash
kubectl apply -f <use-case>/config/kubernetes.yaml
```

### Verify Deployment
```bash
kubectl get pods -n cmi-naap
kubectl rollout status deployment/<app-name> -n cmi-naap
```

### Configure Monitoring
1. Import Grafana dashboard: `<use-case>/monitoring/grafana_dashboard.json`
2. Import Prometheus rules: `<use-case>/monitoring/prometheus_rules.yml`
3. Configure Prometheus scrape configs for service discovery

### Enable CI/CD
1. Commit `.github/workflows/` directory to repository
2. Ensure GITHUB_TOKEN has package write permissions
3. Trigger on push to main branch

## Production Readiness

All configurations meet production requirements:

✓ High availability (multi-replica, auto-scaling)
✓ Graceful degradation (RollingUpdate strategy)
✓ Health observability (probes, Prometheus metrics)
✓ Resource management (requests/limits, HPA)
✓ Network security (NetworkPolicy isolation)
✓ Automated testing (unit + security)
✓ Infrastructure as Code (K8s YAML)
✓ Container versioning (semantic tags)
✓ Configuration management (ConfigMaps)

## Support

For issues or modifications:
1. Review UC-specific prometheus_rules.yml for alert thresholds
2. Adjust resource limits in kubernetes.yaml based on load testing
3. Customize CI/CD pipeline in github_actions.yml per team requirements
4. Update Grafana dashboard panels for additional metrics

---

Generated: 2026-03-26
Base Path: `/sessions/gifted-loving-galileo/mnt/01_CMI_NaaP_AI_ML_Network_Operations`
