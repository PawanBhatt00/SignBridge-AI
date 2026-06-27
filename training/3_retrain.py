"""
STEP 3 — Combine all data sources and retrain the model.

Usage:
    python3 3_retrain.py

Combines:
    1. datasets/asl/processed/features.npz     (original synthetic — 5978 samples)
    2. datasets/asl/real/landmarks.npz          (Kaggle real images — ~13000 samples)
    3. datasets/asl/real/webcam_landmarks.npz   (your webcam — ~2600 samples)

Output:
    ai-service/models/asl_classifier.npz        (replaces existing model)
    ai-service/models/asl_classifier.keras      (TensorFlow model if available)
"""

import json
import logging
import numpy as np
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

REPO_ROOT    = Path(__file__).resolve().parent.parent
DATASETS_DIR = REPO_ROOT / "datasets" / "asl"
MODEL_DIR    = REPO_ROOT / "ai-service" / "models"
MODEL_NPZ    = MODEL_DIR / "asl_classifier.npz"
MODEL_KERAS  = MODEL_DIR / "asl_classifier.keras"
LABELS       = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")


# ── Data loading ─────────────────────────────────────────────────────────────

def load_npz(path: Path, name: str) -> tuple[np.ndarray, np.ndarray] | None:
    if not path.exists():
        log.warning("Skipping %s — file not found: %s", name, path)
        return None
    data = np.load(path)
    X, y = data["X"], data["y"]
    log.info("Loaded %-20s: %d samples", name, len(X))
    return X, y


def combine_datasets() -> tuple[np.ndarray, np.ndarray]:
    sources = [
        (DATASETS_DIR / "processed"  / "features.npz",       "original synthetic"),
        (DATASETS_DIR / "real"       / "landmarks.npz",       "Kaggle real images"),
        (DATASETS_DIR / "real"       / "webcam_landmarks.npz","your webcam"),
        (REPO_ROOT    / "datasets"   / "processed" / "samples_landmarks.npz", "backend samples"),
    ]

    all_X, all_y = [], []
    for path, name in sources:
        result = load_npz(path, name)
        if result:
            all_X.append(result[0])
            all_y.append(result[1])

    if not all_X:
        raise RuntimeError("No datasets found! Run scripts 1 and 2 first.")

    X = np.concatenate(all_X, axis=0).astype(np.float32)
    y = np.concatenate(all_y, axis=0).astype(np.int32)

    # Print per-label counts
    unique, counts = np.unique(y, return_counts=True)
    log.info("Combined dataset: %d total samples", len(X))
    for i, c in zip(unique, counts):
        log.info("  %s: %d", LABELS[i], c)

    return X, y


# ── Augmentation ─────────────────────────────────────────────────────────────

def augment(X: np.ndarray, y: np.ndarray, factor: int = 3) -> tuple[np.ndarray, np.ndarray]:
    """
    Augment by adding small random noise and scaling variations.
    Multiplies dataset by `factor` times.
    """
    log.info("Augmenting dataset (factor=%dx)...", factor)
    rng = np.random.default_rng(42)
    aug_X, aug_y = [X], [y]

    for _ in range(factor - 1):
        # Gaussian noise (small, simulates hand jitter)
        noise    = rng.normal(0, 0.01, size=X.shape).astype(np.float32)
        # Scale variation (±10%, simulates different hand sizes/distances)
        scale    = rng.uniform(0.92, 1.08, size=(len(X), 1)).astype(np.float32)
        augmented = (X + noise) * scale
        aug_X.append(augmented)
        aug_y.append(y)

    X_aug = np.concatenate(aug_X, axis=0)
    y_aug = np.concatenate(aug_y, axis=0)

    # Shuffle
    idx = rng.permutation(len(X_aug))
    log.info("Augmented dataset size: %d", len(X_aug))
    return X_aug[idx], y_aug[idx]


# ── Standardization ──────────────────────────────────────────────────────────

