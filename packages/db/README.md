# @repo/db

Drizzle schema, SQL migrations, the Postgres client, and the importers for NISAR runs and water farming sites.

## Run

Set `DATABASE_URL` in `apps/web/.env`, then from the repo root:

```bash
bun run db:migrate
bun run db:studio
bun run --cwd packages/db import:nisar ../../apps/jobs/out/nisar-run.json
```

To change the schema, edit `src/schema`, run `bun run db:generate --name <change>`, and commit the new file in `src/migrations`. Rules for migrations and imports are in `AGENTS.md`.
