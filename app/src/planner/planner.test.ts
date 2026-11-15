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
  abortRoute,
  explainSegment,
  planRoute,
  positionAt,
  safeZone,
  segmentTimeSec,
} from "./index";
import type { Conditions, CostGrid, LatLng, Plan, Site, Stop } from "./index";

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

/**
 * Points every ~1/20 of a cell along a polyline, so tests can check the whole
 * drawn line (not just its corners) without using the planner's own cell walk.
 */
function densify(site: Site, path: LatLng[]): LatLng[] {
  const out: LatLng[] = path.length ? [path[0]] : [];
  const dLat = (site.bounds.north - site.bounds.south) / site.height / 20;
  const dLng = (site.bounds.east - site.bounds.west) / site.width / 20;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(b.lat - a.lat) / dLat, Math.abs(b.lng - a.lng) / dLng)));
    for (let k = 1; k <= n; k++) out.push({ lat: a.lat + ((b.lat - a.lat) * k) / n, lng: a.lng + ((b.lng - a.lng) * k) / n });
  }
  return out;
}

/** Every sampled point of every leg lies on a passable cell. */
function expectLegsPassable(site: Site, cost: CostGrid, plan: Plan) {
  for (const leg of plan.legs) {
    for (const p of densify(site, leg.path)) {
      const cell = cellIndexOf(site, p);
      expect(cell).toBeGreaterThanOrEqual(0);
      expect(cost.secPerM[cell], `no-go cell crossed at ${p.lat}, ${p.lng}`).not.toBe(Infinity);
    }
  }
}
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

describe("path smoothing", () => {
  it("starts and ends each leg at the exact habitat and stop coordinates", () => {
    const site = makeSite(40, 30);
    const cost = buildCostGrid(site, CALM);
    // Off-center points inside their cells.
    const habitat = { lat: cellCenter(site, idx(site, 25, 10)).lat + 0.0003, lng: cellCenter(site, idx(site, 25, 10)).lng - 0.0002 };
    const stop: Stop = { id: "a", label: "A", dwellMin: 5, lat: cellCenter(site, idx(site, 3, 33)).lat - 0.0004, lng: cellCenter(site, idx(site, 3, 33)).lng + 0.0001 };
    const plan = planRoute(site, cost, habitat, [stop]);
    const [out, back] = plan.legs;
    expect(out.path[0]).toEqual(habitat);
    expect(out.path[out.path.length - 1]).toEqual({ lat: stop.lat, lng: stop.lng });
    expect(back.path[0]).toEqual({ lat: stop.lat, lng: stop.lng });
    expect(back.path[back.path.length - 1]).toEqual(habitat);
    // Open flat ground: the smoothed leg is a single straight line.
    expect(out.path).toHaveLength(2);
  });

  it("a stop in the habitat's own cell gives a two-point leg", () => {
    const site = makeSite(10, 10);
    const cost = buildCostGrid(site, CALM);
    const habitat = cellCenter(site, idx(site, 5, 5));
    const stop: Stop = { id: "a", label: "A", dwellMin: 0, lat: habitat.lat + 0.0002, lng: habitat.lng };
    const plan = planRoute(site, cost, habitat, [stop]);
    expect(plan.legs[0].path).toEqual([habitat, { lat: stop.lat, lng: stop.lng }]);
  });

  it("smoothed paths never cross a no-go cell", () => {
    // Wall with a gap, a diagonal cliff and a boulder blob, so the line has to bend.
    const site = makeSite(60, 50, (r, c) =>
      (c === 20 && r !== 4) || (r + c === 70 && r > 15) || Math.hypot(r - 30, c - 45) < 5 ? 60 : 0,
    );
    const cost = buildCostGrid(site, CALM);
    const habitat = cellCenter(site, idx(site, 40, 5));
    const stops = [stopAt(site, 45, 55, 10), stopAt(site, 10, 50, 10), stopAt(site, 2, 30, 10)];
    const plan = planRoute(site, cost, habitat, stops);
    expect(plan.ok).toBe(true);
    expectLegsPassable(site, cost, plan);
    // The drawn line is never slower than the planned walking time.
    for (const leg of plan.legs) {
      const drawnSec = leg.path.slice(1).reduce((t, p, i) => t + segmentTimeSec(site, cost, leg.path[i], p), 0);
      expect(drawnSec).toBeLessThanOrEqual(leg.walkSec + 1e-3);
    }
    // Smoothing removes most of the grid waypoints.
    const gridCells = plan.legs.reduce((n, leg) => n + leg.distM / CELL_M, 0);
    const drawn = plan.legs.reduce((n, leg) => n + leg.path.length, 0);
    expect(drawn).toBeLessThan(gridCells / 5);
  });

  it("does not squeeze diagonally between two no-go cells", () => {
    // Two no-go cells touching at a corner, on the straight line between start and end.
    const site = makeSite(20, 20, (r, c) => ((r === 9 && c === 9) || (r === 10 && c === 10) ? 60 : 0));
    const cost = buildCostGrid(site, CALM);
    const plan = planRoute(site, cost, cellCenter(site, idx(site, 4, 15)), [stopAt(site, 15, 4)]);
    expectLegsPassable(site, cost, plan);
    // The line from (4,15) to (15,4) passes exactly through the shared corner of (9,10) and (10,9),
    // which are passable — but it must not touch (9,9) or (10,10).
    for (const leg of plan.legs) {
      for (const p of densify(site, leg.path)) {
        expect([idx(site, 9, 9), idx(site, 10, 10)]).not.toContain(cellIndexOf(site, p));
      }
    }
  });
});

