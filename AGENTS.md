## Engineering Preferences

- Pragmatic over perfect. Solve the problem at hand.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in layers. Start from the smallest version that works end-to-end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Minimal abstractions. Extract only when a pattern appears 3+ times.
- Explicit over clever. No code comments by default. Rename, extract a well-named function or constant, or restructure until the code explains itself. A comment is allowed only where the code cannot say why on its own (a non-obvious constraint, a workaround for an external bug), and then it is one short line. Never narrate what the code does, never leave commented-out code.
- Write expressive, readable code in React and backend code. Prefer clear names and explicit control flow over shorthand expressions.
- DRY in data-fetching and shared components. Not in one-off pages.
- No unnecessary files. Only create helpers/utils if used in 2+ places.
- Use function declarations for named functions, components, and handlers.
- Use arrow functions for inline callbacks passed as arguments (`.then`, `.map`, `.filter`). Do not name an inline callback.
- Keep comments short and limited to intent that clear code cannot express.
- Keep values in the narrowest scope that uses them. Promote a value to a module constant only when it is shared, configurable, or a stable domain concept.
- Do not add `Co-authored-by` trailers to commit messages.

## Process Rules

- Edit files directly. Do not wrap changes in Python or shell scripts that rewrite files. The diff must show the code change, not a script change.
- No multi-agent work unless asked. No subagents, Workflows, or skills that hand tasks to other agents. If a task seems to need that, ask first.
- Push only when told. Committing per step is fine. `git push` waits for an explicit instruction from the repo owner.
- Write in English. Repo docs, `AGENTS.md`/`CLAUDE.md` files, code comments, commit messages and PR text are in English. App copy follows the i18n rule below.
- Commit messages follow conventional commits (`feat:`, `fix:`, `docs:`, ...).

## Repo and Data

- Everything lives in this monorepo. Frontend, backend, jobs, shared packages, database migrations, infrastructure config, docs and plans all go in this repository. Do not create separate repos or split services out. Add a new unit under `apps/` or `packages/`.
- Every app and package has its own `AGENTS.md` and `CLAUDE.md` in its folder. `CLAUDE.md` contains only `@AGENTS.md` (or is a symlink to it). A new unit gets both from the start.
- No real data in the repo. It can be cloned, shared with collaborators or made public later. Names, phone numbers, photos and any other personal data must be synthetic.
- Secrets live only in git-ignored env files. A committed `.env.example` holds variable names only.

## Before Calling It Done

- Run `bun run check-types && bun run check`, then `bun run build` if you touched `apps/web`. Some breakage only shows up during prerender.
- After a change to behavior, names or contracts, `grep` the old names and phrases across the repo (including `docs/` and `plans/`) and update stragglers in the same commit.

## Design Rules

- `design.md` wins when a skill disagrees with it.
- Pill buttons have text only. Never put arrows or icons inside them. Quiet text links (`variant="link"`) use plain words only, for example "Learn more". Do not use `→`, `•`, or `·` in UI copy. Icon-only buttons (`size="icon*"`) and the loading `Spinner` are allowed.
- Motion values live in `packages/ui/src/styles/globals.css`. Use the tokens there. Do not write new cubic-bezier values in components.
- Hover changes color only (160ms, `ease-out`). Things do not lift, grow, or bounce on hover, and nothing animates on scroll. Exception: section headings blur in once when they enter view (`blur-in-view`), and selected content blocks rise in once (`rise-in-view`, no blur).
- Pressable elements use the `pressable` utility (scale 0.97 on pointer-down). Release is fast: 160ms `ease-out`.
- Elements that move or resize on screen use `ease-in-out`.
- Popovers and menus scale from their trigger (`origin-(--transform-origin)`). Modals stay centered.
- Blur (`glass`) is for the sticky header only. Exceptions: section headings (`blur-in-view`), and floating panels over the map.
- Headings use weight 510, titles 590. Never bold, never uppercase (except `type-label-mono`).
- Emerald (`brand`) marks state, focus, and small highlights. The main action is the ink pill.
- Respect `prefers-reduced-motion`: replace movement with a short fade, and keep color changes.

## Talking to Human

- When speaking English, always talk in ASD-STE100 Simplified Technical English.
- Constraint yourself not to use C1-C2 sentences and vocabularies. Keep your responses in plain English.

## Next.js App (`apps/web`)

- For every change in `apps/web`, read `.agents/skills/nextjs-app-architecture/SKILL.md` and follow its architecture workflow and verification checklist. Read the relevant skill references for the work at hand.
- Use `apps/web/AGENTS.md` and the installed Next.js docs at `apps/web/node_modules/next/dist/docs` for version-specific framework behavior and APIs.
- The interface is English (default) and Indonesian. Never hard-code user-facing text. Add every string to both `src/lib/i18n/en.ts` and `src/lib/i18n/id.ts`. `id.ts` is typed as `Dictionary` from `en.ts`, so a missing key fails `bun run check-types`.
