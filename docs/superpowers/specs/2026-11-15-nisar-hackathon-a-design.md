# Design: real NISAR evidence for the hackathon (A1 to A4)

Status: Draft for approval. Date: 15 November 2026. Deadline: 15 November 2026, 23.59 WIB. Source documents: [PRD](../../prd-orbitalis.md), [HLD](../../hld-orbitalis.md), [Business Flow](../../business-flow.md), [Services](../../services.md), [Submission draft](../../submission.md).

## Intent

Judges score Validity, Relevance, and Presentation. The app now holds one real NISAR result (a stacked local rate per bowl and one bowl candidate), but three places still weaken it:

1. The bowl chart draws a line labelled "NISAR (2026)" that is synthetic.
2. The rate is line-of-sight from one track, shown as vertical.
3. The one real finding (the Marunda candidate) is a dashed ring. Nobody can act on it, so it is not a lead in the sense of Business Flow N1.

A fourth issue is copy: the landing page offers "See the public map", but the map needs a sign-in (HLD 3.3).

The goal for tonight: every NISAR number on screen is real and says what it is, and a regulator can take the real finding through the N1 flow (lead, schedule a visit, record the outcome).

## Goals

- **A1.** The bowl page shows the real NISAR series for that bowl, and the synthetic NISAR line is gone.
- **A2.** The NISAR rate is vertical, from the ascending track 10 and the descending track 18 together.
- **A3.** A NISAR-detected candidate is a lead: it opens a panel on the map, it appears in the ranked list and in the Bowls desk, and it can be scheduled, dismissed, and given an outcome with the existing visit flow.
- **A4.** The landing copy matches the access rules, and one click takes a visitor to the map as a guest.

## Non-goals

- No MintPy time series, no Sentinel-1 processing, no GNSS check (Phase 1, after the hackathon).
- No new database tables, no schema change, and no migration. The `inspection` table already keys rows by a text `bowl_id`.
- No twin (3D scene) for a candidate. A candidate has no measured depth or history to draw.
- The projection, the depth, and the Sentinel-1 series stay example values. This work does not try to replace them.
- No change to the area layers (recharge, pipe, water farming).

## Anti-goals

These would make the work a failure even if it runs:

- Any synthetic value shown next to a real one without a label that tells them apart.
- A real relative rate compared, in one figure or one "change" number, with a synthetic absolute rate.
- A candidate that a person can schedule but that disappears from the desk, or a desk row that the map does not show.
- A broken map, bowl page, or desk on the deployed app before judging.

## Constraints

- Root `AGENTS.md`: no subagents, edit files directly, English in repo files, every string in `en.ts` and `id.ts`, design rules from `design.md`, run `check-types`, `check`, and `build` before calling it done, `grep` old names after a rename.
- `.agents/skills/nextjs-app-architecture`: pages compose and stay synchronous; queries in `*-queries.ts` with `server-only`; actions in `*-actions.ts` validate input and invalidate; components get IDs or resolved records; skeletons sit next to their component.
- `design.md` wins over the taste skill. From the taste skill's app-screen rules, these apply where they do not conflict: colour on data only, one hue per chart on the main data element, no legend for one series, 3 to 5 faint gridlines, straight line segments, tabular right-aligned figures, a missing value is a grey dash, a real zero is printed, no new icon chips, no gradients.
- antislop-code: no comment that restates the code; at most one short line where a constraint needs it.
- The Earthdata token stays in `NASA_API_KEY` in the git-ignored root `.env`. Jobs read it from the environment and never print it.
- Data from the jobs is static JSON in `apps/web`, validated with zod when the app reads it (Services, "Contract with `apps/web`").
- Technical meeting rules: everything a judge sees is in English (the app also has Indonesian), all links work without registration (the guest sign-in counts), every source is cited.

## Facts found

- Track 18 descending has two frames. Frame 92 has a full chain of 8 consecutive pairs (27 June to 13 October 2026) and covers North Jakarta. Frame 91 has 6 pairs. Use frame 92.
- Both tracks use EPSG:32748 on the same 80 m lattice (both x0 and y0 sit on a half-pixel of 80 m), so the North Jakarta windows align pixel for pixel.
- Each GUNW product carries `losUnitVectorX` and `losUnitVectorY` in `metadata/radarGrid` (east and north parts). East part at the window centre: about +0.65 ascending, -0.64 descending. NISAR looks left, so an ascending pass sees the ground from the east: the vectors point from the ground to the sensor. The up part is `sqrt(1 - x² - y²)`.
- Both tracks form a chain of 8 consecutive pairs, and their dates match one day apart (ascending 26 June, 8 July, 20 July, 13 August, 25 August, 6 September, 18 September, 30 September, 12 October; descending one day later each). A running sum per track gives a displacement at 9 dates, and the two can be decomposed date by date.
- The earlier ascending stack shows positive extra sinking at Muara Baru, Pluit, and Penjaringan, which supports the sign used in `sinking_millimeters` (a positive unwrapped phase is a range increase).
- `bowls-actions.ts` validates `bowlId` against the seed ids. The desk table reads depth, rates, and series that a candidate does not have.