const countInside = (zone: Uint8Array) => zone.reduce((n, v) => n + v, 0);

describe("safeZone", () => {
  const site = makeSite(80, 80, (r, c) => (c === 40 && r > 10 ? 60 : 0));
  const cost = buildCostGrid(site, CALM);
  const habitat = cellCenter(site, idx(site, 60, 20));

  it("covers the habitat and last stop, and only passable cells", () => {
    const plan = planRoute(site, cost, habitat, [stopAt(site, 40, 30, 330)]);
    expect(plan.status).not.toBe("NO-GO");
    const zone = safeZone(site, cost, plan);
    expect(zone).toBeInstanceOf(Uint8Array);
    expect(zone.length).toBe(site.width * site.height);
    expect(zone[idx(site, 60, 20)]).toBe(1);
    expect(zone[idx(site, 40, 30)]).toBe(1);
    for (let i = 0; i < zone.length; i++) if (zone[i]) expect(cost.secPerM[i]).not.toBe(Infinity);
    // Some of the map is out of reach: the zone is a real boundary, not the whole grid.
    expect(countInside(zone)).toBeLessThan(zone.length * 0.9);
  });

  it("shrinks when a stop is added", () => {
    const one = planRoute(site, cost, habitat, [stopAt(site, 40, 30, 300)]);
    const two = planRoute(site, cost, habitat, [stopAt(site, 40, 30, 300), stopAt(site, 50, 10, 30)]);
    expect(two.marginSec).toBeGreaterThan(0);
    const a = countInside(safeZone(site, cost, one));
    const b = countInside(safeZone(site, cost, two));
    expect(b).toBeGreaterThan(0);
    expect(b).toBeLessThan(a);
  });

  it("is empty when the margin is negative", () => {
    const plan = planRoute(site, cost, habitat, [stopAt(site, 40, 30, 600)]);
    expect(plan.marginSec).toBeLessThan(0);
    expect(countInside(safeZone(site, cost, plan))).toBe(0);
  });

  it("with no stops is every cell whose round trip fits the usable budget", () => {
    const plan = planRoute(site, cost, habitat, []);
    const zone = safeZone(site, cost, plan);
    const home = dijkstraField(cost, idx(site, 60, 20)).cost;
    for (let i = 0; i < zone.length; i++) expect(zone[i]).toBe(2 * home[i] * WALK_BURN <= plan.marginSec ? 1 : 0);
  });
});

