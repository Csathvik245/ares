# ARES demo numbers (frozen)

Use these numbers in the slides, the video and the project page. Do not type a number from memory.

This file is written by `app/src/planner/demo-numbers.test.ts`: planner numbers are computed from
the real `site.json` and formatted with `format.ts`, so they match what the app shows; validation
and route-learning numbers are read from the pipeline's output files. `npm test` fails if this
file and the code stop agreeing.

**Numbers taken from commit `44c3a51`** (the planner and data at that commit).

<!-- numbers start -->
## 1. Demo mission

Start 13:00 LMST, 30 min of science at each stop, calm conditions.

| | |
|---|---|
| Route | HAB-1 → Séítah outcrop (Brac) → Delta front toe → Máaz lava rock (Sid) → HAB-1 |
| Distance | 4.97 km |
| Walk time | 2:05 (125 min) |
| Science time | 1:30 (90 min) |
| Total time | 3:35 |
| Status | **GO** |
| Oxygen margin | 192 min |
| Oxygen at return | 49% |

## 2. Dust storm at T+1:16 of the demo mission

| | |
|---|---|
| EVA status | **NO-GO** |
| Return home status | **CAUTION** |
| Walk-home time | 57 min |
| Oxygen margin on arrival (above the reserve) | 244 min |
| Arrival at the habitat | T+2:13 (15:10 LMST) |
| Oxygen when the emergency starts | 82% |
| Oxygen on arrival | 66% |

## 3. Solar particle event and shelter

The SPE dose numbers are **illustrative** (the ×30 dose rate is not a measured value) and the
shelter model is **simplified**. Say both next to any of these numbers.

### Wildcat Ridge demo (the "SPE at Wildcat Ridge" button)

One stop at Wildcat Ridge (Hawksbill Gap), no science time; the event starts on arrival.
Walk out: 2.90 km, 73 min.

| | |
|---|---|
| Event starts | T+1:13 (14:11 LMST) |
| Recommended | **wait at the shelter** |
| Walk to the shelter | 9 min |
| Walk home (for comparison) | 73 min |
| Sky view at the shelter | 0.84 |
| SPE dose, recommended option | 0.659 mSv |
| SPE dose, walking straight home | 0.750 mSv |
| Dose cut by sheltering | 12% |
| Return home status | **CAUTION**, 246 min oxygen margin |

Reasons, as the app shows them:

  - Shelter 160 m away (sky view 0.84) cuts the SPE dose by 12% compared with walking home (73 min).
  - Return home: 73 min walk, oxygen margin 246 min on arrival (above the 45 min reserve).
  - Solar particle event active: radiation dose rate is elevated. Head for shelter.

Shelter notes, as the app shows them:

  - Shelter 160 m away (sky view 0.84) cuts the SPE dose by 12% compared with walking home (73 min).
  - 9 min walk, then wait 51 min: SPE dose 0.659 mSv instead of 0.750 mSv walking home over the same 60 min.
  - Oxygen is enough to walk home afterwards (76 min) with the 45 min reserve intact.
  - Simplified shelter model: dose is taken to scale with the open sky, over an assumed 60 min event.
  - The SPE dose rate is illustrative, not a measured value.

### The same event on the demo mission at T+1:16

| | |
|---|---|
| Event starts | T+1:16 (14:14 LMST) |
| Recommended | **walk home** |
| Walk to the habitat | 31 min |
| Walk home (for comparison) | 31 min |
| Sky view at the habitat | 0.00 |
| SPE dose, recommended option | 0.402 mSv |
| SPE dose, walking straight home | 0.402 mSv |
| Dose cut by sheltering | 0% |
| Return home status | **CAUTION**, 307 min oxygen margin |

Reasons, as the app shows them:

  - Return home: 31 min walk, oxygen margin 307 min on arrival (above the 45 min reserve).
  - Solar particle event active: radiation dose rate is elevated. Head for shelter.
  - Shelter checked: walking home is better (best nearby shelter hides 17% of the sky).

Shelter notes, as the app shows them:

  - Walk home (31 min, SPE dose 0.402 mSv): no shelter cuts the dose by 5% or more. The best one (sky view 0.83, 36 min away) would give 0.700 mSv.
  - Simplified shelter model: dose is taken to scale with the open sky, over an assumed 60 min event.
  - The SPE dose rate is illustrative, not a measured value.

