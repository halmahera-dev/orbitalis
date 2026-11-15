"""Write synthetic 500 m priority areas over North Jakarta for the web app map layers.

Every value is an example, not a measurement. The sinking rate follows the seed bowls so the
area layers agree with the pumping leads. population.py, economic_activity.py, and
priority_scores.py replace this file with real values in Phase 2.
"""

import json
import math
import random
from pathlib import Path

WEB_APP = Path(__file__).resolve().parents[1] / "web"
BOWLS_PATH = WEB_APP / "src" / "features" / "bowls" / "bowls-seed.json"
AREAS_PATH = WEB_APP / "src" / "features" / "areas" / "areas-seed.json"

CELL_SIZE_M = 500
METERS_PER_DEGREE = 111_320
WEST, EAST = 106.71, 106.97
SOUTH = -6.16
CELL_AREA_KM2 = (CELL_SIZE_M / 1000) ** 2
RANDOM_SEED = 2026

# Conservative coast: cells whose center lies north of this line are sea and are skipped.
COAST = [
    (106.69, -6.097),
    (106.74, -6.097),
    (106.78, -6.107),
    (106.80, -6.110),
    (106.83, -6.124),
    (106.85, -6.124),
    (106.87, -6.112),
    (106.90, -6.107),
    (106.93, -6.105),
    (106.97, -6.102),
]

KECAMATAN_BY_EAST_EDGE = [
    (106.815, "Penjaringan"),
    (106.855, "Pademangan"),
    (106.895, "Tanjung Priok"),
    (106.925, "Koja"),
    (180.0, "Cilincing"),
]

ECONOMIC_HUBS = [
    ((106.885, -6.105), 1.0),
    ((106.940, -6.120), 0.9),
    ((106.805, -6.108), 0.8),
    ((106.840, -6.125), 0.7),
    ((106.790, -6.125), 0.7),
    ((106.910, -6.157), 0.7),
]
HUB_REACH_M = 1600
INDUSTRIAL_HUBS = ECONOMIC_HUBS[:2]

EVIDENCE = {
    "source": "Synthetic seed",
    "script": "apps/jobs/seed_areas.py",
    "grid": "500 m cells on a regular longitude and latitude grid",
    "method": (
        "Sinking rate: background rate plus a Gaussian around each seed bowl. Population, piped share,"
        " and economic activity: fixed random draws shaped by distance to the coast and to ports"
        " and industrial zones."
    ),
    "period": "2026",
}


def coast_latitude(longitude):
    for (west_lon, west_lat), (east_lon, east_lat) in zip(COAST, COAST[1:]):
        if west_lon <= longitude <= east_lon:
            share = (longitude - west_lon) / (east_lon - west_lon)
            return west_lat + share * (east_lat - west_lat)
    return COAST[-1][1]


def distance_m(a, b):
    mean_latitude = math.radians((a[1] + b[1]) / 2)
    dx = (a[0] - b[0]) * METERS_PER_DEGREE * math.cos(mean_latitude)
    dy = (a[1] - b[1]) * METERS_PER_DEGREE
    return math.hypot(dx, dy)


def kecamatan_for(longitude):
    return next(name for east_edge, name in KECAMATAN_BY_EAST_EDGE if longitude < east_edge)


def sinking_rate(center, coast_distance_m, bowls, rng):
    background = 18 + 20 * math.exp(-coast_distance_m / 2500)
    from_bowls = max(
        bowl["rateAfterBanMmYr"]
        * math.exp(-((distance_m(center, bowl["center"]) / max(bowl["radiusM"] * 2, 700)) ** 2))
        for bowl in bowls
    )
    return round(max(background, from_bowls) + rng.uniform(-4, 4))


def hub_influence(center, hubs):
    return max(weight * math.exp(-distance_m(center, hub) / HUB_REACH_M) for hub, weight in hubs)


def economy_class(center, rng):
    influence = hub_influence(center, ECONOMIC_HUBS) + rng.uniform(-0.12, 0.12)
    if influence > 0.55:
        return "high"
    if influence > 0.28:
        return "medium"
    return "low"


def population_per_km2(center, coast_distance_m, rng):
    density = 19_000 + rng.uniform(-8_000, 12_000)
    density *= 1 - 0.7 * hub_influence(center, INDUSTRIAL_HUBS)
    density *= 0.45 + 0.55 * (1 - math.exp(-coast_distance_m / 900))
    return int(min(max(density, 1_500), 42_000) // 100 * 100)


def piped_share(kecamatan, coast_distance_m, rng):
    share = 0.86 + rng.uniform(-0.1, 0.08)
    if kecamatan in ("Penjaringan", "Cilincing"):
        share -= 0.12
    share -= 0.12 * math.exp(-coast_distance_m / 1200)
    return round(min(max(share, 0.45), 0.98), 2)


def build_area(column, row, center, bowls, rng):
    coast_distance_m = (coast_latitude(center[0]) - center[1]) * METERS_PER_DEGREE
    kecamatan = kecamatan_for(center[0])
    density = population_per_km2(center, coast_distance_m, rng)
    people = round(density * CELL_AREA_KM2)
    share = piped_share(kecamatan, coast_distance_m, rng)
    return {
        "id": f"c{column:02d}-{row:02d}",
        "kecamatan": kecamatan,
        "center": [round(center[0], 5), round(center[1], 5)],
        "sinkingMmYr": sinking_rate(center, coast_distance_m, bowls, rng),
        "populationPerKm2": density,
        "people": people,
        "pipedShare": share,
        "unservedPeople": round(people * (1 - share)),
        "economy": economy_class(center, rng),
    }


def build_areas(bowls):
    rng = random.Random(RANDOM_SEED)
    latitude_step = CELL_SIZE_M / METERS_PER_DEGREE
    longitude_step = latitude_step / math.cos(math.radians(abs(SOUTH)))
    columns = math.ceil((EAST - WEST) / longitude_step)
    rows = math.ceil((coast_latitude(WEST) - SOUTH) / latitude_step) + 2
    areas = []
    for column in range(columns):
        for row in range(rows):
            center = (
                WEST + (column + 0.5) * longitude_step,
                SOUTH + (row + 0.5) * latitude_step,
            )
            if center[1] > coast_latitude(center[0]) - latitude_step / 2:
                continue
            areas.append(build_area(column, row, center, bowls, rng))
    return areas


def main():
    bowls = json.loads(BOWLS_PATH.read_text(encoding="utf-8"))["bowls"]
    areas = build_areas(bowls)
    AREAS_PATH.parent.mkdir(parents=True, exist_ok=True)
    document = {
        "synthetic": True,
        "cellSizeM": CELL_SIZE_M,
        "evidence": EVIDENCE,
        "areas": areas,
    }
    AREAS_PATH.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(areas)} areas to {AREAS_PATH}")


if __name__ == "__main__":
    main()
