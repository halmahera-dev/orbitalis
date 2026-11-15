# Orbitalis

Orbitalis helps groundwater regulators in Jakarta turn NISAR radar motion into inspection leads. A public landing page explains coastal subsidence. Every other page opens with no sign-in form: a visitor gets a shared guest session. The desk shows a 3D map of subsidence bowls, a digital twin per bowl, and a visit workflow for the team.

This monorepo holds the Next.js web app, shared packages under the `@repo` scope, and Python jobs that fetch NISAR browse images and stack NISAR GUNW pairs into a measured local sinking rate per bowl.

**Live demo:** [orbitalis.halmahera.site/en/map](https://orbitalis.halmahera.site/en/map). It opens with no sign-in. Other public pages: `/en/landing` and `/en/check` (check an address). Use `/id/...` for Indonesian.

## How it works

1. Jobs read NISAR L-band interferograms (GUNW) over Jakarta from two tracks and stack 16 pairs from June to October 2026.
2. They find places that sink faster than the ground within about 3 km. These are bowls, the shape a hidden pump leaves.
3. WorldPop adds the number of people to each 480 m cell.
4. `import:nisar` loads the run into Postgres. The web app shows bowls on a 3D map, opens a digital twin for each one, and tracks field visits.

A bowl is a reason to inspect, never proof of a pump. Every number shows its source. The full design is in [docs/hld-orbitalis.md](docs/hld-orbitalis.md).

## Stack

- **Next.js 16** (App Router) and React 19
- **TypeScript** Turborepo with Bun
- **Tailwind CSS 4** and shadcn/ui in `@repo/ui`
- **PostgreSQL** with Drizzle (`@repo/db`)
- **Better Auth** (`@repo/auth`)
- **Cloudflare Workers** via OpenNext (`@opennextjs/cloudflare`)
- **Oxlint** and **Oxfmt**
- **Python** jobs in `apps/jobs` (NISAR browse fetch, GUNW window read, rate stack)

## Quick start

1. Install dependencies:

```bash
bun install
```

2. Copy `apps/web/.env.example` to `apps/web/.env` and fill it in. `DATABASE_URL` is a Postgres connection string. `BETTER_AUTH_SECRET` needs at least 32 characters. For the jobs, copy `.env.example` to `.env` in the repo root.

```bash
cp apps/web/.env.example apps/web/.env
cp .env.example .env
```

3. Apply the migrations. The guest account is created on the first visit. `db:seed` is optional and adds synthetic team accounts (it prints their emails and the shared password):

```bash
bun run db:migrate
bun run db:seed
```

4. Load the NISAR data (see [Jobs](#jobs)). Without it the map has no bowls.

5. Start the apps:

```bash
bun run dev
```

Open the URL printed by Next.js (default [http://localhost:3000](http://localhost:3000)).

Web only:

```bash
bun run dev:web
```

## Project structure

```
orbitalis/
├── apps/
│   ├── web/          # Next.js app (landing, desk, map, bowl twin)
│   └── jobs/         # Python NISAR jobs
├── packages/
│   ├── auth/         # @repo/auth — Better Auth setup and demo seed
│   ├── config/       # @repo/config — shared TypeScript config
│   ├── db/           # @repo/db — Drizzle schema and client
│   ├── env/          # @repo/env — validated environment variables
│   └── ui/           # @repo/ui — shared components and design tokens
├── docs/             # Product docs, start at docs/README.md
└── plans/            # Implementation plans
```

Import shared UI like this:

```tsx
import { Button } from "@repo/ui/components/button";
```

## Jobs

Python 3.11 with [uv](https://docs.astral.sh/uv/). Jobs that read NISAR files need an Earthdata Login user token in `NASA_API_KEY` (root `.env`, git-ignored). Run from `apps/jobs`:

```bash
uv run --env-file ../../.env fetch_nisar_browse.py
uv run --env-file ../../.env fetch_nisar_gunw.py --track 10
uv run --env-file ../../.env fetch_nisar_gunw.py --track 18
uv run stack_nisar_rate.py
uv run fetch_worldpop.py
bun run --cwd packages/db import:nisar ../../apps/jobs/out/nisar-run.json
```

Optional water farming sites:

```bash
uv run fetch_water_bodies.py
bun run --cwd packages/db import:sites ../../apps/jobs/out/water-sites.json
```

The order and the method are in `apps/jobs/AGENTS.md`.

## UI package

- Tokens and global styles: `packages/ui/src/styles/globals.css`
- Primitives: `packages/ui/src/components/*`
- shadcn config: `packages/ui/components.json`

Add more primitives from the repo root:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

## Scripts

| Script                 | What it does                                 |
| ---------------------- | -------------------------------------------- |
| `bun run dev`          | Start all apps in development                |
| `bun run build`        | Build all apps                               |
| `bun run dev:web`      | Start only the web app                       |
| `bun run deploy:web`   | Build with OpenNext and deploy to Cloudflare |
| `bun run check-types`  | Typecheck the workspace                      |
| `bun run check`        | Oxlint and Oxfmt                             |
| `bun run db:generate`  | Generate migrations                          |
| `bun run db:migrate`   | Run migrations                               |
| `bun run db:seed`      | Create or reset synthetic demo accounts      |
| `bun run db:studio`    | Open Drizzle Studio                          |
| `bun run docker:build` | Build Docker Compose images                  |
| `bun run docker:up`    | Build and start Docker Compose               |
| `bun run docker:logs`  | Tail Compose logs                            |
| `bun run docker:down`  | Stop Compose                                 |

## Deploy

### Cloudflare Workers

The web app deploys with [OpenNext for Cloudflare](https://opennext.js.org/cloudflare). Config lives in `apps/web/wrangler.jsonc` (worker name `orbitalis`, public origin `https://orbitalis.halmahera.site`).

1. Log in once:

```bash
cd apps/web && bunx wrangler login
```

2. Set runtime secrets in the Cloudflare dashboard (or via Wrangler). `BETTER_AUTH_URL` is already a `vars` entry in `wrangler.jsonc`.

```bash
cd apps/web
bunx wrangler secret put DATABASE_URL
bunx wrangler secret put BETTER_AUTH_SECRET
```

Worker secrets are not available during Builds. The web `build` script sets `SKIP_ENV_VALIDATION=1` so `next build` can finish. Runtime still needs the secrets above.

Optional: `NODE_ENV=production`.

3. Deploy from the repo root:

```bash
bun run deploy:web
```

Or from `apps/web`:

```bash
bun run deploy
```

Preview locally as a Worker:

```bash
cd apps/web && bun run preview
```

After the first deploy, set `BETTER_AUTH_URL` to the printed `*.workers.dev` URL (or your custom domain), then redeploy if auth redirects fail.

The home page is in `/sitemap.xml`. Pages use `noindex`. `/robots.txt` blocks only `/api/` and points to the sitemap.

### Docker Compose

- Config: `docker-compose.yml` (Dockerfiles under `apps/*/`)
- `bun run docker:build` / `docker:up` / `docker:logs` / `docker:down`
- Env comes from each app’s `.env`, with overrides in Compose for container networking

## Docs

- Product PRD: `docs/prd-orbitalis.md`
- Design rules: `design.md`
- Agent guidance: `AGENTS.md`
- Space Apps 2026 submission draft: `docs/submission.md`

## Data and AI use

- **Real data only:** NISAR L2 GUNW products and browse images (NASA, JPL, ISRO, through the ASF DAAC), WorldPop 2026 population, and OpenStreetMap data through CARTO tiles. The jobs write `apps/jobs/out/nisar-run.json`, and `bun run --cwd packages/db import:nisar ../../apps/jobs/out/nisar-run.json` loads the bowls and cells into Postgres. The app shows no synthetic values. The demo accounts from `db:seed` are synthetic.
- **AI use:** parts of the code, the documents, and the submission text were written with the help of Claude Code (Anthropic) and reviewed by the team. No AI model runs inside the product.