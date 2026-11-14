import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { readBasemap } from "./basemap";
import { loadSite, planRoute, buildCostGrid } from "./planner";
import { demoStopsFromSite } from "./data";
const site = loadSite(
  JSON.parse(
    readFileSync(
      new URL("../../public/data/site.json", import.meta.url),
      "utf8",
    ),
  ),
);
const metadata = JSON.parse(
  readFileSync(
    new URL("../../public/data/basemap.json", import.meta.url),
    "utf8",
  ),
);
const resolve = (name: string) =>
  name === "data/basemap.png" ? "/data/basemap.png" : undefined;
it("accepts the real mosaic bounds and preserves its NASA/USGS credit", () => {
  const map = readBasemap(metadata, site.bounds, resolve);
  expect(map?.url).toBe("/data/basemap.png");
  expect(map?.credit).toBe(metadata.credit);
  expect(map?.bounds).toEqual(site.bounds);
});
it("rejects misaligned, missing or unsafe mosaic assets", () => {
  expect(
    readBasemap(
      { ...metadata, bounds: { ...metadata.bounds, north: 30 } },
      site.bounds,
      resolve,
    ),
  ).toBeNull();
  expect(
    readBasemap({ ...metadata, file: "../secret.png" }, site.bounds, resolve),
  ).toBeNull();
  expect(readBasemap(metadata, site.bounds, () => undefined)).toBeNull();
});
it("preserves POI notes and photo metadata while loading the verified real demo", () => {
  const demo = demoStopsFromSite(site);
  expect(demo).toHaveLength(3);
  expect(demo[0].why).toBe(site.pois[0].note);
  expect(demo[0].photo).toBe(site.pois[0].photo);
  expect(demo[0].photoCredit).toBe(site.pois[0].photoCredit);
  const cost = buildCostGrid(site, { storm: false, spe: false, startLmst: 13 }),
    plan = planRoute(site, cost, site.habitat, demo);
  expect(plan.status).toBe("GO");
  expect(plan.distM).toBeGreaterThan(4000);
  expect(plan.distM).toBeLessThan(5000);
});
