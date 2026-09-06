from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from predict import PredictRequest, load_model, predict_risk
from preprocess import FEATURE_COLUMNS, RISK_LABELS, prepare_training_frame

app = FastAPI(title="GeoSentinel API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    try:
        load_model()
    except FileNotFoundError:
        pass


@app.get("/")
def home():
    return {
        "message": "GeoSentinel Backend is Running",
        "docs": "/docs",
        "endpoints": ["/health", "/stats", "/predict", "/map-data"],
    }


@app.get("/health")
def health():
    model_ready = True
    try:
        load_model()
    except FileNotFoundError:
        model_ready = False

    return {
        "status": "healthy",
        "model_ready": model_ready,
    }


@app.get("/stats")
def stats():
    df = prepare_training_frame()
    counts = df["flood_risk"].value_counts().sort_index()
    return {
        "rows": int(len(df)),
        "years": f"{int(df['Year'].min())}-{int(df['Year'].max())}" if "Year" in df.columns else "2022-2024",
        "region": "Nilgiris, Tamil Nadu",
        "average_rainfall_mm": round(float(df["Rainfall"].mean()), 1),
        "risk_counts": {
            RISK_LABELS[int(code)]: int(count) for code, count in counts.items()
        },
    }


@app.post("/predict")
def predict(body: PredictRequest):
    try:
        return predict_risk(body.model_dump())
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/map-data")
def map_data(limit: int = 900):
    try:
        bundle = load_model()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    df = prepare_training_frame()
    sample = df.sample(n=min(limit, len(df)), random_state=42).copy()
    labels = bundle["labels"]
    probabilities = bundle["model"].predict_proba(sample[FEATURE_COLUMNS])
    class_index = probabilities.argmax(axis=1)

    points = []
    for i, (_, row) in enumerate(sample.iterrows()):
        idx = int(class_index[i])
        points.append(
            {
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
                "risk_level": labels[idx],
                "probability": round(float(probabilities[i][idx]), 4),
                "Rainfall": float(row["Rainfall"]),
                "NDWI": float(row["NDWI"]),
                "Slope": float(row["Slope"]),
                "Elevation": float(row["Elevation"]),
                "Month": int(row["Month"]),
                "NDVI": float(row["NDVI"]),
                "VH": float(row["VH"]),
                "VV": float(row["VV"]),
            }
        )

    return {"count": len(points), "points": points}
