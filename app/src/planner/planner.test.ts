import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BASE_SPEED_KMH,
  MAX_SLOPE_DEG,
  ROCK_NO_GO,
  WALK_BURN,
  WORK_BURN,
  aStar,
  buildCostGrid,
  cellCenter,
  cellIndexOf,
  dijkstraField,
  loadSite,
  pathTo,
  planRoute,
} from "./index";
import type { Conditions, Site, Stop } from "./index";

const CALM: Conditions = { storm: false, spe: false, startLmst: 10 };
const CELL_M = 25;
const FLAT_SEC_PER_M = 3.6 / BASE_SPEED_KMH; // 1.2 s per meter at 3 km/h

/** A small synthetic site: flat firm ground, except where `slopeAt` says otherwise. */
function makeSite(width: number, height: number, slopeAt: (row: number, col: number) => number = () => 0): Site {
  const count = width * height;
  const slope: number[] = [];
  for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) slope.push(slopeAt(r, c));
  return loadSite({
    name: "test site",
    bounds: { south: 0, north: height * 0.001, west: 0, east: width * 0.001 },
    width,
    height,
    cellSizeM: { x: CELL_M, y: CELL_M },
    layers: {
      elevation: new Array(count).fill(0),
      slope,
      rock: new Array(count).fill(0),
      thermalInertia: new Array(count).fill(300),
      science: new Array(count).fill(0),
    },
    habitat: { name: "HAB", lat: 0, lng: 0 },
    pois: [],
    sources: {},
  });
}

const idx = (site: Site, row: number, col: number) => row * site.width + col;
const stopAt = (site: Site, row: number, col: number, dwellMin = 0): Stop => ({
  id: `s-${row}-${col}`,
  label: `Stop ${row},${col}`,
  dwellMin,
  ...cellCenter(site, idx(site, row, col)),
});

describe("loadSite and buildCostGrid", () => {
  it("turns layers into Float32Arrays and nulls into NaN", () => {
    const site = makeSite(4, 3);
    expect(site.layers.slope).toBeInstanceOf(Float32Array);
    expect(site.layers.slope.length).toBe(12);
    expect(site.cellSizeM).toEqual({ x: 25, y: 25 });

    const layers: Record<string, (number | null)[]> = Object.fromEntries(
      Object.entries(site.layers).map(([name, values]) => [name, Array.from(values)]),
    );
    layers.slope[0] = null; // a missing value in site.json
    const withHole = loadSite({ ...site, layers });
    expect(Number.isNaN(withHole.layers.slope[0])).toBe(true);
    expect(buildCostGrid(withHole, CALM).secPerM[0]).toBe(Infinity); // unknown terrain = no-go
  });

  it("rejects a layer with the wrong length", () => {
    const site = makeSite(4, 3);
    const layers = Object.fromEntries(Object.entries(site.layers).map(([k, v]) => [k, Array.from(v)]));
    layers.rock = [0, 0];
    expect(() => loadSite({ ...site, layers })).toThrow(/rock/);
  });

  it("maps lat/lng to cells with row 0 = north and column 0 = west", () => {
    const site = makeSite(10, 8);
    expect(cellIndexOf(site, { lat: site.bounds.north - 1e-6, lng: site.bounds.west + 1e-6 })).toBe(0);
    expect(cellIndexOf(site, { lat: site.bounds.south + 1e-6, lng: site.bounds.east - 1e-6 })).toBe(79);
    expect(cellIndexOf(site, { lat: 99, lng: 0 })).toBe(-1);
    expect(cellIndexOf(site, cellCenter(site, 37))).toBe(37);
  });

  it("applies the Contract 2 speed formula", () => {
    const site = makeSite(4, 1, (_r, c) => [0, 10, MAX_SLOPE_DEG + 1, 0][c]);
    site.layers.thermalInertia[3] = 100; // soft sand
    const calm = buildCostGrid(site, CALM);
    expect(calm.secPerM[0]).toBeCloseTo(FLAT_SEC_PER_M, 5);
    expect(calm.secPerM[1]).toBeCloseTo(FLAT_SEC_PER_M / Math.exp(-3 * Math.tan((10 * Math.PI) / 180)), 4);
    expect(calm.secPerM[2]).toBe(Infinity);
    expect(calm.secPerM[3]).toBeCloseTo(FLAT_SEC_PER_M / 0.55, 5);
    expect(calm.minSecPerM).toBeCloseTo(FLAT_SEC_PER_M, 5);

    const storm = buildCostGrid(site, { ...CALM, storm: true });
    expect(storm.secPerM[0]).toBeCloseTo(FLAT_SEC_PER_M / 0.55, 5);

    site.layers.rock[0] = 0.5;
    site.layers.rock[1] = ROCK_NO_GO + 0.01;
    const rocky = buildCostGrid(site, CALM);
    expect(rocky.secPerM[0]).toBeCloseTo(FLAT_SEC_PER_M / (1 - 0.6 * 0.5), 5);
    expect(rocky.secPerM[1]).toBe(Infinity);
  });
});

