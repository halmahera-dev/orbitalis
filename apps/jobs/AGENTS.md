# apps/jobs

Python batch jobs that turn satellite data into the files `apps/web` reads. Read the root `AGENTS.md` first. The list of jobs and their phases is in `docs/services.md`.

## Rules

- Python 3.11 with uv. Run a job with `uv run <script>.py`. Add packages with `uv add`, never with pip.
- One flat script per step. A job is idempotent: the same input gives the same output and skips work that is already done.
- Every output carries its evidence (product, dates, method, script). The run file `out/nisar-run.json` goes into Postgres with `bun run --cwd packages/db import:nisar ../../apps/jobs/out/nisar-run.json`, which validates the shape. The app shows no synthetic values.
- Large inputs stay in `out/` (git-ignored). Only small JSON and images go into `apps/web`.
- Secrets come from the environment. Jobs that need Earthdata read the Earthdata Login user token from `NASA_API_KEY`: `uv run --env-file ../../.env fetch_nisar_gunw.py`. Never print or commit the token.
- No real personal data. Population comes as counts per cell, never per person or address.

## NISAR rate chain

1. `fetch_nisar_browse.py` writes the pass images and `nisar-pairs.json`.
2. `fetch_nisar_gunw.py --track 10` and `--track 18` read the mainland Jakarta window (`JAKARTA_LAND`) and LOS vector of each GUNW pair with HTTP range requests into `out/gunw-jakarta/<track>/`.
3. `stack_nisar_rate.py` stacks each track, solves the two for vertical and east motion, detects bowls (2.5 times the noise floor and 1.5 times their own uncertainty), grids the rate into 480 m cells, and writes `out/nisar-run.json` and `out/nisar-stack-rate.png`. It stops if its decomposition self-check fails. Bowl names come from OpenStreetMap reverse geocoding (Nominatim, 1 request per second, cached in `out/geocode-cache.json`).
4. `fetch_worldpop.py` adds WorldPop 2026 people to each cell of `out/nisar-run.json`. It downloads the 170 MB Indonesia file once into `out/worldpop/`.
5. Import the run into Postgres (see Rules). A new detection within its radius (at least 250 m) of a known bowl keeps that bowl's id.

Every rate is relative to the ground within about 3 km. A bowl with `"basis": "track10"` is seen on one track only. Say both wherever they are shown.
