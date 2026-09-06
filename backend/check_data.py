import pandas as pd
from pathlib import Path

# Find the data folder
data_folder = Path(__file__).parent.parent / "data"

# Find CSV file automatically
csv_files = list(data_folder.glob("*.csv"))

if not csv_files:
    print("❌ No CSV file found in the data folder.")
else:
    csv_path = csv_files[0]

    print("CSV found:", csv_path)

    df = pd.read_csv(csv_path)

    print("\n✅ Dataset loaded successfully!")
    print("Rows:", len(df))
    print("Columns:", len(df.columns))

    print("\nColumn names:")
    print(df.columns.tolist())

    print("\nFirst 5 rows:")
    print(df.head())