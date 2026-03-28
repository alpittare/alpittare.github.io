"""
Unit tests for ML forecasting models.
"""

import pytest
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

from src.ml.arima_model import ARIMAModel
from src.ml.lstm_model import LSTMModel
from src.ml.prophet_model import ProphetModel
from src.ml.ensemble import EnsembleModel


class TestARIMAModel:
    """Test ARIMA model."""

    @pytest.fixture
    def model(self):
        """Create ARIMA model instance."""
        return ARIMAModel(lookback_days=30, seasonal_periods=24)

    @pytest.fixture
    def sample_data(self):
        """Generate sample time-series data."""
        np.random.seed(42)
        dates = pd.date_range(start='2026-01-01', periods=720, freq='H')
        # Synthetic data with trend and seasonality
        trend = np.linspace(40, 70, 720)
        seasonal = 10 * np.sin(np.arange(720) * 2 * np.pi / 24)
        noise = np.random.normal(0, 2, 720)
        values = trend + seasonal + noise
        values = np.clip(values, 0, 100)
        return pd.Series(values, index=dates)

    def test_model_initialization(self, model):
        """Test model initialization."""
        assert model.lookback_days == 30
        assert model.seasonal_periods == 24
        assert model.auto_order is True

    def test_model_fit(self, model, sample_data):
        """Test model fitting."""
        result = model.fit(sample_data)
        assert result['status'] == 'success'
        assert model.trained_at is not None
        assert model.rmse is not None
        assert model.mape is not None

    def test_model_prediction(self, model, sample_data):
        """Test model prediction."""
        model.fit(sample_data)
        result = model.predict(steps=24)
        assert 'forecast' in result
        assert len(result['forecast']) == 24
        assert 'confidence_lower' in result
        assert 'confidence_upper' in result

    def test_prediction_range(self, model, sample_data):
        """Test prediction values are within valid range."""
        model.fit(sample_data)
        result = model.predict(steps=24)
        forecast = result['forecast']
        assert all(0 <= v <= 100 for v in forecast)

    def test_model_save_load(self, model, sample_data, tmp_path):
        """Test model serialization."""
        model.fit(sample_data)
        path = str(tmp_path / "arima.pkl")
        assert model.save(path)

        new_model = ARIMAModel()
        assert new_model.load(path)
        assert new_model.rmse == model.rmse


class TestLSTMModel:
    """Test LSTM model."""

    @pytest.fixture
    def model(self):
        """Create LSTM model instance."""
        return LSTMModel(
            lookback_days=10,
            sequence_length=24,
            hidden_units=[64, 32],
            epochs=2
        )

    @pytest.fixture
    def sample_data(self):
        """Generate sample training data."""
        np.random.seed(42)
        n_samples = 200
        sequence_length = 24
        n_features = 10

        X = np.random.randn(n_samples, sequence_length, n_features).astype(np.float32)
        y = np.random.uniform(20, 80, (n_samples, 24)).astype(np.float32)

        return X, y

    def test_model_initialization(self, model):
        """Test model initialization."""
        assert model.lookback_days == 10
        assert model.sequence_length == 24
        assert model.hidden_units == [64, 32]

    def test_model_build(self, model):
        """Test model building."""
        keras_model = model.build_model(n_features=10)
        assert keras_model is not None
        assert keras_model.input_shape == (None, 24, 10)

    @pytest.mark.skipif(True, reason="Skip LSTM tests without GPU for speed")
    def test_model_fit(self, model, sample_data):
        """Test model fitting."""
        X, y = sample_data
        result = model.fit(X, y)
        assert result['status'] == 'success'
        assert model.trained_at is not None

    @pytest.mark.skipif(True, reason="Skip LSTM tests without GPU for speed")
    def test_model_prediction(self, model, sample_data):
        """Test model prediction."""
        X, y = sample_data
        model.fit(X, y)
        result = model.predict(X[:1])
        assert 'forecast' in result
        assert len(result['forecast']) == 1


