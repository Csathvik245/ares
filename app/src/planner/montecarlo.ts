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

import { BASE_SPEED_KMH, SOL_HOURS, WALK_BURN, WORK_BURN } from "./constants";
import { oxygenBudget, oxygenUsedSec } from "./oxygen";
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
  /**
   * When NO trial failed: an upper limit on the true failure rate, 3 ÷ trials (the
   * "rule of three", a 95% bound; 0.003 for 1,000 trials). Zero failures in the
   * trials does not mean zero risk. null when at least one trial failed.
   */
  failureUpperBound95: number | null;
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
  /** Time of day on getting home, LMST hours (startLmst + EVA time; can pass 24). */
  returnLmst: Percentiles;
  /** Always show this sentence with the numbers. */
  disclaimer: string;
};

export type SimulateOptions = {
  /** Number of trials. Default 1000. */
  trials?: number;
  /** Seed for the random numbers. The same seed always gives the same result. Default 42. */
  seed?: number;
  /** EVA start time, LMST hours. Default 13. Only moves returnLmst, never the oxygen numbers. */
  startLmst?: number;
  /** Replace the uncertain parameters (default PARAMS). For tests and what-if studies. */
  params?: UncertainParam[];
};

const NO_SOURCE = "No source in docs/sources.md supports a range. Our assumption; not validated with astronauts or suit tests.";

/**
 * The uncertain parameters and the range each one is sampled from.
 * Every range is OUR ASSUMPTION (see docs/assumptions.md). None is astronaut-validated.
 * "triangular" means values near the nominal are the most likely.
 */
export const PARAMS: UncertainParam[] = [
  {
    name: "walkSpeed",
    label: "Walking speed",
    nominal: 1,
    distribution: "triangular",
    low: 0.85,
    high: 1.15,
    unit: `× planned speed (${BASE_SPEED_KMH} km/h on flat firm ground)`,
    evidence: "ASSUMED",
    source: `±15% on the whole walk: the astronaut is faster or slower than planned all day. ${NO_SOURCE}`,
  },
  {
    name: "terrainSpeed",
    label: "Terrain (per leg)",
    nominal: 1,
    distribution: "triangular",
    low: 0.9,
    high: 1.1,
    unit: "× planned speed, drawn separately for each leg",
    evidence: "ASSUMED",
    source: `±10% per leg: the ground on one leg is easier or harder than the 25 m terrain grid says. ${NO_SOURCE}`,
  },
  {
    name: "walkBurn",
    label: "Oxygen use while walking",
    nominal: WALK_BURN,
    distribution: "triangular",
    low: WALK_BURN * 0.8,
    high: WALK_BURN * 1.2,
    unit: "× nominal oxygen rate",
    evidence: "ASSUMED",
    source: `±20% around WALK_BURN, which is itself an assumption. ${NO_SOURCE}`,
  },
  {
    name: "workBurn",
    label: "Oxygen use during science",
    nominal: WORK_BURN,
    distribution: "triangular",
    low: WORK_BURN * 0.8,
    high: WORK_BURN * 1.2,
    unit: "× nominal oxygen rate",
    evidence: "ASSUMED",
    source: `±20% around WORK_BURN, which is itself an assumption. ${NO_SOURCE}`,
  },
  {
    name: "dwell",
    label: "Time at each stop",
    nominal: 0,
    distribution: "triangular",
    low: -5,
    high: 5,
    unit: "min added to each stop's planned science time, drawn separately for each stop",
    evidence: "ASSUMED",
    source: `±5 min per stop: sampling runs short or long. ${NO_SOURCE}`,
  },
];

/** mulberry32: a tiny seeded random number generator. Same seed, same numbers, on every machine. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One random value of a parameter. A zero-width range always gives the nominal value. */
function sample(p: UncertainParam, random: () => number): number {
  const u = random(); // always drawn, so every trial uses the same count of random numbers
  const span = p.high - p.low;
  if (!(span > 0)) return p.nominal;
  if (p.distribution === "uniform") return p.low + u * span;
  const mode = Math.min(p.high, Math.max(p.low, p.nominal));
  const split = (mode - p.low) / span;
  return u < split ? p.low + Math.sqrt(u * span * (mode - p.low)) : p.high - Math.sqrt((1 - u) * span * (p.high - mode));
}

/** Value at fraction q (0..1) of a sorted list, with straight-line interpolation. */
function quantile(sorted: Float64Array, q: number): number {
  if (sorted.length === 0) return NaN;
  const at = q * (sorted.length - 1);
  const lo = Math.floor(at);
  const hi = Math.min(sorted.length - 1, lo + 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo);
}
const percentiles = (values: Float64Array): Percentiles => {
  const sorted = Float64Array.from(values).sort();
  return { p5: quantile(sorted, 0.05), p50: quantile(sorted, 0.5), p95: quantile(sorted, 0.95) };
};

