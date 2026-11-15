// Environment over the Martian day (sol): sun elevation, temperature, radiation dose rate.
//
// Sun position follows the Mars24 algorithm:
//   Allison, M., and M. McEwen 2000. A post-Pathfinder evaluation of areocentric
//   solar coordinates with improved timing recipes for Mars seasonal/diurnal
//   climate studies. Planet. Space Sci., 48, 215-235.
//   NASA GISS, "Mars24 Sunclock — Algorithm and Worked Examples",
//   https://www.giss.nasa.gov/tools/mars24/help/algorithm.html
// Equation labels in the comments below (B-1, C-1, D-1, …) are the ones used on that page.
//
// Pure functions, no UI code.

import { DOSE_MSV_PER_SOL, SOL_HOURS, SPE_MULTIPLIER } from "./constants";

/** Latitude of the site, degrees north (planetocentric). */
export const SITE_LAT_DEG = 18.45;

/**
 * Season used for the demo, as areocentric solar longitude Ls in degrees.
 * 0 = northern spring equinox. ASSUMPTION — the story lead may change this.
 */
export const DEMO_LS_DEG = 0;

// ---- Air temperature: measured by Perseverance's MEDA weather station at Jezero ----
// Source: Munguira, A., et al. (2023). Near Surface Atmospheric Temperatures at Jezero
// From Mars 2020 MEDA Measurements. JGR Planets 128, e2022JE007559,
// doi:10.1029/2022JE007559. Table 1, air temperature at 1.45 m above the ground,
// season Ls 25° (sols 34-40): Tmin 191 K, Tmax 243 K, time of Tmin 05:00 and time
// of Tmax 15:00, where each time is the start of a 30-minute window in local TRUE
// solar time (LTST).
// Ls 25° is the season closest to our demo season (Ls 0°) that the table lists. The
// paper says daily air temperatures "increased only slightly" over the first 280 sols.

/** True: the temperature minimum, maximum and their times are measured values. */
export const TEMP_IS_SOURCED = true;
/** Season the temperature values were measured in (areocentric solar longitude, degrees). */
export const TEMP_SOURCE_LS_DEG = 25;
/** Daily minimum air temperature at 1.45 m, kelvin (Munguira et al. 2023, Table 1). */
export const TEMP_MIN_K = 191;
/** Daily maximum air temperature at 1.45 m, kelvin (Munguira et al. 2023, Table 1). */
export const TEMP_MAX_K = 243;
/** Middle of the 05:00-05:30 LTST window in which the minimum falls (hours, true solar time). */
export const TEMP_MIN_LTST = 5.25;
/** Middle of the 15:00-15:30 LTST window in which the maximum falls (hours, true solar time). */
export const TEMP_MAX_LTST = 15.25;

const KELVIN_TO_C = -273.15;
/** Coldest air temperature of the sol, °C (191 K). */
export const TEMP_MIN_C = TEMP_MIN_K + KELVIN_TO_C;
/** Warmest air temperature of the sol, °C (243 K). */
export const TEMP_MAX_C = TEMP_MAX_K + KELVIN_TO_C;

const RAD = Math.PI / 180;
const sinDeg = (deg: number) => Math.sin(deg * RAD);
const cosDeg = (deg: number) => Math.cos(deg * RAD);
/** Contract 3: CAUTION when the sun is lower than this (degrees) at any time during the EVA. */
export const SUN_CAUTION_DEG = 10;

/** Wrap an hour value into [0, 24). */
const wrap24 = (hours: number) => ((hours % 24) + 24) % 24;

/**
 * Ls of perihelion. Mars24 B-5 gives Ls = αFMS + (ν − M), so the true anomaly is
 * ν = Ls − (αFMS − M). From B-1 and B-2, αFMS − M = 270.3871° − 19.3871° = 251.0°.
 */
const LS_PERIHELION_DEG = 270.3871 - 19.3871;

/**
 * Equation of center, ν − M, in degrees for mean anomaly M (Mars24 B-4).
 * SIMPLIFICATION: we fix the season (Ls), not a calendar date, so the two
 * date-dependent parts of B-4 are left out: the slow drift of the first
 * coefficient (3.0e-7° per day) and the planetary perturbation terms PBS (B-3,
 * at most about 0.02°).
 */
function equationOfCenterDeg(meanAnomalyDeg: number): number {
  return (
    10.691 * sinDeg(meanAnomalyDeg) +
    0.623 * sinDeg(2 * meanAnomalyDeg) +
    0.05 * sinDeg(3 * meanAnomalyDeg) +
    0.005 * sinDeg(4 * meanAnomalyDeg) +
    0.0005 * sinDeg(5 * meanAnomalyDeg)
  );
}

