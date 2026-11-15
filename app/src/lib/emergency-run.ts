// One place where the UI starts any emergency and turns the planner's answer into
// what the existing emergency screens already draw (a route, its time, its margin, a
// playback plan). Display adapter only: every number comes from stormAt or scenarioAt.
//
//   "storm" / "spe"                           -> stormAt, exactly as before.
//   "oxygen-loss" / "slow-walk" / "blocked-path" -> scenarioAt, which RE-PLANS the rest
//                                                of the EVA (and may drop stops).
import {
  CONSUMABLE_HOURS,
  MARS_RADIUS_M,
  formatMinutes,
  scenarioAt,
  stormAt,
  type AbortRoute,
  type LatLng,
  type Plan,
  type ScenarioKind,
  type ScenarioOutcome,
  type Site,
  type Stop,
  type StormOutcome,
} from "./planner";
import { returnPlaybackPlan } from "./return-playback";

export type UiEmergencyKind = "storm" | "spe" | ScenarioKind;

/** The three re-planning emergencies, in button order. */
export const SCENARIO_BUTTONS: { kind: ScenarioKind; label: string }[] = [
  { kind: "oxygen-loss", label: "Oxygen loss" },
  { kind: "slow-walk", label: "Slower walking" },
  { kind: "blocked-path", label: "Path blocked" },
];

/** Words for each emergency: the alert title, the short timeline label, and one line of context. */
export const EMERGENCY_TEXT: Record<UiEmergencyKind, { title: string; short: string; note: string }> = {
  storm: { title: "DUST STORM", short: "Storm", note: "Low visibility and visor dust slow walking." },
  spe: { title: "SOLAR RADIATION STORM (SPE)", short: "SPE", note: "Illustrative SPE dose rate ×30." },
  "oxygen-loss": { title: "OXYGEN LEAK", short: "O₂ leak", note: "Illustrative: 25% of the oxygen left is lost at once." },
  "slow-walk": { title: "SLOWER WALKING", short: "Slow walk", note: "Illustrative: walking speed drops to 70% of normal." },
  "blocked-path": { title: "PATH BLOCKED", short: "Blocked", note: "Illustrative: ground within 75 m of a point ahead is impassable." },
};

export const isScenarioKind = (kind: UiEmergencyKind): kind is ScenarioKind => kind !== "storm" && kind !== "spe";

/** True for an outcome that came from scenarioAt (it carries the re-planned route). */
export function isScenario(outcome: StormOutcome | null | undefined): outcome is ScenarioOutcome {
  return !!outcome && "route" in outcome && "before" in outcome && "after" in outcome;
}

/** True when the EVA goes on along a new plan (not aborted, and the new plan can be walked). */
export function isReplanned(outcome: StormOutcome | null | undefined): outcome is ScenarioOutcome {
  return isScenario(outcome) && !outcome.aborted && outcome.route.ok && outcome.route.legs.length > 0;
}

/**
 * Run an emergency that starts `atSec` seconds into `plan`.
 * Dust storm and SPE: the result is stormAt's, untouched.
 * The re-planning kinds: scenarioAt's result with default sizes, with one change for
 * display: position.oxygenUsedSec also counts oxygen LOST in the emergency, so the
 * existing "oxygen used so far" sums on every screen include it.
 */
export function runEmergency(
  site: Site,
  plan: Plan,
  atSec: number,
  kind: UiEmergencyKind,
  options: { startLmst: number; skyView?: Float32Array | null; stops?: Stop[] },
): StormOutcome | ScenarioOutcome {
  if (!isScenarioKind(kind)) {
    return stormAt(site, plan, atSec, kind === "storm" ? "dust" : "spe", options.startLmst, { skyView: options.skyView });
  }
  const outcome = scenarioAt(site, plan, atSec, kind, { startLmst: options.startLmst, stops: options.stops });
  const fullSec = CONSUMABLE_HOURS * 3600;
  const usedNowSec = fullSec * (1 - outcome.oxygenNowPct / 100);
  return { ...outcome, position: { ...outcome.position, oxygenUsedSec: Math.max(outcome.position.oxygenUsedSec, usedNowSec) } };
}

/**
 * What the emergency screens draw and play back.
 * - abort: the course to follow now (path, time, margin, status, reasons).
 * - returnPlan: the same course as a plan the timeline can play from 0.
 *
 * Dust storm, SPE and any ABORTED scenario: the walk home from abortRoute, as before.
 * A re-planned scenario: the new route through the kept stops and home, with the EVA's
 * own status and reasons.
 */
export function emergencyCourse(outcome: StormOutcome, storm: boolean): { abort: AbortRoute; returnPlan: Plan | null } {
  if (!isReplanned(outcome)) {
    return { abort: outcome.abort, returnPlan: returnPlaybackPlan(outcome.abort, outcome.position.oxygenUsedSec, storm) };
  }
  const { route } = outcome;
  return {
    abort: {
      path: route.legs.flatMap((leg) => leg.path),
      sec: route.totalSec,
      marginSec: outcome.after.marginSec,
      status: outcome.evaStatus,
      reasons: outcome.evaReasons,
    },
    // route.oxygenUsedSec counts everything since the EVA began; the screens add the
    // oxygen used before the emergency themselves, so the playback plan holds only the rest.
    returnPlan: { ...route, oxygenUsedSec: Math.max(0, route.oxygenUsedSec - outcome.position.oxygenUsedSec) },
  };
}

/**
 * One small line for the option ARES did NOT recommend, or null when there is none:
 * "Riskier option: continue to Delta front toe, 31 min margin".
 */
export function alternativeLine(outcome: StormOutcome | null | undefined): string | null {
  if (!isScenario(outcome) || !outcome.alternative) return null;
  const { stops, marginSec } = outcome.alternative;
  return `Riskier option: continue to ${stops.map((s) => s.label).join(", ")}, ${formatMinutes(marginSec)} margin`;
}

/** Outline of a circle on the ground, as map points (for the blocked area). */
export function circleOutline(at: LatLng, radiusM: number, points = 48): LatLng[] {
  const toDeg = 180 / Math.PI;
  const dLat = (radiusM / MARS_RADIUS_M) * toDeg;
  const dLng = dLat / Math.cos(at.lat / toDeg);
  return Array.from({ length: points }, (_, i) => {
    const a = (2 * Math.PI * i) / points;
    return { lat: at.lat + dLat * Math.sin(a), lng: at.lng + dLng * Math.cos(a) };
  });
}
