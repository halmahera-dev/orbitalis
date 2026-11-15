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
2. `fetch_nisar_gunw.py` reads the North Jakarta window of each GUNW pair with HTTP range requests into `out/gunw/`.
3. `stack_nisar_rate.py` stacks the windows into `nisar-rates.json` and `out/nisar-stack-rate.png`.

The stacked rate is relative to the ground within about 3 km and uses one ascending track. Say so wherever it is shown.
