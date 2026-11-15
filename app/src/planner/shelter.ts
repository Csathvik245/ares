// Radiation shelter routing for a solar particle event (SPE).
//
// Cliffs and crater walls hide part of the sky, and with it part of the radiation
// arriving from that part of the sky. In an SPE the usual answer is "walk home".
// This asks one more question: is there a spot nearby where waiting under less open
// sky gives a LOWER total dose than walking straight home?
//
// THE MODEL IS SIMPLIFIED (SHELTER_MODEL_IS_SIMPLIFIED). It assumes:
//   - the SPE radiation arrives about equally from all directions of the sky, so
//     the dose rate at a spot = SPE dose rate x skyView (the open fraction of the sky);
//   - the atmosphere shields every direction the same, and secondary particles made
//     in the ground and the rock walls are ignored;
//   - the SPE dose rate itself is ILLUSTRATIVE (SPE_IS_ILLUSTRATIVE in constants.ts);
//   - the event lasts a fixed time from the moment it starts (60 min by default). The
//     astronaut walks to the shelter and waits there for the rest of that time;
//   - HAB-1 is full shelter: no SPE dose once inside.
// See docs/assumptions.md, "Shelter model". It compares two options under the same
// assumptions over the same 60 minutes. It is not a dose prediction.
//
// Deterministic, like the rest of the planner: no ML. Pure functions, no UI code.

import { SPE_IS_ILLUSTRATIVE, WALK_BURN, WORK_BURN } from "./constants";
import { doseRateMsvPerHr } from "./env";
import { fieldFrom } from "./fields";
import { formatDose, formatMinutes, roundHalfUp } from "./format";
import { distanceM, smoothPath } from "./geom";
import { oxygenBudget } from "./oxygen";
import { pathTo } from "./search";
import { cellCenter, cellIndexOf } from "./site";
import type { CostGrid, LatLng, Site } from "./types";

/** True: the shelter dose model is a simplification. The UI must say so next to any shelter number. */
export const SHELTER_MODEL_IS_SIMPLIFIED = true;
/**
 * ASSUMPTION: how long the event lasts from the moment it starts, minutes. The
 * astronaut waits at the shelter until this time is up, so the wait is this window
 * minus the walk there. Not a measured SPE duration: real events build up and fade
 * over hours.
 */
export const DEFAULT_WAIT_MIN = 60;
/**
 * ASSUMPTION: a shelter is recommended only if it cuts the dose by at least this much,
 * percent. A smaller difference is inside what this simplified model can tell apart,
 * and sitting out an hour away from the habitat has costs the model does not count.
 */
export const MIN_DOSE_REDUCTION_PCT = 5;
/**
 * ASSUMPTION: oxygen use while waiting at the shelter, as a multiple of the nominal
 * rate. There is no measured value for sheltering, so the planner's rate for working
 * at a stop is reused; resting should need less, which makes this the cautious choice.
 */
export const SHELTER_WAIT_BURN = WORK_BURN;

export type ShelterOptions = {
  /** Event window in minutes: walk to the shelter, then wait there until it is up. Default 60. */
  waitMin?: number;
  /** Smallest dose cut, in percent, that makes a shelter worth recommending. Default 5. */
  minReductionPct?: number;
  /** Sky-view layer, one value per cell (0 to 1). Default: site.layers.skyView, see readSkyView. */
  skyView?: Float32Array;
};

