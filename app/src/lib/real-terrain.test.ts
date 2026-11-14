import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  loadSite,
  buildCostGrid,
  planRoute,
  cellIndexOf,
  cellCenter,
  homeField,
  safeZone,
  positionAt,
  abortRoute,
} from "./planner";
// QA coordinates are selected only for tests, never offered as science targets.
const site = loadSite(
  JSON.parse(
    readFileSync(
      new URL("../../public/data/site.json", import.meta.url),
      "utf8",
    ),
  ),
);
const conditions = { storm: false, spe: false, startLmst: 10 };
const cost = buildCostGrid(site, conditions);
const home = homeField(site, cost);
const homeCell = cellIndexOf(site, site.habitat);
const reachable = Array.from(home.cost.keys()).filter(
  (i) => home.cost[i] > 60 && home.cost[i] < 600,
);
const stop = (index: number, id: string) => ({
  ...cellCenter(site, index),
  id,
  label: "QA point, not a science target",
  dwellMin: 5,
});
describe("frontend integration with supplied real terrain", () => {
  it("has a passable habitat and reachable local cells", () => {
    expect(Number.isFinite(cost.secPerM[homeCell])).toBe(true);
    expect(reachable.length).toBeGreaterThan(1);
  });
  it("replans local stops, supports science dwell and returns home", () => {
    const stops = [stop(reachable[0], "a"), stop(reachable.at(-1)!, "b")];
    const p = planRoute(site, cost, site.habitat, stops);
    expect(p.ok).toBe(true);
    expect(p.legs).toHaveLength(3);
    const changed = planRoute(site, cost, site.habitat, [
      { ...stops[1], dwellMin: 15 },
      stops[0],
    ]);
    expect(changed.ok).toBe(true);
    expect(changed.workSec - p.workSec).toBe(600);
    expect(positionAt(p, p.totalSec)).toMatchObject({
      lat: site.habitat.lat,
      lng: site.habitat.lng,
    });
    const halfway = positionAt(p, p.legs[0].arriveSec / 2);
    const storm = buildCostGrid(site, { ...conditions, storm: true });
    const abort = abortRoute(site, storm, halfway, halfway.oxygenUsedSec);
    expect(abort.path.at(-1)).toEqual({
      lat: site.habitat.lat,
      lng: site.habitat.lng,
    });
    expect(Number.isFinite(abort.marginSec)).toBe(true);
  });
  it("collapses the safe zone for an over-budget plan and flags blocked stops", () => {
    const p = planRoute(site, cost, site.habitat, [
      { ...stop(reachable[0], "long-a"), dwellMin: 480 },
      { ...stop(reachable.at(-1)!, "long-b"), dwellMin: 480 },
    ]);
    expect(p.status).toBe("NO-GO");
    expect(safeZone(site, cost, p).some(Boolean)).toBe(false);
    const blocked = cost.secPerM.findIndex((v) => !Number.isFinite(v));
    expect(blocked).toBeGreaterThanOrEqual(0);
    const invalid = planRoute(site, cost, site.habitat, [
      stop(blocked, "blocked"),
    ]);
    expect(invalid.ok).toBe(false);
    expect(invalid.status).toBe("NO-GO");
  });
});
