"""Train ASL classifier and export model artifacts."""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from training.paths import (
    FEATURES_NPZ,
    KERAS_MODEL,
    LABELS_JSON,
    MODELS_DIR,
    NPZ_MODEL,
    PROCESSED_DIR,
)
from training.preprocess import ASL_LABELS, build_dataset

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

# ==========================================================
# Hyperparameters
# ==========================================================

INPUT_SIZE = 63  # 21 landmarks * 3 coordinates
HIDDEN_SIZE = 128
OUTPUT_SIZE = len(ASL_LABELS)

EPOCHS = 400
BATCH_SIZE = 512
INITIAL_LR = 0.08
LR_DECAY = 0.995
EARLY_STOPPING_PATIENCE = 20
RANDOM_SEED = 42


# ==========================================================
# Activations
# ==========================================================

def relu(x: np.ndarray) -> np.ndarray:
    return np.maximum(x, 0.0)


def relu_derivative(x: np.ndarray) -> np.ndarray:
    return (x > 0).astype(np.float32)


def softmax(x: np.ndarray) -> np.ndarray:
    shifted = x - np.max(x, axis=-1, keepdims=True)
    exp = np.exp(shifted)
    return exp / np.sum(exp, axis=-1, keepdims=True)


# ==========================================================
# Weight Initialization
# ==========================================================

def initialize_weights() -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    rng = np.random.default_rng(RANDOM_SEED)
    W1 = rng.normal(0, 0.05, size=(INPUT_SIZE, HIDDEN_SIZE)).astype(np.float32)
    b1 = np.zeros(HIDDEN_SIZE, dtype=np.float32)
    W2 = rng.normal(0, 0.05, size=(HIDDEN_SIZE, OUTPUT_SIZE)).astype(np.float32)
    b2 = np.zeros(OUTPUT_SIZE, dtype=np.float32)
    return W1, b1, W2, b2


# ==========================================================
# Feature Standardization
# ==========================================================

