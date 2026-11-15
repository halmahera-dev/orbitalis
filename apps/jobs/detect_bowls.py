"""Detect subsidence bowl candidates in North Jakarta from one NISAR GUNW pair (HDF5).

One 12-day pair is mostly atmosphere. Use this to learn the pipeline and to check the noise
floor, not to publish a rate. Real rates need a stack of pairs.
"""

import argparse
from dataclasses import dataclass
from pathlib import Path

import h5py
import numpy as np

from PIL import Image, ImageDraw
from pyproj import Transformer
from scipy import ndimage

SPEED_OF_LIGHT = 299_792_458.0
DAYS_PER_YEAR = 365.0
NORTH_JAKARTA_LAND = (106.70, -6.20, 106.98, -6.10)
JAKARTA_LAND = (106.68, -6.38, 106.98, -6.08)
COHERENCE_LIMIT = 0.6
LOCAL_SIGMA_PIXELS = 4
REGIONAL_SIGMA_PIXELS = 40
PEAK_NEIGHBOURHOOD_PIXELS = 25
MIN_VALID_WEIGHT = 0.3
DETECTION_SNR = 3
PREVIEW_SCALE = 4
UNWRAPPED_GRID = "science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram"
RADAR_GRID = "science/LSAR/GUNW/metadata/radarGrid"


@dataclass(frozen=True)
class PairWindow:
    phase: np.ndarray
    ionosphere: np.ndarray
    coherence: np.ndarray
    components: np.ndarray
    mask: np.ndarray
    xs: np.ndarray
    ys: np.ndarray
    epsg: int
    wavelength_m: float
    days: int
    incidence_degrees: float
    los_unit_vector: tuple[float, float, float]


def read_radar_grid_value(product, name, center_x, center_y):
    heights = product[f"{RADAR_GRID}/heightAboveEllipsoid"][:]
    xs = product[f"{RADAR_GRID}/xCoordinates"][:]
    ys = product[f"{RADAR_GRID}/yCoordinates"][:]
    layer = int(np.argmin(np.abs(heights)))
    column = int(np.argmin(np.abs(xs - center_x)))
    row = int(np.argmin(np.abs(ys - center_y)))
    return float(product[f"{RADAR_GRID}/{name}"][layer, row, column])


def read_incidence_degrees(product, center_x, center_y):
    return read_radar_grid_value(product, "incidenceAngle", center_x, center_y)


def read_los_unit_vector(product, center_x, center_y):
    """East, north, and up parts of the ground-to-sensor line of sight."""
    east = read_radar_grid_value(product, "losUnitVectorX", center_x, center_y)
    north = read_radar_grid_value(product, "losUnitVectorY", center_x, center_y)
    return (east, north, float(np.sqrt(1 - east**2 - north**2)))


def read_pair_window(h5_path, bounds=NORTH_JAKARTA_LAND):
    west, south, east, north = bounds
    with h5py.File(h5_path, "r") as product:
        epsg = int(product[f"{UNWRAPPED_GRID}/HH/projection"].attrs["epsg_code"])
        to_utm = Transformer.from_crs(4326, epsg, always_xy=True)
        x_west, y_south = to_utm.transform(west, south)
        x_east, y_north = to_utm.transform(east, north)

        xs = product[f"{UNWRAPPED_GRID}/HH/xCoordinates"][:]
        ys = product[f"{UNWRAPPED_GRID}/HH/yCoordinates"][:]
        first_column, last_column = np.searchsorted(xs, [x_west, x_east])
        first_row = int(np.argmin(np.abs(ys - y_north)))
        last_row = int(np.argmin(np.abs(ys - y_south)))
        rows, columns = slice(first_row, last_row), slice(first_column, last_column)

        frequency_hz = float(product["science/LSAR/GUNW/grids/frequencyA/centerFrequency"][()])
        days = int(product["science/LSAR/GUNW/metadata/orbit/temporalBaseline"][()])
        center_x, center_y = xs[columns].mean(), ys[rows].mean()
        return PairWindow(
            phase=product[f"{UNWRAPPED_GRID}/HH/unwrappedPhase"][rows, columns],
            ionosphere=product[f"{UNWRAPPED_GRID}/HH/ionospherePhaseScreen"][rows, columns],
            coherence=product[f"{UNWRAPPED_GRID}/HH/coherenceMagnitude"][rows, columns],
            components=product[f"{UNWRAPPED_GRID}/HH/connectedComponents"][rows, columns],
            mask=product[f"{UNWRAPPED_GRID}/mask"][rows, columns],
            xs=xs[columns],
            ys=ys[rows],
            epsg=epsg,
            wavelength_m=SPEED_OF_LIGHT / frequency_hz,
            days=days,
            incidence_degrees=read_incidence_degrees(product, center_x, center_y),
            los_unit_vector=read_los_unit_vector(product, center_x, center_y),
        )


