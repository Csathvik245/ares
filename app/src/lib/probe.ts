// What the map's cursor probe says about the ground under the pointer: can it be walked
// on, and if not, why not. No React here, so it can be tested directly.
//
// The yes/no answer is the planner's own (groundProblem and walkingSpeedMps from
// planner/cost.ts); this file only puts it into words. It changes no planner rule.
import { BASE_SPEED_KMH, MAX_SLOPE_DEG, ROCK_NO_GO, roundHalfUp, walkingSpeedMps, type Site } from "../planner";
import { groundProblem } from "../planner/cost";

export type ProbeVerdict = {
  /** False when the planner will not route across this cell. */
  walkable: boolean;
  /** One short line, for example "No-go: slope 31° is over the 25° limit". */
  text: string;
};

/**
 * A slowdown is named in the "Walkable" line only when it costs at least this share of
 * the flat-ground speed. ASSUMPTION: a display choice (a 2% slowdown is not worth a word),
 * not a planner rule.
 */
export const PROBE_SLOWDOWN_WORTH_NAMING = 0.05;

/** Where each value in the probe comes from, shown as a small tag after the value. */
export const PROBE_SOURCES = {
  elevation: "HiRISE",
  slope: "HiRISE",
  ground: "THEMIS",
  science: "CRISM",
  walkHome: "calculated",
} as const;

/** The verdict for one cell of the site (calm conditions). `cell` is -1 outside the map. */
export function probeVerdict(site: Site, cell: number): ProbeVerdict {
  const problem = groundProblem(site, cell);
  if (problem) {
    const slope = site.layers.slope[cell];
    const rock = site.layers.rock[cell];
    // Same order of checks as groundProblem, so the reason given is the planner's reason.
    if (!(cell >= 0) || cell >= site.width * site.height) return { walkable: false, text: "No-go: outside the mapped area" };
    if (Number.isNaN(slope) || Number.isNaN(rock)) return { walkable: false, text: "No-go: no terrain data here" };
    if (slope > MAX_SLOPE_DEG) return { walkable: false, text: `No-go: slope ${roundHalfUp(slope)}° is over the ${MAX_SLOPE_DEG}° limit` };
    if (rock > ROCK_NO_GO) return { walkable: false, text: `No-go: roughness ${roundHalfUp(rock, 2).toFixed(2)} is over the ${ROCK_NO_GO} limit` };
    return { walkable: false, text: `No-go: this spot ${problem}` };
  }

  const slope = site.layers.slope[cell];
  const rock = site.layers.rock[cell];
  const ti = site.layers.thermalInertia[cell];
  const flat = BASE_SPEED_KMH / 3.6;
  const share = walkingSpeedMps(slope, rock, ti, false) / flat;
  // Each cause on its own, from the planner's speed formula: how much of the flat-ground speed it leaves.
  const causes: [string, number][] = [
    ["slope", walkingSpeedMps(slope, 0, Infinity, false) / flat],
    ["soft sand", walkingSpeedMps(0, 0, ti, false) / flat],
    ["rough ground", walkingSpeedMps(0, rock, Infinity, false) / flat],
  ];
  const named = causes
    .filter(([, left]) => left <= 1 - PROBE_SLOWDOWN_WORTH_NAMING)
    .sort((a, b) => a[1] - b[1])
    .map(([name]) => name);
  if (named.length === 0) return { walkable: true, text: "Walkable: firm, gentle ground" };
  return { walkable: true, text: `Walkable: ${roundHalfUp(share * 100)}% of flat-ground speed (${named.join(", ")})` };
}
