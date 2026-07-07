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
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s",
)

ASL_LABELS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")


def load_dataset_info() -> dict:
    """Load dataset metadata if available."""
    if DATASET_INFO.exists():
        return json.loads(DATASET_INFO.read_text())

    return {"labels": ASL_LABELS}


def normalize_landmarks(
    landmarks: list[dict[str, float]],
) -> np.ndarray:
    """
    Normalize landmarks relative to the wrist.
    """

    coords = np.array(
        [
            [p["x"], p["y"], p.get("z", 0.0)]
            for p in landmarks
        ],
        dtype=np.float32,
    )

    wrist = coords[0].copy()
    coords -= wrist

    max_val = np.max(np.abs(coords))

    if max_val > 0:
        coords /= max_val

    return coords.flatten()


def load_json_samples(path: Path) -> list[dict]:
    """Load samples.json format."""

    if not path.exists():
        return []

    data = json.loads(path.read_text())

    if isinstance(data, list):
        return data

    return data.get("samples", [])


def load_seed_samples() -> list[dict]:
    """
    Load existing manually recorded samples.

    Synthetic and augmented samples are ignored.
    """

    seeds: list[dict] = []

    seeds.extend(load_json_samples(LEGACY_SAMPLES))

    if SAMPLES_JSON.exists():

        for sample in load_json_samples(SAMPLES_JSON):

            source = str(sample.get("source", ""))

            if source.startswith("augment:"):
                continue

            if source.startswith("synthetic:"):
                continue

            if not source and sample.get("label"):
                seeds.append(sample)
                continue

            if source:
                seeds.append(sample)

    logger.info(
        "Loaded %d manual landmark samples.",
        len(seeds),
    )

    return seeds


def extract_from_images(
    raw_dir: Path,
    extractor: HandLandmarkExtractor,
) -> list[dict]:
    """
    Extract MediaPipe landmarks from every image
    inside the Kaggle ASL dataset.
    """

    samples: list[dict] = []

    if not raw_dir.exists():
        logger.error("Dataset folder not found: %s", raw_dir)
        return samples

    logger.info("Scanning dataset: %s", raw_dir)

    for label_dir in sorted(raw_dir.iterdir()):

        if not label_dir.is_dir():
            continue

        label = label_dir.name.upper()

        if label not in ASL_LABELS:
            logger.warning(
                "Skipping unsupported label folder: %s",
                label,
            )
            continue

        image_files = sorted(
            p
            for p in label_dir.iterdir()
            if p.suffix.lower() in IMAGE_EXTENSIONS
        )

        logger.info(
            "Processing %s (%d images)",
            label,
            len(image_files),
        )

        for image_path in image_files:

            try:

                landmarks = extractor.extract_from_image_bytes(
                    image_path.read_bytes()
                )

                if landmarks is None:
                    continue

                samples.append(
                    {
                        "label": label,
                        "landmarks": landmarks,
                        "source": str(image_path),
                    }
                )

                if len(samples) % 500 == 0:
                    logger.info(
                        "Processed %d images...",
                        len(samples),
                    )

            except Exception as exc:
                logger.warning(
                    "Failed: %s (%s)",
                    image_path.name,
                    exc,
                )

    logger.info(
        "Finished extracting %d landmark samples.",
        len(samples),
    )

    return samples


def augment_sample(
    landmarks: list[dict[str, float]],
    label: str,
    n_augments: int,
    rng: np.random.Generator,
) -> list[dict]:
    """
    Generate augmented landmark samples by adding small Gaussian noise.

    Args:
        landmarks: Original 21 hand landmarks.
        label: ASL label (A-Z).
        n_augments: Number of augmented samples to create.
        rng: NumPy random generator.

    Returns:
        List of augmented landmark samples.
    """

    # Normalize the original landmarks
    base = normalize_landmarks(landmarks).reshape(21, 3)

    augmented: list[dict] = []

    for i in range(n_augments):

        # Add small random noise
        noise = rng.normal(
            loc=0.0,
            scale=0.012,
            size=base.shape,
        ).astype(np.float32)

        coords = base + noise

        # Keep wrist at origin
        wrist = coords[0].copy()
        coords -= wrist

        # Normalize scale
        max_val = np.max(np.abs(coords))
        if max_val > 0:
            coords /= max_val

        # Flatten back into MediaPipe landmark format
        flat = coords.flatten()

        lm = [
            {
                "x": float(flat[j * 3]),
                "y": float(flat[j * 3 + 1]),
                "z": float(flat[j * 3 + 2]),
            }
            for j in range(21)
        ]

        augmented.append(
            {
                "label": label,
                "landmarks": lm,
                "source": f"augment:{label}:{i}",
            }
        )

    # IMPORTANT: return the generated samples
    return augmented
