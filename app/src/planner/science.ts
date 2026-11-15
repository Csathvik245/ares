// Science per oxygen-minute (novelty point 3 in CLAUDE.md): how much science value a
// stop gives for the oxygen it costs, and which extra stops would be worth adding.
//
// Deterministic, like the rest of the planner: no ML. Pure functions, no UI code.
// Read-only use of the planner: nothing here changes a plan, a site or a cost grid.

import { WALK_BURN, WORK_BURN } from "./constants";
import { buildCostGrid } from "./cost";
import { fieldFrom } from "./fields";
import { distanceM } from "./geom";
import { isLowMargin, oxygenBudget } from "./oxygen";
import { planRoute } from "./plan";
import { aStar } from "./search";
import { cellCenter, cellIndexOf } from "./site";
import type { CostGrid, LatLng, Plan, Site, Stop } from "./types";

/** ASSUMPTION: science value is averaged over cells whose centers are within this distance of the stop. */
export const SCIENCE_RADIUS_M = 50;
/** ASSUMPTION: candidate cells are the top 3% of the science layer ("top few percent"). */
export const SUGGEST_TOP_FRACTION = 0.03;
/** ASSUMPTION: suggestions are at least this far from each other and from existing stops. */
export const SUGGEST_MIN_SPACING_M = 150;
/** ASSUMPTION: science time planned at a suggested stop, minutes (the app's default dwell). */
export const SUGGEST_DWELL_MIN = 30;
/** ASSUMPTION: EVA start time used when none is given, hours LMST (the app's default start). */
export const SUGGEST_START_LMST = 13;

export type StopScience = {
  id: string;
  /** Mean science value (0 to 1) of the cells within 50 m of the stop. Relative CRISM index, not an abundance. */
  science: number;
  /**
   * Extra oxygen the stop costs, in minutes of nominal life support:
   * (walk there + walk on − the direct walk if the stop were skipped) × WALK_BURN
   * + science time × WORK_BURN. Infinity if the stop cannot be reached.
   */
  extraO2Min: number;
  /** science ÷ extraO2Min. Higher = more science per oxygen-minute. 0 if unreachable. */
  score: number;
};

export type StopSuggestion = Stop &
  StopScience & {
    /** Where to put the stop in the stop order: stops.splice(insertAt, 0, suggestion). */
    insertAt: number;
    /** Oxygen margin of the plan with this stop added, minutes. Always 0 or more. */
    marginMin: number;
  };

export type ScoreOptions = {
  /** Stops of the plan, in order: supplies each stop's id. Without it ids are "stop-1", "stop-2", … */
  stops?: Stop[];
  /** Cost grid the plan was made with. Default: the calm grid for this site. */
  cost?: CostGrid;
};

export type SuggestOptions = {
  /** Science minutes at each suggested stop. Default 30. */
  dwellMin?: number;
  /** EVA start, hours LMST (matters for the low-sun rule). Default 13. */
  startLmst?: number;
  /** Calm cost grid to reuse. Default: built once per site and cached. */
  cost?: CostGrid;
};

// One calm cost grid per site, so the cached Dijkstra fields (fields.ts) are reused
// between calls. Walking cost does not depend on the start time, so one grid per
// start time is enough; a storm or solar event aborts the EVA, so only calm grids are kept.
const calmGrids = new WeakMap<Site, Map<number, CostGrid>>();

function calmGrid(site: Site, startLmst: number): CostGrid {
  let grids = calmGrids.get(site);
  if (!grids) {
    grids = new Map();
    calmGrids.set(site, grids);
  }
  let grid = grids.get(startLmst);
  if (!grid) {
    grid = buildCostGrid(site, { storm: false, spe: false, startLmst });
    if (grids.size >= 4) grids.delete(grids.keys().next().value!);
    grids.set(startLmst, grid);
  }
  return grid;
}

const thresholds = new WeakMap<Float32Array, number>();

/**
 * Science value that marks the top 3% of the site's cells (cells with no data are
 * left out). Worked out once per science layer. NaN if the layer has no data.
 */
export function topScienceThreshold(site: Site): number {
  const layer = site.layers.science;
  const cached = thresholds.get(layer);
  if (cached !== undefined) return cached;
  const valid = layer.filter((v) => !Number.isNaN(v)).sort();
  const threshold =
    valid.length === 0
      ? NaN
      : valid[Math.min(valid.length - 1, Math.floor(valid.length * (1 - SUGGEST_TOP_FRACTION)))];
  thresholds.set(layer, threshold);
  return threshold;
}

/**
 * Mean science value of the cells whose centers are within `radiusM` of a point
 * (cells with no data are left out). The point's own cell always counts.
 * NaN if the point is outside the site or has no data around it.
 */
