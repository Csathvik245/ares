# ARES — model assumptions

Every number and modelling choice the planner uses, where it comes from, and how sure we are.
Constants live in `app/src/planner/constants.ts` (Contract 2) and `app/src/planner/env.ts`.
Full references with links are in [`sources.md`](sources.md).

**Status key**

- **Sourced** — the value (or the rule behind it) comes from a source we opened and read.
- **Assumption** — our own choice for the demo, with the reason written down. Not measured.
- **Placeholder** — a stand-in we plan to replace with real data.

---

## Model assumptions (slide-ready)

- **Terrain:** 25 m grid (320 × 240 cells) over the Jezero delta front. Distances use the IAU Mars radius (3,396.19 km).
- **Walking speed:** Tobler's hiking function, slowed for a suit: 3 km/h on flat firm ground. That is Tobler's 5 km/h × his 3/5 off-path factor. Soft sand and boulders slow the walk further. Slopes over 25° and dense boulder fields are no-go.
- **Oxygen:** 8 h of life support (Shuttle/ISS EMU rating). Walking burns 1.3× the nominal rate and science work 0.9×. 45 min must be left on return (75 min in a dust storm). The burn rates and reserve are our assumptions.
- **Safety rules:** NO-GO if any stop can't be reached or the oxygen margin is negative. CAUTION if the margin is under 25% of the usable oxygen, the sun is below 10°, or a storm or solar event is active.
- **Safe-return zone:** everywhere the astronaut can still reach after the last stop and still walk home with the reserve intact. This is the Apollo "walkback" idea, computed over real terrain.
- **Dust storm:** Mars air is about 1% as dense as Earth's, so wind can't knock a person over (NASA). We slow walking to 55% because of low visibility and dust on the visor.
- **Radiation:** baseline surface dose measured by Curiosity's RAD at Gale Crater, applied to Jezero. The ×30 solar-particle-event spike is **illustrative**. The largest event RAD has seen raised the surface dose rate only 2–3×.
- **Sun and temperature:** sun position from NASA's Mars24 algorithm (Allison & McEwen 2000) for one fixed season (Ls 0°). The temperature curve is a placeholder until we load Perseverance MEDA data.

---

## Suit and mission constants (`constants.ts`)

