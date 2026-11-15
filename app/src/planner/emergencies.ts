// Three more emergencies that change the plan itself, not just show an alert:
//
//   "oxygen-loss"   part of the oxygen left is lost at one moment (a leak)
//   "blocked-path"  ground near a point becomes impassable (rockfall, collapse)
//   "slow-walk"     from one moment on, the astronaut walks slower (fatigue, suit problem)
//
// Each one re-plans from where the astronaut is at that moment: the stops still
// ahead, then home. If they no longer fit with the oxygen reserve, stops are
// dropped from the end until they do; if none fit, the EVA is aborted and the
// astronaut walks straight home (abortRoute). The outcome has the same shape as
// stormAt's, so the UI can show it the same way. Pure functions, no UI code.
//
// There is no rover model, so there is no rover-breakdown scenario.

import { abortRoute } from "./abort";
import { CONSUMABLE_HOURS, RESERVE_MIN, WALK_BURN } from "./constants";
import { formatMet, roundHalfUp } from "./format";
import { distanceM } from "./geom";
import { oxygenBudget } from "./oxygen";
import { planRoute } from "./plan";
import { cellCenter, cellIndexOf } from "./site";
import { DEFAULT_START_LMST, emergencyGrid, stopsOf } from "./storm";
import type { ReturnRoute, StormOutcome } from "./storm";
import { positionAt } from "./timeline";
import type { CostGrid, LatLng, Plan, Site, Status, Stop } from "./types";

export type ScenarioKind = "oxygen-loss" | "blocked-path" | "slow-walk";

/** Default share of the oxygen left that is lost in "oxygen-loss" (ASSUMPTION, illustrative). */
export const DEFAULT_OXYGEN_LOSS_FRACTION = 0.25;
/** Default radius of the impassable area in "blocked-path", meters (ASSUMPTION, illustrative). */
export const DEFAULT_BLOCK_RADIUS_M = 75;
/** Default walking-speed multiplier in "slow-walk" (ASSUMPTION, illustrative). */
export const DEFAULT_SLOW_WALK_FACTOR = 0.7;

/**
 * Continuing with stops is only recommended if it leaves at least this much oxygen margin
 * above the reserve: one more reserve's worth (RESERVE_MIN). ASSUMPTION, our safety rule.
 */
export const SAFE_CONTINUE_MARGIN_MIN = RESERVE_MIN;
/**
 * When stops already had to be dropped, continuing is only recommended if it keeps at
 * least this share of the margin that going straight home would give. ASSUMPTION.
 */
export const MIN_SHARE_OF_HOME_MARGIN = 0.5;

/** What ARES recommends after re-planning. */
export type Recommendation = "continue" | "return home";

/** The option that was NOT recommended: carrying on with some stops. */
export type ScenarioAlternative = {
  /** Stops this option would still visit, in order. */
  stops: Stop[];
  /** Oxygen margin above the reserve on reaching the habitat this way, seconds. */
  marginSec: number;
  /** EVA status this option would have (GO or CAUTION). */
  status: Status;
  /** Mission elapsed time on reaching the habitat this way, seconds. */
  endSec: number;
  /** The plan for this option, from the astronaut's position (times start at the emergency). */
  route: Plan;
};

export type ScenarioOptions = {
  /** EVA start time, LMST hours (for the low-sun check). Default 13, as in stormAt. */
  startLmst?: number;
  /**
   * The stops the plan was built from, in order. Used to name dropped stops with
   * their real id and label. Default: read back from the plan ("Stop 1", ...).
   */
  stops?: Stop[];
  /** oxygen-loss: share of the oxygen left that is lost, 0 to 1. Default 0.25. */
  lossFraction?: number;
  /** blocked-path: centre of the impassable area. Default: middle of the next stretch of walking on the plan. */
  blockAt?: LatLng;
  /** blocked-path: radius of the impassable area, meters. Default 75. */
  blockRadiusM?: number;
  /** slow-walk: walking-speed multiplier from tSec on, above 0 and at most 1. Default 0.7. */
  speedFactor?: number;
};