export type ShelterRoute = {
  /** Where to go: the shelter cell's centre, or the habitat when home is the better choice. */
  target: LatLng;
  /** Smoothed line from `from` to the target (crosses passable cells only). Empty if there is nowhere to go. */
  path: LatLng[];
  /** Walking time to the target, seconds. */
  sec: number;
  /** Sky view at the target, 0 to 1. 0 when the target is the habitat (inside = full shelter). */
  skyView: number;
  /** SPE dose over the event window for the chosen option (walk there, then wait), mSv. Illustrative. */
  doseToShelterMsv: number;
  /** SPE dose over the same window for walking straight home, mSv. Illustrative. Infinity if home cannot be reached. */
  doseIfHomeMsv: number;
  /** How much lower the chosen option's dose is than walking home, percent (0 when home is chosen). */
  doseReductionPct: number;
  /** True only when a shelter gives a total dose at least 5% lower than walking straight home. */
  betterThanHome: boolean;
  /**
   * Sky view of the best shelter that was considered, even when walking home won
   * (then `skyView` above is 0, for the habitat). null if no shelter could be reached.
   */
  bestShelterSkyView: number | null;
  /** Plain sentences for the UI. The first one is the recommendation. */
  reasons: string[];
};

/**
 * The skyView layer from the parsed site.json, as a Float32Array (missing = NaN).
 * loadSite keeps only the five Contract 1 layers, so shelter routing reads this one itself:
 *   const site = loadSite(json);
 *   const skyView = readSkyView(json);            // then pass { skyView } to shelterRoute
 * Returns null if the file has no skyView layer of the right length.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function readSkyView(json: any): Float32Array | null {
  const raw = json?.layers?.skyView;
  const count = json?.width * json?.height;
  if (!Array.isArray(raw) || raw.length !== count) return null;
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) out[i] = typeof raw[i] === "number" ? raw[i] : NaN;
  return out;
}

const pct = (v: number) => `${roundHalfUp(v, 0)}%`;
const sky2 = (v: number) => roundHalfUp(v, 2).toFixed(2);

/**
 * Where to go in a solar particle event to take the lowest total dose.
 *
 * `cost` is the planner's cost grid for the SPE conditions
 * (buildCostGrid(site, { ...conditions, spe: true })); the same no-go rules apply.
 * `from` and `oxygenUsedSec` are the astronaut's position and oxygen used so far
 * (both from positionAt).
 *
 * How it works. Every option is judged over the same event window (60 min by default):
 * 1. One full-field Dijkstra from `from` gives the walking time and the path to every cell.
 * 2. Dose on the way = SPE dose rate x sky view x time, added up step by step along
 *    that path (each step uses the sky view of the two cells it joins).
 * 3. Dose for a shelter = dose on the way + SPE dose rate x sky view there x the time
 *    left in the window after arriving.
 * 4. A cell is a candidate only if it is passable, can be reached inside the window,
 *    and the oxygen is enough to walk there, wait, AND still walk home with the reserve
 *    intact. (A shelter you cannot get home from is not a shelter.) The walk-home times
 *    come from the cached habitat field, the same one abortRoute uses.
 * 5. Walking straight home: dose on the way home, for as much of the walk as falls
 *    inside the window; nothing once inside the habitat.
 * 6. The candidate with the lowest dose is recommended only if it cuts the dose by at
 *    least 5% (MIN_DOSE_REDUCTION_PCT). Otherwise the answer is: walk home.
 *
 * If no shelter beats home, the target is the habitat and betterThanHome is false.
 * Every number is finite except doseIfHomeMsv, which is Infinity when home cannot be reached.
 * Throws if there is no sky-view layer (pass opts.skyView or build it with pipeline/build_shielding.py).
 */
