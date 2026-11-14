// Plain facts about one leg of the plan, for the stop cards and the AI assistant
// (Contract 5: explain_route). The assistant reads these numbers; it never makes them up.

import { MAX_SLOPE_DEG, ROCK_NO_GO, SAND_TI_THRESHOLD } from "./constants";
import { distanceM, forEachCellOnSegment, polylineLengthM } from "./geom";
import type { LatLng, Plan, Site } from "./types";

export type SegmentExplanation = {
  /** Steepest cell the drawn leg crosses, degrees. */
  maxSlopeDeg: number;
  /** Share of crossed cells that are soft sand (thermal inertia below SAND_TI_THRESHOLD), 0 to 1. */
  sandFraction: number;
  /** Highest boulder density on the leg, 0 to 1. */
  rockMax: number;
  /** One sentence on how and why the leg differs from a straight line. */
  detourNote: string;
};

/** Every distinct cell a polyline touches, in order. */
function cellsOnPath(site: Site, path: LatLng[]): number[] {
  const seen = new Set<number>();
  const cells: number[] = [];
  for (let i = 1; i < path.length; i++) {
    forEachCellOnSegment(site, path[i - 1], path[i], (cell) => {
      if (!seen.has(cell)) {
        seen.add(cell);
        cells.push(cell);
      }
      return true;
    });
  }
  return cells;
}

function terrainFacts(site: Site, cells: number[]) {
  const { slope, rock, thermalInertia } = site.layers;
  let maxSlopeDeg = 0;
  let rockMax = 0;
  let sand = 0;
  let steepNoGo = 0;
  let rockNoGo = 0;
  for (const c of cells) {
    const s = slope[c];
    const r = rock[c];
    if (s > maxSlopeDeg) maxSlopeDeg = s;
    if (r > rockMax) rockMax = r;
    if (thermalInertia[c] < SAND_TI_THRESHOLD) sand++;
    // Same no-go rules as walkingSpeedMps (missing slope/rock data counts as no-go).
    if (Number.isNaN(s) || s > MAX_SLOPE_DEG) steepNoGo++;
    else if (Number.isNaN(r) || r > ROCK_NO_GO) rockNoGo++;
  }
  return { maxSlopeDeg, rockMax, sandFraction: cells.length ? sand / cells.length : 0, steepNoGo, rockNoGo };
}

const km = (m: number) => (m / 1000).toFixed(2);
const pct = (f: number) => `${Math.round(f * 100)}%`;

/**
 * Facts about leg `legIndex` of the plan: the steepest slope, the share of soft
 * sand and the worst boulder density on the drawn (smoothed) path, plus a note
 * comparing it with the straight line between its ends.
 *
 * Reads the site layers directly, so it does not depend on storm conditions.
 * Throws a RangeError if `legIndex` is not a leg of the plan.
 */
export function explainSegment(site: Site, plan: Plan, legIndex: number): SegmentExplanation {
  const leg = plan.legs[legIndex];
  if (!Number.isInteger(legIndex) || !leg) {
    throw new RangeError(`explainSegment: leg ${legIndex} does not exist (plan has ${plan.legs.length} legs)`);
  }
  if (leg.path.length === 0) {
    return { maxSlopeDeg: 0, sandFraction: 0, rockMax: 0, detourNote: "No safe path exists for this leg." };
  }

  const route = terrainFacts(site, cellsOnPath(site, leg.path));
  const start = leg.path[0];
  const end = leg.path[leg.path.length - 1];
  const straightM = distanceM(start, end);
  const routeM = polylineLengthM(leg.path);
  const facts = { maxSlopeDeg: route.maxSlopeDeg, sandFraction: route.sandFraction, rockMax: route.rockMax };

  if (straightM < 1) return { ...facts, detourNote: "Start and end are at the same spot; no walking needed." };

  const extra = routeM / straightM - 1;
  const direct = terrainFacts(site, cellsOnPath(site, [start, end]));
  const lengths = `${km(routeM)} km walked vs ${km(straightM)} km in a straight line (+${pct(extra)})`;

  let detourNote: string;
  if (direct.steepNoGo + direct.rockNoGo > 0) {
    const causes: string[] = [];
    if (direct.steepNoGo > 0) causes.push(`slopes steeper than ${MAX_SLOPE_DEG}° (${direct.steepNoGo} cells)`);
    if (direct.rockNoGo > 0) causes.push(`boulder fields denser than ${ROCK_NO_GO} (${direct.rockNoGo} cells)`);
    detourNote = `Detour: ${lengths}. The straight line crosses no-go terrain: ${causes.join(" and ")}.`;
  } else if (extra > 0.02) {
    const why =
      direct.sandFraction > route.sandFraction + 0.05
        ? `soft sand (${pct(direct.sandFraction)} of the straight line vs ${pct(route.sandFraction)} of the route)`
        : direct.maxSlopeDeg > route.maxSlopeDeg + 1
          ? `steeper ground (up to ${direct.maxSlopeDeg.toFixed(1)}° on the straight line vs ${route.maxSlopeDeg.toFixed(1)}°)`
          : direct.rockMax > route.rockMax + 0.05
            ? `boulders (density up to ${direct.rockMax.toFixed(2)} on the straight line vs ${route.rockMax.toFixed(2)})`
            : "slower ground";
    detourNote = `Detour: ${lengths}. The straight line is walkable but slower because of ${why}.`;
  } else {
    detourNote = `Nearly straight: ${lengths}.`;
  }
  return { ...facts, detourNote };
}
