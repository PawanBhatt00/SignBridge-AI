"""Preprocess ASL images and landmark samples into training features."""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.landmarks import HandLandmarkExtractor
from training.asl_poses import all_pose_seeds
from training.paths import (
  DATASET_INFO,
  FEATURES_NPZ,
  IMAGE_EXTENSIONS,
  LEGACY_SAMPLES,
  PROCESSED_DIR,
  RAW_DIR,
  REPO_ROOT,
  SAMPLES_JSON,
)

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

ASL_LABELS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")


def load_dataset_info() -> dict:
  if DATASET_INFO.exists():
    return json.loads(DATASET_INFO.read_text())
  return {"labels": ASL_LABELS}


def normalize_landmarks(landmarks: list[dict[str, float]]) -> np.ndarray:
  coords = np.array([[p["x"], p["y"], p.get("z", 0.0)] for p in landmarks], dtype=np.float32)
  wrist = coords[0].copy()
  coords -= wrist
  max_val = np.max(np.abs(coords))
  if max_val > 0:
    coords /= max_val
  return coords.flatten()


def load_json_samples(path: Path) -> list[dict]:
  if not path.exists():
    return []
  data = json.loads(path.read_text())
  return data if isinstance(data, list) else data.get("samples", [])


def load_seed_samples() -> list[dict]:
  seeds: list[dict] = []
  seeds.extend(load_json_samples(LEGACY_SAMPLES))

  if SAMPLES_JSON.exists():
    for sample in load_json_samples(SAMPLES_JSON):
      source = str(sample.get("source", ""))
      if source and (source.startswith("augment:") or source.startswith("synthetic:")):
        continue
      if not source and sample.get("label"):
        seeds.append(sample)
        continue
      if source and not source.startswith("augment:") and not source.startswith("synthetic:"):
        seeds.append(sample)

  return seeds


def extract_from_images(raw_dir: Path, extractor: HandLandmarkExtractor) -> list[dict]:
  samples: list[dict] = []
  if not raw_dir.exists():
    return samples

  for label_dir in sorted(raw_dir.iterdir()):
    if not label_dir.is_dir():
      continue
    label = label_dir.name.upper()
    if label not in ASL_LABELS:
      logger.warning("Skipping unknown label folder: %s", label)
      continue

    for image_path in sorted(label_dir.iterdir()):
      if image_path.suffix.lower() not in IMAGE_EXTENSIONS:
        continue
      landmarks = extractor.extract_from_image_bytes(image_path.read_bytes())
      if landmarks is None:
        logger.warning("No hand detected in %s", image_path)
        continue
      samples.append({"label": label, "landmarks": landmarks, "source": str(image_path)})
      logger.info("Extracted landmarks from %s", image_path)

  return samples


def augment_sample(
  landmarks: list[dict[str, float]],
  label: str,
  n_augments: int,
  rng: np.random.Generator,
) -> list[dict]:
  base = normalize_landmarks(landmarks).reshape(21, 3)
  augmented: list[dict] = []

  for i in range(n_augments):
    noise = rng.normal(0, 0.012, size=base.shape).astype(np.float32)
    coords = base + noise
    wrist = coords[0].copy()
    coords -= wrist
    max_val = np.max(np.abs(coords))
    if max_val > 0:
      coords /= max_val

    flat = coords.flatten()
    lm = [
      {"x": float(flat[j * 3]), "y": float(flat[j * 3 + 1]), "z": float(flat[j * 3 + 2])}
      for j in range(21)
    ]
    augmented.append({"label": label, "landmarks": lm, "source": f"augment:{label}:{i}"})

  return augmented


def build_dataset(augment_per_sample: int = 120, pose_augments_per_label: int = 80) -> tuple[np.ndarray, np.ndarray, list[dict]]:
  extractor = HandLandmarkExtractor()
  rng = np.random.default_rng(42)

  collected: list[dict] = []
  collected.extend(extract_from_images(RAW_DIR, extractor))
  collected.extend(load_seed_samples())
  collected.extend(load_json_samples(LEGACY_SAMPLES))

  pose_by_label = {sample["label"]: sample for sample in all_pose_seeds()}
  by_label: dict[str, list[dict]] = {label: [] for label in ASL_LABELS}
  for sample in collected:
    label = str(sample.get("label", "")).upper()
    landmarks = sample.get("landmarks")
    if label in by_label and isinstance(landmarks, list) and len(landmarks) == 21:
      by_label[label].append(sample)

  expanded: list[dict] = []
  for label in ASL_LABELS:
    seeds = by_label[label]
    if not seeds:
      seeds = [pose_by_label[label]]

    for seed in seeds:
      expanded.append(seed)
      expanded.extend(augment_sample(seed["landmarks"], label, augment_per_sample, rng))

    pose_seed = pose_by_label[label]
    expanded.append(pose_seed)
    expanded.extend(augment_sample(pose_seed["landmarks"], label, pose_augments_per_label, rng))

  X_list: list[np.ndarray] = []
  y_list: list[int] = []
  for sample in expanded:
    X_list.append(normalize_landmarks(sample["landmarks"]))
    y_list.append(ASL_LABELS.index(sample["label"]))

  X = np.stack(X_list).astype(np.float32)
  y = np.array(y_list, dtype=np.int32)

  extractor.close()
  return X, y, expanded


def main() -> None:
  PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
  RAW_DIR.mkdir(parents=True, exist_ok=True)

  info = load_dataset_info()
  info.update(
    {
      "name": "SignBridge ASL Alphabet",
      "version": "1.1.0",
      "labels": ASL_LABELS,
      "landmarks_per_hand": 21,
      "feature_size": 63,
      "normalization": "wrist-relative, max-abs scaling",
      "training_standardization": "z-score (stored in model)",
      "notes": "A-Z static poses with anatomical templates; J/Z use static snapshots.",
      "sources": [
        "datasets/asl/raw",
        "datasets/processed/samples.json",
        "training/asl_poses.py",
      ],
      "repo_root": str(REPO_ROOT),
    }
  )
  DATASET_INFO.write_text(json.dumps(info, indent=2))

  X, y, samples = build_dataset()
  SAMPLES_JSON.write_text(json.dumps(samples, indent=2))
  np.savez(FEATURES_NPZ, X=X, y=y, labels=np.array(ASL_LABELS))

  counts = {label: int(np.sum(y == idx)) for idx, label in enumerate(ASL_LABELS)}
  summary = {
    "total_samples": int(len(y)),
    "feature_shape": list(X.shape),
    "per_label_counts": counts,
    "outputs": {
      "samples_json": str(SAMPLES_JSON),
      "features_npz": str(FEATURES_NPZ),
      "dataset_info": str(DATASET_INFO),
    },
  }
  (PROCESSED_DIR / "preprocess_summary.json").write_text(json.dumps(summary, indent=2))

  print(json.dumps(summary, indent=2))


if __name__ == "__main__":
  main()
