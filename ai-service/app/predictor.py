"""ASL alphabet classifier (inference only): TensorFlow when available, else NumPy.

Training lives in training/train.py. This module only loads trained
artifacts and serves predictions.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import numpy as np

from app.config import settings

logger = logging.getLogger(__name__)

ASL_LABELS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")

FEATURE_DIM = 63  # 21 hand landmarks * 3 coordinates


def _softmax(x: np.ndarray) -> np.ndarray:
    shifted = x - np.max(x, axis=-1, keepdims=True)
    exp = np.exp(shifted)
    return exp / np.sum(exp, axis=-1, keepdims=True)


class NumpyClassifier:
    """Pure NumPy classifier (linear or 2-layer MLP) for environments without TensorFlow.

    Architecture is detected from which arrays are actually present in the
    ``.npz`` file rather than trusting the free-text ``architecture`` label,
    so any MLP-shaped export (mlp_v1, mlp_v2, future versions, ...) loads
    correctly as long as it was saved with the w1/b1/w2/b2 naming convention.
    """

    def __init__(self, weights_path: str, labels: list[str]) -> None:
        self.labels = labels
        data = np.load(weights_path)
        keys = set(data.files)

        self.feature_mean = data["feature_mean"] if "feature_mean" in keys else None
        self.feature_std = data["feature_std"] if "feature_std" in keys else None

        if {"w1", "b1", "w2", "b2"}.issubset(keys):
            self.kind = "mlp"
            self.w1 = data["w1"]
            self.b1 = data["b1"]
            self.w2 = data["w2"]
            self.b2 = data["b2"]
        elif {"w", "b"}.issubset(keys):
            self.kind = "linear"
            self.w = data["w"]
            self.b = data["b"]
        else:
            raise ValueError(
                f"Unrecognized weights file '{weights_path}': found keys {sorted(keys)}, "
                "expected either {w1,b1,w2,b2} (MLP) or {w,b} (linear)."
            )

        architecture_label = str(data["architecture"]) if "architecture" in keys else self.kind
        logger.info("Loaded NumPy classifier: kind=%s architecture=%s", self.kind, architecture_label)

    def normalize(self, features: np.ndarray) -> np.ndarray:
        """Apply this model's feature standardization, if it has one."""
        if features.ndim == 1:
            features = features.reshape(1, -1)
        if self.feature_mean is not None and self.feature_std is not None:
            std = self.feature_std.copy()
            std[std < 1e-6] = 1.0
            features = (features - self.feature_mean) / std
        return features

    def _logits(self, features: np.ndarray) -> np.ndarray:
        if self.kind == "mlp":
            hidden = np.maximum(features @ self.w1 + self.b1, 0.0)
            return hidden @ self.w2 + self.b2
        return features @ self.w + self.b

    def predict(self, features: np.ndarray) -> tuple[str, float]:
        features = self.normalize(features)
        probs = _softmax(self._logits(features))[0]
        idx = int(np.argmax(probs))
        confidence = float(probs[idx])
        label = self.labels[idx] if idx < len(self.labels) else "?"
        return label, confidence


class ASLClassifier:
    """ASL static hand sign classifier (TensorFlow when available, else NumPy).

    Both backends share the same feature standardization (mean/std learned
    during training), loaded from the NumPy weights file when present, so
    predictions are consistent regardless of which backend serves them.
    """

    def __init__(self, model_path: str | None = None) -> None:
        self.model_path = model_path or settings.model_path
        self.numpy_weights_path = str(Path(self.model_path).with_suffix(".npz"))
        self.labels = self._load_labels()
        self.backend: str = "none"
        self.model = None
        self.numpy_model: NumpyClassifier | None = None
        self._load_model()

    def _load_labels(self) -> list[str]:
        labels_path = Path(self.model_path).parent / "labels.json"
        if labels_path.exists():
            return json.loads(labels_path.read_text())
        return ASL_LABELS

    def _try_load_numpy(self, npz_path: Path) -> bool:
        """Attempt to load NumPy weights; returns True on success."""
        try:
            self.numpy_model = NumpyClassifier(str(npz_path), self.labels)
            return True
        except Exception as exc:
            logger.warning("Failed to load NumPy weights from %s: %s", npz_path, exc)
            self.numpy_model = None
            return False

    def _load_model(self) -> None:
        keras_path = Path(self.model_path)
        npz_path = Path(self.numpy_weights_path)

        # Load the NumPy weights first (if present) so feature_mean/feature_std
        # are available for normalization even when serving via TensorFlow.
        if npz_path.exists():
            self._try_load_numpy(npz_path)

        try:
            import tensorflow as tf

            if keras_path.exists():
                logger.info("Loading TensorFlow model from %s", keras_path)
                self.model = tf.keras.models.load_model(str(keras_path))
                self.backend = "tensorflow"
                return
        except Exception as exc:
            logger.warning("TensorFlow unavailable or load failed: %s", exc)

        if self.numpy_model is not None:
            logger.info("Using NumPy backend from %s", npz_path)
            self.backend = "numpy"
            return

        logger.error(
            "No trained model found at %s or %s. Run training/train.py before serving predictions.",
            keras_path,
            npz_path,
        )

    def predict(self, features: np.ndarray) -> tuple[str, float]:
        if self.backend == "tensorflow" and self.model is not None:
            if features.ndim == 1:
                features = features.reshape(1, -1)

            # Apply the same standardization used by the NumPy backend so both
            # backends produce consistent predictions from raw landmark features.
            if self.numpy_model is not None:
                features = self.numpy_model.normalize(features)

            probs = self.model.predict(features, verbose=0)[0]
            idx = int(np.argmax(probs))
            confidence = float(probs[idx])
            label = self.labels[idx] if idx < len(self.labels) else "?"
            return label, confidence

        if self.numpy_model is not None:
            return self.numpy_model.predict(features)

        raise RuntimeError(
            "No model backend available. Run training/train.py to produce a trained model."
        )