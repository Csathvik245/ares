// Speed check for every exported planner function, on the real 320 × 240 site.json.
// Each function is run several times; the MEDIAN run must take under 100 ms
// (CLAUDE.md section 6: "well under 100 ms on 76,800 cells").
// Functions that take microseconds are timed as a batch of 1,000 calls.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as planner from "./index";
import {
  aStar,
  abortRoute,
  buildCostGrid,
  cellCenter,
  cellIndexOf,
  dijkstraField,
  distanceM,
  doseRateMsvPerHr,
  envAt,
  equationOfTimeDeg,
  explainSegment,
  fieldFrom,
  forEachCellOnSegment,
  isLowMargin,
  lmstToLtst,
  loadSite,
  lowSunDuring,
  ltstToLmst,
  oxygenBudget,
  pathLengthM,
  pathTo,
  planRoute,
  polylineLengthM,
  positionAt,
  safeZone,
  segmentIsClear,
  segmentTimeSec,
  smoothPath,
  solarDeclinationDeg,
  sunElevationDeg,
  sunElevationSeries,
  temperatureC,
  walkHomeSec,
  walkingSpeedMps,
} from "./index";
import type { Conditions, Stop } from "./index";

const LIMIT_MS = 100;
const RUNS = 7;
const CALM: Conditions = { storm: false, spe: false, startLmst: 13 };

const raw = JSON.parse(readFileSync(fileURLToPath(new URL("../../public/data/site.json", import.meta.url)), "utf8"));
const site = loadSite(raw);
const cost = buildCostGrid(site, CALM);
const stops: Stop[] = site.pois
  .filter((p) => p.kind === "science")
  .slice(0, 3)
  .map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin: 30 }));
const plan = planRoute(site, cost, site.habitat, stops);
const habitatCell = cellIndexOf(site, site.habitat);
const farCell = cellIndexOf(site, stops[1]); // the delta front toe, about 2 km away
const far = { lat: stops[1].lat, lng: stops[1].lng };
const homeField = dijkstraField(cost, habitatCell);
const farPath = pathTo(homeField, farCell);
const farLine = plan.legs[1].path;
const budget = oxygenBudget(false);

/** Median time in ms of `fn` over RUNS runs, after one warm-up run. */
function medianMs(fn: () => unknown): number {
  fn();
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(RUNS / 2)];
}
const x1000 = (fn: (i: number) => unknown) => () => {
  for (let i = 0; i < 1000; i++) fn(i);
};

