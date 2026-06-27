from pydantic import BaseModel, Field


class LandmarkPoint(BaseModel):
    x: float
    y: float
    z: float = 0.0


class PredictRequest(BaseModel):
    landmarks: list[LandmarkPoint] = Field(..., min_length=21, max_length=21)


class PredictResponse(BaseModel):
    prediction: str
    confidence: float


class ImagePredictResponse(BaseModel):
    prediction: str
    confidence: float
    landmarks: list[LandmarkPoint]


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    labels: list[str]