def standardize_features(X: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    mean = X.mean(axis=0, dtype=np.float32)
    std = X.std(axis=0, dtype=np.float32)
    std[std < 1e-6] = 1.0
    return ((X - mean) / std).astype(np.float32), mean, std


# ==========================================================
# Data Loading / Splitting
# ==========================================================

def load_or_build_features() -> tuple[np.ndarray, np.ndarray]:
    if FEATURES_NPZ.exists():
        data = np.load(FEATURES_NPZ)
        return data["X"], data["y"]
    X, y, _ = build_dataset()
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    np.savez(FEATURES_NPZ, X=X, y=y, labels=np.array(ASL_LABELS))
    return X, y


def split_train_validation(X: np.ndarray, y: np.ndarray, val_ratio: float = 0.15):
    rng = np.random.default_rng(RANDOM_SEED)
    idx = rng.permutation(len(y))
    split = int(len(y) * (1.0 - val_ratio))
    train_idx, val_idx = idx[:split], idx[split:]
    return X[train_idx], y[train_idx], X[val_idx], y[val_idx]


# ==========================================================
# Forward Pass
# ==========================================================

def forward_pass(
    X: np.ndarray,
    W1: np.ndarray,
    b1: np.ndarray,
    W2: np.ndarray,
    b2: np.ndarray,
):
    hidden_linear = X @ W1 + b1
    hidden = relu(hidden_linear)
    logits = hidden @ W2 + b2
    probs = softmax(logits)
    return hidden_linear, hidden, logits, probs


# ==========================================================
# Accuracy
# ==========================================================

def compute_accuracy(
    X: np.ndarray,
    y: np.ndarray,
    W1: np.ndarray,
    b1: np.ndarray,
    W2: np.ndarray,
    b2: np.ndarray,
) -> float:
    _, hidden, _, _ = forward_pass(X, W1, b1, W2, b2)
    logits = hidden @ W2 + b2
    predictions = np.argmax(logits, axis=1)
    return float(np.mean(predictions == y))


# ==========================================================
# Training
# ==========================================================

def train_mlp(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray,
):
    W1, b1, W2, b2 = initialize_weights()

    n_classes = OUTPUT_SIZE
    y_onehot = np.eye(n_classes, dtype=np.float32)[y_train]

    learning_rate = INITIAL_LR
    best_accuracy = 0.0
    best_weights = (W1.copy(), b1.copy(), W2.copy(), b2.copy())
    patience = 0

    rng = np.random.default_rng(RANDOM_SEED)

    logger.info("======================================================")
    logger.info("Training started")
    logger.info("======================================================")

    for epoch in range(EPOCHS):
        permutation = rng.permutation(len(X_train))
        X_train = X_train[permutation]
        y_train = y_train[permutation]
        y_onehot = y_onehot[permutation]

        epoch_loss = 0.0
        batches = 0

        for start in range(0, len(X_train), BATCH_SIZE):
            end = start + BATCH_SIZE
            xb = X_train[start:end]
            yb = y_onehot[start:end]

            hidden_linear, hidden, logits, probs = forward_pass(xb, W1, b1, W2, b2)

            loss = -np.mean(np.sum(yb * np.log(probs + 1e-9), axis=1))
            epoch_loss += loss
            batches += 1

            grad_logits = (probs - yb) / len(xb)
            grad_W2 = hidden.T @ grad_logits
            grad_b2 = np.sum(grad_logits, axis=0)
            grad_hidden = grad_logits @ W2.T
            grad_hidden *= relu_derivative(hidden_linear)
            grad_W1 = xb.T @ grad_hidden
            grad_b1 = np.sum(grad_hidden, axis=0)

            W2 -= learning_rate * grad_W2
            b2 -= learning_rate * grad_b2
            W1 -= learning_rate * grad_W1
            b1 -= learning_rate * grad_b1

        learning_rate *= LR_DECAY

        train_acc = compute_accuracy(X_train, y_train, W1, b1, W2, b2)
        val_acc = compute_accuracy(X_val, y_val, W1, b1, W2, b2)
        avg_loss = epoch_loss / batches

        if (epoch + 1) % 10 == 0 or epoch == 0:
            logger.info(
                "Epoch %3d/%d | Loss %.4f | Train %.4f | Val %.4f | LR %.5f",
                epoch + 1,
                EPOCHS,
                avg_loss,
                train_acc,
                val_acc,
                learning_rate,
            )

        if val_acc > best_accuracy:
            best_accuracy = val_acc
            best_weights = (W1.copy(), b1.copy(), W2.copy(), b2.copy())
            patience = 0
        else:
            patience += 1

        if patience >= EARLY_STOPPING_PATIENCE:
            logger.info("")
            logger.info("Early stopping triggered.")
            logger.info("Best Validation Accuracy : %.4f", best_accuracy)
            logger.info("")
            break

    logger.info("======================================================")
    logger.info("Training completed")
    logger.info("======================================================")

    return (*best_weights, best_accuracy)


# ==========================================================
# Save NumPy Model
# ==========================================================

def save_numpy_model(
    W1: np.ndarray,
    b1: np.ndarray,
    W2: np.ndarray,
    b2: np.ndarray,
    feature_mean: np.ndarray,
    feature_std: np.ndarray,
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
        architecture=np.array("mlp_v2"),
    )

    LABELS_JSON.write_text(json.dumps(ASL_LABELS, indent=2))
    logger.info("Saved NumPy model -> %s", NPZ_MODEL)


# ==========================================================
# Save TensorFlow Model
# ==========================================================

def save_keras_model(
    W1: np.ndarray,
    b1: np.ndarray,
    W2: np.ndarray,
    b2: np.ndarray,
) -> bool:
    try:
        import tensorflow as tf

        model = tf.keras.Sequential(
            [
                tf.keras.layers.Input(shape=(INPUT_SIZE,)),
                tf.keras.layers.Dense(HIDDEN_SIZE, activation="relu"),
                tf.keras.layers.Dense(OUTPUT_SIZE, activation="softmax"),
            ]
        )

        model.layers[0].set_weights([W1, b1])
        model.layers[1].set_weights([W2, b2])

        model.save(str(KERAS_MODEL))
        logger.info("Saved Keras model -> %s", KERAS_MODEL)
        return True

    except Exception as exc:
        logger.warning("Could not export Keras model: %s", exc)
        return False


# ==========================================================
# Main
# ==========================================================

def main() -> None:
    logger.info("Loading dataset...")
    X, y = load_or_build_features()

    X_train, y_train, X_val, y_val = split_train_validation(X, y)

    X_train, feature_mean, feature_std = standardize_features(X_train)
    X_val = ((X_val - feature_mean) / feature_std).astype(np.float32)

    logger.info("Training on %d samples (%d validation)", len(X_train), len(X_val))

    W1, b1, W2, b2, best_val_accuracy = train_mlp(X_train, y_train, X_val, y_val)

    train_accuracy = compute_accuracy(X_train, y_train, W1, b1, W2, b2)
    validation_accuracy = compute_accuracy(X_val, y_val, W1, b1, W2, b2)

    save_numpy_model(W1, b1, W2, b2, feature_mean, feature_std)
    keras_saved = save_keras_model(W1, b1, W2, b2)

    metrics = {
        "training_samples": int(len(X_train)),
        "validation_samples": int(len(X_val)),
        "classes": len(ASL_LABELS),
        "labels": ASL_LABELS,
        "train_accuracy": round(train_accuracy, 4),
        "validation_accuracy": round(validation_accuracy, 4),
        "best_validation_accuracy": round(best_val_accuracy, 4),
        "keras_saved": keras_saved,
        "architecture": f"MLP ({INPUT_SIZE} -> {HIDDEN_SIZE} -> {OUTPUT_SIZE})",
        "epochs": EPOCHS,
        "batch_size": BATCH_SIZE,
        "learning_rate": INITIAL_LR,
    }

    with open(MODELS_DIR / "train_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    logger.info("")
    logger.info("======================================================")
    logger.info("Training Complete")
    logger.info("======================================================")
    logger.info("Train Accuracy      : %.4f", train_accuracy)
    logger.info("Validation Accuracy : %.4f", validation_accuracy)
    logger.info("======================================================")

    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()