describe("positionAt", () => {
  const site = makeSite(50, 50);
  const cost = buildCostGrid(site, CALM);
  const habitat = { lat: cellCenter(site, idx(site, 25, 10)).lat + 0.0001, lng: cellCenter(site, idx(site, 25, 10)).lng };
  const stops = [stopAt(site, 25, 30, 10), stopAt(site, 5, 30, 20)];
  const plan = planRoute(site, cost, habitat, stops);

  it("is at the habitat at t = 0 and t = totalSec", () => {
    const start = positionAt(plan, 0);
    expect(start).toMatchObject({ lat: habitat.lat, lng: habitat.lng, phase: "walk", legIndex: 0, oxygenUsedSec: 0 });
    const end = positionAt(plan, plan.totalSec);
    expect(end).toMatchObject({ lat: habitat.lat, lng: habitat.lng, phase: "walk", legIndex: 2 });
    expect(end.oxygenUsedSec).toBeCloseTo(plan.oxygenUsedSec, 6);
    // Out-of-range times are clamped.
    expect(positionAt(plan, -100)).toEqual(start);
    expect(positionAt(plan, plan.totalSec + 999)).toEqual(end);
  });

  it("walks along each leg and does science at each stop", () => {
    const leg0 = plan.legs[0];
    const mid = positionAt(plan, leg0.walkSec / 2);
    expect(mid.phase).toBe("walk");
    expect(mid.legIndex).toBe(0);
    expect(mid.lng).toBeCloseTo((habitat.lng + stops[0].lng) / 2, 6); // straight line on flat ground
    expect(mid.oxygenUsedSec).toBeCloseTo((leg0.walkSec / 2) * WALK_BURN, 6);

    const atStop = positionAt(plan, leg0.arriveSec + 5 * 60); // halfway through the 10 min dwell
    expect(atStop).toMatchObject({ lat: stops[0].lat, lng: stops[0].lng, phase: "science", legIndex: 0 });
    expect(atStop.oxygenUsedSec).toBeCloseTo(leg0.walkSec * WALK_BURN + 300 * WORK_BURN, 6);

    const leg1 = plan.legs[1];
    const onLeg1 = positionAt(plan, leg1.arriveSec - leg1.walkSec / 2);
    expect(onLeg1).toMatchObject({ phase: "walk", legIndex: 1 });

    // Oxygen used never goes down.
    let prev = -1;
    for (let t = 0; t <= plan.totalSec; t += 30) {
      const p = positionAt(plan, t);
      expect(p.oxygenUsedSec).toBeGreaterThanOrEqual(prev);
      prev = p.oxygenUsedSec;
    }
  });

  it("an empty plan has no position", () => {
    const p = positionAt(planRoute(site, cost, habitat, []), 10);
    expect(p.legIndex).toBe(-1);
    expect(Number.isNaN(p.lat)).toBe(true);
  });
});

