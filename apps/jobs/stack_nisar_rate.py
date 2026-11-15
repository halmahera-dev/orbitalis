"""Stack NISAR GUNW pairs from two tracks into a vertical local sinking rate per bowl.

Each pair is masked, corrected for the ionosphere, and smoothed. The regional ramp (atmosphere,
orbit, and the slow sinking of the whole city) is removed, so every rate is relative to the
ground within about 3 km, not absolute. Each track is stacked in range units, then the ascending
track 10 and the descending track 18 are decomposed into vertical and east rates with the north
rate set to zero. This is a stack, not a MintPy time series. The window covers mainland Jakarta.
Candidates are named by OpenStreetMap reverse geocoding (Nominatim), cached in out/.
"""

import json
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import requests
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
    range_increase_millimeters,
    render_panel,
    robust_noise,
)

JOBS_DIR = Path(__file__).resolve().parent
WINDOW_DIR = JOBS_DIR / "out" / "gunw-jakarta"
PREVIEW_PATH = JOBS_DIR / "out" / "nisar-stack-rate.png"
GEOCODE_CACHE_PATH = JOBS_DIR / "out" / "geocode-cache.json"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
NOMINATIM_HEADERS = {"User-Agent": "orbitalis-jobs/0.1 (NISAR subsidence research)"}
NOMINATIM_PAUSE_SECONDS = 1.1
WEB_APP = JOBS_DIR.parent / "web"
BOWLS_PATH = WEB_APP / "src" / "features" / "bowls" / "bowls-seed.json"
RATES_PATH = WEB_APP / "src" / "features" / "nisar" / "nisar-rates.json"
ASCENDING_TRACK = 10
DESCENDING_TRACK = 18
DIRECTIONS = {ASCENDING_TRACK: "ascending", DESCENDING_TRACK: "descending"}
DAYS_PER_YEAR = 365.0
MIN_PAIRS_PER_PIXEL = 5
MIN_BOWL_RADIUS_PIXELS = 1.5
MIN_CANDIDATE_RADIUS_PIXELS = 2
MIN_RATE_TO_UNCERTAINTY = 2


@dataclass(frozen=True)
class TrackStack:
    track: int
    pair_ids: list[str]
    dates: list[tuple[str, str]]
    reliefs: np.ndarray
    rate: np.ndarray
    uncertainty: np.ndarray
    pair_count: np.ndarray
    pair_noise: np.ndarray
    los: tuple[float, float, float]
    window: PairWindow


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
        los_unit_vector=tuple(float(part) for part in stored["los_unit_vector"]),
    )
    return window, (str(stored["reference_date"]), str(stored["secondary_date"]))


def range_relief_mm(window: PairWindow) -> np.ndarray:
    is_valid = find_usable_pixels(window)
    range_increase = np.where(is_valid, range_increase_millimeters(window), np.nan)
    local = masked_gaussian(range_increase, is_valid, LOCAL_SIGMA_PIXELS)
    regional = masked_gaussian(range_increase, is_valid, REGIONAL_SIGMA_PIXELS)
    return np.where(is_valid, local - regional, np.nan)


def stack_track(track: int) -> TrackStack:
    paths = sorted((WINDOW_DIR / str(track)).glob("*.npz"))
    if not paths:
        raise SystemExit(f"No windows for track {track}. Run fetch_nisar_gunw.py --track {track}.")
    loaded = [load_window(path) for path in paths]
    reliefs = np.stack([range_relief_mm(window) for window, _ in loaded])
    days = np.array([window.days for window, _ in loaded], dtype=float)[:, None, None]
    has_value = np.isfinite(reliefs)

    total_mm = np.where(has_value, reliefs, 0).sum(axis=0)
    total_days = np.where(has_value, days, 0).sum(axis=0)
    pair_count = has_value.sum(axis=0)
    is_stacked = pair_count >= MIN_PAIRS_PER_PIXEL
    rate = np.full(total_mm.shape, np.nan)
    np.divide(total_mm * DAYS_PER_YEAR, total_days, out=rate, where=is_stacked)

    with np.errstate(invalid="ignore"):
        spread = np.nanstd(reliefs * DAYS_PER_YEAR / days, axis=0)
    uncertainty = np.where(is_stacked, spread / np.sqrt(np.maximum(pair_count, 1)), np.nan)
    first = loaded[0][0]
    return TrackStack(
        track=track,
        pair_ids=[path.stem for path in paths],
        dates=[dates for _, dates in loaded],
        reliefs=reliefs,
        rate=rate,
        uncertainty=uncertainty,
        pair_count=pair_count,
        pair_noise=np.array([robust_noise(relief) for relief in reliefs]),
        los=first.los_unit_vector,
        window=first,
    )


def decomposition_matrix(los_a, los_b) -> np.ndarray:
    """Maps (up, east) ground velocity to the two range rates, with north set to zero."""
    return np.array([[-los_a[2], -los_a[0]], [-los_b[2], -los_b[0]]])


