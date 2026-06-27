"""
STEP 1 — Download Kaggle ASL dataset and extract MediaPipe landmarks.

Usage:
    pip install kaggle opencv-python mediapipe tqdm
    # Put your kaggle.json in ~/.kaggle/kaggle.json first
    python3 1_download_and_extract.py

Output:
    datasets/asl/real/landmarks.npz  — real hand landmarks ready for training
"""

import os
import sys
import json
import zipfile
import logging
import numpy as np
from pathlib import Path
from tqdm import tqdm

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ── Paths ────────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parent.parent  # signbridge/
DATASET_DIR = REPO_ROOT / "datasets" / "asl" / "real"
KAGGLE_ZIP  = DATASET_DIR / "asl-alphabet.zip"
IMAGES_DIR  = DATASET_DIR / "images"
OUTPUT_NPZ  = DATASET_DIR / "landmarks.npz"

LABELS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
LABEL_TO_IDX = {l: i for i, l in enumerate(LABELS)}

# How many images per letter to process (None = all ~3000 per letter)
# Start with 500 for a quick test, increase to None for full dataset
MAX_PER_LABEL = 500


def download_kaggle_dataset():
    """Download ASL alphabet dataset from Kaggle."""
    DATASET_DIR.mkdir(parents=True, exist_ok=True)

    if KAGGLE_ZIP.exists():
        log.info("Zip already exists, skipping download.")
        return

    log.info("Downloading ASL Alphabet dataset from Kaggle...")
    log.info("Make sure ~/.kaggle/kaggle.json exists with your API key.")
    log.info("Get it from: https://www.kaggle.com/settings → API → Create New Token")

    ret = os.system(
        f"kaggle datasets download -d grassknoted/asl-alphabet -p {DATASET_DIR}"
    )
    if ret != 0:
        log.error("Kaggle download failed. Check your API key and internet connection.")
        sys.exit(1)

    log.info("Download complete.")


def extract_zip():
    """Extract the downloaded zip."""
    if IMAGES_DIR.exists() and any(IMAGES_DIR.iterdir()):
        log.info("Images already extracted, skipping.")
        return

    log.info("Extracting zip...")
    with zipfile.ZipFile(KAGGLE_ZIP, "r") as z:
        z.extractall(DATASET_DIR)
    log.info("Extraction complete.")


def find_image_dirs():
    """Find the train directory with letter subfolders."""
    # Kaggle dataset structure: asl_alphabet_train/asl_alphabet_train/A/*.jpg
    for candidate in DATASET_DIR.rglob("*"):
        if candidate.is_dir() and candidate.name == "A":
            return candidate.parent
    log.error("Could not find image directories. Check extraction.")
    sys.exit(1)


def extract_landmarks_from_images(image_root: Path):
    """Run MediaPipe on each image and extract 63 landmark features."""
    try:
        import cv2
        import mediapipe as mp
    except ImportError:
        log.error("Install opencv-python and mediapipe: pip install opencv-python mediapipe")
        sys.exit(1)

    mp_hands = mp.solutions.hands
    hands = mp_hands.Hands(
        static_image_mode=True,
        max_num_hands=1,
        min_detection_confidence=0.5,
    )

    all_features = []
    all_labels   = []
    skipped      = 0
    stats        = {}

    for label in LABELS:
        label_dir = image_root / label
        if not label_dir.exists():
            log.warning("No directory for label %s", label)
            continue

        images = sorted(label_dir.glob("*.jpg")) + sorted(label_dir.glob("*.png"))
        if MAX_PER_LABEL:
            images = images[:MAX_PER_LABEL]

        label_count = 0
        for img_path in tqdm(images, desc=f"  {label}", leave=False):
            img = cv2.imread(str(img_path))
            if img is None:
                skipped += 1
                continue

            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            result  = hands.process(img_rgb)

            if not result.multi_hand_landmarks:
                skipped += 1
                continue

            lm = result.multi_hand_landmarks[0].landmark
            features = extract_features(lm)
            all_features.append(features)
            all_labels.append(LABEL_TO_IDX[label])
            label_count += 1

        stats[label] = label_count
        log.info("  %s: %d samples", label, label_count)

    hands.close()
    log.info("Skipped %d images (no hand detected)", skipped)
    log.info("Per-label stats: %s", stats)

    return np.array(all_features, dtype=np.float32), np.array(all_labels, dtype=np.int32)


def extract_features(landmarks) -> np.ndarray:
    """
    Convert 21 MediaPipe landmarks to 63 normalized features.
    Matches the normalization used in your existing model:
    wrist-relative + max-abs scaling.
    """
    coords = np.array([[lm.x, lm.y, lm.z] for lm in landmarks], dtype=np.float32)

    # Wrist-relative (subtract landmark 0 = wrist)
    coords -= coords[0]

    # Max-abs scaling (normalize by largest absolute value)
    scale = np.max(np.abs(coords))
    if scale > 1e-6:
        coords /= scale

    return coords.flatten()  # shape (63,)


def save_landmarks(X: np.ndarray, y: np.ndarray):
    """Save extracted landmarks to npz."""
    DATASET_DIR.mkdir(parents=True, exist_ok=True)
    np.savez(OUTPUT_NPZ, X=X, y=y, labels=np.array(LABELS))

    # Print summary
    unique, counts = np.unique(y, return_counts=True)
    summary = {LABELS[i]: int(c) for i, c in zip(unique, counts)}
    log.info("Saved %d samples to %s", len(X), OUTPUT_NPZ)
    log.info("Per-label: %s", summary)

    # Save summary json
    summary_path = DATASET_DIR / "extraction_summary.json"
    summary_path.write_text(json.dumps({
        "total": len(X),
        "per_label": summary,
        "feature_shape": list(X.shape),
    }, indent=2))


def main():
    log.info("=== Step 1: Download & Extract Kaggle ASL Landmarks ===")
    download_kaggle_dataset()
    extract_zip()

    image_root = find_image_dirs()
    log.info("Found images at: %s", image_root)

    log.info("Extracting landmarks (this takes a few minutes)...")
    X, y = extract_landmarks_from_images(image_root)

    if len(X) == 0:
        log.error("No landmarks extracted! Check your images.")
        sys.exit(1)

    save_landmarks(X, y)
    log.info("Done! Run 2_collect_webcam.py next to add your own samples.")


if __name__ == "__main__":
    main()
