# CLAUDE.md — ARES project context

> Put this file at the **repo root**. Claude Code reads `CLAUDE.md` automatically at the start of every session.

## Who we are

- **Team:** The Ares Initiative — 6 high school students, everyone shares all roles
- **Event:** NASA Space Apps Challenge 2026, ~48-hour build
- **Challenge:** *Interplanetary Survival Guide: Martian Map*
- **Product:** **ARES — Astronaut Route & EVA Safety system**
- **Tagline:** Science first. Safety always.
- **Repo:** `github.com/Csathvik245/ares` (public, MIT license)

## Rules for any AI working in this repo

1. **Follow the shared contracts below exactly** (file formats, function names, types, units, colors). Teammates build against them in parallel. If a change to a contract seems needed, **stop and warn** that the team must agree first.
2. **Never invent scientific numbers.** Use the values in this file or ask for a source. Label anything unsourced as an assumption.
3. **Finish core features before stretch features.** Never start a stretch feature while a core one is broken.
4. **Never leave `main` broken.** The live demo deploys from `main`. One branch per task, small commits, merge by pull request.
5. **No secrets in the repo or the frontend.** API keys live only in environment variables on the backend.
6. Keep the planner free of UI code so tests and the AI backend can reuse it.
7. Explain things simply — the team is learning as it builds.
8. Never add Co-Authored-By lines, 'Generated with Claude Code', or any AI attribution to commits or pull requests.

---

## 1. The challenge (NASA's brief, summarized)

Create a layered, integrated map/tool for a location or route on Mars that combines data from multiple NASA missions and helps a human explorer plan and carry out a Marswalk while doing science. Existing tools (JPL Mars Trek, USGS-NASA geologic maps) are regional/global, **not hyperlocal** at the scale of one EVA.

The brief asks us to consider: a science objective first, then a location; **at least three data types** layered or combined; **astronaut safety first** including radiation and space weather; spacesuit mobility limits and carried gear; a **route that avoids obstacles**; a display format (habitat screen, tablet, or helmet HUD); **rover point-of-view imagery**; rovers or astronauts in pairs; inspiration from how NASA mapped other worlds (e.g. Apollo).

Judging (typical Space Apps): **impact, creativity, validity, relevance, presentation.**

## 2. What ARES is

Google Maps for an astronaut walking on Mars, which also tells you how much oxygen you'll have left and when you must turn back.

The astronaut picks science stops. ARES plans the safest walking route around steep slopes, boulder fields and soft sand; adds up walking time, oxygen and radiation dose; draws a glowing **safe-return zone** (everywhere still reachable with a safe walk home); plays the walk across the Martian day on a timeline; simulates **dust storm** and **solar particle event** emergencies with an instant abort route home; and shows a minimal **helmet HUD** plus real rover photos at each stop.

**Pitch story:** It's 2040. Commander Reyes steps out of the habitat at Jezero Crater with 8 hours of oxygen, a 20 kg sample kit and 4 km of unknown terrain. Her job is to collect rocks that may hold signs of life from 3.5 billion years ago. ARES gets her there and back.

### Mission and site