// name -> [what is timed, the work]
const CASES: Record<string, [string, () => unknown]> = {
  loadSite: ["parse the full site.json object", () => loadSite(raw)],
  buildCostGrid: ["all 76,800 cells", () => buildCostGrid(site, CALM)],
  walkingSpeedMps: ["1,000 calls", x1000((i) => walkingSpeedMps(i % 30, (i % 10) / 10, 150 + (i % 200), i % 2 === 0))],
  cellIndexOf: ["1,000 calls", x1000(() => cellIndexOf(site, far))],
  cellCenter: ["1,000 calls", x1000((i) => cellCenter(site, i * 70))],
  dijkstraField: ["full field from the habitat", () => dijkstraField(cost, habitatCell)],
  aStar: ["habitat to the delta front toe", () => aStar(cost, habitatCell, farCell)],
  pathTo: ["rebuild a 2 km path", () => pathTo(homeField, farCell)],
  pathLengthM: ["1,000 calls on a 2 km path", x1000(() => pathLengthM(cost, farPath))],
  planRoute: ["the demo mission (4 legs)", () => planRoute(site, cost, site.habitat, stops)],
  smoothPath: ["smooth a 2 km grid path", () => smoothPath(site, cost, farPath, site.habitat, far)],
  segmentIsClear: ["1,000 calls on a 2 km line", x1000(() => segmentIsClear(site, (cell) => cost.secPerM[cell] !== Infinity, site.habitat, far))],
  segmentTimeSec: ["1,000 calls on a 2 km line", x1000(() => segmentTimeSec(site, cost, site.habitat, far))],
  forEachCellOnSegment: ["1,000 calls on a 2 km line", x1000(() => forEachCellOnSegment(site, site.habitat, far, () => true))],
  distanceM: ["1,000 calls", x1000(() => distanceM(site.habitat, far))],
  polylineLengthM: ["1,000 calls on a drawn leg", x1000(() => polylineLengthM(farLine))],
  oxygenBudget: ["1,000 calls", x1000((i) => oxygenBudget(i % 2 === 0))],
  isLowMargin: ["1,000 calls", x1000((i) => isLowMargin(i * 10, budget))],
  // A brand-new grid each time, so the field is really computed (not read from the cache).
  fieldFrom: ["new grid + full field (cache miss)", () => fieldFrom(buildCostGrid(site, CALM), habitatCell)],
  walkHomeSec: ["new grid + walk-home time (cache miss)", () => walkHomeSec(site, buildCostGrid(site, CALM), far)],
  safeZone: ["new grid + zone (cache miss)", () => safeZone(site, buildCostGrid(site, CALM), plan)],
  positionAt: ["1,000 calls along the timeline", x1000((i) => positionAt(plan, (i / 1000) * plan.totalSec))],
  abortRoute: ["new storm grid + abort route (cache miss)", () => abortRoute(site, buildCostGrid(site, { ...CALM, storm: true }), far, 3600)],
  explainSegment: ["leg 2 of the demo mission", () => explainSegment(site, plan, 1)],
  envAt: ["1,000 calls", x1000((i) => envAt((i % 2400) / 100, i % 2 === 0))],
  sunElevationSeries: ["an 8 h EVA at 1-minute steps", () => sunElevationSeries(9, 8 * 3600, 60)],
  sunElevationDeg: ["1,000 calls", x1000((i) => sunElevationDeg((i % 2400) / 100))],
  lowSunDuring: ["an 8 h EVA", () => lowSunDuring(12, 8 * 3600)],
  solarDeclinationDeg: ["1,000 calls", x1000((i) => solarDeclinationDeg(i % 360))],
  equationOfTimeDeg: ["1,000 calls", x1000((i) => equationOfTimeDeg(i % 360))],
  lmstToLtst: ["1,000 calls", x1000((i) => lmstToLtst((i % 2400) / 100))],
  ltstToLmst: ["1,000 calls", x1000((i) => ltstToLmst((i % 2400) / 100))],
  temperatureC: ["1,000 calls", x1000((i) => temperatureC((i % 2400) / 100))],
  doseRateMsvPerHr: ["1,000 calls", x1000((i) => doseRateMsvPerHr(i % 2 === 0))],
  roundHalfUp: ["1,000 calls", x1000((i) => planner.roundHalfUp(i / 7, 2))],
  wholeMinutes: ["1,000 calls", x1000((i) => planner.wholeMinutes(i * 31))],
  formatMinutes: ["1,000 calls", x1000((i) => planner.formatMinutes(i * 31))],
  formatDuration: ["1,000 calls", x1000((i) => planner.formatDuration(i * 31))],
  formatKm: ["1,000 calls", x1000((i) => planner.formatKm(i * 13.7))],
  formatPct: ["1,000 calls", x1000((i) => planner.formatPct(i / 10))],
  formatDose: ["1,000 calls", x1000((i) => planner.formatDose(i / 1000))],
  formatLmst: ["1,000 calls", x1000((i) => planner.formatLmst(i / 40))],
  formatMet: ["1,000 calls", x1000((i) => planner.formatMet(i * 31))],
};

describe("every exported planner function is fast", () => {
  it("has a timing case for every function index.ts exports", () => {
    const exported = Object.entries(planner)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)
      .sort();
    expect(Object.keys(CASES).sort()).toEqual(exported);
  });

  const results: string[] = [];
  for (const [name, [what, fn]] of Object.entries(CASES)) {
    it(`${name}: ${what}, median under ${LIMIT_MS} ms`, () => {
      const ms = medianMs(fn);
      results.push(`${name.padEnd(22)} ${ms.toFixed(2).padStart(7)} ms   ${what}`);
      expect(ms).toBeLessThan(LIMIT_MS);
    });
  }

  it("prints the timing table", () => {
    console.log(`median of ${RUNS} runs on the real ${site.width} x ${site.height} site.json:\n` + results.join("\n"));
    expect(results).toHaveLength(Object.keys(CASES).length);
  });
});