/** The plan's state before or after the emergency. */
export type ScenarioSnapshot = {
  /** Oxygen margin above the reserve on reaching the habitat, seconds. −Infinity if home cannot be reached. */
  marginSec: number;
  /** Stops still ahead (before) or kept (after). */
  stopCount: number;
  /** Mission elapsed time on reaching the habitat, seconds. Infinity if unreachable. */
  endSec: number;
  /** EVA status. */
  status: Status;
};

export type ScenarioOutcome = StormOutcome & {
  kind: ScenarioKind;
  /**
   * "continue": carry on with keptStops (or nothing was ahead). "return home": the EVA is
   * aborted and the route is the walk home, because no stop fits, or because carrying on
   * would leave too little margin compared with going straight home (see `alternative`).
   */
  recommendation: Recommendation;
  /**
   * Set only when carrying on was possible but ARES recommends going home instead:
   * the riskier "continue" option, with its margin and status. null otherwise.
   */
  alternative: ScenarioAlternative | null;
  /** True when the recommendation is to return home with stops still ahead, or the way home fails: the EVA is aborted (EVA NO-GO). */
  aborted: boolean;
  /**
   * The new plan from the astronaut's position: kept stops, then the habitat.
   * Its times start at the emergency (0 = tSec), so the timeline position at mission
   * time t is positionAt(route, t − startSec). oxygenUsedSec and marginSec include
   * the oxygen used (and lost) before the emergency. When aborted, it is the walk home.
   */
  route: Plan;
  /** Mission elapsed time where `route` starts (= tSec, clamped to the plan). */
  startSec: number;
  /** Stops still ahead that the new route keeps, in order. */
  keptStops: Stop[];
  /** Stops still ahead that were dropped, in order. */
  droppedStops: Stop[];
  /** The old plan from this moment on: the same stops ahead, re-planned from the same position with no emergency. */
  before: ScenarioSnapshot;
  /** The new course (route, or the walk home when aborted). */
  after: ScenarioSnapshot;
  /** blocked-path only: the impassable area. */
  blocked?: { at: LatLng; radiusM: number; cellCount: number };
};

const minutes = (sec: number) => Math.round(sec / 60);

// Derived grids are new CostGrid objects (never edit secPerM in place), cached per base
// grid so dragging the emergency time reuses their walk-home fields.
const MAX_DERIVED_PER_GRID = 4;
const derivedCache = new WeakMap<CostGrid, Map<string, CostGrid>>();
function derived(base: CostGrid, key: string, make: () => CostGrid): CostGrid {
  let perBase = derivedCache.get(base);
  if (!perBase) derivedCache.set(base, (perBase = new Map()));
  let grid = perBase.get(key);
  if (!grid) {
    grid = make();
    perBase.set(key, grid);
    if (perBase.size > MAX_DERIVED_PER_GRID) perBase.delete(perBase.keys().next().value!);
  }
  return grid;
}

/** A copy of `base` where walking is `factor` times as fast (factor 0.7 → each meter takes 1/0.7 as long). */
export function slowedGrid(base: CostGrid, factor: number): CostGrid {
  return derived(base, `slow:${factor}`, () => {
    const secPerM = new Float32Array(base.secPerM.length);
    for (let i = 0; i < secPerM.length; i++) secPerM[i] = base.secPerM[i] / factor;
    let minSecPerM = Infinity;
    for (let i = 0; i < secPerM.length; i++) if (secPerM[i] < minSecPerM) minSecPerM = secPerM[i];
    return { ...base, cellSizeM: { ...base.cellSizeM }, secPerM, minSecPerM, conditions: { ...base.conditions } };
  });
}

/**
 * A copy of `base` where every cell whose centre is within `radiusM` of `at` is
 * no-go. Cells in `keep` (the astronaut's own cell, the habitat) stay as they were,
 * so nobody is "standing on" a no-go cell. Returns the grid and how many cells were blocked.
 */