def standardize(X_train: np.ndarray, X_val: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    mean = X_train.mean(axis=0).astype(np.float32)
    std  = X_train.std(axis=0).astype(np.float32)
    std[std < 1e-6] = 1.0  # avoid division by zero

    X_train_s = ((X_train - mean) / std).astype(np.float32)
    X_val_s   = ((X_val   - mean) / std).astype(np.float32)
    return X_train_s, X_val_s, mean, std


# ── TensorFlow training ───────────────────────────────────────────────────────

def train_tensorflow(X_train, y_train, X_val, y_val) -> dict:
    import tensorflow as tf
    log.info("Training with TensorFlow...")

    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(63,)),
        tf.keras.layers.Dense(256, activation="relu"),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(128, activation="relu"),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(64, activation="relu"),
        tf.keras.layers.Dropout(0.1),
        tf.keras.layers.Dense(26, activation="softmax"),
    ])

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    callbacks = [
        tf.keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True),
        tf.keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=5, min_lr=1e-5),
    ]

    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=100,
        batch_size=64,
        callbacks=callbacks,
        verbose=1,
    )

    final_acc     = float(history.history["accuracy"][-1])
    final_val_acc = float(history.history["val_accuracy"][-1])
    log.info("Train acc: %.4f  Val acc: %.4f", final_acc, final_val_acc)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    model.save(str(MODEL_KERAS))
    log.info("Saved Keras model to %s", MODEL_KERAS)

    return model, {"final_accuracy": final_acc, "final_val_accuracy": final_val_acc, "backend": "tensorflow"}


def export_numpy_mlp(model, mean: np.ndarray, std: np.ndarray):
    """Export TF model weights to npz in mlp_v1 format."""
    dense_layers = [l for l in model.layers if hasattr(l, "get_weights") and l.get_weights()]

    # Get first and last dense layer weights
    w1, b1 = dense_layers[0].get_weights()
    w2, b2 = dense_layers[-1].get_weights()

    np.savez(
        MODEL_NPZ,
        w1=w1.astype(np.float32),
        b1=b1.astype(np.float32),
        w2=w2.astype(np.float32),
        b2=b2.astype(np.float32),
        feature_mean=mean,
        feature_std=std,
        architecture=np.str_("mlp_v1"),
    )
    log.info("Exported NumPy mlp_v1 weights to %s", MODEL_NPZ)


# ── NumPy fallback training ───────────────────────────────────────────────────

def train_numpy_mlp(X_train, y_train, X_val, y_val, mean, std) -> dict:
    """Train a 2-layer MLP using pure NumPy (no TensorFlow)."""
    log.info("Training with NumPy MLP...")

    rng = np.random.default_rng(42)
    n_input, n_hidden, n_output = 63, 256, 26
    lr = 0.01
    epochs = 200
    batch_size = 64

    # Xavier initialization
    w1 = rng.normal(0, np.sqrt(2.0 / n_input),  (n_input,  n_hidden)).astype(np.float32)
    b1 = np.zeros(n_hidden, dtype=np.float32)
    w2 = rng.normal(0, np.sqrt(2.0 / n_hidden), (n_hidden, n_output)).astype(np.float32)
    b2 = np.zeros(n_output, dtype=np.float32)

    def relu(x):       return np.maximum(x, 0)
    def relu_grad(x):  return (x > 0).astype(np.float32)
    def softmax(x):
        e = np.exp(x - x.max(axis=1, keepdims=True))
        return e / e.sum(axis=1, keepdims=True)

    def forward(X):
        h    = relu(X @ w1 + b1)
        logits = h @ w2 + b2
        probs  = softmax(logits)
        return h, probs

    def accuracy(X, y):
        _, probs = forward(X)
        return (probs.argmax(axis=1) == y).mean()

    best_val_acc = 0.0
    best_w1, best_b1, best_w2, best_b2 = w1.copy(), b1.copy(), w2.copy(), b2.copy()

    n = len(X_train)
    for epoch in range(epochs):
        # Shuffle
        idx = rng.permutation(n)
        X_s, y_s = X_train[idx], y_train[idx]

        for start in range(0, n, batch_size):
            Xb = X_s[start:start + batch_size]
            yb = y_s[start:start + batch_size]

            # Forward
            h, probs = forward(Xb)

            # Cross-entropy gradient
            dL = probs.copy()
            dL[np.arange(len(yb)), yb] -= 1
            dL /= len(yb)

            # Backprop
            dw2 = h.T @ dL
            db2 = dL.sum(axis=0)
            dh  = dL @ w2.T * relu_grad(Xb @ w1 + b1)
            dw1 = Xb.T @ dh
            db1 = dh.sum(axis=0)

            # Update with lr decay
            lr_t = lr / (1 + epoch * 0.005)
            w1 -= lr_t * dw1
            b1 -= lr_t * db1
            w2 -= lr_t * dw2
            b2 -= lr_t * db2

        if (epoch + 1) % 20 == 0:
            train_acc = accuracy(X_train, y_train)
            val_acc   = accuracy(X_val,   y_val)
            log.info("Epoch %3d  train=%.4f  val=%.4f", epoch + 1, train_acc, val_acc)

            if val_acc > best_val_acc:
                best_val_acc = val_acc
                best_w1, best_b1 = w1.copy(), b1.copy()
                best_w2, best_b2 = w2.copy(), b2.copy()

    # Save best weights
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    np.savez(
        MODEL_NPZ,
        w1=best_w1.astype(np.float32),
        b1=best_b1.astype(np.float32),
        w2=best_w2.astype(np.float32),
        b2=best_b2.astype(np.float32),
        feature_mean=mean,
        feature_std=std,
        architecture=np.str_("mlp_v1"),
    )
    log.info("Saved NumPy mlp_v1 weights. Best val acc: %.4f", best_val_acc)
    return {"final_accuracy": float(best_val_acc), "final_val_accuracy": float(best_val_acc), "backend": "numpy"}


