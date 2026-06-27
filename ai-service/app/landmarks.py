"""Hand landmark utilities (MediaPipe optional for image extraction)."""

from __future__ import annotations

import base64
import logging

import numpy as np

logger = logging.getLogger(__name__)


class HandLandmarkExtractor:
  """Normalize landmarks; optionally extract from images when MediaPipe is installed."""

  def __init__(self) -> None:
    self._hands = None
    self._cv2 = None
    try:
      import cv2
      import mediapipe as mp

      self._cv2 = cv2
      self._hands = mp.solutions.hands.Hands(
        static_image_mode=True,
        max_num_hands=1,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
      )
      logger.info("MediaPipe hand extractor initialized")
    except ImportError:
      logger.warning("MediaPipe/OpenCV unavailable — image endpoints disabled")

  def extract_from_image_bytes(self, image_bytes: bytes) -> list[dict[str, float]] | None:
    if self._hands is None or self._cv2 is None:
      return None
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = self._cv2.imdecode(nparr, self._cv2.IMREAD_COLOR)
    if image is None:
      return None
    return self.extract_from_bgr(image)

  def extract_from_base64(self, b64_data: str) -> list[dict[str, float]] | None:
    if "," in b64_data:
      b64_data = b64_data.split(",", 1)[1]
    image_bytes = base64.b64decode(b64_data)
    return self.extract_from_image_bytes(image_bytes)

  def extract_from_bgr(self, image_bgr: np.ndarray) -> list[dict[str, float]] | None:
    if self._hands is None or self._cv2 is None:
      return None
    image_rgb = self._cv2.cvtColor(image_bgr, self._cv2.COLOR_BGR2RGB)
    results = self._hands.process(image_rgb)
    if not results.multi_hand_landmarks:
      return None

    hand_landmarks = results.multi_hand_landmarks[0]
    landmarks: list[dict[str, float]] = []
    for lm in hand_landmarks.landmark:
      landmarks.append({"x": lm.x, "y": lm.y, "z": lm.z})
    return landmarks

  def normalize_landmarks(self, landmarks: list[dict[str, float]]) -> np.ndarray:
    coords = np.array([[p["x"], p["y"], p.get("z", 0.0)] for p in landmarks], dtype=np.float32)
    wrist = coords[0].copy()
    coords -= wrist
    max_val = np.max(np.abs(coords))
    if max_val > 0:
      coords /= max_val
    return coords.flatten()

  def close(self) -> None:
    if self._hands is not None:
      self._hands.close()
