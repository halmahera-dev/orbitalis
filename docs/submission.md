# Space Apps 2026 submission draft

Status: Draft. Date: 15 November 2026. Deadline: 15 November 2026, 23.59 WIB.

This file holds the text for the project page on spaceappschallenge.org. The page must be in English. Write here, review it as a team, then copy each section into the matching field. Rules come from the Jakarta technical meeting deck and the [PRD](prd-orbitalis.md), section 0.

Open items are marked **TODO**.

## Checklist before "Submit for Judging"

- [ ] Every team member is registered and listed on the team page. Members cannot be added after the deadline.
- [ ] The repo `halmahera-dev/orbitalis` is public. It is private now. Scan the git history for secrets before you open it.
- [ ] The app on `orbitalis.halmahera.site` runs the latest commit, and "Try as guest" works in a private window.
- [ ] The demo link (7 slides or 30 seconds of video) opens in a private window with no sign-in.
- [ ] Every image made with AI carries a visible watermark. **TODO:** confirm which landing images, if any, are AI-generated.
- [ ] The AI-use dropdown on the project page is filled in.
- [ ] Both check boxes (submission guide, original work and references) are ticked.
- [ ] Submit, then submit again after every later change.

## Project name

Orbitalis

## Team name

**TODO**

## Challenge

Dancing with the SARs

## High-level summary

Orbitalis turns NISAR radar into inspection leads for the people who manage groundwater in North Jakarta. Parts of North Jakarta sink more than 10 cm a year, mostly because deep wells pump out groundwater. Jakarta banned groundwater use in large zones in 2023, but regulators cannot see where pumping goes on. Orbitalis reads NISAR L-band interferograms (GUNW) over North Jakarta from two directions, stacks sixteen pairs from June to October 2026, and finds places that sink faster than the ground around them: the bowl shape a hidden pump leaves. The web app shows these bowls on a 3D map, opens a digital twin of the ground under each one, and lets a regulator schedule and record field visits. New map layers rank areas for water pipe extension, groundwater recharge, and water farming checks. Every number links to its source, and the app marks each value as measured or as an example. A lead is a reason to inspect, never proof. With NISAR's 12-day repeat, the same pipeline can check after every pass whether enforcement, pipes, and recharge slow the sinking.

(180 words. The limit is 50 to 200.)

## Link to project demo

**TODO:** one public link only. A slide deck (7 slides at most, the title slide counts) or a video (30 seconds at most).

## Link to final project

- Code: https://github.com/halmahera-dev/orbitalis (**TODO:** make public)
- App: https://orbitalis.halmahera.site (sign in with "Try as guest")

## Project details

### What it does

Orbitalis is a decision tool for four government groups that act on land subsidence in Jakarta, plus developers and the public later:

- **Groundwater regulators** (Dinas SDA, Badan Geologi) get a ranked list of pumping leads. Each lead opens a 3D digital twin of the ground: soil layers, buildings, high tide, and a year timeline to 2050 with and without the 2023 groundwater ban. A regulator can schedule a visit, assign an inspector, and record the outcome: pump found, no pump, or natural compaction.
- **PAM Jaya** sees which areas should get water pipes first, by people without piped water and by sinking rate.
- **KemenLH and DLH** see where recharge helps most and where large groundwater users must do water farming under the draft rule of June 2026.

The map has five layers (pumping leads, recharge priority, pipe priority, water farming, radar passes) and one priority filter for sinking rate, population, and economic activity. The filter and the selected area are in the URL, so a view can be shared. The interface is in Indonesian and English.

### How it works

1. **NISAR data.** A Python job searches ASF for NISAR L2 GUNW products over Jakarta: track 10 ascending and track 18 descending (frame 92), 8 consecutive pairs each. Each product is about 2.3 GB. The job reads only the North Jakarta window (137 × 388 pixels on an 80 m grid) with HTTP range requests and an Earthdata Login token, so one pair takes about 0.5 MB and under a minute.
2. **Per pair.** The job masks water and pixels with coherence below 0.6, removes the ionosphere phase screen that comes with the product, and converts phase to millimeters of range change.
3. **Stack per track.** It removes the regional ramp (atmosphere, orbit, and the slow sinking of the whole city), adds the pairs, and divides by the total time. The result is the extra range change of each place compared with the ground within about 3 km. The uncertainty comes from the spread between pairs.
4. **Two directions to vertical.** NISAR looks left, so the two tracks see the ground from the east and from the west. With the line-of-sight vectors from the product metadata, the job solves the two range rates for vertical and east motion, with north motion set to zero, and checks the solver on a known case before it runs. It also builds a vertical displacement series at 9 dates per bowl, because the two tracks fly one day apart.
5. **Bowls and leads.** The job reads the vertical rate inside each bowl and searches the stacked map for new bowl candidates: a local peak, at least two pixels wide, with a rate at least twice its own uncertainty. A candidate becomes a lead in the app: a regulator can open it on the map and schedule a visit.
6. **Web app.** Next.js on Cloudflare Workers reads the job output as small JSON files and never downloads satellite data during a page request. Scores are fixed formulas with visible weights. There is no machine learning model.

### First results from real NISAR data