const HISTOGRAM_WIDTHS_MIN = [1, 2, 5, 10, 15, 20, 30, 60, 120, 240];
const HISTOGRAM_MAX_BINS = 24;

function histogram(marginMin: Float64Array): ReliabilityResult["histogramMarginMin"] {
  if (marginMin.length === 0) return { binStart: 0, binWidth: HISTOGRAM_WIDTHS_MIN[0], counts: [] };
  let min = Infinity;
  let max = -Infinity;
  for (const v of marginMin) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const last = HISTOGRAM_WIDTHS_MIN[HISTOGRAM_WIDTHS_MIN.length - 1];
  const binWidth = HISTOGRAM_WIDTHS_MIN.find((w) => Math.floor(max / w) - Math.floor(min / w) + 1 <= HISTOGRAM_MAX_BINS) ?? last;
  const first = Math.floor(min / binWidth);
  const counts = new Array<number>(Math.floor(max / binWidth) - first + 1).fill(0);
  for (const v of marginMin) counts[Math.floor(v / binWidth) - first]++;
  return { binStart: first * binWidth, binWidth, counts };
}

/** What the plan's own timeline says: walking time of each leg and science time at each stop, seconds. */
function timelineOf(plan: Plan): { legWalkSec: number[]; dwellSec: number[] } {
  const legWalkSec = plan.legs.map((leg) => leg.walkSec);
  const dwellSec: number[] = [];
  for (let i = 0; i + 1 < plan.legs.length; i++) {
    const next = plan.legs[i + 1];
    // Same reading as positionAt: science fills the gap between arriving and the next leg starting.
    dwellSec.push(Math.max(0, next.arriveSec - next.walkSec - plan.legs[i].arriveSec));
  }
  return { legWalkSec, dwellSec };
}

type Draw = {
  walkSpeed: number;
  /** One per leg. */
  terrainSpeed: number[];
  walkBurn: number;
  workBurn: number;
  /** Minutes added to each stop, one per stop. */
  dwell: number[];
};

/** One run of the fixed route with the given parameter values. */
function runOnce(timeline: ReturnType<typeof timelineOf>, d: Draw): { durationSec: number; usedSec: number } {
  let walkSec = 0;
  for (let i = 0; i < timeline.legWalkSec.length; i++) {
    const speed = d.walkSpeed * d.terrainSpeed[i];
    walkSec += timeline.legWalkSec[i] / (speed > 0 ? speed : 1e-6);
  }
  let scienceSec = 0;
  // A stop with no planned science time stays at zero: nothing was planned there.
  for (let i = 0; i < timeline.dwellSec.length; i++) {
    scienceSec += timeline.dwellSec[i] > 0 ? Math.max(0, timeline.dwellSec[i] + d.dwell[i] * 60) : 0;
  }
  return { durationSec: walkSec + scienceSec, usedSec: oxygenUsedSec(walkSec, scienceSec, d.walkBurn, d.workBurn) };
}

/**
 * Run `trials` randomised copies of the plan and report how often it ends safely.
 *
 * - The route is FIXED: the legs of `plan` are walked as planned, with no new path
 *   search. Only the timeline and the oxygen sum are redone, with each PARAMS value
 *   drawn at random (walking speed and burn rates once per trial, terrain once per
 *   leg, science time once per stop).
 * - Success = home with at least the reserve left (margin ≥ 0). "Returned at all" =
 *   home before the full supply ran out.
 * - The reserve is the calm-weather reserve (RESERVE_MIN): the plan is simulated as planned.
 * - A plan with an unreachable stop (plan.ok false) cannot be walked: both
 *   probabilities are 0 and the percentiles are NaN.
 * - sensitivity: each parameter alone at its low, then high value (all legs/stops
 *   together for the per-leg and per-stop ones), everything else nominal.
 * - `site` is not read today; it is in the signature so terrain-aware sampling can be added.
 */
