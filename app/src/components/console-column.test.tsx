// Render checks for the console column (MissionPanel and LayerRail), on the real site.json.
// They render to an HTML string with a prepared mission (no browser, no fetch) and look
// for what must, and must not, be on screen.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MissionContextForTests, type MissionState } from "../lib/MissionContext";
import { buildCostGrid, envAt, loadSite, planRoute } from "../planner";
import type { Conditions, Stop } from "../planner";
import { homeField, roundHalfUp } from "../lib/planner";
import { scienceScore } from "../planner/science";
import { LayerRail } from "./LayerRail";
import { MissionPanel, parseElapsed, type MissionPart } from "./MissionPanel";

const site = loadSite(JSON.parse(readFileSync(new URL("../../public/data/site.json", import.meta.url), "utf8")));
const conditions: Conditions = { storm: false, spe: false, startLmst: 13 };
const cost = buildCostGrid(site, conditions);
const demoStops: Stop[] = site.pois
  .filter((p) => p.kind === "science")
  .slice(0, 3)
  .map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin: 30 }));
const nothing = () => {};

/** A mission as the provider would hand it out, before any emergency, for the given stops. */
function missionWith(stops: Stop[]): MissionState {
  const plan = planRoute(site, cost, site.habitat, stops);
  return {
    site,
    cost,
    plan,
    evaPlan: plan,
    stops,
    demo: demoStops,
    conditions,
    elapsed: 0,
    clockElapsed: 0,
    selected: "",
    emergency: null,
    emergencyOutcome: null,
    scenario: null,
    replanned: false,
    returnPlan: null,
    returnElapsed: 0,
    abort: null,
    evaStatus: plan.status,
    evaReasons: plan.reasons,
    env: envAt(13, false),
    position: { ...site.habitat, phase: "walk", legIndex: 0, oxygenUsedSec: 0 },
    home: homeField(site, cost),
    wildcat: site.pois.find((p) => p.id === "delta-wildcat-ridge"),
    basemap: null,
    edit: nothing,
    loadDemo: nothing,
    setSelected: nothing,
    setConditions: nothing,
    trigger: () => null,
    reset: nothing,
    loadWildcatSpe: nothing,
  } as unknown as MissionState;
}

const panel = (stops: Stop[], part: MissionPart) =>
  renderToStaticMarkup(
    <MissionContextForTests.Provider value={missionWith(stops)}>
      <MissionPanel part={part} onDetail={nothing} />
    </MissionContextForTests.Provider>,
  );
const rail = (part: "all" | "layers" | "start", active: ("slope" | "sand")[] = []) =>
  renderToStaticMarkup(
    <MissionContextForTests.Provider value={missionWith(demoStops)}>
      <LayerRail part={part} active={active} onChange={nothing} probe={-1} onSources={nothing} />
    </MissionContextForTests.Provider>,
  );
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

describe("empty state: no stops, no route", () => {
  it("shows a neutral NO PLAN with what to do next, and no GO", () => {
    const html = panel([], "status");
    expect(html).toContain('<strong class="large-status ink-NONE">NO PLAN</strong>');
    expect(text(html)).toContain("Load the demo mission or click the map to add stops.");
    expect(html).not.toContain("ink-GO");
    expect(text(html)).not.toMatch(/\bGO\b/);
    expect(text(html)).not.toContain("All stops reachable");
    expect(text(html)).not.toContain("Planner reasons");
  });

  it("hides the oxygen bar, the stat tiles and the reliability panel", () => {
    expect(panel([], "budget")).toBe("");
    expect(panel([], "reliability")).toBe("");
    const whole = panel([], "all");
    expect(whole).not.toContain("oxygen-panel");
    expect(whole).not.toContain("stat-tiles");
    expect(text(whole)).not.toMatch(/\d+%/);
    expect(text(whole)).not.toMatch(/0\.00 km|Margin|Oxygen budget/);
  });

  it("hides the stop counter, and keeps Load demo available", () => {
    const html = panel([], "stops");
    expect(text(html)).toContain("Science stops");
    expect(text(html)).not.toMatch(/\d+ stops?/);
    expect(html).toMatch(/<button>Load demo<\/button>/);
    expect(html).toMatch(/<button disabled="">Clear<\/button>/);
  });

  it("the emergency block says why it cannot be triggered yet", () => {
    const html = panel([], "emergency");
    expect(html).toMatch(/<button class="emergency-trigger" disabled="">Trigger<\/button>/);
    expect(text(html)).toContain("Add a route first");
    // The Wildcat Ridge demo loads its own route, so it stays available.
    expect(html).toMatch(/<button class="text-button">Demo: SPE at Wildcat Ridge<\/button>/);
    expect(html).toMatch(/<button class="text-button storm-preset" disabled="">Demo: storm at T\+1:16<\/button>/);
  });
});

