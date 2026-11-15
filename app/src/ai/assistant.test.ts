// The assistant's browser half, on the real site.json: the tool executor and the
// tool loop. The model is replaced by a scripted stand-in, so no network and no
// API key are needed and the tests are deterministic.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildCostGrid, formatKm, formatMinutes, loadSite, planRoute, stormAt } from "../planner";
import type { Stop } from "../planner";
import { scienceScore, suggestStops } from "../planner/science";
import { MAX_ROUNDS, runTurn } from "./assistantLoop";
import type { Block, ChatMessage, ServerReply, Transport } from "./assistantLoop";
import { LAYER_INFO, createToolSession } from "./tools";

const site = loadSite(JSON.parse(readFileSync(new URL("../../public/data/site.json", import.meta.url), "utf8")));
const conditions = { storm: false, spe: false, startLmst: 13 };
const cost = buildCostGrid(site, conditions);
const stops: Stop[] = site.pois
  .filter((p) => p.kind === "science")
  .slice(0, 3)
  .map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin: 30 }));
const plan = planRoute(site, cost, site.habitat, stops);
const session = () => createToolSession({ site, stops, conditions });

// The tool descriptions live in backend/ (the server side). The app must build, typecheck
// and test without that folder, so they are loaded only if the file is there, and the
// checks that compare the two sides are skipped when it is not.
type ToolSchema = { name: string; strict: boolean; input_schema: { required: string[]; additionalProperties: boolean } };
const backendTools = new URL("../../../backend/lib/tools.ts", import.meta.url);
const hasBackend = existsSync(fileURLToPath(backendTools));
const backend: { TOOLS: ToolSchema[]; TOOL_NAMES: string[]; LAYER_NAMES: string[] } = hasBackend
  ? await import(/* @vite-ignore */ backendTools.href)
  : { TOOLS: [], TOOL_NAMES: [], LAYER_NAMES: [] };
const { LAYER_NAMES, TOOLS, TOOL_NAMES } = backend;

/** Example arguments for each tool, so every tool the model is offered is run once. */
const EXAMPLE_ARGS: Record<string, unknown> = {
  get_plan_summary: {},
  add_stop: { lat: 18.45646, lng: 77.41272, dwellMin: 20, label: "Clay test" },
  remove_stop: { stopId: "maaz-sid" },
  reorder_stops: { stopIds: ["maaz-sid", "delta-toe", "seitah-brac"] },
  explain_route: { legIndex: 1 },
  simulate_storm: { atSec: 3600 },
  explain_layer: { layerName: "science" },
  score_stops: {},
  suggest_stops: { n: 2 },
};

describe.skipIf(!hasBackend)("tool schemas and the browser executor agree", () => {
  it("offers the seven Contract 5 tools plus score_stops and suggest_stops", () => {
    expect(TOOL_NAMES).toEqual([
      "get_plan_summary",
      "add_stop",
      "remove_stop",
      "reorder_stops",
      "explain_route",
      "simulate_storm",
      "explain_layer",
      "score_stops",
      "suggest_stops",
    ]);
  });

  it("the browser can run every tool the model is offered, and results are plain JSON", () => {
    for (const tool of TOOLS) {
      const result = session().run(tool.name, EXAMPLE_ARGS[tool.name]);
      expect(result, tool.name).toBeTruthy();
      expect(JSON.parse(JSON.stringify(result)), tool.name).toEqual(result);
      // The example covers every argument the schema requires.
      expect(Object.keys(EXAMPLE_ARGS[tool.name] as object).sort(), tool.name).toEqual([...tool.input_schema.required].sort());
      expect(tool.strict).toBe(true);
      expect(tool.input_schema.additionalProperties).toBe(false);
    }
  });

  it("explain_layer knows every layer name in the schema", () => {
    expect(Object.keys(LAYER_INFO).sort()).toEqual([...LAYER_NAMES].sort());
    for (const name of LAYER_NAMES) {
      const out = session().run("explain_layer", { layerName: name }) as { source: string };
      expect(out.source.length).toBeGreaterThan(20);
      expect(out.source).toBe(site.sources[LAYER_INFO[name].source]);
    }
  });
});

