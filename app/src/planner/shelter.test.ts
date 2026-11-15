// Radiation shelter routing, on a small made-up site (to check the arithmetic) and
// on the real site.json with its skyView layer (pipeline/build_shielding.py).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  WALK_BURN,
  buildCostGrid,
  cellCenter,
  cellIndexOf,
  dijkstraField,
  distanceM,
  doseRateMsvPerHr,
  loadSite,
  oxygenBudget,
  pathTo,
  planRoute,
  positionAt,
  segmentIsClear,
} from "./index";
import type { Conditions, LatLng, Site, Stop } from "./index";
import { DEFAULT_WAIT_MIN, MIN_DOSE_REDUCTION_PCT, SHELTER_MODEL_IS_SIMPLIFIED, SHELTER_WAIT_BURN, readSkyView, shelterRoute } from "./shelter";
import type { ShelterRoute } from "./shelter";

const SPE: Conditions = { storm: false, spe: true, startLmst: 13 };
const RATE_PER_SEC = doseRateMsvPerHr(true) / 3600;

const finiteOrInfinity = (r: ShelterRoute) => {
  for (const v of [r.sec, r.skyView, r.doseToShelterMsv, r.doseReductionPct, r.target.lat, r.target.lng]) {
    expect(Number.isFinite(v)).toBe(true);
  }
  expect(Number.isNaN(r.doseIfHomeMsv)).toBe(false);
  for (const p of r.path) expect(Number.isFinite(p.lat) && Number.isFinite(p.lng)).toBe(true);
  expect(r.reasons.length).toBeGreaterThan(0);
  for (const line of r.reasons) expect(line).not.toMatch(/NaN|undefined|Infinity/);
};

// ---- A made-up site, to check the arithmetic --------------------------------

/** Flat firm ground, 25 m cells, one row of 200 cells: habitat at the west end. */
function corridor(): { site: Site; sky: Float32Array } {
  const width = 200;
  const height = 3;
  const count = width * height;
  const site = loadSite({
    name: "corridor",
    bounds: { south: 0, north: height * 0.001, west: 0, east: width * 0.001 },
    width,
    height,
    cellSizeM: { x: 25, y: 25 },
    layers: {
      elevation: new Array(count).fill(0),
      slope: new Array(count).fill(0),
      rock: new Array(count).fill(0),
      thermalInertia: new Array(count).fill(300),
      science: new Array(count).fill(0),
    },
    habitat: { name: "HAB", lat: 0, lng: 0 },
    pois: [],
    sources: {},
  });
  site.habitat = { name: "HAB", ...cellCenter(site, width + 0) }; // middle row, column 0
  return { site, sky: new Float32Array(count).fill(1) };
}

