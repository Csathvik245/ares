// The browser half of Contract 5: runs the assistant's tool calls on the LOCAL planner.
//
// The model only asks for a tool by name. Everything it is told comes from here,
// and everything here comes from planner functions. No number is made up or
// adjusted in this file; display strings come from the planner's own formatters.
//
// add_stop / remove_stop / reorder_stops change a DRAFT copy of the stops. The real
// plan changes only when the astronaut presses Apply in the chat panel. That is how
// "the AI explains, the planner decides" holds even for edits.
//
// Pure TypeScript, no React, so backend/try.ts can run the same code in Node.

import {
  buildCostGrid,
  cellIndexOf,
  explainSegment,
  formatDuration,
  formatKm,
  formatMet,
  formatMinutes,
  formatPct,
  planRoute,
  roundHalfUp,
  stormAt,
} from "../planner";
import type { Conditions, CostGrid, Plan, Site, Stop } from "../planner";
import { scienceScore, suggestStops } from "../planner/science";

export type ToolSessionInput = {
  site: Site;
  /** The stops of the astronaut's real plan. Copied; never changed. */
  stops: Stop[];
  /** Only startLmst is used. The assistant always works on the calm plan. */
  conditions: Pick<Conditions, "startLmst">;
};

export type ToolSession = {
  /** Run one tool. Throws an Error with a plain message when the call cannot be done. */
  run(name: string, input: unknown): unknown;
  /** The planner's summary of the draft plan (same as the get_plan_summary tool). */
  summary(): PlanSummary;
  /** The draft stops, in order. */
  stops(): Stop[];
  /** True once a tool has changed the draft, so there is something to Apply. */
  changed(): boolean;
};

export type PlanSummary = {
  status: Plan["status"];
  reasons: string[];
  /** True when this is a draft the assistant changed, not the astronaut's applied plan. */
  isDraft: boolean;
  note: string;
  stops: {
    number: number;
    id: string;
    label: string;
    lat: number;
    lng: number;
    scienceMin: number;
    /** Seconds since the start of the EVA. null if the stop cannot be reached. */
    arriveSec: number | null;
    departSec: number | null;
    arriveAt: string;
  }[];
  legCount: number;
  distance: string;
  duration: string;
  walking: string;
  science: string;
  oxygenUsed: string;
  oxygenMargin: string;
  oxygenAtReturn: string;
  totalSec: number;
  startLmst: number;
};

/** Names the explain_layer tool accepts. Must match backend/lib/tools.ts. */
export const LAYER_INFO: Record<string, { name: string; dataType: string; source: string; shows: string; limits: string }> = {
  elevation: {
    name: "Elevation",
    dataType: "Topographic",
    source: "elevation",
    shows: "Height of the ground in each 25 m cell, in meters: the mean of the 1 m HiRISE terrain model inside the cell.",
    limits: "Elevation at Jezero is negative (far below the Mars datum). Details smaller than a cell are averaged.",
  },
  slope: {
    name: "Slope",
    dataType: "Topographic",
    source: "slope",
    shows:
      "Steepness of each cell in degrees: the 90th percentile of the ~5 m slopes inside the cell, so a small cliff is not averaged away. The planner slows walking on slopes and treats cells steeper than its slope limit as no-go.",
    limits: "Derived from the elevation layer. The percentile is the team's choice, not from a source.",
  },
  rock: {
    name: "Ground roughness",
    dataType: "Topographic (derived)",
    source: "rock",
    shows:
      "How bumpy the ground is inside each cell, 0 to 1, after removing the cell's overall tilt. The planner slows walking on rough ground and treats very rough cells as no-go.",
    limits:
      "It is a roughness proxy, NOT a boulder count: the 1 m terrain model cannot see single boulders smaller than a few meters.",
  },
  thermalInertia: {
    name: "Thermal inertia (soft sand)",
    dataType: "Thermal",
    source: "thermalInertia",
    shows:
      "How well the ground holds heat. Low values mean loose, fine material such as sand; high values mean firm ground or rock. The planner slows walking where the value is below its soft-sand threshold.",
    limits: "The real detail is 100 m; it only looks finer on the 25 m grid. A sand patch narrower than about 100 m is not resolved.",
  },
  science: {
    name: "Science value",
    dataType: "Spectral",
    source: "science",
    shows:
      "Where orbital CRISM spectra see clay or carbonate signatures, as a relative index from 0 to 1 (higher is a stronger signal).",
    limits:
      "A relative index inside one orbital scene, NOT a mineral abundance. The clay signal dominates; carbonate signals are weak at this scale, so a low value does not mean no carbonate.",
  },
  walkingDifficulty: {
    name: "Walking difficulty",
    dataType: "Combined",
    source: "slope",
    shows:
      "The planner's own cost of walking through each cell: seconds per meter from slope, soft sand and roughness combined with a variant of Tobler's hiking function. No-go cells are steeper or rougher than the planner's limits.",
    limits: "A model, not a measurement. It combines the slope, thermal inertia and roughness layers; see those layers for their sources.",
  },
};