export function simulateMission(_site: Site, plan: Plan, options: SimulateOptions = {}): ReliabilityResult {
  const requested = options.trials ?? DEFAULT_TRIALS;
  const trials = Number.isFinite(requested) ? Math.min(100_000, Math.max(1, Math.floor(requested))) : DEFAULT_TRIALS;
  const seed = Number.isFinite(options.seed) ? Math.floor(options.seed!) : DEFAULT_SEED;
  const startLmst = Number.isFinite(options.startLmst) ? options.startLmst! : 13;
  const params = options.params ?? PARAMS;
  const none: Percentiles = { p5: NaN, p50: NaN, p95: NaN };

  if (!plan.ok) {
    return {
      trials,
      seed,
      startLmst,
      successCount: 0,
      failCount: trials,
      pReturnWithReserve: 0,
      pReturnAtAll: 0,
      failureUpperBound95: null,
      oxygenAtReturnPct: none,
      durationMin: none,
      marginMin: none,
      histogramMarginMin: histogram(new Float64Array(0)),
      sensitivity: [],
      returnLmst: none,
      disclaimer: MONTE_CARLO_DISCLAIMER,
    };
  }

  const timeline = timelineOf(plan);
  const legCount = timeline.legWalkSec.length;
  const stopCount = timeline.dwellSec.length;
  const { budgetSec, usableSec } = oxygenBudget(false);
  const spec = (name: ParamName): UncertainParam => params.find((p) => p.name === name) ?? PARAMS.find((p) => p.name === name)!;
  const walkSpeed = spec("walkSpeed");
  const terrainSpeed = spec("terrainSpeed");
  const walkBurn = spec("walkBurn");
  const workBurn = spec("workBurn");
  const dwell = spec("dwell");

  const marginMin = new Float64Array(trials);
  const durationMin = new Float64Array(trials);
  const oxygenPct = new Float64Array(trials);
  const returnLmst = new Float64Array(trials);
  let successCount = 0;
  let returnedCount = 0;
  const random = mulberry32(seed);
  const draw: Draw = {
    walkSpeed: 1,
    terrainSpeed: new Array<number>(legCount).fill(1),
    walkBurn: WALK_BURN,
    workBurn: WORK_BURN,
    dwell: new Array<number>(stopCount).fill(0),
  };
  for (let t = 0; t < trials; t++) {
    draw.walkSpeed = sample(walkSpeed, random);
    draw.walkBurn = sample(walkBurn, random);
    draw.workBurn = sample(workBurn, random);
    for (let i = 0; i < legCount; i++) draw.terrainSpeed[i] = sample(terrainSpeed, random);
    for (let i = 0; i < stopCount; i++) draw.dwell[i] = sample(dwell, random);
    const { durationSec, usedSec } = runOnce(timeline, draw);
    const marginSec = usableSec - usedSec;
    if (marginSec >= 0) successCount++;
    if (usedSec <= budgetSec) returnedCount++;
    marginMin[t] = marginSec / 60;
    durationMin[t] = durationSec / 60;
    oxygenPct[t] = Math.max(0, ((budgetSec - usedSec) / budgetSec) * 100);
    returnLmst[t] = startLmst + ((durationSec / 3600) * 24) / SOL_HOURS;
  }

  // One-at-a-time sensitivity.
  const nominal = (): Draw => ({
    walkSpeed: walkSpeed.nominal,
    terrainSpeed: new Array<number>(legCount).fill(terrainSpeed.nominal),
    walkBurn: walkBurn.nominal,
    workBurn: workBurn.nominal,
    dwell: new Array<number>(stopCount).fill(dwell.nominal),
  });
  const marginWith = (name: ParamName, value: number): number => {
    const d = nominal();
    if (name === "terrainSpeed") d.terrainSpeed.fill(value);
    else if (name === "dwell") d.dwell.fill(value);
    else d[name] = value;
    return (usableSec - runOnce(timeline, d).usedSec) / 60;
  };
  const sensitivity: SensitivityRow[] = [walkSpeed, terrainSpeed, walkBurn, workBurn, dwell]
    .map((p) => {
      const lowMarginMin = marginWith(p.name, p.low);
      const highMarginMin = marginWith(p.name, p.high);
      return { param: p.name, label: p.label, lowMarginMin, highMarginMin, swingMin: Math.abs(highMarginMin - lowMarginMin) };
    })
    .sort((a, b) => b.swingMin - a.swingMin);

  return {
    trials,
    seed,
    startLmst,
    successCount,
    failCount: trials - successCount,
    pReturnWithReserve: successCount / trials,
    pReturnAtAll: returnedCount / trials,
    failureUpperBound95: successCount === trials ? 3 / trials : null,
    oxygenAtReturnPct: percentiles(oxygenPct),
    durationMin: percentiles(durationMin),
    marginMin: percentiles(marginMin),
    histogramMarginMin: histogram(marginMin),
    sensitivity,
    returnLmst: percentiles(returnLmst),
    disclaimer: MONTE_CARLO_DISCLAIMER,
  };
}
