// Emergency abort route (core feature 6): fastest safe way home from wherever
// the astronaut is right now, on the storm (or SPE) cost grid.

import { STORM_EXTRA_RESERVE_MIN, WALK_BURN } from "./constants";
import { fieldFrom } from "./fields";
import { smoothPath } from "./geom";
import { isLowMargin, oxygenBudget } from "./oxygen";
import { pathTo } from "./search";
import { cellIndexOf } from "./site";
import type { CostGrid, LatLng, Site, Status } from "./types";

export type AbortRoute = {
  /** Smoothed line from `from` (exact) to the habitat (exact). Empty if home cannot be reached. */
  path: LatLng[];
  /** Walking time home on the given grid, seconds. Infinity if unreachable. */
  sec: number;
  /** Oxygen left above the reserve on arrival, seconds. −Infinity if unreachable. */
  marginSec: number;
  status: Status;
  /** Why the status is what it is (Contract 3: never show a status without a reason). */
  reasons: string[];
};

const minutes = (sec: number) => Math.round(sec / 60);

/**
 * Abort route home from `from`, when `oxygenUsedSec` of oxygen has already been used
 * (take both from positionAt).
 *
 * Uses the cached full-field Dijkstra from the habitat on `stormCost` — build that
 * grid once with buildCostGrid(site, { ...conditions, storm: true }) when the storm
 * starts and reuse the same object, so the field is computed only once. Following
 * cameFrom from the astronaut's cell leads straight home.
 *
 * The reserve follows stormCost.conditions (45 min, +30 min in a storm).
 * The habitat is site.habitat.
 */
export function abortRoute(site: Site, stormCost: CostGrid, from: LatLng, oxygenUsedSec: number): AbortRoute {
  const { storm, spe } = stormCost.conditions;
  const habitat = site.habitat;
  const homeCell = cellIndexOf(site, habitat);
  const fromCell = cellIndexOf(site, from);

  const field = homeCell >= 0 ? fieldFrom(stormCost, homeCell) : null;
  const sec = field && fromCell >= 0 ? field.cost[fromCell] : Infinity;
  if (!field || sec === Infinity) {
    return {
      path: [],
      sec: Infinity,
      marginSec: -Infinity,
      status: "NO-GO",
      reasons: [
        fromCell < 0
          ? "Cannot plan an abort: the astronaut is outside the mapped site."
          : "No safe path home from here (blocked by steep slopes or boulders).",
      ],
    };
  }

  // The field starts at the habitat, so pathTo gives habitat → here; reverse it to walk home.
  const cells = pathTo(field, fromCell).reverse();
  const path = smoothPath(site, stormCost, cells, from, { lat: habitat.lat, lng: habitat.lng });

  const budget = oxygenBudget(storm);
  const marginSec = budget.usableSec - oxygenUsedSec - sec * WALK_BURN;

  const reasons: string[] = [];
  let status: Status;
  if (marginSec < 0) {
    status = "NO-GO";
    reasons.push(
      `Not enough oxygen to walk home with the reserve intact: ${minutes(-marginSec)} min short ` +
        `(${minutes(sec)} min walk, ${minutes(budget.reserveSec)} min reserve).`,
    );
  } else {
    if (isLowMargin(marginSec, budget)) {
      reasons.push(`Oxygen margin on arrival is low: ${minutes(marginSec)} min above reserve.`);
    }
    if (storm) {
      reasons.push(
        `Dust storm active: low visibility slows walking and adds ${STORM_EXTRA_RESERVE_MIN} min to the reserve.`,
      );
    }
    if (spe) reasons.push("Solar particle event active: radiation dose rate is elevated. Head for shelter.");
    status = reasons.length > 0 ? "CAUTION" : "GO";
    reasons.unshift(`Abort home: ${minutes(sec)} min walk, ${minutes(marginSec)} min of oxygen margin on arrival.`);
  }
  return { path, sec, marginSec, status, reasons };
}
