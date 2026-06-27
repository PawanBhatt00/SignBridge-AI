"""Static ASL alphabet hand pose templates (21 MediaPipe landmarks)."""

from __future__ import annotations

import numpy as np

ASL_LABELS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")

# MediaPipe indices: 0 wrist; 1-4 thumb; 5-8 index; 9-12 middle; 13-16 ring; 17-20 pinky
WRIST = 0
THUMB_TIP = 4
INDEX_TIP = 8
MIDDLE_TIP = 12
RING_TIP = 16
PINKY_TIP = 20
INDEX_MCP = 5
MIDDLE_MCP = 9
RING_MCP = 13
PINKY_MCP = 17


def _base_open_hand() -> np.ndarray:
  """Open right hand facing camera (image-normalized coordinates)."""
  return np.array(
    [
      [0.50, 0.56, 0.0],
      [0.46, 0.52, -0.02],
      [0.43, 0.47, -0.03],
      [0.41, 0.40, -0.04],
      [0.39, 0.33, -0.05],
      [0.52, 0.36, 0.0],
      [0.53, 0.27, 0.0],
      [0.54, 0.20, 0.0],
      [0.55, 0.13, 0.0],
      [0.57, 0.35, 0.0],
      [0.58, 0.25, 0.0],
      [0.59, 0.18, 0.0],
      [0.60, 0.12, 0.0],
      [0.62, 0.36, 0.0],
      [0.63, 0.27, 0.0],
      [0.64, 0.20, 0.0],
      [0.65, 0.14, 0.0],
      [0.67, 0.37, 0.0],
      [0.68, 0.29, 0.0],
      [0.69, 0.23, 0.0],
      [0.70, 0.17, 0.0],
    ],
    dtype=np.float32,
  )


def _curl_finger(hand: np.ndarray, mcp: int, tip: int, amount: float) -> None:
  base = hand[mcp].copy()
  tip_vec = hand[tip] - base
  hand[tip] = base + tip_vec * (1.0 - amount)
  for idx in range(mcp + 1, tip):
    frac = (idx - mcp) / max(tip - mcp, 1)
    hand[idx] = base + tip_vec * (1.0 - amount * frac)


def _extend_finger(hand: np.ndarray, mcp: int, tip: int, dy: float = -0.08) -> None:
  for idx in range(mcp, tip + 1):
    hand[idx, 1] += dy * ((idx - mcp) / max(tip - mcp, 1))