- About 72% of the window has coherence of 0.6 or more in each pair. 58% of the pixels have at least five usable pairs on both tracks, so they get a vertical rate.
- On track 10 alone, the areas that published studies name as the fastest sinking show positive extra sinking (Muara Baru, Pluit, Penjaringan). With both tracks, Muara Baru shows 33 ± 59 mm/yr of extra vertical sinking. The uncertainty is still larger than most values, because there are only 3.5 months of data.
- No candidate passes the tests on the vertical map yet. One strong candidate stands out on track 10: an area of about 170 m radius in the Marunda industrial zone (106.949 E, 6.126 S, near Cilincing) sinks 88 ± 17 mm/yr of line of sight faster than the ground around it. Track 18 has no usable pixels there, so the second direction cannot confirm it. The app shows it as a lead with the label "One track only, not confirmed by the second track". It is a reason for a field visit, not proof of a pump.

### Benefits

- Inspectors go first to the places where the ground shows the strongest sign of pumping, instead of checking sites at random.
- Agencies can check after each NISAR pass whether the 2023 ban, new pipes, and recharge slow the sinking.
- Every number shows its source, period, and method, so a decision can be defended.

### What we hope to achieve

Replace every example value with processed NISAR and Sentinel-1 data, run a full MintPy time series as passes add up, check the rates against GNSS stations, and pilot the tool with one agency per desk in 2027. The roadmap is in the [PRD](prd-orbitalis.md), section 5.

### Known limits

- The NISAR rate is relative to the ground within about 3 km, not an absolute rate. The vertical rate sets north motion to zero.
- It is a simple stack, not a full time series (MintPy is planned).
- The one candidate is seen on one track only.
- Bowl depths, the Sentinel-1 series, the projection to 2050, the bowl rates in the desk table, the Overview chart, and the area layers (population, piped water, economic activity) are example values. The app labels them so.
- The water farming rule is a draft (KemenLH, June 2026).

### Tools

- Web: TypeScript, Next.js 16, React 19, MapLibre GL, three.js with React Three Fiber, Tailwind CSS 4, shadcn/ui, Better Auth, Drizzle ORM with PostgreSQL (Neon), zod, Cloudflare Workers (OpenNext), Bun, Turborepo
- Data jobs: Python 3.11, uv, h5py, NumPy, SciPy, pyproj, Pillow, fsspec, requests
- Basemap and buildings: OpenStreetMap data through CARTO vector tiles

## Use of AI

**TODO:** pick the matching options in the dropdown.

- We used Claude Code (Anthropic) to write and review parts of the code (web app and Python jobs), to check the product documents against the code, and to draft this text. The team reviewed and tested the output.
- No AI model runs inside the product. All scores and texts in the app are fixed formulas and templates.
- **TODO:** list any AI-generated images, and confirm they carry a visible watermark.

## NASA data

- **NISAR L2 GUNW (provisional), unwrapped interferograms, HDF5**, 16 pairs: 8 on track 10 ascending (26 June to 12 October 2026) and 8 on track 18 descending, frame 92 (27 June to 13 October 2026), from the ASF DAAC. Used for the vertical local sinking rate and series per bowl, and for the bowl candidates.
- **NISAR L2 GUNW browse images** (wrapped phase) for the 8 ascending pairs. Used for the pass timeline on the map.
- Found with [ASF Data Search Vertex](https://search.asf.alaska.edu/) and the ASF search API. Product details from the [NISAR Data User Guide](https://nisar-docs.asf.alaska.edu/).
- Method inspiration: [NASA ARSET InSAR notebooks](https://github.com/EJFielding/ARSET_notebooks) (ARIA GUNW with MintPy, OPERA DISP quality layers).
- Background: NASA Earthdata [Intro to SAR](https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/sar).

## Space agency partner data

NISAR is a joint NASA and ISRO mission. We used no other partner data in this version. Sentinel-1 (ESA) and SAOCOM (CONAE) are planned and are not used yet.

## References

Data and services:

- NASA, JPL, ISRO, ASF DAAC: NISAR L2 GUNW products and browse images
- OpenStreetMap contributors and CARTO: basemap and building footprints

Science and policy:

- Handika, Widodo, Pravitasari, [Combined Land Subsidence Analysis in Jakarta Based on PS-InSAR and MICMAC Methods](https://ejournal.brin.go.id/JTL/article/view/1125/2515), Jurnal Teknologi Lingkungan 25(1), 2024
- KemenLH, [water farming rule draft](https://www.kemenlh.go.id/news/detail/atasi-tanah-ambles-menteri-lh-siapkan-aturan-tentang-water-farming), 2 June 2026
- CNBC Indonesia, [groundwater permit rule](https://www.cnbcindonesia.com/news/20231113152455-4-488628/ngebor-air-tanah-wajib-izin-pemerintah-blak-blakan) (Kepmen ESDM 291.K/GL.01/MEM.G/2023), 13 November 2023
- Katadata, [piped water coverage 82% in May 2026](https://katadata.co.id/berita/nasional/6a60436dec29e/air-perpipaan-tembus-82-persen-pemprov-dki-kurangi-penggunaan-air-tanah), 22 July 2026
- Pergub DKI 93/2021 on groundwater-free zones
- NASA Space Apps 2026, [Dancing with the SARs](https://www.spaceappschallenge.org/2026/challenges/dancing-with-the-sars)

Software (open source): Next.js, React, MapLibre GL, three.js, React Three Fiber, camera-controls, Tailwind CSS, shadcn/ui, Base UI, Hugeicons, Better Auth, Drizzle ORM, zod, Recharts, OpenNext for Cloudflare, Bun, Turborepo, Oxlint, Oxfmt, h5py, NumPy, SciPy, pyproj, Pillow, fsspec, requests, uv.

Fonts: Inter and Geist Mono (SIL Open Font License).

**TODO:** confirm the source and license of the landing images (`planet.webp`, `ascii-magic.webp`, `landing/map-3d*.jpg`, the isometric figures). Team photos in `public/members` show adult team members only.