def build_dataset(
    augment_per_sample: int = 1,
    pose_augments_per_label: int = 0,
) -> tuple[np.ndarray, np.ndarray, list[dict]]:
    """
    Build the complete training dataset.

    Priority:
    1. Real Kaggle images
    2. Existing manual landmark samples
    3. Anatomical pose templates (only if a label has no real samples)
    """

    extractor = HandLandmarkExtractor()
    rng = np.random.default_rng(42)

    logger.info("Loading real image dataset...")

    collected: list[dict] = []

    # Extract landmarks from Kaggle images
    collected.extend(
        extract_from_images(RAW_DIR, extractor)
    )

    # Existing manually recorded samples
    collected.extend(
        load_seed_samples()
    )

    # Legacy samples
    collected.extend(
        load_json_samples(LEGACY_SAMPLES)
    )

    logger.info(
        "Collected %d raw samples.",
        len(collected),
    )

    pose_by_label = {
        sample["label"]: sample
        for sample in all_pose_seeds()
    }

    by_label: dict[str, list[dict]] = {
        label: []
        for label in ASL_LABELS
    }

    # Group samples by label
    for sample in collected:

        label = str(
            sample.get("label", "")
        ).upper()

        landmarks = sample.get("landmarks")

        if (
            label in by_label
            and isinstance(landmarks, list)
            and len(landmarks) == 21
        ):
            by_label[label].append(sample)

    logger.info("Dataset distribution:")

    for label in ASL_LABELS:
        logger.info(
            "%s : %d",
            label,
            len(by_label[label]),
        )

    expanded: list[dict] = []

    for label in ASL_LABELS:

        seeds = by_label[label]

        # Only fall back to anatomical pose
        # when NO real images exist.
        if not seeds:

            logger.warning(
                "No real samples for %s. Using pose template.",
                label,
            )

            seeds = [pose_by_label[label]]

        for seed in seeds:

            expanded.append(seed)

            if augment_per_sample > 0:

                expanded.extend(
                    augment_sample(
                        seed["landmarks"],
                        label,
                        augment_per_sample,
                        rng,
                    )
                )

        # Extra pose augmentation ONLY if no real data exists
        if (
            len(by_label[label]) == 0
            and pose_augments_per_label > 0
        ):

            pose_seed = pose_by_label[label]

            expanded.extend(
                augment_sample(
                    pose_seed["landmarks"],
                    label,
                    pose_augments_per_label,
                    rng,
                )
            )

    logger.info(
        "Expanded dataset size: %d",
        len(expanded),
    )

    X_list: list[np.ndarray] = []
    y_list: list[int] = []

    logger.info(
        "Converting landmarks into feature vectors..."
    )

    for sample in expanded:

        X_list.append(
            normalize_landmarks(
                sample["landmarks"]
            )
        )

        y_list.append(
            ASL_LABELS.index(
                sample["label"]
            )
        )

    X = np.stack(
        X_list
    ).astype(np.float32)

    y = np.array(
        y_list,
        dtype=np.int32,
    )

    logger.info(
        "Feature matrix shape: %s",
        X.shape,
    )

    logger.info(
        "Labels shape: %s",
        y.shape,
    )

    extractor.close()

    return (
        X,
        y,
        expanded,
    )
def main() -> None:
    """
    Main preprocessing pipeline.

    Extracts MediaPipe landmarks from the Kaggle ASL dataset,
    normalizes them, generates training features, and stores
    the processed dataset for training.
    """

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    logger.info("=" * 60)
    logger.info("SignBridge ASL Dataset Preprocessing")
    logger.info("=" * 60)

    info = load_dataset_info()

    info.update(
        {
            "name": "SignBridge ASL Alphabet",
            "version": "2.0.0",
            "labels": ASL_LABELS,
            "landmarks_per_hand": 21,
            "feature_size": 63,
            "normalization": "wrist-relative, max-abs scaling",
            "training_standardization": "z-score (stored in model)",
            "notes": "MediaPipe landmarks extracted from Kaggle ASL Alphabet dataset.",
            "sources": [
                str(RAW_DIR),
            ],
            "repo_root": str(REPO_ROOT),
        }
    )

    DATASET_INFO.write_text(
        json.dumps(info, indent=2)
    )

    logger.info("Building dataset...")

    X, y, samples = build_dataset()

    logger.info("Saving processed dataset...")

    SAMPLES_JSON.write_text(
        json.dumps(samples, indent=2)
    )

    np.savez(
        FEATURES_NPZ,
        X=X,
        y=y,
        labels=np.array(ASL_LABELS),
    )

    counts = {
        label: int(np.sum(y == idx))
        for idx, label in enumerate(ASL_LABELS)
    }

    summary = {
        "total_samples": int(len(y)),
        "feature_shape": list(X.shape),
        "num_classes": len(ASL_LABELS),
        "per_label_counts": counts,
        "outputs": {
            "samples_json": str(SAMPLES_JSON),
            "features_npz": str(FEATURES_NPZ),
            "dataset_info": str(DATASET_INFO),
        },
    }

    summary_file = PROCESSED_DIR / "preprocess_summary.json"

    summary_file.write_text(
        json.dumps(summary, indent=2)
    )

    logger.info("Saved:")
    logger.info("  %s", FEATURES_NPZ)
    logger.info("  %s", SAMPLES_JSON)
    logger.info("  %s", DATASET_INFO)
    logger.info("  %s", summary_file)

    print("\n")
    print("=" * 60)
    print("PREPROCESS COMPLETE")
    print("=" * 60)
    print(f"Total Samples      : {len(y):,}")
    print(f"Feature Matrix     : {X.shape}")
    print(f"Number of Classes  : {len(ASL_LABELS)}")
    print(f"Processed Dataset  : {FEATURES_NPZ}")
    print("=" * 60)
    print()

    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()