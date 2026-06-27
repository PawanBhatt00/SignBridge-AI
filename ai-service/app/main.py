"""SignBridge AI Service - FastAPI application."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.landmarks import HandLandmarkExtractor
from app.predictor import ASLClassifier, ASL_LABELS
from app.schemas import (
  HealthResponse,
  ImagePredictResponse,
  LandmarkPoint,
  PredictRequest,
  PredictResponse,
)

logging.basicConfig(level=settings.log_level)
logger = logging.getLogger(__name__)

extractor: HandLandmarkExtractor | None = None
classifier: ASLClassifier | None = None


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
  global extractor, classifier
  extractor = HandLandmarkExtractor()
  classifier = ASLClassifier()
  logger.info("AI service started")
  yield
  if extractor:
    extractor.close()
  logger.info("AI service stopped")


app = FastAPI(
  title="SignBridge AI Service",
  description="ASL hand gesture recognition using MediaPipe and TensorFlow",
  version="1.0.0",
  lifespan=lifespan,
)

app.add_middleware(
  CORSMiddleware,
  allow_origins=settings.cors_origin_list,
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
  return HealthResponse(
    status="ok",
    model_loaded=classifier is not None
    and (classifier.model is not None or classifier.numpy_model is not None),
    labels=classifier.labels if classifier else ASL_LABELS,
  )


@app.post("/predict", response_model=PredictResponse)
async def predict_from_landmarks(body: PredictRequest) -> PredictResponse:
  if classifier is None or extractor is None:
    raise HTTPException(status_code=503, detail="Service not ready")

  landmarks = [{"x": p.x, "y": p.y, "z": p.z} for p in body.landmarks]
  features = extractor.normalize_landmarks(landmarks)
  prediction, confidence = classifier.predict(features)

  if confidence < settings.confidence_threshold:
    prediction = ""

  return PredictResponse(prediction=prediction, confidence=round(confidence, 4))


@app.post("/predict/image", response_model=ImagePredictResponse)
async def predict_from_image(file: UploadFile = File(...)) -> ImagePredictResponse:
  if classifier is None or extractor is None:
    raise HTTPException(status_code=503, detail="Service not ready")

  contents = await file.read()
  landmarks = extractor.extract_from_image_bytes(contents)
  if landmarks is None:
    raise HTTPException(status_code=422, detail="No hand detected in image")

  features = extractor.normalize_landmarks(landmarks)
  prediction, confidence = classifier.predict(features)

  if confidence < settings.confidence_threshold:
    prediction = ""

  return ImagePredictResponse(
    prediction=prediction,
    confidence=round(confidence, 4),
    landmarks=[LandmarkPoint(**lm) for lm in landmarks],
  )


@app.post("/predict/base64", response_model=ImagePredictResponse)
async def predict_from_base64(payload: dict[str, str]) -> ImagePredictResponse:
  if classifier is None or extractor is None:
    raise HTTPException(status_code=503, detail="Service not ready")

  image_data = payload.get("image", "")
  if not image_data:
    raise HTTPException(status_code=400, detail="Missing 'image' field")

  landmarks = extractor.extract_from_base64(image_data)
  if landmarks is None:
    raise HTTPException(status_code=422, detail="No hand detected in image")

  features = extractor.normalize_landmarks(landmarks)
  prediction, confidence = classifier.predict(features)

  if confidence < settings.confidence_threshold:
    prediction = ""

  return ImagePredictResponse(
    prediction=prediction,
    confidence=round(confidence, 4),
    landmarks=[LandmarkPoint(**lm) for lm in landmarks],
  )
