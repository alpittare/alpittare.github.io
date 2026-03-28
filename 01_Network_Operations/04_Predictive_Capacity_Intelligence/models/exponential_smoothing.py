"""
Holt-Winters Triple Exponential Smoothing implementation from scratch.
Supports additive and multiplicative seasonality.
"""
import numpy as np
from typing import Dict
import logging

logger = logging.getLogger(__name__)


class HoltWintersModel:
    """
    Triple exponential smoothing (Holt-Winters) for forecasting.
    Combines level, trend, and seasonal components.
    """

    def __init__(self, seasonal_period: int = 288, alpha: float = 0.1, 
                 beta: float = 0.05, gamma: float = 0.1, 
                 seasonal_type: str = "additive"):
        """
        Initialize Holt-Winters model.
        
        Args:
            seasonal_period: Number of observations per season
            alpha: Level smoothing factor (0-1)
            beta: Trend smoothing factor (0-1)
            gamma: Seasonal smoothing factor (0-1)
            seasonal_type: 'additive' or 'multiplicative'
        """
        self.seasonal_period = seasonal_period
        self.alpha = alpha
        self.beta = beta
        self.gamma = gamma
        self.seasonal_type = seasonal_type
        
        self.level = None
        self.trend = None
        self.seasonal = None
        self.original_series = None
        self.is_fitted = False

    def _init_components(self, series: np.ndarray):
        """Initialize level, trend, and seasonal components."""
        # Initial level: average of first season
        self.level = np.mean(series[:self.seasonal_period])
        
        # Initial trend: slope between first and second season
        first_season = np.mean(series[:self.seasonal_period])
        second_season = np.mean(series[self.seasonal_period:2*self.seasonal_period]) \
            if len(series) >= 2*self.seasonal_period else first_season
        self.trend = (second_season - first_season) / self.seasonal_period
        
        # Initial seasonal indices
        self.seasonal = np.zeros(self.seasonal_period)
        
        for i in range(self.seasonal_period):
            if self.seasonal_type == "additive":
                # Seasonal = value - level
                indices = np.arange(i, len(series), self.seasonal_period)
                if len(indices) > 0:
                    self.seasonal[i] = np.mean(series[indices] - self.level)
            else:
                # Seasonal = value / level
                indices = np.arange(i, len(series), self.seasonal_period)
                if len(indices) > 0 and self.level != 0:
                    self.seasonal[i] = np.mean(series[indices] / (self.level + 1e-10))

    def fit(self, series: np.ndarray) -> 'HoltWintersModel':
        """
        Fit Holt-Winters model to time series.
        
        Args:
            series: 1D array of observations
        
        Returns:
            self
        """
        self.original_series = series.copy()
        
        if len(series) < 2 * self.seasonal_period:
            logger.warning(f"Series length {len(series)} < 2*seasonal_period {2*self.seasonal_period}")
        
        self._init_components(series)
        
        # Fit components using exponential smoothing updates
        level = self.level
        trend = self.trend
        seasonal = self.seasonal.copy()
        
        for t in range(len(series)):
            season_idx = t % self.seasonal_period
            y_t = series[t]
            
            if self.seasonal_type == "additive":
                # Update level
                level_new = self.alpha * (y_t - seasonal[season_idx]) + \
                            (1 - self.alpha) * (level + trend)
                
                # Update trend
                trend_new = self.beta * (level_new - level) + (1 - self.beta) * trend
                
                # Update seasonal
                seasonal[season_idx] = self.gamma * (y_t - level_new) + \
                                      (1 - self.gamma) * seasonal[season_idx]
            else:
                # Multiplicative seasonality
                season_val = seasonal[season_idx] if seasonal[season_idx] != 0 else 1
                
                # Update level
                level_new = self.alpha * (y_t / (season_val + 1e-10)) + \
                            (1 - self.alpha) * (level + trend)
                
                # Update trend
                trend_new = self.beta * (level_new - level) + (1 - self.beta) * trend
                
                # Update seasonal
                seasonal[season_idx] = self.gamma * (y_t / (level_new + 1e-10)) + \
                                      (1 - self.gamma) * seasonal[season_idx]
            
            level = level_new
            trend = trend_new
        
        self.level = level
        self.trend = trend
        self.seasonal = seasonal
        self.is_fitted = True
        
        logger.info("Holt-Winters model fitted successfully")
        return self

    def predict(self, steps: int = 1, include_confidence: bool = False) -> Dict:
        """
        Forecast future values.
        
        Args:
            steps: Number of steps ahead to forecast
            include_confidence: Include confidence intervals
        
        Returns:
            Dictionary with forecast and optionally confidence bounds
        """
        if not self.is_fitted:
            raise ValueError("Model must be fitted before prediction")

        forecasts = []
        
        for h in range(1, steps + 1):
            season_idx = (len(self.original_series) + h - 1) % self.seasonal_period
            
            if self.seasonal_type == "additive":
                # ŷ(t+h) = (l(t) + h*b(t)) + s(t+h-m)
                forecast = (self.level + h * self.trend) + self.seasonal[season_idx]
            else:
                # ŷ(t+h) = (l(t) + h*b(t)) * s(t+h-m)
                forecast = (self.level + h * self.trend) * (self.seasonal[season_idx] + 1e-10)
            
            forecasts.append(max(0, forecast))  # Ensure non-negative
        
        forecast_array = np.array(forecasts)
        
        result = {
            "forecast": forecast_array,
            "steps": steps
        }
        
        if include_confidence:
            # Approximate confidence intervals
            residuals = self.original_series - self._fitted_values()
            residual_std = np.std(residuals)
            ci_width = 1.96 * residual_std * np.sqrt(np.arange(1, steps + 1))
            result["lower_bound"] = np.maximum(0, forecast_array - ci_width)
            result["upper_bound"] = forecast_array + ci_width
        
        return result

    def _fitted_values(self) -> np.ndarray:
        """Calculate fitted values for the training period."""
        fitted = np.zeros(len(self.original_series))
        level = self.level
        trend = self.trend
        seasonal = self.seasonal.copy()
        
        # Re-fit to get fitted values
        self._init_components(self.original_series)
        level = self.level
        trend = self.trend
        seasonal = self.seasonal.copy()
        
        for t in range(len(self.original_series)):
            season_idx = t % self.seasonal_period
            
            if self.seasonal_type == "additive":
                fitted[t] = (level + trend) + seasonal[season_idx]
            else:
                fitted[t] = (level + trend) * seasonal[season_idx]
            
            y_t = self.original_series[t]
            
            if self.seasonal_type == "additive":
                level_new = self.alpha * (y_t - seasonal[season_idx]) + \
                            (1 - self.alpha) * (level + trend)
                trend_new = self.beta * (level_new - level) + (1 - self.beta) * trend
                seasonal[season_idx] = self.gamma * (y_t - level_new) + \
                                      (1 - self.gamma) * seasonal[season_idx]
            else:
                season_val = seasonal[season_idx] if seasonal[season_idx] != 0 else 1
                level_new = self.alpha * (y_t / (season_val + 1e-10)) + \
                            (1 - self.alpha) * (level + trend)
                trend_new = self.beta * (level_new - level) + (1 - self.beta) * trend
                seasonal[season_idx] = self.gamma * (y_t / (level_new + 1e-10)) + \
                                      (1 - self.gamma) * seasonal[season_idx]
            
            level = level_new
            trend = trend_new
        
        return fitted

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
