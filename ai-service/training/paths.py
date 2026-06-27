"""Shared paths for the ASL training pipeline."""

from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DATASETS_ASL = REPO_ROOT / "datasets" / "asl"
RAW_DIR = DATASETS_ASL / "raw"
PROCESSED_DIR = DATASETS_ASL / "processed"
LEGACY_SAMPLES = REPO_ROOT / "datasets" / "processed" / "samples.json"
DATASET_INFO = PROCESSED_DIR / "dataset_info.json"
SAMPLES_JSON = PROCESSED_DIR / "samples.json"
FEATURES_NPZ = PROCESSED_DIR / "features.npz"
MODELS_DIR = Path(__file__).resolve().parents[1] / "models"
KERAS_MODEL = MODELS_DIR / "asl_classifier.keras"
LABELS_JSON = MODELS_DIR / "labels.json"
NPZ_MODEL = MODELS_DIR / "asl_classifier.npz"

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
