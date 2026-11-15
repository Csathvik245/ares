// What happens if an emergency starts at a given moment of the EVA.
// One call gives the UI everything it shows in an emergency (Contract 3,
// "Emergencies"): the EVA status, the return-home route and its status, and the
// oxygen numbers. Pure functions, no UI code.

import { abortRoute } from "./abort";
import type { AbortRoute } from "./abort";
import { CONSUMABLE_HOURS, WALK_BURN } from "./constants";
import { buildCostGrid } from "./cost";
import { roundHalfUp } from "./format";
import { planRoute } from "./plan";
import { SHELTER_MODEL_IS_SIMPLIFIED, shelterRoute } from "./shelter";
import { positionAt } from "./timeline";
import type { Position } from "./timeline";
import type { CostGrid, LatLng, Plan, Site, Status, Stop } from "./types";

export type EmergencyKind = "dust" | "spe";

/**
 * The radiation shelter check (shelter.ts). Only a solar particle event is a
 * radiation event, so only then is it run.
 * - checked: false: a dust storm, or the site has no sky-view layer to check with.
 * - checked: true: shelterRoute ran. betterThanHome says whether waiting at a
 *   shielded spot gives a lower dose than walking home. The numbers are for the
 *   recommended option: the shelter when betterThanHome, otherwise the habitat.
 */
export type ShelterCheck =
  | { checked: false }
  | {
      checked: true;
      betterThanHome: boolean;
      /** Where to go: the shelter, or the habitat when home is better. */
      target: LatLng;
      /** Smoothed line from the astronaut to the target. */
      path: LatLng[];
      /** Walking time to the target, seconds. */
      sec: number;
      /** Sky view at the target, 0 to 1 (0 = inside the habitat). */
      skyView: number;
      /** SPE dose for the recommended option over the assumed event, mSv. Illustrative. */
      doseToShelterMsv: number;
      /** SPE dose for walking straight home over the same time, mSv. Illustrative. */
      doseIfHomeMsv: number;
      /** How much lower the shelter's dose is than walking home, percent (0 when home is better). */
      doseReductionPct: number;
      /** Plain sentences from shelterRoute. The first is the recommendation. */
      reasons: string[];
      /** True: the dose model is simplified. Say so next to any shelter number. */
      simplified: boolean;
    };

/** The route to draw as "where to go now": home, or the shelter when it is the better choice. */
export type ReturnRoute = {
  to: "home" | "shelter";
  path: LatLng[];
  /** Walking time along it, seconds. Infinity if home is unreachable. */
  sec: number;
};

export type StormOptions = {
  /**
   * Sky-view layer for the shelter check (see readSkyView in shelter.ts).
   * Default: site.layers.skyView, if the site was loaded with it. Without either,
   * a solar particle event gets shelter: { checked: false }.
   */
  skyView?: Float32Array | null;
};

export type StormOutcome = {
  /** Status of the EVA itself. In an emergency this is NO-GO: the EVA is aborted. */
  evaStatus: Status;
  /** Why. The first reason is "EVA aborted: active dust storm" (or "... solar particle event"). */
  evaReasons: string[];
  /**
   * The return-home route from abortRoute, with its own status (CAUTION or NO-GO) and reasons.
   * Its path always leads HOME, also when a shelter is recommended. In a solar
   * particle event its reasons also carry the shelter check: the shelter reason
   * comes first when a shelter is better, and one "Shelter checked: ..." line is
   * added at the end when walking home is better.
   */
  abort: AbortRoute;
  /** The radiation shelter check. checked: false for a dust storm. */
  shelter: ShelterCheck;
  /** The route to draw: the shelter path when shelter.betterThanHome, otherwise abort.path. */
  returnRoute: ReturnRoute;
  /** Where the astronaut is when the emergency starts. */
  position: Position;
  /** Oxygen left when the emergency starts, % of the full 8 h supply. */
  oxygenNowPct: number;
  /** Oxygen left on reaching the habitat, % of the full supply. 0 if it runs out; NaN if home is unreachable. */
  oxygenOnArrivalPct: number;
  /** Walking time home in minutes (not rounded; format it with formatMinutes(abort.sec)). Infinity if unreachable. */
  walkHomeMin: number;
  /** Oxygen margin above the reserve on arrival, minutes (not rounded). */
  marginMin: number;
  /** Mission elapsed time on reaching the habitat, seconds (tSec + walk home). */
  arriveSec: number;
};

/**
 * Default start time (LMST hours) when the caller does not pass one. It only
 * affects the low-sun reasons in evaReasons, never the route or the oxygen numbers.
 */
export const DEFAULT_START_LMST = 13;

// One emergency grid per site, kind and start time. Reusing the same grid object is
// what lets abortRoute reuse its cached walk-home field (see fields.ts), so dragging
// the storm time along the timeline costs one field, not one per frame.
const gridCache = new WeakMap<Site, Map<string, CostGrid>>();

/**
 * The cost grid for an emergency kind, built once per site, kind and start time
 * and then reused (so its cached fields are reused too). "calm" is the normal
 * grid with no storm or SPE, used by the scenarios in emergencies.ts.
 */
export function emergencyGrid(site: Site, kind: EmergencyKind | "calm", startLmst: number): CostGrid {
  let perSite = gridCache.get(site);
  if (!perSite) gridCache.set(site, (perSite = new Map()));
  const key = `${kind}@${startLmst}`;
  let grid = perSite.get(key);
  if (!grid) {
    grid = buildCostGrid(site, { storm: kind === "dust", spe: kind === "spe", startLmst });
    perSite.set(key, grid);
  }
  return grid;
}

