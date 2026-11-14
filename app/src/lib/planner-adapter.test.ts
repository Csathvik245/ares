import { describe, it, expect } from "vitest";
import {
  loadSite,
  buildCostGrid,
  planRoute,
  safeZone,
  positionAt,
  abortRoute,
  envAt,
  cellCenter,
} from "./planner";
function fixture() {
  return loadSite({
    width: 5,
    height: 5,
    bounds: { south: 0, north: 0.01, west: 0, east: 0.01 },
    cellSizeM: { x: 25, y: 25 },
    habitat: { name: "HAB", lat: 0.005, lng: 0.005 },
    pois: [],
    sources: {},
    layers: {
      elevation: Array(25).fill(0),
      slope: Array(25).fill(0),
      thermalInertia: Array(25).fill(200),
      rock: Array(25).fill(0),
      science: Array(25).fill(0),
    },
  });
}
const conditions = { storm: false, spe: false, startLmst: 13 };
describe("frontend planner adapters", () => {
  it("excludes impassable cells from the return zone", () => {
    const s = fixture();
    s.layers.slope[0] = 90;
    const c = buildCostGrid(s, conditions);
    const z = safeZone(s, c, planRoute(s, c, s.habitat, []));
    expect(z[0]).toBe(0);
    expect(z[12]).toBe(1);
  });
  it("positions the astronaut at a stop during science and at home at the end", () => {
    const s = fixture(),
      c = buildCostGrid(s, conditions);
    const p = planRoute(s, c, s.habitat, [
      { ...cellCenter(s, 14), id: "a", label: "A", dwellMin: 10 },
    ]);
    const at = positionAt(p, p.legs[0].arriveSec + 60);
    expect(at.phase).toBe("science");
    expect(at.oxygenUsedSec).toBeCloseTo(p.legs[0].walkSec * 1.3 + 60 * 0.9);
    expect(positionAt(p, p.totalSec).oxygenUsedSec).toBeCloseTo(
      p.oxygenUsedSec,
    );
    expect(positionAt(p, p.totalSec).lat).toBeCloseTo(s.habitat.lat);
  });
  it("routes abort home and rejects a blocked origin", () => {
    const s = fixture(),
      c = buildCostGrid(s, conditions),
      from = cellCenter(s, 14);
    expect(abortRoute(s, c, from, 0).path.at(-1)).toEqual(cellCenter(s, 12));
    s.layers.slope[14] = 90;
    const blocked = abortRoute(s, buildCostGrid(s, conditions), from, 0);
    expect(blocked.status).toBe("NO-GO");
    expect(blocked.path).toEqual([]);
  });
  it("applies the illustrative SPE multiplier", () =>
    expect(
      envAt(13, true).doseRateMsvPerHr / envAt(13, false).doseRateMsvPerHr,
    ).toBe(30));
});