## Approaches

### A1: how the real series appears

| Approach                                                 | Trade-off                                                                                                                                                                                                        |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a. Replace the NISAR line in the existing chart          | Least work. The real line moves about ±10 mm on an axis of -1,050 to +350 mm, so it looks flat, and a relative series shares an axis with an absolute one.                                                       |
| **b. A separate small chart, "NISAR measured" (chosen)** | One more component. Honest and readable: its own axis in mm relative to the ground around the bowl, an uncertainty band, and the measured rate under it. The synthetic NISAR line is removed from the old chart. |
| c. Numbers only                                          | Fastest, weakest picture for the judges.                                                                                                                                                                         |

### A3: how a candidate becomes a lead

| Approach                                                                                    | Trade-off                                                                                             |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| a. Add it to the bowl list with a full bowl page and twin                                   | The twin needs depth and a history. Filling them means synthetic values next to the one real finding. |
| **b. A map panel, a list entry, and a desk section, with the existing visit flow (chosen)** | Moderate work. Follows Business Flow N1 with no invented data.                                        |
| c. A panel with numbers only                                                                | Cheapest. Not a lead, because nothing can be done with it.                                            |

### A2 and A4

One sensible way each, described below. The alternatives (ignore the north component or estimate it; make the map public) contradict the data (north sensitivity is about 0.1) or HLD 3.3 (the map needs a sign-in).

## Design

### Data jobs (`apps/jobs`)

**`fetch_nisar_gunw.py`** takes a track argument. It reads track 10 ascending as today and track 18 descending frame 92 into `out/gunw/<track>/`. Each saved window also stores the window-centre LOS unit vector (east, north, up). Existing ascending windows move from `out/gunw/` to `out/gunw/10/`, or are fetched again (about 8 minutes).

**`stack_nisar_rate.py`** changes in four ways:

