import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.predictor import ASL_LABELS


@pytest.fixture
def client():
  with TestClient(app) as c:
    yield c


def test_health(client):
  response = client.get("/health")
  assert response.status_code == 200
  data = response.json()
  assert data["status"] == "ok"
  assert data["model_loaded"] is True
  assert len(data["labels"]) == len(ASL_LABELS)


def test_predict_landmarks(client):
  landmarks = [{"x": 0.5, "y": 0.5, "z": 0.0} for _ in range(21)]
  response = client.post("/predict", json={"landmarks": landmarks})
  assert response.status_code == 200
  data = response.json()
  assert "prediction" in data
  assert "confidence" in data
  assert isinstance(data["confidence"], float)


def test_predict_invalid_landmarks(client):
  landmarks = [{"x": 0.5, "y": 0.5} for _ in range(10)]
  response = client.post("/predict", json={"landmarks": landmarks})
  assert response.status_code == 422
