// The shortest path, for comparison with the ARES route.
//
// ARES picks the FASTEST safe path: it goes around slow ground (slopes, soft sand, rough
// ground) when that saves time. "What if she just took the shortest way?" is a fair
// question, and this file answers it: a grid on which every walkable cell costs the same,
// so the search minimises distance and nothing else. The no-go cells are the same, and so
// is the no-corner-cutting rule, so the shortest path is still a path she is allowed to walk.
//
// The grid only CHOOSES the path. planRoute's `shortestPath` option then times that path
// with the real walking model (the Contract 2 grid), so its time, oxygen and status are true.
import type { CostGrid } from "./types";

// One grid per cost grid: the search fields are cached per grid object, so this keeps them.
const grids = new WeakMap<CostGrid, CostGrid>();

/**
 * A grid for choosing the shortest walkable path: 1 for every cell `cost` can cross,
 * Infinity for every cell it cannot. With it, "seconds" in the search are metres.
 * Use it only through planRoute(..., { shortestPath: true }); never read its secPerM
 * as a walking time.
 */
export function buildShortestPathGrid(cost: CostGrid): CostGrid {
  const known = grids.get(cost);
  if (known) return known;
  const secPerM = new Float32Array(cost.secPerM.length);
  for (let i = 0; i < secPerM.length; i++) secPerM[i] = Number.isFinite(cost.secPerM[i]) ? 1 : Infinity;
  const grid: CostGrid = {
    width: cost.width,
    height: cost.height,
    cellSizeM: cost.cellSizeM,
    secPerM,
    minSecPerM: 1,
    conditions: cost.conditions,
  };
  grids.set(cost, grid);
  return grid;
}