describe("tool results come straight from the planner", () => {
  it("get_plan_summary repeats the planner's status, reasons and numbers", () => {
    const s = session().summary();
    expect(s.status).toBe(plan.status);
    expect(s.status).toBe("GO");
    expect(s.reasons).toEqual(plan.reasons);
    expect(s.distance).toBe(formatKm(plan.distM));
    expect(s.oxygenMargin).toBe(formatMinutes(plan.marginSec));
    expect(s.isDraft).toBe(false);
    expect(s.stops.map((x) => x.id)).toEqual(["seitah-brac", "delta-toe", "maaz-sid"]);
    s.stops.forEach((x, i) => {
      expect(x.arriveSec).toBe(Math.round(plan.legs[i].arriveSec));
      expect(x.departSec! - x.arriveSec!).toBeCloseTo(30 * 60, -1);
    });
  });

  it("simulate_storm reports both statuses from stormAt", () => {
    const s = session();
    const atSec = s.summary().stops[1].arriveSec!;
    const out = s.run("simulate_storm", { atSec }) as {
      eva: { status: string; reasons: string[] };
      returnHome: { status: string; reasons: string[]; walkHome: string; oxygenMarginOnArrival: string };
      astronaut: string;
    };
    const direct = stormAt(site, plan, atSec, "dust", 13);
    expect(out.eva).toEqual({ status: "NO-GO", reasons: direct.evaReasons });
    expect(out.eva.reasons[0]).toBe("EVA aborted: active dust storm");
    expect(out.returnHome.status).toBe(direct.abort.status);
    expect(out.returnHome.reasons).toEqual(direct.abort.reasons);
    expect(out.returnHome.walkHome).toBe(formatMinutes(direct.abort.sec));
    expect(out.returnHome.oxygenMarginOnArrival).toBe(formatMinutes(direct.abort.marginSec));
    expect(out.astronaut).toMatch(/stop 2/);
    expect(s.changed()).toBe(false); // a simulation changes nothing
  });

  it("score_stops and suggest_stops repeat the science functions", () => {
    const scored = session().run("score_stops", {}) as { stops: { id: string; science: number }[] };
    const direct = scienceScore(site, plan, { stops, cost });
    expect(scored.stops.map((s) => s.id)).toEqual(direct.map((s) => s.id));
    scored.stops.forEach((s, i) => expect(s.science).toBeCloseTo(direct[i].science, 2));

    const ideas = session().run("suggest_stops", { n: 3 }) as { suggestions: { lat: number; insertAt: number; statusAfter: string }[] };
    const directIdeas = suggestStops(site, site.habitat, stops, 3, { startLmst: 13, cost });
    expect(ideas.suggestions).toHaveLength(directIdeas.length);
    ideas.suggestions.forEach((s, i) => {
      expect(s.lat).toBeCloseTo(directIdeas[i].lat, 5);
      expect(s.insertAt).toBe(directIdeas[i].insertAt);
    });
  });
});

describe("edits only change a draft", () => {
  it("add_stop, reorder_stops and remove_stop never touch the astronaut's stops", () => {
    const before = JSON.stringify(stops);
    const s = session();
    const added = s.run("add_stop", EXAMPLE_ARGS.add_stop) as { isDraft: boolean; stops: { id: string }[]; note: string };
    expect(added.isDraft).toBe(true);
    expect(added.note).toMatch(/DRAFT/);
    expect(added.stops).toHaveLength(4);
    expect(s.changed()).toBe(true);
    const newId = added.stops[3].id;
    s.run("reorder_stops", { stopIds: ["seitah-brac", newId, "delta-toe", "maaz-sid"] });
    expect(s.stops().map((x) => x.id)).toEqual(["seitah-brac", newId, "delta-toe", "maaz-sid"]);
    s.run("remove_stop", { stopId: "maaz-sid" });
    expect(s.stops()).toHaveLength(3);
    expect(JSON.stringify(stops)).toBe(before);
    // The draft's summary is the planner's answer for the draft stops.
    expect(s.summary().distance).toBe(formatKm(planRoute(site, cost, site.habitat, s.stops()).distM));
  });

  it("refuses calls it cannot do, with a plain reason", () => {
    const s = session();
    expect(() => s.run("add_stop", { lat: 50, lng: 50, dwellMin: 10, label: "x" })).toThrow(/outside the mapped site/);
    expect(() => s.run("add_stop", { lat: 18.45, lng: 77.43, dwellMin: 999, label: "x" })).toThrow(/between 0 and 480/);
    expect(() => s.run("remove_stop", { stopId: "nope" })).toThrow(/No stop has the id/);
    expect(() => s.run("reorder_stops", { stopIds: ["seitah-brac"] })).toThrow(/exactly once/);
    expect(() => s.run("explain_route", { legIndex: 9 })).toThrow(/no leg 9/);
    expect(() => s.run("simulate_storm", { atSec: 1e9 })).toThrow(/between 0 and/);
    expect(() => s.run("suggest_stops", { n: 50 })).toThrow(/1 to 5/);
    expect(() => s.run("launch_rocket", {})).toThrow(/Unknown tool/);
    expect(s.changed()).toBe(false);
  });
});

// ---- The loop, with a scripted model ----------------------------------------

const toolUse = (id: string, name: string, input: unknown): Block => ({ type: "tool_use", id, name, input });
const thinking: Block = { type: "thinking", thinking: "", signature: "sig-abc" };

/** A stand-in server that plays back fixed replies and records what it was sent. */
function scripted(replies: ServerReply[]) {
  const seen: { messages: ChatMessage[]; planSummary: unknown }[] = [];
  const transport: Transport = async (body) => {
    seen.push(structuredClone(body));
    return replies[Math.min(seen.length - 1, replies.length - 1)];
  };
  return { transport, seen };
}

