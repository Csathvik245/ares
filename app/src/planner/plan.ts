import { SOL_HOURS, STORM_EXTRA_RESERVE_MIN, WALK_BURN, WORK_BURN } from "./constants";
import { SUN_CAUTION_DEG, lowSunDuring } from "./env";
import { isLowMargin, oxygenBudget } from "./oxygen";
import { groundProblem } from "./cost";
import { buildShortestPathGrid } from "./shortest";
import { smoothPath } from "./geom";
import { aStar, pathLengthM, pathTimeSec, pathTo } from "./search";
import { cellIndexOf } from "./site";
import type { CostGrid, LatLng, Leg, Plan, Site, Status, Stop } from "./types";

export type PlanOptions = {
  /**
   * Grid used only to CHOOSE each leg's path (for example buildLearnedCostGrid's).
   * Walking time, distance, oxygen and status are still worked out on `cost`, the
   * Contract 2 grid. It must be the same size and have the same no-go cells as
   * `cost`. Leave it out (the default) for the fastest route: the result is then
   * exactly what planRoute gave before this option existed.
   */
  routeGrid?: CostGrid;
  /**
   * Compare with the SHORTEST path (off by default). When true, each leg's path is the
   * shortest walkable one in metres: same no-go cells and corner rule, but slopes, sand
   * and rough ground are ignored when choosing. Its time, oxygen and status are still
   * worked out with the real walking model on `cost`, so they are the true cost of taking
   * that path. Ignored when `routeGrid` is given. Leaving it out changes nothing.
   */
  shortestPath?: boolean;
  /**
   * Re-planning in the middle of an EVA (used by emergencies.ts). All optional;
   * leaving them out gives exactly the normal habitat → stops → habitat plan.
   */
  /** Where the last leg ends. Default: back at `habitat` (the start). */
  end?: LatLng;
  /** How the start is named in reasons. Default "the habitat". */
  startName?: string;
  /** Number of the first stop in reasons ("Stop 3 ..."). Default 1. */
  firstStopNumber?: number;
  /** Oxygen already used before this plan starts, seconds. Added to oxygenUsedSec. Default 0. */
  oxygenUsedBeforeSec?: number;
  /** Seconds of EVA already done before this plan starts (for the low-sun check). Default 0. */
  elapsedSec?: number;
};

