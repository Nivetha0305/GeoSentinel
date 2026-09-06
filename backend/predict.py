from pathlib import Path

import joblib
import pandas as pd
from pydantic import BaseModel, Field

from preprocess import FEATURE_COLUMNS, RISK_LABELS

MODEL_PATH = Path(__file__).parent / "flood_model.pkl"
_CACHE = None


class PredictRequest(BaseModel):
    Elevation: float
    Month: int = Field(ge=1, le=12)
    NDVI: float
    NDWI: float
    Rainfall: float
    Slope: float
    VH: float
    VV: float
    latitude: float | None = None
    longitude: float | None = None


def load_model():
    global _CACHE
    if _CACHE is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                "flood_model.pkl not found. Run: python train_model.py"
            )
        _CACHE = joblib.load(MODEL_PATH)
    return _CACHE


def alert_message(risk_level: str) -> str:
    messages = {
        "Low": "Conditions are stable. Continue routine monitoring.",
        "Moderate": "Stay alert. Watch rainfall and local drainage.",
        "High": "High flood risk detected in this location. Immediate preparedness recommended.",
        "Critical": "Critical flash-flood risk. Avoid low-lying and steep runoff paths.",
    }
    return messages.get(risk_level, messages["Moderate"])


def predict_risk(payload: dict) -> dict:
    bundle = load_model()
    model = bundle["model"]
    features = bundle["features"]

    row = pd.DataFrame([{name: payload[name] for name in features}])
    probabilities = model.predict_proba(row)[0]
    predicted_index = int(probabilities.argmax())
    probability = float(probabilities[predicted_index])
    risk_level = RISK_LABELS[predicted_index]

    return {
        "risk_level": risk_level,
        "probability": round(probability, 4),
        "class_index": predicted_index,
        "class_probabilities": {
            RISK_LABELS[i]: round(float(p), 4) for i, p in enumerate(probabilities)
        },
        "alert": alert_message(risk_level),
        "latitude": payload.get("latitude"),
        "longitude": payload.get("longitude"),
        "inputs": {name: payload[name] for name in FEATURE_COLUMNS},
    }
