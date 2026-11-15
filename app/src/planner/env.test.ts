import { describe, expect, it } from "vitest";
import { SPEED_TEST, cpuNow } from "../test-utils/cpuClock";
import { DOSE_MSV_PER_SOL, SOL_HOURS, SPE_IS_ILLUSTRATIVE, SPE_MEASURED_2017_PEAK_MULTIPLIER, SPE_MULTIPLIER } from "./constants";
import {
  DEMO_LS_DEG,
  SITE_LAT_DEG,
  TEMP_IS_SOURCED,
  TEMP_MAX_C,
  TEMP_MAX_K,
  TEMP_MAX_LMST,
  TEMP_MAX_LTST,
  TEMP_MIN_C,
  TEMP_MIN_K,
  TEMP_MIN_LMST,
  TEMP_MIN_LTST,
  TEMP_SOURCE_LS_DEG,
  envAt,
  equationOfTimeDeg,
  lmstToLtst,
  ltstToLmst,
  solarDeclinationDeg,
  sunElevationDeg,
  sunElevationSeries,
  temperatureC,
} from "./env";

const clock = (hours: number) => {
  const totalMin = Math.round(hours * 60);
  return `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
};

/** LMST (hours) where the sun crosses the horizon between two times, by bisection. */
function horizonCrossing(fromLmst: number, toLmst: number): number {
  let lo = fromLmst;
  let hi = toLmst;
  const risingAtLo = envAt(lo, false).sunElevationDeg < 0;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (envAt(mid, false).sunElevationDeg < 0 === risingAtLo) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

describe("Mars24 sun model", () => {
  it("is set up for the demo: Ls 0 at 18.45° N", () => {
    expect(DEMO_LS_DEG).toBe(0);
    expect(SITE_LAT_DEG).toBe(18.45);
  });

  it("matches the equation of time in the Mars24 worked examples", () => {
    // NASA GISS Mars24 "Algorithm and Worked Examples": EOT −5.18774° at Ls 277.18758°
    // and −12.77553° at Ls 327.32416°. We leave out the small date-dependent terms,
    // so allow 0.05° (12 seconds of time).
    expect(Math.abs(equationOfTimeDeg(277.18758) - -5.18774)).toBeLessThan(0.05);
    expect(Math.abs(equationOfTimeDeg(327.32416) - -12.77553)).toBeLessThan(0.05);
  });

  it("solar declination follows the seasons (Mars24 D-1)", () => {
    expect(solarDeclinationDeg(0)).toBeCloseTo(0, 10);
    expect(solarDeclinationDeg(180)).toBeCloseTo(0, 10);
    expect(solarDeclinationDeg(90)).toBeCloseTo(25.19 + 0.25, 2); // northern summer solstice
    expect(solarDeclinationDeg(270)).toBeCloseTo(-(25.19 + 0.25), 2);
  });

  it("at Ls 0 and true-solar noon the sun is about 71.5° up", () => {
    const noonLmst = ltstToLmst(12);
    expect(lmstToLtst(noonLmst)).toBeCloseTo(12, 9);
    const noon = envAt(noonLmst, false).sunElevationDeg;
    expect(Math.abs(noon - 71.5)).toBeLessThan(1);
    expect(noon).toBeCloseTo(90 - SITE_LAT_DEG, 6); // declination is 0 at the equinox
    // True-solar noon is the highest point of the day.
    expect(noon).toBeGreaterThan(envAt(noonLmst - 0.25, false).sunElevationDeg);
    expect(noon).toBeGreaterThan(envAt(noonLmst + 0.25, false).sunElevationDeg);
    expect(sunElevationDeg(noonLmst)).toBeCloseTo(noon, 12);
  });

  it("the sun is below the horizon at midnight and above it at noon", () => {
    expect(envAt(0, false).sunElevationDeg).toBeLessThan(0);
    expect(envAt(24, false).sunElevationDeg).toBeCloseTo(envAt(0, false).sunElevationDeg, 9);
    expect(envAt(12, false).sunElevationDeg).toBeGreaterThan(0);
  });

  it("sunrise is at about 06:00 true solar time, which is about 06:41 LMST at Ls 0", () => {
    const sunriseLmst = horizonCrossing(3, 12);
    const sunsetLmst = horizonCrossing(13, 23);
    const sunriseLtst = lmstToLtst(sunriseLmst);
    const sunsetLtst = lmstToLtst(sunsetLmst);

    // In true solar time, sunrise falls between 05:30 and 06:30 (06:00 at the equinox).
    expect(sunriseLtst).toBeGreaterThan(5.5);
    expect(sunriseLtst).toBeLessThan(6.5);
    expect(sunriseLtst).toBeCloseTo(6, 6);
    expect(sunsetLtst).toBeCloseTo(18, 6);

    // On the LMST clock everything is later by the equation of time (about 41 min at Ls 0).
    const shiftHours = -equationOfTimeDeg(DEMO_LS_DEG) / 15;
    expect(shiftHours).toBeGreaterThan(0.65);
    expect(shiftHours).toBeLessThan(0.72);
    expect(sunriseLmst).toBeCloseTo(6 + shiftHours, 6);
    expect(sunriseLmst).toBeGreaterThan(6.5);
    expect(sunriseLmst).toBeLessThan(7);
    expect(sunsetLmst).toBeCloseTo(18 + shiftHours, 6);

    console.log(
      `Ls ${DEMO_LS_DEG}, lat ${SITE_LAT_DEG} N: equation of time ${(equationOfTimeDeg(DEMO_LS_DEG) * 4).toFixed(1)} min; ` +
        `noon elevation ${envAt(ltstToLmst(12), false).sunElevationDeg.toFixed(2)}° at ${clock(ltstToLmst(12))} LMST; ` +
        `sunrise ${clock(sunriseLmst)} LMST (${clock(sunriseLtst)} LTST), sunset ${clock(sunsetLmst)} LMST (${clock(sunsetLtst)} LTST); ` +
        `elevation at 12:00 LMST ${envAt(12, false).sunElevationDeg.toFixed(2)}°`,
    );
  });
});

describe("temperature (Perseverance MEDA: Munguira et al. 2023, Table 1)", () => {
  it("uses the measured minimum and maximum, flagged as sourced", () => {
    expect(TEMP_IS_SOURCED).toBe(true);
    expect(TEMP_SOURCE_LS_DEG).toBe(25);
    expect(TEMP_MIN_K).toBe(191);
    expect(TEMP_MAX_K).toBe(243);
    expect(TEMP_MIN_C).toBeCloseTo(-82.15, 9);
    expect(TEMP_MAX_C).toBeCloseTo(-30.15, 9);
    expect(TEMP_MAX_K - TEMP_MIN_K).toBe(52); // the table's daily range at 1.45 m
  });

  it("puts them at the measured true-solar times, converted to the LMST clock", () => {
    // Table 1: minimum in the 05:00-05:30 window, maximum in the 15:00-15:30 window (LTST).
    expect(TEMP_MIN_LTST).toBe(5.25);
    expect(TEMP_MAX_LTST).toBe(15.25);
    expect(lmstToLtst(TEMP_MIN_LMST)).toBeCloseTo(TEMP_MIN_LTST, 9);
    expect(lmstToLtst(TEMP_MAX_LMST)).toBeCloseTo(TEMP_MAX_LTST, 9);
    // At Ls 0 the LMST clock runs about 41 min ahead of true solar time.
    expect(TEMP_MIN_LMST - TEMP_MIN_LTST).toBeCloseTo(0.69, 1);
    expect(envAt(TEMP_MIN_LMST, false).tempC).toBeCloseTo(TEMP_MIN_C, 9);
    expect(envAt(TEMP_MAX_LMST, false).tempC).toBeCloseTo(TEMP_MAX_C, 9);
  });

  it("the coldest moment is before sunrise and the warmest is mid-afternoon", () => {
    expect(envAt(TEMP_MIN_LMST, false).sunElevationDeg).toBeLessThan(0);
    expect(envAt(TEMP_MAX_LMST, false).sunElevationDeg).toBeGreaterThan(20);
  });

  it("stays between the minimum and maximum, and is smooth across midnight", () => {
    let coldest = { lmst: 0, tempC: Infinity };
    let warmest = { lmst: 0, tempC: -Infinity };
    let biggestStep = 0;
    for (let i = 0; i <= 24 * 60; i++) {
      const lmst = i / 60;
      const tempC = temperatureC(lmst);
      expect(tempC).toBeGreaterThanOrEqual(TEMP_MIN_C - 1e-9);
      expect(tempC).toBeLessThanOrEqual(TEMP_MAX_C + 1e-9);
      if (tempC < coldest.tempC) coldest = { lmst, tempC };
      if (tempC > warmest.tempC) warmest = { lmst, tempC };
      if (i > 0) biggestStep = Math.max(biggestStep, Math.abs(tempC - temperatureC((i - 1) / 60)));
    }
    // Sampled once a minute, so the extremes are found to within a minute.
    expect(Math.abs(coldest.lmst - TEMP_MIN_LMST)).toBeLessThan(1 / 60);
    expect(Math.abs(warmest.lmst - TEMP_MAX_LMST)).toBeLessThan(1 / 60);
    expect(biggestStep).toBeLessThan(0.25); // no jumps: under 0.25 °C per minute
    expect(temperatureC(24)).toBeCloseTo(temperatureC(0), 9);
  });
});

describe("radiation dose rate", () => {
  it("uses the published RAD surface value: 0.64 mSv (Hassler et al. 2014, Table 1)", () => {
    expect(DOSE_MSV_PER_SOL).toBe(0.64);
    // 0.64 mSv over a 24.66 h sol is about 0.026 mSv per hour.
    expect(envAt(12, false).doseRateMsvPerHr).toBeCloseTo(0.02595, 5);
  });

  it("flags the SPE multiplier as illustrative and keeps the measured value beside it", () => {
    expect(SPE_IS_ILLUSTRATIVE).toBe(true);
    expect(SPE_MULTIPLIER).toBe(30);
    // September 2017, the largest event RAD has measured on the surface (Zeitlin et al. 2018, Table I):
    // peak dose equivalent 841 vs 543 µSv/day before the event, "about 50% greater".
    expect(SPE_MEASURED_2017_PEAK_MULTIPLIER).toBe(1.5);
    expect(841 / 543).toBeCloseTo(SPE_MEASURED_2017_PEAK_MULTIPLIER, 1);
    expect(SPE_MULTIPLIER).toBeGreaterThan(SPE_MEASURED_2017_PEAK_MULTIPLIER);
  });

  it("is exactly SPE_MULTIPLIER times higher during a solar particle event", () => {
    const quiet = envAt(10, false).doseRateMsvPerHr;
    expect(envAt(10, true).doseRateMsvPerHr).toBe(quiet * SPE_MULTIPLIER);
    expect(envAt(3, false).doseRateMsvPerHr).toBe(quiet); // same at any time of day
  });

  it("adds up to 0.64 mSv over one sol (24.66 h)", () => {
    expect(envAt(0, false).doseRateMsvPerHr * SOL_HOURS).toBeCloseTo(DOSE_MSV_PER_SOL, 12);
    // Same thing summed minute by minute across the sol.
    const minutes = Math.round(SOL_HOURS * 60);
    let total = 0;
    for (let i = 0; i < minutes; i++) total += envAt((i / minutes) * 24, false).doseRateMsvPerHr * (SOL_HOURS / minutes);
    expect(total).toBeCloseTo(0.64, 9);
  });
});

describe("sunElevationSeries", () => {
  it("samples from 0 to the duration and wraps LMST past 24", () => {
    const series = sunElevationSeries(22, 4 * 3600, 600);
    expect(series).toHaveLength(25);
    expect(series[0]).toMatchObject({ tSec: 0, lmst: 22 });
    expect(series[24].tSec).toBe(4 * 3600);
    for (const sample of series) {
      expect(sample.lmst).toBeGreaterThanOrEqual(0);
      expect(sample.lmst).toBeLessThan(24);
      expect(sample.sunElevationDeg).toBeCloseTo(envAt(sample.lmst, false).sunElevationDeg, 12);
    }
    // 4 Earth hours is a little under 4 Mars hours: 22:00 + 4 h × 24 / 24.66 = 01:54 LMST.
    expect(series[24].lmst).toBeCloseTo(22 + (4 * 24) / SOL_HOURS - 24, 9);
  });

  it("one full sol brings the clock back to where it started", () => {
    const series = sunElevationSeries(9, SOL_HOURS * 3600, SOL_HOURS * 3600);
    expect(series).toHaveLength(2);
    expect(series[1].lmst).toBeCloseTo(9, 6);
  });

  it("rejects a step of zero", () => {
    expect(() => sunElevationSeries(9, 3600, 0)).toThrow();
  });
});

describe("performance", () => {
  it("envAt takes well under 1 ms", SPEED_TEST, () => {
    envAt(12, false); // warm-up
    const t0 = cpuNow();
    envAt(9.37, true);
    const single = cpuNow() - t0;
    expect(single).toBeLessThan(1);

    const calls = 100_000;
    const t1 = cpuNow();
    let sink = 0;
    for (let i = 0; i < calls; i++) sink += envAt((i % 2400) / 100, i % 2 === 0).sunElevationDeg;
    const perCallMs = (cpuNow() - t1) / calls;
    expect(Number.isFinite(sink)).toBe(true);
    expect(perCallMs).toBeLessThan(1);
    console.log(`envAt: ${(perCallMs * 1e6).toFixed(0)} ns per call (single call ${(single * 1000).toFixed(1)} µs)`);
  });
});
