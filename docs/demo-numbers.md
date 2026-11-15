# ARES demo numbers (frozen)

Use these numbers in the slides, the video and the project page. Do not type a number from memory.

This file is written by `app/src/planner/demo-numbers.test.ts`: planner numbers are computed from
the real `site.json` and formatted with `format.ts`, so they match what the app shows; validation
and route-learning numbers are read from the pipeline's output files. `npm test` fails if this
file and the code stop agreeing.

**Numbers taken from commit `d322e20`** (the planner and data at that commit).

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