/**
 * Mars equation of time in degrees for a given Ls (Mars24 C-1):
 *   EOT = 2.861° sin 2Ls − 0.071° sin 4Ls + 0.002° sin 6Ls − (ν − M)
 * Divide by 15 to get hours. Mars24 starts from a date and works out M first;
 * we start from Ls, so we solve ν = M + (ν − M) for M by repeated substitution.
 */
export function equationOfTimeDeg(lsDeg: number): number {
  const trueAnomalyDeg = lsDeg - LS_PERIHELION_DEG;
  let meanAnomalyDeg = trueAnomalyDeg;
  for (let i = 0; i < 30; i++) {
    meanAnomalyDeg = trueAnomalyDeg - equationOfCenterDeg(meanAnomalyDeg);
  }
  return (
    2.861 * sinDeg(2 * lsDeg) -
    0.071 * sinDeg(4 * lsDeg) +
    0.002 * sinDeg(6 * lsDeg) -
    equationOfCenterDeg(meanAnomalyDeg)
  );
}

/**
 * Solar declination in degrees for a given Ls (Mars24 D-1):
 *   δs = arcsin(0.42565 sin Ls) + 0.25° sin Ls
 * 0.42565 is the sine of Mars's 25.19° obliquity; the second term is the small correction.
 */
export function solarDeclinationDeg(lsDeg: number): number {
  return Math.asin(0.42565 * sinDeg(lsDeg)) / RAD + 0.25 * sinDeg(lsDeg);
}

/**
 * Local true solar time from local mean solar time, both in hours (Mars24 C-4):
 *   LTST = LMST + EOT × (1 h / 15°)
 * True solar time is what a sundial shows: the sun is highest at LTST 12:00.
 */
export function lmstToLtst(lmstHours: number, lsDeg: number = DEMO_LS_DEG): number {
  return wrap24(lmstHours + equationOfTimeDeg(lsDeg) / 15);
}

/** The reverse of lmstToLtst. */
export function ltstToLmst(ltstHours: number, lsDeg: number = DEMO_LS_DEG): number {
  return wrap24(ltstHours - equationOfTimeDeg(lsDeg) / 15);
}

/**
 * Sun elevation above the horizon in degrees (negative = below the horizon).
 * Mars24 D-5 with the hour angle H = (LTST − 12 h) × 15°:
 *   elevation = asin(sin φ sin δs + cos φ cos δs cos H)
 * This is the geometric position of the sun's center; no refraction or terrain shadowing.
 */
export function sunElevationDeg(
  lmstHours: number,
  lsDeg: number = DEMO_LS_DEG,
  latDeg: number = SITE_LAT_DEG,
): number {
  return elevationDeg(lmstHours, equationOfTimeDeg(lsDeg), solarDeclinationDeg(lsDeg), latDeg);
}

function elevationDeg(lmstHours: number, eotDeg: number, declinationDeg: number, latDeg: number): number {
  const ltstHours = lmstHours + eotDeg / 15; // C-4
  const hourAngleDeg = (ltstHours - 12) * 15;
  const sinElevation =
    sinDeg(latDeg) * sinDeg(declinationDeg) + cosDeg(latDeg) * cosDeg(declinationDeg) * cosDeg(hourAngleDeg);
  return Math.asin(Math.max(-1, Math.min(1, sinElevation))) / RAD;
}

// The demo season is fixed, so work these out once instead of on every envAt call.
const DEMO_EOT_DEG = equationOfTimeDeg(DEMO_LS_DEG);
const DEMO_DECLINATION_DEG = solarDeclinationDeg(DEMO_LS_DEG);

/**
 * The measured times are in true solar time (they follow the sun). The app's clock
 * is local MEAN solar time, so they are converted with the demo season's equation of
 * time (Mars24 C-4). At Ls 0° that makes them about 41 minutes later on the LMST clock.
 */
export const TEMP_MIN_LMST = wrap24(TEMP_MIN_LTST - DEMO_EOT_DEG / 15);
export const TEMP_MAX_LMST = wrap24(TEMP_MAX_LTST - DEMO_EOT_DEG / 15);

/**
 * Air temperature in °C over the sol. The lowest and highest values and the times
 * they happen are measured (see the constants above). BETWEEN them the curve is our
 * own smooth interpolation (half a cosine up, half a cosine down): it passes through
 * the measured minimum and maximum and never leaves that range, but its exact shape
 * in between is an assumption.
 */
