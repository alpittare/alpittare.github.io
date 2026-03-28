# Self-Healing Network (SHN)

Production-grade closed-loop automation system for network fault detection, diagnosis, and remediation with ML-driven intelligence.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run demonstration
python run_demo.py

# Run unit tests
python -m pytest tests/

# Start API server
python api/server.py

# Launch Streamlit dashboard
streamlit run app.py
```

## Architecture

```
Telemetry → Detect → Analyze → Decide → Act → Verify → Audit Log
            (ML)     (ML)    (Policy) (Cisco) (Check) (Complete)
```

## Components

### Detection (Anomaly Detection)
- **Z-Score Method**: Threshold-based standard deviation detection
- **EWMA Method**: Exponential weighted moving average drift detection
- **Threshold Method**: Simple metric threshold crossing

### Analysis (Fault Classification)
- **Decision Tree Classifier**: Identifies fault type (5 classes)
  - Interface Down
  - BGP Flap
  - Interface Flap
  - High CPU
  - STP Loop
  - Link Errors
  - Packet Loss

### Health Scoring
- Multi-metric weighted score (0-100)
- Components: CPU, Memory, Interface Health, BGP Health, Error Rate
- Risk levels: low, medium, high, critical

### Failure Prediction
- Logistic regression (numpy-based)
- Predicts failure probability in 1h, 4h, 24h windows
- Features: error_rate_trend, cpu_trend, memory_trend, bgp_stability

### Policy Engine
- Rule-based remediation policies
- Priority-weighted policy matching
- Auto-execution support with approval gates

### Guardrails (Safety)
1. **Rate Limiting**: Max 5 actions/hour
2. **Rollback Trigger**: Revert if health degrades >10%
3. **Change Window**: Only remediate 02:00-06:00 UTC (configurable)
4. **Emergency Override**: For urgent situations

### Remediation (Cisco CLI Generation)
- Automatic command generation for detected faults
- Device-specific: NX-OS, IOS
- Command validation before execution

### Verification
- Post-remediation metric collection
- Effectiveness measurement (improvement score)
- Automatic status detection (success/partial/failed)

## Supported Fault Types & Remediation

| Fault Type | Detection | Remediation | Command |
|-----------|-----------|------------|---------|
| Link Down | Utilization < 2% + errors | Interface bounce | `shut`/`no shut` |
| BGP Flap | Neighbors down >= 3 | BGP soft reset | `clear ip bgp X soft in` |
| Interface Flap | Errors > 500 + loss > 10% | Interface bounce | `shut`/`no shut` |
| High CPU | CPU >= 80% + memory >= 70% | BGP reset | `clear ip bgp * soft` |
| STP Loop | Blocked ports >= 3 | Priority adjust | `spanning-tree vlan X priority Y` |

## Configuration

### YAML Policies (`config/policies.yaml`)
```yaml
policies:
  - name: "bgp_flap_recovery"
    conditions:
      - metric: "bgp_neighbors_down"
        threshold: 2
    action:
      type: "bgp_soft_reset"
    priority: 8
    auto_execute: true
```

### Python Settings (`config/settings.py`)
```python
GUARDRAILS = {
    'rate_limiter': {'max_actions_per_hour': 5},
    'rollback_trigger': {'health_threshold': -10.0},
    'change_window': {'start_hour_utc': 2, 'end_hour_utc': 6}
}
```

## Project Structure

```
03_Self_Healing_Network/
├── app.py                          # Streamlit dashboard
├── run_demo.py                     # Full demonstration (900+ lines)
├── requirements.txt
├── data/
│   ├── cisco_config.py            # Cisco CLI parser + command generator
│   ├── telemetry_sim.py           # Telemetry data simulator
│   └── fault_scenarios.py         # Pre-defined fault scenarios
├── models/
│   ├── fault_detector.py          # Z-score + EWMA anomaly detection
│   ├── anomaly_classifier.py      # Decision tree fault classifier
│   ├── health_scorer.py           # Weighted health scoring
│   └── failure_predictor.py       # Logistic regression (numpy)
├── engine/
│   ├── policy_engine.py           # Rule-based policy evaluation
│   ├── guardrails.py              # Safety mechanisms
│   ├── remediation.py             # Action generation + execution
│   └── verification.py            # Post-remediation verification
├── pipeline/
│   └── state_machine.py           # Closed-loop state machine
├── config/
│   ├── policies.yaml              # Policy definitions
│   └── settings.py                # Configuration
├── tests/
│   └── test_self_healing.py       # Unit tests
├── deployment/
│   ├── Dockerfile
│   ├── kubernetes.yaml
│   └── docker-compose.yml
└── docs/
    ├── HLD.md                     # High-level design
    └── LLD.md                     # Low-level design
```

## ML Models

### Fault Detection
- **Z-Score**: |value - mean| / std_dev >= threshold
- **EWMA**: Exponential smoothing with adaptive threshold
- **Thresholds**: Static metric boundaries

### Fault Classification
- **Decision Tree**: If-then rules for fault type identification
- **Confidence Scoring**: Rule-based confidence calculation
- **Feature Importance**: Top contributing metrics

### Health Scoring
- **Component Scores**: Individual metric scoring (0-100)
- **Weighted Sum**: Multi-metric aggregation
- **Trend Analysis**: Improving/stable/degrading
- **Risk Levels**: low/medium/high/critical

### Failure Prediction
- **Logistic Regression**: Binary classification model
- **Feature Engineering**: Trend-based features
- **Time Windows**: 1h, 4h, 24h predictions
- **Training**: On-device historical data

## Performance

- **Detection Latency**: <1 second
- **Analysis Time**: <500ms
- **Policy Evaluation**: <100ms
- **Command Generation**: <50ms
- **Average Recovery**: 30-120 seconds per fault

## Testing

```bash
# Run unit tests
python -m pytest tests/test_self_healing.py -v

# Run demonstration
python run_demo.py

# Run specific scenario
python -c "from run_demo import demonstrate_fault_scenario; ..."
```

## Deployment

### Docker
```bash
docker build -t self-healing-network:latest .
docker run -p 8000:8000 self-healing-network:latest
```

### Kubernetes
```bash
kubectl apply -f deployment/kubernetes.yaml
kubectl port-forward svc/self-healing-network 8000:8000
```

## API Endpoints

```
POST /api/metrics              # Submit device metrics
GET  /api/health              # System health check
POST /api/remediate           # Trigger manual remediation
GET  /api/audit-log           # Get audit trail
GET  /api/predictions         # Get failure predictions
```

## Monitoring & Alerts

- Real-time Streamlit dashboard
- Audit trail with complete workflow history
- Slack/PagerDuty integration (optional)
- Prometheus metrics export

## Limitations & Caveats

1. **Simulation Mode**: Cisco commands are simulated, not executed on real devices
2. **Training Data**: Failure predictor trained on small synthetic dataset
3. **Single Device**: Designed for single device (extensible to multiple)
4. **Change Window**: UTC-based, adjust for your timezone

## Future Enhancements

1. LLM integration for root cause analysis
2. Multi-device correlation
3. RAG engine with runbook knowledge base
4. Advanced ML: LSTM, XGBoost, ensemble models
5. Real device integration (SSH/Netconf/gRPC)
6. Anomaly explanation (LIME/SHAP)
7. Automated root cause analysis
8. Predictive maintenance scheduling

## License

Proprietary - Network Operations

## Support

Network Operations Center
noc@company.com
On-call: +1-xxx-xxx-xxxx

## References

- Cisco NX-OS Command Reference
- Cisco IOS Command Reference
- ML Anomaly Detection Techniques
- Network Automation Best Practices
