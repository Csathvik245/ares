// Contract 5 tools as function-calling schemas (CLAUDE.md section 5), plus the two
// science-per-oxygen tools. These are only DESCRIPTIONS: the model asks for a tool,
// and the BROWSER runs it on the local planner (app/src/ai/tools.ts). Nothing here
// calculates anything.
//
// Plain objects with no SDK import, so the app's tests can read this file too and
// check that the browser can run every tool the model is offered.
//
// Every schema is strict: all properties are required and no extra ones are allowed,
// so the model's arguments always match the shape the browser expects.

export type ToolSchema = {
  name: string;
  description: string;
  strict: true;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties: false;
  };
};

const noArgs = (): ToolSchema["input_schema"] => ({ type: "object", properties: {}, required: [], additionalProperties: false });

/** Layer names the explain_layer tool accepts. Must match app/src/ai/tools.ts. */
export const LAYER_NAMES = ["elevation", "slope", "rock", "thermalInertia", "science", "walkingDifficulty"] as const;

export const TOOLS: ToolSchema[] = [
  {
    name: "get_plan_summary",
    description:
      "Get the current EVA plan from the planner: the stops in order (with ids, coordinates, science minutes, " +
      "arrival and departure times in seconds since the start), distance, duration, walking and science time, " +
      "oxygen used, oxygen margin above the reserve, oxygen left at return, and the planner's status " +
      "(GO, CAUTION or NO-GO) with its reasons. Call this first for any question about the plan, and again " +
      "whenever you need a number you do not already have from a tool result.",
    strict: true,
    input_schema: noArgs(),
  },
  {
    name: "add_stop",
    description:
      "Try adding a science stop at the end of the stop list and get the planner's summary of the plan with it. " +
      "This changes only a DRAFT. The astronaut's real plan changes only if they press Apply. Use it to answer " +
      "'can I add a stop here?'. Coordinates are degrees: planetocentric latitude and east longitude, inside " +
      "18.40-18.50 N, 77.36-77.50 E. To insert a stop in the middle, add it and then call reorder_stops.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        lat: { type: "number", description: "Latitude in degrees north." },
        lng: { type: "number", description: "Longitude in degrees east." },
        dwellMin: { type: "number", description: "Science time at the stop, minutes (0 to 480)." },
        label: { type: "string", description: "Short name for the stop." },
      },
      required: ["lat", "lng", "dwellMin", "label"],
      additionalProperties: false,
    },
  },
  {
    name: "remove_stop",
    description:
      "Try removing a stop (by its id from get_plan_summary) and get the planner's summary without it. " +
      "Changes only the draft, like add_stop.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { stopId: { type: "string", description: "The stop's id from get_plan_summary." } },
      required: ["stopId"],
      additionalProperties: false,
    },
  },
  {
    name: "reorder_stops",
    description:
      "Try a different order of the stops and get the planner's summary for it. Give every stop id exactly once, " +
      "in the new order. Changes only the draft, like add_stop.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        stopIds: { type: "array", items: { type: "string" }, description: "Every stop id, in the new order." },
      },
      required: ["stopIds"],
      additionalProperties: false,
    },
  },
  {
    name: "explain_route",
    description:
      "Terrain facts for one leg of the route: steepest slope, share of soft sand, roughest ground, the leg's " +
      "length and walking time, and a note on how and why the leg differs from a straight line. Leg 0 goes from " +
      "the habitat to stop 1; the last leg goes from the last stop back to the habitat. Use this for " +
      "'why this route?' questions: call it for each leg you want to explain.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { legIndex: { type: "integer", description: "0-based leg number." } },
      required: ["legIndex"],
      additionalProperties: false,
    },
  },
  {
    name: "simulate_storm",
    description:
      "What the planner says if a dust storm starts atSec seconds into the EVA: the EVA status (aborted, NO-GO), " +
      "and the return-home route's own status, reasons, walking time home, oxygen margin on arrival and oxygen " +
      "left. This is a calculation only; it does not start a storm in the app. Get atSec from the arrival and " +
      "departure times in get_plan_summary (for example 'at stop 2' is that stop's arriveSec).",
    strict: true,
    input_schema: {
      type: "object",
      properties: { atSec: { type: "number", description: "Seconds since the start of the EVA." } },
      required: ["atSec"],
      additionalProperties: false,
    },
  },
  {
    name: "explain_layer",
    description:
      "What one map layer shows, how it is made, its limits, and the NASA dataset it comes from " +
      "(the source text stored with the terrain file).",
    strict: true,
    input_schema: {
      type: "object",
      properties: { layerName: { type: "string", enum: [...LAYER_NAMES] } },
      required: ["layerName"],
      additionalProperties: false,
    },
  },
  {
    name: "score_stops",
    description:
      "Science per oxygen-minute for every stop in the plan: the mean science value within 50 m (a relative " +
      "0-1 index from orbital CRISM data, not a mineral abundance), the extra oxygen minutes the stop costs " +
      "(walking detour plus science time), and the score (science divided by extra oxygen minutes).",
    strict: true,
    input_schema: noArgs(),
  },
  {
    name: "suggest_stops",
    description:
      "Ask the planner for up to n extra stops with high science value that keep the plan GO, best science per " +
      "oxygen-minute first. Each comes with coordinates, science value, extra oxygen minutes, the place in the " +
      "stop order where it is cheapest (insertAt), and the oxygen margin left after adding it. Returns an empty " +
      "list when the current plan is not GO. These are options for the astronaut, not decisions. The science " +
      "layer is strongest for clay, so use this for 'another clay stop' questions.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { n: { type: "integer", description: "How many suggestions to ask for (1 to 5)." } },
      required: ["n"],
      additionalProperties: false,
    },
  },
];

export const TOOL_NAMES = TOOLS.map((t) => t.name);
