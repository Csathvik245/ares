// Monte Carlo mission simulator, checked on the real site.json demo mission.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SPEED_TEST, cpuNow } from "../test-utils/cpuClock";
import { WALK_BURN, WORK_BURN, buildCostGrid, loadSite, oxygenBudget, planRoute } from "./index";
import type { Conditions, Stop } from "./index";
import { MONTE_CARLO_DISCLAIMER, PARAMS, simulateMission } from "./montecarlo";
import type { ParamName, UncertainParam } from "./montecarlo";
import { oxygenUsedSec } from "./oxygen";

const CALM: Conditions = { storm: false, spe: false, startLmst: 13 };
const raw = JSON.parse(readFileSync(fileURLToPath(new URL("../../public/data/site.json", import.meta.url)), "utf8"));
const site = loadSite(raw);
const cost = buildCostGrid(site, CALM);
const demoPois = site.pois.filter((p) => p.kind === "science").slice(0, 3);
const stopsWith = (dwellMin: number): Stop[] => demoPois.map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin }));
const demo = planRoute(site, cost, site.habitat, stopsWith(30));

/** PARAMS with every range closed to its nominal value, except the ones given. */
const only = (open: Partial<Record<ParamName, Partial<UncertainParam>>> = {}): UncertainParam[] =>
  PARAMS.map((p) => ({ ...p, low: p.nominal, high: p.nominal, ...open[p.name] }));

