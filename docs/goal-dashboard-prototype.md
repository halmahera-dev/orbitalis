# Goal: Finish the dashboard prototype, map first

Status: Draft. Date: 7 November 2026. Source: PRD `docs/prd-orbitalis.md` (F1–F8, G1) and the code in `apps/web/src/features/map`.

## Goal

A regulator opens the map and, in 3 minutes or less and without help, finds the 3 highest-ranked bowls in one _kecamatan_ and opens the evidence for one of them. The desk (Overview, Bowls, Team, Map) and the map show the same bowls, the same numbers, and the same "lead for inspection, not proof of a pump" label.

The map is the main work. The desk is done when it agrees with the map.

## What exists now

- `/map`: globe-to-Jakarta flight, bowl layer with drop height and a water layer, NISAR pair layer, year and pass slider with play, ban on/off switch, bowl select, URL holds bowl, year, and pass.
- Desk: Overview, bowl table with visit status and schedule, bowl detail and chart.

## What is missing on the map

| #   | Gap                                                                                           | PRD    |
| --- | --------------------------------------------------------------------------------------------- | ------ |
| 1   | No bowl list on the map page. The user can only pick a bowl from a dropdown.                  | F3     |
| 2   | No bowl panel on the map. Chart (Sentinel-1 before the ban, NISAR after) is only in the desk. | F4     |
| 3   | No evidence panel. Numbers have no source, dates, scale, or method.                           | F7     |
| 4   | The "lead for inspection" label is not on the map.                                            | F3, F8 |
| 5   | The URL does not keep the map position.                                                       | F8     |
| 6   | No 2D fallback and no check for phone width (360 px).                                         | F1     |
| 7   | The color layer shows drop in meters. The PRD asks for a legend in mm/yr.                     | F1     |
| 8   | No split view (L-band and C-band).                                                            | F5     |
| 9   | No GNSS check chart.                                                                          | F6     |
| 10  | No national view.                                                                             | G1     |

## Layers of work

Each layer ships a working map. Do not start the next layer before the last one works.

1. **Bowl look, list, and split layout.** Gaps 1, 2, 4. Bowls look like the reference image (see "Bowl look"). A click on a bowl, or on its row in the list, selects it and splits the page (see "Split layout"). The right side shows the bowl detail with the depth view (see "Depth view").
2. **Evidence and URL.** Gaps 3, 5. Each number opens source, product, dates, scale, and method inside the right side. No overlay and no blur. The URL holds the map position.
3. **Map quality.** Gaps 6, 7. Rate legend in mm/yr, 2D fallback, reduced motion, keyboard use, 360 px width.
4. **Desk agrees with map.** Same bowl data and labels. A bowl in the desk opens the same bowl on the map.
5. **Extra views.** Gaps 8, 9, 10. Only after layers 1–4 pass.

Recommended order for best UX: 1, then 2, then 3. Layers 4 and 5 wait. Layer 1 is what a regulator sees first, and layer 2 makes the numbers trustworthy. Layer 3 makes both work for everyone.

## Bowl page (digital twin)

The split layout is replaced. The map and the desk open the same page, `/[locale]/bowls/[id]`.