| Name | Value | What it means | Source or justification | Status |
|---|---|---|---|---|
| `CONSUMABLE_HOURS` | 8 h | Life support at the nominal rate | Shuttle/ISS EMU: "operation capacity was 8 hours nominally" (Chullen, Pena & Chen 2023, CSER). Apollo 15–17 suits were certified for 7 h; the longest Apollo EVA was 7 h 37 min (Apollo 17 EVA 2, NASA). | Sourced |
| `RESERVE_MIN` | 45 min | Oxygen that must remain when the astronaut gets home | No direct source. The EMU emergency backup oxygen is certified for 30 min (Chullen et al. 2023). We keep 45 min so the backup is never planned into the EVA, plus 15 min of slack. | Assumption |
| `WALK_BURN` | 1.3 | Oxygen-use multiplier while walking with a 20 kg load | No source found for this exact number. IST-1 shows suited metabolic rate rises with walking speed and suit weight (Gernhardt, Norcross & Vos 2008). 1.3× nominal is our round figure for "harder than average". | Assumption |
| `WORK_BURN` | 0.9 | Oxygen-use multiplier during science at a stop | No source. Standing work (imaging, sampling) is assumed lighter than the suit's nominal planning rate. | Assumption |
| `BASE_SPEED_KMH` | 3.0 km/h | Suited speed on flat, firm ground | Tobler's function gives 5 km/h on flat ground and says off-path travel should be multiplied by 3/5, so 5 × 3/5 = 3 km/h (Tobler 1993, via Wikipedia). IST-1 reports expected nominal suited speeds of "< 5 km/hr" in simulated lunar gravity (Gernhardt et al. 2008). Mars gravity (0.38 g) and a 20 kg kit are not modelled separately. | Assumption |
| `MAX_SLOPE_DEG` | 25° | Steeper cells are no-go | No source found for a suited slope limit. Chosen as a conservative cut-off; at 25° our speed formula has already dropped to ~25% of flat speed. | Assumption |
| `SAND_TI_THRESHOLD` | 175 J m⁻² K⁻¹ s⁻½ | Thermal inertia below this counts as soft sand | Edwards et al. 2009 classify THEMIS pixels above 1200 as bedrock, so low values mean loose fine material. 175 sits at the loose, fine-grained end. We chose it; it is not a published cut-off. | Assumption |
| `SAND_SPEED_FACTOR` | 0.55 | Speed multiplier in soft sand | No source. Assumed: walking in loose sand roughly halves speed. | Assumption |
| `ROCK_NO_GO` | 0.75 | Boulder density (0–1) above which a cell is no-go | No source. The rock layer is a 0–1 index we derive from DTM roughness, not a physical unit. | Assumption |
| `STORM_SPEED_FACTOR` | 0.55 | Speed multiplier in a dust storm | The **reason** is sourced: NASA says Mars air is "about 1 percent as dense as Earth's atmosphere" and storm wind "likely could not tip or rip apart major mechanical equipment". So the slowdown is from low visibility and dust on the visor, not wind. The 0.55 number is ours. | Assumption |
| `STORM_EXTRA_RESERVE_MIN` | 30 min | Extra oxygen reserve while a storm is active | No source. Extra margin for slower, low-visibility walking. | Assumption |
| `DOSE_MSV_PER_SOL` | 0.64 mSv | Average surface dose per sol | Hassler et al. 2014 (*Science* 343) is the RAD surface paper. **We could not open its full text to confirm 0.64.** The SwRI press release for the paper (opened) gives "an average GCR dose equivalent rate of 0.67 millisieverts per day from August 2012 to June 2013". It is per Earth **day**, galactic cosmic rays only. See note 1. | Sourced (value to confirm) |
| `SPE_MULTIPLIER` | ×30 | Dose-rate increase during a solar particle event | **Illustrative only.** Zeitlin et al. 2018 (GRL) report that RAD's largest event so far (September 2017) raised surface dose rates "by factors of two to three" above background, for about 12 h. ×30 is about 10× larger than anything measured, chosen so the demo emergency is dramatic. Say so on the slide. | Assumption (illustrative) |
| `SOL_HOURS` | 24.66 h | Length of a Mars solar day in Earth hours | NASA NSSDC Mars Fact Sheet: "Length of day (hrs)" = 24.6597. | Sourced |
| `MARS_RADIUS_M` | 3,396,190 m | Sphere radius for all distance maths | PDS Mars Orbital Data Explorer: IAU equatorial radius "3396.19 km" (IAU2000). The USGS MOLA DEM is described as using this sphere, but that page would not load for us. Mean radius is 3389.5 km; we use the equatorial value to match the map products (CLAUDE.md decision). | Sourced |

## Environment model (`env.ts`)

| Name | Value | What it means | Source or justification | Status |
|---|---|---|---|---|
| Sun position | Mars24 algorithm | Sun elevation over the sol (equation of time, declination, hour angle) | NASA GISS "Mars24 Sunclock — Algorithm and Worked Examples", citing Allison & McEwen 2000, *Planet. Space Sci.* 48, 215–235. | Sourced |
| Date-dependent Mars24 terms | dropped | Slow drift and planetary perturbation terms (≤ ~0.02°) left out because we fix a season, not a date | Size of the terms from the Mars24 page equations; leaving them out is our simplification. | Assumption |
| `SITE_LAT_DEG` | 18.45° N | Latitude used for sun elevation | Centre of our site bounds (18.40–18.50 N). | Sourced (our site definition) |
| `DEMO_LS_DEG` | Ls 0° | Season for the demo (northern spring equinox) | No source: a fixed demo season. The story lead can change it. | Assumption |
| Sun refraction / terrain shadow | ignored | Sun elevation is geometric (sun centre, flat horizon) | Simplification. Crater walls may hide a low sun earlier than shown. | Assumption |
| `TEMP_MIN_C` / `TEMP_MAX_C` | −83 °C / −23 °C | Coldest (pre-dawn) and warmest (early afternoon) air temperature | Placeholder. University of the Basque Country MEDA team (phys.org, 2023) gives a Jezero average near −55 °C with "typical differences of around 50 to 60 degrees" between day and night. Our 60 °C range is consistent but not measured. Replace with MEDA data. | Placeholder |
| `TEMP_MIN_LMST` / `TEMP_MAX_LMST` | 05:30 / 14:00 | Times of coldest and warmest air | Placeholder shape (smooth cosine curve). | Placeholder |
| Dose rate over the sol | flat: 0.64 / 24.66 mSv per h | Dose spread evenly through the day | Simplification. RAD measured a daily cycle tied to atmospheric pressure (seen in search results, paper not opened). | Assumption |