def decompose(range_rates, los):
    """Returns (up, east) from two range rates; works on scalars and arrays."""
    inverse = np.linalg.inv(decomposition_matrix(*los))
    first, second = range_rates
    up = inverse[0, 0] * first + inverse[0, 1] * second
    east = inverse[1, 0] * first + inverse[1, 1] * second
    return up, east


def decompose_uncertainty(uncertainties, los):
    inverse = np.linalg.inv(decomposition_matrix(*los))
    first, second = uncertainties
    return np.sqrt((inverse[0, 0] * first) ** 2 + (inverse[0, 1] * second) ** 2)


def check_decomposition(los) -> None:
    up, east = -40.0, 5.0
    range_rates = tuple(-(vector[2] * up + vector[0] * east) for vector in los)
    found_up, found_east = decompose(range_rates, los)
    assert abs(found_up - up) < 1e-6 and abs(found_east - east) < 1e-6, (found_up, found_east)


def check_alignment(ascending: TrackStack, descending: TrackStack) -> None:
    same_grid = np.array_equal(ascending.window.xs, descending.window.xs) and np.array_equal(
        ascending.window.ys, descending.window.ys
    )
    if not same_grid:
        raise SystemExit("Track windows do not share one grid. Read both tracks with one window.")


def pixel_of(longitude: float, latitude: float, window: PairWindow) -> tuple[int, int]:
    to_utm = Transformer.from_crs(4326, window.epsg, always_xy=True)
    x, y = to_utm.transform(longitude, latitude)
    return int(np.argmin(np.abs(window.ys - y))), int(np.argmin(np.abs(window.xs - x)))


def bowl_mask(bowl: dict, window: PairWindow) -> np.ndarray:
    pixel_meters = abs(float(window.xs[1] - window.xs[0]))
    row, column = pixel_of(bowl["center"][0], bowl["center"][1], window)
    radius_pixels = max(bowl["radiusM"] / pixel_meters, MIN_BOWL_RADIUS_PIXELS)
    rows, columns = np.ogrid[: window.phase.shape[0], : window.phase.shape[1]]
    return (rows - row) ** 2 + (columns - column) ** 2 <= radius_pixels**2


