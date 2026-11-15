# CLAUDE.md — ARES project context

> Put this file at the **repo root**. Claude Code reads `CLAUDE.md` automatically at the start of every session.

## Who we are

- **Team:** The Ares Initiative — 6 high school students, everyone shares all roles
- **Event:** NASA Space Apps Challenge 2026, ~48-hour build
- **Challenge:** *Interplanetary Survival Guide: Martian Map*
- **Product:** **ARES — Astronaut Route & EVA Safety system**
- **Tagline:** Science first. Safety always.
- **Repo:** public GitHub repo, MIT license (URL: `git remote get-url origin`)

## Rules for any AI working in this repo

1. **Follow the shared contracts below exactly** (file formats, function names, types, units, colors). Teammates build against them in parallel. If a change to a contract seems needed, **stop and warn** that the team must agree first.
2. **Never invent scientific numbers.** Use the values in this file or ask for a source. Label anything unsourced as an assumption.
3. **Finish core features before stretch features.** Never start a stretch feature while a core one is broken.
4. **Never leave `main` broken.** The live demo deploys from `main`. One branch per task, small commits, merge by pull request.
5. **No secrets in the repo or the frontend.** API keys live only in environment variables on the backend.
6. Keep the planner free of UI code so tests and the AI backend can reuse it.
7. Explain things simply — the team is learning as it builds.
8. Never add Co-Authored-By lines, 'Generated with Claude Code', or any AI attribution to commits or pull requests.
9. Never add team members' real names to any file. Use 'The Ares Initiative'.
10. The AI assistant (`backend/`, `app/src/ai/`) is NOT part of the submission. Don't mount it or deploy the backend unless the team decides otherwise.

---

## Submission rules

Full details and links to the official pages are in [`docs/submission.md`](docs/submission.md). These override anything older in this file.

- **Deadline:** Sunday Nov 15, 2026, 11:59 pm, local event time. Click "Submit for Judging" before then.
- **Feature freeze:** Sunday 2 pm. After that: bug fixes, video, slides and the project page only.
- **Demo video: 30 seconds or less.** Longer makes the project ineligible for Global Judging.
- **No names, faces or voices of anyone under 18** in the app, README, slides, video or submission. The whole team is under 18, so use "The Ares Initiative" and role names everywhere.
- **AI use must be disclosed honestly** in the submission: which tools were used and for what.

---

## 1. The challenge (NASA's brief, summarized)

Create a layered, integrated map/tool for a location or route on Mars that combines data from multiple NASA missions and helps a human explorer plan and carry out a Marswalk while doing science. Existing tools (JPL Mars Trek, USGS-NASA geologic maps) are regional/global, **not hyperlocal** at the scale of one EVA.

The brief asks us to consider: a science objective first, then a location; **at least three data types** layered or combined; **astronaut safety first** including radiation and space weather; spacesuit mobility limits and carried gear; a **route that avoids obstacles**; a display format (habitat screen, tablet, or helmet HUD); **rover point-of-view imagery**; rovers or astronauts in pairs; inspiration from how NASA mapped other worlds (e.g. Apollo).

Judging (typical Space Apps): **impact, creativity, validity, relevance, presentation.**

## 2. What ARES is

Google Maps for an astronaut walking on Mars, which also tells you how much oxygen you'll have left and when you must turn back.

The astronaut picks science stops. ARES plans the safest walking route around steep slopes, boulder fields and soft sand; adds up walking time, oxygen and radiation dose; draws a glowing **safe-return zone** (everywhere still reachable with a safe walk home); plays the walk across the Martian day on a timeline; simulates **dust storm** and **solar particle event** emergencies with an instant abort route home; and shows a minimal **helmet HUD** plus real rover photos at each stop.

**Pitch story:** It's 2040. Commander Reyes steps out of the habitat at Jezero Crater with 8 hours of oxygen, a 20 kg sample kit and 5 km of unknown terrain. Her job is to collect rocks that may hold signs of life from 3.5 billion years ago. ARES gets her there and back.

### Mission and site

