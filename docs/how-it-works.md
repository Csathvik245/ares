# How ARES works

A plain-language tour of what happens between "NASA data" and "the route on the screen". Every number here comes from the code or from a test; where something is our own choice, it says so. Sources are in [`sources.md`](sources.md) and every assumption is in [`assumptions.md`](assumptions.md).

## The pipeline at a glance

```
 NASA / USGS data                  pipeline/ (Python)              app (TypeScript, in the browser)
 ----------------                  ------------------              --------------------------------
 HiRISE elevation, 1 m    ──┐
 THEMIS thermal inertia   ──┼──►  build_site.py  ──►  site.json  ──►  cost grid  ──►  route (A*)
 CRISM minerals, 36 m     ──┘     one number per      5 layers,       seconds        │
 HiRISE image, 25 cm      ─────►  build_basemap.py    320 × 240       per meter      ├─► oxygen, margin, status
                                  ──► basemap.png     cells           in each cell   ├─► safe-return zone
 Mars24 sun · MEDA temperature · RAD dose  ─────────────────────────────────────────►├─► sun, temperature, dose
 Perseverance's real path  ───►  validate_traverse.py  (independent check)           └─► emergencies: way home
```

Nothing is sent to a server. The planner is plain arithmetic running in the browser, so the same inputs always give the same route. There is no machine learning in the routing.

## 1. Data layers and where they come from

| Layer | What it tells us | Source |
|---|---|---|
| Elevation | Height of the ground | HiRISE elevation model, 1 m (USGS Mars 2020 mosaic, doi:10.5066/P9REJ9JN) |
| Slope | How steep each cell is | Worked out from the elevation |
| Rock | How rough and broken the ground is (0–1) | Worked out from the elevation |
| Thermal inertia | Soft sand (low) or firm ground (high) | THEMIS, 100 m (Edwards & Buz 2021, doi:10.5281/zenodo.4931348) |
| Science value | Where orbital data sees clay or carbonate (0–1) | CRISM observation HRL000040FF, 36 m (PDS) |
| Basemap image | What the ground looks like | HiRISE orthomosaic, 25 cm (doi:10.5066/P9QJDP48) |

Two honest notes. "Rock" is roughness, not a boulder count: a 1 m elevation model cannot see boulders smaller than a few meters. "Science value" is a relative index inside one CRISM scene, not a mineral abundance.

## 2. The 25 m grid

The site is 18.40–18.50 N, 77.36–77.50 E at Jezero crater, about 8 × 6 km. It is cut into **320 × 240 cells, each about 25 m across** (76,800 cells). Each cell holds one number per layer.

A 25 m cell can hide a narrow cliff, so slope is not averaged: each cell takes the **90th percentile** of the 5 m slopes inside it. That keeps a 10 m wide ledge visible. With a plain average, 383 cells would be steeper than 25°; with our method, 838 are.

## 3. Walking speed and no-go rules

Each cell gets a walking speed. We use a variant of **Tobler's hiking function**, a standard formula for how slope slows a walker:

```
speed = 3.0 km/h × exp(−3.0 × tan(slope))
              × 0.55 if the ground is soft sand (thermal inertia under 175)
              × (1 − 0.6 × rock)
              × 0.55 in a dust storm
```

3.0 km/h on flat firm ground is Tobler's 5 km/h times his own 3/5 factor for walking off a path. A cell is **no-go** if its slope is over 25° or its rock value is over 0.75; a cell with no data is also no-go. The slope and rock limits and the sand and storm factors are our assumptions.

The planner stores the result as a **cost grid**: seconds needed to walk one meter in each cell.

## 4. Finding the route

The grid is treated as a network: each cell is linked to its 8 neighbors, and the cost of a step is its length times the average cost of the two cells.

- **A\*** finds the fastest path for one leg (habitat → stop, stop → stop, stop → habitat). It is Dijkstra's algorithm with a head start: it explores toward the goal first, and still returns the fastest path.
- **Dijkstra from the habitat**, with no target, gives the walking time home from every cell at once. That one table powers the safe-return zone, the cursor's "walk-home time" and the emergency route.
- **No corner-cutting:** a diagonal step is not allowed if it would squeeze between two no-go cells.
- **Path smoothing:** the grid path zigzags, so before drawing we drop a corner whenever the straight line across it is passable **and** no slower. The drawn route therefore never cuts across sand the planner chose to avoid, and each leg starts and ends at the exact stop coordinates.