describe("abortRoute", () => {
  // A cliff with one gap, so the way home is not a straight line.
  const site = makeSite(60, 50, (r, c) => (c === 30 && r !== 5 ? 60 : 0));
  site.habitat = { name: "HAB", ...cellCenter(site, idx(site, 40, 10)) };
  const calm = buildCostGrid(site, CALM);
  const storm = buildCostGrid(site, { ...CALM, storm: true });
  const stops = [stopAt(site, 40, 50, 30), stopAt(site, 10, 45, 30), stopAt(site, 20, 15, 30)];
  const plan = planRoute(site, calm, site.habitat, stops);
  const leg2 = plan.legs[1];
  const now = positionAt(plan, leg2.arriveSec - leg2.walkSec / 2); // middle of leg 2

  it("returns a path home from the middle of leg 2", () => {
    expect(now).toMatchObject({ phase: "walk", legIndex: 1 });
    const abort = abortRoute(site, storm, now, now.oxygenUsedSec);
    expect(abort.path[0]).toEqual({ lat: now.lat, lng: now.lng });
    expect(abort.path[abort.path.length - 1]).toEqual({ lat: site.habitat.lat, lng: site.habitat.lng });
    // Storm walking time = calm time / STORM_SPEED_FACTOR on every cell.
    const calmHome = dijkstraField(calm, cellIndexOf(site, site.habitat)).cost[cellIndexOf(site, now)];
    expect(abort.sec).toBeCloseTo(calmHome / 0.55, 3);
    expect(abort.marginSec).toBeCloseTo(8 * 3600 - (45 + 30) * 60 - now.oxygenUsedSec - abort.sec * WALK_BURN, 3);
    expect(abort.status).toBe("CAUTION"); // storm active, enough oxygen
    expect(abort.reasons.join(" ")).toMatch(/storm/i);
    expectLegsPassable(site, storm, { legs: [{ path: abort.path }] } as Plan);
    // The abort leg goes back through the gap in the cliff.
    expect(densify(site, abort.path).some((p) => cellIndexOf(site, p) === idx(site, 5, 30))).toBe(true);
  });

  it("is NO-GO when the oxygen left is not enough to get home", () => {
    const abort = abortRoute(site, storm, now, 7 * 3600);
    expect(abort.path.length).toBeGreaterThan(1); // still shows the way home
    expect(abort.marginSec).toBeLessThan(0);
    expect(abort.status).toBe("NO-GO");
    expect(abort.reasons.join(" ")).toMatch(/not enough oxygen/i);
  });

  it("is NO-GO with no path when home cannot be reached", () => {
    const walled = makeSite(20, 20, (r, c) => (Math.max(Math.abs(r - 10), Math.abs(c - 10)) === 3 ? 60 : 0));
    walled.habitat = { name: "HAB", ...cellCenter(walled, idx(walled, 10, 10)) };
    const abort = abortRoute(walled, buildCostGrid(walled, { ...CALM, storm: true }), cellCenter(walled, idx(walled, 1, 1)), 0);
    expect(abort).toMatchObject({ path: [], sec: Infinity, status: "NO-GO" });
  });
});

