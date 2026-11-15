# @repo/env

Environment variables checked with zod. The app fails at start when a required variable is missing.

- `src/server.ts` checks `DATABASE_URL`, `BETTER_AUTH_SECRET` (32 characters or more), `BETTER_AUTH_URL` and `NODE_ENV`.
- `src/web.ts` checks the client variables.

Set `SKIP_ENV_VALIDATION=1` to skip the check, for example during `next build`.

```ts
import { env } from "@repo/env/server";
```
