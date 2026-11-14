# ARES build checklist

> Lives at the repo root. Tick an item (`[x]`) only when it's **pushed to `main` and working**.
> Everyone works directly on `main`: `git pull --rebase` before every push, never force-push.

**Legend:** 🟥 MVP (must ship) · 🟧 Core (after MVP) · 🟦 Stretch (only if Core is done)

## How this checklist keeps everyone independent

Every role can finish **all of its items without waiting for anyone's commits**. That works because of three rules:

1. **Build against the contracts, not against people.** File formats, function names and types are fixed in `CLAUDE.md`. Code to them, even if the other side isn't written yet.
2. **If you need something that doesn't exist yet, make a stand-in in *your own* folder.** For example, the frontend makes stub planner functions, and the HUD uses mock numbers. When the real thing lands, you swap one import. Stand-ins are never deleted by other roles.
3. **Own your folders.** Only edit files you own. Shared files are listed below; tell the group chat before touching them.

| Role | Person | Owns (only you edit these) |
|---|---|---|
| Data & GIS | Anish | `pipeline/`, `app/public/data/site.json` |
| Planner + backend | Sathvik | `app/src/planner/`, `backend/` |
| Frontend | Viren | `app/src/` (everything except `planner/`, `styles/`, `design/`, `ai/`), `app/index.html`, Vite config |
| UI/UX design | _unassigned_ | `app/src/styles/`, `app/src/design/` (HUD, opening screen, stop card), Figma |
| Science & story | _unassigned_ | `docs/`, `app/public/photos/`, `app/public/data/stops.json`, `README.md` |
| AI assistant (stretch) | Sathvik | `backend/`, `app/src/ai/` |

**Shared files (announce before editing):** `CLAUDE.md`, `CHECKLIST.md` (tick only your own section), `app/package.json`, `app/package-lock.json`, `.gitignore`.

**Integration points.** These are the only moments two roles meet, and each is a small swap, not a blocker:

| # | When | What happens | Who does it |
|---|---|---|---|
| I1 | Real `site.json` pushed | Nothing to change. Same shape, so the app and planner just get real terrain | Anish pushes; everyone pulls |
| I2 | A planner function lands | Frontend swaps its stub import for the real one in `app/src/lib/planner.ts` | Viren |
| I3 | Design components land | Frontend renders `<Hud>`, `<OpeningScreen>`, `<StopCard>` instead of placeholders | Viren |
| I4 | `stops.json` + photos land | Frontend reads demo stops and photos from files | Viren |
| I5 | AI assistant ready | Frontend mounts `<ChatPanel>` | Viren |

---

## ✅ Already done

- [x] GitHub repo, MIT license, `.gitignore`, AI attribution disabled
- [x] `CLAUDE.md` project context + all six contracts
- [x] Fake `site.json` (Contract 1): cliff with two ramps, dune patches, boulder apron, crater-floor boulder field
- [x] `pipeline/check_site.py` and `pipeline/preview_site.py`
- [x] Planner core: `constants.ts`, `loadSite`, `buildCostGrid`, Dijkstra + A*, `planRoute`; 19 tests pass (Dijkstra ~15 ms, A* ~5 ms)

---

## Data & GIS: Anish

Needs nothing from anyone. Your output is checked by your own `check_site.py`.

