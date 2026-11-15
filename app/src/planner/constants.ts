// Contract 2 — suit and mission constants (see CLAUDE.md section 5).
// These values are shared by the whole team. Do not change one without
// agreeing with the team first.

/** Life support at nominal rate, in hours. */
export const CONSUMABLE_HOURS = 8;
/** Oxygen time (minutes) that must remain at return. */
export const RESERVE_MIN = 45;
/** Oxygen multiplier while walking with load. */
export const WALK_BURN = 1.3;
/** Oxygen multiplier during science at a stop. */
export const WORK_BURN = 0.9;
/** Suited walking speed on flat firm ground, km/h. */
export const BASE_SPEED_KMH = 3.0;
/** Slopes steeper than this (degrees) are no-go. */
export const MAX_SLOPE_DEG = 25;
/** Thermal inertia below this means soft sand. */
export const SAND_TI_THRESHOLD = 175;
/** Speed multiplier in soft sand. */
export const SAND_SPEED_FACTOR = 0.55;
/** Boulder density above this is no-go. */
export const ROCK_NO_GO = 0.75;
/** Speed multiplier in a dust storm (low visibility, dust on the visor — not wind). */
export const STORM_SPEED_FACTOR = 0.55;
/** Extra oxygen reserve (minutes) during a storm. */
export const STORM_EXTRA_RESERVE_MIN = 30;
/**
 * Average surface dose equivalent, mSv per sol, from galactic cosmic rays.
 * SOURCED: Curiosity RAD at Gale crater measured 0.64 ± 0.12 mSv/day over about 300
 * sols (7 Aug 2012 to 1 Jun 2013). Hassler et al. 2014, Science 343, 1244797,
 * doi:10.1126/science.1244797: text p. 1244797-2 and Table 1.
 * The paper writes "/day" and does not say whether that is an Earth day or a sol; we
 * use it per sol. If it is per Earth day the per-sol value is 2.7% higher, far inside
 * the ±0.12 uncertainty. Measured at Gale, applied to Jezero.
 */
export const DOSE_MSV_PER_SOL = 0.64;
/**
 * ILLUSTRATIVE dose-rate increase during a solar particle event. It is NOT a measured
 * value: see SPE_IS_ILLUSTRATIVE and SPE_MEASURED_2017_PEAK_MULTIPLIER.
 */
export const SPE_MULTIPLIER = 30;
/** True: SPE_MULTIPLIER is a made-up demo value. The UI must label SPE dose numbers "illustrative". */
export const SPE_IS_ILLUSTRATIVE = true;
/**
 * What was really measured: in the September 2017 event, the largest RAD has seen on
 * the surface, the peak dose EQUIVALENT rate "was only about 50% greater" than before
 * the event (841 vs 543 µSv/day), while absorbed dose rates rose "by factors of two to
 * three". Zeitlin et al. 2018, GRL 45, 5845-5851, doi:10.1029/2018GL077760, Table I.
 * For display next to the illustrative value; the planner does not use it.
 */
export const SPE_MEASURED_2017_PEAK_MULTIPLIER = 1.5;
/** Sol length in Earth hours. */
export const SOL_HOURS = 24.66;
/** Mars sphere radius for all distance math, meters (IAU sphere). */
export const MARS_RADIUS_M = 3396190;