## 5. Oxygen model and reserve

Time is turned into oxygen, measured in minutes of normal life support:

```
oxygen used = walking time × 1.3  +  science time × 0.9
margin      = 8 h supply − 45 min reserve − oxygen used
```

Walking with a load burns more than the suit's normal rate (1.3×); standing work burns less (0.9×). The **45 min reserve** must still be there when the astronaut gets home (75 min in a dust storm). The 8 hours comes from real suit ratings; the burn rates and the reserve are our assumptions.

**Status** is always shown as a word with its reason, never as a colour alone:

- **NO-GO:** the margin is negative, a stop cannot be reached, or an emergency is active.
- **CAUTION:** the margin is under 25% of the usable oxygen, or the sun drops below 10° during the EVA.
- **GO:** everything else.

An impossible plan is explained in a sentence, for example "Stop 2 is on a slope over 25 degrees." or "Stop 3 is outside the mapped area."

## 6. The safe-return zone

The cyan zone is every cell the astronaut could still walk to after the last stop **and** get home from with the reserve intact:

```
(time from last stop to the cell + time from the cell home) × 1.3  ≤  oxygen left after the reserve
```

It uses two Dijkstra tables (from the last stop and from the habitat), so it follows the real terrain: it bulges along easy ground and stops at cliffs. Add a stop and the zone shrinks. It is the Apollo "walkback limit" idea, worked out over real terrain.

## 7. Emergencies: "EVA" and "Return home"

A dust storm or a solar particle event aborts the EVA. The screen then shows two separate statuses:

| Label | Meaning | Status |
|---|---|---|
| **EVA** | The original plan | Always NO-GO: "EVA aborted: active dust storm" |
| **Return home** | The walk back from where she is now | CAUTION if she arrives with the reserve intact, NO-GO if not. Never GO. |

One function, `stormAt`, does this for any moment of the EVA: it finds where the astronaut is, rebuilds the cost grid for the emergency (a storm slows walking to 55% and adds 30 min to the reserve), follows the walk-home table to the habitat, and reports walking time, oxygen on arrival and margin.

Example from the demo mission: a storm at T+1:16, halfway along leg 2, gives EVA NO-GO and Return home CAUTION, with a 57 min walk, arrival at T+2:13 and 244 min of margin.

Mars air is about 1% as dense as Earth's, so storm wind cannot push a person over. The slowdown stands for low visibility and dust on the visor.

## 8. Sun, temperature and radiation

- **Sun:** NASA's Mars24 algorithm (Allison & McEwen 2000) gives the sun's height at 18.45 N through the day, for one fixed season (Ls 0°, the northern spring equinox). At that season sunrise is 06:41 and sunset 18:41 on the local clock, and the sun peaks at 71.5°.
- **Temperature:** measured by Perseverance's MEDA weather station at Jezero: a low of 191 K (−82 °C) just before sunrise and a high of 243 K (−30 °C) in mid-afternoon (Munguira et al. 2023, Table 1). The curve between those two points is our own smooth interpolation.
- **Radiation:** 0.64 ± 0.12 mSv per day, measured on the surface by Curiosity's RAD instrument (Hassler et al. 2014). It was measured at Gale crater and is applied to Jezero. The demo mission adds about 0.09 mSv.
- **Solar particle event:** the ×30 dose spike in the demo is **illustrative** and labelled as such. The largest event RAD has measured raised the dose equivalent rate by only about 1.5×.

## 9. Science per oxygen-minute

Each stop is scored by what it gives for what it costs:

```
score = science value near the stop ÷ extra oxygen the stop costs (minutes)
```

"Science value" is the average CRISM index within 50 m of the stop. "Extra oxygen" is the detour (the walk there and onward, minus the direct walk if the stop were skipped) plus the science time. The planner can also **suggest** stops: it looks at the top 3% of cells by science value, ranks them by this score, and keeps only those that leave the plan GO and are at least 150 m from the habitat and from every other stop. The planner suggests; the astronaut decides.

## 10. Checked against Perseverance's real drive

Perseverance has really driven across this ground, and its path was never used to build ARES. We compared the two ([`validation.md`](validation.md)):

- ARES rates **99.8%** of the rover's 20.6 km inside our site as passable. The one exception is 42 m at a real sampling site where our cell is 0.8° over the slope limit.
- The rover's own tilt sensor agrees with our slope layer (correlation 0.82).
- The ground the rover chose is gentler, smoother and less sandy than the site average.