def _pose_for_letter(label: str) -> np.ndarray:
  hand = _base_open_hand()

  if label == "A":
    for mcp in (INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP):
      _curl_finger(hand, mcp, mcp + 3, 0.85)
    hand[THUMB_TIP] = hand[INDEX_MCP] + np.array([-0.03, 0.04, 0.0], dtype=np.float32)
  elif label == "B":
    hand[THUMB_TIP] = hand[MIDDLE_MCP] + np.array([-0.05, 0.02, 0.0], dtype=np.float32)
    for mcp in (INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP):
      _extend_finger(hand, mcp, mcp + 3, -0.06)
  elif label == "C":
    for idx in range(1, 21):
      hand[idx, 0] += 0.02 * np.sin(idx * 0.4)
      hand[idx, 1] -= 0.01
  elif label == "D":
    for mcp in (MIDDLE_MCP, RING_MCP, PINKY_MCP):
      _curl_finger(hand, mcp, mcp + 3, 0.8)
    _extend_finger(hand, INDEX_MCP, INDEX_TIP, -0.08)
    hand[THUMB_TIP] = hand[INDEX_MCP] + np.array([0.02, 0.03, 0.0], dtype=np.float32)
  elif label == "E":
    for mcp in (INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP):
      _curl_finger(hand, mcp, mcp + 3, 0.95)
    hand[THUMB_TIP] = hand[WRIST] + np.array([0.04, -0.02, 0.0], dtype=np.float32)
  elif label == "F":
    hand[THUMB_TIP] = hand[INDEX_TIP] + np.array([0.0, 0.02, 0.0], dtype=np.float32)
    for mcp in (MIDDLE_MCP, RING_MCP, PINKY_MCP):
      _extend_finger(hand, mcp, mcp + 3, -0.05)
    _curl_finger(hand, INDEX_MCP, INDEX_TIP, 0.35)
  elif label in {"G", "Q"}:
    _extend_finger(hand, INDEX_MCP, INDEX_TIP, -0.02 if label == "G" else 0.04)
    for mcp in (MIDDLE_MCP, RING_MCP, PINKY_MCP):
      _curl_finger(hand, mcp, mcp + 3, 0.75)
    hand[THUMB_TIP, 0] -= 0.04 if label == "G" else 0.02
  elif label == "H":
    for mcp in (INDEX_MCP, MIDDLE_MCP):
      _extend_finger(hand, mcp, mcp + 3, -0.06)
    for mcp in (RING_MCP, PINKY_MCP):
      _curl_finger(hand, mcp, mcp + 3, 0.8)
    hand[THUMB_TIP, 0] -= 0.03
  elif label in {"I", "J"}:
    for mcp in (INDEX_MCP, MIDDLE_MCP, RING_MCP):
      _curl_finger(hand, mcp, mcp + 3, 0.85)
    _extend_finger(hand, PINKY_MCP, PINKY_TIP, -0.08)
    hand[THUMB_TIP] = hand[PINKY_MCP] + np.array([-0.04, 0.03, 0.0], dtype=np.float32)
  elif label == "K":
    for mcp in (INDEX_MCP, MIDDLE_MCP):
      _extend_finger(hand, mcp, mcp + 3, -0.07)
    for mcp in (RING_MCP, PINKY_MCP):
      _curl_finger(hand, mcp, mcp + 3, 0.8)
    hand[THUMB_TIP] = (hand[INDEX_TIP] + hand[MIDDLE_TIP]) / 2 + np.array([0.0, 0.03, 0.0])
  elif label == "L":
    _extend_finger(hand, INDEX_MCP, INDEX_TIP, -0.08)
    for mcp in (MIDDLE_MCP, RING_MCP, PINKY_MCP):
      _curl_finger(hand, mcp, mcp + 3, 0.85)
    hand[THUMB_TIP] = hand[INDEX_MCP] + np.array([-0.06, 0.05, 0.0], dtype=np.float32)
  elif label == "M":
    for mcp in (INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP):
      _curl_finger(hand, mcp, mcp + 3, 0.7)
    hand[THUMB_TIP] = hand[RING_TIP] + np.array([-0.02, 0.05, 0.0], dtype=np.float32)
  elif label == "N":
    for mcp in (INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP):
      _curl_finger(hand, mcp, mcp + 3, 0.7)
    hand[THUMB_TIP] = hand[MIDDLE_TIP] + np.array([-0.02, 0.05, 0.0], dtype=np.float32)
  elif label == "O":
    center = hand[MIDDLE_MCP].copy()
    for idx in range(1, 21):
      vec = hand[idx] - center
      hand[idx] = center + vec * 0.55
  elif label == "P":
    for mcp in (INDEX_MCP, MIDDLE_MCP):
      _extend_finger(hand, mcp, mcp + 3, 0.03)
    for mcp in (RING_MCP, PINKY_MCP):
      _curl_finger(hand, mcp, mcp + 3, 0.8)
    hand[THUMB_TIP] = hand[MIDDLE_TIP] + np.array([0.0, 0.04, 0.0], dtype=np.float32)
  elif label == "R":
    _extend_finger(hand, INDEX_MCP, INDEX_TIP, -0.06)
    _extend_finger(hand, MIDDLE_MCP, MIDDLE_TIP, -0.04)
    hand[INDEX_TIP, 0] += 0.01
    hand[MIDDLE_TIP, 0] -= 0.01
    for mcp in (RING_MCP, PINKY_MCP):
      _curl_finger(hand, mcp, mcp + 3, 0.8)
  elif label == "S":
    for mcp in (INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP):
      _curl_finger(hand, mcp, mcp + 3, 0.95)
    hand[THUMB_TIP] = hand[INDEX_MCP] + np.array([-0.04, 0.02, 0.0], dtype=np.float32)
  elif label == "T":
    for mcp in (INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP):
      _curl_finger(hand, mcp, mcp + 3, 0.75)
    hand[THUMB_TIP] = (hand[INDEX_TIP] + hand[MIDDLE_TIP]) / 2
  elif label == "U":
    for mcp in (INDEX_MCP, MIDDLE_MCP):
      _extend_finger(hand, mcp, mcp + 3, -0.07)
    for mcp in (RING_MCP, PINKY_MCP):
      _curl_finger(hand, mcp, mcp + 3, 0.8)
  elif label == "V":
    for mcp in (INDEX_MCP, MIDDLE_MCP):
      _extend_finger(hand, mcp, mcp + 3, -0.08)
    for mcp in (RING_MCP, PINKY_MCP):
      _curl_finger(hand, mcp, mcp + 3, 0.85)
  elif label == "W":
    for mcp in (INDEX_MCP, MIDDLE_MCP, RING_MCP):
      _extend_finger(hand, mcp, mcp + 3, -0.06)
    _curl_finger(hand, PINKY_MCP, PINKY_TIP, 0.8)
  elif label == "X":
    _curl_finger(hand, INDEX_MCP, INDEX_TIP, 0.55)
    for mcp in (MIDDLE_MCP, RING_MCP, PINKY_MCP):
      _curl_finger(hand, mcp, mcp + 3, 0.85)
  elif label == "Y":
    hand[THUMB_TIP] = hand[WRIST] + np.array([0.05, -0.01, 0.0], dtype=np.float32)
    _extend_finger(hand, PINKY_MCP, PINKY_TIP, -0.08)
    for mcp in (INDEX_MCP, MIDDLE_MCP, RING_MCP):
      _curl_finger(hand, mcp, mcp + 3, 0.85)
  elif label == "Z":
    for mcp in (INDEX_MCP, MIDDLE_MCP):
      _extend_finger(hand, mcp, mcp + 3, -0.04)
    for mcp in (RING_MCP, PINKY_MCP):
      _curl_finger(hand, mcp, mcp + 3, 0.8)
    hand[INDEX_TIP, 0] += 0.03
    hand[MIDDLE_TIP, 0] -= 0.02

  return hand


def landmarks_for_label(label: str) -> list[dict[str, float]]:
  coords = _pose_for_letter(label.upper())
  return [{"x": float(x), "y": float(y), "z": float(z)} for x, y, z in coords]


def all_pose_seeds() -> list[dict]:
  return [
    {"label": label, "landmarks": landmarks_for_label(label), "source": f"asl_pose:{label}"}
    for label in ASL_LABELS
  ]
