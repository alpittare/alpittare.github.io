"""
ARIMA(p,d,q) model implementation from scratch using numpy.
Includes differencing, AR, and MA components.
"""
import numpy as np
from typing import Tuple, Dict
import logging

logger = logging.getLogger(__name__)


class ARIMAModel:
    """
    ARIMA(p,d,q) model for time-series forecasting.
    - p: AR (autoregressive) order
    - d: differencing order for stationarity
    - q: MA (moving average) order
    """

    def __init__(self, order: Tuple[int, int, int] = (5, 1, 2)):
        """
        Initialize ARIMA model.
        
        Args:
            order: (p, d, q) tuple
        """
        self.p, self.d, self.q = order
        self.ar_coeffs = None
        self.ma_coeffs = None
        self.original_series = None
        self.differenced_series = None
        self.mean = None
        self.residuals = None
        self.is_fitted = False

    def difference(self, series: np.ndarray, order: int = 1) -> np.ndarray:
        """Apply differencing to achieve stationarity."""
        result = series.copy()
        for _ in range(order):
            result = np.diff(result)
        return result

    def inverse_difference(self, differenced: np.ndarray, original: np.ndarray, 
                          order: int = 1) -> np.ndarray:
        """Reverse differencing to get back to original scale."""
        result = differenced.copy()
        for _ in range(order):
            if len(result) == 0:
                break
            cumsum = np.concatenate(([original[-1]], result))
            result = np.cumsum(cumsum)
        return result

    def fit_ar(self, series: np.ndarray) -> np.ndarray:
        """
        Fit AR(p) model using least squares.
        y(t) = c + φ₁y(t-1) + φ₂y(t-2) + ... + φₚy(t-p) + ε(t)
        """
        if len(series) < self.p + 1:
            logger.warning("Series too short for AR fitting")
            return np.zeros(self.p)

        # Build design matrix
        X = np.ones((len(series) - self.p, self.p + 1))
        for i in range(self.p):
            X[:, i + 1] = series[self.p - i - 1:-i - 1]
        
        y = series[self.p:]

        # Least squares: (X'X)^-1 X'y
        try:
            coeffs = np.linalg.lstsq(X, y, rcond=None)[0]
            return coeffs[1:]  # Return AR coefficients (skip constant)
        except np.linalg.LinAlgError:
            logger.warning("Failed to fit AR model, using zeros")
            return np.zeros(self.p)

    def fit_ma(self, residuals: np.ndarray) -> np.ndarray:
        """
        Fit MA(q) model using residuals.
        Simplified approach: fit MA coefficients on lagged residuals.
        """
        if len(residuals) < self.q + 2:
            logger.warning("Series too short for MA fitting")
            return np.zeros(self.q)

        # Simple MA: fit residuals[t] ~ sum(theta_i * residuals[t-i])
        # We use a simplified approach without design matrix to avoid dimension issues
        ma_coeffs = np.zeros(self.q)
        
        for j in range(self.q):
            if j + 1 < len(residuals):
                # Lagged correlation as MA coefficient estimate
                ma_coeffs[j] = np.corrcoef(residuals[:-j-1], residuals[j+1:])[0, 1]
            else:
                ma_coeffs[j] = 0
        
        # Handle NaN from corrcoef
        ma_coeffs = np.nan_to_num(ma_coeffs, nan=0.0)
        
        return ma_coeffs

    def fit(self, series: np.ndarray) -> 'ARIMAModel':
        """
        Fit ARIMA model to time series.
        
        Args:
            series: 1D array of observations
        
        Returns:
            self
        """
        self.original_series = series.copy()
        
        # Step 1: Apply differencing
        self.differenced_series = self.difference(series, self.d)
        
        # Step 2: Fit AR component
        self.ar_coeffs = self.fit_ar(self.differenced_series)
        
        # Step 3: Calculate residuals for MA fitting
        ar_fitted = self._apply_ar(self.differenced_series, self.ar_coeffs)
        self.residuals = self.differenced_series[self.p:] - ar_fitted
        
        # Step 4: Fit MA component
        self.ma_coeffs = self.fit_ma(self.residuals)
        
        self.mean = np.mean(self.differenced_series[self.p:])
        self.is_fitted = True
        
        logger.info(f"ARIMA{(self.p, self.d, self.q)} fitted successfully")
        return self

    def _apply_ar(self, series: np.ndarray, coeffs: np.ndarray) -> np.ndarray:
        """Apply AR model to get fitted values."""
        fitted = []
        for t in range(self.p, len(series)):
            pred = np.sum(coeffs * series[t - self.p:t][::-1])
            fitted.append(pred)
        return np.array(fitted)

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
        
        # Start with last differenced values
        last_values = self.differenced_series[-self.p:].copy()
        last_residuals = self.residuals[-self.q:].copy() if self.residuals is not None else np.zeros(self.q)
        
        for _ in range(steps):
            # AR component: φ₁y(t-1) + ... + φₚy(t-p)
            ar_part = np.sum(self.ar_coeffs * last_values[::-1])
            
            # MA component: θ₁ε(t-1) + ... + θqε(t-q)
            ma_part = np.sum(self.ma_coeffs * last_residuals[::-1]) if self.q > 0 else 0
            
            # Forecast
            forecast_diff = ar_part + ma_part + self.mean
            forecasts.append(forecast_diff)
            
            # Update lags
            last_values = np.roll(last_values, -1)
            last_values[-1] = forecast_diff
            
            last_residuals = np.roll(last_residuals, -1)
            last_residuals[-1] = 0  # Future residual unknown
        
        # Inverse differencing to get back to original scale
        forecast_array = np.array(forecasts)
        if self.d > 0:
            # Use last original value as anchor
            forecast_original = np.concatenate(([self.original_series[-1]], forecast_array))
            forecast_original = np.cumsum(forecast_original)
            forecast_values = forecast_original[1:]
        else:
            forecast_values = forecast_array
        
        result = {
            "forecast": forecast_values,
            "steps": steps
        }
        
        if include_confidence:
            # Confidence intervals: ± 1.96 * std(residuals)
            residual_std = np.std(self.residuals) if self.residuals is not None else 1.0
            ci_width = 1.96 * residual_std * np.sqrt(np.arange(1, steps + 1))
            result["lower_bound"] = forecast_values - ci_width
            result["upper_bound"] = forecast_values + ci_width
        
        return result

    def get_residuals(self) -> np.ndarray:
        """Return model residuals."""
        return self.residuals

    def rmse(self, actual: np.ndarray, predicted: np.ndarray) -> float:
        """Calculate RMSE."""
        return np.sqrt(np.mean((actual - predicted) ** 2))

    def mae(self, actual: np.ndarray, predicted: np.ndarray) -> float:
        """Calculate MAE."""
        return np.mean(np.abs(actual - predicted))

    def mape(self, actual: np.ndarray, predicted: np.ndarray) -> float:
        """Calculate MAPE (%)."""
        mask = actual != 0
        return 100 * np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask]))
