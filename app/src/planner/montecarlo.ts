// Monte Carlo mission simulator: how robust is a plan if our assumptions are a bit off?
//
// The planned route is kept fixed (no new path search). Each trial re-runs the plan's
// timeline and oxygen sum with sampled values for the uncertain parameters in PARAMS,
// then counts how often the astronaut is home with the oxygen reserve intact.
//
// This is a simulation of OUR OWN assumptions, not a measured mission success rate.
// Always show `disclaimer` next to any of these numbers.
//
// Pure functions, no UI code. Import from "../planner/montecarlo".

import type { Plan, Site } from "./types";

export const MONTE_CARLO_DISCLAIMER =
  "Model-based simulation of our own assumptions, not an empirical mission success probability.";

export const DEFAULT_TRIALS = 1000;
export const DEFAULT_SEED = 42;

/** How sure we are of a number: only OBSERVED and CALCULATED come from data. */
export type Evidence = "ASSUMED" | "CALCULATED" | "OBSERVED" | "INTERPRETED";

export type ParamName = "walkSpeed" | "terrainSpeed" | "walkBurn" | "workBurn" | "dwell";

export type UncertainParam = {
  name: ParamName;
  /** Short label for charts, e.g. "Walking speed". */
  label: string;
  /** The value the deterministic plan uses. */
  nominal: number;
  /** "triangular" peaks at the nominal value; "uniform" is flat between low and high. */
  distribution: "triangular" | "uniform";
  low: number;
  high: number;
  unit: string;
  evidence: Evidence;
  source: string;
};

export type Percentiles = { p5: number; p50: number; p95: number };

export type SensitivityRow = {
  param: ParamName;
  label: string;
  /** Oxygen margin (minutes) with this parameter at its low value, all others nominal. */
  lowMarginMin: number;
  /** Oxygen margin (minutes) with this parameter at its high value, all others nominal. */
  highMarginMin: number;
  /** |highMarginMin − lowMarginMin|, minutes. */
  swingMin: number;
};

export type ReliabilityResult = {
  trials: number;
  seed: number;
  /** EVA start time used for returnLmst, LMST hours. */
  startLmst: number;
  /** Trials that got home with at least the oxygen reserve left. */
  successCount: number;
  failCount: number;
  /** successCount ÷ trials, 0 to 1. */
  pReturnWithReserve: number;
  /** Share of trials that got home before the oxygen ran out (reserve used or not), 0 to 1. */
  pReturnAtAll: number;
  /** Oxygen left at return, % of the full supply (0 if it ran out). */
  oxygenAtReturnPct: Percentiles;
  /** Total EVA time, minutes. */
  durationMin: Percentiles;
  /** Oxygen margin above the reserve at return, minutes (negative = into the reserve). */
  marginMin: Percentiles;
  /** Counts of trials by oxygen margin: bin k covers binStart + k × binWidth up to the next bin. */
  histogramMarginMin: { binStart: number; binWidth: number; counts: number[] };
  /** One row per uncertain parameter, biggest swing first. */
  sensitivity: SensitivityRow[];
  /** Always show this sentence with the numbers. */
  disclaimer: string;
};

export type SimulateOptions = {
  /** Number of trials. Default 1000. */
  trials?: number;
  /** Seed for the random numbers. The same seed always gives the same result. Default 42. */
  seed?: number;
  /** EVA start time, LMST hours. Default 13. */
  startLmst?: number;
  /** Replace the uncertain parameters (default PARAMS). For tests and what-if studies. */
  params?: UncertainParam[];
};

/** The uncertain parameters. Filled in with documented ranges in the next commit. */
export const PARAMS: UncertainParam[] = [];

/**
 * Run `trials` randomised copies of the plan and report how often it ends safely.
 * STUB: returns an empty result for now, so the frontend can build against the types.
 */
export function simulateMission(_site: Site, _plan: Plan, options: SimulateOptions = {}): ReliabilityResult {
  const none: Percentiles = { p5: NaN, p50: NaN, p95: NaN };
  return {
    trials: 0,
    seed: options.seed ?? DEFAULT_SEED,
    startLmst: options.startLmst ?? 13,
    successCount: 0,
    failCount: 0,
    pReturnWithReserve: NaN,
    pReturnAtAll: NaN,
    oxygenAtReturnPct: none,
    durationMin: none,
    marginMin: none,
    histogramMarginMin: { binStart: 0, binWidth: 10, counts: [] },
    sensitivity: [],
    disclaimer: MONTE_CARLO_DISCLAIMER,
  };
}
