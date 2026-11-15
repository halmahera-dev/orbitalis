# Real NISAR evidence (A1 to A4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In this repo the owner chose inline execution with no subagents (root `AGENTS.md`).

**Goal:** Every NISAR number on screen is real and labelled, the rate is vertical from two tracks, and the NISAR-detected candidate is a lead that goes through the visit flow.

**Architecture:** Python jobs in `apps/jobs` read the North Jakarta window of track 10 ascending and track 18 descending (frame 92), stack each track, decompose into vertical and east rates, and write `nisar-rates.json`. The Next.js app validates that file with zod in a server-only query, shows the vertical series on the bowl page, and treats each candidate as a lead keyed by a text id in the existing `inspection` table.

**Tech Stack:** Python 3.11 (uv, h5py, numpy, scipy, pyproj, fsspec), Next.js 16 App Router, React 19, MapLibre GL, Recharts, zod, Drizzle, Bun test.

**Spec:** `docs/superpowers/specs/2026-11-15-nisar-hackathon-a-design.md`

## Global Constraints

- No subagents. Edit files directly. English in repo files.
- Every user-facing string goes in both `apps/web/src/lib/i18n/en.ts` and `id.ts`.
- Pages compose and stay synchronous; queries live in `*-queries.ts` with `import "server-only"`; actions live in `*-actions.ts` with `"use server"`, validate input, and invalidate.
- `design.md` wins. Charts: one series in `var(--brand)`, straight segments, a flat band at 14% opacity, no legend, 3 to 5 faint gridlines. Figures tabular and right-aligned. A missing value is a grey dash.
- No database schema change. Candidates use `inspection.bowl_id` with ids like `nisar-106949-6126`.
- The Earthdata token is read from `NASA_API_KEY` (root `.env`, `uv run --env-file ../../.env`). Never print it.
- A track 10 fallback candidate carries the label "One track only, not confirmed by the second track" everywhere it appears.
- Format only the files you change with `./node_modules/.bin/oxfmt <files>`; never run oxfmt on the whole repo (the local version reformats about 50 untouched files).
- Before each commit: `bunx tsc --noEmit -p apps/web`, oxlint on the changed files, `bun test` in `apps/web`. Before the last commit also `bun run build`.

## Review Focus

- A fallback candidate (`basis: "track10"`) must show its label in the map panel, the list row, and the desk row (Task 6 test on the label helper, Task 7 and 8 browser checks).
- A seed bowl with no usable NISAR pixels (today `marunda`, `cilincing`) must render the series card with its frame and the one-sentence empty state, not crash (Task 5 browser check on `/en/bowls/marunda`).
- `?lead=<unknown id>` on the map must open no panel and throw nothing (Task 7 browser check).
- A candidate id must pass the action validation, and an unknown id must still be refused (Task 6 test).
- `signInAsGuest` with any destination other than `"map"` must land on the desk (Task 1 test).

---

### Task 1: A4, guest sign-in that lands on the map

**Files:**

- Modify: `apps/web/src/features/user/user-actions.ts`
- Create: `apps/web/src/features/user/user-destination.ts`, `apps/web/src/features/user/user-destination.test.ts`
- Modify: `apps/web/src/features/landing/final-cta.tsx`, `how-to-start.tsx`, `showcase.tsx`
- Modify: `apps/web/src/lib/i18n/en.ts`, `id.ts`

**Interfaces:**

- Produces: `guestDestinationPath(locale: string, destination: unknown): string` returning `/${locale}/map` for `"map"` and `/${locale}` otherwise; `signInAsGuest(locale: string, destination?: string)`.

- [ ] **Step 1: Write the failing test** `guestDestinationPath sends map to /map and anything else to the desk`: `("en","map")` gives `"/en/map"`, `("id", undefined)` gives `"/id"`, `("en","admin")` gives `"/en"`, `("xx","map")` gives `"/id/map"` (bad locale falls back to the default `id`).
- [ ] **Step 2: Run** `cd apps/web && bun test src/features/user` and see it fail on the missing module.
- [ ] **Step 3: Implement** `guestDestinationPath` in `user-destination.ts` with `hasLocale` and `defaultLocale`; make `signInAsGuest(locale, destination)` redirect to it.
- [ ] **Step 4: Run** the test and see it pass.
- [ ] **Step 5: Replace the three "See the public map" links** with `<form action={signInAsGuest.bind(null, locale, "map")}>` and a `variant="link"` submit button. Rename the key `seeMap` to `openMapAsGuest`: en "Open the map as a guest", id "Buka peta sebagai tamu". `grep -rn "seeMap\|public map" apps/web/src docs` returns nothing.
- [ ] **Step 6: Commit** `feat(web): open the map as a guest from the landing page`.

