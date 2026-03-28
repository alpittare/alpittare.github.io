"""Configuration settings for Autonomous Operations Agent"""

# Isolation Forest settings
IF_N_TREES = 100
IF_MAX_DEPTH = 20
IF_CONTAMINATION = 0.05
IF_THRESHOLD = 0.5

# Autoencoder settings
AE_INPUT_DIM = 7
AE_HIDDEN_DIM = 4
AE_LATENT_DIM = 2
AE_LEARNING_RATE = 0.01
AE_EPOCHS = 50
AE_BATCH_SIZE = 32

# Event Correlator settings
EVENT_TIME_WINDOW_MINUTES = 5
EVENT_SPATIAL_THRESHOLD = 3

# Telemetry settings
NUM_DEVICES = 10
NUM_SAMPLES = 120
ANOMALY_INJECTION_RATE = 0.05

# API settings
API_HOST = "0.0.0.0"
API_PORT = 8080

# Stream settings
BUFFER_SIZE = 1000
BATCH_SIZE = 32

# Feature names
FEATURE_NAMES = [
    'cpu_utilization',
    'memory_utilization',
    'interface_errors',
    'bgp_neighbor_flaps',
    'latency_ms',
    'jitter_ms',
    'packet_loss_percent'
]

# Anomaly types
ANOMALY_TYPES = [
    'cpu_spike',
    'memory_leak',
    'bgp_flap',
    'interface_errors',
    'latency_spike',
    'combined_failure'
]

# Severity thresholds
SEVERITY_CRITICAL = 0.9
SEVERITY_HIGH = 0.7
SEVERITY_MEDIUM = 0.5
SEVERITY_LOW = 0.3