describe("runTurn (the tool loop)", () => {
  it("runs requested tools on the planner, returns all results in one message, then gives the answer", async () => {
    const first: Block[] = [thinking, toolUse("t1", "get_plan_summary", {}), toolUse("t2", "explain_route", { legIndex: 0 })];
    const { transport, seen } = scripted([
      { ok: true, content: first, stopReason: "tool_use" },
      { ok: true, content: [{ type: "text", text: "The planner's status is GO." }], stopReason: "end_turn" },
    ]);
    const s = session();
    const result = await runTurn({ transport, session: s, history: [], userText: "Why this route?" });

    expect(result.error).toBeUndefined();
    expect(result.text).toBe("The planner's status is GO.");
    expect(result.toolCalls.map((c) => [c.name, c.ok])).toEqual([["get_plan_summary", true], ["explain_route", true]]);
    expect(seen).toHaveLength(2);
    expect(seen[0].messages).toEqual([{ role: "user", content: "Why this route?" }]);
    expect(seen[0].planSummary).toEqual(s.summary());

    // Second request: the assistant turn is sent back unchanged (thinking block included),
    // followed by ONE user message holding both tool results.
    const [, assistantTurn, results] = seen[1].messages;
    expect(assistantTurn).toEqual({ role: "assistant", content: first });
    const blocks = results.content as Block[];
    expect(blocks.map((b) => [b.type, b.tool_use_id])).toEqual([["tool_result", "t1"], ["tool_result", "t2"]]);
    expect(JSON.parse(blocks[0].content as string)).toEqual(s.summary());
    expect(blocks[0].is_error).toBeUndefined();
    expect(result.messages).toHaveLength(4);
  });

  it("marks a failed tool as an error result instead of dropping it", async () => {
    const { transport, seen } = scripted([
      { ok: true, content: [toolUse("t1", "remove_stop", { stopId: "nope" })], stopReason: "tool_use" },
      { ok: true, content: [{ type: "text", text: "I don't know which stop you mean." }], stopReason: "end_turn" },
    ]);
    const result = await runTurn({ transport, session: session(), history: [], userText: "Remove the crater stop" });
    const block = (seen[1].messages[2].content as Block[])[0];
    expect(block.is_error).toBe(true);
    expect(block.content).toMatch(/No stop has the id/);
    expect(result.toolCalls[0].ok).toBe(false);
    expect(result.text).toMatch(/don't know/);
  });

  it("keeps the earlier conversation and continues it", async () => {
    const history: ChatMessage[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: [{ type: "text", text: "Ask me about the plan." }] },
    ];
    const { transport, seen } = scripted([{ ok: true, content: [{ type: "text", text: "Yes." }], stopReason: "end_turn" }]);
    const result = await runTurn({ transport, session: session(), history, userText: "Still there?" });
    expect(seen[0].messages).toHaveLength(3);
    expect(result.messages).toHaveLength(4);
    expect(history).toHaveLength(2); // the caller's array is not changed
  });

  it("on a server error, reports it and hands back the conversation from before the turn", async () => {
    const history: ChatMessage[] = [{ role: "user", content: "a" }, { role: "assistant", content: [{ type: "text", text: "b" }] }];
    const offline = await runTurn({
      transport: scripted([{ ok: false, status: 503, error: "Assistant offline: no API key is configured on the server.", offline: true }]).transport,
      session: session(),
      history,
      userText: "Why this route?",
    });
    expect(offline).toMatchObject({ text: "", offline: true, error: expect.stringMatching(/offline/i) });
    expect(offline.messages).toBe(history);

    const thrown = await runTurn({
      transport: async () => {
        throw new Error("network down");
      },
      session: session(),
      history: [],
      userText: "x",
    });
    expect(thrown.error).toMatch(/could not be reached/);
  });

  it("stops a model that keeps asking for tools", async () => {
    const { transport, seen } = scripted([{ ok: true, content: [toolUse("t", "get_plan_summary", {})], stopReason: "tool_use" }]);
    const result = await runTurn({ transport, session: session(), history: [], userText: "loop" });
    expect(seen).toHaveLength(MAX_ROUNDS);
    expect(result.error).toMatch(/too many tool calls/);
    expect(result.text).toBe("");
  });

  it("says so when an answer is cut off or empty", async () => {
    const cut = await runTurn({
      transport: scripted([{ ok: true, content: [{ type: "text", text: "The route" }], stopReason: "max_tokens" }]).transport,
      session: session(),
      history: [],
      userText: "x",
    });
    expect(cut.text).toMatch(/cut off/);
    const empty = await runTurn({
      transport: scripted([{ ok: true, content: [thinking], stopReason: "end_turn" }]).transport,
      session: session(),
      history: [],
      userText: "x",
    });
    expect(empty.error).toMatch(/no answer/);
  });
});
