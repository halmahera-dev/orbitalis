"""Add WorldPop people to every cell of out/nisar-run.json.

WorldPop R2025A, 2026, constrained, 100 m (about 170 MB for Indonesia). The server refuses range
requests, so the job downloads the file once into out/. Each population pixel goes to the cell
whose square holds its centre; pixels outside every measured cell are left out.
Run after stack_nisar_rate.py: `uv run fetch_worldpop.py`.
"""

import json
from pathlib import Path

import numpy as np
import rasterio
import requests
from pyproj import Transformer
from rasterio.windows import from_bounds
from scipy.spatial import cKDTree

JOBS_DIR = Path(__file__).resolve().parent
RUN_PATH = JOBS_DIR / "out" / "nisar-run.json"
WORLDPOP_URL = (
    "https://data.worldpop.org/GIS/Population/Global_2015_2030/R2025A/2026/IDN/v1/100m/"
    "constrained/idn_pop_2026_CN_100m_R2025A_v1.tif"
)
WORLDPOP_PATH = JOBS_DIR / "out" / "worldpop" / Path(WORLDPOP_URL).name
UTM_JAKARTA = 32748
BOUNDS_MARGIN_DEGREES = 0.01


def download_once() -> None:
    if WORLDPOP_PATH.exists():
        return
    WORLDPOP_PATH.parent.mkdir(parents=True, exist_ok=True)
    partial = WORLDPOP_PATH.with_suffix(".part")
    with requests.get(WORLDPOP_URL, stream=True, timeout=120) as response:
        response.raise_for_status()
        with partial.open("wb") as file:
            for chunk in response.iter_content(chunk_size=1 << 20):
                file.write(chunk)
    partial.rename(WORLDPOP_PATH)


def read_population(lons, lats):
    with rasterio.open(WORLDPOP_PATH) as source:
        window = from_bounds(
            lons.min() - BOUNDS_MARGIN_DEGREES,
            lats.min() - BOUNDS_MARGIN_DEGREES,
            lons.max() + BOUNDS_MARGIN_DEGREES,
            lats.max() + BOUNDS_MARGIN_DEGREES,
            source.transform,
        )
        values = source.read(1, window=window, masked=True).filled(0)
        transform = source.window_transform(window)
    rows, columns = np.nonzero(values > 0)
    pixel_lons, pixel_lats = rasterio.transform.xy(transform, rows, columns)
    return np.asarray(pixel_lons), np.asarray(pixel_lats), values[rows, columns]


def people_per_cell(cells: list[dict], cell_size_m: int) -> np.ndarray:
    to_utm = Transformer.from_crs(4326, UTM_JAKARTA, always_xy=True)
    cell_lons = np.array([cell["center"][0] for cell in cells])
    cell_lats = np.array([cell["center"][1] for cell in cells])
    cell_x, cell_y = to_utm.transform(cell_lons, cell_lats)
    pixel_lons, pixel_lats, people = read_population(cell_lons, cell_lats)
    pixel_x, pixel_y = to_utm.transform(pixel_lons, pixel_lats)

    _, nearest = cKDTree(np.column_stack([cell_x, cell_y])).query(np.column_stack([pixel_x, pixel_y]))
    half = cell_size_m / 2
    is_inside = (np.abs(pixel_x - cell_x[nearest]) <= half) & (np.abs(pixel_y - cell_y[nearest]) <= half)
    return np.bincount(nearest[is_inside], weights=people[is_inside], minlength=len(cells))


def main() -> None:
    download_once()
    run = json.loads(RUN_PATH.read_text(encoding="utf-8"))
    totals = people_per_cell(run["cells"], run["cellSizeM"])
    for cell, total in zip(run["cells"], totals):
        cell["people"] = int(round(total))
    RUN_PATH.write_text(json.dumps(run, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(f"people in {len(totals)} cells: {int(totals.sum()):,}, max {int(totals.max()):,}")


if __name__ == "__main__":
    main()