- `/map` shows all bowls and the ranked list. A click on a stack or a list row opens the bowl page.
- The bowl page is a bento layout. A 3D ground block (three.js, React Three Fiber, camera-controls) is the large scene on the left, not boxed in a card: the bowl surface with 10 cm depth rings, soil walls, and building footprints that sink with the ground. From 1280 px the left column has the year timeline tile on top, the scene, and a controls tile at the bottom with two tabs: Controls (the four views, the height steps ×1, ×100, ×250, and layer toggles for buildings, scenery, contours, ban grid (the green grid of the ground without the ban), rate color, high tide, and labels; rate color tints the ground green to orange by sinking rate, and off leaves it grey) and How to navigate (drag, scroll, pan, click a part, pick a year), plus an icon legend. Over the scene, only the ban case floats at the top right. The page opens in Cut-away at ×100. The right column (24 rem, scrolls) has tiles: the bowl header, four number tiles (depth, depth change since 2026, rate, year below high tide), the "saved by the ban" tile, one tabbed tile (Parts, Inspection, Evidence, as icon tabs), the depth cross-section, and the history chart. Below 1280 px everything stacks in one column: header, timeline, scene, summary, then the tiles. Icon-only buttons have a tooltip and an accessible name.
- Views: Overview, Cut-away (the block slices through the bowl center), Street, and Plan (a 2D top view). Without WebGL 2 the page shows Plan only.
- Parts: Bowl center, Bowl edge, Buildings, and Ground block. Street and Buildings share one camera, set back and above the blocks. A click on a building opens Buildings. A click on the scene or on a row in the Parts list picks a part. The camera moves to it, an emerald pin marks it, and a card shows its numbers. The URL holds the part. Picking a part in the scene switches the tabbed tile to Parts.
- Soil layers (an illustration, not a measured profile): fill, soft clay, sand, stiff clay, and deep sand with water. The two clay layers take the sinking (70% and 30%), so they get thinner under the bowl as the years pass. The block gets deeper with the height exaggeration, so the layers never cross. The Cut-away view shows layer names, a suspected well column, and a dashed line where the water pressure falls near the well. Picking Soft clay or Suspected well opens the Cut-away view. The well card says it is an illustration and a lead for inspection, not a found pump.
- Sea (example values in the seed): each bowl has a `groundHeightM` (the bowl floor height in 2026) and the seed has one shared `highTideM` (0.9 m). A water plane sits at the high-tide level. It shows as water in the bowl once the floor is lower than that level, and the Cut-away view shows a high-tide line on the cut face. The bowl floor goes below the sea in the first year when `groundHeightM` minus the drop is at or under `highTideM`. The page says that year (or "already", or "stays above until 2050"), the timeline marks every such year with a blue base line, and the High-tide level card shows the year with and without the ban. There is no coast side: the water is a pool in the bowl, because a real sea strip needs terrain that slopes to the coast.
- Measured years: the timeline now starts in 2015. For 2015 to 2025 the depth is today's depth scaled by the share of the total sinking since 2015 (Sentinel-1 rate until the ban date, NISAR rate after it). So every bowl grows from 0 in 2015 to its depth in 2026, and the bars before 2026 are solid. The depth in the seed is small compared with the rates, so a literal depth from the rates would be flat until about 2022.
- Ban ghost: when the "with ban" and "without ban" depths differ (2027 and later), a wireframe grid of the other case shows through the ground, and in Cut-away an emerald band fills the gap between the two profiles on the cut face. The band is the depth saved by the ban (or the extra depth, when you view "without ban").
- Checks (10 November 2026, Chromium on the dev server, 1280 px and 360 px): no console errors across Overview, Cut-away, Street and Plan, all parts, minimize and expand, and playback (one third-party warning: `THREE.Clock` is deprecated, from React Three Fiber). No sideways scroll at 360 px in English or Indonesian. Below 1280 px the timeline sits under the scene and not over it. The timeline works with the keyboard (arrows, Home, End, one tab stop). Cut-away labels stay inside the scene. Not checked: Safari, a real GPU, and reduced motion or reduced transparency in a browser (the code paths are in place, but the preview cannot switch the OS setting). Playback in Cut-away on a software renderer: median 16.7 ms a frame, about 15% of frames over 33 ms.
- Radar: 2026 is the NISAR year (8 passes, 26 June to 12 October). Its bar has a tick above it. When the year changes to 2026, or when the NISAR radar passes part is picked, a thin emerald curtain sweeps across the block once (1.4 s, no sweep with reduced motion).
- The timeline has no slider. It has one bar per year from 2026 to 2050. A bar rises to the depth without the ban, and a dot marks the depth with the ban. Click or drag across the bars, or use the arrow keys, Home, and End. A play button runs the years. Segmented controls choose the ban case (over the scene) and the height exaggeration (in the Controls tab).
- A click on another stack opens that bowl and keeps the year and the ban setting. "Back" returns to the previous page in the tab (the bowls list, the map, or today). With no earlier page, it opens `/map` at the bowl position, with no intro flight. The jump menu in the header replaces the history entry, so Back skips the bowls you jumped between.
- Buildings: the Cut-away and other 3D views draw OpenStreetMap building footprints from the same Carto vector tiles as the map (zoom 15, heights from the tile, 6 m when missing). They follow the sinking ground. Walls are grey, from the design tokens, with a window grid where about 1 in 4 windows glow gold. The map draws the same buildings with the same shader as a custom layer from zoom 16.5, so the windows keep their size in meters while you zoom. Below that zoom, and while the footprints load, the map shows flat grey extrusions. The custom layer draws in mercator only. Credit: OpenStreetMap contributors and CARTO.
- Building types: the tiles give no type for a building, so the code guesses one. A point of interest inside the footprint (place of worship, school, hospital) wins. Then the land use under the building (school, hospital, industrial). Then size: a footprint of 150 m² or less and 9 m or lower is a house, or 300 m² or less in a residential zone. Commercial zones never give houses. Each type has its own 3D model. Houses have plaster walls with a door and a few small windows, and a terracotta tile roof (gable, or hip on square footprints). About 1 in 5 houses has a flat roof with a water tank instead. Places of worship have arched windows, a gold dome on a drum, small corner domes, and a minaret. Schools have a band of windows and a flagpole. Hospitals have a glowing cross on the roof. Industrial buildings have no windows, a sawtooth roof, and a chimney on about 1 in 3. The bowl scene and the map use the same geometry and shader. The guess is a hint, not a record.
- Scenery: the same tiles and shader also draw parks (green ground), major and minor roads (road, sidewalk, and dashed lane line), street lamps with a gold glow, and low-poly trees. The tiles hold no trees or lamps. The code puts trees in parks and along minor roads, and lamps along roads, and skips spots under buildings. It caps trees at 3000 and lamps at 1000, nearest first. In the bowl scene the scenery follows the sinking ground. Colors come from the design tokens.
- Insight tile: a sentence built from the bowl data (not written by a model), with a gradient ring and a button that opens the Evidence tab.