export function blockedGrid(
  site: Site,
  base: CostGrid,
  at: LatLng,
  radiusM: number,
  keep: number[] = [],
): { grid: CostGrid; cellCount: number } {
  const counts = blockedCounts;
  const grid = derived(base, `block:${at.lat},${at.lng},${radiusM},${keep.join(",")}`, () => {
    const secPerM = new Float32Array(base.secPerM);
    let count = 0;
    // Only the cells in the circle's bounding box can be inside it (one extra cell of margin).
    const { south, north, west, east } = site.bounds;
    const row = Math.floor(((north - at.lat) / (north - south)) * site.height);
    const col = Math.floor(((at.lng - west) / (east - west)) * site.width);
    const dRow = Math.ceil(radiusM / site.cellSizeM.y) + 1;
    const dCol = Math.ceil(radiusM / site.cellSizeM.x) + 1;
    for (let r = Math.max(0, row - dRow); r <= Math.min(site.height - 1, row + dRow); r++) {
      for (let c = Math.max(0, col - dCol); c <= Math.min(site.width - 1, col + dCol); c++) {
        const i = r * site.width + c;
        if (keep.includes(i) || secPerM[i] === Infinity) continue;
        if (distanceM(cellCenter(site, i), at) <= radiusM) {
          secPerM[i] = Infinity;
          count++;
        }
      }
    }
    // minSecPerM stays a valid lower bound for the A* heuristic (no cell got faster).
    const made: CostGrid = { ...base, cellSizeM: { ...base.cellSizeM }, secPerM, conditions: { ...base.conditions } };
    counts.set(made, count);
    return made;
  });
  return { grid, cellCount: counts.get(grid) ?? 0 };
}

const blockedCounts = new WeakMap<CostGrid, number>();

/** Clamp a number into [lo, hi]; a missing or broken value gives `fallback`. */
function option(value: number | undefined, fallback: number, lo: number, hi: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(Math.max(value, lo), hi) : fallback;
}

/** Default block centre: the middle of the stretch of walking that is happening now, or the next one. */
function nextWalkMiddle(plan: Plan, tSec: number): LatLng | null {
  for (const leg of plan.legs) {
    const start = leg.arriveSec - leg.walkSec;
    if (leg.arriveSec <= tSec || leg.path.length === 0) continue;
    const p = positionAt(plan, (Math.max(start, tSec) + leg.arriveSec) / 2);
    return { lat: p.lat, lng: p.lng };
  }
  return null;
}

/**
 * What a scenario does at `tSec` seconds into the plan. See ScenarioOutcome.
 *
 * Steps:
 * 1. Position and oxygen used: positionAt(plan, tSec). The stops still ahead are the
 *    ones not reached yet; during science the current stop stays, with only its
 *    remaining science time.
 * 2. The scenario changes the state: oxygen-loss adds the lost oxygen to the oxygen
 *    used; blocked-path and slow-walk build a new cost grid from the calm grid.
 * 3. Re-plan from the position: all stops ahead, then home (planRoute). If that is
 *    impossible or the margin is negative, drop the last stop and try again. If no
 *    stop fits, the EVA is aborted (EVA NO-GO) and the route is the walk home.
 * 4. abort is always abortRoute from the position on the new grid: the "go home
 *    now" option with its Contract 3 return-home status (CAUTION or NO-GO).
 */