describe("flat ground timing", () => {
  const site = makeSite(50, 50);
  const cost = buildCostGrid(site, CALM);

  it("walks 500 m straight in 600 s at 3 km/h", () => {
    const start = idx(site, 25, 10);
    const goal = idx(site, 25, 30);
    const result = aStar(cost, start, goal);
    expect(result.cost[goal]).toBeCloseTo(20 * CELL_M * FLAT_SEC_PER_M, 3); // 600 s
    expect(pathTo(result, goal)).toHaveLength(21);
  });

  it("uses diagonal steps at the right length", () => {
    const start = idx(site, 10, 10);
    const goal = idx(site, 20, 20);
    const result = aStar(cost, start, goal);
    expect(result.cost[goal]).toBeCloseTo(10 * Math.hypot(CELL_M, CELL_M) * FLAT_SEC_PER_M, 3);
  });

  it("A* and full-field Dijkstra agree", () => {
    const start = idx(site, 3, 4);
    const field = dijkstraField(cost, start);
    for (const goal of [idx(site, 40, 45), idx(site, 0, 49), idx(site, 49, 0)]) {
      expect(aStar(cost, start, goal).cost[goal]).toBeCloseTo(field.cost[goal], 6);
    }
    expect(field.cost[start]).toBe(0);
    expect(field.cameFrom[start]).toBe(-1);
  });

  it("planRoute adds up walk, science and oxygen for an out-and-back trip", () => {
    const habitat = cellCenter(site, idx(site, 25, 10));
    const plan = planRoute(site, cost, habitat, [stopAt(site, 25, 30, 10)]);
    expect(plan.ok).toBe(true);
    expect(plan.legs).toHaveLength(2);
    expect(plan.legs[0].walkSec).toBeCloseTo(600, 3);
    expect(plan.legs[0].distM).toBeCloseTo(500, 6);
    expect(plan.legs[0].arriveSec).toBeCloseTo(600, 3);
    expect(plan.legs[1].arriveSec).toBeCloseTo(600 + 600 + 600, 3); // walk + 10 min science + walk
    expect(plan.walkSec).toBeCloseTo(1200, 3);
    expect(plan.workSec).toBe(600);
    expect(plan.totalSec).toBeCloseTo(1800, 3);
    expect(plan.distM).toBeCloseTo(1000, 6);
    expect(plan.oxygenUsedSec).toBeCloseTo(1200 * WALK_BURN + 600 * WORK_BURN, 3);
    expect(plan.marginSec).toBeCloseTo(8 * 3600 - 45 * 60 - plan.oxygenUsedSec, 3);
    expect(plan.oxygenAtReturnPct).toBeCloseTo((1 - plan.oxygenUsedSec / 28800) * 100, 6);
    expect(plan.status).toBe("GO");
    expect(plan.reasons).toHaveLength(1);
  });

  it("an empty plan is GO with nothing used", () => {
    const plan = planRoute(site, cost, cellCenter(site, 0), []);
    expect(plan).toMatchObject({ ok: true, legs: [], totalSec: 0, oxygenUsedSec: 0, status: "GO" });
  });
});

describe("no-go walls", () => {
  // A cliff down column 20 with a single gap at row 2.
  const site = makeSite(40, 30, (r, c) => (c === 20 && r !== 2 ? 60 : 0));
  const cost = buildCostGrid(site, CALM);
  const start = idx(site, 25, 10);
  const goal = idx(site, 25, 30);

  it("forces a detour through the gap", () => {
    const result = aStar(cost, start, goal);
    const path = pathTo(result, goal);
    const straight = 20 * CELL_M * FLAT_SEC_PER_M;
    expect(result.cost[goal]).toBeGreaterThan(straight * 2);
    expect(path).toContain(idx(site, 2, 20));
    for (const cell of path) expect(cost.secPerM[cell]).not.toBe(Infinity);
    expect(result.cost[goal]).toBeCloseTo(dijkstraField(cost, start).cost[goal], 6);
  });

  it("does not cut corners between two no-go cells", () => {
    // No-go cells on the diagonal: the only way across would be to squeeze diagonally between them.
    const diagSite = makeSite(12, 12, (r, c) => (r === c ? 60 : 0));
    const diagCost = buildCostGrid(diagSite, CALM);
    const from = idx(diagSite, 8, 2);
    const to = idx(diagSite, 2, 8);
    expect(aStar(diagCost, from, to).cost[to]).toBe(Infinity);
    expect(dijkstraField(diagCost, from).cost[to]).toBe(Infinity);
  });
});