# ── Per-letter accuracy report ────────────────────────────────────────────────

def per_letter_report(X_val, y_val, mean, std):
    """Show accuracy per letter so you know which need more data."""
    data  = np.load(MODEL_NPZ)
    w1, b1, w2, b2 = data["w1"], data["b1"], data["w2"], data["b2"]

    X_s = (X_val - mean) / np.where(std < 1e-6, 1.0, std)
    h   = np.maximum(X_s @ w1 + b1, 0)
    logits = h @ w2 + b2
    preds  = logits.argmax(axis=1)

    log.info("\n=== Per-Letter Accuracy ===")
    for i, label in enumerate(LABELS):
        mask = y_val == i
        if mask.sum() == 0:
            continue
        acc = (preds[mask] == i).mean()
        bar = "█" * int(acc * 20) + "░" * (20 - int(acc * 20))
        log.info("  %s  %s  %.1f%%  (%d samples)", label, bar, acc * 100, mask.sum())


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    log.info("=== Step 3: Retrain ASL Classifier ===")

    # 1. Load all data
    X, y = combine_datasets()

    # 2. Augment
    X, y = augment(X, y, factor=3)

    # 3. Train/val split (80/20)
    rng = np.random.default_rng(42)
    idx = rng.permutation(len(X))
    split = int(0.8 * len(X))
    X_train, X_val = X[idx[:split]], X[idx[split:]]
    y_train, y_val = y[idx[:split]], y[idx[split:]]

    # 4. Standardize
    X_train_s, X_val_s, mean, std = standardize(X_train, X_val)
    log.info("Train: %d  Val: %d", len(X_train), len(X_val))

    # 5. Train (TF if available, else NumPy)
    metrics = {}
    try:
        import tensorflow as tf
        model, metrics = train_tensorflow(X_train_s, y_train, X_val_s, y_val)
        export_numpy_mlp(model, mean, std)
    except Exception as e:
        log.warning("TensorFlow training failed (%s), using NumPy MLP", e)
        metrics = train_numpy_mlp(X_train_s, y_train, X_val_s, y_val, mean, std)

    # 6. Per-letter report
    per_letter_report(X_val_s, y_val, mean, std)

    # 7. Save training summary
    summary = {**metrics, "total_samples": len(X), "val_samples": len(X_val)}
    (MODEL_DIR / "training_summary.json").write_text(json.dumps(summary, indent=2))

    log.info("\n✅ Retraining complete!")
    log.info("   Model saved to: %s", MODEL_NPZ)
    log.info("   Restart ai-service to load new model:")
    log.info("   cd ai-service && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")


if __name__ == "__main__":
    main()
