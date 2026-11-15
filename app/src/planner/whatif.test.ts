// planRoute's `whatIf` option, on the real site.json: a different suit oxygen supply,
// walking speed or reserve.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CONSUMABLE_HOURS,
  RESERVE_MIN,
  WALK_BURN,
  WHAT_IF_DEFAULTS,
  buildCostGrid,
  isWhatIf,
  loadSite,
  oxygenBudget,
  planRoute,
  resolveWhatIf,
  safeZone,
  slowedGrid,
  whatIfGrid,
} from "./index";
import type { Plan, Stop, WhatIf } from "./index";

const site = loadSite(JSON.parse(readFileSync(new URL("../../public/data/site.json", import.meta.url), "utf8")));
const cost = buildCostGrid(site, { storm: false, spe: false, startLmst: 13 });
const toStop = (p: (typeof site.pois)[number], dwellMin = 30): Stop => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin });
const demoStops = site.pois.filter((p) => p.kind === "science").slice(0, 3).map((p) => toStop(p));
const base = planRoute(site, cost, site.habitat, demoStops);
const plan = (whatIf?: WhatIf): Plan => planRoute(site, cost, site.habitat, demoStops, { whatIf });
const count = (zone: Uint8Array) => zone.reduce((a, b) => a + b, 0);

