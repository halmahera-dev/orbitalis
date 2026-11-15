# @repo/db

Drizzle schema, migrations and the NISAR run importer.

## Schema changes

- Change the schema in `src/schema`, then run `bun run db:generate --name <change>` and commit the new file in `src/migrations`.
- Never edit a migration that has shipped. Add a new one.
- Never use `drizzle-kit push`. The database is managed by migrations only.
- `bun run db:migrate` applies pending migrations in one transaction (`src/migrate.ts`, Bun SQL driver). It reads `DATABASE_URL` from `apps/web/.env`, and a `DATABASE_URL` in the shell wins.

## NISAR runs

- `bun run import:nisar <path to nisar-run.json>` imports a run from `apps/jobs`. The path is relative to `packages/db`.
- The import runs in one transaction. Importing the same run again changes nothing.
- A detection within max(radius, 250 m) of a known NISAR bowl keeps that bowl's id.

## Tests

`TEST_DATABASE_URL=postgres://user@localhost:5432/postgres bun test` needs a throwaway local server. The test creates and drops its own database. Never point it at Neon.