const minutes = (sec: number) => Math.round(sec / 60);
/** Clock time such as "17:58" from hours. */
const clockTime = (hours: number) => {
  const totalMin = Math.round(hours * 60) % (24 * 60);
  return `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
};
/** Elapsed time such as "2 h 05 min" from seconds. */
const elapsedTime = (sec: number) => {
  const totalMin = minutes(sec);
  return totalMin < 60 ? `${totalMin} min` : `${Math.floor(totalMin / 60)} h ${String(totalMin % 60).padStart(2, "0")} min`;
};
const degrees = (deg: number) => `${deg < 0 ? "−" : ""}${Math.abs(deg).toFixed(1)}°`;

/**
 * Plan the EVA: habitat → stop 1 → … → last stop → habitat.
 * Each leg is the fastest safe path (A*), smoothed for drawing: it starts and ends
 * at the exact habitat/stop coordinates, only crosses passable cells and is never
 * slower than the grid path. walkSec
 * and distM come from the grid path (the same numbers the Dijkstra fields use).
 * Dwell time is added at each stop, then
 * oxygen, margin and status are worked out from Contracts 2 and 3.
 *
 * Storm, SPE and the start time are read from cost.conditions (the conditions the
 * grid was built for).
 *
 * Low sun (Contract 3): the sun is checked once a minute from conditions.startLmst
 * to the end of the EVA (walking and science). If it is ever below 10° the status
 * is at least CAUTION, with a reason giving the time and elevation. NO-GO still wins.
 *
 * Emergencies (Contract 3): if conditions.storm or conditions.spe is true the EVA
 * is aborted, so the status is NO-GO with the reason "EVA aborted: active dust
 * storm" (or "... solar particle event"). The way home is abortRoute's job.
 *
 * options.routeGrid (additive, optional, off by default): choose each leg's path on
 * that grid instead, then time it on `cost`. Same safety rules and the same numbers
 * for the same path; only the choice of path changes.
 *
 * options.shortestPath (additive, optional, off by default): choose each leg's path by
 * distance alone (buildShortestPathGrid), then time it on `cost` the same way.
 */
export function planRoute(
  site: Site,
  cost: CostGrid,
  habitat: LatLng,
  stops: Stop[],
  options: PlanOptions = {},
): Plan {
  const routeGrid = options.routeGrid ?? (options.shortestPath ? buildShortestPathGrid(cost) : cost);
  if (routeGrid.width !== cost.width || routeGrid.height !== cost.height) {
    throw new RangeError("planRoute: routeGrid must be the same size as cost");
  }
  const { storm, spe } = cost.conditions;
  const startName = options.startName ?? "the habitat";
  const firstStop = options.firstStopNumber ?? 1;
  const usedBefore = Number.isFinite(options.oxygenUsedBeforeSec) ? Math.max(0, options.oxygenUsedBeforeSec!) : 0;
  const elapsedBefore = Number.isFinite(options.elapsedSec) ? Math.max(0, options.elapsedSec!) : 0;
  const stopName = (i: number) => `stop ${i + firstStop - 1}`;
  // name: how the waypoint is called in a sentence. problem: why nobody can stand there, or null.
  const waypoints: { name: string; at: LatLng; cell: number; problem: string | null }[] = [habitat, ...stops].map((p, i) => {
    const cell = cellIndexOf(site, p);
    return { name: i === 0 ? startName : stopName(i), at: { lat: p.lat, lng: p.lng }, cell, problem: groundProblem(site, cell) };
  });
  if (options.end) {
    const cell = cellIndexOf(site, options.end);
    waypoints.push({ name: "the habitat", at: { lat: options.end.lat, lng: options.end.lng }, cell, problem: groundProblem(site, cell) });
  } else if (stops.length > 0) waypoints.push(waypoints[0]);

  // One clear sentence for each place that cannot be used ("Stop 2 is on a slope over 25 degrees.").
  const unreachable: string[] = [];
  const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  if (waypoints[0].problem) unreachable.push(`${capital(startName)} ${waypoints[0].problem}.`);
  stops.forEach((_, i) => {
    const problem = waypoints[i + 1].problem;
    if (problem) unreachable.push(`${capital(stopName(i + 1))} ${problem}.`);
  });
  const endPoint = options.end ? waypoints[waypoints.length - 1] : null;
  if (endPoint?.problem) unreachable.push(`The habitat ${endPoint.problem}.`);

  const legs: Leg[] = [];
  let walkSec = 0;
  let workSec = 0;
  let distM = 0;
  let clock = 0;

  for (let i = 1; i < waypoints.length; i++) {
    const from = waypoints[i - 1];
    const to = waypoints[i];
    // A leg that starts or ends somewhere impossible is not searched: its sentence is already written.
    const result = from.problem || to.problem ? null : aStar(routeGrid, from.cell, to.cell);
    const cells = result ? pathTo(result, to.cell) : [];

    if (!result || cells.length === 0) {
      if (result) {
        unreachable.push(`No safe path from ${from.name} to ${to.name}: steep slopes or rough ground block every way.`);
      }
      legs.push({ path: [], walkSec: 0, distM: 0, arriveSec: clock });
    } else {
      // Default: the search already timed the path on `cost`. With a routeGrid, time
      // the chosen cells on `cost` (edge rule identical to the search).
      const legWalk = routeGrid === cost ? result.cost[to.cell] : pathTimeSec(cost, cells);
      const legDist = pathLengthM(cost, cells);
      clock += legWalk;
      walkSec += legWalk;
      distM += legDist;
      legs.push({
        // The drawn line is smoothed on the grid the path was chosen with. The shortest path is the
        // exception: it is smoothed with the real walking model, so (as for a normal leg) the drawn
        // line is never slower than the cells its time was measured on.
        path: smoothPath(site, options.shortestPath && !options.routeGrid ? cost : routeGrid, cells, from.at, to.at),
        walkSec: legWalk,
        distM: legDist,
        arriveSec: clock,
      });
    }

    // Science time at the stop this leg ends at (the last leg ends at the habitat).
    // A missing, negative or broken dwell time counts as 0, so it can never poison the totals.
    if (i <= stops.length) {
      const dwellMin = stops[i - 1].dwellMin;
      const dwellSec = Number.isFinite(dwellMin) && dwellMin > 0 ? dwellMin * 60 : 0;
      workSec += dwellSec;
      clock += dwellSec;
    }
  }

  // Oxygen budget (Contract 2).
  const budget = oxygenBudget(storm);
  const { budgetSec, reserveSec, usableSec } = budget;
  const oxygenUsedSec = usedBefore + walkSec * WALK_BURN + workSec * WORK_BURN;
  const marginSec = usableSec - oxygenUsedSec;
  const oxygenAtReturnPct = Math.max(0, ((budgetSec - oxygenUsedSec) / budgetSec) * 100);
  const ok = unreachable.length === 0;

  // Status (Contract 3).
  //   NO-GO   — a dust storm or solar particle event is active (the EVA is aborted),
  //             a stop is unreachable, or the oxygen margin is negative
  //   CAUTION — the margin is low, or the sun gets below 10° during the EVA
  //   GO      — everything else
  // NO-GO reasons come first; any CAUTION reasons that also apply are listed after them.
  const blocking: string[] = [];
  if (storm) blocking.push("EVA aborted: active dust storm");
  if (spe) blocking.push("EVA aborted: active solar particle event");
  blocking.push(...unreachable);
  if (marginSec < 0) {
    blocking.push(
      `Oxygen margin is negative: the plan uses ${minutes(-marginSec)} min more oxygen than the budget allows after the ${minutes(reserveSec)} min reserve.`,
    );
  }

  const cautions: string[] = [];
  if (ok && marginSec >= 0 && isLowMargin(marginSec, budget)) {
    cautions.push(
      `Oxygen margin is low: ${minutes(marginSec)} min above reserve, under 25% of the ${minutes(usableSec)} min usable budget (${minutes(budgetSec)} min minus the ${minutes(reserveSec)} min reserve).`,
    );
  }
  if (storm) {
    cautions.push(
      `Dust storm conditions: low visibility slows walking and adds ${STORM_EXTRA_RESERVE_MIN} min to the reserve.`,
    );
  }
  if (spe) cautions.push("Solar particle event conditions: radiation dose rate is elevated.");
  // Sun check from "now": the start time moved on by the EVA time already done.
  const sunStart = cost.conditions.startLmst + (elapsedBefore * 24) / (SOL_HOURS * 3600);
  const lowSun = ok && legs.length > 0 ? lowSunDuring(sunStart, clock) : null;
  if (lowSun) {
    const { first, lowest } = lowSun;
    const firstT = first.tSec + elapsedBefore;
    const when = firstT === 0 ? "from the start" : `${elapsedTime(firstT)} into the EVA`;
    let reason = `Low sun: below ${SUN_CAUTION_DEG}° at ${clockTime(first.lmst)} LMST (${when}, elevation ${degrees(first.sunElevationDeg)})`;
    if (lowest.tSec !== first.tSec) {
      reason += `, dropping to ${degrees(lowest.sunElevationDeg)} at ${clockTime(lowest.lmst)} LMST`;
    }
    if (lowest.sunElevationDeg < 0) reason += " — part of the EVA is in darkness";
    cautions.push(`${reason}.`);
  }

  let status: Status;
  let reasons: string[];
  if (blocking.length > 0) {
    status = "NO-GO";
    reasons = [...blocking, ...cautions];
  } else if (cautions.length > 0) {
    status = "CAUTION";
    reasons = cautions;
  } else {
    status = "GO";
    reasons = [`All stops reachable with ${minutes(marginSec)} min of oxygen margin above reserve.`];
  }

  return {
    ok,
    legs,
    totalSec: walkSec + workSec,
    walkSec,
    workSec,
    distM,
    oxygenUsedSec,
    marginSec,
    oxygenAtReturnPct,
    status,
    reasons,
  };
}