describe("planRoute: whatIf overrides", () => {
  it("the defaults are the planner's constants", () => {
    expect(WHAT_IF_DEFAULTS).toEqual({ consumableHours: CONSUMABLE_HOURS, speedFactor: 1, reserveMin: RESERVE_MIN });
    expect(resolveWhatIf()).toEqual(WHAT_IF_DEFAULTS);
    expect(resolveWhatIf({ consumableHours: NaN, speedFactor: -1, reserveMin: 0 })).toEqual(WHAT_IF_DEFAULTS); // unusable values fall back
    expect(isWhatIf()).toBe(false);
    expect(isWhatIf({ ...WHAT_IF_DEFAULTS })).toBe(false);
    expect(isWhatIf({ reserveMin: RESERVE_MIN + 5 })).toBe(true);
  });

  it("with no overrides, or with the default values, the plan is exactly the same", () => {
    const text = JSON.stringify(base);
    expect(JSON.stringify(plan())).toBe(text);
    expect(JSON.stringify(plan({}))).toBe(text);
    expect(JSON.stringify(plan({ ...WHAT_IF_DEFAULTS }))).toBe(text);
    expect(JSON.stringify(planRoute(site, cost, site.habitat, demoStops, {}))).toBe(text);
    expect(whatIfGrid(cost)).toBe(cost); // the very same grid: no copy, no rounding
    expect(whatIfGrid(cost, { speedFactor: 1 })).toBe(cost);
    expect(oxygenBudget(false, {})).toEqual(oxygenBudget(false));
    expect(oxygenBudget(true, {})).toEqual(oxygenBudget(true));
    // And planning a what-if does not disturb the next normal plan.
    plan({ consumableHours: 6, speedFactor: 0.7, reserveMin: 60 });
    expect(JSON.stringify(plan())).toBe(text);
  });

  it("less suit oxygen never increases the margin, and only the oxygen numbers change", () => {
    let last = Infinity;
    for (let hours = 10; hours >= 6; hours -= 0.5) {
      const p = plan({ consumableHours: hours });
      expect(p.marginSec).toBeLessThanOrEqual(last);
      last = p.marginSec;
      // The walk itself is the same: same route, same time, same oxygen used.
      expect(p.totalSec).toBe(base.totalSec);
      expect(p.distM).toBe(base.distM);
      expect(p.oxygenUsedSec).toBe(base.oxygenUsedSec);
      expect(p.marginSec).toBeCloseTo(base.marginSec + (hours - CONSUMABLE_HOURS) * 3600, 6);
    }
  });

  it("a bigger reserve never increases the margin", () => {
    let last = Infinity;
    for (let reserve = 30; reserve <= 60; reserve += 5) {
      const p = plan({ reserveMin: reserve });
      expect(p.marginSec).toBeLessThanOrEqual(last);
      last = p.marginSec;
      expect(p.marginSec).toBeCloseTo(base.marginSec - (reserve - RESERVE_MIN) * 60, 6);
      expect(p.oxygenAtReturnPct).toBe(base.oxygenAtReturnPct); // the reserve does not change what is in the tank
    }
  });

  it("slower walking never shortens the walk, and uses the slow-walk emergency's own grid", () => {
    let last = 0;
    for (let pct = 30; pct >= -30; pct -= 5) {
      const factor = 1 + pct / 100;
      const p = plan({ speedFactor: factor });
      expect(p.ok).toBe(true);
      expect(p.walkSec).toBeGreaterThanOrEqual(last - 1e-3);
      last = p.walkSec;
      expect(p.workSec).toBe(base.workSec); // science time is not walking
      // Every cell is slower by the same factor, so the route is the same and its time scales exactly.
      expect(p.distM).toBeCloseTo(base.distM, 3);
      expect(p.walkSec * factor).toBeCloseTo(base.walkSec, 0);
      expect(p.oxygenUsedSec).toBeCloseTo(p.walkSec * WALK_BURN + (base.oxygenUsedSec - base.walkSec * WALK_BURN), 3);
    }
    expect(whatIfGrid(cost, { speedFactor: 0.7 })).toBe(slowedGrid(cost, 0.7)); // the existing hook, not a new formula
    expect(plan({ speedFactor: 0.7 }).walkSec).toBeGreaterThan(base.walkSec);
    expect(plan({ speedFactor: 1.3 }).walkSec).toBeLessThan(base.walkSec);
  });

  it("a large enough cut flips GO to CAUTION and then to NO-GO, with the reason written out", () => {
    expect(base.status).toBe("GO");
    const tight = plan({ consumableHours: 5.5 });
    expect(tight.status).toBe("CAUTION");
    expect(tight.reasons.join(" ")).toMatch(/Oxygen margin is low/);
    const short = plan({ consumableHours: 4 });
    expect(short.status).toBe("NO-GO");
    expect(short.marginSec).toBeLessThan(0);
    expect(short.reasons.join(" ")).toMatch(/Oxygen margin is negative/);
    // The reasons quote the what-if reserve, not the default one.
    const bigReserve = plan({ consumableHours: 4, reserveMin: 60 });
    expect(bigReserve.reasons.join(" ")).toContain("after the 60 min reserve");
    // All three at their worst slider values together: still a clear answer, never NaN.
    const worst = plan({ consumableHours: 6, speedFactor: 0.7, reserveMin: 60 });
    expect(["CAUTION", "NO-GO"]).toContain(worst.status);
    expect(Number.isFinite(worst.marginSec)).toBe(true);
  });

  it("the safe-return zone follows: less oxygen or slower walking never makes it bigger", () => {
    const zone = (whatIf: WhatIf) => count(safeZone(site, whatIfGrid(cost, whatIf), plan(whatIf)));
    const normal = count(safeZone(site, cost, base));
    expect(zone({})).toBe(normal);
    expect(zone({ consumableHours: 6 })).toBeLessThan(normal);
    expect(zone({ consumableHours: 10 })).toBeGreaterThanOrEqual(normal);
    expect(zone({ speedFactor: 0.7 })).toBeLessThan(normal);
    expect(zone({ reserveMin: 60 })).toBeLessThanOrEqual(normal);
    expect(zone({ consumableHours: 4 })).toBe(0); // a NO-GO plan has no zone
  });

  it("works together with the terrain-blind comparison and with a storm grid", () => {
    const blind = planRoute(site, cost, site.habitat, demoStops, { shortestPath: true, whatIf: { speedFactor: 0.8 } });
    const fast = plan({ speedFactor: 0.8 });
    expect(blind.walkSec).toBeGreaterThanOrEqual(fast.walkSec - 1e-3);
    const storm = buildCostGrid(site, { storm: true, spe: false, startLmst: 13 });
    const aborted = planRoute(site, storm, site.habitat, demoStops, { whatIf: { reserveMin: 60 } });
    expect(aborted.status).toBe("NO-GO"); // a storm still aborts the EVA
    expect(oxygenBudget(true, { reserveMin: 60 }).reserveSec).toBe(oxygenBudget(true).reserveSec + (60 - RESERVE_MIN) * 60);
  });
});