### Task 2: Jobs, read both tracks with their LOS vectors

**Files:**

- Modify: `apps/jobs/fetch_nisar_gunw.py`, `apps/jobs/detect_bowls.py` (add the LOS vector to `PairWindow`)

**Interfaces:**

- Produces: `PairWindow.los_unit_vector: tuple[float, float, float]` (east, north, up at the window centre, ground to sensor); windows saved in `out/gunw/<track>/<scene>.npz` with a `los_unit_vector` array; CLI `fetch_nisar_gunw.py --track 10|18`. Track 18 uses only frame 92 (select by `properties["frameNumber"] == 92`).

- [ ] **Step 1: Read the LOS vector** in `read_pair_window` from `metadata/radarGrid/losUnitVectorX` and `Y` at the height layer nearest zero and the window centre pixel of the radar grid; up is `sqrt(1 - x² - y²)`.
- [ ] **Step 2: Add `--track`** with the track numbers 10 (ascending) and 18 (descending, frame 92) and save to `out/gunw/<track>/`.
- [ ] **Step 3: Run** `uv run --env-file ../../.env fetch_nisar_gunw.py --track 10` and `--track 18` in the background. Expected: 8 files in each folder, each window 137 × 388, and `los_unit_vector[0]` near +0.65 for track 10 and -0.64 for track 18.
- [ ] **Step 4: Remove** the old `out/gunw/*.npz` files at the top level.
- [ ] **Step 5: Commit** `feat(jobs): read the descending track and store the LOS vector`.

### Task 3: Jobs, stack per track, decompose, series, candidates

**Files:**

- Modify: `apps/jobs/stack_nisar_rate.py`
- Modify (output): `apps/web/src/features/nisar/nisar-rates.json`

**Interfaces:**

- Consumes: Task 2 windows.
- Produces: `decompose(range_rates: tuple[float, float], los: tuple[tuple[float,float,float], tuple[float,float,float]]) -> tuple[float, float]` returning (up, east) in mm/yr with north set to zero, vectorised over arrays. `nisar-rates.json` shape:
  - `tracks`: `[{ track, direction, pairCount, period: {start,end}, pairs: [ids] }]`
  - `gridM`, `noiseFloorMmYr` (vertical map), `detectionSnr`
  - `bowls`: `{ id, measured: false }` or `{ id, measured: true, verticalRateMmYr, verticalUncertaintyMmYr, eastRateMmYr, losRateMmYr: { "10", "18" }, pixels, pairs, series: [{ date, mm, bandMm }] }`
  - `candidates`: `[{ id, basis: "vertical"|"track10", name, kecamatan, center, radiusM, rateMmYr, uncertaintyMmYr, snr }]`

- [ ] **Step 1: Write the self-check** at the top of `main()`: build range rates from up = -40 and east = 5 with the two LOS vectors of the loaded windows, decompose them, and `assert` the result is within 1e-6 of (-40, 5).
- [ ] **Step 2: Stack each track in range units** (range increase in mm, not divided by the cosine), reusing the masking and the two Gaussian filters; keep the per-pixel uncertainty as today.
- [ ] **Step 3: Decompose** on pixels where both tracks have at least 5 pairs; positive "sinking" means downward. Propagate both uncertainties through the 2×2 inverse.
- [ ] **Step 4: Series per bowl:** mean relief inside the bowl per pair, running sum per track over the 9 dates, decomposed date by date, dated on the track 10 dates. `bandMm` is the square root of the running sum of each pair's squared noise floor, carried through the inverse.
- [ ] **Step 5: Candidates:** detect on the vertical map with the existing tests. If none, detect on the track 10 map and mark them `basis: "track10"`. Id `f"nisar-{round(lon*1000)}-{round(-lat*1000)}"`; name and kecamatan from the nearest seed bowl.
- [ ] **Step 6: Run** `uv run python -W ignore stack_nisar_rate.py`. Expected: the self-check passes, the JSON validates with `allow_nan=False`, and the printout lists per-bowl vertical rates and at least one candidate with its basis.
- [ ] **Step 7: Commit** `feat(jobs): vertical NISAR rate and series from two tracks`.

### Task 4: Web, read the new rates file

**Files:**

- Modify: `apps/web/src/features/nisar/nisar-queries.ts`, `apps/web/src/features/bowls/components/bowl-twin.tsx`, `apps/web/src/features/map/components/map-experience.tsx`
- Modify: `apps/web/src/lib/i18n/en.ts`, `id.ts`

**Interfaces:**

