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
/** Average surface dose, mSv per sol (Curiosity RAD, Hassler et al. 2014). */
export const DOSE_MSV_PER_SOL = 0.64;
/** ILLUSTRATIVE dose-rate increase during a solar particle event. */
export const SPE_MULTIPLIER = 30;
/** Sol length in Earth hours. */
export const SOL_HOURS = 24.66;
/** Mars sphere radius for all distance math, meters (IAU sphere). */
export const MARS_RADIUS_M = 3396190;