describe("with the demo mission", () => {
  it("status: the word, one line of reason, and the reasons behind an expander", () => {
    const html = panel(demoStops, "status");
    expect(html).toContain('<strong class="large-status ink-GO">GO</strong>');
    expect(text(html)).toContain("All stops reachable with 192 min of oxygen margin above reserve.");
    expect(html).toContain("<summary>Planner reasons</summary>");
    expect(html).not.toMatch(/<details[^>]* open/); // closed by default
    // Lowest sun lives in the reasons now, not in a tile.
    expect(text(html)).toMatch(/Lowest sun during the EVA: \d+° above the horizon/);
    expect(text(html)).toContain("Mission status");
  });

  it("stops: the three actions, the count, and the numbered list", () => {
    const html = panel(demoStops, "stops");
    const t = text(html);
    expect(t).toMatch(/Science stops 3 stops/);
    expect(t.indexOf("Load demo")).toBeLessThan(t.indexOf("Suggest stops"));
    expect(t.indexOf("Suggest stops")).toBeLessThan(t.indexOf("Clear"));
    for (const n of ["01", "02", "03"]) expect(html).toContain(`<span class="stop-number">${n}</span>`);
    expect(t).toContain("T+0:21");
    expect(t).toContain("30 min science");
    expect(panel(demoStops.slice(0, 1), "stops")).toContain("<small>1 stop</small>");
  });

  it("stops: each row shows only 'Science <value>'; 'per oxygen-minute' is in the tooltip", () => {
    const html = panel(demoStops, "stops");
    const rows = [...html.matchAll(/<span class="stop-science-score" title="([^"]*)">([^<]*)<\/span>/g)];
    expect(rows).toHaveLength(demoStops.length);
    const scores = scienceScore(site, planRoute(site, cost, site.habitat, demoStops), { stops: demoStops });
    rows.forEach(([, title, shown], i) => {
      expect(shown).toMatch(/^Science \d(\.\d{1,2})?$/);
      expect(shown).toBe(`Science ${roundHalfUp(scores[i].science, 2)}`); // the planner's value, not typed in
      expect(title.startsWith(`${roundHalfUp(scores[i].score, 3).toFixed(3)} per oxygen-minute`)).toBe(true);
      expect(title).toMatch(/^\d\.\d{3} per oxygen-minute/);
    });
    expect(text(html)).not.toContain("per oxygen-minute");
  });

  it("budget: the bar and four tiles, in order, with one evidence tag in the header", () => {
    const html = panel(demoStops, "budget");
    const t = text(html);
    expect(t).toContain("Oxygen budget");
    expect(t).toContain("49%");
    const labels = [...html.matchAll(/<dt>([^<]+)<\/dt>/g)].map((m) => m[1]);
    expect(labels).toEqual(["Distance", "Total duration", "Margin", "Dose"]);
    expect(t).toContain("4.97 km");
    expect(t).toContain("3:35");
    expect(t).toContain("2:05 walk + 1:30 science");
    expect(t).toContain("192 min");
    expect(t).toMatch(/Dose 0\.09 mSv/); // two decimals
    expect(t).not.toMatch(/0\.09\d mSv/);
    // One evidence tag for the section; no per-tile "CALCULATED".
    expect(html.match(/CALCULATED/g)).toHaveLength(1);
    expect(t).not.toMatch(/Lowest sun/i);
  });

  it("labels are in sentence case", () => {
    const whole = text(panel(demoStops, "all"));
    expect(whole).toContain("Reserve target");
    for (const wrong of ["Reserve Target", "Total Duration", "Radiation Dose", "Walking Time", "Station Science", "MISSION STATUS", "OXYGEN BUDGET", "SCIENCE STOPS", "EMERGENCY SIMULATION"]) {
      expect(whole).not.toContain(wrong);
    }
  });

  it("order in the single rail: status, stops, oxygen and tiles, reliability, emergency", () => {
    const t = text(panel(demoStops, "all"));
    const at = ["Mission status", "Science stops", "Oxygen budget", "Mission reliability", "Emergency simulation"].map((s) => t.indexOf(s));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("emergency: one menu with the five emergencies, a T+ time, one Trigger, two demos", () => {
    const html = panel(demoStops, "emergency");
    expect(html.match(/<select/g)).toHaveLength(1);
    expect([...html.matchAll(/<option value="([^"]+)"[^>]*>([^<]+)<\/option>/g)].map((m) => `${m[1]}=${m[2]}`)).toEqual([
      "storm=Dust storm",
      "spe=Solar radiation storm (SPE)",
      "oxygen-loss=Oxygen leak",
      "slow-walk=Slower walking",
      "blocked-path=Path blocked",
    ]);
    expect(html).toMatch(/<span>T\+<\/span><input[^>]*value="0:00"/); // defaults to the playback time
    expect(html.match(/emergency-trigger/g)).toHaveLength(1);
    expect(html).toMatch(/<button class="emergency-trigger">Trigger<\/button>/); // enabled
    expect(text(html)).toContain("Demo: storm at T+1:16");
    expect(text(html)).toContain("Demo: SPE at Wildcat Ridge");
    expect(html).not.toContain("disabled");
    // The old row of seven buttons is gone: Trigger, the two demo links, and the (?) that explains SPE.
    expect(html.match(/<button/g)).toHaveLength(4);
    expect(html).toContain('aria-label="SPE: solar particle event: a burst of radiation"');
  });
});

describe("parseElapsed: the T+ time field", () => {
  it("reads hours:minutes or plain minutes", () => {
    expect(parseElapsed("1:16")).toBe(4560);
    expect(parseElapsed("0:00")).toBe(0);
    expect(parseElapsed(" 3:35 ")).toBe(12900);
    expect(parseElapsed("76")).toBe(4560);
  });
  it("rejects anything else", () => {
    for (const bad of ["", "abc", "1:7", "1:60", "-5", "1.5", "1:16:00"]) expect(Number.isNaN(parseElapsed(bad)), bad).toBe(true);
  });
});

describe("LayerRail", () => {
  it("map layers: closed by default, one compact row per layer, the source in a tooltip", () => {
    const html = rail("layers");
    expect(html).toMatch(/^<details class="collapsible layers-section">/); // no "open"
    expect(text(html)).toContain("Map layers");
    expect(text(html)).toContain("none on");
    expect(html.match(/class="layer-row/g)).toHaveLength(5);
    expect(html).toMatch(/title="THEMIS \/ Mars Odyssey · [^"]*"/);
    expect(html).toMatch(/title="CRISM \/ MRO · [^"]*"/);
    expect(html.match(/title="HiRISE \/ MRO · /g)).toHaveLength(3);
    // The instrument is in the tooltip, not printed in the row.
    expect(text(html)).not.toMatch(/THEMIS|CRISM|HiRISE/);
    expect(text(rail("layers", ["slope", "sand"]))).toContain("2 on");
  });

  it("start time: the value with minus and plus buttons", () => {
    const html = rail("start");
    expect(html).toMatch(/^<details class="collapsible start-section">/);
    expect(text(html)).toContain("Start time");
    expect(html).toContain("<output aria-live=\"polite\">13:00 LMST</output>");
    expect(html).toMatch(/aria-label="Start one hour earlier">−<\/button>/);
    expect(html).toMatch(/aria-label="Start one hour later">\+<\/button>/);
    expect(html).not.toContain('type="number"');
  });

  it("the tablet rail keeps layers, start time and the terrain read-out, without the data-and-model note", () => {
    const t = text(rail("all"));
    for (const s of ["Map layers", "Start time", "13:00 LMST", "Elevation", "Walk home", "Data sources and assumptions"]) expect(t).toContain(s);
    expect(t).not.toMatch(/DATA AND MODEL|ROUTING MODEL|Tobler/);
  });
});