- Produces: `nisarStack` (parsed file), `nisarRateForBowl(bowlId): NisarBowlRate`, `nisarCandidates(): NisarCandidate[]`, `nisarCandidate(id): NisarCandidate | null`, types `NisarBowlRate`, `NisarCandidate`, `NisarSeriesPoint`.

- [ ] **Step 1: Update the zod schema** to the Task 3 shape, including `basis` as `z.enum(["vertical","track10"])`.
- [ ] **Step 2: Update the evidence copy**: `evidenceMeasured` becomes "NISAR measured: {rate} ± {uncertainty} mm/yr more vertical sinking than the ground around it"; `evidenceMeasuredBody` names both tracks, 16 pairs, both periods, the decomposition with north set to zero, and the one-day offset.
- [ ] **Step 3: Run** `bunx tsc --noEmit -p apps/web` and see it pass.
- [ ] **Step 4: Commit** `feat(web): read the two-track NISAR rates`.

### Task 5: A1, the bowl page series

**Files:**

- Create: `apps/web/src/features/bowls/components/nisar-series-chart.tsx`
- Modify: `apps/web/src/features/bowls/components/bowl-chart.tsx` (drop the NISAR line), `bowl-twin-view.tsx` (history tile), `bowl-twin.tsx` (pass the series), i18n files

**Interfaces:**

- Consumes: `nisarRateForBowl` from Task 4.
- Produces: `NisarSeriesChart({ points, labels }: { points: NisarSeriesPoint[] | null; labels: { title: string; empty: string; unit: string } })`; `BowlTwinView` prop `nisarSeries: NisarSeriesPoint[] | null` and `nisarRate: { rate: number; uncertainty: number } | null`.

