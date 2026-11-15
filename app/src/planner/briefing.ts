// The pre-EVA briefing: five GO / CAUTION / NO-GO rows for the opening page, each
// with a short value and a tag saying how far the number can be trusted.
// Pure functions, no UI code. All numbers are formatted with format.ts.

import { SOL_HOURS, SPE_MULTIPLIER, STORM_EXTRA_RESERVE_MIN, STORM_SPEED_FACTOR } from "./constants";
import { SUN_CAUTION_DEG, doseRateMsvPerHr, envAt } from "./env";
import { explainSegment } from "./explain";
import { formatDose, formatLmst, formatMinutes, formatPct, roundHalfUp } from "./format";
import { isLowMargin, oxygenBudget } from "./oxygen";
import type { Conditions, Plan, Site, Status } from "./types";

/**
 * How far a number can be trusted. The same four levels are used in docs/parameters.md.
 *   OBSERVED    — measured by an instrument (for example the orbital terrain layers)
 *   CALCULATED  — worked out by the planner from observed data and stated rules
 *   INTERPRETED — a reading of measured data that depends on a judgement about what
 *                 it means: the CRISM clay and carbonate detection, and the science
 *                 score built on it
 *   ASSUMED     — rests on an assumption we chose (see docs/assumptions.md)
 */
export type Evidence = "OBSERVED" | "CALCULATED" | "INTERPRETED" | "ASSUMED";

/**
 * Evidence level for anything that comes from the science layer: the CRISM clay and
 * carbonate detection, a stop's science value and its science score. The briefing has
 * no science row, so this is here for the UI to tag those numbers the same way.
 */
export const SCIENCE_EVIDENCE: Evidence = "INTERPRETED";

/** MONITOR = nothing wrong now, but keep watching (used for weather). It counts as GO overall. */
export type BriefingStatus = Status | "MONITOR";

export type BriefingRow = {
  key: "TERRAIN" | "CONSUMABLES" | "RADIATION" | "LIGHTING" | "WEATHER";
  status: BriefingStatus;
  /** Short text for the row, already formatted. */
  value: string;
  evidence: Evidence;
};

export type Briefing = {
  rows: BriefingRow[];
  /** Overall status by Contract 3: the worst row (MONITOR counts as GO). */
  status: Status;
  /** The value text of every row that is not GO / MONITOR; empty when the overall status is GO. */
  reasons: string[];
};

const degrees = (deg: number) => `${deg < 0 ? "−" : ""}${roundHalfUp(Math.abs(deg), 1).toFixed(1)}°`;

/**
 * Builds the briefing for a plan.
 * `conditions` should be the ones the plan was made with (start time, storm, SPE).
 *
 * Rows and their Contract 3 rules:
 *   TERRAIN     NO-GO if any stop is unreachable. Shows the steepest slope and the
 *               share of soft sand on the cells the drawn route crosses.
 *   CONSUMABLES NO-GO if the oxygen margin is negative; CAUTION if it is under 25%
 *               of the usable budget.
 *   RADIATION   NO-GO during a solar particle event (the EVA is aborted). Shows the
 *               dose the EVA would add at the current dose rate.
 *   LIGHTING    CAUTION if the sun drops below 10° at any time during the EVA
 *               (checked every minute with envAt).
 *   WEATHER     NO-GO during a dust storm (the EVA is aborted); otherwise MONITOR.
 */
