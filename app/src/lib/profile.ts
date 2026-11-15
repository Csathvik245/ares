// Elevation along the planned walk, for the ElevationProfile strip.
// Pure functions, no UI. Reads the plan and the site; changes neither.

import { cellIndexOf, distanceM, positionAt } from "../planner";
import type { LatLng, Plan, Site } from "../planner";

/** Target spacing between samples, meters (one grid cell). */
export const PROFILE_STEP_M = 25;

export type ProfilePoint = {
  /** Distance walked from the habitat along the drawn route, meters. */
  distM: number;
  /** Site elevation at this point, meters (from the HiRISE DTM layer). */
  elevM: number;
  /** Which leg of the plan this sample is on. */
  legIndex: number;
};

export type ElevationProfileData = {
  points: ProfilePoint[];
  /** Where each stop sits along the profile. `index` is 0-based (stop 01 = index 0). */
  stops: { index: number; distM: number }[];
  /** Start distance of each leg along the profile, plus the total as the last entry. */
  legStartM: number[];
  totalM: number;
  minElevM: number;
  maxElevM: number;
};

/** Number of samples a path of this length gets: both ends, and one about every 25 m between. */
export function sampleCount(lengthM: number): number {
  return Math.max(1, Math.ceil(lengthM / PROFILE_STEP_M)) + 1;
}

function lengthOf(path: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += distanceM(path[i - 1], path[i]);
  return total;
}

/** Point `targetM` meters along a polyline. */
function pointAtDistance(path: LatLng[], targetM: number): LatLng {
  let walked = 0;
  for (let i = 1; i < path.length; i++) {
    const seg = distanceM(path[i - 1], path[i]);
    if (walked + seg >= targetM && seg > 0) {
      const t = (targetM - walked) / seg;
      const a = path[i - 1];
      const b = path[i];
      return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
    }
    walked += seg;
  }
  return path[path.length - 1];
}

/**
 * Elevation samples along every leg of the plan, about every 25 m, measured along the
 * DRAWN (smoothed) leg paths. Each leg is sampled from its exact start to its exact end,
 * so the first and last points of a full plan are at the habitat.
 *
 * Distances here follow the drawn line, so the total is a little shorter than
 * plan.distM, which is measured along the grid path (see Contract 4, "Leg paths").
 *
 * Legs with no path (unreachable) add no samples. Points with no elevation data are skipped.
 */
export function elevationProfile(site: Site, plan: Plan): ElevationProfileData {
  const points: ProfilePoint[] = [];
  const stops: { index: number; distM: number }[] = [];
  const legStartM: number[] = [];
  let offsetM = 0;
  let minElevM = Infinity;
  let maxElevM = -Infinity;

  plan.legs.forEach((leg, legIndex) => {
    legStartM.push(offsetM);
    if (leg.path.length > 0) {
      const lengthM = lengthOf(leg.path);
      const n = sampleCount(lengthM);
      for (let k = 0; k < n; k++) {
        const along = (lengthM * k) / (n - 1);
        const p = k === n - 1 ? leg.path[leg.path.length - 1] : pointAtDistance(leg.path, along);
        const cell = cellIndexOf(site, p);
        const elevM = cell >= 0 ? site.layers.elevation[cell] : NaN;
        if (Number.isNaN(elevM)) continue;
        points.push({ distM: offsetM + along, elevM, legIndex });
        if (elevM < minElevM) minElevM = elevM;
        if (elevM > maxElevM) maxElevM = elevM;
      }
      offsetM += lengthM;
    }
    // Every leg except the last one ends at a stop.
    if (legIndex < plan.legs.length - 1) stops.push({ index: legIndex, distM: offsetM });
  });
  legStartM.push(offsetM);

  return { points, stops, legStartM, totalM: offsetM, minElevM, maxElevM };
}

/**
 * Distance along the profile (meters) at `tSec` seconds into the EVA.
 * positionAt says which leg the astronaut is on and whether they are walking or at a
 * stop; inside a walking leg the pace is even, the same assumption positionAt makes.
 * Returns NaN for an empty plan.
 */
export function profileDistanceAt(plan: Plan, profile: ElevationProfileData, tSec: number): number {
  const pos = positionAt(plan, tSec);
  const leg = plan.legs[pos.legIndex];
  if (!leg) return NaN;
  const startM = profile.legStartM[pos.legIndex];
  const endM = profile.legStartM[pos.legIndex + 1];
  if (pos.phase === "science") return endM;
  const t = Math.min(Math.max(tSec, 0), plan.totalSec);
  const walked = Math.min(Math.max(0, t - (leg.arriveSec - leg.walkSec)), leg.walkSec);
  const fraction = leg.walkSec > 0 ? walked / leg.walkSec : 1;
  return startM + (endM - startM) * fraction;
}
