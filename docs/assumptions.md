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

- **Terrain:** real NASA data on a 25 m grid (320 × 240 cells) over the Jezero delta front: HiRISE elevation (1 m), THEMIS thermal inertia (100 m) and CRISM minerals (36 m). Slope keeps small cliffs by taking the 90th percentile inside each cell. "Rock" is ground roughness, not a boulder count. "Science value" is a relative clay/carbonate index, not an abundance. Distances use the IAU Mars radius (3,396.19 km).
- **Walking speed:** Tobler's hiking function, slowed for a suit: 3 km/h on flat firm ground. That is Tobler's 5 km/h × his 3/5 off-path factor. Soft sand and boulders slow the walk further. Slopes over 25° and dense boulder fields are no-go.
- **Oxygen:** 8 h of life support (Shuttle/ISS EMU rating). Walking burns 1.3× the nominal rate and science work 0.9×. 45 min must be left on return (75 min in a dust storm). The burn rates and reserve are our assumptions.
- **Safety rules:** NO-GO if any stop can't be reached or the oxygen margin is negative. CAUTION if the margin is under 25% of the usable oxygen, the sun is below 10°, or a storm or solar event is active.
- **Safe-return zone:** everywhere the astronaut can still reach after the last stop and still walk home with the reserve intact. This is the Apollo "walkback" idea, computed over real terrain.
- **Dust storm:** Mars air is about 1% as dense as Earth's, so wind can't knock a person over (NASA). We slow walking to 55% because of low visibility and dust on the visor.
- **Radiation:** surface dose measured by Curiosity's RAD at Gale Crater, 0.64 ± 0.12 mSv per day (Hassler et al. 2014), applied to Jezero. The ×30 solar-particle-event spike is **illustrative** and the app says so. The largest event RAD has measured (September 2017) raised the dose equivalent rate only about 1.5× (absorbed dose 2–3×).
- **Sun and temperature:** sun position from NASA's Mars24 algorithm (Allison & McEwen 2000) for one fixed season (Ls 0°). Air temperature uses values measured by Perseverance's MEDA weather station at Jezero: a low of −82 °C just before sunrise and a high of −30 °C in mid-afternoon (Munguira et al. 2023, season Ls 25°). The curve between those two points is our own smooth interpolation.

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
| `ROCK_NO_GO` | 0.75 | Rock/roughness value (0–1) above which a cell is no-go | No source. The rock layer is a 0–1 roughness index we derive from the HiRISE DTM (1.0 = 1 m of bumpiness inside a cell), so 0.75 means about 0.75 m. See "Terrain data" below. | Assumption |
| `STORM_SPEED_FACTOR` | 0.55 | Speed multiplier in a dust storm | The **reason** is sourced: NASA says Mars air is "about 1 percent as dense as Earth's atmosphere" and storm wind "likely could not tip or rip apart major mechanical equipment". So the slowdown is from low visibility and dust on the visor, not wind. The 0.55 number is ours. | Assumption |
| `STORM_EXTRA_RESERVE_MIN` | 30 min | Extra oxygen reserve while a storm is active | No source. Extra margin for slower, low-visibility walking. | Assumption |
| `DOSE_MSV_PER_SOL` | 0.64 mSv | Average surface dose equivalent per sol (galactic cosmic rays) | Hassler et al. 2014 (*Science* 343, 1244797), full text read: "an average GCR dose-equivalent rate on the Mars surface of 0.64 ± 0.12 millisieverts (mSv)/day" (**text p. 1244797-2 and Table 1**), for ~300 sols from 7 Aug 2012 to 1 Jun 2013, near solar maximum. Confirmed independently in Matthiä et al. 2016, Table 2. See note 1 on "day" vs "sol". | Sourced |
| `SPE_MULTIPLIER` | ×30 | Dose-rate increase during a solar particle event | **Illustrative only**, and flagged in code with `SPE_IS_ILLUSTRATIVE = true` so the UI can label it. No source supports 30 at the surface. Kept because the emergency drill needs a visible spike and changing it is a Contract 2 change. | Assumption (illustrative) |
| `SPE_MEASURED_2017_PEAK_MULTIPLIER` | ×1.5 | What was really measured, for display beside the illustrative value | Zeitlin et al. 2018 (*GRL* 45), accepted manuscript read: in the September 2017 event, RAD's largest so far, dose rates rose "by factors of two to three" (abstract), but the peak dose **equivalent** rate "was only about 50% greater" than before the event (Table I: 841 vs 543 µSv/day). The planner does not use this value. | Sourced |
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
| `TEMP_MIN_K` / `TEMP_MAX_K` (`TEMP_MIN_C` / `TEMP_MAX_C`) | 191 K / 243 K (−82.15 °C / −30.15 °C) | Daily minimum and maximum air temperature at 1.45 m above the ground | Measured by Perseverance MEDA. Munguira et al. 2023 (*JGR Planets*), **Table 1**, row for 1.45 m, season Ls 25° (sols 34–40): Tmin 191 K, Tmax 243 K, daily range 52 K. Rodriguez-Manfredi et al. 2023 (*Nature Geoscience*) independently reports a diurnal half amplitude of 26 K at 1.45 m, which matches the 52 K range. | Sourced |
| `TEMP_MIN_LTST` / `TEMP_MAX_LTST` | 05:15 / 15:15 true solar time (05:56 / 15:56 on the LMST clock at Ls 0°) | Times of the coldest and warmest air | Munguira et al. 2023, Table 1: time of Tmin 05:00 and time of Tmax 15:00, each the start of a 30-minute window in local true solar time. We use the middle of each window, then convert to LMST with the Mars24 equation of time for the demo season. | Sourced (window midpoint and conversion are ours) |
| Temperature season | measured at Ls 25°, used at Ls 0° | The table's closest season to our demo season | Ls 25° (sols 34–40) is the earliest season Table 1 lists; Perseverance landed at Ls 5°. The paper says daily air temperatures "increased only slightly over the first 280 sols", so we treat Ls 25° as representative of Ls 0°. That step is ours, not a measurement. | Assumption |
| Temperature curve shape | half a cosine up (min → max), half a cosine down | Temperature between the two measured points | Our interpolation. It passes through the measured minimum and maximum at the measured times and never leaves that range, but the real curve between them is not a cosine. | Assumption |
| Dose rate over the sol | flat: 0.64 / 24.66 mSv per h | Dose spread evenly through the day | Simplification. Hassler et al. 2014 report the daily dose rate varying "between 180 and 225 microgray" per day over the period; we use the average. | Assumption |
| Solar-cycle variation | ignored | The dose rate changes over the 11-year solar cycle | Guo et al. 2021 (review, *Astron Astrophys Rev* 29:8) give a surface dose equivalent range of about 0.3–0.9 mSv/day between solar maximum and minimum. Our 0.64 was measured near solar maximum, so it is not a worst case. | Assumption |