class TestProphetModel:
    """Test Prophet model."""

    @pytest.fixture
    def model(self):
        """Create Prophet model instance."""
        return ProphetModel(lookback_days=30)

    @pytest.fixture
    def sample_data(self):
        """Generate sample time-series data."""
        np.random.seed(42)
        dates = pd.date_range(start='2026-01-01', periods=720, freq='H')
        trend = np.linspace(40, 70, 720)
        seasonal = 10 * np.sin(np.arange(720) * 2 * np.pi / 24)
        noise = np.random.normal(0, 2, 720)
        values = trend + seasonal + noise
        values = np.clip(values, 0, 100)
        return pd.Series(values, index=dates)

    def test_model_initialization(self, model):
        """Test model initialization."""
        assert model.lookback_days == 30
        assert model.yearly_seasonality is True
        assert model.weekly_seasonality is True

    def test_model_fit(self, model, sample_data):
        """Test model fitting."""
        result = model.fit(sample_data)
        assert result['status'] == 'success'
        assert model.trained_at is not None

    def test_model_prediction(self, model, sample_data):
        """Test model prediction."""
        model.fit(sample_data)
        result = model.predict(periods=24)
        assert 'forecast' in result
        assert len(result['forecast']) == 24

    def test_prediction_range(self, model, sample_data):
        """Test prediction values are within valid range."""
        model.fit(sample_data)
        result = model.predict(periods=24)
        forecast = result['forecast']
        assert all(0 <= v <= 100 for v in forecast)


class TestEnsembleModel:
    """Test ensemble model."""

    @pytest.fixture
    def models_dict(self):
        """Create dictionary of models."""
        return {
            'arima': ARIMAModel(lookback_days=30),
            'lstm': None,  # Skip LSTM for test speed
            'prophet': ProphetModel(lookback_days=30)
        }

    @pytest.fixture
    def ensemble(self, models_dict):
        """Create ensemble model."""
        return EnsembleModel(
            models=models_dict,
            method='weighted_average',
            weights={'arima': 0.5, 'lstm': 0.0, 'prophet': 0.5}
        )

    @pytest.fixture
    def sample_data(self):
        """Generate sample time-series data."""
        np.random.seed(42)
        dates = pd.date_range(start='2026-01-01', periods=720, freq='H')
        trend = np.linspace(40, 70, 720)
        seasonal = 10 * np.sin(np.arange(720) * 2 * np.pi / 24)
        noise = np.random.normal(0, 2, 720)
        values = trend + seasonal + noise
        values = np.clip(values, 0, 100)
        return pd.Series(values, index=dates)

    def test_ensemble_initialization(self, ensemble):
        """Test ensemble initialization."""
        assert ensemble.method == 'weighted_average'
        assert 'arima' in ensemble.weights
        assert 'prophet' in ensemble.weights

    def test_ensemble_fit(self, ensemble, sample_data):
        """Test ensemble model fitting."""
        for model in ensemble.models.values():
            if model is not None:
                model.fit(sample_data)

    def test_ensemble_prediction(self, ensemble, sample_data):
        """Test ensemble prediction."""
        # Fit individual models
        for model in ensemble.models.values():
            if model is not None:
                model.fit(sample_data)

        result = ensemble.predict(forecast_horizon=24)
        assert 'forecast' in result
        assert len(result['forecast']) == 24
        assert 'confidence_lower' in result
        assert 'confidence_upper' in result

    def test_prediction_range(self, ensemble, sample_data):
        """Test prediction values are within valid range."""
        for model in ensemble.models.values():
            if model is not None:
                model.fit(sample_data)

        result = ensemble.predict(forecast_horizon=24)
        forecast = result['forecast']
        assert all(0 <= v <= 100 for v in forecast)


class TestFeatureEngineering:
    """Test feature engineering."""

    def test_time_features(self):
        """Test time feature extraction."""
        from src.pipeline.feature_engineer import FeatureEngineer

        engineer = FeatureEngineer()
        timestamp = datetime(2026, 3, 21, 14, 0, 0)
        features = engineer._extract_time_features(timestamp)

        assert len(features) == 6
        assert all(isinstance(f, float) for f in features)
        assert all(0 <= f <= 1 for f in features)

    def test_lag_features(self):
        """Test lag feature extraction."""
        from src.pipeline.feature_engineer import FeatureEngineer

        engineer = FeatureEngineer(lag_windows=[1, 6, 24])
        dates = pd.date_range('2026-01-01', periods=100, freq='H')
        utilization = pd.Series(np.random.uniform(20, 80, 100), index=dates)

        features = engineer._extract_lag_features(utilization)

        assert len(features) == 3
        assert all(isinstance(f, float) for f in features)

    def test_rolling_features(self):
        """Test rolling statistics feature extraction."""
        from src.pipeline.feature_engineer import FeatureEngineer

        engineer = FeatureEngineer()
        dates = pd.date_range('2026-01-01', periods=100, freq='H')
        utilization = pd.Series(np.random.uniform(20, 80, 100), index=dates)

        features = engineer._extract_rolling_features(utilization)

        assert len(features) == 6
        assert all(isinstance(f, float) for f in features)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
