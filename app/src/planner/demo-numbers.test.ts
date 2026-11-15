// Frozen demo numbers. This file builds docs/demo-numbers.md from the planner and the
// data files, and checks that the committed file still matches.
//
// - Every planner number is computed here from the real site.json and formatted with
//   format.ts, so it reads exactly as the app shows it.
// - Validation and route-learning numbers are read from the pipeline's output files.
// - If the planner or the data changes on purpose, rewrite the file with
//     UPDATE_DEMO_NUMBERS=1 npx vitest run src/planner/demo-numbers.test.ts
//   (PowerShell: $env:UPDATE_DEMO_NUMBERS = "1"; npx vitest run src/planner/demo-numbers.test.ts)
//   and tell the team: the slides and the video quote these numbers.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  SOL_HOURS,
  buildCostGrid,
  formatDose,
  formatDuration,
  formatKm,
  formatLmst,
  formatMet,
  formatMinutes,
  formatPct,
  loadSite,
  lowSunDuring,
  planRoute,
  readSkyView,
  roundHalfUp,
  stormAt,
} from "./index";
import type { Conditions, Plan, Stop } from "./index";
import { PARAMS, simulateMission } from "./montecarlo";

const file = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));
const readJson = (relative: string) => JSON.parse(readFileSync(file(relative), "utf8"));
const DOC = file("../../../docs/demo-numbers.md");

const START_LMST = 13; // the app's default EVA start time
const INCIDENT_SEC = 76 * 60; // T+1:16, the demo emergency moment
const CALM: Conditions = { storm: false, spe: false, startLmst: START_LMST };

const raw = readJson("../../public/data/site.json");
const site = loadSite(raw);
const skyView = readSkyView(raw);
const cost = buildCostGrid(site, CALM);
const toStop = (p: (typeof site.pois)[number], dwellMin: number): Stop => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin });

// The demo mission: the first three science POIs, 30 min each (Contract 1).
const demoPois = site.pois.filter((p) => p.kind === "science").slice(0, 3);
const demo = planRoute(site, cost, site.habitat, demoPois.map((p) => toStop(p, 30)));

// The Wildcat Ridge SPE demo, as the app's "SPE at Wildcat Ridge" button runs it:
// one stop, no science time, and the event starts on arrival.
const wildcatPoi = site.pois.find((p) => p.id === "delta-wildcat-ridge")!;
const wildcatPlan = planRoute(site, cost, site.habitat, [toStop(wildcatPoi, 0)]);

// The stretch mission: the demo route plus ONE more real stop, Wildcat Ridge (a Perseverance
// sampling site at the delta front), visited after Brac, with a long 2-hour sampling session there.
// With the usual 30 min at Wildcat Ridge the Monte Carlo still gets home with the reserve in 99.9% of
// trials, and so does every other single extra stop we tried, so the knob used here is the
// science time at the extra stop (120 min). The start time does not change the oxygen numbers.
// It starts at 10:00 LMST, earlier than the demo, so this 6.5-hour EVA is over well before the
// sun gets low: the only caution left is the oxygen margin, which is the point of the example.
const STRETCH_DWELL_MIN = 120;
const STRETCH_START_LMST = 10;
const stretchStops = [toStop(demoPois[0], 30), toStop(wildcatPoi, STRETCH_DWELL_MIN), toStop(demoPois[1], 30), toStop(demoPois[2], 30)];
const stretchCost = buildCostGrid(site, { ...CALM, startLmst: STRETCH_START_LMST });
const stretch = planRoute(site, stretchCost, site.habitat, stretchStops);
const stretchSim = simulateMission(site, stretch, { seed: 42, startLmst: STRETCH_START_LMST });