def cumulative_series(stack: TrackStack, inside: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    with np.errstate(invalid="ignore"):
        per_pair = np.array([np.nanmean(relief[inside]) for relief in stack.reliefs])
    displacement = np.concatenate([[0.0], np.cumsum(per_pair)])
    band = np.concatenate([[0.0], np.sqrt(np.cumsum(stack.pair_noise**2))])
    return displacement, band


def bowl_series(bowl_inside, ascending, descending, los) -> list[dict]:
    range_a, band_a = cumulative_series(ascending, bowl_inside)
    range_d, band_d = cumulative_series(descending, bowl_inside)
    if not (np.isfinite(range_a).all() and np.isfinite(range_d).all()):
        return []
    up, _ = decompose((range_a, range_d), los)
    band = decompose_uncertainty((band_a, band_d), los)
    dates = [ascending.dates[0][0]] + [secondary for _, secondary in ascending.dates]
    return [
        {"date": date, "mm": round(float(-value), 1), "bandMm": round(float(spread), 1)}
        for date, value, spread in zip(dates, up, band)
    ]


def bowl_rate(bowl, vertical, ascending, descending, los) -> dict:
    inside = bowl_mask(bowl, ascending.window)
    sinking = -vertical["up"][inside]
    is_measured = np.isfinite(sinking)
    if not is_measured.any():
        return {"id": bowl["id"], "measured": False}
    with np.errstate(invalid="ignore"):
        return {
            "id": bowl["id"],
            "measured": True,
            "verticalRateMmYr": round(float(np.nanmean(sinking)), 1),
            "verticalUncertaintyMmYr": round(float(np.nanmean(vertical["uncertainty"][inside])), 1),
            "eastRateMmYr": round(float(np.nanmean(vertical["east"][inside])), 1),
            "losRateMmYr": {
                str(ascending.track): round(float(np.nanmean(ascending.rate[inside])), 1),
                str(descending.track): round(float(np.nanmean(descending.rate[inside])), 1),
            },
            "pixels": int(is_measured.sum()),
            "pairs": int(np.max(ascending.pair_count[inside]) + np.max(descending.pair_count[inside])),
            "series": bowl_series(inside, ascending, descending, los),
        }


def place_from_address(address: dict) -> dict:
    """Kelurahan and kecamatan from a Nominatim address; Jakarta tags them village and city_district."""
    city = address.get("city", "Jakarta")
    kecamatan = address.get("city_district") or address.get("suburb") or city
    name = address.get("village") or address.get("suburb") or address.get("neighbourhood") or kecamatan
    return {"name": name, "kecamatan": kecamatan}


def reverse_geocode(longitude: float, latitude: float, cache: dict) -> dict:
    key = f"{longitude:.4f},{latitude:.4f}"
    if key not in cache:
        time.sleep(NOMINATIM_PAUSE_SECONDS)
        response = requests.get(
            NOMINATIM_URL,
            params={"lat": latitude, "lon": longitude, "format": "jsonv2", "zoom": 14},
            headers=NOMINATIM_HEADERS,
            timeout=30,
        )
        response.raise_for_status()
        cache[key] = place_from_address(response.json().get("address", {}))
    return cache[key]


def find_candidates(rate, uncertainty, window, basis, geocode_cache) -> list[dict]:
    noise = float(robust_noise(rate))
    filled = np.nan_to_num(rate, nan=-np.inf)
    is_peak = filled == ndimage.maximum_filter(filled, size=PEAK_NEIGHBOURHOOD_PIXELS)
    rows, columns = np.nonzero(is_peak & (filled > DETECTION_SNR * noise))
    to_lonlat = Transformer.from_crs(window.epsg, 4326, always_xy=True)
    pixel_meters = abs(float(window.xs[1] - window.xs[0]))
    candidates = []
    for row, column in zip(rows, columns):
        value = float(rate[row, column])
        spread = float(uncertainty[row, column])
        radius_pixels = measure_bowl_radius_pixels(rate, row, column)
        if radius_pixels < MIN_CANDIDATE_RADIUS_PIXELS or value < MIN_RATE_TO_UNCERTAINTY * spread:
            continue
        longitude, latitude = to_lonlat.transform(window.xs[column], window.ys[row])
        place = reverse_geocode(longitude, latitude, geocode_cache)
        candidates.append(
            {
                "id": f"nisar-{round(longitude * 1000)}-{round(-latitude * 1000)}",
                "basis": basis,
                "name": place["name"],
                "kecamatan": place["kecamatan"],
                "center": [round(longitude, 5), round(latitude, 5)],
                "radiusM": round(radius_pixels * pixel_meters),
                "rateMmYr": round(value, 1),
                "uncertaintyMmYr": round(spread, 1),
                "snr": round(value / noise, 1),
            }
        )
    return sorted(candidates, key=lambda candidate: candidate["snr"], reverse=True)


def track_summary(stack: TrackStack) -> dict:
    return {
        "track": stack.track,
        "direction": DIRECTIONS[stack.track],
        "pairCount": len(stack.pair_ids),
        "period": {
            "start": min(reference for reference, _ in stack.dates),
            "end": max(secondary for _, secondary in stack.dates),
        },
        "pairs": stack.pair_ids,
    }


def main() -> None:
    ascending = stack_track(ASCENDING_TRACK)
    descending = stack_track(DESCENDING_TRACK)
    check_alignment(ascending, descending)
    los = (ascending.los, descending.los)
    check_decomposition(los)

    up, east = decompose((ascending.rate, descending.rate), los)
    vertical = {
        "up": up,
        "east": east,
        "uncertainty": decompose_uncertainty((ascending.uncertainty, descending.uncertainty), los),
    }
    sinking = -up
    noise = float(robust_noise(sinking))
    if not np.isfinite(noise):
        raise SystemExit(f"No pixel has {MIN_PAIRS_PER_PIXEL} usable pairs on both tracks.")

    bowls = json.loads(BOWLS_PATH.read_text(encoding="utf-8"))["bowls"]
    window = ascending.window
    geocode_cache = (
        json.loads(GEOCODE_CACHE_PATH.read_text(encoding="utf-8")) if GEOCODE_CACHE_PATH.exists() else {}
    )
    candidates = find_candidates(sinking, vertical["uncertainty"], window, "vertical", geocode_cache)
    if not candidates:
        candidates = find_candidates(
            ascending.rate, ascending.uncertainty, window, f"track{ASCENDING_TRACK}", geocode_cache
        )
    GEOCODE_CACHE_PATH.write_text(json.dumps(geocode_cache, indent=2), encoding="utf-8")

    document = {
        "synthetic": False,
        "product": "NISAR L2 GUNW provisional, unwrapped phase (HDF5)",
        "tracks": [track_summary(ascending), track_summary(descending)],
        "gridM": round(abs(float(window.xs[1] - window.xs[0]))),
        "noiseFloorMmYr": round(noise, 1),
        "detectionSnr": DETECTION_SNR,
        "script": "apps/jobs/stack_nisar_rate.py",
        "bowls": [bowl_rate(bowl, vertical, ascending, descending, los) for bowl in bowls],
        "candidates": candidates,
    }
    RATES_PATH.write_text(json.dumps(document, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    render_panel(sinking, "NISAR two-track stack, vertical local sinking mm/yr").save(PREVIEW_PATH)

    print(f"los ascending {np.round(ascending.los, 3)}, descending {np.round(descending.los, 3)}")
    print(f"vertical noise floor {noise:.1f} mm/yr, stacked pixels {np.isfinite(sinking).mean():.0%}")
    for bowl in document["bowls"]:
        summary = {key: value for key, value in bowl.items() if key != "series"}
        print(f"  {summary} series={len(bowl.get('series', []))}")
    print(f"candidates: {len(candidates)}")
    for candidate in candidates[:10]:
        print(f"  {candidate}")
    print(f"wrote {RATES_PATH} and {PREVIEW_PATH}")


if __name__ == "__main__":
    main()
