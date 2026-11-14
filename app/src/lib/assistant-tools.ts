import {
  cellIndexOf,
  explainSegment,
  planRoute,
  type Plan,
  type Site,
  type CostGrid,
} from "./planner";
import { layers } from "./layers";
import type { DemoStop } from "./data";
export type ToolArguments = Record<string, unknown>;
export type AssistantState = {
  site: Site;
  cost: CostGrid;
  plan: Plan;
  stops: DemoStop[];
  emergency: boolean;
  edit: (stops: DemoStop[]) => void;
  stormAt: (atSec: number) => unknown;
};
/** Frontend half of Contract 5. Every numerical result comes from the planner. */
export function runAssistantTool(
  state: AssistantState,
  name: string,
  args: ToolArguments = {},
) {
  const { site, cost, plan, stops } = state;
  const summary = (next = stops) => ({
    stops: next,
    ...(next === stops ? plan : planRoute(site, cost, site.habitat, next)),
  });
  if (name === "get_plan_summary") return summary();
  if (name === "explain_route") {
    if (
      !Number.isInteger(args.legIndex) ||
      Number(args.legIndex) < 0 ||
      Number(args.legIndex) >= plan.legs.length
    )
      throw Error("Choose an existing route leg.");
    return explainSegment(site, plan, Number(args.legIndex));
  }
  if (name === "explain_layer") {
    const layer = layers.find(
      (l) => l.id === args.layerName || l.name === args.layerName,
    );
    if (!layer) throw Error("Unknown terrain layer.");
    return { ...layer, source: site.sources[layer.source] };
  }
  if (name === "simulate_storm") {
    if (
      !Number.isFinite(args.atSec) ||
      Number(args.atSec) < 0 ||
      Number(args.atSec) > plan.totalSec
    )
      throw Error("Choose a time within the EVA.");
    const result = state.stormAt(Number(args.atSec));
    state.emergency = true;
    return result;
  }
  if (state.emergency)
    throw Error("Reset the emergency before editing the plan.");
  let next: DemoStop[];
  if (name === "add_stop") {
    if (
      !Number.isFinite(args.lat) ||
      !Number.isFinite(args.lng) ||
      !Number.isFinite(args.dwellMin) ||
      Number(args.dwellMin) < 0 ||
      Number(args.dwellMin) > 480
    )
      throw Error(
        "A stop needs valid coordinates and science minutes between 0 and 480.",
      );
    const point = { lat: Number(args.lat), lng: Number(args.lng) };
    if (cellIndexOf(site, point) < 0)
      throw Error("The stop is outside the mapped site.");
    next = [
      ...stops,
      {
        ...point,
        id: crypto.randomUUID(),
        label: typeof args.label === "string" ? args.label : "Science stop",
        dwellMin: Number(args.dwellMin),
      },
    ];
  } else if (name === "remove_stop") {
    if (!stops.some((s) => s.id === args.stopId))
      throw Error("Stop not found.");
    next = stops.filter((s) => s.id !== args.stopId);
  } else if (name === "reorder_stops") {
    const ids = args.stopIds;
    if (
      !Array.isArray(ids) ||
      ids.length !== stops.length ||
      new Set(ids).size !== ids.length ||
      !ids.every((id) => stops.some((s) => s.id === id))
    )
      throw Error("Provide every stop ID exactly once.");
    next = ids.map((id) => stops.find((s) => s.id === id)!);
  } else throw Error("Unsupported assistant tool.");
  const result = summary(next);
  state.edit(next);
  state.stops = next;
  state.plan = result;
  return result;
}
