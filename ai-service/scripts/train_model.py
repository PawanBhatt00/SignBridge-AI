"""Generate synthetic ASL training data and train the classifier."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.predictor import ASLClassifier, ASL_LABELS


def generate_synthetic_landmarks(label: str, n_samples: int = 50) -> tuple[np.ndarray, np.ndarray]:
  """Generate synthetic normalized landmark data for bootstrapping."""
  rng = np.random.default_rng(hash(label) % 2**31)
  label_idx = ASL_LABELS.index(label)
  X_list: list[np.ndarray] = []
  y_list: list[int] = []

  for _ in range(n_samples):
    base = rng.normal(0, 0.3, size=(21, 3)).astype(np.float32)
    # Add label-specific bias to differentiate classes
    base += rng.normal(label_idx * 0.02, 0.05, size=(21, 3))
    wrist = base[0].copy()
    base -= wrist
    max_val = np.max(np.abs(base))
    if max_val > 0:
      base /= max_val
    X_list.append(base.flatten())
    y_list.append(label_idx)

  return np.array(X_list), np.array(y_list)


def main() -> None:
  print("Generating synthetic training data for ASL alphabet...")
  all_X: list[np.ndarray] = []
  all_y: list[np.ndarray] = []

  for label in ASL_LABELS:
    X, y = generate_synthetic_landmarks(label, n_samples=100)
    all_X.append(X)
    all_y.append(y)
    print(f"  Generated {len(X)} samples for '{label}'")

  X_train = np.vstack(all_X)
  y_train = np.concatenate(all_y)

  # Shuffle
  rng = np.random.default_rng(42)
  idx = rng.permutation(len(X_train))
  X_train = X_train[idx]
  y_train = y_train[idx]

  print(f"\nTraining on {len(X_train)} samples...")
  classifier = ASLClassifier()
  metrics = classifier.train(X_train, y_train, epochs=30)
  print(f"Training complete: {json.dumps(metrics, indent=2)}")

  # Save label mapping
  labels_path = Path(__file__).parent.parent / "models" / "labels.json"
  labels_path.parent.mkdir(parents=True, exist_ok=True)
  labels_path.write_text(json.dumps(ASL_LABELS, indent=2))
  print(f"Labels saved to {labels_path}")


if __name__ == "__main__":
  main()
