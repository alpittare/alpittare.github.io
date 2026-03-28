"""
Ensemble forecasting combining ARIMA, Holt-Winters, and Linear Regression.
Provides weighted average forecasts with confidence intervals.
"""
import numpy as np
from typing import Dict
import logging

logger = logging.getLogger(__name__)


class EnsembleModel:
    """
    Weighted ensemble combining multiple forecasting models.
    Weights: 40% Holt-Winters, 35% ARIMA, 25% Linear Regression
    """

    def __init__(self, weights: Dict[str, float] = None):
        """
        Initialize ensemble model.
        
        Args:
            weights: Dictionary with model names and their weights
        """
        if weights is None:
            self.weights = {
                "holt_winters": 0.40,
                "arima": 0.35,
                "linear_regression": 0.25
            }
        else:
            self.weights = weights
            # Normalize weights
            total = sum(self.weights.values())
            self.weights = {k: v / total for k, v in self.weights.items()}
        
        self.models = {}
        self.is_fitted = False

    def add_model(self, name: str, model) -> 'EnsembleModel':
        """Add a fitted model to the ensemble."""
        if not hasattr(model, 'predict'):
            raise ValueError(f"Model {name} must have predict method")
        
        self.models[name] = model
        return self

    def fit(self, *args, **kwargs) -> 'EnsembleModel':
        """Fit all models (assumes they're already fitted)."""
        self.is_fitted = True
        logger.info("Ensemble model initialized with fitted sub-models")
        return self

    def predict(self, series: np.ndarray = None, steps: int = 1, 
                include_confidence: bool = True) -> Dict:
        """
        Generate ensemble forecast by combining all models.
        
        Args:
            series: Historical time series (used by some models)
            steps: Number of steps ahead to forecast
            include_confidence: Include confidence intervals
        
        Returns:
            Dictionary with ensemble forecast and confidence bounds
        """
        if not self.is_fitted:
            raise ValueError("Ensemble must be fitted before prediction")
        
        if len(self.models) == 0:
            raise ValueError("No models added to ensemble")
        
        forecasts = {}
        lower_bounds = {}
        upper_bounds = {}
        
        # Get predictions from all models
        for name, model in self.models.items():
            try:
                if name == "linear_regression":
                    pred_dict = model.predict(series, steps, include_confidence)
                else:
                    pred_dict = model.predict(steps, include_confidence)
                
                forecasts[name] = pred_dict["forecast"]
                
                if include_confidence and "lower_bound" in pred_dict:
                    lower_bounds[name] = pred_dict["lower_bound"]
                    upper_bounds[name] = pred_dict["upper_bound"]
            except Exception as e:
                logger.warning(f"Failed to get prediction from {name}: {e}")
        
        # Weighted average
        ensemble_forecast = np.zeros(steps)
        ensemble_lower = np.zeros(steps)
        ensemble_upper = np.zeros(steps)
        
        total_weight = 0
        
        for name, forecast in forecasts.items():
            weight = self.weights.get(name, 0)
            if weight > 0:
                ensemble_forecast += weight * forecast
                total_weight += weight
                
                if include_confidence and name in lower_bounds:
                    ensemble_lower += weight * lower_bounds[name]
                    ensemble_upper += weight * upper_bounds[name]
        
        # Normalize by actual total weight
        if total_weight > 0:
            ensemble_forecast /= total_weight
            if include_confidence:
                ensemble_lower /= total_weight
                ensemble_upper /= total_weight
        
        result = {
            "forecast": np.maximum(0, ensemble_forecast),
            "steps": steps,
            "component_forecasts": forecasts,
            "weights": self.weights
        }
        
        if include_confidence:
            result["lower_bound"] = np.maximum(0, ensemble_lower)
            result["upper_bound"] = ensemble_upper
            result["confidence_width"] = (ensemble_upper - ensemble_lower) / 2
        
        return result

    def get_model_contributions(self) -> Dict:
        """Return the contribution of each model to ensemble forecast."""
        return self.weights.copy()

    def set_weights(self, weights: Dict[str, float]) -> 'EnsembleModel':
        """Update model weights."""
        total = sum(weights.values())
        self.weights = {k: v / total for k, v in weights.items()}
        logger.info(f"Ensemble weights updated: {self.weights}")
        return self

    def rmse(self, actual: np.ndarray, predicted: np.ndarray) -> float:
        """Calculate RMSE."""
        return np.sqrt(np.mean((actual - predicted) ** 2))

    def mae(self, actual: np.ndarray, predicted: np.ndarray) -> float:
        """Calculate MAE."""
        return np.mean(np.abs(actual - predicted))

    def mape(self, actual: np.ndarray, predicted: np.ndarray) -> float:
        """Calculate MAPE (%)."""
        mask = actual != 0
        if np.sum(mask) == 0:
            return 0
        return 100 * np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask]))

    def summary(self) -> str:
        """Return summary of ensemble configuration."""
        summary = "Ensemble Model Configuration:\n"
        summary += "-" * 40 + "\n"
        
        for name, model in self.models.items():
            weight = self.weights.get(name, 0)
            summary += f"{name:20s}: {weight:.1%}\n"
        
        summary += "-" * 40 + "\n"
        summary += f"Total Models: {len(self.models)}\n"
        summary += f"Fitted: {self.is_fitted}\n"
        
        return summary
