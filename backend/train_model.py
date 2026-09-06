from pathlib import Path

import joblib
from sklearn.metrics import classification_report, accuracy_score
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

from preprocess import FEATURE_COLUMNS, RISK_LABELS, prepare_training_frame

MODEL_PATH = Path(__file__).parent / "flood_model.pkl"


def train():
    df = prepare_training_frame()
    X = df[FEATURE_COLUMNS]
    y = df["flood_risk"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    model = XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.08,
        subsample=0.85,
        colsample_bytree=0.85,
        objective="multi:softprob",
        num_class=len(RISK_LABELS),
        eval_metric="mlogloss",
        n_jobs=-1,
        random_state=42,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)

    print("Test accuracy:", round(accuracy, 4))
    print("\nClassification report:")
    print(classification_report(y_test, y_pred, target_names=RISK_LABELS))

    payload = {
        "model": model,
        "features": FEATURE_COLUMNS,
        "labels": RISK_LABELS,
    }
    joblib.dump(payload, MODEL_PATH)
    print("Saved model:", MODEL_PATH.resolve())
    return MODEL_PATH


if __name__ == "__main__":
    train()