export function scenarioAt(
  site: Site,
  plan: Plan,
  tSec: number,
  kind: ScenarioKind,
  options: ScenarioOptions = {},
): ScenarioOutcome {
  const startLmst = Number.isFinite(options.startLmst) ? options.startLmst! : DEFAULT_START_LMST;
  const calm = emergencyGrid(site, "calm", startLmst);
  const startSec = Number.isNaN(tSec) ? 0 : Math.min(Math.max(tSec, 0), plan.totalSec);
  const position = positionAt(plan, startSec);
  const hasPosition = Number.isFinite(position.lat) && Number.isFinite(position.lng);
  const from: LatLng = hasPosition ? { lat: position.lat, lng: position.lng } : { lat: site.habitat.lat, lng: site.habitat.lng };
  const usedSec = hasPosition ? position.oxygenUsedSec : 0;
  const budget = oxygenBudget(false);

  // 1. Stops still ahead.
  const allStops = options.stops ?? stopsOf(plan) ?? [];
  let ahead: Stop[] = [];
  let firstAhead = 1; // number of the first stop ahead, for reasons
  if (hasPosition && position.legIndex < allStops.length) {
    const L = position.legIndex;
    if (position.phase === "walk") {
      ahead = allStops.slice(L);
      firstAhead = L + 1;
    } else {
      const next = plan.legs[L + 1];
      const leftSec = Math.max(0, next.arriveSec - next.walkSec - startSec);
      ahead = [{ ...allStops[L], dwellMin: leftSec / 60 }, ...allStops.slice(L + 1)];
      firstAhead = L + 1;
    }
  }
  const original = (s: Stop) => allStops.find((o) => o.id === s.id) ?? s;

  // 2. The new state.
  let grid: CostGrid = calm;
  let usedNow = usedSec;
  let blocked: ScenarioOutcome["blocked"];
  let event: string;
  const when = formatMet(startSec);
  if (kind === "oxygen-loss") {
    const fraction = option(options.lossFraction, DEFAULT_OXYGEN_LOSS_FRACTION, 0, 1);
    const lostSec = fraction * Math.max(0, budget.budgetSec - usedSec);
    usedNow = Math.min(budget.budgetSec, usedSec + lostSec);
    event = `Oxygen loss at ${when}: ${roundHalfUp(fraction * 100)}% of the oxygen left is gone (${minutes(lostSec)} min of life support).`;
  } else if (kind === "slow-walk") {
    const factor = option(options.speedFactor, DEFAULT_SLOW_WALK_FACTOR, 0.05, 1);
    grid = slowedGrid(calm, factor);
    event = `Slow walking from ${when}: speed is ${roundHalfUp(factor * 100)}% of normal for the rest of the EVA.`;
  } else {
    const radiusM = option(options.blockRadiusM, DEFAULT_BLOCK_RADIUS_M, 0, 1e6);
    const at = options.blockAt ?? nextWalkMiddle(plan, startSec) ?? from;
    const keep = [cellIndexOf(site, from), cellIndexOf(site, site.habitat)].filter((c) => c >= 0);
    const made = blockedGrid(site, calm, at, radiusM, keep);
    grid = made.grid;
    blocked = { at: { lat: at.lat, lng: at.lng }, radiusM, cellCount: made.cellCount };
    event = `Path blocked at ${when}: ground within ${roundHalfUp(radiusM)} m of ${at.lat.toFixed(4)} N, ${at.lng.toFixed(4)} E is impassable.`;
  }

  // 3. Re-plan, dropping stops from the end until the rest fits with the reserve.
  const replan = (stops: Stop[]) =>
    planRoute(site, grid, from, stops, {
      end: site.habitat,
      startName: hasPosition ? "the astronaut's position" : "the habitat",
      firstStopNumber: firstAhead,
      oxygenUsedBeforeSec: usedNow,
      elapsedSec: startSec,
    });
  let route = replan(ahead);
  let kept = ahead.length;
  while (kept > 0 && (!route.ok || route.marginSec < 0)) {
    kept--;
    route = replan(ahead.slice(0, kept));
  }

  // 4. The straight-home option, with its Contract 3 return-home status.
  const homeAbort = abortRoute(site, grid, from, usedNow);
  const abort = { ...homeAbort, reasons: [...homeAbort.reasons, event] };

  // 5. Is carrying on really the safer choice? Compare it with going straight home.
  //    Return home instead when carrying on would leave less margin than one more
  //    reserve, or when stops were already dropped and it would still leave less than
  //    half the margin of going home. A healthy plan that keeps all its stops is never
  //    changed by the second rule: early in an EVA, science always costs margin.
  let alternative: ScenarioAlternative | null = null;
  let safetyNote: string | null = null;
  if (kept > 0 && route.ok && route.marginSec >= 0 && Number.isFinite(homeAbort.sec) && homeAbort.marginSec > route.marginSec) {
    const tooThin = route.marginSec < SAFE_CONTINUE_MARGIN_MIN * 60;
    const poorTrade = kept < ahead.length && route.marginSec < MIN_SHARE_OF_HOME_MARGIN * homeAbort.marginSec;
    if (tooThin || poorTrade) {
      const stopsKept = ahead.slice(0, kept).map(original);
      alternative = { stops: stopsKept, marginSec: route.marginSec, status: route.status, endSec: startSec + route.totalSec, route };
      safetyNote = `Returning home is safer: continuing to ${stopsKept.map((s) => s.label).join(", ")} would leave ${minutes(route.marginSec)} min of margin, against ${minutes(homeAbort.marginSec)} min going straight home.`;
      kept = 0;
      route = replan([]);
    }
  }
  const keptStops = ahead.slice(0, kept).map(original);
  const droppedStops = ahead.slice(kept).map(original);
  // Aborted: stops were ahead and none are kept, or even the way home fails.
  const aborted = (ahead.length > 0 && kept === 0) || !route.ok;
  const recommendation: Recommendation = aborted ? "return home" : "continue";

  const dropNote =
    droppedStops.length > 0
      ? `Dropped ${droppedStops.length} stop${droppedStops.length === 1 ? "" : "s"} to keep the ${minutes(budget.reserveSec)} min reserve: ${droppedStops.map((s) => s.label).join(", ")}.`
      : null;

  let evaStatus: Status;
  let evaReasons: string[];
  let returnRoute: ReturnRoute;
  let after: ScenarioSnapshot;
  if (aborted) {
    evaStatus = "NO-GO";
    evaReasons = [`EVA aborted: ${event}`, ...(safetyNote ? [safetyNote] : dropNote ? [dropNote] : []), ...homeAbort.reasons];
    returnRoute = { to: "home", path: homeAbort.path, sec: homeAbort.sec };
    after = {
      marginSec: homeAbort.marginSec,
      stopCount: 0,
      endSec: startSec + homeAbort.sec,
      status: evaStatus,
    };
  } else {
    evaStatus = route.status;
    evaReasons = [event, ...(dropNote ? [dropNote] : []), ...route.reasons];
    const home = route.legs[route.legs.length - 1];
    returnRoute = { to: "home", path: home.path, sec: home.walkSec };
    after = { marginSec: route.marginSec, stopCount: kept, endSec: startSec + route.totalSec, status: evaStatus };
  }

  // Before: the same stops ahead, re-planned from the same position with no emergency
  // (calm grid, no oxygen lost). Comparing like with like keeps out the small
  // difference that the even-pace position assumption makes against the old plan.
  const baseline = planRoute(site, calm, from, ahead, {
    end: site.habitat,
    startName: hasPosition ? "the astronaut's position" : "the habitat",
    firstStopNumber: firstAhead,
    oxygenUsedBeforeSec: usedSec,
    elapsedSec: startSec,
  });
  const before: ScenarioSnapshot = baseline.ok
    ? { marginSec: baseline.marginSec, stopCount: ahead.length, endSec: startSec + baseline.totalSec, status: baseline.status }
    : { marginSec: plan.marginSec, stopCount: ahead.length, endSec: plan.totalSec, status: plan.status };

  const full = CONSUMABLE_HOURS * 3600;
  const usedOnArrival = aborted ? usedNow + homeAbort.sec * WALK_BURN : route.oxygenUsedSec;
  const arrives = Number.isFinite(after.endSec);
  return {
    kind,
    evaStatus,
    evaReasons,
    abort,
    shelter: { checked: false },
    returnRoute,
    position,
    oxygenNowPct: Math.max(0, ((full - usedNow) / full) * 100),
    oxygenOnArrivalPct: arrives ? Math.max(0, ((full - usedOnArrival) / full) * 100) : NaN,
    walkHomeMin: homeAbort.sec / 60,
    marginMin: after.marginSec / 60,
    arriveSec: after.endSec,
    recommendation,
    alternative,
    aborted,
    route,
    startSec,
    keptStops,
    droppedStops,
    before,
    after,
    ...(blocked ? { blocked } : {}),
  };
}

/** "oxygen-loss" at tSec: lose `lossFraction` (default 25%) of the oxygen left, then re-plan. */
export function oxygenLossAt(site: Site, plan: Plan, tSec: number, options: ScenarioOptions = {}): ScenarioOutcome {
  return scenarioAt(site, plan, tSec, "oxygen-loss", options);
}

/** "blocked-path" at tSec: ground within `blockRadiusM` (default 75 m) of `blockAt` is impassable; re-plan. */
export function blockedPathAt(site: Site, plan: Plan, tSec: number, options: ScenarioOptions = {}): ScenarioOutcome {
  return scenarioAt(site, plan, tSec, "blocked-path", options);
}

/** "slow-walk" from tSec: walking speed × `speedFactor` (default 0.7) for the rest of the EVA; re-plan. */
export function slowWalkAt(site: Site, plan: Plan, tSec: number, options: ScenarioOptions = {}): ScenarioOutcome {
  return scenarioAt(site, plan, tSec, "slow-walk", options);
}
