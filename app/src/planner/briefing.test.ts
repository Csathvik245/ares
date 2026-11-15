// computeBriefing on the real demo mission (app/public/data/site.json).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildCostGrid,
  computeBriefing,
  doseRateMsvPerHr,
  explainSegment,
  formatDose,
  formatMinutes,
  formatPct,
  loadSite,
  lowSunDuring,
  planRoute,
  sunElevationSeries,
} from "./index";
import type { BriefingRow, Conditions, Stop } from "./index";

const site = loadSite(JSON.parse(readFileSync(fileURLToPath(new URL("../../public/data/site.json", import.meta.url)), "utf8")));
const CALM: Conditions = { storm: false, spe: false, startLmst: 13 };
const demoStops = (dwellMin = 30): Stop[] =>
  site.pois
    .filter((p) => p.kind === "science")
    .slice(0, 3)
    .map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin }));
const planFor = (conditions: Conditions, stops = demoStops()) => planRoute(site, buildCostGrid(site, conditions), site.habitat, stops);
const row = (rows: BriefingRow[], key: BriefingRow["key"]) => rows.find((r) => r.key === key)!;

describe("computeBriefing: the demo mission", () => {
  const plan = planFor(CALM);
  const briefing = computeBriefing(site, plan, CALM);

  it("has the five rows, in order, each with a status, a value and an evidence tag", () => {
    expect(briefing.rows.map((r) => r.key)).toEqual(["TERRAIN", "CONSUMABLES", "RADIATION", "LIGHTING", "WEATHER"]);
    for (const r of briefing.rows) {
      expect(["GO", "CAUTION", "NO-GO", "MONITOR"]).toContain(r.status);
      expect(["MEAS", "CALC", "ASSUMED"]).toContain(r.evidence);
      expect(r.value.length).toBeGreaterThan(5);
      expect(r.value).not.toMatch(/NaN|undefined|Infinity/);
    }
    console.log(`demo briefing: ${briefing.status}\n` + briefing.rows.map((r) => `  ${r.key.padEnd(12)} ${r.status.padEnd(8)} [${r.evidence}] ${r.value}`).join("\n"));
  });

  it("is GO overall, matching planRoute (Contract 3)", () => {
    expect(plan.status).toBe("GO");
    expect(briefing.status).toBe("GO");
    expect(briefing.reasons).toEqual([]);
  });

  it("TERRAIN: max slope and soft-sand share come from the cells the route crosses", () => {
    const facts = plan.legs.map((_, i) => explainSegment(site, plan, i));
    const maxSlope = Math.max(...facts.map((f) => f.maxSlopeDeg));
    const sandPct = (facts.reduce((sum, f, i) => sum + f.sandFraction * plan.legs[i].distM, 0) / plan.distM) * 100;
    const terrain = row(briefing.rows, "TERRAIN");
    expect(terrain).toMatchObject({ status: "GO", evidence: "MEAS" });
    expect(terrain.value).toContain(`Max slope ${maxSlope.toFixed(1)}°`);
    expect(terrain.value).toContain(`soft sand ${formatPct(sandPct)} of route`);
    expect(maxSlope).toBeLessThanOrEqual(25); // the route never crosses a no-go slope
  });

  it("CONSUMABLES: margin against the reserve", () => {
    const consumables = row(briefing.rows, "CONSUMABLES");
    expect(consumables).toMatchObject({ status: "GO", evidence: "CALC" });
    expect(consumables.value).toBe(
      `Margin ${formatMinutes(plan.marginSec)} above the 45 min reserve · ${formatPct(plan.oxygenAtReturnPct)} oxygen at return`,
    );
    expect(consumables.value).toContain("Margin 192 min");
  });

  it("RADIATION: projected dose = dose rate × EVA duration", () => {
    const radiation = row(briefing.rows, "RADIATION");
    const dose = doseRateMsvPerHr(false) * (plan.totalSec / 3600);
    expect(radiation).toMatchObject({ status: "GO", evidence: "CALC" });
    expect(radiation.value).toBe(`Projected EVA dose ${formatDose(dose)}`);
  });

  it("LIGHTING: the lowest sun of the EVA, GO at a 13:00 start", () => {
    const lighting = row(briefing.rows, "LIGHTING");
    const series = sunElevationSeries(CALM.startLmst, Math.ceil(plan.totalSec / 60) * 60, 60);
    const lowest = Math.min(...series.map((s) => s.sunElevationDeg));
    expect(lowest).toBeGreaterThan(10);
    expect(lighting).toMatchObject({ status: "GO", evidence: "CALC" });
    expect(lighting.value).toContain(`Lowest sun ${lowest.toFixed(1)}°`);
    expect(lighting.value).toMatch(/at \d\d:\d\d LMST/);
  });

  it("WEATHER: MONITOR, tagged as an assumption", () => {
    const weather = row(briefing.rows, "WEATHER");
    expect(weather).toMatchObject({ status: "MONITOR", evidence: "ASSUMED" });
    expect(weather.value).toContain("walking 55% speed");
    expect(weather.value).toContain("reserve +30 min");
  });
});

