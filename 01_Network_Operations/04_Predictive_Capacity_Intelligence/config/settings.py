"""
Configuration and constants for Predictive Capacity Intelligence system.
"""
from dataclasses import dataclass
from typing import Dict, List
from enum import Enum


class AlertSeverity(Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class ModelConfig:
    """Configuration for forecasting models."""
    arima_order: tuple = (5, 1, 2)  # (p, d, q)
    holt_winters_seasonal_period: int = 288  # 24 hours * 12 (5-min intervals)
    holt_winters_alpha: float = 0.1  # Level smoothing
    holt_winters_beta: float = 0.05  # Trend smoothing
    holt_winters_gamma: float = 0.1  # Seasonal smoothing
    linear_reg_learning_rate: float = 0.01
    linear_reg_iterations: int = 1000
    linear_reg_l2_regularization: float = 0.001

    # Ensemble weights
    ensemble_weights: Dict[str, float] = None

    def __post_init__(self):
        if self.ensemble_weights is None:
            self.ensemble_weights = {
                "holt_winters": 0.40,
                "arima": 0.35,
                "linear_regression": 0.25
            }


@dataclass
class AlertConfig:
    """Configuration for capacity alerting."""
    warning_threshold: float = 0.80  # 80% utilization
    critical_threshold: float = 0.95  # 95% utilization
    use_adaptive_thresholds: bool = True
    seasonal_factor: float = 1.1  # Adjust thresholds by seasonal pattern

    # Anomaly detection
    zscore_threshold: float = 2.5  # For anomaly flagging


@dataclass
class TelemetryConfig:
    """Configuration for telemetry collection."""
    interval_seconds: int = 300  # 5-minute collection interval
    historical_days: int = 90
    forecast_horizon_hours: int = 168  # 7 days
    interfaces_to_monitor: List[str] = None

    def __post_init__(self):
        if self.interfaces_to_monitor is None:
            self.interfaces_to_monitor = [
                "Ethernet1/1", "Ethernet1/2", "Ethernet1/3", "Ethernet1/4",
                "Ethernet2/1", "Ethernet2/2", "Ethernet2/3", "Ethernet2/4",
                "mgmt0"
            ]


@dataclass
class SystemConfig:
    """Main system configuration."""
    model_config: ModelConfig = None
    alert_config: AlertConfig = None
    telemetry_config: TelemetryConfig = None

    # Output paths
    data_dir: str = "/sessions/epic-stoic-mendel/mnt/claude_folder/04_Predictive_Capacity_Intelligence/data"
    models_dir: str = "/sessions/epic-stoic-mendel/mnt/claude_folder/04_Predictive_Capacity_Intelligence/models"
    output_dir: str = "/sessions/epic-stoic-mendel/mnt/claude_folder/04_Predictive_Capacity_Intelligence/output"

    # System settings
    debug_mode: bool = False
    log_level: str = "INFO"

    def __post_init__(self):
        if self.model_config is None:
            self.model_config = ModelConfig()
        if self.alert_config is None:
            self.alert_config = AlertConfig()
        if self.telemetry_config is None:
            self.telemetry_config = TelemetryConfig()


# Default system configuration
DEFAULT_CONFIG = SystemConfig()