Caveats, stated plainly: 98.6% of the whole site is passable, so the bar is low; rover drivers pick safe ground on purpose; and a path a rover can drive is not proof that a person in a suit can walk it.

## 11. Measured performance

Median of 7 runs on the real 76,800-cell site, on the team's development laptop. Times vary between runs by about a factor of two.

| Step | Time |
|---|---|
| Build the cost grid (all cells) | 5–13 ms |
| One leg with A\* (2 km) | 1–2 ms |
| Plan the demo mission (4 legs) | 3–9 ms |
| Walk-home table for the whole site (Dijkstra) | 12–27 ms |
| Safe-return zone, from scratch | 29–67 ms |
| Emergency route, from scratch | 17–45 ms |
| Suggest 3 stops, from scratch | 84–95 ms |

Every exported planner function has a speed test (limit 100 ms; 150 ms for the safe-return zone and 300 ms for stop suggestions, which are computed once per change, not per frame).

**Robustness:** 500 random plans, with stops anywhere inside and outside the map, random science times and start times, all return a valid plan with a status and a reason. The slowest took 51 ms.

## Related work

ARES builds on a line of traverse planners made for real exploration. Three that shaped how we think about the problem:

- **SEXTANT (MIT and NASA Ames).** The Surface Exploration Traverse Analysis and Navigation Tool plans walking routes for astronauts over rough terrain. Norheim's 2018 MIT thesis updated it for real EVA use: "a web-based interface for both planning and navigation purposes" and "the Holo-SEXTANT Augmented Reality (AR) navigation solution", tested in NASA's BASALT field campaign and connected to NASA Ames's xGDS software. (Norheim 2018, S.M. thesis, MIT, [hdl.handle.net/1721.1/119309](https://hdl.handle.net/1721.1/119309).)
- **The xGDS traverse planner (NASA Ames).** A planner built into the Exploration Ground Data Systems for rover traverses where the constraints depend on both place and time, using a lunar polar rover mission as its reference case. Its central idea is **reachability**: where can the vehicle still get to, and by when. (Bresina, Morris, Deans, Cohen & Lees 2017, "Traverse Planning with Temporal-Spatial Constraints", SPARK workshop at ICAPS 2017.)
- **MoonPath.** Automated astronaut traverses near the lunar south pole that minimise **metabolic workload**, computed over LOLA laser-altimeter terrain. News coverage of the paper describes the pipeline, called MoonPath, as using Dijkstra's minimum-cost path algorithm. (Peña-Asensio et al. 2024, *Acta Astronautica* 214, 324–342, doi:10.1016/j.actaastro.2023.10.010.)

We read the thesis abstract, the workshop paper's record and abstract, and the journal record for the third; we did not read the full texts. See [`sources.md`](sources.md) for exactly what was checked.

### What ARES adds

These are differences in emphasis, not claims of being first:

- **Mars, with thermal and mineral layers.** Routes at Jezero use THEMIS thermal inertia for soft sand and CRISM for science targets, on top of HiRISE terrain.
- **A live, oxygen-aware safe-return zone.** Every change to the plan redraws where the astronaut can still go and get home with the reserve intact.
- **Emergency re-planning with two statuses.** A dust storm or solar particle event aborts the plan ("EVA") and plans the walk back ("Return home") from wherever she is, each with its own status and reasons.
- **Science per oxygen-minute.** Stops are scored, and suggested, by what they give for the oxygen they cost.
- **A check against a real traverse.** The terrain model is compared with Perseverance's actual drive path, with the caveats written down.
- **Zero setup.** It runs in a web browser from a link; the planner needs no server and no install.
- **Radiation shelter routing.** In a solar particle event the planner also checks whether waiting at a nearby spot with less open sky would give a lower dose than walking home (see below).

## Shelter routing in a solar particle event

Cliffs and crater walls hide part of the sky, and with it part of the radiation arriving from that part of the sky. So when a solar particle event starts, `stormAt` asks one more question after planning the walk home: is there a spot nearby where waiting gives a **lower total dose** than walking straight to the habitat?

