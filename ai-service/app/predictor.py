"""ASL alphabet classifier with TensorFlow or NumPy fallback."""

from __future__ import annotations

import json
import logging
from pathlib import Path

import numpy as np

from app.config import settings

logger = logging.getLogger(__name__)

ASL_LABELS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")


def _softmax(x: np.ndarray) -> np.ndarray:
  shifted = x - np.max(x, axis=-1, keepdims=True)
  exp = np.exp(shifted)
  return exp / np.sum(exp, axis=-1, keepdims=True)


class NumpyClassifier:
  """Pure NumPy classifier (linear or 2-layer MLP) for environments without TensorFlow."""

  def __init__(self, weights_path: str, labels: list[str]) -> None:
    self.labels = labels
    data = np.load(weights_path)
    self.architecture = str(data["architecture"]) if "architecture" in data else "linear"

    if self.architecture == "mlp_v1":
      self.w1 = data["w1"]
      self.b1 = data["b1"]
      self.w2 = data["w2"]
      self.b2 = data["b2"]
      self.feature_mean = data["feature_mean"]
      self.feature_std = data["feature_std"]
      self.w = None
      self.b = None
    else:
      self.w = data["w"]
      self.b = data["b"]
      self.w1 = None
      self.b1 = None
      self.w2 = None
      self.b2 = None
      self.feature_mean = data["feature_mean"] if "feature_mean" in data else None
      self.feature_std = data["feature_std"] if "feature_std" in data else None

  def _prepare_features(self, features: np.ndarray) -> np.ndarray:
    if features.ndim == 1:
      features = features.reshape(1, -1)
    if self.feature_mean is not None and self.feature_std is not None:
      std = self.feature_std.copy()
      std[std < 1e-6] = 1.0
      features = (features - self.feature_mean) / std
    return features

  def predict(self, features: np.ndarray) -> tuple[str, float]:
    features = self._prepare_features(features)

    if self.architecture == "mlp_v1" and self.w1 is not None:
      hidden = np.maximum(features @ self.w1 + self.b1, 0.0)
      logits = hidden @ self.w2 + self.b2
      probs = _softmax(logits)[0]
    else:
      logits = features @ self.w + self.b
      probs = _softmax(logits)[0]

    idx = int(np.argmax(probs))
    confidence = float(probs[idx])
    label = self.labels[idx] if idx < len(self.labels) else "?"
    return label, confidence


class ASLClassifier:
  """ASL static hand sign classifier (TensorFlow when available, else NumPy)."""

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

  def _build_tf_model(self):
    import tensorflow as tf

    model = tf.keras.Sequential(
      [
        tf.keras.layers.Input(shape=(63,)),
        tf.keras.layers.Dense(128, activation="relu"),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(64, activation="relu"),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(len(self.labels), activation="softmax"),
      ]
    )
    model.compile(
      optimizer="adam",
      loss="sparse_categorical_crossentropy",
      metrics=["accuracy"],
    )
    return model

  def _save_numpy_weights(self, centroids: np.ndarray) -> None:
    npz_path = Path(self.numpy_weights_path)
    npz_path.parent.mkdir(parents=True, exist_ok=True)
    w = centroids.T.astype(np.float32)
    b = np.zeros(len(self.labels), dtype=np.float32)
    np.savez(npz_path, w=w, b=b)
    self.numpy_model = NumpyClassifier(str(npz_path), self.labels)
    self.backend = "numpy"

  def _load_model(self) -> None:
    keras_path = Path(self.model_path)
    npz_path = Path(self.numpy_weights_path)

    try:
      import tensorflow as tf

      if keras_path.exists():
        logger.info("Loading TensorFlow model from %s", keras_path)
        self.model = tf.keras.models.load_model(str(keras_path))
        self.backend = "tensorflow"
        if npz_path.exists():
          self.numpy_model = NumpyClassifier(str(npz_path), self.labels)
        return
    except Exception as exc:
      logger.warning("TensorFlow unavailable or load failed: %s", exc)

    if npz_path.exists():
      logger.info("Loading NumPy weights from %s", npz_path)
      self.numpy_model = NumpyClassifier(str(npz_path), self.labels)
      self.backend = "numpy"
      return

    logger.warning("No trained model found; creating default NumPy weights")
    rng = np.random.default_rng(42)
    centroids = rng.normal(0, 0.1, size=(len(self.labels), 63)).astype(np.float32)
    self._save_numpy_weights(centroids)

  def predict(self, features: np.ndarray) -> tuple[str, float]:
    if self.backend == "tensorflow" and self.model is not None:
      if features.ndim == 1:
        features = features.reshape(1, -1)
      probs = self.model.predict(features, verbose=0)[0]
      idx = int(np.argmax(probs))
      confidence = float(probs[idx])
      label = self.labels[idx] if idx < len(self.labels) else "?"
      return label, confidence

    if self.numpy_model is not None:
      return self.numpy_model.predict(features)

    raise RuntimeError("No model backend available")

  def train(self, X: np.ndarray, y: np.ndarray, epochs: int = 50) -> dict:
    metrics: dict[str, float | str] = {}

    try:
      import tensorflow as tf

      if self.model is None:
        self.model = self._build_tf_model()

      history = self.model.fit(
        X,
        y,
        epochs=epochs,
        batch_size=32,
        validation_split=0.2,
        verbose=1,
      )
      Path(self.model_path).parent.mkdir(parents=True, exist_ok=True)
      self.model.save(self.model_path)
      self.backend = "tensorflow"
      metrics["final_accuracy"] = float(history.history["accuracy"][-1])
      metrics["final_val_accuracy"] = float(history.history["val_accuracy"][-1])
      metrics["backend"] = "tensorflow"
      self._export_numpy_from_tensorflow()
    except Exception as exc:
      logger.warning("TensorFlow training failed, using NumPy trainer: %s", exc)
      metrics = self._train_numpy_with_metrics(X, y)

    return metrics

  def _train_numpy_with_metrics(self, X: np.ndarray, y: np.ndarray) -> dict:
    centroids = []
    for label_idx in range(len(self.labels)):
      mask = y == label_idx
      centroids.append(X[mask].mean(axis=0) if np.any(mask) else np.zeros(63, dtype=np.float32))

    centroid_matrix = np.stack(centroids)
    self._save_numpy_weights(centroid_matrix)

    correct = sum(
      1
      for features, label_idx in zip(X, y, strict=False)
      if self.labels.index(self.predict(features)[0]) == int(label_idx)
    )
    accuracy = correct / len(X) if len(X) else 0.0
    return {
      "final_accuracy": accuracy,
      "final_val_accuracy": accuracy,
      "backend": "numpy",
    }

  def _export_numpy_from_tensorflow(self) -> None:
    if self.backend != "tensorflow" or self.model is None:
      return
    try:
      dense_layers = [
        layer for layer in self.model.layers if hasattr(layer, "get_weights") and layer.get_weights()
      ]
      if not dense_layers:
        return
      w, b = dense_layers[-1].get_weights()
      npz_path = Path(self.numpy_weights_path)
      np.savez(npz_path, w=w.astype(np.float32), b=b.astype(np.float32))
      self.numpy_model = NumpyClassifier(str(npz_path), self.labels)
    except Exception as exc:
      logger.warning("Failed to export NumPy weights: %s", exc)
