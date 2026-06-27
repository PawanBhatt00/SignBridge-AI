#!/usr/bin/env python3
"""Initial dataset loader for SignBridge AI."""

from __future__ import annotations

import json
import sys
from pathlib import Path

DATASETS_DIR = Path(__file__).parent.parent


def load_labels() -> list[str]:
    labels_file = DATASETS_DIR / "labels" / "asl_alphabet.json"
    data = json.loads(labels_file.read_text())
    return data["labels"]


def load_samples() -> list[dict]:
    samples_file = DATASETS_DIR / "processed" / "samples.json"
    if not samples_file.exists():
        print(f"No samples found at {samples_file}")
        return []
    return json.loads(samples_file.read_text())


def export_for_training(output_path: Path | None = None) -> Path:
    """Export processed dataset for AI service training."""
    labels = load_labels()
    samples = load_samples()

    output = output_path or DATASETS_DIR / "processed" / "training_export.json"
    export_data = {
        "labels": labels,
        "samples": samples,
        "count": len(samples),
    }
    output.write_text(json.dumps(export_data, indent=2))
    print(f"Exported {len(samples)} samples to {output}")
    return output


def main() -> None:
    labels = load_labels()
    samples = load_samples()
    print(f"ASL Labels ({len(labels)}): {', '.join(labels)}")
    print(f"Samples loaded: {len(samples)}")

    if "--export" in sys.argv:
        export_for_training()


if __name__ == "__main__":
    main()
