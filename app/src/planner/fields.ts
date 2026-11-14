// Cached full-field Dijkstra results (CLAUDE.md section 6, step 7).
//
// A field holds the walking time from one cell to EVERY cell. Costs are symmetric,
// so the field from the habitat is also "time to walk home" from every cell, and
// following its cameFrom from any cell leads home.
//
// Fields are cached per CostGrid object. buildCostGrid makes a new grid whenever
// the conditions change (for example when a storm starts), so a new grid means
// fresh fields and old ones are dropped with the old grid. Do not edit a grid's
// secPerM in place after using it — build a new grid instead.

import { dijkstraField } from "./search";
import { cellIndexOf } from "./site";
import type { CostGrid, LatLng, SearchResult, Site } from "./types";

/** Fields kept per grid (habitat + recent last stops). Each is ~1 MB on the 320 × 240 grid. */
const MAX_FIELDS_PER_GRID = 6;

const cache = new WeakMap<CostGrid, Map<number, SearchResult>>();

/** Full-field Dijkstra from `cell` on `cost`, computed once and then reused. */
export function fieldFrom(cost: CostGrid, cell: number): SearchResult {
  let fields = cache.get(cost);
  if (!fields) {
    fields = new Map();
    cache.set(cost, fields);
  }
  const hit = fields.get(cell);
  if (hit) {
    // Move to the back so it is the last to be evicted.
    fields.delete(cell);
    fields.set(cell, hit);
    return hit;
  }
  const field = dijkstraField(cost, cell);
  fields.set(cell, field);
  if (fields.size > MAX_FIELDS_PER_GRID) fields.delete(fields.keys().next().value!);
  return field;
}

/**
 * Walking time home (seconds) from a point, using the cached field from the
 * habitat. Infinity if the point is outside the site or cut off. Handy for the
 * cursor probe's "walk-home time".
 */
export function walkHomeSec(site: Site, cost: CostGrid, from: LatLng, habitat: LatLng = site.habitat): number {
  const home = cellIndexOf(site, habitat);
  const cell = cellIndexOf(site, from);
  if (home < 0 || cell < 0) return Infinity;
  return fieldFrom(cost, home).cost[cell];
}