export function computeBriefing(
  site: Site,
  plan: Plan,
  conditions: Conditions,
  /** "What if?" oxygen overrides the plan was made with (whatif.ts). Leave out for the planner's constants. */
  overrides: { consumableHours?: number; reserveMin?: number } = {},
): Briefing {
  const rows: BriefingRow[] = [];
  const hasRoute = plan.legs.length > 0;

  // ---- TERRAIN: what the route actually crosses --------------------------------
  if (!plan.ok) {
    rows.push({ key: "TERRAIN", status: "NO-GO", value: "A stop cannot be reached on safe ground", evidence: "CALCULATED" });
  } else if (!hasRoute) {
    rows.push({ key: "TERRAIN", status: "GO", value: "No route yet", evidence: "CALCULATED" });
  } else {
    let maxSlope = 0;
    let sandM = 0;
    let totalM = 0;
    plan.legs.forEach((leg, i) => {
      if (leg.path.length < 2) return; // a stop in the same cell: nothing walked
      const facts = explainSegment(site, plan, i);
      maxSlope = Math.max(maxSlope, facts.maxSlopeDeg);
      sandM += facts.sandFraction * leg.distM;
      totalM += leg.distM;
    });
    const sandPct = totalM > 0 ? (sandM / totalM) * 100 : 0;
    rows.push({
      key: "TERRAIN",
      status: "GO",
      value: `Max slope ${degrees(maxSlope)} · soft sand ${formatPct(sandPct)} of route`,
      evidence: "OBSERVED",
    });
  }

  // ---- CONSUMABLES: oxygen margin against the reserve ----------------------------
  const budget = oxygenBudget(conditions.storm, overrides);
  const consumables: Status = plan.marginSec < 0 ? "NO-GO" : isLowMargin(plan.marginSec, budget) ? "CAUTION" : "GO";
  rows.push({
    key: "CONSUMABLES",
    status: consumables,
    value:
      plan.marginSec < 0
        ? `Oxygen short by ${formatMinutes(-plan.marginSec)} after the ${formatMinutes(budget.reserveSec)} reserve`
        : `Margin ${formatMinutes(plan.marginSec)} above the ${formatMinutes(budget.reserveSec)} reserve · ${formatPct(plan.oxygenAtReturnPct)} oxygen at return`,
    evidence: "CALCULATED",
  });

  // ---- RADIATION: dose this EVA would add ------------------------------------------
  const doseMsv = doseRateMsvPerHr(conditions.spe) * (plan.totalSec / 3600);
  rows.push({
    key: "RADIATION",
    status: conditions.spe ? "NO-GO" : "GO",
    value: conditions.spe
      ? `Solar particle event: EVA aborted · ${formatDose(doseMsv)} if the full EVA were walked (illustrative ×${SPE_MULTIPLIER} dose rate)`
      : `Projected EVA dose ${formatDose(doseMsv)}`,
    // The quiet-time rate is measured (Curiosity RAD, Hassler et al. 2014) and applied to Jezero.
    // The event rate uses SPE_MULTIPLIER, which is illustrative (SPE_IS_ILLUSTRATIVE).
    evidence: conditions.spe ? "ASSUMED" : "CALCULATED",
  });

  // ---- LIGHTING: lowest sun during the EVA ---------------------------------------------
  if (!Number.isFinite(conditions.startLmst)) {
    rows.push({ key: "LIGHTING", status: "MONITOR", value: "Start time not set, so the sun cannot be checked", evidence: "CALCULATED" });
  } else if (!hasRoute) {
    const now = envAt(conditions.startLmst, conditions.spe).sunElevationDeg;
    rows.push({
      key: "LIGHTING",
      status: "GO",
      value: `Sun ${degrees(now)} at ${formatLmst(conditions.startLmst)} LMST`,
      evidence: "CALCULATED",
    });
  } else {
    const lmstPerSec = 24 / (SOL_HOURS * 3600); // the Mars clock runs slightly slower than Earth seconds
    let lowest = Infinity;
    let lowestLmst = conditions.startLmst;
    for (let t = 0; t <= Math.ceil(plan.totalSec / 60) * 60; t += 60) {
      const lmst = conditions.startLmst + t * lmstPerSec;
      const elevation = envAt(lmst, conditions.spe).sunElevationDeg;
      if (elevation < lowest) {
        lowest = elevation;
        lowestLmst = lmst;
      }
    }
    rows.push({
      key: "LIGHTING",
      status: lowest < SUN_CAUTION_DEG ? "CAUTION" : "GO",
      value:
        `Lowest sun ${degrees(lowest)} at ${formatLmst(lowestLmst)} LMST` +
        (lowest < 0 ? " · part of the EVA is in darkness" : lowest < SUN_CAUTION_DEG ? ` · below ${SUN_CAUTION_DEG}°` : ""),
      evidence: "CALCULATED",
    });
  }

  // ---- WEATHER: we have no forecast, so this is a watch item ------------------------------
  rows.push(
    conditions.storm
      ? { key: "WEATHER", status: "NO-GO", value: "Dust storm: EVA aborted", evidence: "ASSUMED" }
      : {
          key: "WEATHER",
          status: "MONITOR",
          value: `No storm now · if one hits: walking ${formatPct(STORM_SPEED_FACTOR * 100)} speed, reserve +${STORM_EXTRA_RESERVE_MIN} min`,
          evidence: "ASSUMED",
        },
  );

  // ---- overall: the worst row (Contract 3) ---------------------------------------------
  const status: Status = rows.some((r) => r.status === "NO-GO") ? "NO-GO" : rows.some((r) => r.status === "CAUTION") ? "CAUTION" : "GO";
  const reasons = rows.filter((r) => r.status === "NO-GO" || r.status === "CAUTION").map((r) => `${r.key}: ${r.value}`);
  return { rows, status, reasons };
}