## Depth view

The left panel shows how deep the bowl is, for the year on the timeline.

- A cross-section: ground line, the bowl curve, and the old ground level as a dashed line. The gap between them is the depth.
- A person next to it for scale (the map already has this gauge in `orbitalis-map.tsx`; reuse it).
- The depth number in m (and cm for small values), with the year and the ban on/off setting.
- It updates when the user picks a year in the Prediction section. With reduced motion, it changes with no tween.

## Bowl detail (chosen from three prototypes: Scroll, Tabs, Depth first)

- The detail is a fixed header and three tabs: Prediction, History, Evidence. The tab panel scrolls on its own. On a phone the whole pane scrolls.
- Header: name, _kecamatan_, rank (with the previous rank when it moved), a row of three numbers (depth now, drop by the chosen year, rate), and the lead note. The lead note is plain text with an emerald dot. It is not a pill.
- Prediction: year buttons, the ban switch, the cross-section with a depth marker, and a small table with the drop with the ban, without the ban, and the difference.
- History: the Sentinel-1 and NISAR chart, plus a table with the rate before the ban, the rate after it with its uncertainty, and the percent change.
- Evidence: the example-data note and three expandable items (depth, rate, projection).

## Prediction

- `/map` has no year control. It shows every bowl at a fixed baseline (2035, ban on).
- The year and the ban setting live on the bowl page timeline and stay in the URL. They affect only that bowl's stack. Every other bowl stays at the baseline.
- The projection note stays with the prediction ("at current rates, no sea wall, no pumping change, no sea-level rise").
- The radar view steps through NISAR passes with the same bar timeline, one bar per pass. The bar height is the share of clean signal.