describe("computeBriefing: the overall status follows Contract 3 and agrees with planRoute", () => {
  const cases: [string, Conditions, Stop[]][] = [
    ["calm demo", CALM, demoStops()],
    ["late start (low sun)", { ...CALM, startLmst: 15.5 }, demoStops()],
    ["long science (low margin)", CALM, demoStops(95)],
    ["far too long (negative margin)", CALM, demoStops(200)],
    ["dust storm", { ...CALM, storm: true }, demoStops()],
    ["solar particle event", { ...CALM, spe: true }, demoStops()],
    ["no stops", CALM, []],
  ];
  for (const [name, conditions, stops] of cases) {
    it(`${name}: same status as planRoute`, () => {
      const plan = planFor(conditions, stops);
      expect(computeBriefing(site, plan, conditions).status).toBe(plan.status);
    });
  }

  it("a late start gives LIGHTING CAUTION", () => {
    const conditions = { ...CALM, startLmst: 15.5 };
    const plan = planFor(conditions);
    expect(lowSunDuring(conditions.startLmst, plan.totalSec)).not.toBeNull();
    const briefing = computeBriefing(site, plan, conditions);
    expect(row(briefing.rows, "LIGHTING").status).toBe("CAUTION");
    expect(briefing.status).toBe("CAUTION");
    expect(briefing.reasons).toHaveLength(1);
    expect(briefing.reasons[0]).toMatch(/^LIGHTING: Lowest sun/);
  });

  it("a low margin gives CONSUMABLES CAUTION, a negative margin NO-GO", () => {
    const low = computeBriefing(site, planFor(CALM, demoStops(95)), CALM);
    expect(row(low.rows, "CONSUMABLES").status).toBe("CAUTION");
    const negative = computeBriefing(site, planFor(CALM, demoStops(200)), CALM);
    expect(row(negative.rows, "CONSUMABLES").status).toBe("NO-GO");
    expect(row(negative.rows, "CONSUMABLES").value).toMatch(/^Oxygen short by \d+ min/);
    expect(negative.status).toBe("NO-GO");
  });

  it("a dust storm gives WEATHER NO-GO; an SPE gives RADIATION NO-GO", () => {
    const stormConditions = { ...CALM, storm: true };
    const storm = computeBriefing(site, planFor(stormConditions), stormConditions);
    expect(row(storm.rows, "WEATHER")).toMatchObject({ status: "NO-GO", value: "Dust storm: EVA aborted" });
    expect(row(storm.rows, "CONSUMABLES").value).toContain("75 min reserve"); // 45 + 30 in a storm
    expect(storm.status).toBe("NO-GO");

    const speConditions = { ...CALM, spe: true };
    const spe = computeBriefing(site, planFor(speConditions), speConditions);
    expect(row(spe.rows, "RADIATION")).toMatchObject({ status: "NO-GO", evidence: "ASSUMED" });
    expect(row(spe.rows, "WEATHER").status).toBe("MONITOR");
    expect(spe.status).toBe("NO-GO");
  });

  it("an unreachable stop gives TERRAIN NO-GO", () => {
    const offMap: Stop[] = [{ id: "x", label: "Off the map", lat: 50, lng: 50, dwellMin: 10 }];
    const briefing = computeBriefing(site, planFor(CALM, offMap), CALM);
    expect(row(briefing.rows, "TERRAIN").status).toBe("NO-GO");
    expect(briefing.status).toBe("NO-GO");
  });

  it("an empty plan still gives five readable rows", () => {
    const briefing = computeBriefing(site, planFor(CALM, []), CALM);
    expect(briefing.rows).toHaveLength(5);
    expect(briefing.status).toBe("GO");
    expect(row(briefing.rows, "TERRAIN").value).toBe("No route yet");
  });
});
