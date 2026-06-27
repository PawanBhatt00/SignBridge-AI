"""Train ASL classifier and export model artifacts."""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.predictor import ASLClassifier
from training.paths import (
  FEATURES_NPZ,
  KERAS_MODEL,
  LABELS_JSON,
  MODELS_DIR,
  NPZ_MODEL,
  PROCESSED_DIR,
)
from training.preprocess import ASL_LABELS, build_dataset, normalize_landmarks

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

HIDDEN_SIZE = 128
EPOCHS = 400
BATCH_SIZE = 512
LEARNING_RATE = 0.08


def relu(x: np.ndarray) -> np.ndarray:
  return np.maximum(x, 0.0)


def softmax(x: np.ndarray) -> np.ndarray:
  shifted = x - np.max(x, axis=-1, keepdims=True)
  exp = np.exp(shifted)
  return exp / np.sum(exp, axis=-1, keepdims=True)


def standardize_features(X: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
  mean = X.mean(axis=0, dtype=np.float32)
  std = X.std(axis=0, dtype=np.float32)
  std[std < 1e-6] = 1.0
  return ((X - mean) / std).astype(np.float32), mean, std


def train_mlp(
  X: np.ndarray,
  y: np.ndarray,
  n_classes: int,
  epochs: int = EPOCHS,
  batch_size: int = BATCH_SIZE,
  learning_rate: float = LEARNING_RATE,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
  rng = np.random.default_rng(42)
  n_features = X.shape[1]
  W1 = rng.normal(0, 0.05, size=(n_features, HIDDEN_SIZE)).astype(np.float32)
  b1 = np.zeros(HIDDEN_SIZE, dtype=np.float32)
  W2 = rng.normal(0, 0.05, size=(HIDDEN_SIZE, n_classes)).astype(np.float32)
  b2 = np.zeros(n_classes, dtype=np.float32)

  y_onehot = np.zeros((len(y), n_classes), dtype=np.float32)
  y_onehot[np.arange(len(y)), y] = 1.0

  for epoch in range(epochs):
    batch_idx = rng.permutation(len(y))
    epoch_loss = 0.0
    for start in range(0, len(y), batch_size):
      idx = batch_idx[start : start + batch_size]
      xb = X[idx]
      yb = y_onehot[idx]

      hidden = relu(xb @ W1 + b1)
      logits = hidden @ W2 + b2
      probs = softmax(logits)
      loss = -np.mean(np.sum(yb * np.log(probs + 1e-9), axis=1))
      epoch_loss += loss

      grad_logits = (probs - yb) / len(idx)
      grad_W2 = hidden.T @ grad_logits
      grad_b2 = np.sum(grad_logits, axis=0)
      grad_hidden = grad_logits @ W2.T
      grad_hidden[hidden <= 0] = 0.0
      grad_W1 = xb.T @ grad_hidden
      grad_b1 = np.sum(grad_hidden, axis=0)

      W2 -= learning_rate * grad_W2
      b2 -= learning_rate * grad_b2
      W1 -= learning_rate * grad_W1
      b1 -= learning_rate * grad_b1

    if (epoch + 1) % 50 == 0 or epoch == 0:
      hidden = relu(X @ W1 + b1)
      preds = np.argmax(hidden @ W2 + b2, axis=1)
      acc = float(np.mean(preds == y))
      logger.info("Epoch %s/%s loss=%.4f acc=%.4f", epoch + 1, epochs, epoch_loss, acc)

  return W1, b1, W2, b2


def save_numpy_model(
  W1: np.ndarray,
  b1: np.ndarray,
  W2: np.ndarray,
  b2: np.ndarray,
  feature_mean: np.ndarray,
  feature_std: np.ndarray,
  labels: list[str],
) -> None:
  MODELS_DIR.mkdir(parents=True, exist_ok=True)
  np.savez(
    NPZ_MODEL,
    w1=W1.astype(np.float32),
    b1=b1.astype(np.float32),
    w2=W2.astype(np.float32),
    b2=b2.astype(np.float32),
    feature_mean=feature_mean.astype(np.float32),
    feature_std=feature_std.astype(np.float32),
    architecture=np.array("mlp_v1"),
  )
  LABELS_JSON.write_text(json.dumps(labels, indent=2))
  logger.info("Saved NumPy MLP model to %s", NPZ_MODEL)


def save_keras_model(
  W1: np.ndarray,
  b1: np.ndarray,
  W2: np.ndarray,
  b2: np.ndarray,
  labels: list[str],
) -> bool:
  try:
    import tensorflow as tf

    model = tf.keras.Sequential(
      [
        tf.keras.layers.Input(shape=(W1.shape[0],)),
        tf.keras.layers.Dense(HIDDEN_SIZE, activation="relu"),
        tf.keras.layers.Dense(len(labels), activation="softmax"),
      ]
    )
    model.layers[0].set_weights([W1, b1])
    model.layers[1].set_weights([W2, b2])
    model.save(str(KERAS_MODEL))
    logger.info("Saved Keras model to %s", KERAS_MODEL)
    return True
  except Exception as exc:
    logger.warning("TensorFlow export skipped: %s", exc)
    return False


def load_or_build_features() -> tuple[np.ndarray, np.ndarray]:
  if FEATURES_NPZ.exists():
    data = np.load(FEATURES_NPZ)
    return data["X"], data["y"]
  X, y, _ = build_dataset()
  PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
  np.savez(FEATURES_NPZ, X=X, y=y, labels=np.array(ASL_LABELS))
  return X, y


def split_train_val(X: np.ndarray, y: np.ndarray, val_ratio: float = 0.15):
  rng = np.random.default_rng(42)
  idx = rng.permutation(len(y))
  split = int(len(y) * (1.0 - val_ratio))
  train_idx, val_idx = idx[:split], idx[split:]
  return X[train_idx], y[train_idx], X[val_idx], y[val_idx]


def main() -> None:
  X, y = load_or_build_features()
  X_train, y_train, X_val, y_val = split_train_val(X, y)
  X_train_scaled, feature_mean, feature_std = standardize_features(X_train)
  X_val_scaled = ((X_val - feature_mean) / feature_std).astype(np.float32)

  logger.info("Training on %s samples (%s val), %s classes", len(y_train), len(y_val), len(ASL_LABELS))
  W1, b1, W2, b2 = train_mlp(X_train_scaled, y_train, n_classes=len(ASL_LABELS))
  save_numpy_model(W1, b1, W2, b2, feature_mean, feature_std, ASL_LABELS)
  keras_saved = save_keras_model(W1, b1, W2, b2, ASL_LABELS)

  classifier = ASLClassifier(str(KERAS_MODEL))
  val_preds = []
  for features, label_idx in zip(X_val, y_val, strict=False):
    pred, _ = classifier.predict(features)
    val_preds.append(ASL_LABELS.index(pred) if pred in ASL_LABELS else -1)

  train_preds = []
  for features, label_idx in zip(X_train[:2000], y_train[:2000], strict=False):
    pred, _ = classifier.predict(features)
    train_preds.append(ASL_LABELS.index(pred) if pred in ASL_LABELS else -1)

  val_accuracy = float(np.mean(np.array(val_preds) == y_val))
  train_accuracy = float(np.mean(np.array(train_preds) == y_train[:2000]))
  metrics = {
    "training_samples": int(len(y_train)),
    "validation_samples": int(len(y_val)),
    "labels": ASL_LABELS,
    "train_accuracy": round(train_accuracy, 4),
    "val_accuracy": round(val_accuracy, 4),
    "backend": classifier.backend,
    "keras_saved": keras_saved,
    "numpy_model": str(NPZ_MODEL),
    "labels_json": str(LABELS_JSON),
    "architecture": "mlp_v1",
    "confidence_threshold": 0.70,
  }
  (MODELS_DIR / "train_metrics.json").write_text(json.dumps(metrics, indent=2))
  print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
  main()