## Bowl look

From the reference image (kept outside the repo):

- Each bowl is a stack of 3 round tiers. The tiers get smaller toward the top.
- Height and width grow with the sinking rate.
- Color follows the rate: green is slow, yellow is middle, orange is fast.
- A soft glow under each stack, and thin ripple rings on the ground around it.
- Each stack is clickable. Hover changes color only. A selected stack has a clear focus state.
- The map keeps the dark basemap and 3D tilt.
- With reduced motion, ripple rings do not animate.

## Done when

- A test user passes the 3-minute task (PRD KPI 1) on desktop and on a 360 px phone.
- Every number on the map has a source link (PRD KPI 8).
- Reduced motion, keyboard, and the 2D fallback still allow the task.
- Layers 1–4 pass `bun run check-types` and the lint step. Layer 5 is optional for this goal.

## Status (7 November 2026)

- Layers 1–4 are built. Type check and lint pass for the changed files. `/en/map` and `/id/map` render on the server.
- Checked in a browser (1280 px and 360 px): the stacks draw and match the reference look; a click on a stack selects the bowl and splits the page; the list, depth view, and evidence items work; the 2D switch flattens the map; the URL keeps bowl, year, view, and map position; there is no sideways scroll at 360 px.
- A scripted run of the regulator task (home page, read the top 3 bowls with their _kecamatan_, select one, open its evidence) works in under 1 second of script time.
- Found and fixed in that check: MapLibre does not accept a data expression for extrusion opacity, so the stacks did not draw at first.
- Keyboard check done in a browser: Tab and Enter select a bowl in the list, Enter opens an evidence item, Escape closes the detail.
- Reduced-motion check done in a browser (by forcing the media query): a bowl change jumps to the bowl with no flight.
- At 360 px with the detail open, the map is 371 px tall (it was 293 px) and the detail is 248 px tall.
- Not done: the timed task with 5 real test users (KPI 1 and 2). Only people can do this. See "How to run the user test" below.
- The year slider and play button are removed from the bowl map. The year and the ban switch moved into the bowl detail ("Prediction"). Checked in a browser: no slider on the page, year buttons and the ban switch change the drop, the list, the depth view, and the URL, and the keyboard path (Tab, Enter on a list row and on a year button) works.
- 360 px re-checked after the Prediction change: no sideways scroll, the map is 371 px tall, the detail is 248 px tall and scrolls, all 5 year buttons fit in one row, and the legend is hidden while a bowl is open.
- The ranked list now stays visible from 1280 px with the detail open, so a keyboard user can switch bowls from the list. Below 1280 px the header "Go to a bowl" select does this.
- Layer 5 (split view, GNSS chart, national view) is not started.
- 9 November 2026: the side detail and the desk drawer are replaced by the bowl page (see "Bowl page"). The map and the desk need a sign-in. The 7 November browser checks above were made on the old split layout.

## How to run the user test

1. Find 5 test users. Start each one on `/en/map` (or `/id/map`). Give no help.
2. Task: "Find the 3 highest-ranked bowls in Penjaringan and open the evidence for one." Record the time and any help given. Pass: 4 of 5 finish in 3 minutes or less.
3. After the task, ask: "Why is a bowl a lead and not proof of a pump? What does the year on the timeline assume?" Two team members score each answer against the evidence panel. Pass: 4 of 5 answer correctly.

## Not in this goal

Real NISAR processing in `apps/jobs`, sign-in changes, new data sources, and any non-goal in the PRD section 2.

## Open questions

Decided: map first, then the desk. Target date is 15 November 2026. Layers 1 and 2 are in. The URL keeps the map position. Layers 4 and 5 wait until layers 1–3 work.
