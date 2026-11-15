"""Stack the NISAR GUNW pairs over North Jakarta into one local sinking rate per bowl.

Each pair is masked, corrected for the ionosphere and the incidence angle, and smoothed. The
regional ramp (atmosphere, orbit, and the slow sinking of the whole city) is removed, so the
rate is relative to the ground around each bowl, not an absolute rate. Stacking adds the pairs
and divides by the total time, which lowers the water vapor noise. This is not a MintPy time
series, and one ascending track gives line-of-sight motion shown as vertical.
"""

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from pyproj import Transformer
from scipy import ndimage

from detect_bowls import (
    DETECTION_SNR,
    LOCAL_SIGMA_PIXELS,
    PEAK_NEIGHBOURHOOD_PIXELS,
    REGIONAL_SIGMA_PIXELS,
    PairWindow,
    find_usable_pixels,
    masked_gaussian,
    measure_bowl_radius_pixels,
    render_panel,
    robust_noise,
    sinking_millimeters,
)

JOBS_DIR = Path(__file__).resolve().parent
WINDOW_DIR = JOBS_DIR / "out" / "gunw"
PREVIEW_PATH = JOBS_DIR / "out" / "nisar-stack-rate.png"
WEB_APP = JOBS_DIR.parent / "web"
BOWLS_PATH = WEB_APP / "src" / "features" / "bowls" / "bowls-seed.json"
RATES_PATH = WEB_APP / "src" / "features" / "nisar" / "nisar-rates.json"
DAYS_PER_YEAR = 365.0
MIN_PAIRS_PER_PIXEL = 5
MIN_BOWL_RADIUS_PIXELS = 1.5
MIN_CANDIDATE_RADIUS_PIXELS = 2
MIN_RATE_TO_UNCERTAINTY = 2


@dataclass(frozen=True)
class StackedRate:
    rate: np.ndarray
    uncertainty: np.ndarray
    pair_count: np.ndarray
    window: PairWindow
    pair_dates: list[tuple[str, str]]


def load_window(path: Path) -> tuple[PairWindow, tuple[str, str]]:
    stored = np.load(path)
    window = PairWindow(
        phase=stored["phase"],
        ionosphere=stored["ionosphere"],
        coherence=stored["coherence"],
        components=stored["components"],
        mask=stored["mask"],
        xs=stored["xs"],
        ys=stored["ys"],
        epsg=int(stored["epsg"]),
        wavelength_m=float(stored["wavelength_m"]),
        days=int(stored["days"]),
        incidence_degrees=float(stored["incidence_degrees"]),
    )
    return window, (str(stored["reference_date"]), str(stored["secondary_date"]))


def local_relief_mm(window: PairWindow) -> np.ndarray:
    is_valid = find_usable_pixels(window)
    sinking = np.where(is_valid, sinking_millimeters(window), np.nan)
    local = masked_gaussian(sinking, is_valid, LOCAL_SIGMA_PIXELS)
    regional = masked_gaussian(sinking, is_valid, REGIONAL_SIGMA_PIXELS)
    return np.where(is_valid, local - regional, np.nan)


def stack(paths: list[Path]) -> StackedRate:
    loaded = [load_window(path) for path in paths]
    shapes = {window.phase.shape for window, _ in loaded}
    if len(shapes) != 1:
        raise ValueError(f"Pair windows differ in shape: {shapes}")
    reliefs = np.stack([local_relief_mm(window) for window, _ in loaded])
    days = np.array([window.days for window, _ in loaded], dtype=float)[:, None, None]
    has_value = np.isfinite(reliefs)

    total_mm = np.where(has_value, reliefs, 0).sum(axis=0)
    total_days = np.where(has_value, days, 0).sum(axis=0)
    pair_count = has_value.sum(axis=0)
    is_stacked = pair_count >= MIN_PAIRS_PER_PIXEL
    rate = np.full(total_mm.shape, np.nan)
    np.divide(total_mm * DAYS_PER_YEAR, total_days, out=rate, where=is_stacked)

    per_pair_rate = reliefs * DAYS_PER_YEAR / days
    spread = np.nanstd(per_pair_rate, axis=0)
    uncertainty = np.where(is_stacked, spread / np.sqrt(np.maximum(pair_count, 1)), np.nan)
    return StackedRate(rate, uncertainty, pair_count, loaded[0][0], [dates for _, dates in loaded])


def pixel_of(longitude: float, latitude: float, window: PairWindow) -> tuple[int, int]:
    to_utm = Transformer.from_crs(4326, window.epsg, always_xy=True)
    x, y = to_utm.transform(longitude, latitude)
    return int(np.argmin(np.abs(window.ys - y))), int(np.argmin(np.abs(window.xs - x)))


