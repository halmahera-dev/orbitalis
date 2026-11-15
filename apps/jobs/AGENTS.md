# apps/jobs

Python batch jobs that turn satellite data into the files `apps/web` reads. Read the root `AGENTS.md` first. The list of jobs and their phases is in `docs/services.md`.

## Rules

- Python 3.11 with uv. Run a job with `uv run <script>.py`. Add packages with `uv add`, never with pip.
- One flat script per step. A job is idempotent: the same input gives the same output and skips work that is already done.
- Every output for the web app carries a `synthetic` flag and its evidence (product, dates, method, script). `apps/web` validates the shape when it reads the file.
- Large inputs stay in `out/` (git-ignored). Only small JSON and images go into `apps/web`.
- Secrets come from the environment. Jobs that need Earthdata read the Earthdata Login user token from `NASA_API_KEY`: `uv run --env-file ../../.env fetch_nisar_gunw.py`. Never print or commit the token.
- No real personal data. Seeds are synthetic and say so.

## NISAR rate chain

1. `fetch_nisar_browse.py` writes the pass images and `nisar-pairs.json`.
2. `fetch_nisar_gunw.py --track 10` and `--track 18` read the mainland Jakarta window (`JAKARTA_LAND`) and LOS vector of each GUNW pair with HTTP range requests into `out/gunw-jakarta/<track>/`.
3. `stack_nisar_rate.py` stacks each track, solves the two for vertical and east motion, and writes `nisar-rates.json` and `out/nisar-stack-rate.png`. It stops if its decomposition self-check fails. Candidate names come from OpenStreetMap reverse geocoding (Nominatim, 1 request per second, cached in `out/geocode-cache.json`).

Every rate is relative to the ground within about 3 km. A candidate with `"basis": "track10"` is seen on one track only. Say both wherever they are shown.
