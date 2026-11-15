# apps/web

The Orbitalis web app: landing page, area check, 3D map of subsidence bowls, a digital twin per bowl, and the team visit workflow. Interface in Indonesian (default) and English.

## Run

From the repo root:

```bash
bun run dev:web
```

Open [http://localhost:3000](http://localhost:3000). Env variables are listed in `.env.example`. Setup, deploy and Docker steps are in the [root README](../../README.md).

## Layout

- `src/app/[locale]` has the routes. `(desk)` pages need a session. `landing`, `check` and `design-system` are public. Any other page starts a guest session.
- `src/features/<name>` owns each feature: its queries, actions and components.
- `src/lib/i18n` holds the strings. Add each string to both `en.ts` and `id.ts`.
- `src/proxy.ts` handles the locale redirect and the guest session redirect.

Read `AGENTS.md` before you change code here.