**Fake data (do first, about 15 min)**
- [x] 🟥 Move fake habitat to **18.445 N, 77.451 E** (near Perseverance's landing site); nudge if the cell is no-go or sand
- [x] 🟥 Place POIs so habitat → 3 stops → habitat is about 4–5 km walking; `check_site.py` passes

**Real data**
- [ ] 🟥 Download the Mars 2020 HiRISE DTM mosaic of Jezero (USGS Astrogeology). Backups: CTX DTM, then MOLA
- [ ] 🟥 Clip to 18.40–18.50 N, 77.36–77.50 E; reproject to `+proj=longlat +R=3396190 +no_defs`
- [ ] 🟥 Resample elevation to 320 × 240; slope in degrees using real meters
- [ ] 🟥 Boulder density 0–1 from DTM roughness; flag cells hiding steep 1 m sub-pixels
- [ ] 🟥 HiRISE or CTX orthoimage of the area (for checks and the slides)
- [ ] 🟧 THEMIS thermal inertia (~100 m) resampled to the grid
- [ ] 🟧 CRISM carbonate/clay → science layer. **Decide by hour 8:** real CRISM, or digitize a published Jezero mineral map in QGIS and cite the paper
- [ ] 🟧 Real habitat + 3 stop coordinates: pick them yourself from flat, firm ground near high science value, then write them into `site.json` `pois` (the story lead can rename them later in `stops.json`)
- [ ] 🟥 Write the real `site.json` to `app/public/data/site.json`. `check_site.py` passes, size < 5 MB, `"fake"` removed, real `sources`. **Keep the fake generator** so anyone can regenerate it
- [ ] 🟧 Visual check in QGIS vs Mars Trek (cliffs = high slope, dunes = low TI)
- [ ] 🟧 Layer PNGs for slides via `preview_site.py` → `docs/images/`
- [ ] 🟧 `pipeline/README.md` documents the real-data steps
- [ ] 🟦 ML boulder map merged into `rock` (only if you build it yourself in `pipeline/`)

---

## Planner + backend: Sathvik

Needs nothing from anyone. Test everything with Vitest on the fake `site.json` that's already on `main`.

**Planner (`app/src/planner`)**
- [x] 🟥 `constants.ts`, `loadSite`, `buildCostGrid`, Dijkstra/A*, `planRoute`
- [ ] 🟥 CAUTION rule: margin < 25% of usable budget (8 h − reserve, incl. storm reserve); update Contract 3
- [ ] 🟥 Document the `CostGrid` type in Contract 4
- [ ] 🟥 Path smoothing; leg endpoints = exact stop/habitat coordinates
- [ ] 🟥 `safeZone` (cached habitat field + last-stop field)
- [ ] 🟥 `positionAt(plan, tSec)`
- [ ] 🟧 `abortRoute` (cached storm-cost field)
- [ ] 🟧 `explainSegment`
- [x] 🟧 `envAt`: Mars24 sun elevation at 18.45 N for a fixed Ls; temperature curve (placeholder −83 to −23 °C, flagged in a comment); dose rate (+SPE). Constants live in `planner/` so you don't wait for MEDA values
- [x] 🟧 Sun < 10° CAUTION rule
- [ ] 🟧 Tests for every function; each < 100 ms
- [x] 🟧 `index.ts` exports every Contract 4 function, so the frontend's swap (I2) is one line
- [ ] 🟦 `optimizeOrder` (≤ 6 stops), `suggestStops` (science ÷ round-trip oxygen)
- [ ] 🟦 Web Worker wrapper `planner/worker.ts` (only if the frontend reports lag)

**AI assistant (stretch, only after planner Core)**
- [ ] 🟦 `backend/`: Vercel function `/assistant`; API key in env var only
- [ ] 🟦 Contract 5 tools as function-calling schemas
- [ ] 🟦 **Test without the frontend:** a Node script `backend/try.ts` runs the tool loop against the planner directly on the fake `site.json`
- [ ] 🟦 System prompt: every number comes from tools; never declares a plan safe
- [ ] 🟦 `app/src/ai/ChatPanel.tsx` takes `plan` + `onToolCall` as props (works standalone with a mock plan)
- [ ] 🟦 Passes: "Why this route?", "Can I add another clay sample?", "What if a dust storm hits at stop 2?"
- [ ] 🟦 Apollo-style EVA cuff checklist generator
- [ ] 🟦 Cached demo answers for the video

---

## Frontend: Viren

Needs nothing from anyone. The fake `site.json` and planner core are already on `main`. For anything not built yet, use your own stubs.

**Frontend verification update:** Production: https://ares-mission-console.vercel.app/?frontend. Checked items below are existing code already on main and exercised by automated checks or Chrome review. New local fixes still need the user's commit/push. Vercel root is now `app`, but GitHub connection failed; the current production release was uploaded by CLI. Chrome review confirmed demo mission, 4.87 km route, GO status, 174-minute margin, oxygen gauge, hillshade fallback and playback clock/dose changes. A missing optional `stops.json` 404 was found and fixed locally using a public-asset inventory. Full interaction/console QA remains in progress.

I3: adapters are ready; no `app/src/design` files exist. I4: parser and image handling are ready; final `stops.json` and rover photos are absent. I5: lazy ChatPanel mount and Contract 5 frontend tool handlers are implemented locally; the AI component/backend are absent, so end-to-end verification remains pending. No other role's checklist section was changed.

**Setup**
- [x] 🟥 React + Vite + TS in `/app`. **Keep** `src/planner/`, `public/data/`, and the existing deps in `package.json`
- [x] 🟥 Temporary `src/styles/tokens.css` from Contract 6 (the designer replaces it later; the variable names stay the same)
- [x] 🟥 Google Fonts: Space Grotesk, Inter, JetBrains Mono
- [ ] 🟥 Deploy to Vercel from `main` (root dir `app`); share the live link
- [x] 🟥 One plan-state store (React context or Zustand)

**Stand-ins (so you never wait)**
- [x] 🟥 `src/lib/planner.ts`: the **only** file the UI imports planner functions from. Re-export what exists in `src/planner`, and write stubs for the rest (`safeZone` returns a circle, `positionAt` interpolates along the route, `abortRoute` returns a straight line home, `envAt` returns fixed values). Mark each stub `// STUB`
- [x] 🟧 Placeholder `<Hud>`, `<OpeningScreen>`, `<StopCard>` in `src/components/placeholders/` until design components exist
- [x] 🟧 Demo stops hard-coded from `site.json` POIs until `stops.json` exists

**Map**
- [x] 🟥 Leaflet with `L.CRS.EPSG4326` (**not** MapLibre or Mapbox)
- [ ] 🟥 Mars Trek basemap tiles; note which layer ID works in `CLAUDE.md` section 3
- [x] 🟥 Hillshade fallback from `site.json` elevation (the app must work if tiles fail)
- [x] 🟥 Canvas overlays: walking difficulty, slope, soft sand, boulders, science value (draw once, cache)
- [x] 🟥 Habitat (cyan square), POIs, numbered orange stop markers

**Planning**
- [ ] 🟥 Click to add a stop; drag to move; delete; set dwell time; reorder
- [ ] 🟥 Recompute plan + safe zone on every change; orange route line, cyan safe-zone glow
- [x] 🟥 Mission panel: oxygen ring gauge, distance, duration, walk/science time, margin, dose
- [x] 🟥 Status pill GO / CAUTION / NO-GO **with reasons**
- [ ] 🟥 Layers panel: toggle, name, data-type chip, source chip (read from `site.json` `sources`), legend
- [ ] 🟧 Cursor probe: elevation, slope, sand risk, science value, walk-home time
- [x] 🟧 "Load demo mission" button

**Time & emergencies**
- [ ] 🟧 Timeline: play / pause / scrub, start-time selector, colored track
- [ ] 🟧 Astronaut marker (`positionAt`) and conditions panel (`envAt`)
- [ ] 🟧 Dust Storm + Solar Particle Event buttons → banner, red abort route, status change

**Polish**
- [ ] 🟧 Data sources panel
- [ ] 🟧 Shortcuts: Space play/pause, H HUD, Delete stop
- [ ] 🟦 Tablet layout ≤ 1024 px
- [ ] 🟥 No console errors; the full demo works on the live link in Chrome

**Swaps (do whenever the real thing appears; each is minutes)**
- [x] I2: replace each `// STUB` in `src/lib/planner.ts` with the real export
- [ ] I3: replace placeholders with design components
- [ ] I4: read `stops.json` and photos
- [ ] I5: mount `<ChatPanel>`

---

## UI/UX design: _unassigned_

Needs nothing from anyone. Figma is separate. Code components take **props with mock data** and are previewed on their own.

- [ ] 🟥 Figma variables: Contract 6 colors, 3 fonts, 4 px grid, radii 6 / 10 / pill
- [ ] 🟥 Figma components: status pill, layer card, stop card, stat tile, oxygen gauge, timeline bar, map markers, HUD readouts, alert banner
- [ ] 🟥 Frame: planning console with a GO plan (1440 × 900, real Jezero HiRISE screenshot from Mars Trek as the map)
- [ ] 🟥 Final `app/src/styles/tokens.css` (same variable names as Contract 6)
- [ ] 🟧 Frames: empty console, EVA playback, dust-storm NO-GO, stop detail, HUD, opening briefing
- [ ] 🟧 Clickable prototype following the demo script
- [ ] 🟧 `app/src/design/Hud.tsx`: props `{ nextStop, distanceM, headingDeg, oxygenPct, marginMin, doseMsv, lmst, status, tempC }`, red in NO-GO
- [ ] 🟧 `app/src/design/OpeningScreen.tsx`: props `{ onBegin }`
- [ ] 🟧 `app/src/design/StopCard.tsx`: props `{ stop, photoUrl, photoCredit, why, dwellMin, tools, oxygenCostMin }`
- [ ] 🟧 `app/src/design/preview.html` (or a `?design` route) renders all three with mock data, so you can see them without the main app
- [ ] 🟧 Motion: route draw-in 600 ms, zone pulse 3 s, status 250 ms, gauge 500 ms; respects reduced motion
- [ ] 🟧 ARES logo + mission patch (original, **no NASA logo**) in `app/public/brand/`
- [ ] 🟧 Slide template
- [ ] 🟧 Visual QA before the video: spacing, contrast ≥ 4.5:1, fonts, labels
- [ ] 🟦 Tablet frame 1024 × 768; chat bubble style

---

## Science & story: _unassigned_

Needs nothing from anyone. Research and docs stand alone. Use Mars Trek screenshots and the Figma frames for slides until the app is live.

- [ ] 🟥 Verify the Perseverance landing-site coordinates for the habitat; post them in the group chat
- [ ] 🟥 Jezero science case paragraph (lake, delta, carbonates, clays, biosignatures)
- [x] 🟥 `docs/sources.md`: every dataset + paper with links
- [x] 🟥 `docs/assumptions.md`: every Contract 2 constant with a source or "assumption", incl. Tobler's hiking function, Curiosity RAD 0.64 mSv/sol (Hassler et al. 2014), Mars24, SPE ×30 marked illustrative, dust-storm slowdown = visibility not wind
- [x] 🟥 Confirm Space Apps 2026 rules, required fields, video length, **deadline** → `docs/submission.md` (video ≤ 30 s or ≤ 7 slides; closes Sun 15 Nov 23:59 Local Event time)
- [ ] 🟧 `app/public/data/stops.json`: 3 demo stops `{ id, label, lat, lng, dwellMin, why, tools, photo, photoCredit }`
- [ ] 🟧 Perseverance photos for each stop in `app/public/photos/` with credits ("NASA/JPL-Caltech, …")
- [ ] 🟧 MEDA temperature values posted in `docs/assumptions.md` (the planner swaps them in later)
- [ ] 🟧 Apollo traverse map / cuff checklist heritage slide
- [x] 🟧 Demo video script + shot list (by hour 12) → `docs/video-script.md` (60 s version + 30 s submission cut)
- [ ] 🟧 Slides: problem, story, how it works, 6 data layers, safe zone, emergencies, HUD, novelty, assumptions, sources, team, next steps (outline done: `docs/slides-outline.md`; deck not built)
- [ ] 🟧 README + Space Apps project page text (README done; project page text still to write)
- [ ] 🟧 Record + edit the 60 s video (once the live link works)
- [ ] 🟧 Judge test: live app in a fresh browser; report issues in the group chat
- [ ] 🟥 Final submission with all links working

---

## Team checkpoints (captain)

- [ ] 🟥 Hour 6: the live link shows the map with a route
- [ ] 🟧 Hour 24: MVP done? If not, cut scope (HUD → static screen, photos → 3 stops, drop the AI assistant)
- [ ] 🟧 Hour 36: feature freeze; all `// STUB`s replaced or hidden
- [ ] 🟥 Submit early

## Final submission

- [ ] Live demo link works in a fresh browser
- [ ] Public GitHub repo with README
- [ ] Demo video ≤ 60 s
- [ ] Slides incl. sources and model assumptions
- [ ] Project page text crediting every NASA source
- [ ] AI tool use disclosed if the rules ask
- [ ] Submitted before the deadline
