# Prioka

Prioka helps groundwater regulators in North Jakarta turn NISAR radar motion into inspection leads. A public landing page explains coastal subsidence. After sign-in, the desk shows a 3D map of subsidence bowls, a digital twin per bowl, and a visit workflow for the team.

This monorepo holds the Next.js web app, shared packages under the `@repo` scope, and Python jobs that fetch NISAR browse images.

## Stack

- **Next.js 16** (App Router) and React 19
- **TypeScript** Turborepo with Bun
- **Tailwind CSS 4** and shadcn/ui in `@repo/ui`
- **PostgreSQL** with Drizzle (`@repo/db`)
- **Better Auth** (`@repo/auth`)
- **Oxlint** and **Oxfmt**
- **Python** jobs in `apps/jobs` (NISAR browse fetch)

## Quick start

1. Install dependencies:

```bash
bun install
```

2. Create `apps/web/.env` with:

```bash
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=at-least-32-characters-long-secret
BETTER_AUTH_URL=http://localhost:3000
```

3. Push the schema and seed demo accounts (the seed script prints emails and the shared password):

```bash
bun run db:push
bun run db:seed
```

4. Start the apps:

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
prioka/
├── apps/
│   ├── web/          # Next.js app (landing, desk, map, bowl twin)
│   └── jobs/         # Python NISAR browse jobs
├── packages/
│   ├── auth/         # @repo/auth — Better Auth setup and demo seed
│   ├── config/       # @repo/config — shared TypeScript config
│   ├── db/           # @repo/db — Drizzle schema and client
│   ├── env/          # @repo/env — validated environment variables
│   └── ui/           # @repo/ui — shared components and design tokens
├── docs/             # Product docs and PRD
└── plans/            # Implementation plans
```

Import shared UI like this:

```tsx
import { Button } from "@repo/ui/components/button";
```

## UI package

- Tokens and global styles: `packages/ui/src/styles/globals.css`
- Primitives: `packages/ui/src/components/*`
- shadcn config: `packages/ui/components.json`

Add more primitives from the repo root:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

## Scripts

| Script | What it does |
| --- | --- |
| `bun run dev` | Start all apps in development |
| `bun run build` | Build all apps |
| `bun run dev:web` | Start only the web app |
| `bun run check-types` | Typecheck the workspace |
| `bun run check` | Oxlint and Oxfmt |
| `bun run db:push` | Push Drizzle schema to the database |
| `bun run db:generate` | Generate migrations |
| `bun run db:migrate` | Run migrations |
| `bun run db:seed` | Create or reset synthetic demo accounts |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run docker:build` | Build Docker Compose images |
| `bun run docker:up` | Build and start Docker Compose |
| `bun run docker:logs` | Tail Compose logs |
| `bun run docker:down` | Stop Compose |

## Deploy

### Vercel

Root `vercel.json` uses [Vercel Services](https://vercel.com/docs/services). Import this repository as one project and keep the Root Directory at the repo root. The `web` service builds `apps/web` and serves public paths, including `/api/auth/*`.

Shared code in `packages/` is not a separate service. The web app talks to Neon through `DATABASE_URL`.

Set these for each Vercel environment:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon PostgreSQL URL |
| `BETTER_AUTH_SECRET` | Secret, at least 32 characters |
| `BETTER_AUTH_URL` | Public origin of that environment, including `https://` (also used for canonical links, share previews, and the sitemap) |

The home page is in `/sitemap.xml`. Pages use `noindex`. `/robots.txt` blocks only `/api/` and points to the sitemap.

Local Vercel routing from the repo root:

```bash
npx vercel@latest dev
```

Without a Vercel login: `npx vercel@latest dev -L`. Keep secrets in `apps/web/.env` and set `BETTER_AUTH_URL` to the local origin the CLI prints.

### Docker Compose

- Config: `docker-compose.yml` (Dockerfiles under `apps/*/`)
- `bun run docker:build` / `docker:up` / `docker:logs` / `docker:down`
- Env comes from each app’s `.env`, with overrides in Compose for container networking

## Docs

- Product PRD: `docs/prd-prioka.md`
- Design rules: `design.md`
- Agent guidance: `AGENTS.md`
