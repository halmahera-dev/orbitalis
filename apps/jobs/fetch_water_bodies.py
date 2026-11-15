"""Find public water bodies in Jakarta that recharge groundwater: waduk, embung, situ, retention ponds.

These are the macro-scale water farming measures of the KemenLH draft rule (June 2026). Source:
OpenStreetMap through the Overpass API. Private fishing ponds and estate lakes are left out by name.
Writes out/water-sites.json for `bun run --cwd packages/db import:sites`.
Run: `uv run fetch_water_bodies.py`.
"""

import json
import re
from pathlib import Path

import requests
from pyproj import Transformer

JOBS_DIR = Path(__file__).resolve().parent
SITES_PATH = JOBS_DIR / "out" / "water-sites.json"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_HEADERS = {"User-Agent": "orbitalis-jobs/0.1 (NISAR subsidence research)"}
UTM_JAKARTA = 32748
PUBLIC_NAME = re.compile(r"^(Waduk|Embung|Situ|Kolam Retensi|Danau (?!Hias)\S)", re.IGNORECASE)
KINDS = {"waduk": "reservoir", "embung": "embung", "situ": "situ", "kolam": "retention", "danau": "lake"}
QUERY = """
[out:json][timeout:120];
area["name"="Daerah Khusus Ibukota Jakarta"]["admin_level"="4"]->.jakarta;
(
  way["water"~"reservoir|basin|lake|pond"]["name"](area.jakarta);
  way["landuse"~"reservoir|basin"]["name"](area.jakarta);
);
out tags geom;
"""


def polygon_area_m2(points: list[tuple[float, float]]) -> float:
    to_utm = Transformer.from_crs(4326, UTM_JAKARTA, always_xy=True)
    xs, ys = to_utm.transform([lon for lon, _ in points], [lat for _, lat in points])
    twice_area = sum(xs[i] * ys[i + 1] - xs[i + 1] * ys[i] for i in range(len(xs) - 1))
    return abs(twice_area) / 2


def site_from_way(way: dict) -> dict | None:
    name = way["tags"]["name"].strip()
    points = [(node["lon"], node["lat"]) for node in way.get("geometry", [])]
    if not PUBLIC_NAME.match(name) or len(points) < 4 or points[0] != points[-1]:
        return None
    lons = [lon for lon, _ in points]
    lats = [lat for _, lat in points]
    return {
        "osmId": f"way/{way['id']}",
        "name": name,
        "kind": KINDS[name.split()[0].lower()],
        "center": [round(sum(lons) / len(lons), 5), round(sum(lats) / len(lats), 5)],
        "areaM2": round(polygon_area_m2(points)),
    }


def main() -> None:
    response = requests.post(OVERPASS_URL, data={"data": QUERY}, headers=OVERPASS_HEADERS, timeout=180)
    response.raise_for_status()
    sites = [site for way in response.json()["elements"] if (site := site_from_way(way))]
    sites.sort(key=lambda site: site["areaM2"], reverse=True)
    document = {
        "source": "OpenStreetMap contributors, Overpass API",
        "script": "apps/jobs/fetch_water_bodies.py",
        "sites": sites,
    }
    SITES_PATH.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(sites)} sites to {SITES_PATH}")
    for site in sites[:10]:
        print(f"  {site['name']}: {site['areaM2']:,} m²")


if __name__ == "__main__":
    main()