export function scienceNear(site: Site, at: LatLng, radiusM: number = SCIENCE_RADIUS_M): number {
  const cell = cellIndexOf(site, at);
  if (cell < 0) return NaN;
  const { width, height, cellSizeM } = site;
  const science = site.layers.science;
  const row = Math.floor(cell / width);
  const col = cell - row * width;
  const reachRows = Math.ceil(radiusM / cellSizeM.y);
  const reachCols = Math.ceil(radiusM / cellSizeM.x);
  let sum = 0;
  let n = 0;
  for (let r = Math.max(0, row - reachRows); r <= Math.min(height - 1, row + reachRows); r++) {
    for (let c = Math.max(0, col - reachCols); c <= Math.min(width - 1, col + reachCols); c++) {
      const i = r * width + c;
      const v = science[i];
      if (Number.isNaN(v)) continue;
      if (i !== cell && distanceM(at, cellCenter(site, i)) > radiusM) continue;
      sum += v;
      n++;
    }
  }
  return n > 0 ? sum / n : NaN;
}

const score = (science: number, extraO2Min: number) =>
  Number.isFinite(extraO2Min) && science > 0 ? science / extraO2Min : 0;

/**
 * Science per oxygen-minute for every stop of a plan.
 *
 * For stop i the plan walks leg i (to the stop) and leg i+1 (away from it). If the
 * stop were skipped the astronaut would walk straight from the previous waypoint to
 * the next one; that direct time is found with A* on the same cost grid. So
 *   extra walk  = leg i + leg i+1 − direct
 *   extra O2    = extra walk × WALK_BURN + science time × WORK_BURN
 *   score       = mean science within 50 m ÷ extra O2 minutes
 * Science time is read from the plan's own timeline (the gap between arriving and leaving).
 *
 * A stop that costs no extra oxygen (zero dwell, exactly on the way) scores Infinity.
 * An unreachable stop has extraO2Min = Infinity and score 0.
 */
export function scienceScore(site: Site, plan: Plan, options: ScoreOptions = {}): StopScience[] {
  const { legs } = plan;
  const cost = options.cost ?? calmGrid(site, SUGGEST_START_LMST);
  const out: StopScience[] = [];
  // The waypoint before the first stop: the habitat the plan started from.
  let previous: LatLng | null = legs[0]?.path[0] ?? site.habitat;

  for (let i = 0; i + 1 < legs.length; i++) {
    const toStop = legs[i];
    const onward = legs[i + 1];
    const id = options.stops?.[i]?.id ?? `stop-${i + 1}`;
    const at: LatLng | undefined =
      toStop.path[toStop.path.length - 1] ?? onward.path[0] ?? options.stops?.[i];
    const next: LatLng | undefined = onward.path[onward.path.length - 1];
    const science = at ? scienceNear(site, at) : NaN;

    let extraO2Min = Infinity;
    if (at && next && previous && toStop.path.length > 0 && onward.path.length > 0) {
      const fromCell = cellIndexOf(site, previous);
      const toCell = cellIndexOf(site, next);
      const directSec = fromCell === toCell ? 0 : aStar(cost, fromCell, toCell).cost[toCell];
      const dwellSec = onward.arriveSec - onward.walkSec - toStop.arriveSec;
      // The direct walk is never longer than going via the stop; max() guards rounding.
      const extraWalkSec = Math.max(0, toStop.walkSec + onward.walkSec - directSec);
      extraO2Min = (extraWalkSec * WALK_BURN + dwellSec * WORK_BURN) / 60;
    }
    out.push({
      id,
      science,
      extraO2Min,
      score: extraO2Min <= 0 && science > 0 ? Infinity : score(science, extraO2Min),
    });
    previous = at && toStop.path.length > 0 ? at : null;
  }
  return out;
}

/**
 * Up to `n` extra stops worth adding, best science per oxygen-minute first.
 *
 * - Candidates: passable cells whose science value is in the top 3% of the site.
 * - Each candidate is tried at every place in the stop order (before the first stop,
 *   between two stops, after the last one) and keeps the cheapest place. Between
 *   waypoints A and B its extra oxygen is
 *     (A → candidate + candidate → B − A → B) × WALK_BURN + dwell × WORK_BURN,
 *   read from cached full-field Dijkstra runs (one from the habitat, one from each
 *   existing stop), so thousands of candidates cost almost nothing.
 * - Ranked by score = mean science within 50 m ÷ extra oxygen minutes.
 * - Kept only if planRoute, with the stop added at that place, is still GO with
 *   margin ≥ 0, and the stop is at least 150 m from the habitat, from every existing
 *   stop and from every earlier suggestion.
 *
 * `insertAt` says where the stop goes: stops.splice(insertAt, 0, suggestion).
 * Each suggestion stands alone: adding one is checked, adding several together is not.
 * Returns [] when the existing plan is not GO (nothing should be added to it).
 *
 * The planner suggests; the astronaut decides. Ids are "suggest-<cell>", stable for a site.
 */
