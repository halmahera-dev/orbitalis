# apps/jobs

Python jobs that turn NISAR radar files into the bowls and cells the web app shows.

## Run

Needs Python 3.11 and [uv](https://docs.astral.sh/uv/). Jobs that read NISAR files need an Earthdata Login user token in `NASA_API_KEY` (root `.env`).

```bash
uv run --env-file ../../.env fetch_nisar_browse.py
uv run --env-file ../../.env fetch_nisar_gunw.py --track 10
uv run --env-file ../../.env fetch_nisar_gunw.py --track 18
uv run stack_nisar_rate.py
uv run fetch_worldpop.py
```

Then load `out/nisar-run.json` into Postgres from the repo root:

```bash
bun run --cwd packages/db import:nisar ../../apps/jobs/out/nisar-run.json
```

`fetch_water_bodies.py` is optional and adds water farming sites. Large files stay in `out/`, which Git ignores.

The method, the checks and the rules are in `AGENTS.md`.
