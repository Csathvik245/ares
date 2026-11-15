// Independent check: Perseverance really drove here, so the planner should rate the
// ground under its end-of-drive waypoints as passable. See docs/validation.md.
// The waypoint sample comes from NASA's Mars 2020 waypoints file and is written by
// pipeline/validate_traverse.py. None of it was used to build the terrain layers.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MAX_SLOPE_DEG, ROCK_NO_GO, buildCostGrid, cellIndexOf, loadSite } from "./index";

const read = (relative: string) => JSON.parse(readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8"));
const site = loadSite(read("../../public/data/site.json"));
const cost = buildCostGrid(site, { storm: false, spe: false, startLmst: 13 });
const sample = read("./__fixtures__/rover-waypoints-sample.json") as {
  source: string;
  passablePctWhenWritten: number;
  waypoints: { sol: number; lat: number; lng: number; tiltDeg: number }[];
};

// Measured when the check was written: 310 of 313 waypoints (99.04%) are on passable cells.
// The test allows 2 points of slack; below that it fails on purpose.
const MEASURED_PASSABLE_PCT = 99.04;
const MIN_PASSABLE_PCT = MEASURED_PASSABLE_PCT - 2;

describe("Perseverance's real waypoints on the ARES terrain", () => {
  const cells = sample.waypoints.map((w) => cellIndexOf(site, w));

  it("the sample is the real NASA file, inside our bounds", () => {
    expect(sample.source).toBe("https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json");
    expect(sample.waypoints.length).toBeGreaterThan(300);
    expect(cells.every((c) => c >= 0)).toBe(true);
    // The first waypoint is the landing point, which is where the habitat sits.
    expect(sample.waypoints[0].lat).toBeCloseTo(site.habitat.lat, 3);
    expect(sample.waypoints[0].lng).toBeCloseTo(site.habitat.lng, 3);
  });

  it(`at least ${MIN_PASSABLE_PCT.toFixed(2)}% of the rover's waypoints are on cells the planner calls passable`, () => {
    const blocked = sample.waypoints.filter((_, i) => cost.secPerM[cells[i]] === Infinity);
    const pct = (1 - blocked.length / sample.waypoints.length) * 100;
    console.log(
      `rover waypoints on passable cells: ${sample.waypoints.length - blocked.length} of ${sample.waypoints.length} (${pct.toFixed(2)}%); ` +
        `blocked: ${blocked.map((w) => `sol ${w.sol}`).join(", ") || "none"}`,
    );
    expect(pct).toBeGreaterThanOrEqual(MIN_PASSABLE_PCT);
  });

  it("the planner's passable rule is the Contract 2 rule the validation script used", () => {
    for (let i = 0; i < cells.length; i++) {
      const passable = site.layers.slope[cells[i]] <= MAX_SLOPE_DEG && site.layers.rock[cells[i]] <= ROCK_NO_GO;
      expect(cost.secPerM[cells[i]] !== Infinity).toBe(passable);
    }
  });

  it("our slope is usually at least the tilt the rover itself measured, and tracks it", () => {
    const ours = cells.map((c) => site.layers.slope[c]);
    const tilt = sample.waypoints.map((w) => w.tiltDeg);
    const atLeast = ours.filter((s, i) => s >= tilt[i]).length / ours.length;
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    const [mo, mt] = [mean(ours), mean(tilt)];
    const cov = mean(ours.map((s, i) => (s - mo) * (tilt[i] - mt)));
    const corr = cov / Math.sqrt(mean(ours.map((s) => (s - mo) ** 2)) * mean(tilt.map((t) => (t - mt) ** 2)));
    expect(atLeast).toBeGreaterThan(0.7); // measured: 0.79
    expect(corr).toBeGreaterThan(0.7); // measured: 0.82
  });
});
