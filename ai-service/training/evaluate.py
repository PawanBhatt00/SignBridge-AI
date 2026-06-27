"""Evaluate trained ASL classifier."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.predictor import ASLClassifier
from training.paths import FEATURES_NPZ, KERAS_MODEL, MODELS_DIR
from training.preprocess import ASL_LABELS, normalize_landmarks

CONFIDENCE_THRESHOLD = 0.70


def evaluate_features(X: np.ndarray, y: np.ndarray, classifier: ASLClassifier) -> dict:
  correct = 0
  accepted = 0
  per_label: dict[str, dict[str, int | float]] = {
    label: {"total": 0, "correct": 0, "accepted": 0} for label in ASL_LABELS
  }
  confusion: list[dict] = []

  for features, label_idx in zip(X, y, strict=False):
    true_label = ASL_LABELS[int(label_idx)]
    pred, confidence = classifier.predict(features)
    if confidence < CONFIDENCE_THRESHOLD:
      pred = ""

    per_label[true_label]["total"] = int(per_label[true_label]["total"]) + 1
    if pred == true_label:
      correct += 1
      per_label[true_label]["correct"] = int(per_label[true_label]["correct"]) + 1
    if pred:
      accepted += 1
      per_label[true_label]["accepted"] = int(per_label[true_label]["accepted"]) + 1
    if pred and pred != true_label:
      confusion.append({"true": true_label, "pred": pred, "confidence": round(confidence, 4)})

  total = len(y)
  return {
    "total_samples": total,
    "accuracy": round(correct / total if total else 0.0, 4),
    "acceptance_rate": round(accepted / total if total else 0.0, 4),
    "confidence_threshold": CONFIDENCE_THRESHOLD,
    "per_label": per_label,
    "misclassifications_sample": confusion[:20],
    "backend": classifier.backend,
  }


def main() -> None:
  if not FEATURES_NPZ.exists():
    raise SystemExit(f"Missing features file: {FEATURES_NPZ}. Run preprocess.py first.")

  data = np.load(FEATURES_NPZ)
  X, y = data["X"], data["y"]
  classifier = ASLClassifier(str(KERAS_MODEL))
  summary = evaluate_features(X, y, classifier)

  out_path = MODELS_DIR / "evaluate_summary.json"
  out_path.write_text(json.dumps(summary, indent=2))
  print(json.dumps(summary, indent=2))


if __name__ == "__main__":
  main()