describe("shelterRoute on a made-up corridor", () => {
  const { site, sky } = corridor();
  const cost = buildCostGrid(site, SPE);
  const at = (col: number) => site.width + col; // middle row
  const from = cellCenter(site, at(150)); // 150 cells = 3,750 m = 75 min from home at 3 km/h
  const shelterCell = at(154); // 100 m further from home
  sky[shelterCell] = 0.5;

  it("is marked as a simplified model, with a 60 minute default wait", () => {
    expect(SHELTER_MODEL_IS_SIMPLIFIED).toBe(true);
    expect(DEFAULT_WAIT_MIN).toBe(60);
    expect(MIN_DOSE_REDUCTION_PCT).toBe(5);
  });

  it("picks the low-sky cell and adds the dose up as rate x sky view x time", () => {
    const r = shelterRoute(site, cost, from, 0, { skyView: sky });
    finiteOrInfinity(r);
    expect(cellIndexOf(site, r.target)).toBe(shelterCell);
    expect(r.betterThanHome).toBe(true);
    expect(r.skyView).toBe(0.5);
    // 4 steps of 25 m at 3 km/h = 120 s. The first 3 steps are under open sky; the last
    // joins a 1.0 cell and the 0.5 cell, so it counts as 0.75.
    expect(r.sec).toBeCloseTo(120, 3); // the cost grid is 32-bit: times agree to about 1e-5 s
    const walk = RATE_PER_SEC * (90 * 1 + 30 * 0.75);
    const wait = RATE_PER_SEC * 0.5 * (3600 - 120); // the rest of the 60 min event
    expect(r.doseToShelterMsv).toBeCloseTo(walk + wait, 7);
    // Home is 75 min away, longer than the 60 min event, so walking home is exposed
    // for the whole 60 min (under open sky).
    expect(r.doseIfHomeMsv).toBeCloseTo(RATE_PER_SEC * 3600, 7);
    expect(r.doseReductionPct).toBeCloseTo((1 - r.doseToShelterMsv / r.doseIfHomeMsv) * 100, 9);
    expect(r.doseReductionPct).toBeGreaterThan(45);
    expect(r.reasons[0]).toMatch(/^Shelter \d+ m away \(sky view 0\.50\) cuts the SPE dose by 49% compared with walking home \(75 min\)\.$/);
    expect(r.reasons[1]).toMatch(/^2 min walk, then wait 58 min: SPE dose \d\.\d{3} mSv instead of \d\.\d{3} mSv walking home over the same 60 min\.$/);
    expect(r.reasons.join(" ")).toMatch(/illustrative/i);
    expect(r.reasons.join(" ")).toMatch(/simplified/i);
    expect(r.path[0]).toEqual(from);
    expect(r.path[r.path.length - 1]).toEqual(r.target);
  });

  it("goes home when home is close: the wait would cost more than the short walk", () => {
    const near = cellCenter(site, at(4)); // 100 m from home
    const localSky = new Float32Array(sky);
    localSky[at(6)] = 0.5;
    const r = shelterRoute(site, cost, near, 0, { skyView: localSky });
    finiteOrInfinity(r);
    expect(r.betterThanHome).toBe(false);
    expect(r.target).toEqual({ lat: site.habitat.lat, lng: site.habitat.lng });
    expect(r.skyView).toBe(0);
    expect(r.doseReductionPct).toBe(0);
    expect(r.sec).toBeCloseTo(120, 3);
    expect(r.doseToShelterMsv).toBeCloseTo(RATE_PER_SEC * 120, 7); // the walk home, open sky
    expect(r.doseIfHomeMsv).toBe(r.doseToShelterMsv);
    expect(r.reasons[0]).toMatch(/^Walk home \(2 min/);
  });

  it("a shorter event window changes the answer only through the dose", () => {
    const r = shelterRoute(site, cost, from, 0, { skyView: sky, waitMin: 20 });
    expect(r.betterThanHome).toBe(true);
    expect(r.doseToShelterMsv).toBeCloseTo(RATE_PER_SEC * (90 + 30 * 0.75 + 0.5 * (1200 - 120)), 7);
    expect(r.doseIfHomeMsv).toBeCloseTo(RATE_PER_SEC * 1200, 7);
    // A cell further away than the event lasts is never a shelter.
    expect(shelterRoute(site, cost, from, 0, { skyView: sky, waitMin: 1 }).betterThanHome).toBe(false);
    // With no event window there is nothing to gain from a shelter: go home.
    expect(shelterRoute(site, cost, from, 0, { skyView: sky, waitMin: 0 }).betterThanHome).toBe(false);
  });

  it("never offers a shelter the astronaut could not walk home from on the oxygen left", () => {
    const budget = oxygenBudget(false);
    const homeSec = 150 * 25 * 1.2; // 4,500 s
    // Enough to walk home, but not to wait an hour first.
    const used = budget.usableSec - homeSec * WALK_BURN - 600;
    const tight = shelterRoute(site, cost, from, used, { skyView: sky });
    finiteOrInfinity(tight);
    expect(tight.betterThanHome).toBe(false);
    // (Waiting part of the way home is still possible, but under open sky it saves nothing.)
    expect(tight.reasons[0]).toMatch(/^Walk home \(75 min.*no shelter/);
    // Just enough for: walk to the shelter (2 min), wait out the event (58 min), walk home.
    const need = (120 + (homeSec + 120)) * WALK_BURN + (3600 - 120) * SHELTER_WAIT_BURN;
    expect(shelterRoute(site, cost, from, budget.usableSec - need - 1, { skyView: sky }).betterThanHome).toBe(true);
    expect(shelterRoute(site, cost, from, budget.usableSec - need + 60, { skyView: sky }).betterThanHome).toBe(false);
  });

  it("does not recommend a shelter for a cut smaller than 5%", () => {
    const { site: s3, sky: flat } = corridor();
    flat[at(154)] = 0.97; // barely less sky than everywhere else
    const grid = buildCostGrid(s3, SPE);
    const r = shelterRoute(s3, grid, cellCenter(s3, at(150)), 0, { skyView: flat });
    expect(r.betterThanHome).toBe(false);
    expect(r.reasons[0]).toMatch(/no shelter cuts the dose by 5% or more/);
    // The same spot is offered if the caller lowers the bar.
    expect(shelterRoute(s3, grid, cellCenter(s3, at(150)), 0, { skyView: flat, minReductionPct: 1 }).betterThanHome).toBe(true);
    // Open sky everywhere: staying put is never "shelter".
    const open = new Float32Array(flat.length).fill(1);
    expect(shelterRoute(s3, grid, cellCenter(s3, at(150)), 0, { skyView: open, minReductionPct: 0 }).betterThanHome).toBe(false);
  });

  it("never picks a no-go cell, even one with the best sky view", () => {
    const { site: walled, sky: wsky } = corridor();
    walled.layers.slope[at(152)] = 60; // a cliff cell beside the route, with a deep overhang
    wsky[at(152)] = 0.1;
    wsky[at(154)] = 0.5;
    const r = shelterRoute(walled, buildCostGrid(walled, SPE), cellCenter(walled, at(150)), 0, { skyView: wsky });
    expect(cellIndexOf(walled, r.target)).toBe(at(154));
  });

  it("handles a start on no-go ground, outside the site, and a missing layer", () => {
    const { site: s2, sky: sky2 } = corridor();
    s2.layers.slope[at(150)] = 60;
    const blocked = shelterRoute(s2, buildCostGrid(s2, SPE), cellCenter(s2, at(150)), 0, { skyView: sky2 });
    finiteOrInfinity(blocked);
    expect(blocked).toMatchObject({ path: [], betterThanHome: false, doseIfHomeMsv: Infinity });
    const outside = shelterRoute(site, cost, { lat: 50, lng: 50 }, 0, { skyView: sky });
    expect(outside.reasons[0]).toMatch(/outside the mapped site/);
    expect(() => shelterRoute(site, cost, from, 0)).toThrow(/skyView/);
  });
});

// ---- The real site ----------------------------------------------------------

const raw = JSON.parse(readFileSync(fileURLToPath(new URL("../../public/data/site.json", import.meta.url)), "utf8"));
const site = loadSite(raw);
const sky = readSkyView(raw)!;
const calm = buildCostGrid(site, { storm: false, spe: false, startLmst: 13 });
const speCost = buildCostGrid(site, SPE);
const stops: Stop[] = site.pois
  .filter((p) => p.kind === "science")
  .slice(0, 3)
  .map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin: 30 }));