**The sky-view layer.** For every 25 m cell, `site.json` holds the fraction of the sky an astronaut standing there can see (`skyView`, 1 = open sky all round). It is worked out from the same HiRISE elevation data as the slope layer: from each cell, 1.5 m above the ground, the horizon is found in 32 compass directions out to 500 m. Most of the site is open: the middle value is 0.98, and the least open ground an astronaut can walk on sees 0.83 of the sky.

**The check** (`shelterRoute`), over an assumed 60 minute event:

1. Dose on the way = SPE dose rate × sky view × time, added up along the walking path.
2. A shelter's dose = the dose walking there + the dose waiting there for the rest of the 60 minutes.
3. Walking home's dose = the dose on the way home, then nothing once inside the habitat.
4. A shelter counts only if the ground is passable, there is oxygen to walk there, wait, and still walk home with the reserve intact, and it cuts the dose by at least 5%.

**What the astronaut is told.** The EVA status stays NO-GO and the return-home status still comes from the walk home. If a shelter is better, the route to draw becomes the path to the shelter and the first reason says so, for example: "Shelter 160 m away (sky view 0.84) cuts the SPE dose by 12% compared with walking home (73 min)." The route home stays available. If home is better, one line is added: "Shelter checked: walking home is better (best nearby shelter hides 17% of the sky)." A dust storm is not a radiation event, so no shelter check is made.

**What it gives at Jezero.** On the demo mission, walking home always wins: the habitat is at most about 48 minutes away. Natural shelter beats going home only when HAB-1 is more than about 55 minutes away, and then by about 11–14%. From the rover's delta-front sampling sites (73–79 minutes from home) the dose cut is 11–12%.

**This model is simplified, and the numbers are illustrative.** It assumes the radiation arrives about equally from every direction of the sky, ignores that the atmosphere shields low directions more than high ones, ignores secondary particles from the ground and rock, and uses the demo's illustrative ×30 dose rate. The 60 minute event length is an assumption, and the result depends on it: for a longer event, walking home wins from further away. Every assumption is listed in [`assumptions.md`](assumptions.md) under "Shelter model".

**Status.** The check is in the planner and is tested. The console shows it once the frontend passes the sky-view layer to `stormAt` and draws the new fields.

## Monte Carlo: how robust is the plan?

The planner gives one answer for one set of numbers. But several of those numbers are our assumptions: how fast a suited astronaut walks, how much oxygen walking uses, how long a stop really takes. The Monte Carlo simulator (`app/src/planner/montecarlo.ts`, `simulateMission`) asks: **if those assumptions are a bit off, does the plan still get her home with the reserve?**

**How it works.**

1. The planned route is kept fixed. No new path search is run.
2. One trial draws a random value for each uncertain input: walking speed and the two oxygen burn rates once for the whole EVA, the terrain factor once per leg, and the time at each stop once per stop.
3. The plan's own timeline (walking time per leg, science time per stop) is replayed with those values, and the oxygen is added up with the same formula the planner uses (`oxygenUsedSec` in `oxygen.ts`).
4. This is repeated 1,000 times. A trial is a success if she is home with at least the 45 min reserve left. We also count "home at all": home before the full 8 h supply runs out.
5. The random numbers come from a small seeded generator (mulberry32), so the same seed always gives exactly the same result. The default seed is 42.

**Sensitivity.** Each input is also set to its lowest and then its highest value on its own, with everything else as planned. The difference in oxygen margin (the "swing") shows which assumption matters most.

**What it gives for the demo mission** (seed 42; numbers are in `docs/demo-numbers.md`, section 6): home with the reserve intact in all 1,000 trials, with the oxygen margin between about 160 and 221 minutes in 90% of trials (planned: 192). The biggest lever is the oxygen used while walking, then walking speed.

**What it does not mean.** This is a model-based simulation of our own assumptions, not an empirical mission success probability. The ranges (for example ±15% speed, ±20% burn rates) are modest guesses listed in `docs/assumptions.md`; none comes from suit tests or astronauts. "1,000 of 1,000" says the demo plan has room to spare inside those ranges. It does not cover things the model leaves out: injury, equipment failure, getting lost, or a storm (that is what the emergency tools are for). The route is not re-planned inside a trial, and every trial uses the calm-weather reserve.

## Limits

What ARES does not do, and where its numbers are weakest, is listed in `LIMITATIONS.md` (being written by the documentation lead). The short version: suit and oxygen numbers are assumptions, not test data; the rock layer is roughness, not boulders; the science layer is a relative index; one season and one site; and the validation checks only that we do not block good ground.
