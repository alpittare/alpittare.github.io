"""
Configuration Settings for Self-Healing Network
"""

import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"
LOGS_DIR = BASE_DIR / "logs"
LOGS_DIR.mkdir(exist_ok=True)

# Device Configuration
DEVICE_CONFIG = {
    'primary': {
        'hostname': 'nexus-01',
        'device_id': 'nx-001',
        'device_type': 'nexus_9000',
        'ip_address': '10.0.0.1',
        'snmp_community': 'public'
    }
}

# Detection Parameters
ANOMALY_DETECTION = {
    'zscore_threshold_warning': 2.0,
    'zscore_threshold_critical': 3.0,
    'ewma_alpha': 0.2,
    'ewma_threshold': 2.0,
    'window_size': 50,
    'min_samples': 5
}

# Health Scoring Weights
HEALTH_WEIGHTS = {
    'cpu': 0.20,
    'memory': 0.15,
    'interface_health': 0.25,
    'bgp_health': 0.20,
    'error_rate': 0.20
}

# Metric Thresholds
METRIC_THRESHOLDS = {
    'cpu_percent': (70, 85),  # (warning, critical)
    'memory_percent': (75, 90),
    'interface_errors': (100, 500),
    'packet_loss_percent': (5, 20),
    'bgp_neighbors_down': (2, 4),
    'link_utilization_percent': (85, 95)
}

# Policy Engine
POLICY_ENGINE = {
    'max_policies_to_evaluate': 10,
    'min_confidence_threshold': 0.5,
    'priority_boost_for_high_severity': 2
}

# Guardrails
GUARDRAILS = {
    'rate_limiter': {
        'enabled': True,
        'max_actions_per_hour': 5,
    },
    'rollback_trigger': {
        'enabled': True,
        'health_threshold': -10.0,  # % change
    },
    'change_window': {
        'enabled': True,
        'start_hour_utc': 2,
        'end_hour_utc': 6,
        'allow_override': True
    }
}

# Remediation
REMEDIATION = {
    'max_concurrent_actions': 1,
    'command_execution_timeout': 300,  # seconds
    'enable_dry_run': False,
    'validate_commands': True
}

# Verification
VERIFICATION = {
    'post_remediation_wait_seconds': 10,
    'verification_metrics': ['cpu_percent', 'interface_errors', 'packet_loss_percent'],
    'improvement_threshold': 20  # % improvement
}

# Failure Prediction
FAILURE_PREDICTION = {
    'prediction_windows_hours': [1, 4, 24],
    'retrain_interval_hours': 24,
    'min_training_samples': 100
}

# Logging
LOGGING = {
    'level': 'INFO',
    'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    'file': str(LOGS_DIR / 'self-healing.log'),
    'max_bytes': 10485760,  # 10MB
    'backup_count': 5
}

# API
API = {
    'host': '0.0.0.0',
    'port': 8000,
    'debug': False,
    'workers': 4
}

# Streamlit
STREAMLIT = {
    'theme': 'dark',
    'page_title': 'Self-Healing Network Dashboard',
    'layout': 'wide'
}

# Feature Flags
FEATURES = {
    'enable_auto_remediation': True,
    'enable_ml_prediction': True,
    'enable_policy_engine': True,
    'enable_guardrails': True,
    'enable_rag_engine': False,  # Requires LLM setup
    'enable_notifications': False
}
