import { STORM_EXTRA_RESERVE_MIN, WALK_BURN, WORK_BURN } from "./constants";
import { isLowMargin, oxygenBudget } from "./oxygen";
import { aStar, pathLengthM, pathTo } from "./search";
import { cellCenter, cellIndexOf } from "./site";
import type { CostGrid, LatLng, Leg, Plan, Site, Status, Stop } from "./types";

const minutes = (sec: number) => Math.round(sec / 60);

/**
 * Plan the EVA: habitat → stop 1 → … → last stop → habitat.
 * Each leg is the fastest safe path (A*). Dwell time is added at each stop, then
 * oxygen, margin and status are worked out from Contracts 2 and 3.
 *
 * Storm and SPE are read from cost.conditions (the conditions the grid was built for).
 *
 * NOT YET CHECKED: Contract 3's "sun < 10° during walk" CAUTION rule needs the
 * Mars24 sun model in envAt, which is a later task.
 */
export function planRoute(site: Site, cost: CostGrid, habitat: LatLng, stops: Stop[]): Plan {
  const { storm, spe } = cost.conditions;
  const waypoints: { label: string; cell: number }[] = [
    { label: "the habitat", cell: cellIndexOf(site, habitat) },
    ...stops.map((s) => ({ label: `stop "${s.label}"`, cell: cellIndexOf(site, s) })),
  ];
  if (stops.length > 0) waypoints.push(waypoints[0]);

  const legs: Leg[] = [];
  const unreachable: string[] = [];
  let walkSec = 0;
  let workSec = 0;
  let distM = 0;
  let clock = 0;

  for (let i = 1; i < waypoints.length; i++) {
    const from = waypoints[i - 1];
    const to = waypoints[i];
    const result = aStar(cost, from.cell, to.cell);
    const cells = pathTo(result, to.cell);

    if (cells.length === 0) {
      const why =
        to.cell === -1 || from.cell === -1
          ? "it is outside the mapped site"
          : cost.secPerM[to.cell] === Infinity
            ? "it sits on no-go terrain (too steep or too many boulders)"
            : "no safe path exists (blocked by steep slopes or boulders)";
      unreachable.push(`Cannot walk from ${from.label} to ${to.label}: ${why}.`);
      legs.push({ path: [], walkSec: 0, distM: 0, arriveSec: clock });
    } else {
      const legWalk = result.cost[to.cell];
      const legDist = pathLengthM(cost, cells);
      clock += legWalk;
      walkSec += legWalk;
      distM += legDist;
      legs.push({
        path: cells.map((c) => cellCenter(site, c)),
        walkSec: legWalk,
        distM: legDist,
        arriveSec: clock,
      });
    }

    // Science time at the stop this leg ends at (the last leg ends at the habitat).
    if (i <= stops.length) {
      const dwellSec = stops[i - 1].dwellMin * 60;
      workSec += dwellSec;
      clock += dwellSec;
    }
  }

  // Oxygen budget (Contract 2).
  const budget = oxygenBudget(storm);
  const { budgetSec, reserveSec, usableSec } = budget;
  const oxygenUsedSec = walkSec * WALK_BURN + workSec * WORK_BURN;
  const marginSec = usableSec - oxygenUsedSec;
  const oxygenAtReturnPct = Math.max(0, ((budgetSec - oxygenUsedSec) / budgetSec) * 100);
  const ok = unreachable.length === 0;

  // Status (Contract 3).
  let status: Status = "GO";
  const reasons: string[] = [];

  if (!ok) reasons.push(...unreachable);
  if (marginSec < 0) {
    reasons.push(
      `Oxygen margin is negative: the plan uses ${minutes(-marginSec)} min more oxygen than the budget allows after the ${minutes(reserveSec)} min reserve.`,
    );
  }
  if (reasons.length > 0) {
    status = "NO-GO";
  } else {
    if (isLowMargin(marginSec, budget)) {
      reasons.push(
        `Oxygen margin is low: ${minutes(marginSec)} min above reserve, under 25% of the ${minutes(usableSec)} min usable budget (${minutes(budgetSec)} min minus the ${minutes(reserveSec)} min reserve).`,
      );
    }
    if (storm) {
      reasons.push(
        `Dust storm active: low visibility slows walking and adds ${STORM_EXTRA_RESERVE_MIN} min to the reserve.`,
      );
    }
    if (spe) reasons.push("Solar particle event active: radiation dose rate is elevated.");
    if (reasons.length > 0) {
      status = "CAUTION";
    } else {
      reasons.push(`All stops reachable with ${minutes(marginSec)} min of oxygen margin above reserve.`);
    }
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
