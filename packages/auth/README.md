# @repo/auth

[Better Auth](https://www.better-auth.com) setup for the web app, and the seed script for synthetic team accounts.

```ts
import { auth } from "@repo/auth";
```

Create or reset the synthetic accounts from the repo root. The script prints their emails and the shared password:

```bash
bun run db:seed
```

It needs `DATABASE_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` in `apps/web/.env`.
