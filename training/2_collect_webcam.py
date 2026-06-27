"""
STEP 2 — Collect your own hand samples via webcam.

Usage:
    python3 2_collect_webcam.py

Controls:
    SPACE  — capture current frame as a sample
    ENTER  — move to next letter
    Q      — quit and save

Output:
    datasets/asl/real/webcam_landmarks.npz
"""

import json
import logging
import numpy as np
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

REPO_ROOT   = Path(__file__).resolve().parent.parent
OUTPUT_NPZ  = REPO_ROOT / "datasets" / "asl" / "real" / "webcam_landmarks.npz"
LABELS      = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
LABEL_TO_IDX = {l: i for i, l in enumerate(LABELS)}

# Samples to collect per letter
SAMPLES_PER_LETTER = 100


def extract_features(landmarks) -> np.ndarray:
    """Wrist-relative + max-abs scaling — same as training pipeline."""
    coords = np.array([[lm.x, lm.y, lm.z] for lm in landmarks], dtype=np.float32)
    coords -= coords[0]
    scale = np.max(np.abs(coords))
    if scale > 1e-6:
        coords /= scale
    return coords.flatten()


def collect():
    try:
        import cv2
        import mediapipe as mp
    except ImportError:
        log.error("pip install opencv-python mediapipe")
        return

    mp_hands = mp.solutions.hands
    hands    = mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=1,
        min_detection_confidence=0.7,
        min_tracking_confidence=0.5,
    )
    mp_draw  = mp.solutions.drawing_utils
    cap      = cv2.VideoCapture(0)

    all_features = []
    all_labels   = []
    stats        = {}

    for label in LABELS:
        log.info("Collecting samples for: %s", label)
        collected = 0

        while collected < SAMPLES_PER_LETTER:
            ret, frame = cap.read()
            if not ret:
                break

            frame   = cv2.flip(frame, 1)
            rgb     = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result  = hands.process(rgb)

            # Draw landmarks
            hand_detected = False
            if result.multi_hand_landmarks:
                hand_detected = True
                for hand_lm in result.multi_hand_landmarks:
                    mp_draw.draw_landmarks(frame, hand_lm, mp_hands.HAND_CONNECTIONS)

            # UI overlay
            h, w = frame.shape[:2]
            status_color = (0, 255, 0) if hand_detected else (0, 0, 255)
            cv2.rectangle(frame, (0, 0), (w, 80), (0, 0, 0), -1)
            cv2.putText(frame, f"Letter: {label}  ({collected}/{SAMPLES_PER_LETTER})",
                        (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
            cv2.putText(frame, "SPACE=Capture  ENTER=Next Letter  Q=Quit",
                        (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
            cv2.circle(frame, (w - 20, 20), 10, status_color, -1)

            # Progress bar
            progress = int(w * collected / SAMPLES_PER_LETTER)
            cv2.rectangle(frame, (0, h - 10), (progress, h), (0, 255, 100), -1)

            cv2.imshow("SignBridge — Data Collector", frame)
            key = cv2.waitKey(1) & 0xFF

            if key == ord("q"):
                log.info("Quit early.")
                cap.release()
                hands.close()
                cv2.destroyAllWindows()
                save(all_features, all_labels, stats)
                return

            elif key == 13:  # ENTER — skip to next letter
                log.info("Skipping %s (collected %d)", label, collected)
                break

            elif key == 32:  # SPACE — capture
                if hand_detected and result.multi_hand_landmarks:
                    lm       = result.multi_hand_landmarks[0].landmark
                    features = extract_features(lm)
                    all_features.append(features)
                    all_labels.append(LABEL_TO_IDX[label])
                    collected += 1

                    # Flash green to confirm capture
                    overlay = frame.copy()
                    cv2.rectangle(overlay, (0, 0), (w, h), (0, 255, 0), -1)
                    cv2.addWeighted(overlay, 0.2, frame, 0.8, 0, frame)
                    cv2.imshow("SignBridge — Data Collector", frame)
                    cv2.waitKey(100)
                else:
                    # Flash red — no hand
                    overlay = frame.copy()
                    cv2.rectangle(overlay, (0, 0), (w, h), (0, 0, 255), -1)
                    cv2.addWeighted(overlay, 0.2, frame, 0.8, 0, frame)
                    cv2.imshow("SignBridge — Data Collector", frame)
                    cv2.waitKey(100)

            # Auto-capture when hand detected (hold still for a second)
            elif hand_detected and result.multi_hand_landmarks and collected < SAMPLES_PER_LETTER:
                # Auto mode: capture every 15 frames automatically
                if hasattr(collect, '_auto_counter'):
                    collect._auto_counter += 1
                else:
                    collect._auto_counter = 0

                if collect._auto_counter % 15 == 0:
                    lm       = result.multi_hand_landmarks[0].landmark
                    features = extract_features(lm)
                    all_features.append(features)
                    all_labels.append(LABEL_TO_IDX[label])
                    collected += 1

        stats[label] = collected
        collect._auto_counter = 0

    cap.release()
    hands.close()
    cv2.destroyAllWindows()
    save(all_features, all_labels, stats)


def save(features, labels, stats):
    if not features:
        log.warning("No samples collected.")
        return

    X = np.array(features, dtype=np.float32)
    y = np.array(labels,   dtype=np.int32)

    OUTPUT_NPZ.parent.mkdir(parents=True, exist_ok=True)
    np.savez(OUTPUT_NPZ, X=X, y=y, labels=np.array(LABELS))

    log.info("Saved %d webcam samples to %s", len(X), OUTPUT_NPZ)
    log.info("Per-label: %s", stats)

    summary_path = OUTPUT_NPZ.parent / "webcam_summary.json"
    summary_path.write_text(json.dumps({
        "total": len(X),
        "per_label": stats,
    }, indent=2))


if __name__ == "__main__":
    collect()