describe("impossible plans return NO-GO", () => {
  it("when a stop is walled in", () => {
    // A closed ring of cliff around cell (10, 10).
    const site = makeSite(20, 20, (r, c) => (Math.max(Math.abs(r - 10), Math.abs(c - 10)) === 2 ? 60 : 0));
    const cost = buildCostGrid(site, CALM);
    const plan = planRoute(site, cost, cellCenter(site, idx(site, 1, 1)), [stopAt(site, 10, 10, 15)]);
    expect(plan.ok).toBe(false);
    expect(plan.status).toBe("NO-GO");
    expect(plan.reasons.join(" ")).toMatch(/no safe path/i);
    expect(plan.legs[0].path).toEqual([]);
  });

  it("when a stop sits on no-go terrain or outside the site", () => {
    const site = makeSite(20, 20, (r, c) => (r === 10 && c === 10 ? 60 : 0));
    const cost = buildCostGrid(site, CALM);
    const habitat = cellCenter(site, idx(site, 1, 1));
    const onCliff = planRoute(site, cost, habitat, [stopAt(site, 10, 10)]);
    expect(onCliff.status).toBe("NO-GO");
    expect(onCliff.reasons.join(" ")).toMatch(/no-go terrain/i);
    const outside = planRoute(site, cost, habitat, [{ id: "x", label: "Far away", dwellMin: 0, lat: 50, lng: 50 }]);
    expect(outside.status).toBe("NO-GO");
    expect(outside.reasons.join(" ")).toMatch(/outside/i);
  });

  it("when the oxygen margin is negative", () => {
    const site = makeSite(20, 20);
    const cost = buildCostGrid(site, CALM);
    const plan = planRoute(site, cost, cellCenter(site, idx(site, 1, 1)), [stopAt(site, 10, 10, 600)]);
    expect(plan.ok).toBe(true); // reachable, but 10 h of science does not fit in 8 h of oxygen
    expect(plan.marginSec).toBeLessThan(0);
    expect(plan.status).toBe("NO-GO");
    expect(plan.reasons.join(" ")).toMatch(/margin is negative/i);
  });
});

describe("CAUTION rules (Contract 3)", () => {
  const site = makeSite(20, 20);
  const habitat = cellCenter(site, idx(site, 1, 1));

  it("low margin, storm and SPE each give CAUTION with a reason", () => {
    const calm = buildCostGrid(site, CALM);
    // 6.5 h of science leaves well under 25% of the budget as margin, but more than zero.
    const tight = planRoute(site, calm, habitat, [stopAt(site, 2, 2, 390)]);
    expect(tight.marginSec).toBeGreaterThan(0);
    expect(tight.marginSec).toBeLessThan(0.25 * 28800);
    expect(tight.status).toBe("CAUTION");

    const easy = [stopAt(site, 2, 2, 5)];
    const storm = planRoute(site, buildCostGrid(site, { ...CALM, storm: true }), habitat, easy);
    expect(storm.status).toBe("CAUTION");
    expect(storm.reasons.join(" ")).toMatch(/storm/i);
    // Storm: slower walking and 30 min more reserve.
    const normal = planRoute(site, calm, habitat, easy);
    expect(normal.status).toBe("GO");
    expect(storm.walkSec).toBeCloseTo(normal.walkSec / 0.55, 3);
    expect(storm.marginSec).toBeCloseTo(normal.marginSec - 30 * 60 - (storm.walkSec - normal.walkSec) * WALK_BURN, 3);

    const spe = planRoute(site, buildCostGrid(site, { ...CALM, spe: true }), habitat, easy);
    expect(spe.status).toBe("CAUTION");
    expect(spe.reasons.join(" ")).toMatch(/solar particle/i);
  });

  it("low margin is measured against the usable budget (8 h minus reserve)", () => {
    const calm = buildCostGrid(site, CALM);
    const usable = 8 * 3600 - 45 * 60; // 26,100 s; CAUTION below 6,525 s
    // Stop on the habitat cell: no walking, only science at WORK_BURN.
    const above = planRoute(site, calm, habitat, [stopAt(site, 1, 1, 357)]);
    expect(above.marginSec).toBeCloseTo(usable - 357 * 60 * WORK_BURN, 3); // 6,822 s
    expect(above.marginSec).toBeLessThan(0.25 * 28800); // would be CAUTION against the full 8 h
    expect(above.status).toBe("GO");

    const below = planRoute(site, calm, habitat, [stopAt(site, 1, 1, 365)]); // 6,390 s
    expect(below.marginSec).toBeLessThan(0.25 * usable);
    expect(below.status).toBe("CAUTION");
    expect(below.reasons.join(" ")).toMatch(/usable budget/i);
  });
});