const lmstAt = (sec: number) => formatLmst(START_LMST + ((sec / 3600) * 24) / SOL_HOURS);
/** A percentage with one decimal, half up (formatPct shows whole percents, which would turn 99.8% into 100%). */
const pct1 = (value: number) => `${roundHalfUp(value, 1).toFixed(1)}%`;
const meters1 = (value: number) => `${roundHalfUp(value, 1).toFixed(1)} m`;
const list = (reasons: string[]) => reasons.map((r) => `  - ${r}`).join("\n");

function emergencyRows(plan: Plan, tSec: number, kind: "dust" | "spe"): string {
  const o = stormAt(site, plan, tSec, kind, START_LMST, { skyView });
  return [
    `| EVA status | **${o.evaStatus}** |`,
    `| Return home status | **${o.abort.status}** |`,
    `| Walk-home time | ${formatMinutes(o.abort.sec)} |`,
    `| Oxygen margin on arrival (above the reserve) | ${formatMinutes(o.abort.marginSec)} |`,
    `| Arrival at the habitat | ${formatMet(o.arriveSec)} (${lmstAt(o.arriveSec)} LMST) |`,
    `| Oxygen when the emergency starts | ${formatPct(o.oxygenNowPct)} |`,
    `| Oxygen on arrival | ${formatPct(o.oxygenOnArrivalPct)} |`,
  ].join("\n");
}

function shelterBlock(plan: Plan, tSec: number): string {
  const o = stormAt(site, plan, tSec, "spe", START_LMST, { skyView });
  const s = o.shelter;
  if (!s.checked) return "Shelter check did not run (no sky-view layer).";
  return [
    "| | |",
    "|---|---|",
    `| Event starts | ${formatMet(tSec)} (${lmstAt(tSec)} LMST) |`,
    `| Recommended | **${s.betterThanHome ? "wait at the shelter" : "walk home"}** |`,
    `| Walk to the ${s.betterThanHome ? "shelter" : "habitat"} | ${formatMinutes(s.sec)} |`,
    `| Walk home (for comparison) | ${formatMinutes(o.abort.sec)} |`,
    `| Sky view at the ${s.betterThanHome ? "shelter" : "habitat"} | ${roundHalfUp(s.skyView, 2).toFixed(2)} |`,
    `| SPE dose, recommended option | ${formatDose(s.doseToShelterMsv)} |`,
    `| SPE dose, walking straight home | ${formatDose(s.doseIfHomeMsv)} |`,
    `| Dose cut by sheltering | ${formatPct(s.doseReductionPct)} |`,
    `| Return home status | **${o.abort.status}**, ${formatMinutes(o.abort.marginSec)} oxygen margin |`,
    "",
    "Reasons, as the app shows them:",
    "",
    list(o.abort.reasons),
    "",
    "Shelter notes, as the app shows them:",
    "",
    list(s.reasons),
  ].join("\n");
}

