// Where the astronaut is at any moment of the planned EVA (for the sol timeline and HUD).

import { WALK_BURN, WORK_BURN } from "./constants";
import { distanceM } from "./geom";
import type { LatLng, Plan } from "./types";

export type Position = {
  lat: number;
  lng: number;
  /** "walk" while on a leg, "science" while working at a stop. */
  phase: "walk" | "science";
  /** Leg being walked, or (during science) the leg that just arrived at this stop. -1 for an empty plan. */
  legIndex: number;
  /** Oxygen used so far, in seconds of nominal life support (Contract 2 burn rates). */
  oxygenUsedSec: number;
};

/** Point a fraction `f` (0..1) of the way along a polyline, measured by ground distance. */
function pointAlong(path: LatLng[], f: number): LatLng {
  if (path.length === 1 || f <= 0) return path[0];
  const last = path[path.length - 1];
  if (f >= 1) return last;
  const segLen: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const d = distanceM(path[i - 1], path[i]);
    segLen.push(d);
    total += d;
  }
  if (total === 0) return last;
  let remaining = f * total;
  for (let i = 0; i < segLen.length; i++) {
    if (remaining <= segLen[i]) {
      const t = segLen[i] === 0 ? 0 : remaining / segLen[i];
      const a = path[i];
      const b = path[i + 1];
      return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
    }
    remaining -= segLen[i];
  }
  return last;
}

/**
 * Position of the astronaut `tSec` seconds after leaving the habitat.
 *
 * Timeline: walk leg 0 → science at stop 1 → walk leg 1 → … → walk the last leg home.
 * Leg i is walked from (arriveSec − walkSec) to arriveSec; the science dwell
 * fills the gap until the next leg starts.
 *
 * - t ≤ 0 → the habitat, phase "walk", leg 0. t ≥ totalSec → the habitat, last leg.
 * - While walking, the marker moves along the smoothed path at a steady pace
 *   (ASSUMPTION: even speed along the leg; the real pace varies with terrain, but
 *   the leg's start, end and total time are exact).
 * - An unreachable leg (empty path, NO-GO plan) keeps the astronaut at the last
 *   known point.
 * - An empty plan has no coordinates: lat/lng are NaN and legIndex is -1, so
 *   check plan.legs.length before drawing a marker.
 */
export function positionAt(plan: Plan, tSec: number): Position {
  const { legs } = plan;
  if (legs.length === 0) {
    return { lat: NaN, lng: NaN, phase: "walk", legIndex: -1, oxygenUsedSec: 0 };
  }
  // Before the start (or not a number) → the start; after the end → the end.
  const t = Number.isNaN(tSec) ? 0 : Math.min(Math.max(tSec, 0), plan.totalSec);

  let here: LatLng = legs.find((l) => l.path.length > 0)?.path[0] ?? { lat: NaN, lng: NaN };
  let used = 0;
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const start = leg.arriveSec - leg.walkSec;
    const isLast = i === legs.length - 1;

    // Walking leg i.
    // (The last leg always ends here: totalSec and its arriveSec can differ by rounding.)
    if (isLast || t < leg.arriveSec) {
      const walked = Math.min(Math.max(0, t - start), leg.walkSec);
      const f = leg.walkSec > 0 ? walked / leg.walkSec : 1;
      const p = leg.path.length > 0 ? pointAlong(leg.path, f) : here;
      return { ...p, phase: "walk", legIndex: i, oxygenUsedSec: used + walked * WALK_BURN };
    }
    used += leg.walkSec * WALK_BURN;
    if (leg.path.length > 0) here = leg.path[leg.path.length - 1];

    // Science at the stop this leg ended at, until the next leg starts.
    const next = legs[i + 1];
    const scienceEnd = next.arriveSec - next.walkSec;
    if (t < scienceEnd) {
      return { ...here, phase: "science", legIndex: i, oxygenUsedSec: used + (t - leg.arriveSec) * WORK_BURN };
    }
    used += (scienceEnd - leg.arriveSec) * WORK_BURN;
  }
  // Unreachable: the loop always returns on the last leg.
  throw new Error("positionAt: unreachable");
}