describe("fake Jezero site.json", () => {
  const jsonPath = fileURLToPath(new URL("../../public/data/site.json", import.meta.url));
  const site = loadSite(JSON.parse(readFileSync(jsonPath, "utf8")));
  const cost = buildCostGrid(site, CALM);
  const habitatCell = cellIndexOf(site, site.habitat);

  // Centerline of the fake delta scarp, from pipeline/make_fake_site.py.
  const scarpLng = (lat: number) =>
    77.415 + 0.012 * Math.sin(((lat - site.bounds.south) / (site.bounds.north - site.bounds.south)) * Math.PI * 1.5);
  // The cliff has gaps (no cell over 25°) at 18.429–18.441 N and 18.466–18.478 N.
  const inRamp = (lat: number) => Math.abs(lat - 18.435) <= 0.007 || Math.abs(lat - 18.472) <= 0.007;

  it("loads as a 320 × 240 grid with the habitat on walkable ground", () => {
    expect([site.width, site.height]).toEqual([320, 240]);
    expect(site.layers.elevation.length).toBe(76800);
    expect(cost.secPerM[habitatCell]).not.toBe(Infinity);
  });

  it("routes habitat → carb-1 through one of the two cliff ramps", () => {
    const carb = site.pois.find((p) => p.id === "carb-1")!;
    const stop: Stop = { id: carb.id, label: carb.name, lat: carb.lat, lng: carb.lng, dwellMin: 30 };
    const plan = planRoute(site, cost, site.habitat, [stop]);
    expect(plan.ok).toBe(true);

    const out = plan.legs[0].path;
    // Every cell on the path is walkable.
    for (const p of out) {
      const cell = cellIndexOf(site, p);
      expect(site.layers.slope[cell]).toBeLessThanOrEqual(MAX_SLOPE_DEG);
      expect(site.layers.rock[cell]).toBeLessThanOrEqual(ROCK_NO_GO);
    }
    // Find every place the path crosses the scarp line; each must be inside a ramp.
    const crossings: number[] = [];
    for (let i = 1; i < out.length; i++) {
      const before = out[i - 1].lng - scarpLng(out[i - 1].lat);
      const after = out[i].lng - scarpLng(out[i].lat);
      if (before > 0 !== after > 0) crossings.push((out[i - 1].lat + out[i].lat) / 2);
    }
    expect(crossings.length).toBeGreaterThanOrEqual(1);
    for (const lat of crossings) expect(inRamp(lat), `crossed the scarp at ${lat.toFixed(4)} N`).toBe(true);

    console.log(
      `habitat → carb-1 → habitat: ${(plan.distM / 1000).toFixed(2)} km, walk ${(plan.walkSec / 60).toFixed(0)} min, ` +
        `margin ${(plan.marginSec / 60).toFixed(0)} min, status ${plan.status}; ` +
        `scarp crossed at ${crossings.map((l) => l.toFixed(4) + " N").join(", ")}`,
    );
  });

  it("A* matches the full-field Dijkstra time to every POI", () => {
    const field = dijkstraField(cost, habitatCell);
    for (const poi of site.pois) {
      const cell = cellIndexOf(site, poi);
      const a = aStar(cost, habitatCell, cell).cost[cell];
      if (field.cost[cell] === Infinity) expect(a).toBe(Infinity);
      else expect(a).toBeCloseTo(field.cost[cell], 6);
    }
  });

  it("full-field Dijkstra over 76,800 cells runs in under 100 ms", () => {
    dijkstraField(cost, habitatCell); // warm-up so the JIT has compiled the loop
    const times: number[] = [];
    for (let i = 0; i < 7; i++) {
      const t0 = performance.now();
      dijkstraField(cost, habitatCell);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const median = times[3];

    const carbCell = cellIndexOf(site, site.pois[0]);
    const t0 = performance.now();
    for (let i = 0; i < 7; i++) aStar(cost, habitatCell, carbCell);
    const aStarMs = (performance.now() - t0) / 7;

    console.log(
      `full-field Dijkstra: median ${median.toFixed(1)} ms (min ${times[0].toFixed(1)}, max ${times[6].toFixed(1)}); ` +
        `A* habitat → carb-1: ${aStarMs.toFixed(1)} ms`,
    );
    expect(median).toBeLessThan(100);
  });
});