| | |
|---|---|
| Callsign | ARES-1 EVA |
| Site | Jezero Crater delta front (Perseverance's region), bounds **18.40–18.50 N, 77.36–77.50 E** (~6 × 8 km) |
| Science objective | Sample **carbonate and clay** layers at the ancient river delta — top targets for preserved signs of past life |
| Habitat | HAB-1 at **18.445 N, 77.451 E** |
| User | Astronaut planning in the habitat, then walking with a tablet or helmet HUD |
| Why Jezero | Strong life-search story, high-res NASA terrain data from the Perseverance landing, thousands of rover photos. NASA's own example is Mount Sharp, so most teams will pick that — Jezero sets us apart. |

### Six data types → three answers

We don't just toggle layers; we combine them into: **where it's safe to walk, where the best science is, when it's safe to be outside.**

| Data type | Source | What it tells us | Combined into |
|---|---|---|---|
| Optical | HiRISE (Mars Reconnaissance Orbiter) | Ground appearance, boulders | Walking difficulty; basemap |
| Topographic | HiRISE DTM; MOLA (Mars Global Surveyor) | Elevation, slope, cliffs | Walking difficulty |
| Thermal | THEMIS (Mars Odyssey) | Thermal inertia: low = soft sand, high = bedrock | Walking difficulty |
| Spectral | CRISM (MRO) | Carbonates and clays | Science value |
| Atmospheric | MEDA (Perseverance) | Temperature, dust, wind over the sol | Conditions over the day |
| Radiation | RAD (Curiosity, at Gale Crater) | Surface dose ~0.64 mSv/sol | Conditions over the day |

Note: RAD is on Curiosity, not Perseverance. Label it "surface baseline measured by Curiosity RAD, applied to Jezero."

### Core features (in priority order)

1. **Layered map** — real Mars imagery + toggleable analysis layers (walking difficulty, slope, soft sand, boulders, science value), each labeled with data type and source mission.
2. **Route planner** — click to add stops, set dwell time; fastest safe route habitat → stops → habitat.
3. **Oxygen budget + safe-return zone** — gauge for oxygen at return; glowing cyan boundary that shrinks as stops are added.
4. **Status light** — GO / CAUTION / NO-GO with the reason written out.
5. **Sol timeline** — play/scrub; astronaut marker moves; sun, temperature, radiation update.
6. **Emergencies** — Dust Storm and Solar Particle Event buttons: status red, zone collapses, red abort route home from current position.
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
| `/app/src/styles` | `tokens.css` and global CSS |
| `/app/public/data/site.json` | Terrain grid (Contract 1) |
| `/app/public/photos` | Rover photos for each stop |
| `/pipeline` | Python data processing scripts + README |
| `/backend` | AI assistant API (stretch) |
| `/ml` | Boulder detection notebooks (stretch) |
| `/docs` | `sources.md`, `assumptions.md`, slides, video script |

**Current repo state:** only `README.md`, `LICENSE` (MIT) and a Node `.gitignore`. Add Python and data lines to `.gitignore`:

```
.venv/
__pycache__/
*.pyc
.ipynb_checkpoints/
.env
.env.*
data/raw/
*.tif
*.tiff
*.IMG
*.zip
```

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
    "rock":           [ "boulder density, 0 to 1" ],
    "thermalInertia": [ "J m-2 K-1 s-1/2" ],
    "science":        [ "science value, 0 to 1" ]
  },
  "habitat": { "name": "HAB-1", "lat": 18.445, "lng": 77.451 },
  "pois": [
    { "id": "carb-1", "name": "Delta front carbonates", "lat": 18.4365, "lng": 77.421,
      "kind": "science", "note": "Carbonate layers record ancient lake chemistry",
      "photo": "photos/carb-1.jpg", "photoCredit": "NASA/JPL-Caltech, Perseverance Mastcam-Z" }
  ],
  "sources": {
    "elevation": "Mars 2020 HiRISE DTM mosaic, USGS Astrogeology",
    "slope": "Derived from elevation",
    "rock": "Derived from DTM roughness / HiRISE",
    "thermalInertia": "THEMIS thermal inertia",
    "science": "CRISM mineral maps"
  }
}
```

**Grid rules:** row-major, `index = row * width + col`. **Row 0 = north edge, column 0 = west edge.** Planetocentric latitude, east-positive longitude, degrees. Missing values = `null`. Round to 2 decimals. File < 5 MB. Elevation at Jezero is negative (~ −2,500 m) — that's normal.

**Click → cell:** `col = floor((lng - west) / (east - west) * width)`, `row = floor((north - lat) / (north - south) * height)`.

The fake file may include an extra `"fake": true` key; consumers ignore unknown keys.

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
| `ROCK_NO_GO` | 0.75 | Boulder density above = no-go |
| `STORM_SPEED_FACTOR` | 0.55 | Speed multiplier in dust storm |
| `STORM_EXTRA_RESERVE_MIN` | 30 | Extra reserve during storm |
| `DOSE_MSV_PER_SOL` | 0.64 | Avg surface dose (Curiosity RAD) |
| `SPE_MULTIPLIER` | 30 | **Illustrative** dose-rate increase in a solar particle event |
| `SOL_HOURS` | 24.66 | Sol length in Earth hours |
| `MARS_RADIUS_M` | **3396190** | See decisions above |

**Walking speed:**
`speed = BASE_SPEED × exp(−3.0 × tan(slope)) × (SAND_SPEED_FACTOR if TI < 175) × (1 − 0.6 × rock) × (STORM_SPEED_FACTOR if storm)`.
Cells with slope > `MAX_SLOPE_DEG` or rock > `ROCK_NO_GO` are impassable.

**Oxygen:** `oxygenUsedSec = walkSec × WALK_BURN + scienceSec × WORK_BURN`.
`margin = CONSUMABLE_HOURS × 3600 − reserveSec − oxygenUsedSec` (reserve includes storm extra when active).

**Safe-return zone:** a cell is inside if `(time from last stop to cell + time from cell to habitat) × WALK_BURN ≤ oxygen left after reserve`.

### Contract 3 — status rules

| Status | When | Shown as |
|---|---|---|
| NO-GO | Margin < 0, or any stop unreachable | Red, pulsing, with reason |
| CAUTION | Margin < 25% of the **usable budget**, sun < 10° during walk, or active storm/SPE | Amber, with reason |
| GO | Everything else | Green |

**Usable budget** = `CONSUMABLE_HOURS × 3600 − reserveSec`, where `reserveSec = RESERVE_MIN × 60`, plus `STORM_EXTRA_RESERVE_MIN × 60` when a storm is active. Example (calm): 28,800 − 2,700 = 26,100 s, so CAUTION below 6,525 s (≈109 min) of margin. Helpers: `oxygenBudget(storm)` and `isLowMargin(marginSec, budget)` in `oxygen.ts`.

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
- **Fields** (full-field Dijkstra) are cached per `CostGrid` object. Build a new grid when conditions change; never edit `secPerM` in place. Build the storm grid **once** when a storm starts and reuse it for every `abortRoute` call.
- **safeZone:** "oxygen left after reserve" = oxygen left when leaving the last stop = `plan.marginSec + lastLeg.walkSec × WALK_BURN`. No stops → every cell with a round trip inside the usable budget. Empty if `!plan.ok` or `marginSec < 0`. Pass the same `cost` the plan was built with.
- **positionAt:** `t` is clamped to `[0, totalSec]`; both ends are the habitat. Even pace along each leg (assumption). During science `legIndex` is the leg that just arrived. Empty plan → `lat/lng = NaN`, `legIndex = −1`.
- **abortRoute:** home = `site.habitat`; reserve follows `stormCost.conditions`. Unreachable → `path: []`, `sec: Infinity`, `marginSec: −Infinity`, NO-GO. `reasons` added so the status always has a reason (Contract 3).
- **explainSegment:** facts are for the cells the drawn leg crosses. Throws `RangeError` for a bad `legIndex`.
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

### Contract 6 — design tokens (`/app/src/styles/tokens.css`)

| Token | Hex | Use |
|---|---|---|
| `--void` | `#08090B` | App background |
| `--console` | `#111318` | Panels |
| `--console-2` | `#171A21` | Cards, inputs |
| `--hairline` | `#242833` | Borders |
| `--text` | `#ECEAE6` | Main text |
| `--muted` | `#8A93A3` | Labels |
| `--mars` | `#FF6B35` | Route, stops, main buttons |
| `--safe` | `#4FD1FF` | Safe zone, astronaut, HUD |
| `--go` | `#3DDC97` | GO |
| `--caution` | `#FFB020` | CAUTION, soft sand |
| `--nogo` | `#FF4D5A` | NO-GO / real danger only |
| `--science` | `#A78BFA` | Mineral and science layers |