const text = (value: unknown, what: string): string => {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${what} must be text.`);
  return value.trim();
};
const number = (value: unknown, what: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${what} must be a number.`);
  return value;
};
const args = (input: unknown): Record<string, unknown> =>
  input && typeof input === "object" ? (input as Record<string, unknown>) : {};

/** Minutes with one decimal, rounded the planner's way (half up). */
const min1 = (sec: number) => (Number.isFinite(sec) ? roundHalfUp(sec / 60, 1) : null);

/**
 * A tool session for one conversation: the site, a calm cost grid, and a draft copy
 * of the stops. Tools read and (for the three edit tools) change the draft only.
 */
export function createToolSession({ site, stops: applied, conditions }: ToolSessionInput): ToolSession {
  const startLmst = conditions.startLmst;
  const cost: CostGrid = buildCostGrid(site, { storm: false, spe: false, startLmst });
  let stops: Stop[] = applied.map((s) => ({ id: s.id, label: s.label, lat: s.lat, lng: s.lng, dwellMin: s.dwellMin }));
  let plan: Plan = planRoute(site, cost, site.habitat, stops);
  let changed = false;
  let added = 0;

  function setDraft(next: Stop[]) {
    stops = next;
    plan = planRoute(site, cost, site.habitat, stops);
    changed = true;
  }

  function summary(): PlanSummary {
    return {
      status: plan.status,
      reasons: plan.reasons,
      isDraft: changed,
      note: changed
        ? "This is a DRAFT changed by the assistant's tools. The astronaut's plan changes only if they press Apply."
        : "This is the astronaut's current plan.",
      stops: stops.map((s, i) => {
        const leg = plan.legs[i];
        const next = plan.legs[i + 1];
        const reached = !!leg && leg.path.length > 0;
        return {
          number: i + 1,
          id: s.id,
          label: s.label,
          lat: roundHalfUp(s.lat, 5),
          lng: roundHalfUp(s.lng, 5),
          scienceMin: s.dwellMin,
          arriveSec: reached ? Math.round(leg.arriveSec) : null,
          departSec: reached && next ? Math.round(next.arriveSec - next.walkSec) : null,
          arriveAt: reached ? formatMet(leg.arriveSec) : "unreachable",
        };
      }),
      legCount: plan.legs.length,
      distance: formatKm(plan.distM),
      duration: formatDuration(plan.totalSec),
      walking: formatDuration(plan.walkSec),
      science: formatDuration(plan.workSec),
      oxygenUsed: formatMinutes(plan.oxygenUsedSec),
      oxygenMargin: formatMinutes(plan.marginSec),
      oxygenAtReturn: formatPct(plan.oxygenAtReturnPct),
      totalSec: Math.round(plan.totalSec),
      startLmst,
    };
  }

  function run(name: string, input: unknown): unknown {
    const a = args(input);
    switch (name) {
      case "get_plan_summary":
        return summary();

      case "add_stop": {
        const lat = number(a.lat, "lat");
        const lng = number(a.lng, "lng");
        const dwellMin = number(a.dwellMin, "dwellMin");
        if (dwellMin < 0 || dwellMin > 480) throw new Error("dwellMin must be between 0 and 480 minutes.");
        if (cellIndexOf(site, { lat, lng }) < 0) {
          const b = site.bounds;
          throw new Error(`That point is outside the mapped site (${b.south}-${b.north} N, ${b.west}-${b.east} E).`);
        }
        const label = typeof a.label === "string" && a.label.trim() ? a.label.trim().slice(0, 60) : "Proposed stop";
        setDraft([...stops, { id: `draft-${++added}`, label, lat, lng, dwellMin }]);
        return summary();
      }

      case "remove_stop": {
        const stopId = text(a.stopId, "stopId");
        if (!stops.some((s) => s.id === stopId)) throw new Error(`No stop has the id "${stopId}". Call get_plan_summary for the ids.`);
        setDraft(stops.filter((s) => s.id !== stopId));
        return summary();
      }

      case "reorder_stops": {
        const ids = a.stopIds;
        if (
          !Array.isArray(ids) ||
          ids.length !== stops.length ||
          new Set(ids).size !== ids.length ||
          !ids.every((id) => stops.some((s) => s.id === id))
        ) {
          throw new Error("stopIds must list every stop id exactly once. Call get_plan_summary for the ids.");
        }
        setDraft(ids.map((id) => stops.find((s) => s.id === id)!));
        return summary();
      }

      case "explain_route": {
        const legIndex = number(a.legIndex, "legIndex");
        const leg = plan.legs[legIndex];
        if (!Number.isInteger(legIndex) || !leg) {
          throw new Error(`There is no leg ${legIndex}. The plan has ${plan.legs.length} legs, numbered from 0.`);
        }
        const facts = explainSegment(site, plan, legIndex);
        const from = legIndex === 0 ? site.habitat.name : stops[legIndex - 1].label;
        const to = legIndex === plan.legs.length - 1 ? site.habitat.name : stops[legIndex].label;
        return {
          legIndex,
          from,
          to,
          reachable: leg.path.length > 0,
          plannedDistance: formatKm(leg.distM),
          walkingTime: formatMinutes(leg.walkSec),
          distanceNote:
            "plannedDistance is the path the planner times, cell to cell. detourNote compares the smoothed line drawn on the map with a straight line, so its distances are a little shorter.",
          maxSlopeDeg: roundHalfUp(facts.maxSlopeDeg, 1),
          softSandShare: formatPct(facts.sandFraction * 100),
          maxRoughness: roundHalfUp(facts.rockMax, 2),
          detourNote: facts.detourNote,
        };
      }

      case "simulate_storm": {
        const atSec = number(a.atSec, "atSec");
        if (plan.legs.length === 0) throw new Error("The plan has no stops, so there is no walk to interrupt.");
        if (atSec < 0 || atSec > plan.totalSec) {
          throw new Error(`atSec must be between 0 and ${Math.round(plan.totalSec)} (the length of the EVA in seconds).`);
        }
        const out = stormAt(site, plan, atSec, "dust", startLmst);
        const onLeg = out.position.legIndex;
        return {
          kind: "dust storm (simulated, not started in the app)",
          at: formatMet(atSec),
          astronaut:
            out.position.phase === "science"
              ? `doing science at stop ${onLeg + 1}`
              : `walking leg ${onLeg} (${onLeg === plan.legs.length - 1 ? "heading back to the habitat" : `towards stop ${onLeg + 1}`})`,
          eva: { status: out.evaStatus, reasons: out.evaReasons },
          returnHome: {
            status: out.abort.status,
            reasons: out.abort.reasons,
            walkHome: formatMinutes(out.abort.sec),
            oxygenMarginOnArrival: formatMinutes(out.abort.marginSec),
            arrivesAt: formatMet(out.arriveSec),
          },
          oxygenWhenStormStarts: formatPct(out.oxygenNowPct),
          oxygenOnArrival: formatPct(out.oxygenOnArrivalPct),
        };
      }

      case "explain_layer": {
        const layerName = text(a.layerName, "layerName");
        const info = LAYER_INFO[layerName];
        if (!info) throw new Error(`Unknown layer "${layerName}". Known layers: ${Object.keys(LAYER_INFO).join(", ")}.`);
        return {
          layer: info.name,
          dataType: info.dataType,
          shows: info.shows,
          limits: info.limits,
          source: site.sources[info.source] ?? "No source text is stored for this layer.",
        };
      }

      case "score_stops": {
        if (stops.length === 0) throw new Error("The plan has no stops to score.");
        return {
          note: "science = mean relative CRISM index within 50 m (0 to 1), not a mineral abundance. score = science / extra oxygen minutes.",
          stops: scienceScore(site, plan, { stops, cost }).map((s, i) => ({
            number: i + 1,
            id: s.id,
            label: stops[i].label,
            science: roundHalfUp(s.science, 2),
            extraOxygenMin: min1(s.extraO2Min * 60),
            scorePerOxygenHour: Number.isFinite(s.score) ? roundHalfUp(s.score * 60, 3) : null,
          })),
        };
      }

      case "suggest_stops": {
        const n = number(a.n, "n");
        if (!Number.isInteger(n) || n < 1 || n > 5) throw new Error("n must be a whole number from 1 to 5.");
        const ideas = suggestStops(site, site.habitat, stops, n, { startLmst, cost });
        return {
          note:
            ideas.length === 0
              ? "The planner has no suggestion: either the current plan is not GO, or no high-science spot keeps it GO."
              : "Options from the planner, each checked on its own. The astronaut decides. science is a relative CRISM index, strongest for clay.",
          currentStatus: plan.status,
          suggestions: ideas.map((s) => ({
            lat: roundHalfUp(s.lat, 5),
            lng: roundHalfUp(s.lng, 5),
            science: roundHalfUp(s.science, 2),
            scienceMin: s.dwellMin,
            extraOxygenMin: min1(s.extraO2Min * 60),
            scorePerOxygenHour: roundHalfUp(s.score * 60, 3),
            insertAt: s.insertAt,
            insertAfter: s.insertAt === 0 ? site.habitat.name : stops[s.insertAt - 1].label,
            oxygenMarginAfter: formatMinutes(s.marginMin * 60),
            statusAfter: "GO",
          })),
        };
      }

      default:
        throw new Error(`Unknown tool "${name}".`);
    }
  }

  return { run, summary, stops: () => stops.map((s) => ({ ...s })), changed: () => changed };
}
