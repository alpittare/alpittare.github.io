"""
Autoencoder for Anomaly Detection - Pure NumPy Implementation
Simple 3-layer autoencoder with backpropagation
"""

import numpy as np
from typing import Tuple, Optional


class Autoencoder:
    """Simple autoencoder for anomaly detection"""

    def __init__(self, input_dim: int = 7, hidden_dim: int = 4, latent_dim: int = 2,
                 learning_rate: float = 0.01, random_state: Optional[int] = None):
        """
        Initialize autoencoder

        Args:
            input_dim: Input dimension
            hidden_dim: Hidden layer dimension
            latent_dim: Latent space dimension
            learning_rate: Learning rate for SGD
            random_state: Random seed
        """
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.latent_dim = latent_dim
        self.learning_rate = learning_rate
        self.rng = np.random.RandomState(random_state)

        # Initialize weights with Xavier initialization
        self.W1 = self.rng.randn(input_dim, hidden_dim) * np.sqrt(2.0 / input_dim)
        self.b1 = np.zeros((1, hidden_dim))

        self.W2 = self.rng.randn(hidden_dim, latent_dim) * np.sqrt(2.0 / hidden_dim)
        self.b2 = np.zeros((1, latent_dim))

        # Decoder weights (transposed for reconstruction)
        self.W3 = self.rng.randn(latent_dim, hidden_dim) * np.sqrt(2.0 / latent_dim)
        self.b3 = np.zeros((1, hidden_dim))

        self.W4 = self.rng.randn(hidden_dim, input_dim) * np.sqrt(2.0 / hidden_dim)
        self.b4 = np.zeros((1, input_dim))

        self.reconstruction_errors = []

    def relu(self, x: np.ndarray) -> np.ndarray:
        """ReLU activation"""
        return np.maximum(0, x)

    def relu_derivative(self, x: np.ndarray) -> np.ndarray:
        """ReLU derivative"""
        return (x > 0).astype(float)

    def sigmoid(self, x: np.ndarray) -> np.ndarray:
        """Sigmoid activation"""
        return 1 / (1 + np.exp(-np.clip(x, -500, 500)))

    def forward(self, X: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """Forward pass"""
        # Encoder
        h1 = np.dot(X, self.W1) + self.b1
        a1 = self.relu(h1)

        h2 = np.dot(a1, self.W2) + self.b2
        z = self.sigmoid(h2)  # Latent representation

        # Decoder
        h3 = np.dot(z, self.W3) + self.b3
        a3 = self.relu(h3)

        h4 = np.dot(a3, self.W4) + self.b4
        output = self.sigmoid(h4)  # Reconstructed output

        return output, z, a1, a3

    def backward(self, X: np.ndarray, output: np.ndarray, z: np.ndarray,
                 a1: np.ndarray, a3: np.ndarray, batch_size: int) -> None:
        """Backward pass with gradient descent"""

        # Loss: MSE
        output_error = output - X
        loss = np.mean(output_error ** 2)

        # Decoder gradients
        dW4 = np.dot(a3.T, output_error * output * (1 - output)) / batch_size
        db4 = np.mean(output_error * output * (1 - output), axis=0, keepdims=True)

        dh3 = np.dot(output_error * output * (1 - output), self.W4.T)
        da3 = dh3 * self.relu_derivative(a3)

        dW3 = np.dot(z.T, da3) / batch_size
        db3 = np.mean(da3, axis=0, keepdims=True)

        # Bottleneck gradients
        dz = np.dot(da3, self.W3.T)
        dh2 = dz * z * (1 - z)

        dW2 = np.dot(a1.T, dh2) / batch_size
        db2 = np.mean(dh2, axis=0, keepdims=True)

        # Encoder gradients
        dh1 = np.dot(dh2, self.W2.T)
        da1 = dh1 * self.relu_derivative(a1)

        dW1 = np.dot(X.T, da1) / batch_size
        db1 = np.mean(da1, axis=0, keepdims=True)

        # Update weights
        self.W1 -= self.learning_rate * dW1
        self.b1 -= self.learning_rate * db1

        self.W2 -= self.learning_rate * dW2
        self.b2 -= self.learning_rate * db2

        self.W3 -= self.learning_rate * dW3
        self.b3 -= self.learning_rate * db3

        self.W4 -= self.learning_rate * dW4
        self.b4 -= self.learning_rate * db4

        return loss

    def fit(self, X: np.ndarray, epochs: int = 50, batch_size: int = 32) -> None:
        """Train the autoencoder"""
        n_samples = X.shape[0]

        for epoch in range(epochs):
            # Shuffle data
            indices = self.rng.permutation(n_samples)
            X_shuffled = X[indices]

            epoch_loss = 0
            n_batches = 0

            # Mini-batch training
            for i in range(0, n_samples, batch_size):
                X_batch = X_shuffled[i:i + batch_size]

                output, z, a1, a3 = self.forward(X_batch)
                loss = self.backward(X_batch, output, z, a1, a3, X_batch.shape[0])

                epoch_loss += loss
                n_batches += 1

            epoch_loss /= n_batches
            self.reconstruction_errors.append(epoch_loss)

    def encode(self, X: np.ndarray) -> np.ndarray:
        """Get latent representation"""
        h1 = np.dot(X, self.W1) + self.b1
        a1 = self.relu(h1)
        h2 = np.dot(a1, self.W2) + self.b2
        z = self.sigmoid(h2)
        return z

    def decode(self, z: np.ndarray) -> np.ndarray:
        """Reconstruct from latent representation"""
        h3 = np.dot(z, self.W3) + self.b3
        a3 = self.relu(h3)
        h4 = np.dot(a3, self.W4) + self.b4
        output = self.sigmoid(h4)
        return output

    def predict_reconstruction_error(self, X: np.ndarray) -> np.ndarray:
        """Get reconstruction error for each sample"""
        output, _, _, _ = self.forward(X)
        errors = np.mean((output - X) ** 2, axis=1)
        return errors

    def predict(self, X: np.ndarray, threshold: Optional[float] = None) -> np.ndarray:
        """Predict anomalies based on reconstruction error"""
        errors = self.predict_reconstruction_error(X)

        if threshold is None:
            # Use mean + 2*std as threshold
            threshold = np.mean(errors) + 2 * np.std(errors)

        return (errors > threshold).astype(int), errors