export function temperatureC(lmstHours: number): number {
  const sinceMin = wrap24(lmstHours - TEMP_MIN_LMST);
  const warmingHours = wrap24(TEMP_MAX_LMST - TEMP_MIN_LMST);
  // 0 → 1 while warming (min to max), then 1 → 0 while cooling (max back to min).
  const phase =
    sinceMin <= warmingHours
      ? (1 - Math.cos((Math.PI * sinceMin) / warmingHours)) / 2
      : (1 + Math.cos((Math.PI * (sinceMin - warmingHours)) / (24 - warmingHours))) / 2;
  return TEMP_MIN_C + (TEMP_MAX_C - TEMP_MIN_C) * phase;
}

/**
 * Radiation dose rate in mSv per (Earth) hour: the average surface dose equivalent
 * measured by Curiosity RAD (0.64 mSv, Hassler et al. 2014), spread evenly over the
 * sol. During a solar particle event it is multiplied by SPE_MULTIPLIER, which is
 * ILLUSTRATIVE (SPE_IS_ILLUSTRATIVE): the largest event RAD has measured raised the
 * dose equivalent rate by about 1.5 times, not 30.
 */
export function doseRateMsvPerHr(spe: boolean): number {
  return (DOSE_MSV_PER_SOL / SOL_HOURS) * (spe ? SPE_MULTIPLIER : 1);
}

/**
 * Conditions at a local mean solar time (hours, 0–24; values outside wrap around)
 * for the demo season at the site.
 */
export function envAt(
  lmstHours: number,
  spe: boolean,
): { sunElevationDeg: number; tempC: number; doseRateMsvPerHr: number } {
  const lmst = wrap24(lmstHours);
  return {
    sunElevationDeg: elevationDeg(lmst, DEMO_EOT_DEG, DEMO_DECLINATION_DEG, SITE_LAT_DEG),
    tempC: temperatureC(lmst),
    doseRateMsvPerHr: doseRateMsvPerHr(spe),
  };
}

/**
 * Sun elevation through an EVA: one sample every stepSec from tSec = 0 up to and
 * including durationSec. LMST wraps past 24.
 * tSec is in ordinary (Earth) seconds, like the rest of the planner. A sol is
 * SOL_HOURS Earth hours but 24 LMST hours, so the Mars clock runs slightly slower.
 */
export function sunElevationSeries(
  startLmst: number,
  durationSec: number,
  stepSec: number,
): { tSec: number; lmst: number; sunElevationDeg: number }[] {
  if (!(stepSec > 0)) throw new Error("sunElevationSeries: stepSec must be greater than 0");
  const lmstHoursPerSec = 24 / (SOL_HOURS * 3600);
  const series: { tSec: number; lmst: number; sunElevationDeg: number }[] = [];
  for (let i = 0; i * stepSec <= durationSec; i++) {
    const tSec = i * stepSec;
    const lmst = wrap24(startLmst + tSec * lmstHoursPerSec);
    series.push({
      tSec,
      lmst,
      sunElevationDeg: elevationDeg(lmst, DEMO_EOT_DEG, DEMO_DECLINATION_DEG, SITE_LAT_DEG),
    });
  }
  return series;
}

export type LowSun = {
  /** First moment the sun is below SUN_CAUTION_DEG: seconds into the EVA, clock time and elevation. */
  first: { tSec: number; lmst: number; sunElevationDeg: number };
  /** The lowest the sun gets during the EVA. */
  lowest: { tSec: number; lmst: number; sunElevationDeg: number };
};

/**
 * Checks the sun once a minute through an EVA that starts at startLmst and lasts
 * durationSec. Returns null if the sun stays at or above SUN_CAUTION_DEG the whole
 * time, otherwise when it first drops below and how low it gets.
 */
export function lowSunDuring(startLmst: number, durationSec: number): LowSun | null {
  if (!Number.isFinite(startLmst) || !Number.isFinite(durationSec) || durationSec < 0) return null;
  const stepSec = 60;
  // Round the duration up to a whole minute so the end of the EVA is checked too.
  const series = sunElevationSeries(startLmst, Math.ceil(durationSec / stepSec) * stepSec, stepSec);
  let first: LowSun["first"] | null = null;
  let lowest = series[0];
  for (const sample of series) {
    if (!first && sample.sunElevationDeg < SUN_CAUTION_DEG) first = sample;
    if (sample.sunElevationDeg < lowest.sunElevationDeg) lowest = sample;
  }
  return first ? { first, lowest } : null;
}