/**
 * The stops a plan was built from, read back out of the plan: each stop sits at the
 * exact end point of its leg, and its science time is the gap before the next leg
 * starts walking. Returns null if a leg has no path (a stop was unreachable).
 */
export function stopsOf(plan: Plan): Stop[] | null {
  const stops: Stop[] = [];
  for (let i = 0; i + 1 < plan.legs.length; i++) {
    const leg = plan.legs[i];
    const next = plan.legs[i + 1];
    const end = leg.path[leg.path.length - 1];
    if (!end) return null;
    const dwellSec = next.arriveSec - next.walkSec - leg.arriveSec;
    stops.push({ id: `stop-${i + 1}`, label: `Stop ${i + 1}`, lat: end.lat, lng: end.lng, dwellMin: Math.max(0, dwellSec) / 60 });
  }
  return stops;
}

/**
 * The outcome of a dust storm ("dust") or solar particle event ("spe") that starts
 * `tSec` seconds into the plan.
 *
 * - position: positionAt(plan, tSec).
 * - abort: abortRoute from that position on the emergency cost grid (a storm slows
 *   walking to 55% and adds 30 min to the reserve; an SPE changes neither).
 * - evaStatus / evaReasons: planRoute for the same stops under the emergency
 *   conditions, which Contract 3 makes NO-GO ("EVA aborted: ...").
 *
 * - shelter (solar particle event only): shelterRoute from the same position on the
 *   same grid. If a shelter beats walking home, returnRoute is the shelter path and the
 *   return reasons start with the shelter reason; the home route stays in `abort`.
 *   A dust storm is not a radiation event, so shelter is { checked: false }.
 *
 * `startLmst` is the EVA start time; pass conditions.startLmst so low-sun reasons are right.
 */
export function stormAt(
  site: Site,
  plan: Plan,
  tSec: number,
  kind: EmergencyKind,
  startLmst: number = DEFAULT_START_LMST,
  options: StormOptions = {},
): StormOutcome {
  const grid = emergencyGrid(site, kind, startLmst);
  const position = positionAt(plan, tSec);
  const hasPosition = Number.isFinite(position.lat) && Number.isFinite(position.lng);
  // An empty plan has no position: the astronaut has not left the habitat.
  const from = hasPosition ? { lat: position.lat, lng: position.lng } : { lat: site.habitat.lat, lng: site.habitat.lng };
  const usedSec = hasPosition ? position.oxygenUsedSec : 0;
  const homeAbort = abortRoute(site, grid, from, usedSec);

  // Radiation shelter check: solar particle events only, and only with a sky-view layer.
  let shelter: ShelterCheck = { checked: false };
  let abort: AbortRoute = homeAbort;
  let returnRoute: ReturnRoute = { to: "home", path: homeAbort.path, sec: homeAbort.sec };
  const skyView = options.skyView ?? (site.layers as Record<string, Float32Array | undefined>).skyView;
  if (kind === "spe" && skyView && skyView.length === site.width * site.height) {
    const found = shelterRoute(site, grid, from, usedSec, { skyView });
    shelter = {
      checked: true,
      betterThanHome: found.betterThanHome,
      target: found.target,
      path: found.path,
      sec: found.sec,
      skyView: found.skyView,
      doseToShelterMsv: found.doseToShelterMsv,
      doseIfHomeMsv: found.doseIfHomeMsv,
      doseReductionPct: found.doseReductionPct,
      reasons: found.reasons,
      simplified: SHELTER_MODEL_IS_SIMPLIFIED,
    };
    if (found.betterThanHome) {
      returnRoute = { to: "shelter", path: found.path, sec: found.sec };
      abort = { ...homeAbort, reasons: [found.reasons[0], ...homeAbort.reasons] };
    } else {
      const hidden =
        found.bestShelterSkyView === null
          ? "no shelter can be reached with the oxygen left"
          : `best nearby shelter hides ${roundHalfUp((1 - found.bestShelterSkyView) * 100)}% of the sky`;
      abort = { ...homeAbort, reasons: [...homeAbort.reasons, `Shelter checked: walking home is better (${hidden}).`] };
    }
  }

  const abortedReason = kind === "dust" ? "EVA aborted: active dust storm" : "EVA aborted: active solar particle event";
  const stops = stopsOf(plan);
  let evaStatus: Status = "NO-GO";
  let evaReasons: string[] = [abortedReason];
  if (stops) {
    const emergencyPlan = planRoute(site, grid, site.habitat, stops);
    evaStatus = emergencyPlan.status;
    evaReasons = emergencyPlan.reasons;
  }

  const budgetSec = CONSUMABLE_HOURS * 3600;
  const elapsedSec = Math.max(0, Math.min(tSec, plan.totalSec));
  const reachable = Number.isFinite(abort.sec);
  return {
    evaStatus,
    evaReasons,
    abort,
    shelter,
    returnRoute,
    position,
    oxygenNowPct: Math.max(0, ((budgetSec - usedSec) / budgetSec) * 100),
    oxygenOnArrivalPct: reachable ? Math.max(0, ((budgetSec - usedSec - abort.sec * WALK_BURN) / budgetSec) * 100) : NaN,
    walkHomeMin: abort.sec / 60,
    marginMin: abort.marginSec / 60,
    arriveSec: elapsedSec + abort.sec,
  };
}