describe("explainSegment", () => {
  it("reports a nearly straight leg on flat firm ground", () => {
    const site = makeSite(40, 30);
    const cost = buildCostGrid(site, CALM);
    const plan = planRoute(site, cost, cellCenter(site, idx(site, 15, 5)), [stopAt(site, 15, 35)]);
    const e = explainSegment(site, plan, 0);
    expect(e).toMatchObject({ maxSlopeDeg: 0, sandFraction: 0, rockMax: 0 });
    expect(e.detourNote).toMatch(/nearly straight/i);
  });

  it("explains a detour around a cliff", () => {
    const site = makeSite(40, 30, (r, c) => (c === 20 && r !== 2 ? 60 : 0));
    site.layers.rock.fill(0.2);
    const cost = buildCostGrid(site, CALM);
    const plan = planRoute(site, cost, cellCenter(site, idx(site, 25, 10)), [stopAt(site, 25, 30)]);
    const e = explainSegment(site, plan, 0);
    expect(e.maxSlopeDeg).toBe(0); // the route never touches the cliff
    expect(e.rockMax).toBeCloseTo(0.2, 6);
    expect(e.detourNote).toMatch(/detour/i);
    expect(e.detourNote).toMatch(/steeper than 25°/);
  });

  it("explains a detour around soft sand and counts sand on the route", () => {
    // Sand blob on the straight line, firm ground around it.
    const site = makeSite(60, 40);
    for (let r = 0; r < 40; r++)
      for (let c = 0; c < 60; c++) if (Math.hypot(r - 20, c - 30) < 10) site.layers.thermalInertia[idx(site, r, c)] = 100;
    const cost = buildCostGrid(site, CALM);
    const plan = planRoute(site, cost, cellCenter(site, idx(site, 20, 10)), [stopAt(site, 20, 50)]);
    const e = explainSegment(site, plan, 0);
    expect(e.detourNote).toMatch(/soft sand/i);
    expect(e.sandFraction).toBeLessThan(0.1);
    // The drawn line must not cut back across the sand the route went around.
    const drawnSec = plan.legs[0].path.slice(1).reduce((t, p, i) => t + segmentTimeSec(site, cost, plan.legs[0].path[i], p), 0);
    expect(drawnSec).toBeLessThanOrEqual(plan.legs[0].walkSec + 1e-3);

    // Stop in the middle of the sand: the last part of the leg is sand.
    const intoSand = planRoute(site, cost, cellCenter(site, idx(site, 20, 10)), [stopAt(site, 20, 30)]);
    expect(explainSegment(site, intoSand, 0).sandFraction).toBeGreaterThan(0.1);
  });

  it("handles unreachable legs and bad indexes", () => {
    const site = makeSite(20, 20, (r, c) => (Math.max(Math.abs(r - 10), Math.abs(c - 10)) === 2 ? 60 : 0));
    const plan = planRoute(site, buildCostGrid(site, CALM), cellCenter(site, idx(site, 1, 1)), [stopAt(site, 10, 10)]);
    expect(explainSegment(site, plan, 0).detourNote).toMatch(/no safe path/i);
    expect(() => explainSegment(site, plan, 5)).toThrow(RangeError);
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
    expect(onCliff.reasons).toContain("Stop 1 is on a slope over 25 degrees.");
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

  it("low margin gives CAUTION; an active storm or SPE aborts the EVA (NO-GO)", () => {
    const calm = buildCostGrid(site, CALM);
    // 6.5 h of science leaves well under 25% of the budget as margin, but more than zero.
    const tight = planRoute(site, calm, habitat, [stopAt(site, 2, 2, 390)]);
    expect(tight.marginSec).toBeGreaterThan(0);
    expect(tight.marginSec).toBeLessThan(0.25 * 28800);
    expect(tight.status).toBe("CAUTION");

    const easy = [stopAt(site, 2, 2, 5)];
    const storm = planRoute(site, buildCostGrid(site, { ...CALM, storm: true }), habitat, easy);
    expect(storm.status).toBe("NO-GO");
    expect(storm.reasons[0]).toBe("EVA aborted: active dust storm");
    // Storm: slower walking and 30 min more reserve.
    const normal = planRoute(site, calm, habitat, easy);
    expect(normal.status).toBe("GO");
    expect(storm.walkSec).toBeCloseTo(normal.walkSec / 0.55, 3);
    expect(storm.marginSec).toBeCloseTo(normal.marginSec - 30 * 60 - (storm.walkSec - normal.walkSec) * WALK_BURN, 3);

    const spe = planRoute(site, buildCostGrid(site, { ...CALM, spe: true }), habitat, easy);
    expect(spe.status).toBe("NO-GO");
    expect(spe.reasons[0]).toBe("EVA aborted: active solar particle event");
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
  const jsonPath = fileURLToPath(new URL("./__fixtures__/fake-site.json", import.meta.url));
  const site = loadSite(JSON.parse(readFileSync(jsonPath, "utf8")));
  const cost = buildCostGrid(site, CALM);
  const habitatCell = cellIndexOf(site, site.habitat);

  // Centerline of the fake delta scarp, from pipeline/fixtures/make_fake_site.py.
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

    const out = densify(site, plan.legs[0].path);
    // Every point along the drawn (smoothed) path is on walkable ground.
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
    console.log(`habitat → carb-1 drawn with ${plan.legs[0].path.length} points for ${Math.round(plan.legs[0].distM / 24.6)} grid steps`);
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

  it("safeZone on the 320 × 240 grid runs in under 100 ms", () => {
    // carb-1 → clay-1 fits (≈75 min margin); all three science POIs do not.
    const poi = (id: string, dwellMin = 20): Stop => {
      const p = site.pois.find((q) => q.id === id)!;
      return { id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin };
    };
    const stops = [poi("carb-1"), poi("clay-1")];
    const warmUp = buildCostGrid(site, CALM);
    safeZone(site, warmUp, planRoute(site, warmUp, site.habitat, stops)); // JIT warm-up

    // Typical use: conditions unchanged (home field cached), the last stop changes → one new field.
    const grid = buildCostGrid(site, CALM);
    safeZone(site, grid, planRoute(site, grid, site.habitat, [])); // caches the home field
    const typical: number[] = [];
    const cold: number[] = [];
    const cached: number[] = [];
    let inside = 0;
    for (let i = 0; i < 7; i++) {
      // Move the last stop a little each run so its field is never cached.
      const lastStop = { ...poi("clay-1"), lat: poi("clay-1").lat - i * 0.0005 };
      const p2 = planRoute(site, grid, site.habitat, [poi("carb-1"), lastStop]);
      expect(p2.marginSec).toBeGreaterThan(0); // otherwise safeZone returns early and the timing means nothing
      let t0 = performance.now();
      inside = countInside(safeZone(site, grid, p2));
      typical.push(performance.now() - t0);
      t0 = performance.now();
      safeZone(site, grid, p2);
      cached.push(performance.now() - t0);

      // Cold: brand-new grid (e.g. a storm just started) → both fields computed.
      const fresh = buildCostGrid(site, CALM);
      const p3 = planRoute(site, fresh, site.habitat, stops);
      t0 = performance.now();
      safeZone(site, fresh, p3);
      cold.push(performance.now() - t0);
    }
    for (const a of [typical, cold, cached]) a.sort((x, y) => x - y);
    console.log(
      `safeZone (${inside} cells inside): new last stop median ${typical[3].toFixed(1)} ms; ` +
        `cold (both fields) median ${cold[3].toFixed(1)} ms, best ${cold[0].toFixed(1)} ms; cached ${cached[3].toFixed(1)} ms`,
    );
    expect(inside).toBeGreaterThan(0);
    expect(typical[3]).toBeLessThan(100);
    // Best-of-7 for the cold case: measures the work, not other apps competing for the CPU.
    expect(cold[0]).toBeLessThan(100);
  });

  it("abortRoute on the 320 × 240 grid runs in under 100 ms", () => {
    const carb = site.pois.find((p) => p.id === "carb-1")!;
    const plan = planRoute(site, cost, site.habitat, [
      { id: carb.id, label: carb.name, lat: carb.lat, lng: carb.lng, dwellMin: 30 },
    ]);
    abortRoute(site, buildCostGrid(site, { ...CALM, storm: true }), site.habitat, 0); // JIT warm-up
    const first: number[] = [];
    const again: number[] = [];
    let status = "";
    for (let i = 0; i < 7; i++) {
      const stormGrid = buildCostGrid(site, { ...CALM, storm: true }); // the storm just started
      const at = positionAt(plan, plan.legs[0].walkSec * (0.2 + 0.1 * i));
      let t0 = performance.now();
      const abort = abortRoute(site, stormGrid, at, at.oxygenUsedSec); // builds the storm field
      first.push(performance.now() - t0);
      const later = positionAt(plan, plan.legs[0].arriveSec);
      t0 = performance.now();
      abortRoute(site, stormGrid, later, later.oxygenUsedSec); // storm field cached
      again.push(performance.now() - t0);
      expect(abort.path.length).toBeGreaterThan(1);
      status = abort.status;
    }
    first.sort((a, b) => a - b);
    again.sort((a, b) => a - b);
    console.log(
      `abortRoute (${status}): first call after storm starts median ${first[3].toFixed(1)} ms (best ${first[0].toFixed(1)}); ` +
        `cached median ${again[3].toFixed(1)} ms`,
    );
    expect(first[3]).toBeLessThan(100);
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