## Planner model choices

| Name | Value | What it means | Source or justification | Status |
|---|---|---|---|---|
| Walking-speed formula | `3.0 × exp(−3.0 × tan(slope))` km/h × sand × (1 − 0.6 × rock) × storm | Speed in each 25 m cell | Form from Tobler's hiking function `6 exp(−3.5 |tan θ + 0.05|)` (Tobler 1993, via Wikipedia). **Our changes:** coefficient 3.0 instead of 3.5, no +0.05 downhill offset (uphill and downhill cost the same, so routes are symmetric), flat speed 3 km/h. Sand and rock factors are ours. | Assumption (Tobler-based) |
| Missing data | no-go | Cells with no slope or rock value can't be walked; missing thermal inertia counts as firm ground | Safety choice: don't route across terrain we have no data for. | Assumption |
| Oxygen use | `walkSec × 1.3 + scienceSec × 0.9` | Oxygen used, in seconds of nominal life support | Contract 2 formula using the constants above. | Assumption |
| Usable budget | 8 h − reserve (− 30 min in a storm) | Oxygen the EVA may spend | Follows from `CONSUMABLE_HOURS` and `RESERVE_MIN`. | Assumption |
| NO-GO rule | margin < 0, or any stop unreachable | Plan cannot be flown | Contract 3 team rule. | Assumption |
| CAUTION rule | margin < 25% of usable budget, sun < 10° during the walk, or storm/SPE active | Plan is flyable but needs attention | Contract 3 team rule. The 25% and 10° thresholds are ours. | Assumption |
| Safe-return zone | cell inside if `(last stop → cell + cell → habitat) × 1.3 ≤ oxygen left after reserve` | Where the astronaut can still go and get home | Apollo-style walkback idea. NASA's EVA Walkback Test studied a "10 kilometer 'walkback' scenario" (described in Gernhardt et al. 2008). Our rule uses oxygen over real terrain instead of a fixed distance. | Assumption |
| Pathfinding | Dijkstra / A*, 8 neighbours, no corner-cutting | Fastest safe route on the grid | Standard deterministic graph search; no ML. | Assumption (design choice) |
| Path smoothing | drop a waypoint only if the straight line is passable **and** no slower than the grid path | Clean line to draw | Our rule. Stops the drawn line cutting across sand the route went around, so the drawn line is never slower than the planned time. | Assumption (design choice) |
| `positionAt` pace | even speed along each leg | Where the marker is during playback | Simplification. The start, end and total time of each leg are exact; the real pace changes with terrain. | Assumption |
| Distances | flat local approximation on a 3,396.19 km sphere | Metres between nearby lat/lng points | Fine over a 6 × 8 km site; ignores Mars's flattening. | Assumption |
| Radiation site | Gale Crater measurement applied to Jezero | RAD is on Curiosity (Gale), not Perseverance | Both are low-elevation equatorial sites, but the dose depends on how much atmosphere is overhead. | Assumption |
| SPE timing | instant switch to ×30 | Emergency starts at once in the demo | Real events build up over hours (Zeitlin et al. 2018). | Assumption (illustrative) |

---

### Notes

1. **Dose value to confirm.** The constant is 0.64 mSv **per sol**. The only figure we could read is 0.67 mSv **per day**, galactic cosmic rays only, from the SwRI press release for Hassler et al. 2014. 0.64 may be the paper's total including solar particles, but we could not open the paper to check. Before the final slides, someone with access to the *Science* paper should confirm the number and whether it is per day or per sol. A sol is 2.7% longer than a day. Changing the constant is a Contract 2 change, so the team must agree first.
2. Every "Assumption" row is a candidate for "future work" on the slides. Real suit metabolic data (NASA Human Integration Design Handbook) would replace the burn rates. MEDA data would replace the temperature placeholder.
