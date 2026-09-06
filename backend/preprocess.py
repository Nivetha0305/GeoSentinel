import pandas as pd
from pathlib import Path

FEATURE_COLUMNS = [
    "Elevation",
    "Month",
    "NDVI",
    "NDWI",
    "Rainfall",
    "Slope",
    "VH",
    "VV",
]

RISK_LABELS = ["Low", "Moderate", "High", "Critical"]


def load_dataset():
    data_folder = Path(__file__).parent.parent / "data"
    csv_files = list(data_folder.glob("*.csv"))

    if not csv_files:
        raise FileNotFoundError("No CSV file found in data folder.")

    return pd.read_csv(csv_files[0])


def clean_dataset(df):
    df = df.dropna(how="all")
    df = df.drop_duplicates()
    df = df.replace([float("inf"), float("-inf")], pd.NA)

    for column in FEATURE_COLUMNS + ["latitude", "longitude"]:
        if column in df.columns:
            df[column] = pd.to_numeric(df[column], errors="coerce")

    df = df.dropna(subset=FEATURE_COLUMNS)
    return df.reset_index(drop=True)


def create_flood_risk(df):
    """
    CSV has no flood label. Build a physics-inspired target for the prototype:

    Rainfall (main trigger) + wet surface (NDWI) + steep slope
    + low vegetation (NDVI) + monsoon months.
    """
    rain = df["Rainfall"]
    score = pd.Series(0, index=df.index, dtype=int)

    score += (rain >= 80).astype(int)
    score += (rain >= 180).astype(int)
    score += (rain >= 290).astype(int)
    score += (df["NDWI"] >= -0.41).astype(int)
    score += (df["Slope"] >= 21.7).astype(int)
    score += (df["NDVI"] <= 0.37).astype(int)
    score += (df["Month"].between(6, 11) & (rain >= 100)).astype(int)

    return pd.cut(score, bins=[-1, 1, 2, 4, 20], labels=[0, 1, 2, 3]).astype(int)


def prepare_training_frame(df=None):
    if df is None:
        df = load_dataset()

    df = clean_dataset(df)
    df = df.copy()
    df["flood_risk"] = create_flood_risk(df)
    return df


if __name__ == "__main__":
    df = load_dataset()
    print("Original shape:", df.shape)

    prepared = prepare_training_frame(df)
    print("Cleaned shape:", prepared.shape)
    print("\nMissing values:")
    print(prepared[FEATURE_COLUMNS].isnull().sum())

    print("\nFlood risk class counts:")
    counts = prepared["flood_risk"].value_counts().sort_index()
    for code, count in counts.items():
        print(f"  {code} {RISK_LABELS[code]}: {count}")