const plan = planRoute(site, calm, site.habitat, stops);
const homeCell = cellIndexOf(site, site.habitat);
const passable = (cell: number) => speCost.secPerM[cell] !== Infinity;

describe("the real skyView layer", () => {
  it("is in site.json, one value per cell, between 0 and 1, wherever elevation exists", () => {
    expect(sky).not.toBeNull();
    expect(sky.length).toBe(site.width * site.height);
    expect(String(raw.sources.skyView)).toMatch(/10\.5066\/P9REJ9JN/);
    for (let i = 0; i < sky.length; i++) {
      if (Number.isNaN(site.layers.elevation[i])) continue;
      expect(sky[i]).toBeGreaterThanOrEqual(0);
      expect(sky[i]).toBeLessThanOrEqual(1);
    }
  });

  it("the delta scarp foot sees less sky than the open crater floor", () => {
    const toe = site.pois.find((p) => p.id === "delta-toe")!;
    const hab = sky[homeCell];
    // The least open passable cell within 300 m of the delta front toe: the foot of the scarp.
    let foot = Infinity;
    for (let i = 0; i < sky.length; i++) {
      if (!passable(i) || Number.isNaN(sky[i])) continue;
      if (distanceM(cellCenter(site, i), toe) <= 300 && sky[i] < foot) foot = sky[i];
    }
    console.log(
      `sky view: HAB-1 (open crater floor) ${hab.toFixed(3)}; delta front toe stop ${sky[cellIndexOf(site, toe)].toFixed(3)}; ` +
        `lowest passable cell within 300 m of the toe ${foot.toFixed(3)}`,
    );
    expect(hab).toBeGreaterThan(0.95);
    expect(foot).toBeLessThan(hab - 0.05);
    expect(sky[cellIndexOf(site, toe)]).toBeLessThan(hab);
  });
});