| | |
|---|---|
| Callsign | ARES-1 EVA |
| Site | Jezero Crater delta front (Perseverance's region), bounds **18.40–18.50 N, 77.36–77.50 E** (~6 × 8 km) |
| Science objective | Sample **carbonate and clay** layers at the ancient river delta — top targets for preserved signs of past life |
| Habitat | HAB-1 at **18.4446 N, 77.4509 E**: the Perseverance landing site, from NASA's "Where is Perseverance" waypoints file. Flat, firm ground. |
| Demo mission | Séítah outcrop "Brac" (rover sampling site) → **delta front toe** (new science target selected from the CRISM clay signal, not visited by Perseverance) → Máaz lava rock "Sid" (rover sampling site) → habitat. 30 min at each stop: **4.97 km, 3 h 35 min, 192 min oxygen margin, GO.** |
| User | Astronaut planning in the habitat, then walking with a tablet or helmet HUD |
| Why Jezero | Strong life-search story, high-res NASA terrain data from the Perseverance landing, thousands of rover photos. NASA's own example is Mount Sharp, so most teams will pick that — Jezero sets us apart. |

### Six data types → three answers

We don't just toggle layers; we combine them into: **where it's safe to walk, where the best science is, when it's safe to be outside.**

| Data type | Source | What it tells us | Combined into |
|---|---|---|---|
| Optical | HiRISE orthomosaic, 25 cm (MRO), USGS Mars 2020 TRN mosaic | What the ground looks like | Basemap (`basemap.png`) |
| Topographic | HiRISE DTM mosaic, 1 m (MRO), USGS Mars 2020 TRN mosaic | Elevation, slope, cliffs, ground roughness | Walking difficulty |
| Thermal | THEMIS thermal inertia, 100 m (Mars Odyssey), Edwards & Buz 2021 | Low = soft sand, high = firm ground | Walking difficulty |
| Spectral | CRISM observation HRL000040FF, 36 m (MRO) | Clay and carbonate signatures | Science value |
| Atmospheric | MEDA (Perseverance), Munguira et al. 2023 | Daily low and high air temperature and when they happen | Conditions over the day |
| Radiation | RAD (Curiosity, at Gale Crater), Hassler et al. 2014 | Surface dose 0.64 ± 0.12 mSv per day | Conditions over the day |

All six are real data in the app today. Exact products, DOIs and links: `docs/sources.md`. How each layer is made: `pipeline/README.md`.

Note: RAD is on Curiosity, not Perseverance. Label it "surface baseline measured by Curiosity RAD, applied to Jezero."

### Core features (in priority order)

1. **Layered map** — real Mars imagery + toggleable analysis layers (walking difficulty, slope, soft sand, boulders, science value), each labeled with data type and source mission.
2. **Route planner** — click to add stops, set dwell time; fastest safe route habitat → stops → habitat.
3. **Oxygen budget + safe-return zone** — gauge for oxygen at return; glowing electric-blue boundary that shrinks as stops are added.
4. **Status light** — GO / CAUTION / NO-GO with the reason written out.
5. **Sol timeline** — play/scrub; astronaut marker moves; sun, temperature, radiation update.
6. **Emergencies** — Dust Storm and Solar Particle Event buttons: the **EVA** status goes NO-GO (the EVA is aborted), the zone collapses, and a red abort route home is drawn from the current position with its own **Return home** status (CAUTION if she can make it with the oxygen reserve intact, NO-GO if not). See Contract 3.
7. **Helmet HUD** — full-screen minimal view: heading arrow, distance to next stop, oxygen, margin, dose.
8. **Ground view** — real Perseverance photo at each stop.

### Stretch features (only after core works end to end)

- **AI assistant** with tool calling (explains plans; never decides) — *treat as stretch even though the handbook lists it as core*
- ML boulder detection from HiRISE images
- Optimize stop order; suggest stops by science per oxygen-minute
- Buddy mode (two astronauts) + support rover as mobile safe haven
- Voice commands in HUD; auto-generated Apollo-style cuff checklist; 3D terrain flyover

### Novelty (pitch points)

1. Built for a **person in a spacesuit**, not a rover.
2. **Safe-return zone** — from aviation's point of no return and Apollo walkback limits, computed live over real terrain.
3. **Science per oxygen-minute.**
4. **Time as a dimension** — when to walk, not just where.
5. **One plan, two formats** — habitat console → helmet HUD.
6. **"The AI explains, the planner decides."** Routing is deterministic (no ML), which is right for safety-critical decisions: predictable, explainable, testable.

---

## 3. Tech stack and decisions

- **Frontend:** React + Vite + TypeScript in `/app`. CSS variables for design tokens. State in React context or Zustand (one source of truth for the plan).
- **Map: Leaflet with `L.CRS.EPSG4326`.** *Not MapLibre* — MapLibre only supports Web Mercator, and Mars Trek tiles are equirectangular (lat/lng).
- **Mars Trek tiles:** `https://trek.nasa.gov/tiles/Mars/EQ/<LAYER_ID>/1.0.0/default/default028mm/{z}/{y}/{x}.jpg` (layer IDs from the Mars Trek site). **Test this in hour 1.** Always keep a fallback basemap: a hillshade drawn from the elevation layer.
- **Site basemap:** `app/public/data/basemap.png` is the real HiRISE orthomosaic of exactly the site bounds (2400 × 1714, about 3.5 m/pixel, 2.6 MB; source and credit in `basemap.json`). Show it as a Leaflet image overlay over the site bounds: `L.imageOverlay("data/basemap.png", [[18.40, 77.36], [18.50, 77.50]])`. It needs no network, so it also works when Mars Trek is down.
- **Frontend basemap check:** `Mars_Viking_MDIM21_ClrMosaic_global_232m` WMTS capabilities list native levels **0–7**, 256 px tiles. Use `maxNativeZoom: 7` (level 9 requests returned 404). Jezero tile `7/50/183.jpg` returned HTTP 200, and production Chrome review displayed imagery with terrain overlays. This is coarse Viking imagery, not HiRISE; closer map zooms enlarge the level-7 tiles. Elevation hillshade remains the outage fallback.
- **Frontend deployment:** https://ares-mission-console.vercel.app (`?frontend` skips briefing/HUD). Vercel project `ares-mission-console`, root directory `app`. Production currently uses CLI deployment. GitHub auto-deploy is pending Vercel access to the GitHub repo; the CLI connection attempt failed.
- **Planner:** TypeScript in `/app/src/planner`, optionally in a Web Worker. Pure functions, no UI code.
- **Data pipeline:** Python (numpy, GDAL, rasterio) in `/pipeline`; QGIS for visual checks.
- **Backend (stretch, AI only):** FastAPI or one Vercel serverless function in `/backend`.
- **AI:** Claude or GPT API with function calling.
- **Hosting:** Vercel from `main`. **Design:** Figma.

### Decisions made (do not silently change)

| Decision | Value / reason |
|---|---|
| Mars radius for all distance math | **3396190 m** (IAU sphere used by Mars map products; gives the 24.6 × 24.7 m cells). Use this in `constants.ts` too — the handbook's `3389500` mean radius is **replaced** to avoid mismatches. |
| Grid resolution | **25 m** (320 × 240). 5 m would blow the 5 MB JSON limit. Finer resolution is "future work." |
| Map library | Leaflet EPSG4326 (see above) |
| Walking-speed formula | A variant of **Tobler's hiking function** — cite it by name |
| Sun position | **Mars24 algorithm** (NASA GISS, Allison & McEwen 2000). Pick one fixed date (solar longitude Ls) for the demo and list it in assumptions. |
| Dust storm effect | Mars air is too thin for wind to push people. The slowdown is from **low visibility and dust on the visor/suit**, not wind. Say that in the slides. |
| AI assistant | Stretch, not core |

---

## 4. Repository structure

| Path | Contents |
|---|---|
| `/app` | React frontend |
| `/app/src/planner` | Routing, oxygen, safe zone, abort, environment model |
| `/app/src/styles` | `tokens.css`, global CSS and the theme files (`theme-deep-space.css`, `theme-mono.css`; Mono is the default, see Contract 6) |
| `/app/public/data/site.json` | Terrain grid (Contract 1), built from real NASA data |
| `/app/public/data/basemap.png` | HiRISE image of the site bounds (+ `basemap.json` with its source) |
| `/app/src/planner/__fixtures__` | Fake terrain used **only** by planner unit tests |
| `/app/public/photos` | Rover photos for each stop |
| `/pipeline` | Python scripts that build `site.json` and `basemap.png` from NASA data + README |
| `/backend` | AI assistant API (stretch) |
| `/ml` | Boulder detection notebooks (stretch) |
| `/docs` | `sources.md`, `assumptions.md`, slides, video script |

`.gitignore` already covers Python (`.venv/`, `__pycache__/`), secrets (`.env`) and raw data downloads (`data/raw/`, `*.tif`, `*.IMG`, `*.zip`). Source data is never committed; the pipeline fetches it.

---

## 5. Shared contracts

### Contract 1 — `site.json` terrain file

Produced by the data pipeline; read by the planner and the frontend.

```json
{
  "name": "Jezero Crater delta front",
  "bounds": { "south": 18.40, "north": 18.50, "west": 77.36, "east": 77.50 },
  "width": 320,
  "height": 240,
  "cellSizeM": { "x": 24.6, "y": 24.7 },
  "layers": {
    "elevation":      [ "width*height numbers, meters" ],
    "slope":          [ "degrees, 0 to 90" ],
    "rock":           [ "ground roughness, 0 to 1 (stand-in for boulders)" ],
    "thermalInertia": [ "J m-2 K-1 s-1/2" ],
    "science":        [ "science value, 0 to 1" ]
  },
  "habitat": { "name": "HAB-1", "lat": 18.4446, "lng": 77.4509 },
  "pois": [
    { "id": "seitah-brac", "name": "Séítah outcrop (Brac)", "lat": 18.43397, "lng": 77.44301,
      "kind": "science", "note": "Olivine-rich igneous rock altered by water, with carbonate",
      "photo": "photos/seitah-brac.jpg", "photoCredit": "NASA/JPL-Caltech" }
  ],
  "sources": {
    "elevation": "Mars 2020 Terrain Relative Navigation HiRISE DTM Mosaic, 1 m/pixel (Fergason et al. 2020, ...)",
    "slope": "Derived from elevation: 90th percentile of 5 m slopes in each 25 m cell (...)",
    "rock": "Roughness proxy, not a boulder count: ... (HiRISE DTM mosaic, ...)",
    "thermalInertia": "THEMIS-derived Thermal Inertia of Jezero Crater, Mars, 100 m/pixel (Edwards & Buz 2021, ...)",
    "science": "MRO CRISM MTRDR HRL000040FF (36 m/pixel) refined summary parameters ... Relative 0-1 index"
  }
}
```

**Grid rules:** row-major, `index = row * width + col`. **Row 0 = north edge, column 0 = west edge.** Planetocentric latitude, east-positive longitude, degrees. Missing values = `null`. Round to 2 decimals. File < 5 MB. Elevation at Jezero is negative (~ −2,500 m) — that's normal.

**Click → cell:** `col = floor((lng - west) / (east - west) * width)`, `row = floor((north - lat) / (north - south) * height)`.

**Real data.** `site.json` is built from real NASA data by `pipeline/build_site.py`; every `sources` entry names the exact dataset (full strings are in the file). What the layers mean:

- `elevation`: mean of the 1 m HiRISE DTM in each cell.
- `slope`: 90th percentile of ~5 m slopes inside the cell, so a small cliff is not averaged away.
- `rock`: ground roughness (bumpiness left after removing the cell's tilt; 1.0 m = 1.0). It is **not** a boulder count.
- `thermalInertia`: THEMIS, 100 m detail resampled to the grid.
- `science`: relative clay/carbonate index from CRISM. Not a mineral abundance.

**POIs.** The first three `science` POIs are the demo mission, in walking order. Seven POIs are Perseverance sampling sites; `delta-toe` is a new science target selected from the CRISM clay signal, not visited by Perseverance. A POI's `photo` and `photoCredit` are optional (`delta-toe` has no rover photo).

**Test fixture.** Planner unit tests use a synthetic terrain file, `app/src/planner/__fixtures__/fake-site.json` (made by `pipeline/fixtures/make_fake_site.py`). It has an extra `"fake": true` key; consumers ignore unknown keys. The app never loads it.

### Contract 2 — suit and mission constants (`/app/src/planner/constants.ts`)

| Constant | Value | Meaning |
|---|---|---|
| `CONSUMABLE_HOURS` | 8 | Life support at nominal rate |
| `RESERVE_MIN` | 45 | Oxygen time that must remain at return |
| `WALK_BURN` | 1.3 | Oxygen multiplier while walking with load |
| `WORK_BURN` | 0.9 | Oxygen multiplier during science at a stop |
| `BASE_SPEED_KMH` | 3.0 | Suited speed on flat firm ground |
| `MAX_SLOPE_DEG` | 25 | Steeper = no-go |
| `SAND_TI_THRESHOLD` | 175 | Thermal inertia below = soft sand |
| `SAND_SPEED_FACTOR` | 0.55 | Speed multiplier in sand |
| `ROCK_NO_GO` | 0.75 | Rock (roughness) value above = no-go |
| `STORM_SPEED_FACTOR` | 0.55 | Speed multiplier in dust storm |
| `STORM_EXTRA_RESERVE_MIN` | 30 | Extra reserve during storm |
| `DOSE_MSV_PER_SOL` | 0.64 | Avg surface dose equivalent, mSv. **Sourced:** Curiosity RAD, 0.64 ± 0.12 mSv/day (Hassler et al. 2014, Table 1) |
| `SPE_MULTIPLIER` | 30 | **Illustrative** dose-rate increase in a solar particle event. Not a measured value |
| `SPE_IS_ILLUSTRATIVE` | `true` | Tells the UI to label every SPE dose number "illustrative" |
| `SPE_MEASURED_2017_PEAK_MULTIPLIER` | 1.5 | What RAD really measured in its largest surface event (Zeitlin et al. 2018). For display only; the planner does not use it |
| `SOL_HOURS` | 24.66 | Sol length in Earth hours |
| `MARS_RADIUS_M` | **3396190** | See decisions above |

**Walking speed:**
`speed = BASE_SPEED × exp(−3.0 × tan(slope)) × (SAND_SPEED_FACTOR if TI < 175) × (1 − 0.6 × rock) × (STORM_SPEED_FACTOR if storm)`.
Cells with slope > `MAX_SLOPE_DEG` or rock > `ROCK_NO_GO` are impassable.

**Oxygen:** `oxygenUsedSec = walkSec × WALK_BURN + scienceSec × WORK_BURN`.
`margin = CONSUMABLE_HOURS × 3600 − reserveSec − oxygenUsedSec` (reserve includes storm extra when active).

**Safe-return zone:** a cell is inside if `(time from last stop to cell + time from cell to habitat) × WALK_BURN ≤ oxygen left after reserve`.

### Contract 3 — status rules

**EVA status** (the plan as a whole; from `planRoute`, plus the emergency rule below):

| Status | When | Shown as |
|---|---|---|
| NO-GO | Margin < 0, any stop unreachable, **or a dust storm or solar particle event is active (the EVA is aborted)** | Red, pulsing, with reason |
| CAUTION | Margin < 25% of the **usable budget**, or sun < 10° at any time during the EVA | Amber, with reason |
| GO | Everything else | Green |

**Usable budget** = `CONSUMABLE_HOURS × 3600 − reserveSec`, where `reserveSec = RESERVE_MIN × 60`, plus `STORM_EXTRA_RESERVE_MIN × 60` when a storm is active. Example (calm): 28,800 − 2,700 = 26,100 s, so CAUTION below 6,525 s (≈109 min) of margin. Helpers: `oxygenBudget(storm)` and `isLowMargin(marginSec, budget)` in `oxygen.ts`.

#### Emergencies

During a dust storm or SPE there are **two** statuses, and the UI shows both, labelled:

| Label | What it describes | Status |
|---|---|---|
| **EVA** | The mission plan | Always **NO-GO**: the EVA is aborted |
| **Return home** | The abort route from `abortRoute` | **CAUTION** if home is reachable with margin ≥ 0; **NO-GO** if the margin is negative or home is unreachable |

The return-home status is never GO: walking home through an emergency always needs attention. Each status is shown with its own reasons (`abortRoute` returns `reasons`).

Status must never rely on color alone — always show the word and reason.

### Contract 4 — planner functions (`/app/src/planner`)

```ts
type LatLng = { lat: number; lng: number };
type Stop = { id: string; lat: number; lng: number; dwellMin: number; label: string };
type Conditions = { storm: boolean; spe: boolean; startLmst: number };
type CostGrid = {
  width: number; height: number;
  cellSizeM: { x: number; y: number };
  secPerM: Float32Array;     // seconds to walk 1 m in each cell (1 / speed); Infinity = no-go
  minSecPerM: number;        // fastest cell on the grid; used by the A* heuristic
  conditions: Conditions;    // what the grid was built for; planRoute reads storm/spe from here
};

loadSite(json): Site
buildCostGrid(site: Site, conditions: Conditions): CostGrid
planRoute(site, cost, habitat: LatLng, stops: Stop[]): Plan
// Plan = { ok, legs: [{ path: LatLng[], walkSec, distM, arriveSec }],
//          totalSec, walkSec, workSec, distM, oxygenUsedSec, marginSec,
//          oxygenAtReturnPct, status: "GO" | "CAUTION" | "NO-GO", reasons: string[] }
safeZone(site, cost, plan: Plan): Uint8Array            // 1 = inside zone, per cell
positionAt(plan, tSec): { lat, lng, phase: "walk" | "science", legIndex, oxygenUsedSec }
abortRoute(site, stormCost, from: LatLng, oxygenUsedSec): { path: LatLng[], sec, marginSec, status, reasons }
envAt(lmstHours: number, spe: boolean): { sunElevationDeg, tempC, doseRateMsvPerHr }
explainSegment(site, plan, legIndex): { maxSlopeDeg, sandFraction, rockMax, detourNote }
```

Behaviour notes (implemented in `/app/src/planner`):

- **Leg paths** are smoothed (section 6, step 9). Each starts and ends at the exact habitat/stop coordinates. A waypoint is dropped only if the straight line crosses passable cells **and** is no slower than the grid path it replaces, so a drawn leg never cuts across sand the route went around. `walkSec`/`distM` come from the grid path.
- **planRoute, impossible plans:** never throws and never returns NaN or Infinity. Each unusable place gets one sentence in `reasons`: "Stop 2 is on a slope over 25 degrees.", "Stop 3 is outside the mapped area.", "Stop 1 is on ground too rough to cross (rock over 0.75).", "Stop 1 is on ground with no terrain data.", "The habitat is outside the mapped area.", or "No safe path from stop 1 to stop 2: …". A missing, negative or broken dwell time counts as 0. `robustness.test.ts` checks this, including 500 random plans.
- **planRoute, sun rule:** the sun elevation is checked once a minute from `conditions.startLmst` to the end of the EVA (walking and science), using `sunElevationSeries`. Below 10° at any point → at least CAUTION, with the time (LMST) and elevation in the reason. NO-GO still wins. An empty plan is not checked.
- **Fields** (full-field Dijkstra) are cached per `CostGrid` object. Build a new grid when conditions change; never edit `secPerM` in place. Build the storm grid **once** when a storm starts and reuse it for every `abortRoute` call.
- **safeZone:** "oxygen left after reserve" = oxygen left when leaving the last stop = `plan.marginSec + lastLeg.walkSec × WALK_BURN`. No stops → every cell with a round trip inside the usable budget. Empty if `!plan.ok` or `marginSec < 0`. Pass the same `cost` the plan was built with.
- **positionAt:** `t` is clamped to `[0, totalSec]`; both ends are the habitat. Even pace along each leg (assumption). During science `legIndex` is the leg that just arrived. **Empty plan → `lat` and `lng` are `NaN` and `legIndex = −1`**, so check before drawing a marker.
- **abortRoute:** home = `site.habitat`; reserve follows `stormCost.conditions`. Returns `reasons` as well as `status`, so the return-home status always has a reason (Contract 3). Unreachable → `path: []`, `sec: Infinity`, `marginSec: −Infinity`, NO-GO. **It has no sun check** (it is not given the time of day).
- **envAt:** exported from `index.ts` with `sunElevationSeries(startLmst, durationSec, stepSec)`. Sun from Mars24 at 18.45 N for a fixed season (Ls 0°); `tSec` is Earth seconds.
- **explainSegment:** facts are for the cells the drawn leg crosses. Throws `RangeError` for a bad `legIndex`.
- **format.ts:** one formatter for every number the UI shows: `formatMinutes(sec)`, `formatDuration(sec)` (h:mm), `formatKm(m)`, `formatPct(pct)`, `formatDose(mSv)`, `formatLmst(hours)`, `formatMet(sec)`. One rule, round half up; missing values show "—".
- **stormAt**`(site, plan, tSec, "dust" | "spe", startLmst?)`: everything the UI shows in an emergency: `evaStatus`, `evaReasons`, `abort` (the return-home route and its status), `position`, `oxygenNowPct`, `oxygenOnArrivalPct`, `walkHomeMin`, `marginMin`, `arriveSec`.
- **computeBriefing**`(site, plan, conditions)`: five rows for the opening page (TERRAIN, CONSUMABLES, RADIATION, LIGHTING, WEATHER), each with a status, ready-to-show text and an evidence tag (OBSERVED / CALCULATED / INTERPRETED / ASSUMED; `SCIENCE_EVIDENCE` = INTERPRETED is for CRISM-based science numbers; every number is listed with its level in `docs/parameters.md`), plus an overall Contract 3 status.
- **scienceScore**`(site, plan, options?)`: for each stop, its science value, the extra oxygen it costs and science per oxygen-minute.
- **suggestStops**`(site, habitat, existingStops, n?, options?)`: up to `n` extra stops worth adding, ranked by science per oxygen-minute, each keeping the plan GO. The planner suggests; the astronaut decides.
- **worker.ts / plannerClient:** `app/src/planner/worker.ts` runs the planner in a Web Worker (loads `site.json` once, keeps the plan); `app/src/lib/plannerClient.ts` gives it a typed promise API (`plan`, `safeZone`, `abort`, `positionAt`, `suggestStops`, `walkHome`) where the latest request wins. Same pure functions, off the main thread.
- **Extra helpers** (additive): `oxygenBudget`, `isLowMargin`, `walkHomeSec` (cursor probe), `fieldFrom`, `smoothPath`, `segmentTimeSec`, `distanceM`, `polylineLengthM`.

### Contract 5 — AI assistant tools (stretch)

Each tool calls a planner function; the model never calculates numbers itself.

| Tool | Args | Does |
|---|---|---|
| `get_plan_summary` | — | Current stops, times, oxygen, margin, status, reasons |
| `add_stop` | lat, lng, dwellMin, label | Adds stop, returns new summary |
| `remove_stop` | stopId | Removes stop, returns new summary |
| `reorder_stops` | stopIds | Reorders, returns new summary |
| `explain_route` | legIndex | Slope, sand, boulder facts for that leg |
| `simulate_storm` | atSec | Abort route from that moment |
| `explain_layer` | layerName | What the layer shows and its source |

Tool loop: frontend sends message + plan summary to `/assistant`; model returns tool calls; **frontend runs them on the local planner**; results go back; model writes the answer. System prompt: brief, must call tools for every number, never declares a plan safe on its own.

### Contract 6 — design tokens (`/app/src/styles/theme-mono.css`)

Source of truth: app/src/styles/theme-mono.css. If they disagree, the CSS wins.

The app runs in the **Mono theme** by default (`<html data-theme="mono">`, set in `main.tsx`): black, grey and white, with one electric-blue accent. Three files define the tokens, loaded in this order; a later file overrides an earlier one:

1. `tokens.css`: token names, spacing, radii, the status colors and the base ("classic") palette, which is only shown with `?theme=classic`.
2. `theme-deep-space.css`: the console layout, shared by the Deep Space and Mono themes (`?theme=deep-space` shows its navy palette).
3. `theme-mono.css`: the Mono palette and fonts. This is what the demo shows.

Values in effect in the Mono theme:

| Token | Value | Use | Defined in |
|---|---|---|---|
| `--void` | `#0a0a0a` | App background | `theme-mono.css` |
| `--void-deep` | `#050505` | Header bar | `theme-mono.css` |
| `--console` | `#111111` | Panels | `theme-mono.css` |
| `--console-2` | `#171717` | Cards, inputs | `theme-mono.css` |
| `--hairline` | `rgba(255, 255, 255, 0.2)` | Borders (`rgba(var(--ds-tint), 0.2)`; the tint is white in Mono) | `theme-deep-space.css` + `theme-mono.css` |
| `--text` | `#ededed` | Main text | `theme-mono.css` |
| `--muted` | `#a3a3a3` | Labels | `theme-mono.css` |
| `--mars` | `#ffffff` | The plan: route, stops, primary marks (the name is kept from the old palette) | `theme-mono.css` |
| `--safe` | `#3d7bff` | Electric blue: safety, interaction and focus (safe zone, astronaut, habitat marker, HUD arrow, oxygen margin, playhead) | `theme-mono.css` |
| `--ds-blue-fill` | `#2f6bff` | Filled main buttons (Play, Begin planning), so white text on them keeps 4.5:1 | `theme-mono.css` |
| `--go` | `#3ddc97` | GO | `tokens.css` (not overridden) |
| `--caution` | `#ffb020` | CAUTION, soft sand | `tokens.css` (not overridden) |
| `--nogo` | `#ff4d5a` | NO-GO / real danger only | `tokens.css` (not overridden) |
| `--science` | `#d4d4d4` | Science sites | `theme-mono.css` |

Other Mono choices in the CSS: the map imagery is shown in greyscale; the timeline track is white for walking and `#7a7a7a` for science; rover sample-site markers are `#d4d4d4`. `theme-mono.css` also sets helper variables prefixed `--ds-` (label, line and tile shades); read them from the file.

Fonts: **IBM Plex Sans** for body and headings (`--font-body`, `--font-heading`), **IBM Plex Mono** for all numbers and telemetry (`--font-mono`), both loaded from Google Fonts by `theme-mono.css`. Icons: **Lucide**. Spacing on a 4 px grid (`--space-1` 4 px to `--space-12` 48 px, in `tokens.css`). Radii: `tokens.css` still defines `--radius-card` 6 px, `--radius-floating` 10 px and `--radius-pill` 999 px, but the console layout (`theme-deep-space.css`, shared by Mono) sets `border-radius: 0` on the console's buttons and panels, so the Mono console has square corners. `--touch-target` is 44 px.

Look: a real NASA flight instrument with modern polish — dark consoles, monospaced telemetry, one status light, faint topographic contour lines as texture, numbered stop cards inspired by Apollo cuff checklists. Map is the hero. White = plan, electric blue = safety and interaction, light grey = science, red = danger only. GO / CAUTION / NO-GO keep green / amber / red, and the abort route stays red: a safety status must not depend on grey shades alone. Calm in GO, loud only in CAUTION/NO-GO. HUD text very large; touch targets ≥ 44 px; text contrast ≥ 4.5:1; respect reduced motion. (Known gap: the Mono console's desktop buttons are compact, `min-height: 0` with 4 px × 10 px padding in `theme-deep-space.css`, which is under 44 px.)

The 3D terrain view (Terrain3D, three.js) is optional, lazy-loaded and off by default; the demo runs in 2D.

Motion: route draws in over 600 ms; safe zone pulses opacity 0.8→1 over 3 s; status color change 250 ms, NO-GO pulses; gauge animates 500 ms. Motion only explains a change.

Do **not** use the NASA logo in our branding. Credit images "NASA/JPL-Caltech" (+ instrument team).

---

## 6. Pathfinding (how the planner works)

**Algorithm:** Dijkstra and A* on the 320 × 240 grid. **Deterministic — no ML.**

1. **Graph:** each cell is a node with **8 neighbors** (4 straight, 4 diagonal).
2. **Cell cost** (`buildCostGrid`): seconds per meter = `1 / speed` (speed in m/s from the Contract 2 formula). No-go cells = `Infinity`. Store in a `Float32Array`.
3. **Edge cost:** step length (`cellSizeM.x`, `cellSizeM.y`, or diagonal `hypot(x, y)`) × average of the two cells' sec/m.
4. **Dijkstra:** binary-heap priority queue keyed by time-so-far; pop cheapest, relax neighbors; store `cameFrom` (Int32Array) to rebuild the path.
5. **A\*** for single legs: add heuristic `straight-line meters × (1 / maxSpeed in m/s)`. Admissible → still optimal, explores fewer cells.
6. **No corner-cutting:** forbid a diagonal step if either orthogonal neighbor it passes between is no-go.
7. **Full-field Dijkstra from the habitat** (no target) gives **time-to-home for every cell** (costs are symmetric). Cache it until conditions change. It powers:
   - cursor probe "walk-home time"
   - the safe-return zone (combined with a second field from the last stop)
   - the abort route: follow `cameFrom` from the astronaut's cell to home (rebuild the field once with storm costs when a storm triggers)
8. **planRoute:** A* habitat → stop 1 → … → last stop → habitat; add dwell time at each stop; compute oxygen, margin, status, reasons.
9. **Path smoothing** before drawing: drop a waypoint when the straight line between its neighbors crosses only passable cells.
10. **Performance target:** well under 100 ms on 76,800 cells.

**Unit tests required:** flat ground gives expected walk time; a no-go wall forces a detour; an impossible plan returns NO-GO. On the test fixture (`__fixtures__/fake-site.json`), a route from the habitat to `carb-1` must pass through one of the two cliff ramps (~18.435 N or ~18.472 N). On the real `site.json`, `real-site.test.ts` checks that every layer names a real source and that the demo mission stays a 4–5 km GO loop.

### `envAt` (sol model)

- Sun elevation from Mars24 at latitude 18.45 N, fixed demo date.
- Temperature: measured by Perseverance MEDA at 1.45 m (Munguira et al. 2023, Table 1, Ls 25°): low 191 K (−82 °C) around 05:15 true solar time, high 243 K (−30 °C) around 15:15. The curve between them is our smooth interpolation. `TEMP_IS_SOURCED = true`.
- Dose rate: `DOSE_MSV_PER_SOL / SOL_HOURS` per hour, × `SPE_MULTIPLIER` during SPE. The ×30 is illustrative (`SPE_IS_ILLUSTRATIVE`); show it labelled as such, with the measured ×1.5 beside it if there is room.

---

## 7. Frontend layout

- **Three tabs (main navigation):** Story | Plan | Science, as links to `#story`, `#plan`, `#science` (Story is the default; the logo returns to Story; back and forward work). Story = the title screen and the mission story (`MissionBriefing` + `StoryChapters`); Plan = the console described below; Science = `SciencePage`. "Run the demo" (Story, Science and the Plan header) opens Plan and starts the guided demo (`GuidedDemo`, mounted once inside the map).
- **Top bar:** logo, the three tabs, LMST clock, status pill. (Below 1600 px the mission and site names are hidden so the status pills are never cut.)
- **Left panel:** layer cards (toggle, name, data-type chip, source-mission chip, legend) + cursor probe (elevation, slope, sand risk, science value, walk-home time).
- **Center:** map. Background = `basemap.png` (HiRISE) as an image overlay over the site bounds, hillshade as the fallback. Layers drawn once to a canvas → image overlay (cache; don't redraw per frame). Route = white line; safe zone = electric-blue edge; habitat = electric-blue square; stops = numbered white markers (Mono theme, Contract 6).
- **Right panel:** oxygen ring gauge; stats (distance, duration, walk time, science time, margin, dose); status with reasons; stop cards (drag to reorder, set dwell, delete).
- **Bottom (floating):** timeline — play/pause/scrub, start-time selector, track colored walking white / science grey (Mono theme, Contract 6).
- **Emergency buttons:** Dust Storm, Solar Particle Event → alert banner, red abort route, and two labelled statuses: **EVA: NO-GO** and **Return home: CAUTION / NO-GO** with the abort route's reasons (Contract 3).
- **Other screens:** opening briefing (slow pan over Jezero, "ARES-1 EVA, JEZERO DELTA FRONT", Begin planning), stop detail card (photo, why it matters, time, tools, oxygen cost), helmet HUD (visor vignette, big electric-blue heading arrow, NEXT stop + distance, oxygen / margin / dose, turns red in NO-GO), "Data sources" panel, tablet layout ≤ 1024 px (full map + bottom sheet with Map / Mission / Layers tabs; controls at least 44 px).
- **"Load demo mission"** button with three preset stops.
- **Shortcuts:** Space play/pause, H HUD, Delete removes selected stop.
- Must work if Mars Trek tiles fail. No console errors.

---

## 8. Data pipeline (real NASA data)

Done and reproducible: `python pipeline/build_site.py`, then `python pipeline/check_site.py`. Full steps, links and limits are in `pipeline/README.md`. Source files are read over HTTPS (only our window) and cached in `data/raw/`, which is not committed.

1. **Elevation, slope, rock:** USGS Mars 2020 Terrain Relative Navigation HiRISE DTM mosaic, 1 m (Fergason et al. 2020, doi:10.5066/P9REJ9JN). Slope = 90th percentile of ~5 m slopes in each cell. Rock = roughness of the 1 m DTM inside each cell.
2. **Thermal inertia:** *THEMIS-derived Thermal Inertia of Jezero Crater, Mars*, 100 m (Edwards & Buz 2021, doi:10.5281/zenodo.4931348). About 9% of cells are soft sand (under 175).
3. **Science value:** CRISM MTRDR observation HRL000040FF, 36 m (PDS Geosciences Node): parameters D2300 (clay), MIN2295_2480 and MIN2345_2537 (carbonate), defined in Viviano-Beck et al. 2014 (doi:10.1002/2014JE004627).
4. **Habitat and POIs:** `pipeline/data/site_meta.json`, each with the source of its coordinates. Habitat from NASA's waypoints file; seven rover sampling sites from the Mars 2020 Initial Reports; one new science target selected from the CRISM clay signal, not visited by Perseverance.
5. **Basemap:** `python pipeline/build_basemap.py` → `app/public/data/basemap.png` from the USGS HiRISE orthomosaic (doi:10.5066/P9QJDP48).
6. Everything is reprojected to `+proj=longlat +R=3396190 +no_defs` on the 320 × 240 grid; each source file's own projection is read from the file.
7. Layer previews for slides: `docs/images/`.

Temperature in `env.ts` now uses measured MEDA values (see section 6, `envAt`).

---

## 9. Science, sources and story

- Every layer and every number shown names its source. `/docs/sources.md` (datasets + papers with links) and `/docs/assumptions.md` (every model assumption).
- Useful sources: NASA Human Integration Design Handbook, Apollo EVA records, Curiosity RAD papers (Hassler et al. 2014 for 0.64 ± 0.12 mSv/day; Zeitlin et al. 2018 for the September 2017 event), Perseverance MEDA data (PDS Atmospheres Node), NASA DONKI space weather database, Mars Climate Database, Perseverance traverse map, AI4Mars dataset, Apollo traverse maps (Lunar and Planetary Institute), Tobler's hiking function, Mars24 (NASA GISS).
- Rover photos: Mars Perseverance Raw Images gallery. Raw images are tagged by site/drive, not coordinates — match against the traverse data, or hand-pick 5–8 photos and place them manually.

### Demo video (30 s or less)

The full script, captions and shot list are in `docs/video-script.md`; that file is the one to follow. Outline:

| Time | On screen |
|---|---|
| 0–7 s | Opening briefing over Jezero: "2040. Jezero Crater. 8 hours of oxygen." Begin planning |
| 7–12 s | Real data layers switch on, each with its NASA source |
| 12–19 s | Load demo mission: three stops, route draws in, safe zone, **EVA: GO** |
| 19–26 s | Walk plays; dust storm hits: **EVA: NO-GO** (aborted), zone collapses, red abort route, **Return home: CAUTION** — she makes it home inside the reserve |
| 26–30 s | Helmet HUD, then end card: "ARES, by The Ares Initiative. Science first. Safety always." |

No names, faces or voices of anyone under 18: screen recording and captions only.

---

## 10. Build order and schedule

**First milestone (by ~hour 6): a walking skeleton.** The terrain file loads in the app, click two stops, a route draws on the map. Everything after that improves something that already runs.

1. Terrain file `site.json` ← **first** (now real NASA data from `pipeline/build_site.py`; the first stand-in survives only as the planner test fixture)
2. `/app` scaffold + Vercel deploy + Mars Trek tile test in Leaflet
3. `tokens.css`
4. Planner: `constants.ts` → `loadSite` → `buildCostGrid` → Dijkstra/A* → `planRoute` → tests
5. Map layers + stop editing + route drawing
6. Oxygen model, safe zone, status, mission panel → **MVP done (~hour 24)**
7. Timeline + `envAt`, emergencies + `abortRoute`, HUD, photos, opening screen → **Core done (~hour 36)**
8. Stretch only if core is solid
9. Feature freeze **Sunday 2 pm**: video, slides, project page. Submit early (deadline Sunday Nov 15, 11:59 pm local event time).

### Biggest risks

1. Data downloads — done: all four terrain data types are real, with no fallbacks used.
2. Mars Trek tiles misaligned — hillshade fallback; test early.
3. Scope — if behind at hour 24, make the HUD a static screen and limit photos to 3 stops.

### Submission checklist

- Live demo link works in a fresh browser
- Public GitHub repo with README
- Demo video ≤ 30 s, with no names, faces or voices of anyone under 18
- Slides incl. sources and model assumptions
- Project page text crediting every NASA source
- AI use disclosed honestly
- No team members' real names anywhere in the app, README, slides, video or submission
- Submitted before Sunday Nov 15, 2026, 11:59 pm local event time