def find_usable_pixels(window):
    # Mask low byte is decimal digits: water flag, reference subswath, secondary subswath.
    code = window.mask & 0xFF
    is_land = code < 100
    has_both_subswaths = (code % 100 // 10 > 0) & (code % 10 > 0)
    return (
        is_land
        & has_both_subswaths
        & (window.components > 0)
        & (window.coherence >= COHERENCE_LIMIT)
        & np.isfinite(window.phase)
    )


def range_increase_millimeters(window):
    ionosphere_free_phase = window.phase - window.ionosphere
    # Sign follows ISCE3 (reference x conj(secondary)); the known fast-sinking areas come out positive.
    return ionosphere_free_phase * window.wavelength_m / (4 * np.pi) * 1000


def sinking_millimeters(window):
    return range_increase_millimeters(window) / np.cos(np.radians(window.incidence_degrees))


def masked_gaussian(values, is_valid, sigma):
    weights = ndimage.gaussian_filter(is_valid.astype(float), sigma, mode="constant")
    totals = ndimage.gaussian_filter(np.where(is_valid, values, 0.0), sigma, mode="constant")
    smoothed = np.full(values.shape, np.nan)
    np.divide(totals, weights, out=smoothed, where=weights > MIN_VALID_WEIGHT)
    return smoothed


def robust_noise(values):
    deviation = np.abs(values - np.nanmedian(values))
    return 1.4826 * np.nanmedian(deviation)


def measure_bowl_radius_pixels(relief, row, column):
    half_peak = relief[row, column] / 2
    regions, _ = ndimage.label(np.nan_to_num(relief, nan=-np.inf) > half_peak)
    area_pixels = (regions == regions[row, column]).sum()
    return float(np.sqrt(area_pixels / np.pi))


def find_bowls(relief, noise, window):
    filled = np.nan_to_num(relief, nan=-np.inf)
    is_peak = filled == ndimage.maximum_filter(filled, size=PEAK_NEIGHBOURHOOD_PIXELS)
    rows, columns = np.nonzero(is_peak & (filled > DETECTION_SNR * noise))
    to_lonlat = Transformer.from_crs(window.epsg, 4326, always_xy=True)
    pixel_meters = abs(float(window.xs[1] - window.xs[0]))
    bowls = []
    for row, column in zip(rows, columns):
        radius_pixels = measure_bowl_radius_pixels(relief, row, column)
        longitude, latitude = to_lonlat.transform(window.xs[column], window.ys[row])
        bowls.append(
            {
                "row": int(row),
                "column": int(column),
                "longitude": longitude,
                "latitude": latitude,
                "radius_m": radius_pixels * pixel_meters,
                "radius_pixels": radius_pixels,
                "relief_mm_per_pair": float(relief[row, column]),
                "relief_mm_per_year": float(relief[row, column]) * DAYS_PER_YEAR / window.days,
                "snr": float(relief[row, column]) / noise,
            }
        )
    return sorted(bowls, key=lambda bowl: bowl["snr"], reverse=True)


def render_panel(field, title):
    limit = np.nanpercentile(np.abs(field), 99)
    scaled = field / limit
    sinking_share = np.clip(scaled, 0, 1)
    rising_share = np.clip(-scaled, 0, 1)
    rgb = np.stack(
        [1 - sinking_share, 1 - sinking_share - rising_share, 1 - rising_share], axis=-1
    )
    rgb = rgb * 255
    rgb[np.isnan(field)] = 200
    size = (field.shape[1] * PREVIEW_SCALE, field.shape[0] * PREVIEW_SCALE)
    image = Image.fromarray(rgb.astype(np.uint8)).resize(size, Image.Resampling.NEAREST)
    ImageDraw.Draw(image).text((8, 8), f"{title} (blue = sinking, +-{limit:.1f} mm)", fill=(0, 0, 0))
    return image


def draw_bowls(image, bowls):
    draw = ImageDraw.Draw(image)
    for rank, bowl in enumerate(bowls, start=1):
        center_x = (bowl["column"] + 0.5) * PREVIEW_SCALE
        center_y = (bowl["row"] + 0.5) * PREVIEW_SCALE
        radius = bowl["radius_pixels"] * PREVIEW_SCALE
        draw.ellipse(
            (center_x - radius, center_y - radius, center_x + radius, center_y + radius),
            outline=(0, 0, 0),
            width=2,
        )
        draw.text((center_x + 4, center_y + 4), str(rank), fill=(0, 0, 0))


def save_preview(before, after, bowls, output_path):
    top = render_panel(before, "1. After mask, ionosphere and angle correction")
    bottom = render_panel(after, "2. After removing the regional ramp, with detected bowls")
    draw_bowls(bottom, bowls)
    sheet = Image.new("RGB", (top.width, top.height + bottom.height))
    sheet.paste(top, (0, 0))
    sheet.paste(bottom, (0, top.height))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("h5_path", type=Path)
    parser.add_argument("--out", type=Path, default=Path("out/bowls.png"))
    arguments = parser.parse_args()

    window = read_pair_window(arguments.h5_path)
    is_valid = find_usable_pixels(window)
    sinking = np.where(is_valid, sinking_millimeters(window), np.nan)

    local = masked_gaussian(sinking, is_valid, LOCAL_SIGMA_PIXELS)
    regional = masked_gaussian(sinking, is_valid, REGIONAL_SIGMA_PIXELS)
    relief = local - regional
    noise = robust_noise(relief)
    bowls = find_bowls(relief, noise, window)

    print(
        f"pair: {window.days} days, wavelength {window.wavelength_m * 100:.1f} cm, "
        f"incidence {window.incidence_degrees:.1f} deg"
    )
    print(f"window: {window.phase.shape[1]} x {window.phase.shape[0]} pixels, usable {is_valid.mean():.0%}")
    print(f"noise floor: {noise:.2f} mm per pair, detection threshold {DETECTION_SNR * noise:.2f} mm")
    print(f"bowl candidates: {len(bowls)}")
    for rank, bowl in enumerate(bowls, start=1):
        print(
            f"  {rank}. lon {bowl['longitude']:.4f} lat {bowl['latitude']:.4f} "
            f"radius {bowl['radius_m']:.0f} m  relief {bowl['relief_mm_per_pair']:.1f} mm/pair "
            f"({bowl['relief_mm_per_year']:.0f} mm/yr if it were steady)  snr {bowl['snr']:.1f}"
        )

    save_preview(local - np.nanmedian(local), relief, bowls, arguments.out)
    print(f"preview: {arguments.out}")


if __name__ == "__main__":
    main()
