"""
Multi-feature linear regression with gradient descent and L2 regularization.
"""
import numpy as np
from typing import Dict, Tuple
import logging

logger = logging.getLogger(__name__)


class LinearRegressionModel:
    """
    Linear regression with gradient descent optimization.
    Features: hour_of_day, day_of_week, is_business_hours, lag_1h, lag_24h, 
              rolling_mean_24h, trend, seasonality
    """

    def __init__(self, learning_rate: float = 0.01, iterations: int = 1000, 
                 l2_lambda: float = 0.001):
        """
        Initialize linear regression model.
        
        Args:
            learning_rate: Step size for gradient descent
            iterations: Number of training iterations
            l2_lambda: L2 regularization parameter
        """
        self.learning_rate = learning_rate
        self.iterations = iterations
        self.l2_lambda = l2_lambda
        
        self.weights = None
        self.bias = None
        self.feature_means = None
        self.feature_stds = None
        self.is_fitted = False
        self.loss_history = []

    def _create_features(self, series: np.ndarray, timestamps: np.ndarray = None) -> np.ndarray:
        """
        Engineer features from time series.
        
        Args:
            series: 1D array of observations
            timestamps: Optional array of timestamps (unix)
        
        Returns:
            Feature matrix (n_samples, n_features)
        """
        n = len(series)
        features = []
        
        # Lag features
        lag_1h_idx = 12  # 1 hour = 12 * 5-min intervals
        lag_24h_idx = 288  # 24 hours * 12
        
        lag_1h = np.zeros(n)
        lag_24h = np.zeros(n)
        
        for i in range(n):
            if i >= lag_1h_idx:
                lag_1h[i] = series[i - lag_1h_idx]
            if i >= lag_24h_idx:
                lag_24h[i] = series[i - lag_24h_idx]
        
        # Rolling mean (24-hour window)
        rolling_mean_24h = np.zeros(n)
        for i in range(n):
            start_idx = max(0, i - lag_24h_idx)
            rolling_mean_24h[i] = np.mean(series[start_idx:i+1])
        
        # Trend: linear regression on time index
        t = np.arange(n)
        A = np.column_stack([np.ones(n), t])
        trend_coeffs = np.linalg.lstsq(A, series, rcond=None)[0]
        trend = trend_coeffs[0] + trend_coeffs[1] * t
        
        # Seasonal component (daily pattern)
        seasonal = np.zeros(n)
        daily_cycle = 288  # 5-min intervals per day
        for i in range(daily_cycle):
            indices = np.arange(i, n, daily_cycle)
            if len(indices) > 0:
                seasonal[indices] = np.mean(series[indices])
        seasonal = seasonal - np.mean(seasonal)
        
        # Hour of day (0-287 in 5-min intervals)
        hour_of_day = np.arange(n) % 288
        
        # Day of week (0-6)
        day_of_week = (np.arange(n) // 288) % 7
        
        # Is business hours (8-18 on weekdays)
        is_business_hours = np.zeros(n)
        for i in range(n):
            hour = (i % 288) // 12  # Convert 5-min interval to hour
            dow = (i // 288) % 7
            if 8 <= hour < 18 and dow < 5:
                is_business_hours[i] = 1
        
        # Stack all features
        X = np.column_stack([
            hour_of_day / 288,  # Normalize
            day_of_week / 7,
            is_business_hours,
            lag_1h,
            lag_24h,
            rolling_mean_24h,
            trend,
            seasonal
        ])
        
        return X

    def _normalize_features(self, X: np.ndarray, fit: bool = True) -> np.ndarray:
        """Normalize features using z-score."""
        if fit:
            self.feature_means = np.mean(X, axis=0)
            self.feature_stds = np.std(X, axis=0) + 1e-10
        
        return (X - self.feature_means) / self.feature_stds

    def fit(self, series: np.ndarray, timestamps: np.ndarray = None) -> 'LinearRegressionModel':
        """
        Fit linear regression model.
        
        Args:
            series: 1D array of observations
            timestamps: Optional array of timestamps
        
        Returns:
            self
        """
        # Create features
        X = self._create_features(series, timestamps)
        y = series.copy()
        
        # Normalize features
        X_norm = self._normalize_features(X, fit=True)
        
        # Initialize weights
        n_features = X_norm.shape[1]
        self.weights = np.zeros(n_features)
        self.bias = 0
        
        # Gradient descent optimization
        m = len(y)
        
        for iteration in range(self.iterations):
            # Forward pass
            y_pred = X_norm @ self.weights + self.bias
            
            # Calculate loss (MSE + L2 regularization)
            mse_loss = np.mean((y_pred - y) ** 2)
            l2_loss = self.l2_lambda * np.sum(self.weights ** 2)
            total_loss = mse_loss + l2_loss
            self.loss_history.append(total_loss)
            
            # Backward pass (gradients)
            dw = (2 / m) * (X_norm.T @ (y_pred - y)) + 2 * self.l2_lambda * self.weights
            db = (2 / m) * np.sum(y_pred - y)
            
            # Update weights
            self.weights -= self.learning_rate * dw
            self.bias -= self.learning_rate * db
            
            if (iteration + 1) % 100 == 0:
                logger.debug(f"Iteration {iteration + 1}, Loss: {total_loss:.4f}")
        
        self.is_fitted = True
        logger.info("Linear regression model fitted successfully")
        return self

    def predict(self, series: np.ndarray, steps: int = 1, 
                include_confidence: bool = False) -> Dict:
        """
        Forecast future values.
        
        Args:
            series: Historical time series for feature extraction
            steps: Number of steps ahead to forecast
            include_confidence: Include confidence intervals
        
        Returns:
            Dictionary with forecast and optionally confidence bounds
        """
        if not self.is_fitted:
            raise ValueError("Model must be fitted before prediction")
        
        # Create features for full series (for recent lags)
        X_full = self._create_features(series)
        X_norm_full = self._normalize_features(X_full, fit=False)
        
        # Get recent feature values for extrapolation
        recent_values = X_norm_full[-1, :].copy()
        
        forecasts = []
        
        for h in range(steps):
            # Predict
            pred = recent_values @ self.weights + self.bias
            forecasts.append(max(0, pred))  # Ensure non-negative
            
            # Update features for next step (simple approach: use trend)
            recent_values[-2] += 0.001  # Slight trend adjustment
        
        forecast_array = np.array(forecasts)
        
        result = {
            "forecast": forecast_array,
            "steps": steps
        }
        
        if include_confidence:
            # Estimate residuals
            y_pred_train = X_norm_full @ self.weights + self.bias
            residuals = series - y_pred_train
            residual_std = np.std(residuals)
            ci_width = 1.96 * residual_std * np.sqrt(np.arange(1, steps + 1))
            result["lower_bound"] = np.maximum(0, forecast_array - ci_width)
            result["upper_bound"] = forecast_array + ci_width
        
        return result

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
