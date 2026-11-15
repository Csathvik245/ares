// Learned route cost (off by default). These tests guard:
//   - OFF BY DEFAULT: planRoute without routeGrid is byte-identical to the planner
//     before the option existed (golden file), and the demo mission stays
//     4.97 km, GO, 49% oxygen at return;
//   - the learned grid has exactly the Contract 2 no-go cells;
//   - the TypeScript features reproduce the Python training features;
//   - with a routeGrid, every number still comes from the Contract 2 walking model;
//   - the safety rule: no model may be less careful than the physics model;
//   - learned weights really steer the route (fixture with a strong sand penalty).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ROUTE_FEATURES,
  aStar,
  buildCostGrid,
  buildLearnedCostGrid,
  cellIndexOf,
  compareRoutes,
  learnedCostRatio,
  loadRouteModel,
  loadSite,
  pathTimeSec,
  pathTo,
  planRoute,
} from "./index";
import type { Conditions, Stop } from "./index";

const read = (rel: string) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));
const calm: Conditions = { storm: false, spe: false, startLmst: 13 };

const modelJson = read("../../public/data/route-model.json");
const model = loadRouteModel(modelJson);
const site = loadSite(read("../../public/data/site.json"));
const cost = buildCostGrid(site, calm);
const learned = buildLearnedCostGrid(site, model, calm);
const demoStops: Stop[] = site.pois
  .filter((p) => p.kind === "science")
  .slice(0, 3)
  .map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin: 30 }));

/** A model in the shipped format with chosen weights (for fixture tests). */
function makeModel(weights: Partial<Record<(typeof ROUTE_FEATURES)[number], number>>) {
  return loadRouteModel({
    ...modelJson,
    features: ROUTE_FEATURES.map((id) => ({ id, weight: weights[id] ?? (id === "log_walk_time" ? 1 : 0) })),
  });
}

describe("off by default", () => {
  const golden = read("./__fixtures__/demo-plan-golden.json").plan;

  it("planRoute without routeGrid is byte-identical to the planner before the option existed", () => {
    const plan = planRoute(site, cost, site.habitat, demoStops);
    expect(JSON.stringify(plan)).toBe(JSON.stringify(golden));
    expect(JSON.stringify(planRoute(site, cost, site.habitat, demoStops, {}))).toBe(JSON.stringify(golden));
    expect(JSON.stringify(planRoute(site, cost, site.habitat, demoStops, { routeGrid: cost }))).toBe(
      JSON.stringify(golden),
    );
  });

  it("the demo mission stays 4.97 km, GO, 49% oxygen at return", () => {
    const plan = planRoute(site, cost, site.habitat, demoStops);
    expect((plan.distM / 1000).toFixed(2)).toBe("4.97");
    expect(plan.status).toBe("GO");
    expect(Math.round(plan.oxygenAtReturnPct)).toBe(49);
  });
});

describe("loadRouteModel", () => {
  it("reads the shipped model with every feature in order and a named source", () => {
    expect(Array.from(model.weights)).toHaveLength(ROUTE_FEATURES.length);
    expect(model.source.routes).toBeGreaterThan(10);
    expect(model.source.traverse).toMatch(/M20_traverse\.json$/);
    expect(model.source.credit).toBe("NASA/JPL-Caltech");
  });

  it("refuses a model with missing, extra or reordered features", () => {
    const f = modelJson.features;
    expect(() => loadRouteModel({ ...modelJson, features: f.slice(1) })).toThrow();
    expect(() => loadRouteModel({ ...modelJson, features: [...f.slice(1), f[0]] })).toThrow();
    expect(() => loadRouteModel({ ...modelJson, features: [...f, { id: "extra", weight: 1 }] })).toThrow();
    expect(() => loadRouteModel(null)).toThrow();
  });

  it("refuses any model that is less careful than the physics model (safety rule)", () => {
    expect(() => makeModel({ log_walk_time: 0 })).toThrow();
    expect(() => makeModel({ log_walk_time: 0.9 })).toThrow();
    expect(() => makeModel({ soft_sand: -0.1 })).toThrow();
    expect(() => makeModel({ near_no_go: -1 })).toThrow();
    expect(() => makeModel({ soft_sand: Number.NaN })).toThrow();
    expect(() => makeModel({ log_walk_time: 1.2, roughness: 0.5 })).not.toThrow();
  });

  it("the shipped weights obey the safety rule", () => {
    expect(model.weights[0]).toBeGreaterThanOrEqual(1);
    for (let k = 1; k < model.weights.length; k++) expect(model.weights[k]).toBeGreaterThanOrEqual(0);
  });
});