export function shelterRoute(
  site: Site,
  cost: CostGrid,
  from: LatLng,
  oxygenUsedSec: number,
  opts: ShelterOptions = {},
): ShelterRoute {
  const sky = opts.skyView ?? (site.layers as Record<string, Float32Array | undefined>).skyView;
  const count = site.width * site.height;
  if (!sky || sky.length !== count) {
    throw new Error("shelterRoute: no skyView layer. Pass opts.skyView (see readSkyView) or run pipeline/build_shielding.py.");
  }
  const windowMin = Number.isFinite(opts.waitMin) && opts.waitMin! >= 0 ? opts.waitMin! : DEFAULT_WAIT_MIN;
  const windowSec = windowMin * 60;
  const minReductionPct =
    Number.isFinite(opts.minReductionPct) && opts.minReductionPct! >= 0 ? opts.minReductionPct! : MIN_DOSE_REDUCTION_PCT;
  const ratePerSec = doseRateMsvPerHr(true) / 3600; // mSv per second under open sky during the SPE
  const habitat: LatLng = { lat: site.habitat.lat, lng: site.habitat.lng };
  const homeCell = cellIndexOf(site, habitat);
  const fromCell = cellIndexOf(site, from);
  const notes = [
    `Simplified shelter model: dose is taken to scale with the open sky, over an assumed ${windowMin} min event.`,
    ...(SPE_IS_ILLUSTRATIVE ? ["The SPE dose rate is illustrative, not a measured value."] : []),
  ];

  if (fromCell < 0 || cost.secPerM[fromCell] === Infinity) {
    return {
      target: { lat: from.lat, lng: from.lng },
      path: [],
      sec: 0,
      skyView: 0,
      doseToShelterMsv: 0,
      doseIfHomeMsv: Infinity,
      doseReductionPct: 0,
      betterThanHome: false,
      bestShelterSkyView: null,
      reasons: [
        fromCell < 0
          ? "No shelter route: the astronaut is outside the mapped site."
          : "No shelter route: the astronaut's position is on no-go terrain, so no path can be worked out.",
      ],
    };
  }

  const field = fieldFrom(cost, fromCell);
  const toCell = field.cost; // walking seconds from `from`
  const cameFrom = field.cameFrom;
  const homeReachable = homeCell >= 0 && toCell[homeCell] !== Infinity;
  const toHome = homeReachable ? fieldFrom(cost, homeCell).cost : null; // costs are symmetric

  // Sky view used for dose on the way: missing data counts as fully open sky (the cautious choice).
  const open = (cell: number) => (Number.isNaN(sky[cell]) ? 1 : sky[cell]);

  // Dose (mSv) picked up walking from `from` to each cell, along the Dijkstra path.
  // Each cell's value is its parent's plus one step, so fill parents first: walk up
  // the path until a known cell, then come back down. Every cell is visited once.
  const walkDose = new Float64Array(count).fill(-1);
  walkDose[fromCell] = 0;
  const stack = new Int32Array(count);
  for (let cell = 0; cell < count; cell++) {
    if (toCell[cell] === Infinity || walkDose[cell] >= 0) continue;
    let top = 0;
    let c = cell;
    while (walkDose[c] < 0) {
      stack[top++] = c;
      c = cameFrom[c];
    }
    while (top > 0) {
      const child = stack[--top];
      const parent = cameFrom[child];
      walkDose[child] = walkDose[parent] + ratePerSec * (toCell[child] - toCell[parent]) * 0.5 * (open(parent) + open(child));
    }
  }

  // Oxygen (Contract 2): walking burns WALK_BURN, waiting burns SHELTER_WAIT_BURN.
  const budget = oxygenBudget(cost.conditions.storm);
  const oxygenLeftSec = budget.usableSec - oxygenUsedSec;

  let best = -1;
  let bestDose = Infinity;
  for (let cell = 0; cell < count; cell++) {
    const walkSec = toCell[cell];
    // Reachable inside the event window, passable, and not the habitat itself.
    if (walkSec > windowSec || cost.secPerM[cell] === Infinity || cell === homeCell) continue;
    if (Number.isNaN(sky[cell])) continue; // no sky-view data: not offered as a shelter
    const homeSec = toHome ? toHome[cell] : 0; // home unreachable from anywhere: the return leg cannot be checked
    if (homeSec === Infinity) continue;
    const waitSec = windowSec - walkSec;
    if (oxygenLeftSec - (walkSec + homeSec) * WALK_BURN - waitSec * SHELTER_WAIT_BURN < 0) continue;
    const dose = walkDose[cell] + ratePerSec * sky[cell] * waitSec;
    // Lowest dose wins; ties go to the shorter walk (then the lower cell index).
    if (dose < bestDose || (dose === bestDose && best >= 0 && walkSec < toCell[best])) {
      best = cell;
      bestDose = dose;
    }
  }

  // Walking straight home: exposed on the way for as long as the event lasts, 0 once inside.
  const homeSec = homeReachable ? toCell[homeCell] : Infinity;
  const homePathCells = homeReachable ? pathTo(field, homeCell) : [];
  let doseIfHome = Infinity;
  if (homeReachable) {
    doseIfHome = walkDose[homeCell];
    if (homeSec > windowSec) {
      // The event ends partway home: find the step it ends in and take that share of the step.
      for (let i = 1; i < homePathCells.length; i++) {
        const a = homePathCells[i - 1];
        const b = homePathCells[i];
        if (toCell[b] >= windowSec) {
          const share = toCell[b] > toCell[a] ? (windowSec - toCell[a]) / (toCell[b] - toCell[a]) : 0;
          doseIfHome = walkDose[a] + (walkDose[b] - walkDose[a]) * share;
          break;
        }
      }
    }
  }

  const goHome = (why: string[]): ShelterRoute => ({
    target: habitat,
    path: homeReachable ? smoothPath(site, cost, homePathCells, from, habitat) : [],
    sec: homeReachable ? homeSec : 0,
    skyView: 0,
    doseToShelterMsv: homeReachable ? doseIfHome : 0,
    doseIfHomeMsv: doseIfHome,
    doseReductionPct: 0,
    betterThanHome: false,
    bestShelterSkyView: best >= 0 ? sky[best] : null,
    reasons: [...why, ...notes],
  });

  if (best < 0) {
    return goHome([
      homeReachable
        ? `Walk home (${formatMinutes(homeSec)}): no shelter can be reached with enough oxygen to wait out the event and still get home.`
        : "No shelter route: neither the habitat nor a shelter can be reached from here.",
    ]);
  }

  const shelterSec = toCell[best];
  // Home unreachable: any reachable shelter is better than none.
  const reduction = Number.isFinite(doseIfHome) ? (doseIfHome > 0 ? (1 - bestDose / doseIfHome) * 100 : 0) : 100;
  // Costs are 32-bit, so two equal doses can differ by rounding noise: that is not a reduction.
  if (!(reduction > 1e-6 && reduction >= minReductionPct)) {
    return goHome([
      `Walk home (${formatMinutes(homeSec)}, SPE dose ${formatDose(doseIfHome)}): no shelter cuts the dose by ${minReductionPct}% or more. ` +
        `The best one (sky view ${sky2(sky[best])}, ${formatMinutes(shelterSec)} away) would give ${formatDose(bestDose)}.`,
    ]);
  }

  const target = cellCenter(site, best);
  const metres = Math.round(distanceM(from, target) / 10) * 10;
  const reasons = [
    Number.isFinite(doseIfHome)
      ? `Shelter ${metres} m away (sky view ${sky2(sky[best])}) cuts the SPE dose by ${pct(reduction)} compared with walking home (${formatMinutes(homeSec)}).`
      : `Shelter ${metres} m away (sky view ${sky2(sky[best])}): the habitat cannot be reached from here, so this is the least-exposed spot in reach.`,
    `${formatMinutes(shelterSec)} walk, then wait ${formatMinutes(windowSec - shelterSec)}: SPE dose ${formatDose(bestDose)}` +
      (Number.isFinite(doseIfHome) ? ` instead of ${formatDose(doseIfHome)} walking home over the same ${windowMin} min.` : "."),
    ...(toHome
      ? [`Oxygen is enough to walk home afterwards (${formatMinutes(toHome[best])}) with the ${formatMinutes(budget.reserveSec)} reserve intact.`]
      : []),
    ...notes,
  ];
  return {
    target,
    path: smoothPath(site, cost, pathTo(field, best), from, target),
    sec: shelterSec,
    skyView: sky[best],
    doseToShelterMsv: bestDose,
    doseIfHomeMsv: doseIfHome,
    doseReductionPct: Number.isFinite(doseIfHome) ? reduction : 0,
    betterThanHome: true,
    bestShelterSkyView: sky[best],
    reasons,
  };
}
