"""Read the Jakarta window of every NISAR GUNW pair on one track.

Track 10 is ascending. Track 18 is descending, and only its frame 92 has an unbroken chain of
pairs over Jakarta. The HDF5 products are about 2.3 GB each; HTTP range requests read only the
chunks that cover the window, so one pair takes a minute or two. Needs an Earthdata Login
user token in NASA_API_KEY:
`uv run --env-file ../../.env fetch_nisar_gunw.py --track 18`.
"""

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import fsspec
import numpy as np
import requests

from detect_bowls import JAKARTA_LAND, PairWindow, read_pair_window

JAKARTA = "POINT(106.82 -6.12)"
FRAMES_BY_TRACK = {10: None, 18: 92}
WINDOW_DIR = Path(__file__).resolve().parent / "out" / "gunw-jakarta"
RANGE_BLOCK_BYTES = 8 * 1024 * 1024


def is_wanted(properties: dict, track: int) -> bool:
    frame = FRAMES_BY_TRACK[track]
    return properties["pathNumber"] == track and frame in (None, properties.get("frameNumber"))


def search_gunw_granules(track: int) -> list[dict]:
    query = urllib.parse.urlencode(
        {
            "dataset": "NISAR",
            "processingLevel": "GUNW",
            "intersectsWith": JAKARTA,
            "output": "geojson",
            "maxResults": 500,
        }
    )
    url = f"https://api.daac.asf.alaska.edu/services/search/param?{query}"
    with urllib.request.urlopen(url, timeout=120) as response:
        features = json.load(response)["features"]
    track_features = [f for f in features if is_wanted(f["properties"], track)]
    return sorted(track_features, key=lambda f: f["properties"]["startTime"])


def signed_url(product_url: str, token: str) -> str:
    response = requests.get(
        product_url,
        headers={"Authorization": f"Bearer {token}"},
        allow_redirects=False,
        timeout=60,
    )
    if response.status_code not in (302, 303, 307) or "location" not in response.headers:
        raise RuntimeError(f"Earthdata refused {product_url}: HTTP {response.status_code}")
    return response.headers["location"]


def read_remote_window(product_url: str, token: str) -> PairWindow:
    filesystem = fsspec.filesystem("http")
    with filesystem.open(
        signed_url(product_url, token), block_size=RANGE_BLOCK_BYTES, cache_type="blockcache"
    ) as remote:
        return read_pair_window(remote, JAKARTA_LAND)


def scene_dates(scene: str) -> tuple[str, str]:
    parts = scene.split("_")
    reference, secondary = parts[11][:8], parts[13][:8]
    return (
        f"{reference[:4]}-{reference[4:6]}-{reference[6:]}",
        f"{secondary[:4]}-{secondary[4:6]}-{secondary[6:]}",
    )


def save_window(scene: str, window: PairWindow, path: Path) -> None:
    reference_date, secondary_date = scene_dates(scene)
    np.savez_compressed(
        path,
        phase=window.phase,
        ionosphere=window.ionosphere,
        coherence=window.coherence,
        components=window.components,
        mask=window.mask,
        xs=window.xs,
        ys=window.ys,
        epsg=window.epsg,
        wavelength_m=window.wavelength_m,
        days=window.days,
        incidence_degrees=window.incidence_degrees,
        los_unit_vector=np.array(window.los_unit_vector),
        reference_date=reference_date,
        secondary_date=secondary_date,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--track", type=int, choices=sorted(FRAMES_BY_TRACK), required=True)
    track = parser.parse_args().track
    token = os.environ.get("NASA_API_KEY", "").strip()
    if not token:
        sys.exit("NASA_API_KEY is empty. It must hold an Earthdata Login user token.")
    track_dir = WINDOW_DIR / str(track)
    track_dir.mkdir(parents=True, exist_ok=True)
    for feature in search_gunw_granules(track):
        scene = feature["properties"]["sceneName"]
        path = track_dir / f"{scene}.npz"
        if path.exists():
            print(f"skip {scene[61:76]} (already read)", file=sys.stderr)
            continue
        window = read_remote_window(feature["properties"]["url"], token)
        save_window(scene, window, path)
        print(f"read {scene_dates(scene)} {window.phase.shape}", file=sys.stderr)


if __name__ == "__main__":
    main()