Fonts: **Space Grotesk** (headings), **Inter** (body), **JetBrains Mono** (all numbers). Icons: **Lucide**. Spacing on a 4 px grid; radii 6 px cards, 10 px floating bars, full-round pills.

Look: a real NASA flight instrument with modern polish — dark consoles, monospaced telemetry, one status light, faint topographic contour lines as texture, numbered stop cards inspired by Apollo cuff checklists. Map is the hero. Orange = plan, cyan = safety, red = danger only. Calm in GO, loud only in CAUTION/NO-GO. HUD text very large; touch targets ≥ 44 px; text contrast ≥ 4.5:1; respect reduced motion.

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

**Unit tests required:** flat ground gives expected walk time; a no-go wall forces a detour; an impossible plan returns NO-GO. On the fake `site.json`, a route from the habitat to `carb-1` must pass through one of the two cliff ramps (~18.435 N or ~18.472 N).

### `envAt` (sol model)

- Sun elevation from Mars24 at latitude 18.45 N, fixed demo date.
- Temperature: daily curve from ~−83 °C before dawn to ~−23 °C early afternoon (placeholder; replace with MEDA values).
- Dose rate: `DOSE_MSV_PER_SOL / SOL_HOURS` per hour, × `SPE_MULTIPLIER` during SPE.

---

## 7. Frontend layout

