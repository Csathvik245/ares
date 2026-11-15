// planRoute's `shortestPath` option, on the real site.json: the ARES route against the
// shortest walkable path.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WALK_BURN, buildCostGrid, buildShortestPathGrid, cellIndexOf, loadSite, planRoute } from "./index";
import type { Plan, Stop } from "./index";

const site = loadSite(JSON.parse(readFileSync(new URL("../../public/data/site.json", import.meta.url), "utf8")));
const cost = buildCostGrid(site, { storm: false, spe: false, startLmst: 13 });
const toStop = (p: (typeof site.pois)[number], dwellMin = 30): Stop => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin });
const demoStops = site.pois.filter((p) => p.kind === "science").slice(0, 3).map((p) => toStop(p));
const ares = planRoute(site, cost, site.habitat, demoStops);
const shortest = planRoute(site, cost, site.habitat, demoStops, { shortestPath: true });

describe("planRoute: shortestPath option", () => {
  it("is off by default: the normal route is exactly what it was", () => {
    const plain = planRoute(site, cost, site.habitat, demoStops);
    const explicitOff = planRoute(site, cost, site.habitat, demoStops, { shortestPath: false });
    expect(explicitOff).toEqual(plain);
    expect(planRoute(site, cost, site.habitat, demoStops, {})).toEqual(plain);
    // And asking for the shortest path does not disturb the next normal plan.
    planRoute(site, cost, site.habitat, demoStops, { shortestPath: true });
    expect(planRoute(site, cost, site.habitat, demoStops)).toEqual(plain);
    expect(plain).toEqual(ares);
  });

  it("the shortest path is never longer in metres, leg by leg and in total", () => {
    expect(shortest.ok).toBe(true);
    expect(shortest.legs).toHaveLength(ares.legs.length);
    shortest.legs.forEach((leg, i) => expect(leg.distM).toBeLessThanOrEqual(ares.legs[i].distM + 1e-6));
    expect(shortest.distM).toBeLessThanOrEqual(ares.distM + 1e-6);
  });

  it("timed with the real walking model, it takes at least as long and uses at least as much oxygen", () => {
    shortest.legs.forEach((leg, i) => expect(leg.walkSec).toBeGreaterThanOrEqual(ares.legs[i].walkSec - 1e-3));
    expect(shortest.walkSec).toBeGreaterThanOrEqual(ares.walkSec - 1e-3);
    expect(shortest.totalSec).toBeGreaterThanOrEqual(ares.totalSec - 1e-3);
    expect(shortest.oxygenUsedSec).toBeGreaterThanOrEqual(ares.oxygenUsedSec - 1e-3);
    expect(shortest.marginSec).toBeLessThanOrEqual(ares.marginSec + 1e-3);
    // Science time is the same; only the walking differs, at the walking burn rate.
    expect(shortest.workSec).toBe(ares.workSec);
    expect(shortest.oxygenUsedSec - ares.oxygenUsedSec).toBeCloseTo((shortest.walkSec - ares.walkSec) * WALK_BURN, 3);
  });

  it("uses the same no-go cells: the shortest path never crosses ground ARES forbids", () => {
    const grid = buildShortestPathGrid(cost);
    expect(buildShortestPathGrid(cost)).toBe(grid); // built once per cost grid
    let walkable = 0;
    for (let i = 0; i < cost.secPerM.length; i++) {
      const open = Number.isFinite(cost.secPerM[i]);
      if (Number.isFinite(grid.secPerM[i]) !== open) throw new Error(`cell ${i}: no-go differs`);
      if (open) {
        if (grid.secPerM[i] !== 1) throw new Error(`cell ${i}: not a distance-only cost`);
        walkable++;
      }
    }
    expect(walkable).toBeGreaterThan(0);
    // Every point of every drawn leg lies on a walkable cell, and the legs start and end at the stops.
    for (const leg of shortest.legs) {
      expect(leg.path.length).toBeGreaterThan(1);
      for (const p of leg.path) expect(Number.isFinite(cost.secPerM[cellIndexOf(site, p)])).toBe(true);
    }
    expect(shortest.legs[0].path[0]).toEqual({ lat: site.habitat.lat, lng: site.habitat.lng });
  });

  it("holds for other missions too: every pair of rover sampling sites", () => {
    const pois = site.pois.filter((p) => p.kind === "science");
    let differs = 0;
    for (let a = 0; a < pois.length; a++)
      for (let b = a + 1; b < pois.length; b++) {
        const stops = [toStop(pois[a], 0), toStop(pois[b], 0)];
        const fast: Plan = planRoute(site, cost, site.habitat, stops);
        const short: Plan = planRoute(site, cost, site.habitat, stops, { shortestPath: true });
        if (!fast.ok) continue;
        expect(short.ok).toBe(true);
        expect(short.distM).toBeLessThanOrEqual(fast.distM + 1e-6);
        expect(short.walkSec).toBeGreaterThanOrEqual(fast.walkSec - 1e-3);
        if (short.walkSec > fast.walkSec + 1) differs++;
      }
    expect(differs).toBeGreaterThan(0); // on real terrain the shortest way is usually not the fastest
  });

  it("an impossible plan is still explained, never thrown", () => {
    const off: Stop = { id: "off", label: "Off the map", lat: site.bounds.north + 1, lng: site.bounds.east + 1, dwellMin: 10 };
    const plan = planRoute(site, cost, site.habitat, [off], { shortestPath: true });
    expect(plan.ok).toBe(false);
    expect(plan.status).toBe("NO-GO");
    expect(plan.reasons.join(" ")).toContain("outside the mapped area");
  });
});
