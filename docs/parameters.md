# ARES — every number in the planner

One row for every number in `app/src/planner/constants.ts`, `oxygen.ts`, `env.ts`, `science.ts` and `shelter.ts`: what it is, how sure we are, and where it falls short. Longer reasoning is in [`assumptions.md`](assumptions.md); full references and links are in [`sources.md`](sources.md); what ARES cannot do is in [`LIMITATIONS.md`](LIMITATIONS.md).

A test (`app/src/planner/parameters-doc.test.ts`) fails if an exported constant from those files is missing from this page.

## Evidence levels

| Level | Meaning |
|---|---|
| **OBSERVED** | Measured by an instrument, and we use the published value. The "observation location" column says where it was measured, which is not always Jezero. |
| **CALCULATED** | Worked out from observed values by a stated formula or a published algorithm. |
| **INTERPRETED** | A reading of measured data that depends on a judgement about what the measurement means (for example "this spectral signal means clay"). |
| **ASSUMED** | Our own choice for the demo. Not measured. |

"Not quantified" in the uncertainty column means we have no number for it, not that it is small.

## Radiation: read this first

- **The background dose was not measured at Jezero.** `DOSE_MSV_PER_SOL` (0.64 ± 0.12 mSv per day) was measured by the RAD instrument on the **Curiosity** rover at **Gale Crater** (Hassler et al. 2014). Perseverance carries no such instrument. ARES **transfers** the Gale value to Jezero **as an estimate**. Both are low-elevation sites near the equator, but the dose depends on how much atmosphere is overhead and on the solar cycle, so the true Jezero value may differ.
- **The background dose and the solar particle event are two separate things.** The background dose is the observed value above. The solar particle event in the demo multiplies it by `SPE_MULTIPLIER` = 30, which is an **illustrative scenario, not a measurement** (`SPE_IS_ILLUSTRATIVE` = true). The largest event RAD has actually measured on the surface raised the dose equivalent rate by about 1.5×. Any number shown during the SPE scenario is illustrative; any number shown outside it is the Gale-based estimate.

## `constants.ts` — suit and mission (Contract 2)