def bowl_rate(bowl: dict, stacked: StackedRate) -> dict:
    window = stacked.window
    pixel_meters = abs(float(window.xs[1] - window.xs[0]))
    row, column = pixel_of(bowl["center"][0], bowl["center"][1], window)
    radius_pixels = max(bowl["radiusM"] / pixel_meters, MIN_BOWL_RADIUS_PIXELS)
    rows, columns = np.ogrid[: window.phase.shape[0], : window.phase.shape[1]]
    inside = (rows - row) ** 2 + (columns - column) ** 2 <= radius_pixels**2
    rates = stacked.rate[inside]
    is_measured = np.isfinite(rates)
    if not is_measured.any():
        return {"id": bowl["id"], "measured": False}
    return {
        "id": bowl["id"],
        "measured": True,
        "relativeRateMmYr": round(float(np.nanmean(rates)), 1),
        "uncertaintyMmYr": round(float(np.nanmean(stacked.uncertainty[inside])), 1),
        "pixels": int(is_measured.sum()),
        "pairs": int(np.max(stacked.pair_count[inside])),
    }


def find_candidates(stacked: StackedRate, noise: float) -> list[dict]:
    filled = np.nan_to_num(stacked.rate, nan=-np.inf)
    is_peak = filled == ndimage.maximum_filter(filled, size=PEAK_NEIGHBOURHOOD_PIXELS)
    rows, columns = np.nonzero(is_peak & (filled > DETECTION_SNR * noise))
    window = stacked.window
    to_lonlat = Transformer.from_crs(window.epsg, 4326, always_xy=True)
    pixel_meters = abs(float(window.xs[1] - window.xs[0]))
    candidates = []
    for row, column in zip(rows, columns):
        rate = float(stacked.rate[row, column])
        uncertainty = float(stacked.uncertainty[row, column])
        radius_pixels = measure_bowl_radius_pixels(stacked.rate, row, column)
        if radius_pixels < MIN_CANDIDATE_RADIUS_PIXELS or rate < MIN_RATE_TO_UNCERTAINTY * uncertainty:
            continue
        longitude, latitude = to_lonlat.transform(window.xs[column], window.ys[row])
        candidates.append(
            {
                "center": [round(longitude, 5), round(latitude, 5)],
                "radiusM": round(radius_pixels * pixel_meters),
                "relativeRateMmYr": round(rate, 1),
                "uncertaintyMmYr": round(uncertainty, 1),
                "snr": round(rate / float(noise), 1),
            }
        )
    return sorted(candidates, key=lambda candidate: candidate["snr"], reverse=True)


def main() -> None:
    paths = sorted(WINDOW_DIR.glob("*.npz"))
    if not paths:
        raise SystemExit(f"No pair windows in {WINDOW_DIR}. Run fetch_nisar_gunw.py first.")
    stacked = stack(paths)
    noise = robust_noise(stacked.rate)
    bowls = json.loads(BOWLS_PATH.read_text(encoding="utf-8"))["bowls"]
    first_date = min(reference for reference, _ in stacked.pair_dates)
    last_date = max(secondary for _, secondary in stacked.pair_dates)
    document = {
        "synthetic": False,
        "product": "NISAR L2 GUNW provisional, unwrapped phase (HDF5)",
        "track": 10,
        "direction": "ascending",
        "pairCount": len(paths),
        "period": {"start": first_date, "end": last_date},
        "gridM": round(abs(float(stacked.window.xs[1] - stacked.window.xs[0]))),
        "incidenceDegrees": round(stacked.window.incidence_degrees, 1),
        "noiseFloorMmYr": round(float(noise), 1),
        "detectionSnr": DETECTION_SNR,
        "evidence": {
            "script": "apps/jobs/stack_nisar_rate.py",
            "pairs": [stem.stem for stem in paths],
        },
        "bowls": [bowl_rate(bowl, stacked) for bowl in bowls],
        "candidates": find_candidates(stacked, noise),
    }
    if not np.isfinite(noise):
        raise SystemExit(f"No pixel has {MIN_PAIRS_PER_PIXEL} usable pairs. Read more pairs first.")
    RATES_PATH.write_text(json.dumps(document, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    render_panel(stacked.rate, "NISAR stack, local sinking rate mm/yr").save(PREVIEW_PATH)

    print(f"pairs: {len(paths)}, {first_date} to {last_date}, noise floor {noise:.1f} mm/yr")
    print(f"stacked pixels: {np.isfinite(stacked.rate).mean():.0%} of the window")
    for bowl in document["bowls"]:
        print(f"  {bowl}")
    print(f"candidates: {len(document['candidates'])}")
    for candidate in document["candidates"][:10]:
        print(f"  {candidate}")
    print(f"wrote {RATES_PATH} and {PREVIEW_PATH}")


if __name__ == "__main__":
    main()