## 4. Validation against Perseverance's real drive

From `pipeline/data/traverse_validation.json` (made by `pipeline/validate_traverse.py`).

| | |
|---|---|
| Rover path inside the site | 20.57 km |
| Rover path rated passable by ARES | 99.8% |
| Whole site rated passable (for comparison) | 98.6% |
| Slope layer vs the rover's measured tilt, correlation | r = 0.82 (313 waypoints) |
| The one no-go cell the rover crossed (Skinner Ridge) | 18.4588 N, 77.4060 E: 41.7 m of path, slope 25.8° (limit 25°), rock 0.53 |

## 5. Route learning (off by default; the physics planner stays the planner)

From `app/public/data/route-model.json` (made by `pipeline/learn_route_cost.py`). Mean distance
between the planned route and the rover's real route on 31 held-out routes; lower is closer.

| Planner | Mean distance from the rover's route |
|---|---|
| Straight line | 35.3 m |
| ARES physics model | 24.8 m |
| Learned model (with the safety rule) | 24.8 m |

The learned model chose the same route as physics on 31 of 31 routes (closer on 0, further on 0).

## 6. Monte Carlo reliability of the demo mission

> Model-based simulation of our own assumptions, not an empirical mission success probability.

1000 trials, seed 42. The route is fixed; walking speed, terrain, oxygen use and time at each stop are varied.

| | |
|---|---|
| Home with the oxygen reserve intact | 1000 of 1000 trials home with reserve (0 failures: failure rate likely below 0.3%) |
| Home at all (before the oxygen runs out) | 1000 of 1000 trials |
| Oxygen margin, low / middle / high (5th / 50th / 95th percentile) | 160 min / 191 min / 221 min |
| Oxygen at return, low / middle / high | 43% / 49% / 55% |
| Total time, low / middle / high | 3:21 / 3:35 / 3:51 |

What moves the margin most (one input at a time, the others as planned):

| Input | Range (all assumed) | Margin at low value | Margin at high value | Swing |
|---|---|---|---|---|
| Oxygen use while walking | 1.04 to 1.56 (planned 1.3) × nominal oxygen rate | 224 min | 159 min | 65 min |
| Walking speed | 0.85 to 1.15 (planned 1) × planned speed (3 km/h on flat firm ground) | 163 min | 213 min | 50 min |
| Terrain (per leg) | 0.9 to 1.1 (planned 1) × planned speed, drawn separately for each leg | 174 min | 206 min | 33 min |
| Oxygen use during science | 0.72 to 1.08 (planned 0.9) × nominal oxygen rate | 208 min | 175 min | 32 min |
| Time at each stop | -5 to 5 (planned 0) min added to each stop's planned science time, drawn separately for each stop | 205 min | 178 min | 27 min |

## 7. Stretch mission

The demo route plus one more real stop: **Wildcat Ridge (Hawksbill Gap)**, a Perseverance sampling site at the
delta front. Delta-front mudstone with sulfate and small amounts of clay minerals. Perseverance cored samples Hazeltop and Bearwallow here (sols 509-516). It is visited after the first stop, with a long
120 min sampling session there; the other three stops keep 30 min. Start 10:00 LMST (earlier than the
demo, so the EVA ends well before the sun gets low), calm conditions.

Knob used: the science time at the extra stop. With the usual 30 min there, no single extra stop
we tried brings the Monte Carlo below 99% home with the reserve.

**Why it is riskier:** the deterministic plan says CAUTION with 18 min of margin, but in about 1 in 4 plausible versions (279 of 1000 trials) the astronaut gets home below the 45-minute reserve.

In about 1 in 50 plausible versions the oxygen runs out before the astronaut reaches home.

### The plan (deterministic)

| | |
|---|---|
| Route | HAB-1 → Séítah outcrop (Brac) → Wildcat Ridge (Hawksbill Gap) → Delta front toe → Máaz lava rock (Sid) → HAB-1 |
| Distance | 6.87 km |
| Walk time | 2:55 (175 min) |
| Science time | 3:30 (210 min) |
| Total time | 6:25 |
| Status | **CAUTION** |
| Oxygen margin | 18 min |
| Oxygen at return | 13% |