| Name | Value | Unit | Evidence | Source | Observation location | Uncertainty range | Known limitation |
|---|---|---|---|---|---|---|---|
| `CONSUMABLE_HOURS` | 8 | hours of life support at the nominal rate | ASSUMED | Shuttle/ISS EMU suit: "operation capacity was 8 hours nominally" (Chullen, Pena & Chen 2023) | Earth orbit (existing suits) | Not quantified. Apollo 15–17 suits were certified for 7 h | A rating for a different suit in a different environment. No Mars surface suit exists yet |
| `RESERVE_MIN` | 45 | minutes of oxygen left at return | ASSUMED | Our choice. The EMU's emergency backup is certified for 30 min (Chullen et al. 2023); we add 15 min | — | Not quantified | Not an agency flight rule |
| `WALK_BURN` | 1.3 | × nominal oxygen rate while walking with a load | ASSUMED | Our round figure. Suited metabolic rate rises with speed and suit weight (Gernhardt, Norcross & Vos 2008), but no source gives 1.3 | — | Not quantified | Real rate depends on the suit, gravity, slope and load; we use one number for all terrain |
| `WORK_BURN` | 0.9 | × nominal oxygen rate during science at a stop | ASSUMED | Our choice: standing work is assumed lighter than the nominal rate | — | Not quantified | No source. Heavy sampling work could exceed the nominal rate |
| `BASE_SPEED_KMH` | 3.0 | km/h on flat, firm ground | ASSUMED | Tobler's hiking function: 5 km/h on flat ground × his 3/5 off-path factor (Tobler 1993) | Earth (unsuited hikers) | Not quantified | Earth walking data applied to a suited astronaut in Mars gravity |
| `MAX_SLOPE_DEG` | 25 | degrees; steeper cells are no-go | ASSUMED | Our cut-off. No source found for a suited slope limit | — | Tested at 20° and 30° in [`validation.md`](validation.md): the rover-path result moves by about 0.5 points | A single limit for uphill, downhill and side slopes |
| `SAND_TI_THRESHOLD` | 175 | J m⁻² K⁻¹ s⁻½; thermal inertia below this counts as soft sand | INTERPRETED | Low thermal inertia means loose, fine material (Edwards et al. 2009 put bedrock above 1200). The 175 cut-off is ours | Jezero (THEMIS orbital data) | Not stated for the map we use. A second THEMIS product (USGS, which states about 20% absolute accuracy) reads ~100 units higher here | Thermal inertia is a 100 m orbital measurement of the top centimeters; it does not measure how far a boot sinks |
| `SAND_SPEED_FACTOR` | 0.55 | × speed in soft sand | ASSUMED | Our choice: loose sand roughly halves walking speed | — | Not quantified | No source |
| `ROCK_NO_GO` | 0.75 | rock (roughness) index 0–1; higher cells are no-go | ASSUMED | Our choice. The index is our own roughness measure (1.0 = 1 m of bumpiness in a 25 m cell) | Jezero (HiRISE elevation) | Tested at 0.65 and 0.85 in [`validation.md`](validation.md): no change on the rover path, so that check cannot confirm it | The rock layer is roughness, not a boulder count |
| `STORM_SPEED_FACTOR` | 0.55 | × speed in a dust storm | ASSUMED | The reason is sourced (thin air: wind cannot push a person; NASA, Hille 2015). The number is ours | — | Not quantified | Stands for low visibility and dust on the visor; no measured value |
| `STORM_EXTRA_RESERVE_MIN` | 30 | extra minutes of reserve in a storm | ASSUMED | Our choice | — | Not quantified | No source |
| `DOSE_MSV_PER_SOL` | 0.64 | mSv per sol (background dose equivalent, galactic cosmic rays) | OBSERVED at Gale Crater; **transferred to Jezero as an estimate** | Curiosity RAD, Hassler et al. 2014, text p. 1244797-2 and Table 1 | **Gale Crater** (Curiosity), 7 Aug 2012 – 1 Jun 2013 | ± 0.12 (published). Over the solar cycle about 0.3–0.9 mSv/day (Guo et al. 2021) | Not measured at Jezero. Measured near solar maximum, so not a worst case. The paper says "per day" without saying Earth day or sol (2.7% difference) |
| `SPE_MULTIPLIER` | 30 | × background dose rate during a solar particle event | ASSUMED (illustrative scenario) | None. A demo value | — | Not applicable: it is not an estimate of a real event | **Not a measurement.** Separate from the background dose. Real events build up and fade over hours; ours switches on at once |
| `SPE_IS_ILLUSTRATIVE` | true | flag | ASSUMED | Marks `SPE_MULTIPLIER` as illustrative so the UI labels it | — | — | — |
| `SPE_MEASURED_2017_PEAK_MULTIPLIER` | 1.5 | × background dose equivalent rate at the peak of a real event | OBSERVED | Curiosity RAD, Zeitlin et al. 2018, Table I (841 vs 543 µSv/day; "about 50% greater") | **Gale Crater** (Curiosity), September 2017 | Table values give 1.55. Absorbed dose rose 2–3× | One event. Shown for comparison only; the planner does not use it |
| `SOL_HOURS` | 24.66 | Earth hours in one Mars solar day | OBSERVED | NASA NSSDC Mars Fact Sheet: 24.6597 h | Mars (whole planet) | Rounded from 24.6597 (0.001%) | — |
| `MARS_RADIUS_M` | 3396190 | meters; sphere radius for all distance maths | OBSERVED (adopted IAU reference value) | IAU 2000 equatorial radius, 3396.19 km (PDS Mars Orbital Data Explorer) | Mars (whole planet) | The polar radius is 3376.2 km (0.6% smaller) | Treats Mars as a sphere; fine over a 6 × 8 km site |

## `oxygen.ts`

| Name | Value | Unit | Evidence | Source | Observation location | Uncertainty range | Known limitation |
|---|---|---|---|---|---|---|---|
| `CAUTION_MARGIN_FRACTION` | 0.25 | fraction of the usable oxygen budget; a smaller margin is CAUTION | ASSUMED | Contract 3 team rule | — | Not quantified | A planning rule of thumb, not an agency flight rule |
| Usable budget | 26,100 (calm), 24,300 (storm) | seconds: `CONSUMABLE_HOURS` × 3600 − reserve | CALCULATED | From the constants above | — | Inherits the assumptions in `CONSUMABLE_HOURS` and `RESERVE_MIN` | — |
| 3600, 60 | — | seconds per hour, seconds per minute | CALCULATED | Unit conversion | — | Exact | — |

## `env.ts` — sun, temperature, radiation rate

