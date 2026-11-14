// Safe-return zone (Contract 2): everywhere the astronaut could still detour to
// after the last stop and still walk home with the reserve intact.

import { WALK_BURN } from "./constants";
import { fieldFrom } from "./fields";
import { cellIndexOf } from "./site";
import type { CostGrid, LatLng, Plan, Site } from "./types";

/** Habitat and last-stop positions of a plan (the habitat if there are no stops). */
function planEnds(site: Site, plan: Plan): { habitat: LatLng; lastStop: LatLng } {
  const habitat = plan.legs[0]?.path[0] ?? site.habitat;
  if (plan.legs.length < 2) return { habitat, lastStop: habitat };
  const toLast = plan.legs[plan.legs.length - 2].path;
  return { habitat, lastStop: toLast[toLast.length - 1] };
}

/**
 * Safe-return zone, one byte per cell (1 = inside).
 *
 * A cell is inside if
 *   (time from last stop to cell + time from cell to habitat) × WALK_BURN
 *     ≤ oxygen left after reserve,
 * where "oxygen left after reserve" is measured when the astronaut leaves the
 * last stop: plan.marginSec + (walk time of the last leg home) × WALK_BURN.
 * With no stops the "last stop" is the habitat, so the zone is every cell with a
 * round trip that fits in the usable budget.
 *
 * Both times come from cached full-field Dijkstra runs on `cost` (one from the
 * habitat, one from the last stop). `cost` must be the grid the plan was made
 * with, so the reserve (storm or not) matches plan.marginSec.
 *
 * Empty when the plan is not ok or its margin is negative: then even the planned
 * way home does not fit.
 */
export function safeZone(site: Site, cost: CostGrid, plan: Plan): Uint8Array {
  const count = site.width * site.height;
  const zone = new Uint8Array(count);
  if (!plan.ok || plan.marginSec < 0) return zone;

  const { habitat, lastStop } = planEnds(site, plan);
  const homeCell = cellIndexOf(site, habitat);
  const lastCell = cellIndexOf(site, lastStop);
  if (homeCell < 0 || lastCell < 0) return zone;

  const lastLegWalkSec = plan.legs.length > 0 ? plan.legs[plan.legs.length - 1].walkSec : 0;
  // Walking-time budget (seconds of walking) for "last stop → cell → home".
  const walkBudgetSec = (plan.marginSec + lastLegWalkSec * WALK_BURN) / WALK_BURN;

  const toHome = fieldFrom(cost, homeCell).cost;
  const fromLast = fieldFrom(cost, lastCell).cost;
  for (let i = 0; i < count; i++) {
    // Unreachable cells are Infinity, and Infinity ≤ budget is false.
    if (fromLast[i] + toHome[i] <= walkBudgetSec) zone[i] = 1;
  }
  return zone;
}
