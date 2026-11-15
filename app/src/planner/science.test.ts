// Science per oxygen-minute, checked on the real site.json demo mission.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { WALK_BURN, WORK_BURN, buildCostGrid, cellIndexOf, distanceM, loadSite, planRoute } from "./index";
import type { Conditions, Stop } from "./index";
import {
  SUGGEST_MIN_SPACING_M,
  SUGGEST_TOP_FRACTION,
  scienceNear,
  scienceScore,
  suggestStops,
} from "./science";

const CALM: Conditions = { storm: false, spe: false, startLmst: 13 };
const raw = JSON.parse(readFileSync(fileURLToPath(new URL("../../public/data/site.json", import.meta.url)), "utf8"));
const site = loadSite(raw);
const cost = buildCostGrid(site, CALM);
const stops: Stop[] = site.pois
  .filter((p) => p.kind === "science")
  .slice(0, 3)
  .map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin: 30 }));
const plan = planRoute(site, cost, site.habitat, stops);

describe("scienceNear", () => {
  it("averages the cells within 50 m and stays between 0 and 1", () => {
    for (const s of stops) {
      const v = scienceNear(site, s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    // Radius 0 is just the stop's own cell.
    expect(scienceNear(site, stops[1], 0)).toBeCloseTo(site.layers.science[cellIndexOf(site, stops[1])], 6);
    expect(Number.isNaN(scienceNear(site, { lat: 50, lng: 50 }))).toBe(true);
  });
});

describe("scienceScore on the demo mission", () => {
  const scores = scienceScore(site, plan, { stops, cost });

  it("returns one finite, positive score per stop, with the stop ids", () => {
    expect(scores.map((s) => s.id)).toEqual(["seitah-brac", "delta-toe", "maaz-sid"]);
    for (const s of scores) {
      expect(Number.isFinite(s.science)).toBe(true);
      expect(Number.isFinite(s.extraO2Min)).toBe(true);
      expect(Number.isFinite(s.score)).toBe(true);
      expect(s.science).toBeGreaterThan(0);
      expect(s.score).toBeGreaterThan(0);
      expect(s.score).toBeCloseTo(s.science / s.extraO2Min, 12);
      // Every stop costs at least its 30 min of science at WORK_BURN.
      expect(s.extraO2Min).toBeGreaterThanOrEqual(30 * WORK_BURN - 1e-6);
    }
    console.log(
      "demo mission, science per oxygen-minute:\n" +
        scores
          .map(
            (s) =>
              `  ${s.id.padEnd(12)} science ${s.science.toFixed(3)}  extra O2 ${s.extraO2Min.toFixed(1)} min  ` +
              `score ${s.score.toFixed(5)} per O2-min (${(s.score * 60).toFixed(3)} per O2-hour)`,
          )
          .join("\n"),
    );
  });

  it("the delta front toe has the highest science value", () => {
    const toe = scores.find((s) => s.id === "delta-toe")!;
    for (const s of scores) if (s.id !== "delta-toe") expect(toe.science).toBeGreaterThan(s.science);
  });

  it("extra oxygen matches re-planning without the stop", () => {
    stops.forEach((skipped, i) => {
      const without = planRoute(site, cost, site.habitat, stops.filter((s) => s !== skipped));
      const saved = (plan.oxygenUsedSec - without.oxygenUsedSec) / 60;
      expect(scores[i].extraO2Min).toBeCloseTo(saved, 6);
    });
    // The parts add up as Contract 2 says: walking at WALK_BURN, science at WORK_BURN.
    const without = planRoute(site, cost, site.habitat, [stops[0], stops[2]]);
    expect(scores[1].extraO2Min * 60).toBeCloseTo((plan.walkSec - without.walkSec) * WALK_BURN + 30 * 60 * WORK_BURN, 4);
  });

  it("works without the stops list and without a cost grid", () => {
    const plain = scienceScore(site, plan);
    expect(plain.map((s) => s.id)).toEqual(["stop-1", "stop-2", "stop-3"]);
    plain.forEach((s, i) => expect(s.score).toBeCloseTo(scores[i].score, 12));
  });

  it("handles empty and unreachable plans", () => {
    expect(scienceScore(site, planRoute(site, cost, site.habitat, []))).toEqual([]);
    const blockedCell = cost.secPerM.findIndex((v) => !Number.isFinite(v));
    const row = Math.floor(blockedCell / site.width);
    const col = blockedCell % site.width;
    const blocked: Stop = {
      id: "blocked",
      label: "QA point, not a science target",
      dwellMin: 5,
      lat: site.bounds.north - ((row + 0.5) / site.height) * (site.bounds.north - site.bounds.south),
      lng: site.bounds.west + ((col + 0.5) / site.width) * (site.bounds.east - site.bounds.west),
    };
    const bad = planRoute(site, cost, site.habitat, [blocked]);
    const [s] = scienceScore(site, bad, { stops: [blocked], cost });
    expect(s).toMatchObject({ id: "blocked", extraO2Min: Infinity, score: 0 });
  });
});

describe("suggestStops on the demo mission", () => {
  const suggestions = suggestStops(site, site.habitat, stops, 3);
  /** The demo stops with a suggestion put where it says it goes. */
  const withStop = (s: (typeof suggestions)[number]) => {
    const next = [...stops];
    next.splice(s.insertAt, 0, s);
    return next;
  };

  it("returns three suggestions, best score first, from the top few percent of science", () => {
    expect(suggestions).toHaveLength(3);
    const sorted = Array.from(site.layers.science).filter((v) => !Number.isNaN(v)).sort((a, b) => a - b);
    const threshold = sorted[Math.floor(sorted.length * (1 - SUGGEST_TOP_FRACTION))];
    for (let i = 0; i < suggestions.length; i++) {
      const s = suggestions[i];
      expect(site.layers.science[cellIndexOf(site, s)]).toBeGreaterThanOrEqual(threshold);
      expect(s.score).toBeGreaterThan(0);
      expect(Number.isFinite(s.score)).toBe(true);
      if (i > 0) expect(s.score).toBeLessThanOrEqual(suggestions[i - 1].score + 1e-12);
    }
    console.log(
      `suggestions for the demo mission (science threshold ${threshold.toFixed(2)}):\n` +
        suggestions
          .map(
            (s) =>
              `  ${s.lat.toFixed(5)} N ${s.lng.toFixed(5)} E  science ${s.science.toFixed(3)}  extra O2 ${s.extraO2Min.toFixed(1)} min  ` +
              `score ${s.score.toFixed(5)}  insert at ${s.insertAt}  margin after ${s.marginMin.toFixed(0)} min`,
          )
          .join("\n"),
    );
  });

  it("every suggestion keeps the plan GO with margin 0 or more", () => {
    for (const s of suggestions) {
      const next = planRoute(site, cost, site.habitat, withStop(s));
      expect(next.status).toBe("GO");
      expect(next.marginSec).toBeGreaterThanOrEqual(0);
      expect(s.marginMin).toBeCloseTo(next.marginSec / 60, 6);
      expect(s.extraO2Min).toBeCloseTo((next.oxygenUsedSec - plan.oxygenUsedSec) / 60, 6);
    }
  });

  it("keeps suggestions 150 m apart and 150 m from existing stops", () => {
    suggestions.forEach((a, i) => {
      for (const s of stops) expect(distanceM(a, s)).toBeGreaterThanOrEqual(SUGGEST_MIN_SPACING_M);
      suggestions.slice(i + 1).forEach((b) => expect(distanceM(a, b)).toBeGreaterThanOrEqual(SUGGEST_MIN_SPACING_M));
    });
  });

  it("is deterministic and respects n", () => {
    expect(suggestStops(site, site.habitat, stops, 3)).toEqual(suggestions);
    expect(suggestStops(site, site.habitat, stops, 1)).toEqual(suggestions.slice(0, 1));
    expect(suggestStops(site, site.habitat, stops, 0)).toEqual([]);
  });

  it("works with no existing stops, and suggests nothing for a plan that is not GO", () => {
    const fromScratch = suggestStops(site, site.habitat, [], 2);
    expect(fromScratch).toHaveLength(2);
    for (const s of fromScratch) expect(planRoute(site, cost, site.habitat, [s]).status).toBe("GO");
    // 7 hours of science at one stop leaves a low margin: CAUTION, so nothing is suggested.
    const tight = [{ ...stops[0], dwellMin: 420 }];
    expect(planRoute(site, cost, site.habitat, tight).status).not.toBe("GO");
    expect(suggestStops(site, site.habitat, tight, 3)).toEqual([]);
  });

  it("runs in under 300 ms on the real grid, even with nothing cached", () => {
    const times: number[] = [];
    for (let i = 0; i < 7; i++) {
      // A fresh copy of the site, so the cost grid and both Dijkstra fields are rebuilt.
      const fresh = { ...site };
      const t0 = performance.now();
      const out = suggestStops(fresh, fresh.habitat, stops, 3);
      times.push(performance.now() - t0);
      expect(out).toHaveLength(3);
    }
    times.sort((a, b) => a - b);
    const t1 = performance.now();
    suggestStops(site, site.habitat, stops, 3);
    const warm = performance.now() - t1;
    const t2 = performance.now();
    scienceScore(site, plan, { stops, cost });
    const scoreMs = performance.now() - t2;
    console.log(
      `suggestStops: cold median ${times[3].toFixed(1)} ms (max ${times[6].toFixed(1)}), ` +
        `fields cached ${warm.toFixed(1)} ms; scienceScore ${scoreMs.toFixed(1)} ms`,
    );
    expect(times[3]).toBeLessThan(300);
    expect(scoreMs).toBeLessThan(100);
  });
});