function monteCarloBlock(r = simulateMission(site, demo, { seed: 42, startLmst: START_LMST })): string {
  const min = (m: number) => formatMinutes(m * 60);
  const three = (v: { p5: number; p50: number; p95: number }, f: (x: number) => string) => `${f(v.p5)} / ${f(v.p50)} / ${f(v.p95)}`;
  const range = (p: (typeof PARAMS)[number]) => `${roundHalfUp(p.low, 3)} to ${roundHalfUp(p.high, 3)} (planned ${roundHalfUp(p.nominal, 3)})`;
  return [
    `> ${r.disclaimer}`,
    "",
    `${r.trials} trials, seed ${r.seed}. The route is fixed; walking speed, terrain, oxygen use and time at each stop are varied.`,
    "",
    "| | |",
    "|---|---|",
    // With no failures, never a bare "100%": the counts and the rule-of-three bound instead.
    r.failureUpperBound95 !== null
      ? `| Home with the oxygen reserve intact | ${r.successCount} of ${r.trials} trials home with reserve (0 failures: failure rate likely below ${roundHalfUp(r.failureUpperBound95 * 100, 1)}%) |`
      : `| Home with the oxygen reserve intact | ${pct1(r.pReturnWithReserve * 100)} (${r.successCount} of ${r.trials} trials) |`,
    `| Home at all (before the oxygen runs out) | ${r.pReturnAtAll === 1 ? `${r.trials} of ${r.trials} trials` : pct1(r.pReturnAtAll * 100)} |`,
    `| Oxygen margin, low / middle / high (5th / 50th / 95th percentile) | ${three(r.marginMin, min)} |`,
    `| Oxygen at return, low / middle / high | ${three(r.oxygenAtReturnPct, formatPct)} |`,
    `| Total time, low / middle / high | ${three(r.durationMin, (m) => formatDuration(m * 60))} |`,
    "",
    "What moves the margin most (one input at a time, the others as planned):",
    "",
    "| Input | Range (all assumed) | Margin at low value | Margin at high value | Swing |",
    "|---|---|---|---|---|",
    ...r.sensitivity.map((s) => {
      const p = PARAMS.find((x) => x.name === s.param)!;
      return `| ${s.label} | ${range(p)} ${p.unit} | ${min(s.lowMarginMin)} | ${min(s.highMarginMin)} | ${min(s.swingMin)} |`;
    }),
  ].join("\n");
}