| Name | Value | Unit | Evidence | Source | Observation location | Uncertainty range | Known limitation |
|---|---|---|---|---|---|---|---|
| `SITE_LAT_DEG` | 18.45 | degrees north | CALCULATED | Centre of the site bounds (18.40–18.50 N) | Jezero | Exact for the site centre; ±0.05° across the site | One latitude is used for the whole site |
| `DEMO_LS_DEG` | 0 | degrees of solar longitude (season); 0 = northern spring equinox | ASSUMED | Our demo season | — | — | One fixed season. Day length and sun height change through the year |
| `SUN_CAUTION_DEG` | 10 | degrees; a lower sun during the EVA is CAUTION | ASSUMED | Contract 3 team rule | — | Not quantified | Flat horizon: crater walls can hide a low sun earlier than this model says |
| `TEMP_IS_SOURCED` | true | flag | OBSERVED | Marks the temperature minimum, maximum and their times as measured | — | — | Does not cover the shape of the curve between them |
| `TEMP_SOURCE_LS_DEG` | 25 | degrees of solar longitude; season of the temperature measurements | OBSERVED | Munguira et al. 2023, Table 1 and Fig. 2 (sols 34–40) | **Jezero** (Perseverance MEDA) | — | Not our demo season (Ls 0°). The paper says daily temperatures "increased only slightly" over the first 280 sols |
| `TEMP_MIN_K` | 191 | kelvin; daily minimum air temperature at 1.45 m | OBSERVED | Munguira et al. 2023, Table 1 | **Jezero** (Perseverance MEDA), Ls 25° | Not stated in what we read. An average over 7 sols | Air at 1.45 m at the rover's location, not the ground and not the whole site |
| `TEMP_MAX_K` | 243 | kelvin; daily maximum air temperature at 1.45 m | OBSERVED | Munguira et al. 2023, Table 1 | **Jezero** (Perseverance MEDA), Ls 25° | Not stated in what we read. An average over 7 sols | Same as above |
| `TEMP_MIN_LTST` | 5.25 | hours, local true solar time of the minimum | OBSERVED | Munguira et al. 2023, Table 1: 05:00, the start of a 30-minute window | **Jezero** (Perseverance MEDA) | ± 15 min (we use the middle of the window) | — |
| `TEMP_MAX_LTST` | 15.25 | hours, local true solar time of the maximum | OBSERVED | Munguira et al. 2023, Table 1: 15:00, the start of a 30-minute window | **Jezero** (Perseverance MEDA) | ± 15 min (we use the middle of the window) | — |
| `TEMP_MIN_C` | −82.15 | °C | CALCULATED | `TEMP_MIN_K` − 273.15 | Jezero | Same as `TEMP_MIN_K` | — |
| `TEMP_MAX_C` | −30.15 | °C | CALCULATED | `TEMP_MAX_K` − 273.15 | Jezero | Same as `TEMP_MAX_K` | — |
| `TEMP_MIN_LMST` | 5.94 (05:56) | hours, local mean solar time | CALCULATED | `TEMP_MIN_LTST` shifted by the Mars24 equation of time at Ls 0° (−41 min) | Jezero | ± 15 min | Uses the demo season's equation of time for a time measured at Ls 25° |
| `TEMP_MAX_LMST` | 15.94 (15:56) | hours, local mean solar time | CALCULATED | `TEMP_MAX_LTST` shifted the same way | Jezero | ± 15 min | Same as above |
| Temperature curve shape | half a cosine up, half a cosine down | — | ASSUMED | Our interpolation between the two measured points | — | Not quantified | The real daily curve is not a cosine; only its lowest and highest points are measured |
| −273.15 | — | kelvin to °C | CALCULATED | Definition of the Celsius scale | — | Exact | — |
| 270.3871, 19.3871 | 251.0 (their difference) | degrees; position of Mars's closest point to the Sun, in solar longitude | CALCULATED | Mars24 equations B-1 and B-2 (Allison & McEwen 2000) | Mars's orbit | Not quantified here | — |
| 10.691, 0.623, 0.050, 0.005, 0.0005 | — | degrees; terms of the "equation of center" | CALCULATED | Mars24 equation B-4 | Mars's orbit | We drop two small date-dependent parts (at most about 0.02°) | Simplification: we fix a season, not a calendar date |
| 2.861, 0.071, 0.002 | — | degrees; terms of the Mars equation of time | CALCULATED | Mars24 equation C-1. Checked against two Mars24 worked examples to within 0.05° | Mars's orbit | 0.05° (12 seconds of time) | — |
| 0.42565, 0.25 | — | sine of the 25.19° axial tilt; small correction in degrees | CALCULATED | Mars24 equation D-1 (solar declination) | Mars | Not quantified here | — |
| 15, 12, 24 | — | degrees per hour; hour of solar noon; hours in a sol on the Mars clock | CALCULATED | Clock conventions (Mars24 C-4, D-5) | — | Exact | — |
| 30 | — | repeat count when solving for the mean anomaly | CALCULATED | Numerical method; converges long before 30 | — | Below 1e-9° | — |
| Sun elevation | −71.5° to +71.5° at Ls 0° | degrees above the horizon | CALCULATED | Mars24 equation D-5 | Site centre | About 0.05° from the dropped terms | Geometric: no refraction, no terrain shadow |
| Dose rate | 0.0260 (background), 0.779 (illustrative SPE) | mSv per Earth hour | CALCULATED from the transferred Gale value | `DOSE_MSV_PER_SOL` ÷ `SOL_HOURS`, × `SPE_MULTIPLIER` in the SPE scenario | Gale Crater value, used at Jezero | ± 19% for the background rate; the SPE rate is illustrative | Spread evenly through the sol; the real rate varies during the day |
| 60 | — | seconds between sun checks during an EVA | ASSUMED | Our sampling step | — | The sun moves about 0.25° per minute | — |

