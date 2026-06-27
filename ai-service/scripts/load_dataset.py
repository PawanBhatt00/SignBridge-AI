"""Load dataset from processed JSON files."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np


def load_processed_dataset(data_dir: str | Path) -> tuple[np.ndarray, np.ndarray, list[str]]:
  """Load landmarks and labels from processed dataset directory."""
  data_path = Path(data_dir)
  labels_file = data_path / "labels.json"
  samples_file = data_path / "samples.json"

  if not samples_file.exists():
    raise FileNotFoundError(f"Dataset not found: {samples_file}")

  labels: list[str] = []
  if labels_file.exists():
    labels = json.loads(labels_file.read_text())

  samples = json.loads(samples_file.read_text())
  X_list: list[list[float]] = []
  y_list: list[int] = []

  for sample in samples:
    landmarks = sample["landmarks"]
    label = sample["label"]
    if label not in labels:
      labels.append(label)
    y_list.append(labels.index(label))

    coords = []
    for lm in landmarks:
      coords.extend([lm["x"], lm["y"], lm.get("z", 0.0)])
    X_list.append(coords)

  return np.array(X_list, dtype=np.float32), np.array(y_list), labels