export function suggestStops(
  site: Site,
  habitat: LatLng,
  existingStops: Stop[],
  n: number = 3,
  options: SuggestOptions = {},
): StopSuggestion[] {
  if (!(n > 0)) return [];
  const dwellMin = options.dwellMin ?? SUGGEST_DWELL_MIN;
  const cost = options.cost ?? calmGrid(site, options.startLmst ?? SUGGEST_START_LMST);
  const homeCell = cellIndexOf(site, habitat);
  if (homeCell < 0) return [];

  const base = planRoute(site, cost, habitat, existingStops);
  if (base.status !== "GO" || base.marginSec < 0) return [];
  const budget = oxygenBudget(cost.conditions.storm);

  // Waypoints in walking order: habitat, each stop, habitat. One field per waypoint;
  // costs are symmetric, so a field gives the time both to and from its waypoint.
  const cells = [homeCell, ...existingStops.map((s) => cellIndexOf(site, s)), homeCell];
  const fields = new Map<number, Float64Array>();
  for (const cell of cells) if (!fields.has(cell)) fields.set(cell, fieldFrom(cost, cell).cost);
  const gaps = cells.slice(1).map((to, k) => ({
    from: fields.get(cells[k])!,
    to: fields.get(to)!,
    directSec: fields.get(cells[k])![to],
  }));

  // Science value that marks the top few percent of the site.
  const science = site.layers.science;
  const threshold = topScienceThreshold(site);
  if (Number.isNaN(threshold)) return [];

  const dwellO2Sec = dwellMin * 60 * WORK_BURN;
  const candidates: { cell: number; insertAt: number; science: number; score: number }[] = [];
  for (let cell = 0; cell < science.length; cell++) {
    if (!(science[cell] >= threshold) || science[cell] <= 0) continue;
    if (cost.secPerM[cell] === Infinity) continue;
    let extraWalkSec = Infinity;
    let insertAt = 0;
    for (let k = 0; k < gaps.length; k++) {
      const extra = gaps[k].from[cell] + gaps[k].to[cell] - gaps[k].directSec;
      if (extra < extraWalkSec) {
        extraWalkSec = extra;
        insertAt = k;
      }
    }
    if (extraWalkSec === Infinity) continue;
    const extraO2Sec = Math.max(0, extraWalkSec) * WALK_BURN + dwellO2Sec;
    // Skip what would leave the plan below GO on oxygen (Contract 3): saves a re-plan.
    const marginSec = base.marginSec - extraO2Sec;
    if (marginSec < 0 || isLowMargin(marginSec, budget)) continue;
    const near = scienceNear(site, cellCenter(site, cell));
    candidates.push({ cell, insertAt, science: near, score: score(near, extraO2Sec / 60) });
  }
  // Best score first; ties broken by cell index so the result is always the same.
  candidates.sort((a, b) => b.score - a.score || a.cell - b.cell);

  const picked: StopSuggestion[] = [];
  // Each full re-plan costs a few milliseconds; stop trying after a fixed number so a
  // plan that fails for another reason (such as low sun) cannot make this slow.
  let replansLeft = n * 4 + 4;
  for (const c of candidates) {
    if (picked.length >= n || replansLeft <= 0) break;
    if (!(c.score > 0)) break;
    const at = cellCenter(site, c.cell);
    const tooClose =
      existingStops.some((s) => distanceM(s, at) < SUGGEST_MIN_SPACING_M) ||
      picked.some((s) => distanceM(s, at) < SUGGEST_MIN_SPACING_M) ||
      distanceM(habitat, at) < SUGGEST_MIN_SPACING_M;
    if (tooClose) continue;

    const stop: Stop = {
      id: `suggest-${c.cell}`,
      label: `Suggested stop (science ${c.science.toFixed(2)})`,
      lat: at.lat,
      lng: at.lng,
      dwellMin,
    };
    replansLeft--;
    const withStop = [...existingStops];
    withStop.splice(c.insertAt, 0, stop);
    const plan = planRoute(site, cost, habitat, withStop);
    if (plan.status !== "GO" || plan.marginSec < 0) continue;
    // Report the real cost from the re-plan, not the estimate used for ranking.
    const extraO2Min = (plan.oxygenUsedSec - base.oxygenUsedSec) / 60;
    picked.push({
      ...stop,
      science: c.science,
      extraO2Min,
      score: score(c.science, extraO2Min),
      insertAt: c.insertAt,
      marginMin: plan.marginSec / 60,
    });
  }
  return picked;
}