1. **Stack per track in range units.** For each track: mask, remove the ionosphere, remove the regional ramp with the same two Gaussian filters, and stack the range increase in mm per year (not divided by the cosine of the incidence). The per-pixel uncertainty is the spread between pairs divided by the square root of the pair count, as today.
2. **Decompose.** On pixels where both tracks have at least 5 pairs, solve for the up and east rates from the two range rates with the two LOS vectors, with the north rate set to zero. Propagate the two uncertainties through the same 2×2 inverse. The sign convention: a positive "sinking" value means the ground moves down relative to its surroundings.
3. **Series per bowl (A1).** For each bowl and each track, take the mean range-increase relief inside the bowl in each pair and keep a running sum over the 9 dates. Decompose date by date into a vertical series, dated on the ascending dates (the descending pass is one day later; the evidence says so). The band is the square root of the running sum of each pair's squared noise floor, carried through the same decomposition. _(Builder's call: vertical rather than one track's line of sight, because the dates match.)_
4. **Candidates (A3) on the vertical map.** Detection runs on the vertical rate with the same tests (local peak, radius at least 2 pixels, rate at least twice its own uncertainty). Each candidate gets a stable id from its rounded centre (`nisar-106949-6126`) and the name and kecamatan of the nearest seed bowl, so the UI can say "Near Marunda, Cilincing". _(Builder's call: the seed bowl, not the synthetic priority area, gives the place name.)_
5. **Self-check.** An assertion in the job builds range rates from a known up and east rate with the two real LOS vectors and checks that the decomposition returns them.

`nisar-rates.json` grows to hold: per track, the pair ids and dates; per bowl, the vertical and east rates with uncertainties, the per-track line-of-sight rates, and the track 10 series; and the candidates with id, name, kecamatan, centre, radius, vertical rate, uncertainty, and SNR. The zod schema in `nisar-queries.ts` follows it.

### Web app (`apps/web`)

**A1. Bowl page.**

- `BowlChart` stops drawing `series.nisar`. The Sentinel-1 line and the ban line stay, and the chart caption says they are example values.
- A new `NisarSeriesChart` (dynamic import, like `BowlChart`) sits in the history tile under it. One series in the brand hue, straight segments, a 14% flat band for the uncertainty, no legend, 3 to 5 faint gridlines, y in mm of vertical motion relative to the ground around the bowl (down is negative), and 9 dates on a time axis. The card title: "NISAR measured, 2026". For a bowl with no usable pixels, the frame and its title stay with one sentence: "No usable NISAR pixels in this bowl."
- The rate rows under the charts become: "Sentinel-1 before the ban (example)", then "NISAR vertical, relative to the surroundings", with the real rate and its uncertainty. The "Change in rate" row is removed, because it compares an example value with a relative measurement.
- The evidence item from the last change becomes vertical: two tracks, 16 pairs, both date ranges, the decomposition in one sentence.

**A3. Candidates as leads.**

- **Data:** `nisar-queries.ts` exposes the candidates. A new `getNisarLeads()` in `bowls-queries.ts` joins them with `inspection` rows, the same way `getBowls()` does, and returns `{ id, name, kecamatan, center, radiusM, rateMmYr, uncertaintyMmYr, status, assignee, visitDate, outcome, note }`.
- **Actions:** `bowls-actions.ts` accepts seed bowl ids and candidate ids. Nothing else changes in the visit flow.
- **Map:** the dashed ring becomes clickable on the pumping leads layer. A click opens a `CandidatePanel` built like `AreaPanel` (the same floating panel, the same rows): name, kecamatan, vertical rate ± uncertainty, size, pairs per track, its status, the lead label ("A lead for inspection, not proof of a pump"), the evidence disclosure, and the visit actions (`BowlActions` with the inspector names). The URL keeps the selection (`lead=<id>`). Escape and a close button close the panel.
- **Ranked list:** on the pumping leads layer, candidates come first under a short subheader, "Found in NISAR data". A row selects the candidate and opens the panel. Seed bowls follow under "Example bowls". The filter applies to candidates by their vertical rate and the nearest area.
- **Bowls desk:** a section above the table, "Found in NISAR data", lists the candidates with status, assignee, visit date, rate, and row actions. Columns a candidate cannot fill (depth, trend, change after the ban) are not shown there, so no grey-dash columns are needed. The desk counts (leads, scheduled, overdue) include candidates.
- **Overview:** no change tonight.

**A4. Landing.** `signInAsGuest(locale, destination)` takes a `destination` of `"desk"` or `"map"`, validated, defaulting to `"desk"`. The three "See the public map" links become guest sign-in forms with the destination `"map"`. New copy: "Open the map as a guest" (en) and "Buka peta sebagai tamu" (id). The `seeMap` key is renamed so nothing still says "public".

### Docs

Update the PRD (section 0 table, F2, F3, F7 states), the HLD (step 3 vertical motion, step 2 state), Services (the two job rows), `docs/submission.md` (vertical rate, 16 pairs, the candidate result, the known limits), and `apps/jobs/AGENTS.md` (the chain). `grep` "line of sight shown as vertical", "public map", and `seeMap` afterwards.

## Verification

- `bun test` for the pure web logic that changes (the candidate filter and ordering in `areas-priority.ts`).
- A plain-Python check in the job (an assertion) that the decomposition recovers a known vertical and east rate from synthetic range rates built with the two real LOS vectors.
- `bunx tsc`, oxlint on the changed files, `bun run build`.
- In the browser, at 1280 px and 360 px, in English and Indonesian: the bowl page history tile, the candidate panel, scheduling a visit on a candidate and seeing it in the desk, the landing link landing on the map as a guest.

## Decided by the owner

- **If the vertical map yields no candidate:** labelled fallback. The app shows the line-of-sight candidate from track 10, with the label "One track only, not confirmed by the second track" in the panel, the list row, and the desk row, and its rate shown as line of sight. A candidate found on the vertical map carries no such label. `nisar-rates.json` marks each candidate with `"basis": "vertical"` or `"basis": "track10"`.

## Left to the builder

- Exact component and file names beyond those named here, following the feature-folder rules.
- The id rounding, if a rerun moves a candidate by one pixel and changes its id. Accept that for tonight. The desk keeps the inspection row under the old id, so note it in the PRD risks.
- Chart sizes inside the history tile, within the app-screen chart rules.

## Order of work and time

1. A4, landing copy and guest destination (15 minutes).
2. Jobs: fetch descending, stack per track, decompose, series, candidates on vertical (about 1.5 hours, including about 8 minutes of reading).
3. A1, bowl page charts and rows (about 1 hour).
4. A3, candidate panel, list, desk, actions (about 1.5 hours).
5. Docs, checks, browser, commit (about 45 minutes).

Each step is committed on the feature branch when its checks pass, so a late failure never blocks the earlier steps. If time runs short, step 4 stops at the map panel and the list, without the desk section, and the submission text says so.