describe("shelterRoute on the real site", () => {
  it("next to HAB-1 it chooses home", () => {
    const beside: LatLng = { lat: site.habitat.lat + 0.0005, lng: site.habitat.lng + 0.0005 }; // about 40 m away
    const r = shelterRoute(site, speCost, beside, 600, { skyView: sky });
    finiteOrInfinity(r);
    expect(r.betterThanHome).toBe(false);
    expect(r.target).toEqual({ lat: site.habitat.lat, lng: site.habitat.lng });
    expect(r.doseReductionPct).toBe(0);
    expect(r.reasons[0]).toMatch(/^Walk home/);
  });

  it("never returns a no-go cell or NaN, anywhere along the demo mission", () => {
    const home = dijkstraField(speCost, homeCell).cost;
    const budget = oxygenBudget(false);
    let shelters = 0;
    for (let t = 0; t <= plan.totalSec; t += 600) {
      const here = positionAt(plan, t);
      const r = shelterRoute(site, speCost, here, here.oxygenUsedSec, { skyView: sky });
      finiteOrInfinity(r);
      const cell = cellIndexOf(site, r.target);
      expect(cell).toBeGreaterThanOrEqual(0);
      expect(passable(cell)).toBe(true);
      for (let i = 1; i < r.path.length; i++) expect(segmentIsClear(site, passable, r.path[i - 1], r.path[i])).toBe(true);
      expect(r.doseToShelterMsv).toBeLessThanOrEqual(r.doseIfHomeMsv);
      if (r.betterThanHome) {
        shelters++;
        expect(r.skyView).toBeCloseTo(sky[cell], 6);
        expect(r.skyView).toBeLessThan(1);
        expect(r.doseReductionPct).toBeGreaterThanOrEqual(MIN_DOSE_REDUCTION_PCT);
        // Oxygen: walk there, wait, walk home, reserve intact.
        expect(r.sec).toBeLessThanOrEqual(DEFAULT_WAIT_MIN * 60);
        const need = (r.sec + home[cell]) * WALK_BURN + (DEFAULT_WAIT_MIN * 60 - r.sec) * SHELTER_WAIT_BURN;
        expect(budget.usableSec - here.oxygenUsedSec - need).toBeGreaterThanOrEqual(0);
      } else {
        expect(cell).toBe(homeCell);
        expect(r.doseReductionPct).toBe(0);
      }
    }
    console.log(`demo mission sampled every 10 min: a shelter beats walking home at ${shelters} of ${Math.floor(plan.totalSec / 600) + 1} moments`);
  });

  it("walking-home dose matches an independent sum along the path home", () => {
    const here = positionAt(plan, 1500); // at stop 1, about 20 min from home
    const r = shelterRoute(site, speCost, here, here.oxygenUsedSec, { skyView: sky, waitMin: 600 });
    // With a 10 hour event window nothing is cut short: doseIfHome is the whole walk home.
    const field = dijkstraField(speCost, cellIndexOf(site, here));
    const cells = pathTo(field, homeCell);
    let dose = 0;
    for (let i = 1; i < cells.length; i++) {
      dose += RATE_PER_SEC * (field.cost[cells[i]] - field.cost[cells[i - 1]]) * 0.5 * (sky[cells[i - 1]] + sky[cells[i]]);
    }
    expect(r.doseIfHomeMsv).toBeCloseTo(dose, 12);
    expect(dose).toBeLessThan(RATE_PER_SEC * field.cost[homeCell]); // some of the sky is hidden on the way
    expect(dose).toBeGreaterThan(RATE_PER_SEC * field.cost[homeCell] * 0.8);
  });

  it("the demo mission at T+1:16 gives a valid result", () => {
    const tSec = 76 * 60;
    const here = positionAt(plan, tSec);
    const r = shelterRoute(site, speCost, here, here.oxygenUsedSec, { skyView: sky });
    finiteOrInfinity(r);
    expect(passable(cellIndexOf(site, r.target))).toBe(true);
    expect(r.doseToShelterMsv).toBeGreaterThan(0);
    expect(r.doseToShelterMsv).toBeLessThanOrEqual(r.doseIfHomeMsv);
    const homeSec = dijkstraField(speCost, homeCell).cost[cellIndexOf(site, here)];
    console.log(
      `demo SPE at T+1:16 (${here.phase}, leg ${here.legIndex}, ${(homeSec / 60).toFixed(0)} min from home):\n` +
        `  target ${r.target.lat.toFixed(5)} N ${r.target.lng.toFixed(5)} E, ${(r.sec / 60).toFixed(1)} min walk, sky view ${r.skyView.toFixed(3)}\n` +
        `  dose with shelter ${r.doseToShelterMsv.toFixed(4)} mSv, dose if home ${r.doseIfHomeMsv.toFixed(4)} mSv, ` +
        `reduction ${r.doseReductionPct.toFixed(1)}%, betterThanHome ${r.betterThanHome}\n  ` +
        r.reasons.join("\n  "),
    );
  });

  it("across the whole site, a shelter is offered only far from home and near shielded ground", () => {
    const home = dijkstraField(speCost, homeCell).cost;
    let tried = 0;
    let offered = 0;
    let bestCut = 0;
    let bestFrom: LatLng | null = null;
    let nearestOfferMin = Infinity;
    // Every 24th row and column: about 130 start points on a 600 m grid (each needs its own Dijkstra field).
    for (let row = 6; row < site.height; row += 24) {
      for (let col = 6; col < site.width; col += 24) {
        const cell = row * site.width + col;
        if (!passable(cell) || home[cell] === Infinity) continue;
        tried++;
        const r = shelterRoute(site, speCost, cellCenter(site, cell), 0, { skyView: sky });
        finiteOrInfinity(r);
        expect(passable(cellIndexOf(site, r.target))).toBe(true);
        if (!r.betterThanHome) continue;
        offered++;
        nearestOfferMin = Math.min(nearestOfferMin, home[cell] / 60);
        if (r.doseReductionPct > bestCut) {
          bestCut = r.doseReductionPct;
          bestFrom = cellCenter(site, cell);
        }
        expect(r.doseReductionPct).toBeLessThan(40); // nothing walkable here hides anywhere near that much sky
      }
    }
    console.log(
      `whole site, ${tried} start points, full oxygen: a shelter is offered from ${offered} (${((100 * offered) / tried).toFixed(1)}%); ` +
        `largest dose cut ${bestCut.toFixed(1)}%` +
        (bestFrom ? ` (from ${bestFrom.lat.toFixed(4)} N ${bestFrom.lng.toFixed(4)} E); nearest such start is ${nearestOfferMin.toFixed(0)} min from home` : ""),
    );
    expect(tried).toBeGreaterThan(100);
    // Home is full shelter, so nothing within about 50 min of it can beat walking home.
    if (offered > 0) expect(nearestOfferMin).toBeGreaterThan(45);
  });

  it("runs in under 150 ms on the real grid (median, nothing cached)", () => {
    const here = positionAt(plan, 76 * 60);
    shelterRoute(site, buildCostGrid(site, SPE), here, here.oxygenUsedSec, { skyView: sky }); // warm-up
    const cold: number[] = [];
    const warm: number[] = [];
    for (let i = 0; i < 7; i++) {
      const grid = buildCostGrid(site, SPE); // a new grid: both Dijkstra fields are computed again
      const at = positionAt(plan, 76 * 60 + i * 30);
      let t0 = performance.now();
      shelterRoute(site, grid, at, at.oxygenUsedSec, { skyView: sky });
      cold.push(performance.now() - t0);
      t0 = performance.now();
      shelterRoute(site, grid, at, at.oxygenUsedSec, { skyView: sky });
      warm.push(performance.now() - t0);
    }
    cold.sort((a, b) => a - b);
    warm.sort((a, b) => a - b);
    console.log(`shelterRoute: median ${cold[3].toFixed(1)} ms with nothing cached (max ${cold[6].toFixed(1)}), ${warm[3].toFixed(1)} ms with fields cached`);
    expect(cold[3]).toBeLessThan(150);
  });
});