- [ ] **Step 1: Remove** the `nisar` line and its legend entry from `BowlChart`; its caption reads "Sentinel-1 before the ban, example values" (en) / "Sentinel-1 sebelum larangan, nilai contoh" (id).
- [ ] **Step 2: Build `NisarSeriesChart`** with Recharts (dynamic import like `BowlChart`): an `Area` band from `mm - bandMm` to `mm + bandMm` at `fillOpacity={0.14}`, a 2px `Line` in `var(--brand)` with `type="linear"` and no dots, `CartesianGrid vertical={false}`, y unit " mm", x as day-month dates. Down is negative (the job's sinking value is drawn as `-mm`). Title "NISAR measured, 2026" / "Terukur NISAR, 2026". With `points === null`: the frame, the title, and "No usable NISAR pixels in this bowl." / "Tidak ada piksel NISAR yang bisa dipakai di cekungan ini."
- [ ] **Step 3: Replace the rate rows** with "Sentinel-1 before the ban (example)" and "NISAR vertical, relative to the surroundings" showing `rate ± uncertainty mm/yr` or a grey dash; remove the "Change in rate" row and the now-unused `rateChangePercent` if nothing else reads it.
- [ ] **Step 4: Check in the browser** `/en/bowls/muara-baru` and `/en/bowls/marunda` at 1280 and 360 px, and `/id/bowls/muara-baru`. Expected: the series card draws on Muara Baru and shows the empty sentence on Marunda; no console errors from the app.
- [ ] **Step 5: Commit** `feat(web): show the real NISAR series on the bowl page`.

### Task 6: A3, candidate leads in data and actions

**Files:**

- Modify: `apps/web/src/features/bowls/bowls-queries.ts`, `bowls-actions.ts`
- Modify: `apps/web/src/features/areas/areas-priority.ts`, `areas-priority.test.ts`
- Modify: i18n files

**Interfaces:**

- Consumes: `nisarCandidates()` from Task 4.
- Produces: `getNisarLeads(): Promise<NisarLead[]>` with `NisarLead = NisarCandidate & { status, assignee, visitDate, outcome, note }`; `leadIds` (seed ids plus candidate ids) used by the action schemas; `candidateLabel(basis): "confirmed" | "oneTrack"` in `areas-priority.ts`; `rankCandidates(candidates, areas, filter)` returning `{ candidate, matches, rank }[]` sorted by matches then `rateMmYr` descending.

- [ ] **Step 1: Write failing tests**: `rankCandidates keeps matches first and sorts by rate` (two candidates, one below `minSinkingMmYr`); `candidateLabel marks track10 as one track` (`"track10"` gives `"oneTrack"`, `"vertical"` gives `"confirmed"`).
- [ ] **Step 2: Run** `bun test src/features/areas` and see them fail.
- [ ] **Step 3: Implement** both in `areas-priority.ts`, reusing `matchesFilter` and `nearestArea`.
- [ ] **Step 4: Run** the tests and see them pass.
- [ ] **Step 5: Implement `getNisarLeads`** (one `inspection` query, cached with `cache` like `getBowls`) and accept candidate ids in `bowls-actions.ts` (`z.enum([...seedIds, ...candidateIds])`; the seed list is never empty, so the enum is never empty).
- [ ] **Step 6: Add copy**: `foundInNisar` "Found in NISAR data" / "Ditemukan di data NISAR"; `exampleBowls` "Example bowls" / "Cekungan contoh"; `oneTrackOnly` "One track only, not confirmed by the second track" / "Hanya satu lintasan, belum dikonfirmasi lintasan kedua"; `nearBowl` "Near {name}" / "Dekat {name}".
- [ ] **Step 7: Commit** `feat(web): treat NISAR candidates as leads in data and actions`.

### Task 7: A3, the map panel and list

**Files:**

- Create: `apps/web/src/features/map/components/candidate-panel.tsx`
- Modify: `nisar-candidate-layer.tsx` (click), `orbitalis-map.tsx` (panel, `lead` param, list groups), `map-ranked-list.tsx` (optional group subheaders), `map-experience.tsx` (pass `getNisarLeads()`, inspector names, action labels)

**Interfaces:**

- Consumes: `getNisarLeads`, `rankCandidates`, `candidateLabel`, `BowlActions`.
- Produces: `CandidatePanel({ locale, lead, labels, actions, onClose })` built like `AreaPanel`; `RankedListItem` gains `group?: string`.

- [ ] **Step 1: Make the ring clickable** (`onSelect(id)` on the fill layer, pointer cursor), selection in `?lead=`.
- [ ] **Step 2: Build `CandidatePanel`**: name ("Near Marunda"), kecamatan, the rate ± uncertainty (vertical, or line of sight with the one-track label), size, pairs per track, status, the lead label from `common.leadLabel`, the evidence disclosure, and `BowlActions` with `{ id, name }`. Escape and the close button clear `lead`.
- [ ] **Step 2b: Update `candidateLegend`** to say "vertical sinking" for `basis: "vertical"` and add the one-track label for `basis: "track10"`.
- [ ] **Step 3: List groups** on the pumping leads layer: candidates first under `foundInNisar`, seed bowls under `exampleBowls`; a candidate row selects it.
- [ ] **Step 4: Check in the browser**: click the ring, schedule a visit for a guest inspector, reload with `?lead=nisar-0-0` (no panel), 360 px layout, Indonesian.
- [ ] **Step 5: Commit** `feat(web): open NISAR candidates from the map and schedule a visit`.

### Task 8: A3, the Bowls desk section

**Files:**

- Create: `apps/web/src/features/bowls/components/nisar-leads.tsx` (server component with its skeleton)
- Modify: `apps/web/src/app/[locale]/(desk)/bowls/page.tsx` (one more `Suspense`), `bowl-queue.tsx` (counts include candidates)

**Interfaces:**

- Consumes: `getNisarLeads`, `BowlRowActions`.
- Produces: `NisarLeads({ locale })`, `NisarLeadsSkeleton()`.

- [ ] **Step 1: Build `NisarLeads`**: heading `foundInNisar`, one row per candidate with name, kecamatan, rate ± uncertainty (right-aligned, tabular), status, assignee, visit date (grey dash when empty), the one-track label when it applies, and `BowlRowActions`.
- [ ] **Step 2: Compose it** in the page above `BowlQueue`, each in its own `Suspense`.
- [ ] **Step 3: Include candidates** in the desk counts (leads, scheduled, overdue).
- [ ] **Step 4: Check in the browser**: the visit scheduled in Task 7 shows here with its date; the counts match.
- [ ] **Step 5: Commit** `feat(web): list NISAR leads in the Bowls desk`.

### Task 9: Docs, checks, and handoff

**Files:**

- Modify: `docs/prd-orbitalis.md`, `docs/hld-orbitalis.md`, `docs/services.md`, `docs/submission.md`, `docs/README.md` (link the spec and this plan), `apps/jobs/AGENTS.md`

- [ ] **Step 1: Update the docs** per the spec's Docs section; add the candidate-id risk to the PRD risks.
- [ ] **Step 2: Run** `grep -rn "shown as vertical\|public map\|seeMap" apps docs` and fix stragglers.
- [ ] **Step 3: Run** `bunx tsc --noEmit -p apps/web`, oxlint on changed files, `cd apps/web && bun test`, `bun run build`. Expected: all pass.
- [ ] **Step 4: Commit** `docs: record the two-track NISAR rate and NISAR leads`.