## Terrain data (`pipeline/build_site.py`)

All layers come from real NASA/USGS data (see [`sources.md`](sources.md) and `pipeline/README.md`). The choices below are how we turned them into one number per 25 m cell.

| Name | Value | What it means | Source or justification | Status |
|---|---|---|---|---|
| Elevation | mean of the 1 m HiRISE DTM in each cell | Height of each cell, meters | USGS Mars 2020 TRN HiRISE DTM mosaic (doi:10.5066/P9REJ9JN). Checked: 400 random cells match the source DTM (median difference 0.01 m). | Sourced |
| Slope | 90th percentile of ~5 m slopes in each cell | Steepness the planner sees | Our choice. A plain mean hides a 10 m wide cliff in a 25 m cell (383 cells over 25° with the mean, 838 with the 90th percentile). The percentile is not from a source. | Assumption |
| Rock layer | std of plane-detrended 1 m elevation in each cell, 1.0 m = 1.0 | Ground roughness, 0–1 | Our method. **It is not a boulder count**: a 1 m DTM cannot resolve boulders under a few meters. It marks rugged ground (ledges, scarps, crater rims, dune crests). **The 1.0 m full scale is our choice, not from a source**; with it 419 cells (0.5%) are no-go. | Assumption |
| Thermal inertia | Edwards & Buz 2021 THEMIS mosaic, bilinear from 100 m to 25 m | Soft sand where the value is under 175 | Quantitative product (doi:10.5281/zenodo.4931348). Real detail is 100 m; the 25 m layer only looks finer. 9% of cells are under 175. | Sourced (resampling is ours) |
| Thermal inertia product choice | Jezero-specific Edwards & Buz (2021) map, not the USGS global THEMIS mosaic | Which of two real maps we use | **The USGS global THEMIS thermal inertia mosaic (tile 00N060E) reads about 100 units higher here** (window mean ~314 vs ~215). We use Edwards & Buz because it was made for this crater, is archived with a DOI, and states its method. The choice matters: with the USGS values almost nothing would fall under the 175 soft-sand threshold. | Assumption |
| Science value | highest of three CRISM scores: D2300 (clay), MIN2295_2480 and MIN2345_2537 (carbonate) | Where orbital data sees clay or carbonate, 0–1 | CRISM MTRDR HRL000040FF summary parameters (definitions: Viviano-Beck et al. 2014). **The scoring is our choice, not from a source:** 0 or less = 0, the scene's 99.5th percentile = 1, linear in between. | Sourced data, our index |
| Science value meaning | relative index within one scene | Not a mineral abundance | The clay parameter dominates (delta high, crater floor low). Summary parameters are noisy and can respond to other minerals. **Rover-confirmed carbonate on the crater floor scores only 0.1–0.3 on our layer**: the orbital signal is weak at 36 m/pixel, so a low score does not mean "no carbonate". | Assumption |
| Habitat location | 18.4446 N, 77.4509 E | HAB-1 sits at the Perseverance landing site | NASA "Where is Perseverance" waypoints file, first waypoint. Flat, firm cell (slope 1.1°, thermal inertia 243). | Sourced |
| Demo stop "Delta front toe" | 18.4594 N, 77.4228 E | A new science target selected from the CRISM clay signal, not visited by Perseverance | Chosen by us as the nearest flat, firm ground with science value over 0.6. The brief asks for new science, so this is deliberate. The rover's own delta-front sites are too far for a 4–5 km loop (2.6–3.1 km each way). | Assumption |
| Other stops | seven Perseverance sampling sites | Real places with real samples | Coordinates and rock descriptions from the Mars 2020 Initial Reports, volumes 1 and 2. | Sourced |

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

1. **Dose value: confirmed, with one unit caveat.** Hassler et al. 2014 give 0.64 ± 0.12 mSv/day in the text and in Table 1. The paper writes "/day" and describes the measurement period in sols; it does not say whether the rate is per Earth day or per sol. We use it per sol. If it is per Earth day, the per-sol value is 0.66 (2.7% higher), far inside the ±0.12 uncertainty. The SwRI press release for the paper says 0.67 mSv per day; we cite the paper, not the press release.
2. Every "Assumption" row is a candidate for "future work" on the slides. Real suit metabolic data (NASA Human Integration Design Handbook) would replace the burn rates. The temperature curve's shape between its measured minimum and maximum could be replaced by the full MEDA diurnal cycle.