describe("simulateMission", () => {
  it("gives the identical result for the same seed, and a different one for another seed", () => {
    const a = simulateMission(site, demo, { seed: 42 });
    const b = simulateMission(site, demo, { seed: 42 });
    const c = simulateMission(site, demo, { seed: 43 });
    expect(b).toEqual(a);
    expect(c.marginMin).not.toEqual(a.marginMin);
    expect(c.histogramMarginMin.counts).not.toEqual(a.histogramMarginMin.counts);
    expect(a.trials).toBe(1000);
    expect(a.seed).toBe(42);
    expect(a.disclaimer).toBe(MONTE_CARLO_DISCLAIMER);
  });

  it("with zero-width ranges gives exactly the deterministic plan", () => {
    const r = simulateMission(site, demo, { params: only() });
    for (const q of ["p5", "p50", "p95"] as const) {
      expect(r.marginMin[q]).toBeCloseTo(demo.marginSec / 60, 6);
      expect(r.durationMin[q]).toBeCloseTo(demo.totalSec / 60, 6);
      expect(r.oxygenAtReturnPct[q]).toBeCloseTo(demo.oxygenAtReturnPct, 6);
    }
    expect(r.successCount).toBe(1000);
    expect(r.failCount).toBe(0);
    expect(r.pReturnWithReserve).toBe(1);
    expect(r.pReturnAtAll).toBe(1);
    expect(r.histogramMarginMin.counts.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(r.histogramMarginMin.counts.filter((n) => n > 0)).toEqual([1000]);
    for (const row of r.sensitivity) expect(row.swingMin).toBeCloseTo(0, 9);
  });

  it("the shared oxygen formula reproduces the plan's own oxygen number", () => {
    expect(oxygenUsedSec(demo.walkSec, demo.workSec)).toBeCloseTo(demo.oxygenUsedSec, 6);
    expect(oxygenUsedSec(100, 200, 2, 3)).toBe(800);
  });

  it("analytic case: speed-only variation moves the median as expected", () => {
    // Speed uniform between 0.8 and 1.0: its median is 0.9. Walking time is walk ÷ speed,
    // which only goes one way as speed changes, so the median walk is planned walk ÷ 0.9.
    const params = only({ walkSpeed: { distribution: "uniform", low: 0.8, high: 1.0 } });
    const r = simulateMission(site, demo, { params, trials: 20000 });
    const expectedDurationMin = (demo.walkSec / 0.9 + demo.workSec) / 60;
    const expectedMarginMin = (oxygenBudget(false).usableSec - ((demo.walkSec / 0.9) * WALK_BURN + demo.workSec * WORK_BURN)) / 60;
    expect(Math.abs(r.durationMin.p50 - expectedDurationMin)).toBeLessThan(0.5);
    expect(Math.abs(r.marginMin.p50 - expectedMarginMin)).toBeLessThan(0.5);
    // Slower than planned in every trial: never better than the plan, never worse than speed 0.8.
    expect(r.marginMin.p95).toBeLessThanOrEqual(demo.marginSec / 60 + 1e-6);
    expect(r.durationMin.p95).toBeLessThanOrEqual((demo.walkSec / 0.8 + demo.workSec) / 60 + 1e-6);
  });

  it("symmetric default ranges keep the median near the plan", () => {
    const r = simulateMission(site, demo);
    expect(Math.abs(r.marginMin.p50 - demo.marginSec / 60)).toBeLessThan(5);
    expect(r.marginMin.p5).toBeLessThan(r.marginMin.p50);
    expect(r.marginMin.p50).toBeLessThan(r.marginMin.p95);
    expect(r.successCount + r.failCount).toBe(r.trials);
    expect(r.pReturnAtAll).toBeGreaterThanOrEqual(r.pReturnWithReserve);
    expect(r.histogramMarginMin.counts.reduce((a, b) => a + b, 0)).toBe(r.trials);
  });

  it("sensitivity has one row per parameter, sorted by swing, biggest first", () => {
    const r = simulateMission(site, demo);
    expect(r.sensitivity.map((s) => s.param).sort()).toEqual(PARAMS.map((p) => p.name).sort());
    for (let i = 1; i < r.sensitivity.length; i++) {
      expect(r.sensitivity[i - 1].swingMin).toBeGreaterThanOrEqual(r.sensitivity[i].swingMin);
    }
    for (const row of r.sensitivity) {
      expect(row.swingMin).toBeCloseTo(Math.abs(row.highMarginMin - row.lowMarginMin), 9);
      expect(row.swingMin).toBeGreaterThan(0);
    }
    // Walking faster leaves more oxygen; burning more leaves less.
    const row = (name: ParamName) => r.sensitivity.find((s) => s.param === name)!;
    expect(row("walkSpeed").highMarginMin).toBeGreaterThan(row("walkSpeed").lowMarginMin);
    expect(row("walkBurn").highMarginMin).toBeLessThan(row("walkBurn").lowMarginMin);
  });

  it("a NO-GO plan is less likely to return with the reserve than the GO demo plan", () => {
    const go = simulateMission(site, demo);
    // Same route, far too much science time: the oxygen margin is negative.
    const tooLong = planRoute(site, cost, site.habitat, stopsWith(150));
    expect(tooLong.status).toBe("NO-GO");
    expect(tooLong.ok).toBe(true);
    const noGo = simulateMission(site, tooLong);
    expect(noGo.pReturnWithReserve).toBeLessThan(go.pReturnWithReserve);
    expect(noGo.marginMin.p50).toBeLessThan(0);

    // A stop nobody can reach: the plan cannot be walked at all.
    const unreachable = planRoute(site, cost, site.habitat, [{ id: "x", label: "x", lat: 10, lng: 10, dwellMin: 10 }]);
    const r = simulateMission(site, unreachable);
    expect(r.pReturnWithReserve).toBe(0);
    expect(r.pReturnAtAll).toBe(0);
    expect(r.failCount).toBe(r.trials);
  });

  it("every parameter is documented, and none claims to be validated", () => {
    expect(PARAMS.map((p) => p.name)).toEqual(["walkSpeed", "terrainSpeed", "walkBurn", "workBurn", "dwell"]);
    for (const p of PARAMS) {
      expect(p.low).toBeLessThanOrEqual(p.nominal);
      expect(p.high).toBeGreaterThanOrEqual(p.nominal);
      expect(p.evidence).toBe("ASSUMED");
      expect(p.source.length).toBeGreaterThan(20);
      expect(p.unit.length).toBeGreaterThan(0);
    }
  });

  it("handles an empty plan and odd options without NaN", () => {
    const empty = planRoute(site, cost, site.habitat, []);
    const r = simulateMission(site, empty, { trials: 0, seed: NaN });
    expect(r.trials).toBe(1);
    expect(r.seed).toBe(42);
    expect(r.pReturnWithReserve).toBe(1);
    expect(Number.isFinite(r.marginMin.p50)).toBe(true);
  });

  it("1,000 trials on the demo mission, median under 100 ms", SPEED_TEST, () => {
    simulateMission(site, demo);
    const times: number[] = [];
    for (let i = 0; i < 7; i++) {
      const t0 = cpuNow();
      simulateMission(site, demo);
      times.push(cpuNow() - t0);
    }
    times.sort((a, b) => a - b);
    console.log(`simulateMission, 1,000 trials: median ${times[3].toFixed(2)} ms`);
    expect(times[3]).toBeLessThan(100);
  });
});