function buildDoc(): string {
  const validation = readJson("../../../pipeline/data/traverse_validation.json");
  const noGo = validation.no_go_cells_on_path[0];
  const evaluation = readJson("../../public/data/route-model.json").evaluation;
  const vs = evaluation.learned_safe_vs_physics;
  const route = ["HAB-1", ...demoPois.map((p) => p.name), "HAB-1"].join(" → ");

  return `## 1. Demo mission

Start ${formatLmst(START_LMST)} LMST, 30 min of science at each stop, calm conditions.

| | |
|---|---|
| Route | ${route} |
| Distance | ${formatKm(demo.distM)} |
| Walk time | ${formatDuration(demo.walkSec)} (${formatMinutes(demo.walkSec)}) |
| Science time | ${formatDuration(demo.workSec)} (${formatMinutes(demo.workSec)}) |
| Total time | ${formatDuration(demo.totalSec)} |
| Status | **${demo.status}** |
| Oxygen margin | ${formatMinutes(demo.marginSec)} |
| Oxygen at return | ${formatPct(demo.oxygenAtReturnPct)} |

## 2. Dust storm at ${formatMet(INCIDENT_SEC)} of the demo mission

| | |
|---|---|
${emergencyRows(demo, INCIDENT_SEC, "dust")}

## 3. Solar particle event and shelter

The SPE dose numbers are **illustrative** (the ×30 dose rate is not a measured value) and the
shelter model is **simplified**. Say both next to any of these numbers.

### Wildcat Ridge demo (the "SPE at Wildcat Ridge" button)

One stop at ${wildcatPoi.name}, no science time; the event starts on arrival.
Walk out: ${formatKm(wildcatPlan.legs[0].distM)}, ${formatMinutes(wildcatPlan.legs[0].walkSec)}.

${shelterBlock(wildcatPlan, wildcatPlan.legs[0].arriveSec)}

### The same event on the demo mission at ${formatMet(INCIDENT_SEC)}

${shelterBlock(demo, INCIDENT_SEC)}

## 4. Validation against Perseverance's real drive

From \`pipeline/data/traverse_validation.json\` (made by \`pipeline/validate_traverse.py\`).

| | |
|---|---|
| Rover path inside the site | ${formatKm(validation.rover_path.km_inside_bounds * 1000)} |
| Rover path rated passable by ARES | ${pct1(validation.passable.path_length_pct)} |
| Whole site rated passable (for comparison) | ${pct1(validation.passable.whole_site_cells_pct)} |
| Slope layer vs the rover's measured tilt, correlation | r = ${roundHalfUp(validation.waypoints.tilt_vs_our_slope_correlation, 2).toFixed(2)} (${validation.waypoints.count_inside_bounds} waypoints) |
| The one no-go cell the rover crossed (Skinner Ridge) | ${noGo.lat.toFixed(4)} N, ${noGo.lng.toFixed(4)} E: ${meters1(noGo.path_m)} of path, slope ${roundHalfUp(noGo.slope_deg, 1).toFixed(1)}° (limit 25°), rock ${roundHalfUp(noGo.rock, 2).toFixed(2)} |

## 5. Route learning (off by default; the physics planner stays the planner)

From \`app/public/data/route-model.json\` (made by \`pipeline/learn_route_cost.py\`). Mean distance
between the planned route and the rover's real route on ${evaluation.routes} held-out routes; lower is closer.

| Planner | Mean distance from the rover's route |
|---|---|
| Straight line | ${meters1(evaluation.straight_line.mean_dev_m.mean)} |
| ARES physics model | ${meters1(evaluation.physics.mean_dev_m.mean)} |
| Learned model (with the safety rule) | ${meters1(evaluation.learned_safe.mean_dev_m.mean)} |

The learned model chose the same route as physics on ${vs.same} of ${evaluation.routes} routes (closer on ${vs.closer}, further on ${vs.further}).

## 6. Monte Carlo reliability of the demo mission

${monteCarloBlock()}

## 7. Stretch mission

The demo route plus one more real stop: **${wildcatPoi.name}**, a Perseverance sampling site at the
delta front. ${wildcatPoi.note} It is visited after the first stop, with a long
${STRETCH_DWELL_MIN} min sampling session there; the other three stops keep 30 min. Start ${formatLmst(STRETCH_START_LMST)} LMST (earlier than the
demo, so the EVA ends well before the sun gets low), calm conditions.

Knob used: the science time at the extra stop. With the usual 30 min there, no single extra stop
we tried brings the Monte Carlo below 99% home with the reserve.

**Why it is riskier:** the deterministic plan says ${stretch.status} with ${formatMinutes(stretch.marginSec)} of margin, but in about 1 in ${roundHalfUp(1 / (1 - stretchSim.pReturnWithReserve))} plausible versions (${stretchSim.failCount} of ${stretchSim.trials} trials) the astronaut gets home below the 45-minute reserve.

In about 1 in ${roundHalfUp(1 / (1 - stretchSim.pReturnAtAll))} plausible versions the oxygen runs out before the astronaut reaches home.

### The plan (deterministic)

| | |
|---|---|
| Route | ${["HAB-1", ...stretchStops.map((s) => s.label), "HAB-1"].join(" → ")} |
| Distance | ${formatKm(stretch.distM)} |
| Walk time | ${formatDuration(stretch.walkSec)} (${formatMinutes(stretch.walkSec)}) |
| Science time | ${formatDuration(stretch.workSec)} (${formatMinutes(stretch.workSec)}) |
| Total time | ${formatDuration(stretch.totalSec)} |
| Status | **${stretch.status}** |
| Oxygen margin | ${formatMinutes(stretch.marginSec)} |
| Oxygen at return | ${formatPct(stretch.oxygenAtReturnPct)} |

Reasons, as the app shows them:

${list(stretch.reasons)}

### The same plan, 1000 plausible versions (Monte Carlo)

${monteCarloBlock(stretchSim)}

Top sensitivity: **${stretchSim.sensitivity[0].label}** (a swing of ${formatMinutes(stretchSim.sensitivity[0].swingMin * 60)} in the margin).
`;
}

const HEADER_END = "<!-- numbers start -->\n";

function header(): string {
  const commit = execSync("git rev-parse --short HEAD", { cwd: file("."), encoding: "utf8" }).trim();
  return `# ARES demo numbers (frozen)

Use these numbers in the slides, the video and the project page. Do not type a number from memory.

This file is written by \`app/src/planner/demo-numbers.test.ts\`: planner numbers are computed from
the real \`site.json\` and formatted with \`format.ts\`, so they match what the app shows; validation
and route-learning numbers are read from the pipeline's output files. \`npm test\` fails if this
file and the code stop agreeing.

**Numbers taken from commit \`${commit}\`** (the planner and data at that commit).

${HEADER_END}`;
}