describe("learned cost grid on the real site", () => {
  it("matches the Python training features cell for cell (route-model.json checks)", () => {
    const ratio = learnedCostRatio(site, model);
    expect(model.checks.length).toBeGreaterThan(20);
    for (const { index, ratio: expected } of model.checks) {
      if (expected === null) expect(ratio[index], `cell ${index}`).toBe(Infinity);
      else expect(Math.abs(ratio[index] - expected) / expected, `cell ${index}`).toBeLessThan(1e-4);
    }
  });

  it("has exactly the Contract 2 no-go cells", () => {
    let nogo = 0;
    const mismatched: number[] = [];
    for (let i = 0; i < cost.secPerM.length; i++) {
      const physicsNoGo = cost.secPerM[i] === Infinity;
      if (physicsNoGo) nogo++;
      const ok = physicsNoGo
        ? learned.secPerM[i] === Infinity
        : learned.secPerM[i] > 0 && Number.isFinite(learned.secPerM[i]);
      if (!ok) mismatched.push(i);
    }
    expect(mismatched).toEqual([]);
    expect(nogo).toBeGreaterThan(0);
    expect(learned.minSecPerM).toBeGreaterThan(0);
  });

  it("keeps the same route shape in a storm (every cell scales together)", () => {
    const storm = buildLearnedCostGrid(site, model, { ...calm, storm: true });
    const a = cellIndexOf(site, site.habitat);
    const b = cellIndexOf(site, demoStops[1]);
    expect(pathTo(aStar(storm, a, b), b)).toEqual(pathTo(aStar(learned, a, b), b));
  });
});

describe("planRoute with a routeGrid", () => {
  it("times the learned route with the Contract 2 model, never faster than the fastest route", () => {
    const fastest = planRoute(site, cost, site.habitat, demoStops);
    const expert = planRoute(site, cost, site.habitat, demoStops, { routeGrid: learned });
    expect(expert.ok).toBe(true);
    expect(expert.legs).toHaveLength(fastest.legs.length);
    expect(expert.walkSec).toBeGreaterThanOrEqual(fastest.walkSec - 1e-6);
    expect(expert.workSec).toBe(fastest.workSec);
    expect(expert.oxygenUsedSec).toBeCloseTo(expert.walkSec * 1.3 + expert.workSec * 0.9, 6);
    for (let k = 0; k < expert.legs.length; k++) {
      const leg = expert.legs[k];
      const start = k === 0 ? site.habitat : demoStops[k - 1];
      const end = k === demoStops.length ? site.habitat : demoStops[k];
      expect(leg.path[0]).toEqual({ lat: start.lat, lng: start.lng });
      expect(leg.path[leg.path.length - 1]).toEqual({ lat: end.lat, lng: end.lng });
    }
    const cmp = compareRoutes(site, model, fastest, expert);
    expect(cmp.extraWalkSec).toBeGreaterThanOrEqual(0);
    expect(cmp.fastest.distM).toBeGreaterThan(4000);
  });

  it("refuses a routeGrid of a different size", () => {
    expect(() => planRoute(site, cost, site.habitat, demoStops, { routeGrid: { ...learned, width: 10 } })).toThrow(
      RangeError,
    );
  });

  it("pathTimeSec equals the search's own cost on the same grid", () => {
    const a = cellIndexOf(site, site.habitat);
    const b = cellIndexOf(site, demoStops[0]);
    const r = aStar(cost, a, b);
    expect(pathTimeSec(cost, pathTo(r, b))).toBeCloseTo(r.cost[b], 6);
  });
});

describe("learned weights steer the route (fixture terrain)", () => {
  const fake = loadSite(read("./__fixtures__/fake-site.json"));
  const fakeCost = buildCostGrid(fake, calm);

  it("a strong soft-sand penalty never adds sand and takes some route off the dunes", () => {
    const sandShy = makeModel({ soft_sand: 3 });
    const grid = buildLearnedCostGrid(fake, sandShy, calm);
    let less = 0;
    for (const poi of fake.pois) {
      const stop: Stop[] = [{ id: poi.id, label: poi.name, lat: poi.lat, lng: poi.lng, dwellMin: 0 }];
      const fastest = planRoute(fake, fakeCost, fake.habitat, stop);
      if (!fastest.ok) continue;
      const shy = planRoute(fake, fakeCost, fake.habitat, stop, { routeGrid: grid });
      const cmp = compareRoutes(fake, sandShy, fastest, shy);
      expect(cmp.learned.sandM, poi.id).toBeLessThanOrEqual(cmp.fastest.sandM + 1);
      expect(shy.walkSec, poi.id).toBeGreaterThanOrEqual(fastest.walkSec - 1e-6);
      if (cmp.learned.sandM < cmp.fastest.sandM - 25) less++;
    }
    expect(less).toBeGreaterThan(0);
  });

  it("a physics-only model (a = 1, no penalties) gives the fastest route's numbers", () => {
    const physics = buildLearnedCostGrid(fake, makeModel({}), calm);
    const poi = fake.pois[0];
    const stop: Stop[] = [{ id: poi.id, label: poi.name, lat: poi.lat, lng: poi.lng, dwellMin: 10 }];
    const fastest = planRoute(fake, fakeCost, fake.habitat, stop);
    const same = planRoute(fake, fakeCost, fake.habitat, stop, { routeGrid: physics });
    expect(same.walkSec).toBeCloseTo(fastest.walkSec, 3);
    expect(same.status).toBe(fastest.status);
  });
});
