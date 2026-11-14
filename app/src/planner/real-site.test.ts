// The terrain the app actually ships: app/public/data/site.json, built from real
// NASA data by pipeline/build_site.py. These tests guard two things:
//   1. no fake or placeholder terrain reaches the app, and
//   2. the demo mission (the first three science POIs) stays a 4-5 km GO loop.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildCostGrid, cellIndexOf, dijkstraField, loadSite, planRoute } from "./index";
import type { Stop } from "./index";

const raw = JSON.parse(readFileSync(fileURLToPath(new URL("../../public/data/site.json", import.meta.url)), "utf8"));
const site = loadSite(raw);
const cost = buildCostGrid(site, { storm: false, spe: false, startLmst: 13 });

describe("real site.json", () => {
  it("is not the fake fixture and every layer names a real source", () => {
    expect(raw.fake).toBeUndefined();
    for (const layer of ["elevation", "slope", "rock", "thermalInertia", "science"]) {
      const source = String(raw.sources[layer]);
      expect(source.length).toBeGreaterThan(20);
      expect(source).not.toMatch(/fake|pending|synthetic|placeholder/i);
    }
  });

  it("has real data in every layer (no all-null layers)", () => {
    for (const [name, values] of Object.entries(site.layers)) {
      const valid = values.filter((v) => !Number.isNaN(v)).length;
      expect(valid / values.length, name).toBeGreaterThan(0.95);
    }
    // Jezero's floor is far below the Mars datum.
    expect(Math.max(...site.layers.elevation)).toBeLessThan(-2000);
  });

  it("puts the habitat at the Perseverance landing site, on walkable ground", () => {
    expect(site.habitat.lat).toBeCloseTo(18.4446, 3);
    expect(site.habitat.lng).toBeCloseTo(77.4509, 3);
    expect(cost.secPerM[cellIndexOf(site, site.habitat)]).not.toBe(Infinity);
  });

  it("every POI can be reached from the habitat", () => {
    const home = dijkstraField(cost, cellIndexOf(site, site.habitat));
    expect(site.pois.length).toBeGreaterThanOrEqual(3);
    for (const poi of site.pois) expect(home.cost[cellIndexOf(site, poi)], poi.id).not.toBe(Infinity);
  });

  it("the demo mission (first three science POIs, 30 min each) is a 4-5 km GO loop", () => {
    const stops: Stop[] = site.pois
      .filter((p) => p.kind === "science")
      .slice(0, 3)
      .map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin: 30 }));
    expect(stops).toHaveLength(3);
    const plan = planRoute(site, cost, site.habitat, stops);
    console.log(
      `demo mission: ${stops.map((s) => s.id).join(" > ")}: ${(plan.distM / 1000).toFixed(2)} km, ` +
        `${Math.floor(plan.totalSec / 3600)} h ${Math.round((plan.totalSec % 3600) / 60)} min ` +
        `(walk ${(plan.walkSec / 60).toFixed(0)} min), margin ${(plan.marginSec / 60).toFixed(0)} min, ` +
        `oxygen at return ${plan.oxygenAtReturnPct.toFixed(0)}%, ${plan.status}; legs ` +
        plan.legs.map((l) => `${Math.round(l.distM)} m/${Math.round(l.walkSec / 60)} min`).join(", "),
    );
    expect(plan.ok).toBe(true);
    expect(plan.status).toBe("GO");
    expect(plan.distM).toBeGreaterThan(4000);
    expect(plan.distM).toBeLessThan(5000);
  });
});
