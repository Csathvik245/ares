import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCostGrid, cellIndexOf, loadSite, planRoute, polylineLengthM } from "../planner";
import type { Stop } from "../planner";
import { PROFILE_STEP_M, elevationProfile, profileDistanceAt, sampleCount } from "./profile";

const site = loadSite(
  JSON.parse(readFileSync(new URL("../../public/data/site.json", import.meta.url), "utf8")),
);
const cost = buildCostGrid(site, { storm: false, spe: false, startLmst: 13 });
const stops: Stop[] = site.pois
  .filter((p) => p.kind === "science")
  .slice(0, 3)
  .map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin: 30 }));
const plan = planRoute(site, cost, site.habitat, stops);
const profile = elevationProfile(site, plan);
const habitatElev = site.layers.elevation[cellIndexOf(site, site.habitat)];

describe("elevationProfile on the demo mission", () => {
  it("samples every leg about every 25 m", () => {
    const expected = plan.legs.reduce((n, leg) => n + sampleCount(polylineLengthM(leg.path)), 0);
    expect(profile.points).toHaveLength(expected);
    expect(sampleCount(100)).toBe(5);
    expect(sampleCount(101)).toBe(6);
    // Neighbouring samples on the same leg are never more than one step apart.
    for (let i = 1; i < profile.points.length; i++) {
      const a = profile.points[i - 1];
      const b = profile.points[i];
      expect(b.distM).toBeGreaterThanOrEqual(a.distM);
      if (a.legIndex === b.legIndex) expect(b.distM - a.distM).toBeLessThanOrEqual(PROFILE_STEP_M + 1e-6);
    }
    console.log(
      `elevation profile: ${profile.points.length} samples over ${(profile.totalM / 1000).toFixed(2)} km ` +
        `(grid path ${(plan.distM / 1000).toFixed(2)} km), ${profile.minElevM.toFixed(0)} to ${profile.maxElevM.toFixed(0)} m`,
    );
  });

  it("starts and ends at the habitat", () => {
    const first = profile.points[0];
    const last = profile.points[profile.points.length - 1];
    expect(first.distM).toBe(0);
    expect(first.elevM).toBe(habitatElev);
    expect(last.elevM).toBe(habitatElev);
    expect(last.distM).toBeCloseTo(profile.totalM, 6);
    // The drawn line is a little shorter than the grid path, never longer.
    expect(profile.totalM).toBeLessThanOrEqual(plan.distM + 1);
    expect(profile.totalM).toBeGreaterThan(plan.distM * 0.85);
  });

  it("keeps every value inside the site's elevation range", () => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of site.layers.elevation) {
      if (Number.isNaN(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    for (const p of profile.points) {
      expect(p.elevM).toBeGreaterThanOrEqual(lo);
      expect(p.elevM).toBeLessThanOrEqual(hi);
    }
    expect(profile.minElevM).toBe(Math.min(...profile.points.map((p) => p.elevM)));
    expect(profile.maxElevM).toBe(Math.max(...profile.points.map((p) => p.elevM)));
  });

  it("marks one stop per stop, at the end of its leg and at the stop's own elevation", () => {
    expect(profile.stops.map((s) => s.index)).toEqual([0, 1, 2]);
    profile.stops.forEach((s, i) => {
      expect(s.distM).toBeCloseTo(profile.legStartM[i + 1], 6);
      const atStop = profile.points.filter((p) => p.legIndex === i).at(-1)!;
      expect(atStop.elevM).toBe(site.layers.elevation[cellIndexOf(site, stops[i])]);
    });
  });
});

describe("profileDistanceAt", () => {
  it("runs from 0 to the total and waits at each stop", () => {
    expect(profileDistanceAt(plan, profile, 0)).toBe(0);
    expect(profileDistanceAt(plan, profile, plan.totalSec)).toBeCloseTo(profile.totalM, 6);
    const leg0 = plan.legs[0];
    expect(profileDistanceAt(plan, profile, leg0.walkSec / 2)).toBeCloseTo(profile.legStartM[1] / 2, 6);
    // During science at stop 1 the cursor stays on the stop marker.
    expect(profileDistanceAt(plan, profile, leg0.arriveSec + 600)).toBe(profile.stops[0].distM);
    let prev = -1;
    for (let t = 0; t <= plan.totalSec; t += 120) {
      const d = profileDistanceAt(plan, profile, t);
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
  });
});

describe("edge cases", () => {
  it("an empty plan gives an empty profile", () => {
    const empty = planRoute(site, cost, site.habitat, []);
    const p = elevationProfile(site, empty);
    expect(p.points).toEqual([]);
    expect(p.stops).toEqual([]);
    expect(p.totalM).toBe(0);
    expect(Number.isNaN(profileDistanceAt(empty, p, 10))).toBe(true);
  });

  it("an unreachable leg adds no samples but keeps the stop marker", () => {
    const blocked = cost.secPerM.findIndex((v) => !Number.isFinite(v));
    const row = Math.floor(blocked / site.width);
    const col = blocked % site.width;
    const noGo: Stop = {
      id: "blocked",
      label: "QA point, not a science target",
      dwellMin: 5,
      lat: site.bounds.north - ((row + 0.5) / site.height) * (site.bounds.north - site.bounds.south),
      lng: site.bounds.west + ((col + 0.5) / site.width) * (site.bounds.east - site.bounds.west),
    };
    const bad = planRoute(site, cost, site.habitat, [noGo]);
    const p = elevationProfile(site, bad);
    expect(bad.ok).toBe(false);
    expect(p.points).toEqual([]);
    expect(p.stops).toHaveLength(1);
  });
});