Reasons, as the app shows them:

  - Oxygen margin is low: 18 min above reserve, under 25% of the 435 min usable budget (480 min minus the 45 min reserve).

### The same plan, 1000 plausible versions (Monte Carlo)

> Model-based simulation of our own assumptions, not an empirical mission success probability.

1000 trials, seed 42. The route is fixed; walking speed, terrain, oxygen use and time at each stop are varied.

| | |
|---|---|
| Home with the oxygen reserve intact | 72.1% (721 of 1000 trials) |
| Home at all (before the oxygen runs out) | 98.0% |
| Oxygen margin, low / middle / high (5th / 50th / 95th percentile) | −29 min / 16 min / 64 min |
| Oxygen at return, low / middle / high | 3% / 13% / 23% |
| Total time, low / middle / high | 6:07 / 6:26 / 6:47 |

What moves the margin most (one input at a time, the others as planned):

| Input | Range (all assumed) | Margin at low value | Margin at high value | Swing |
|---|---|---|---|---|
| Oxygen use while walking | 1.04 to 1.56 (planned 1.3) × nominal oxygen rate | 64 min | −27 min | 91 min |
| Oxygen use during science | 0.72 to 1.08 (planned 0.9) × nominal oxygen rate | 56 min | −20 min | 76 min |
| Walking speed | 0.85 to 1.15 (planned 1) × planned speed (3 km/h on flat firm ground) | −22 min | 48 min | 70 min |
| Terrain (per leg) | 0.9 to 1.1 (planned 1) × planned speed, drawn separately for each leg | −7 min | 39 min | 46 min |
| Time at each stop | -5 to 5 (planned 0) min added to each stop's planned science time, drawn separately for each stop | 36 min | 0 min | 36 min |

Top sensitivity: **Oxygen use while walking** (a swing of 91 min in the margin).

## 8. New emergencies

Each emergency starts at T+1:16 of the demo mission (walking to stop 2), and ARES re-plans the rest of the EVA.
The sizes are **illustrative** demo values, not measured failure data.

"Before" is the rest of the plan with no emergency, re-planned from where she is at that moment; it can
differ by a couple of minutes from the margin in section 1.

### The three default cases

| Emergency | Size (planner default) | Kept stops | Dropped stops | Oxygen margin before → after | EVA status | Return-home status |
|---|---|---|---|---|---|---|
| Oxygen loss | 25% of the oxygen left is lost | Delta front toe, Máaz lava rock (Sid) | none | 194 min → 96 min | **CAUTION** | **CAUTION** |
| Slower walking | walking speed drops to 70% of normal | Delta front toe, Máaz lava rock (Sid) | none | 194 min → 151 min | **GO** | **CAUTION** |
| Path blocked | ground within 75 m of a point on the route ahead is impassable | Delta front toe, Máaz lava rock (Sid) | none | 194 min → 193 min | **GO** | **CAUTION** |

### Demo case: a bigger oxygen loss that drops a stop

| | |
|---|---|
| Setting | `lossFraction` = 0.5 (50% of the oxygen left is lost) |
| Kept stops | Delta front toe |
| Dropped stops | Máaz lava rock (Sid) |
| New route | astronaut's position → Delta front toe → HAB-1 |
| Oxygen margin before → after | 194 min → 31 min |
| New plan ends | T+2:58 (15:53 LMST) |
| Oxygen on arrival | 16% |
| EVA status | **CAUTION** |
| Return-home status (if she walked straight home instead) | **CAUTION**, 111 min margin |

Reasons, as the app shows them:

  - Oxygen loss at T+1:16: 50% of the oxygen left is gone (197 min of life support).
  - Dropped 1 stop to keep the 45 min reserve: Máaz lava rock (Sid).
  - Oxygen margin is low: 31 min above reserve, under 25% of the 435 min usable budget (480 min minus the 45 min reserve).

**Sentence for the slides:**

> A 50% oxygen loss at T+1:16 drops the Máaz lava rock (Sid) stop; ARES re-plans through Delta front toe and home with 31 min of margin.

The app's "Oxygen loss" button uses the default 25%, which drops no stop on the demo mission. This demo case needs `lossFraction` passed to `scenarioAt`.