## `science.ts` — science per oxygen-minute

| Name | Value | Unit | Evidence | Source | Observation location | Uncertainty range | Known limitation |
|---|---|---|---|---|---|---|---|
| Science value of a cell | 0–1 | relative index | INTERPRETED | CRISM observation HRL000040FF: spectral parameters D2300 (read as Fe/Mg clay) and MIN2295_2480, MIN2345_2537 (read as carbonate), Viviano-Beck et al. 2014 | **Jezero** (MRO CRISM, from orbit) | Not quantified. Parameters are noisy and can respond to other minerals | A spectral signal read as a mineral, not a detection confirmed on the ground and not an abundance. Rover-confirmed carbonate on the crater floor scores only 0.1–0.3 |
| Science score of a stop | science ÷ extra oxygen-minutes | index per oxygen-minute | INTERPRETED | Our formula on the science value above and the planner's oxygen model | Jezero | Inherits both: an interpreted index divided by an assumed oxygen cost | A ranking aid, not a measure of scientific worth |
| `SCIENCE_RADIUS_M` | 50 | meters; the science value of a stop is the mean within this distance | ASSUMED | Our choice | — | Not quantified | — |
| `SUGGEST_TOP_FRACTION` | 0.03 | fraction of cells considered as suggested stops (the top 3% by science value) | ASSUMED | Our choice | — | Not quantified | — |
| `SUGGEST_MIN_SPACING_M` | 150 | meters; minimum distance between a suggestion and any other stop or the habitat | ASSUMED | Our choice | — | Not quantified | — |
| `SUGGEST_DWELL_MIN` | 30 | minutes of science assumed at a suggested stop | ASSUMED | Our choice, same as the demo stops | — | Not quantified | — |
| `SUGGEST_START_LMST` | 13 | hours; default EVA start time when none is given | ASSUMED | Our choice, same as the demo mission | — | — | Only affects the low-sun rule |
| 3, 4 | — | default number of suggestions; size of two internal work limits | ASSUMED | Programming choices; they do not change any reported number | — | — | — |

## `shelter.ts` — shelter routing in a solar particle event

Every dose in this file uses the **illustrative** SPE rate. The file compares two options under the same assumptions; it does not predict a dose.

| Name | Value | Unit | Evidence | Source | Observation location | Uncertainty range | Known limitation |
|---|---|---|---|---|---|---|---|
| `SHELTER_MODEL_IS_SIMPLIFIED` | true | flag | ASSUMED | Marks the shelter dose model as a simplification so the UI says so | — | — | — |
| `DEFAULT_WAIT_MIN` | 60 | minutes; assumed length of the event from its start | ASSUMED | Our choice | — | Not quantified | Real events build up and fade over hours |
| `MIN_DOSE_REDUCTION_PCT` | 5 | percent; a shelter is suggested only if it cuts the dose by at least this much | ASSUMED | Our choice | — | Not quantified | Smaller differences are inside what the simplified model can tell apart |
| `SHELTER_WAIT_BURN` | 0.9 | × nominal oxygen rate while waiting at a shelter (= `WORK_BURN`) | ASSUMED | Reuses the planner's rate for working at a stop | — | Not quantified | No measured value for sheltering; resting should need less |
| Sky view of a cell | 0–1 | open fraction of the sky | CALCULATED | Worked out from the HiRISE elevation model by `pipeline/build_shielding.py` (how much of the sky the surrounding terrain leaves open) | Jezero (HiRISE elevation) | Not quantified | Small overhangs and anything the elevation model does not resolve are not seen |
| Dose at a spot | SPE dose rate × sky view × time | mSv | ASSUMED (simplified model on an illustrative rate) | Our model | — | Not applicable | Assumes radiation arrives equally from all directions, ignores atmosphere thickness by direction and secondary particles from the ground and rock |
| 0 | — | sky view inside the habitat (full shelter) | ASSUMED | Our choice | — | Not quantified | Real habitat shielding is not zero dose |
| 1 | — | sky view used where the layer has no data (fully open) | ASSUMED | The cautious choice | — | — | — |
| 0.5, 1e-6, 10 | — | averaging weight between two cells; a tolerance for "no difference"; distances in sentences are rounded to 10 m | CALCULATED | Numerical choices; they do not change which option is chosen | — | — | — |
