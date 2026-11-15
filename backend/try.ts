// Runs the ARES assistant's tool loop against the planner on the real site.json,
// with no browser and no UI. It uses the SAME code as the app:
//   - the tool executor and the loop from app/src/ai/
//   - the request handler from backend/lib/assistant-core.ts (called directly, no HTTP)
//
// Run from this folder:
//   ANTHROPIC_API_KEY=... npm run try        (asks the model the three demo questions)
//   npm run try:dry                          (no model, no key: prints the planner facts
//                                             the assistant would be given for each question)
//
// The key is read from the environment only. Never paste it into a file.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runTurn } from "../app/src/ai/assistantLoop";
import type { Transport } from "../app/src/ai/assistantLoop";
import { createToolSession } from "../app/src/ai/tools";
import { loadSite } from "../app/src/planner";
import type { Stop } from "../app/src/planner";
import { assistantOnline, handleAssistant, MODEL } from "./lib/assistant-core";

const QUESTIONS = ["Why this route?", "Can I add another clay stop?", "What if a dust storm hits at stop 2?"];

const sitePath = fileURLToPath(new URL("../app/public/data/site.json", import.meta.url));
const site = loadSite(JSON.parse(readFileSync(sitePath, "utf8")));
// The demo mission: the first three science POIs, 30 minutes each (CLAUDE.md, Contract 1).
const stops: Stop[] = site.pois
  .filter((p) => p.kind === "science")
  .slice(0, 3)
  .map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin: 30 }));
const newSession = () => createToolSession({ site, stops, conditions: { startLmst: 13 } });

const rule = (title: string) => console.log(`\n${"=".repeat(78)}\n${title}\n${"=".repeat(78)}`);
const show = (value: unknown) => console.log(JSON.stringify(value, null, 2));

/** No model: run the tools a sensible answer needs and print what the planner says. */
function dryRun() {
  console.log("DRY RUN: no model is called. These are the planner facts the assistant would be given.");

  rule(`Q: ${QUESTIONS[0]}`);
  let s = newSession();
  const summary = s.summary();
  console.log("get_plan_summary:");
  show(summary);
  for (let leg = 0; leg < summary.legCount; leg++) {
    console.log(`explain_route { legIndex: ${leg} }:`);
    show(s.run("explain_route", { legIndex: leg }));
  }

  rule(`Q: ${QUESTIONS[1]}`);
  s = newSession();
  console.log("suggest_stops { n: 3 }:");
  const ideas = s.run("suggest_stops", { n: 3 }) as {
    suggestions: { lat: number; lng: number; scienceMin: number; insertAt: number }[];
  };
  show(ideas);
  const first = ideas.suggestions[0];
  if (first) {
    // add_stop puts the stop last; reorder_stops then moves it to the place the planner found cheapest.
    const added = s.run("add_stop", { lat: first.lat, lng: first.lng, dwellMin: first.scienceMin, label: "Clay stop (suggested)" }) as {
      stops: { id: string }[];
    };
    const ids = added.stops.map((x) => x.id);
    const newId = ids.pop()!;
    ids.splice(first.insertAt, 0, newId);
    console.log(`add_stop (the first suggestion), then reorder_stops to put it at place ${first.insertAt + 1}. Draft only:`);
    show(s.run("reorder_stops", { stopIds: ids }));
  }

  rule(`Q: ${QUESTIONS[2]}`);
  s = newSession();
  const atSec = s.summary().stops[1].arriveSec;
  console.log(`simulate_storm { atSec: ${atSec} }  (arrival at stop 2):`);
  show(s.run("simulate_storm", { atSec }));
}

async function liveRun() {
  // The same handler the Vercel function calls, without HTTP in between.
  const transport: Transport = async (body) => (await handleAssistant(body)) as Awaited<ReturnType<Transport>>;
  console.log(`Model: ${MODEL}. Demo mission: ${stops.map((s) => s.label).join(" > ")}.`);
  let failed = false;
  for (const question of QUESTIONS) {
    rule(`Q: ${question}`);
    // Each question starts fresh: its own conversation and its own draft of the stops.
    const session = newSession();
    const result = await runTurn({
      transport,
      session,
      history: [],
      userText: question,
      onToolCall: (call) => console.log(`  [planner] ${call.name}(${JSON.stringify(call.input)})${call.ok ? "" : `  -> error: ${call.result}`}`),
    });
    if (result.error) {
      failed = true;
      console.log(`\nERROR: ${result.error}`);
      continue;
    }
    console.log(`\nA: ${result.text}`);
    if (session.changed()) {
      console.log(`\n  (Draft only, not applied. Draft stops: ${session.stops().map((s) => s.label).join(" > ")}; planner status ${session.summary().status}.)`);
    }
  }
  process.exitCode = failed ? 1 : 0;
}

if (process.argv.includes("--dry")) {
  dryRun();
} else if (!assistantOnline()) {
  console.error(
    "Assistant offline: ANTHROPIC_API_KEY is not set in this shell.\n" +
      "Set it in the environment (never in a file) and run again, or run `npm run try:dry` to see the planner facts without a model.",
  );
  process.exitCode = 1;
} else {
  await liveRun();
}