- **Top bar:** logo, site name, objective, LMST clock, status pill.
- **Left panel:** layer cards (toggle, name, data-type chip, source-mission chip, legend) + cursor probe (elevation, slope, sand risk, science value, walk-home time).
- **Center:** map. Layers drawn once to a canvas → image overlay (cache; don't redraw per frame). Route = orange line; safe zone = cyan glow; habitat = cyan square; stops = numbered orange markers.
- **Right panel:** oxygen ring gauge; stats (distance, duration, walk time, science time, margin, dose); status with reasons; stop cards (drag to reorder, set dwell, delete).
- **Bottom (floating):** timeline — play/pause/scrub, start-time selector, track colored walking orange / science violet / reserve grey.
- **Emergency buttons:** Dust Storm, Solar Particle Event → alert banner, red abort route, updated status.
- **Other screens:** opening briefing (slow pan over Jezero, "ARES-1 EVA, JEZERO DELTA FRONT", Begin planning), stop detail card (photo, why it matters, time, tools, oxygen cost), helmet HUD (visor vignette, big cyan heading arrow, NEXT stop + distance, oxygen / margin / dose, turns red in NO-GO), "Data sources" panel, tablet layout ≤ 1024 px (full map + bottom sheet with Plan / Layers / Conditions tabs).
- **"Load demo mission"** button with three preset stops.
- **Shortcuts:** Space play/pause, H HUD, Delete removes selected stop.
- Must work if Mars Trek tiles fail. No console errors.

---

## 8. Data pipeline (real data, replaces the fake file)

1. Bounding box + habitat + stops agreed with the science lead.
2. **Elevation:** Mars 2020 HiRISE DTM mosaic of Jezero (USGS Astrogeology, ~1 m). Backup: CTX DTM, then MOLA. **Start this download immediately — it's large.**
3. HiRISE or CTX orthoimage for checks/basemap.
4. **Thermal inertia:** THEMIS (ASU JMARS or PDS), ~100 m — resample to grid.
5. **Minerals:** CRISM (PDS Geosciences Node / Mars Orbital Data Explorer). Fallback: digitize published Jezero mineral maps as polygons in QGIS and cite the paper. **Decide by hour 8.**
6. Reproject everything to `+proj=longlat +R=3396190 +no_defs`, resample to the 320 × 240 grid. **Clip early** (files can be GBs).
7. Slope in degrees using real meters (longitude spacing × cos(lat)).
8. Rock 0–1 from DTM roughness (cell minus neighbor mean, normalized); use HiRISE rock abundance or the ML map if available. Also flag cells containing steep 1 m sub-pixels so small cliffs aren't averaged away.
9. Science 0–1: carbonate/clay detections high.
10. Export `site.json`, write `/pipeline/README.md`, check in QGIS against Mars Trek (cliffs = high slope, dunes = low TI), export layer PNGs for slides.

---

## 9. Science, sources and story

- Every layer and every number shown names its source. `/docs/sources.md` (datasets + papers with links) and `/docs/assumptions.md` (every model assumption).
- Useful sources: NASA Human Integration Design Handbook, Apollo EVA records, Curiosity RAD papers (Hassler et al. 2014 for 0.64 mSv/sol), Perseverance MEDA data (PDS Atmospheres Node), NASA DONKI space weather database, Mars Climate Database, Perseverance traverse map, AI4Mars dataset, Apollo traverse maps (Lunar and Planetary Institute), Tobler's hiking function, Mars24 (NASA GISS).
- Rover photos: Mars Perseverance Raw Images gallery. Raw images are tagged by site/drive, not coordinates — match against the traverse data, or hand-pick 5–8 photos and place them manually.

### Demo video (60 s)

| Time | On screen |
|---|---|
| 0–8 s | Opening over Jezero: "8 hours of oxygen. 4 km of unknown terrain." |
| 8–18 s | Data layers appear one at a time, each with its source |
| 18–32 s | Three stops added; route draws in, safe zone shrinks, status GO |
| 32–45 s | Walk plays; dust storm hits: NO-GO, zone collapses, abort route, she makes it home |
| 45–55 s | Switch to helmet HUD with rover photo of next stop |
| 55–60 s | "ARES, by The Ares Initiative. Science first. Safety always." |

---

## 10. Build order and schedule

**First milestone (by ~hour 6): a walking skeleton.** Fake `site.json` loads in the app, click two stops, an orange route draws on the map. Everything after that improves something that already runs.

1. Fake `site.json` (`pipeline/fixtures/make_fake_site.py`, now a test fixture only) ← **first**
2. `/app` scaffold + Vercel deploy + Mars Trek tile test in Leaflet
3. `tokens.css`
4. Planner: `constants.ts` → `loadSite` → `buildCostGrid` → Dijkstra/A* → `planRoute` → tests
5. Map layers + stop editing + route drawing
6. Oxygen model, safe zone, status, mission panel → **MVP done (~hour 24)**
7. Timeline + `envAt`, emergencies + `abortRoute`, HUD, photos, opening screen → **Core done (~hour 36)**
8. Stretch only if core is solid
9. Feature freeze ~hour 36–44: video, slides, project page. Submit early.

### Biggest risks

1. Data downloads (especially CRISM) — fallbacks above; decide by hour 8.
2. Mars Trek tiles misaligned — hillshade fallback; test early.
3. Scope — if behind at hour 24, make the HUD a static screen and limit photos to 3 stops.

### Submission checklist

- Live demo link works in a fresh browser
- Public GitHub repo with README
- Demo video ≤ 60 s
- Slides incl. sources and model assumptions
- Project page text crediting every NASA source
- Submitted before the deadline
