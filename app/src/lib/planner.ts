// I2 integration boundary: the UI imports planner functions only from this file.
// Safe zone, playback, abort, and segment explanations now use real planner exports.
export * from "../planner";
import {
  cellIndexOf,
  fieldFrom,
} from "../planner";
import type { CostGrid, Site } from "../planner";

export function homeField(site: Site, cost: CostGrid) {
  return fieldFrom(cost, cellIndexOf(site, site.habitat));
}

// envAt has landed in its own module; use this until the team adds it to index.ts.
export { envAt } from "../planner/env";