describe("docs/demo-numbers.md", () => {
  it("matches what the planner and the data files give today", () => {
    const body = buildDoc();
    if (process.env.UPDATE_DEMO_NUMBERS) writeFileSync(DOC, header() + body, "utf8");
    const committed = readFileSync(DOC, "utf8").replace(/\r\n/g, "\n");
    expect(committed.slice(committed.indexOf(HEADER_END) + HEADER_END.length)).toBe(body);
  });

  it("the stretch mission is still flyable on paper, but the Monte Carlo shows real risk", () => {
    expect(stretch.ok).toBe(true);
    expect(["GO", "CAUTION"]).toContain(stretch.status);
    expect(stretch.marginSec).toBeGreaterThan(0);
    expect(stretchStops).toHaveLength(4); // the demo route plus ONE more stop
    expect(stretchSim.trials).toBe(1000);
    expect(stretchSim.seed).toBe(42);
    // "Home with the reserve" lands between 60% and 90%: risky, not hopeless.
    expect(stretchSim.pReturnWithReserve).toBeGreaterThanOrEqual(0.6);
    expect(stretchSim.pReturnWithReserve).toBeLessThanOrEqual(0.9);
    // The extra stop alone, with the usual 30 min, is not what makes it risky.
    const usual = planRoute(site, stretchCost, site.habitat, stretchStops.map((s) => ({ ...s, dwellMin: 30 })));
    expect(simulateMission(site, usual, { seed: 42, startLmst: STRETCH_START_LMST }).pReturnWithReserve).toBeGreaterThan(0.99);
  });

  it("the stretch mission starts at 10:00, so its only caution is the low oxygen margin", () => {
    expect(STRETCH_START_LMST).toBe(10);
    expect(stretch.status).toBe("CAUTION");
    expect(stretch.reasons).toHaveLength(1);
    expect(stretch.reasons[0]).toMatch(/^Oxygen margin is low/);
    expect(stretch.reasons.join(" ")).not.toMatch(/sun|darkness/i);
    // The sun never gets below 10 degrees during the EVA.
    expect(lowSunDuring(STRETCH_START_LMST, stretch.totalSec)).toBeNull();
  });

  it("the start time does not move the stretch mission's oxygen numbers", () => {
    const at13 = planRoute(site, cost, site.habitat, stretchStops);
    expect(at13.marginSec).toBe(stretch.marginSec);
    expect(at13.distM).toBe(stretch.distM);
    expect(at13.totalSec).toBe(stretch.totalSec);
    const simAt13 = simulateMission(site, at13, { seed: 42, startLmst: START_LMST });
    expect(simAt13.successCount).toBe(stretchSim.successCount);
    expect(simAt13.pReturnAtAll).toBe(stretchSim.pReturnAtAll);
    expect(simAt13.marginMin).toEqual(stretchSim.marginMin);
    expect(simAt13.sensitivity).toEqual(stretchSim.sensitivity);
    // The numbers quoted in the doc.
    expect(stretchSim.successCount).toBe(721);
    expect(roundHalfUp(1 / (1 - stretchSim.pReturnAtAll))).toBe(50); // "about 1 in 50" run out of oxygen
  });

  it("the demo mission is the one in CLAUDE.md", () => {
    expect(demo.status).toBe("GO");
    expect(formatKm(demo.distM)).toBe("4.97 km");
    expect(formatDuration(demo.totalSec)).toBe("3:35");
    expect(formatMinutes(demo.marginSec)).toBe("192 min");
    expect(formatPct(demo.oxygenAtReturnPct)).toBe("49%");
  });
});
