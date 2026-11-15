# ARES — limitations

What ARES does **not** do, or does only approximately. Values are from `app/src/planner/constants.ts` unless another file is named. Every model choice and its source is in [`assumptions.md`](assumptions.md).

## Terrain and data

- **Rocks are a roughness proxy, not a boulder count.** The `rock` layer is the bumpiness of the 1 m HiRISE elevation model inside each cell. A 1 m elevation model cannot see boulders smaller than a few meters. We searched for a downloadable rock-abundance or boulder map of Jezero and found none (the search is listed in [`assumptions.md`](assumptions.md#rock-layer-why-it-is-still-a-roughness-proxy)). Cells with roughness above `ROCK_NO_GO` = 0.75 are no-go.
- **25 m grid cells.** The site is a 320 × 240 grid of about 24.6 × 24.7 m cells. Anything smaller than a cell (a single boulder, a narrow gap, a short ledge) is averaged into it. Slope uses the 90th percentile of ~5 m slopes in each cell, so small cliffs are not averaged away, but a cell can still be marked no-go because of one steep part.
- **One site only.** Everything is built for the Jezero Crater delta front, 18.40–18.50 N, 77.36–77.50 E (about 6 × 8 km). Another site needs the data pipeline run again.

## Astronaut models

- **Walking and oxygen are estimates, not spacesuit data.**
  - Walking speed is a version of Tobler's hiking function: `BASE_SPEED_KMH` = 3.0 km/h on flat firm ground, slower on slopes, × `SAND_SPEED_FACTOR` = 0.55 in soft sand (thermal inertia under `SAND_TI_THRESHOLD` = 175), slowed by roughness. Slopes over `MAX_SLOPE_DEG` = 25° are no-go.
  - Oxygen: `CONSUMABLE_HOURS` = 8 h of life support (the Shuttle/ISS EMU rating), burned × `WALK_BURN` = 1.3 while walking and × `WORK_BURN` = 0.9 during science, with a `RESERVE_MIN` = 45 min reserve (+ `STORM_EXTRA_RESERVE_MIN` = 30 min in a dust storm). The burn rates, reserve and sand factor are our assumptions, not measured suit data.
  - Dust storm: walking × `STORM_SPEED_FACTOR` = 0.55 (low visibility and dust on the visor, not wind). The factor is our assumption.

- **The re-planning emergencies use made-up sizes** (`app/src/planner/emergencies.ts`). The 25% oxygen loss, the 75 m blocked area and the 0.7 walking-speed factor are illustrative demo values, not measured suit-failure or rockfall data. An oxygen leak is modelled as one sudden loss, not a steady leak. Stops are only dropped from the end of the plan, never re-ordered. A blocked area is a simple circle.
- **The Monte Carlo reliability numbers cover calm conditions only, and every range in them is ASSUMED** (`app/src/planner/montecarlo.ts`). No dust storm or solar particle event happens inside a trial, the route is never re-planned, and injury, equipment failure and navigation errors are not modelled. The ranges it samples (walking speed ±15%, terrain ±10% per leg, oxygen burn rates ±20%, ±5 min per stop) are our own modest guesses, not suit or astronaut data. It is a model-based simulation of our own assumptions, not an empirical mission success probability. When no trial fails we report "1000 of 1000" with the bound "failure rate likely below 0.3%" (3 ÷ trials), never a bare 100%; that bound also holds only inside the model.
- **No rover model, so no rover-breakdown scenario.** ARES plans for an astronaut on foot. There is no support rover, so there is nothing to break down and no rover rescue to plan.

## Radiation

- **The solar particle event is illustrative.** During an SPE the dose rate is multiplied by `SPE_MULTIPLIER` = 30 (`SPE_IS_ILLUSTRATIVE` = true). This is a demo value, not a measurement. In the largest event Curiosity's RAD measured on the surface (September 2017), the peak dose-equivalent rate was only about 1.5 times normal (`SPE_MEASURED_2017_PEAK_MULTIPLIER` = 1.5, Zeitlin et al. 2018). Real events also build up over hours; ours starts at once.
- **The everyday dose was measured at Gale Crater, not Jezero.** `DOSE_MSV_PER_SOL` = 0.64 mSv (± 0.12) is the surface average measured by the RAD instrument on Curiosity at Gale Crater (Hassler et al. 2014). Perseverance carries no radiation detector. We transfer the Gale value to Jezero as an estimate; the true Jezero value may differ.
- **The background dose and the solar particle event are separate.** The background dose is the measured value above. The SPE scenario is a ×30 multiplier on top of it and is illustrative (next point). Every number's evidence level is in [`parameters.md`](parameters.md).
- **The shelter model is simplified** (`SHELTER_MODEL_IS_SIMPLIFIED` = true in `app/src/planner/shelter.ts`). It uses sky view only: the dose at a spot is the SPE dose rate × the open fraction of the sky. It assumes the radiation arrives equally from every direction, ignores particles made in the ground and rock walls, and assumes the event lasts a fixed 60 minutes (`DEFAULT_WAIT_MIN`). A shelter is suggested only if it cuts the dose by at least 5% (`MIN_DOSE_REDUCTION_PCT`). It compares two options under the same assumptions; it is not a dose prediction.

## Machine learning and AI

- **The learned route cost is off by default.** We trained a route cost on 31 of Perseverance's real drive routes (15.38 km) to see if it could pick routes closer to the drivers' than our physics model. On routes it had not seen, it did not do better: both are 24.8 m from the rover's real routes on average, against 35.3 m for a straight line. The only direction the rover data pushed was "less careful", which a planner for astronauts should not take, and it also matched the drivers worse. The model ships in `app/public/data/route-model.json` but is used only if code passes it to `planRoute` as `routeGrid`; the app has no button for it. Details: [`route-learning.md`](route-learning.md).
- **The AI assistant is not enabled.** The chat assistant's code is in the repo (`backend/`, `app/src/ai/ChatPanel.experimental.tsx`), but it is not mounted in the app, its backend is not deployed, and it is not part of the submission. It has not been tested against the live model. See [`ai-disclosure.md`](ai-disclosure.md#ai-assistant-in-the-app).
