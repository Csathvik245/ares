// Robustness: judges will click anywhere. Whatever the stops, the times or the
// moment of an emergency, the planner must not throw, must not put NaN or Infinity
// in anything the UI displays, and must explain an impossible plan in a sentence.
//
// Runs on the real app/public/data/site.json.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SPEED_TEST, cpuNow } from "../test-utils/cpuClock";
import {
  MAX_SLOPE_DEG,
  ROCK_NO_GO,
  abortRoute,
  buildCostGrid,
  cellCenter,
  cellIndexOf,
  computeBriefing,
  envAt,
  explainSegment,
  formatDose,
  formatDuration,
  formatKm,
  formatLmst,
  formatMet,
  formatMinutes,
  formatPct,
  loadSite,
  lowSunDuring,
  planRoute,
  positionAt,
  safeZone,
  scienceScore,
  stormAt,
  suggestStops,
  sunElevationSeries,
  walkHomeSec,
} from "./index";
import type { Conditions, CostGrid, LatLng, Plan, Site, Stop } from "./index";

const raw = JSON.parse(readFileSync(fileURLToPath(new URL("../../public/data/site.json", import.meta.url)), "utf8"));
const site = loadSite(raw);
const CALM: Conditions = { storm: false, spe: false, startLmst: 13 };
const calm = buildCostGrid(site, CALM);
const hab: LatLng = { lat: site.habitat.lat, lng: site.habitat.lng };
const BAD_TEXT = /NaN|Infinity|undefined|null|\[object/;

const stopAt = (id: string, p: LatLng, dwellMin = 30): Stop => ({ id, label: id, lat: p.lat, lng: p.lng, dwellMin });
const demo = (dwellMin = 30) =>
  site.pois
    .filter((p) => p.kind === "science")
    .slice(0, 3)
    .map((p) => stopAt(p.id, p, dwellMin));

/** First cell (scanning outward from the habitat's row) that satisfies `test`. */
function findCell(test: (cell: number) => boolean): LatLng {
  for (let c = 0; c < site.width * site.height; c++) if (test(c)) return cellCenter(site, c);
  throw new Error("no such cell on this site");
}
const steepCell = findCell((c) => site.layers.slope[c] > MAX_SLOPE_DEG && site.layers.rock[c] <= ROCK_NO_GO);
const rockyCell = findCell((c) => site.layers.rock[c] > ROCK_NO_GO && site.layers.slope[c] <= MAX_SLOPE_DEG);
const OUTSIDE: LatLng = { lat: 18.6, lng: 77.6 };

/** Every number the Plan type promises is finite, every reason is a clean sentence. */
function expectValidPlan(plan: Plan) {
  expect(["GO", "CAUTION", "NO-GO"]).toContain(plan.status);
  expect(plan.reasons.length).toBeGreaterThanOrEqual(1);
  for (const reason of plan.reasons) {
    expect(typeof reason).toBe("string");
    expect(reason.length).toBeGreaterThan(8);
    expect(reason, reason).not.toMatch(BAD_TEXT);
  }
  for (const key of ["totalSec", "walkSec", "workSec", "distM", "oxygenUsedSec", "marginSec", "oxygenAtReturnPct"] as const) {
    expect(Number.isFinite(plan[key]), `plan.${key} = ${plan[key]}`).toBe(true);
  }
  expect(plan.oxygenAtReturnPct).toBeGreaterThanOrEqual(0);
  expect(plan.oxygenAtReturnPct).toBeLessThanOrEqual(100);
  for (const leg of plan.legs) {
    for (const v of [leg.walkSec, leg.distM, leg.arriveSec]) expect(Number.isFinite(v) && v >= 0).toBe(true);
    for (const p of leg.path) expect(Number.isFinite(p.lat) && Number.isFinite(p.lng)).toBe(true);
  }
  if (!plan.ok) expect(plan.status).toBe("NO-GO");
}

/**
 * Runs every plan-consuming function on a plan and checks that nothing throws and
 * that everything the UI would display is clean text.
 */
function exercise(s: Site, cost: CostGrid, conditions: Conditions, stops: Stop[]): Plan {
  const plan = planRoute(s, cost, s.habitat, stops);
  expectValidPlan(plan);

  const shown: string[] = [
    formatKm(plan.distM), formatDuration(plan.totalSec), formatMinutes(plan.marginSec),
    formatPct(plan.oxygenAtReturnPct), formatMinutes(plan.walkSec), formatMinutes(plan.workSec),
  ];

  const zone = safeZone(s, cost, plan);
  expect(zone).toHaveLength(s.width * s.height);

  for (const t of [-100, 0, plan.totalSec / 3, plan.totalSec / 2, plan.totalSec, plan.totalSec + 5000, NaN, Infinity]) {
    const pos = positionAt(plan, t);
    expect(["walk", "science"]).toContain(pos.phase);
    expect(Number.isFinite(pos.oxygenUsedSec)).toBe(true);
    if (plan.legs.some((l) => l.path.length > 0)) {
      expect(Number.isFinite(pos.lat) && Number.isFinite(pos.lng), `positionAt(${t})`).toBe(true);
    }
    for (const kind of ["dust", "spe"] as const) {
      const out = stormAt(s, plan, t, kind, conditions.startLmst);
      expect(out.evaStatus).toBe("NO-GO");
      expect(["CAUTION", "NO-GO"]).toContain(out.abort.status);
      expect(out.evaReasons.length).toBeGreaterThan(0);
      expect(out.abort.reasons.length).toBeGreaterThan(0);
      for (const r of [...out.evaReasons, ...out.abort.reasons]) expect(r, r).not.toMatch(BAD_TEXT);
      shown.push(formatMinutes(out.abort.sec), formatMinutes(out.abort.marginSec), formatMet(out.arriveSec),
        formatPct(out.oxygenNowPct), formatPct(out.oxygenOnArrivalPct), formatMinutes(out.walkHomeMin * 60), formatMinutes(out.marginMin * 60));
    }
  }

  plan.legs.forEach((_, i) => {
    const facts = explainSegment(s, plan, i);
    expect(Number.isFinite(facts.maxSlopeDeg) && Number.isFinite(facts.sandFraction) && Number.isFinite(facts.rockMax)).toBe(true);
    expect(facts.detourNote, facts.detourNote).not.toMatch(BAD_TEXT);
  });

  const briefing = computeBriefing(s, plan, conditions);
  expect(briefing.rows).toHaveLength(5);
  expect(briefing.status).toBe(plan.status);
  for (const row of briefing.rows) shown.push(row.value);

  for (const score of scienceScore(s, plan, { stops, cost })) {
    expect(Number.isNaN(score.science) || (score.science >= 0 && score.science <= 1)).toBe(true);
    expect(Number.isNaN(score.extraO2Min)).toBe(false);
    expect(Number.isNaN(score.score)).toBe(false);
  }
  const suggestions = suggestStops(s, s.habitat, stops, 2, { cost });
  for (const sug of suggestions) expect(Number.isFinite(sug.lat) && Number.isFinite(sug.lng) && Number.isFinite(sug.marginMin)).toBe(true);

  for (const text of shown) expect(text, text).not.toMatch(BAD_TEXT);
  return plan;
}

describe("stops in awkward places", () => {
  it("a stop on a cliff (slope over 25°) is NO-GO with a clear sentence", () => {
    const plan = exercise(site, calm, CALM, [stopAt("a", demo()[0]), stopAt("cliff", steepCell), stopAt("c", demo()[2])]);
    expect(plan.status).toBe("NO-GO");
    expect(plan.reasons).toContain("Stop 2 is on a slope over 25 degrees.");
    expect(plan.reasons.filter((r) => /Stop 2/.test(r))).toHaveLength(1); // said once, not once per leg
  });

  it("a stop on very rough ground is NO-GO with a clear sentence", () => {
    const plan = exercise(site, calm, CALM, [stopAt("rough", rockyCell)]);
    expect(plan.status).toBe("NO-GO");
    expect(plan.reasons).toContain("Stop 1 is on ground too rough to cross (rock over 0.75).");
  });

  it("a stop outside the map is NO-GO with a clear sentence", () => {
    const plan = exercise(site, calm, CALM, [stopAt("a", demo()[0]), stopAt("b", demo()[1]), stopAt("far", OUTSIDE)]);
    expect(plan.status).toBe("NO-GO");
    expect(plan.reasons).toContain("Stop 3 is outside the mapped area.");
  });

  it("a stop with broken coordinates is treated as outside the map", () => {
    const plan = exercise(site, calm, CALM, [stopAt("nan", { lat: NaN, lng: NaN })]);
    expect(plan.status).toBe("NO-GO");
    expect(plan.reasons).toContain("Stop 1 is outside the mapped area.");
  });

  it("a stop on a cell with missing terrain data is NO-GO with a clear sentence", () => {
    const target = demo()[0];
    const holed = loadSite({ ...raw, layers: { ...raw.layers, slope: raw.layers.slope.map((v: number, i: number) => (i === cellIndexOf(site, target) ? null : v)) } });
    const plan = exercise(holed, buildCostGrid(holed, CALM), CALM, [stopAt("hole", target)]);
    expect(plan.status).toBe("NO-GO");
    expect(plan.reasons).toContain("Stop 1 is on ground with no terrain data.");
  });

  it("several bad stops each get their own sentence", () => {
    const plan = exercise(site, calm, CALM, [stopAt("cliff", steepCell), stopAt("far", OUTSIDE), stopAt("ok", demo()[0])]);
    expect(plan.reasons).toContain("Stop 1 is on a slope over 25 degrees.");
    expect(plan.reasons).toContain("Stop 2 is outside the mapped area.");
    expect(plan.reasons.some((r) => /Stop 3/.test(r))).toBe(false); // stop 3 itself is fine
  });

  it("a habitat outside the map is NO-GO with a clear sentence", () => {
    const plan = planRoute(site, calm, OUTSIDE, demo());
    expectValidPlan(plan);
    expect(plan.reasons).toContain("The habitat is outside the mapped area.");
  });

  it("a stop exactly on HAB-1 works: no walking, only science", () => {
    const plan = exercise(site, calm, CALM, [stopAt("home", hab, 30)]);
    expect(plan.ok).toBe(true);
    expect(plan.status).toBe("GO");
    expect(plan.distM).toBe(0);
    expect(plan.workSec).toBe(1800);
  });

  it("two stops at the same point work", () => {
    const p = demo()[0];
    const plan = exercise(site, calm, CALM, [stopAt("a", p, 20), stopAt("b", p, 20)]);
    expect(plan.ok).toBe(true);
    expect(plan.legs[1].distM).toBe(0);
    expect(plan.workSec).toBe(2400);
  });
});

describe("how many stops, and how long", () => {
  it("0 stops: an empty plan is GO, and nothing downstream breaks", () => {
    const plan = exercise(site, calm, CALM, []);
    expect(plan).toMatchObject({ ok: true, status: "GO", legs: [], totalSec: 0 });
  });

  it("1 stop", () => {
    expect(exercise(site, calm, CALM, [demo()[0]]).status).toBe("GO");
  });

  it("10 stops: valid plan, in well under 200 ms", SPEED_TEST, () => {
    const pts = site.pois.filter((p) => p.kind === "science");
    const ten = Array.from({ length: 10 }, (_, i) => stopAt(`s${i}`, pts[i % pts.length], 5));
    const t0 = cpuNow();
    const plan = planRoute(site, calm, site.habitat, ten);
    const ms = cpuNow() - t0;
    expectValidPlan(plan);
    expect(plan.legs).toHaveLength(11);
    expect(ms).toBeLessThan(200);
    exercise(site, calm, CALM, ten);
  });

  it("dwell 0 min", () => {
    const plan = exercise(site, calm, CALM, demo(0));
    expect(plan.workSec).toBe(0);
    expect(plan.status).toBe("GO");
  });

  it("dwell 240 min at each stop: NO-GO for oxygen, with the shortfall stated", () => {
    const plan = exercise(site, calm, CALM, demo(240));
    expect(plan.status).toBe("NO-GO");
    expect(plan.reasons.join(" ")).toMatch(/Oxygen margin is negative/);
  });

  it("a negative or broken dwell time is treated as 0", () => {
    for (const bad of [-30, NaN, Infinity]) {
      const plan = exercise(site, calm, CALM, demo(bad));
      expect(plan.workSec).toBe(0);
    }
  });
});

describe("time of day", () => {
  it("a night start is CAUTION and says part of the EVA is in darkness", () => {
    const night = { ...CALM, startLmst: 1 };
    const plan = exercise(site, buildCostGrid(site, night), night, demo());
    expect(plan.status).toBe("CAUTION");
    expect(plan.reasons.join(" ")).toMatch(/darkness/);
  });

  it("odd start times do not break anything", () => {
    for (const startLmst of [-5, 0, 23.99, 24, 37.5, NaN, Infinity]) {
      const conditions = { ...CALM, startLmst };
      exercise(site, buildCostGrid(site, conditions), conditions, demo());
    }
  });

  it("the environment model accepts any number", () => {
    for (const t of [-1e6, -1, 0, 24, 1e6, NaN, Infinity, -Infinity]) {
      const env = envAt(t, false);
      const finiteInput = Number.isFinite(t);
      expect(Number.isFinite(env.doseRateMsvPerHr)).toBe(true);
      if (finiteInput) expect(Number.isFinite(env.sunElevationDeg) && Number.isFinite(env.tempC)).toBe(true);
      expect(formatLmst(t)).not.toMatch(BAD_TEXT);
      expect(formatDose(env.doseRateMsvPerHr)).not.toMatch(BAD_TEXT);
    }
    expect(sunElevationSeries(13, -100, 60)).toEqual([]);
    expect(sunElevationSeries(NaN, 600, 60).length).toBeLessThanOrEqual(11);
    expect(lowSunDuring(NaN, 600)).toBeNull();
    expect(lowSunDuring(13, Infinity)).toBeNull();
  });
});

describe("emergencies at awkward moments and places", () => {
  const plan = planRoute(site, calm, site.habitat, demo());

  it("a storm at t = 0: she is at the habitat, the walk home is zero", () => {
    const out = stormAt(site, plan, 0, "dust", 13);
    expect(out.evaStatus).toBe("NO-GO");
    expect(out.abort.status).toBe("CAUTION");
    expect(out.walkHomeMin).toBeCloseTo(0, 6);
    expect(out.arriveSec).toBeCloseTo(0, 6);
  });

  it("a storm at t = totalSec: she is back home already", () => {
    const out = stormAt(site, plan, plan.totalSec, "dust", 13);
    expect(out.abort.status).toBe("CAUTION");
    expect(out.walkHomeMin).toBeCloseTo(0, 3);
    expect(out.arriveSec).toBeCloseTo(plan.totalSec, 3);
    expect(out.oxygenNowPct).toBeCloseTo(plan.oxygenAtReturnPct, 6);
  });

  it("positionAt before the start and after the end is clamped to the habitat", () => {
    expect(positionAt(plan, -3600)).toMatchObject(hab);
    expect(positionAt(plan, plan.totalSec + 3600)).toMatchObject(hab);
    expect(positionAt(plan, NaN)).toMatchObject(hab);
    expect(positionAt(plan, -3600).oxygenUsedSec).toBe(0);
    expect(positionAt(plan, 1e12).oxygenUsedSec).toBeCloseTo(plan.oxygenUsedSec, 6);
  });

  it("abortRoute from a no-go cell: NO-GO with a clear sentence, no route", () => {
    for (const [from, why] of [[steepCell, /slope over 25 degrees/], [rockyCell, /too rough/]] as const) {
      const abort = abortRoute(site, buildCostGrid(site, { ...CALM, storm: true }), from, 3600);
      expect(abort.status).toBe("NO-GO");
      expect(abort.path).toEqual([]);
      expect(abort.reasons[0]).toMatch(why);
      expect(abort.reasons.join(" ")).not.toMatch(BAD_TEXT);
      expect(formatMinutes(abort.sec)).toBe("—");
      expect(formatMinutes(abort.marginSec)).toBe("—");
    }
  });

  it("abortRoute from outside the map, or with broken numbers: NO-GO, never a throw", () => {
    const grid = buildCostGrid(site, { ...CALM, storm: true });
    expect(abortRoute(site, grid, OUTSIDE, 0).reasons[0]).toMatch(/outside the mapped area/);
    expect(abortRoute(site, grid, { lat: NaN, lng: NaN }, 0).status).toBe("NO-GO");
    for (const used of [NaN, Infinity, -500]) {
      const abort = abortRoute(site, grid, demo()[0], used);
      expect(["CAUTION", "NO-GO"]).toContain(abort.status);
      expect(abort.reasons.join(" ")).not.toMatch(BAD_TEXT);
    }
  });

  it("stormAt when the astronaut is on a no-go cell (a plan that ends on a cliff)", () => {
    // Build a plan by hand whose only leg ends on the cliff cell, as a bad caller might.
    const onCliff: Plan = { ...plan, legs: [{ path: [hab, steepCell], walkSec: 600, distM: 500, arriveSec: 600 }, { path: [steepCell, hab], walkSec: 600, distM: 500, arriveSec: 2400 }], totalSec: 2400 };
    const out = stormAt(site, onCliff, 900, "dust", 13); // during science at the cliff
    expect(out.evaStatus).toBe("NO-GO");
    expect(out.abort.status).toBe("NO-GO");
    expect(out.abort.reasons[0]).toMatch(/slope over 25 degrees/);
    for (const text of [formatMinutes(out.abort.sec), formatMet(out.arriveSec), formatPct(out.oxygenOnArrivalPct), formatMinutes(out.marginMin * 60)]) {
      expect(text).toBe("—");
    }
    expect(formatPct(out.oxygenNowPct)).toMatch(/^\d+%$/);
  });

  it("walkHomeSec from anywhere", () => {
    expect(walkHomeSec(site, calm, hab)).toBe(0);
    expect(walkHomeSec(site, calm, OUTSIDE)).toBe(Infinity);
    expect(walkHomeSec(site, calm, steepCell)).toBe(Infinity);
    expect(formatMinutes(walkHomeSec(site, calm, steepCell))).toBe("—");
  });
});

describe("fuzz: 500 random plans", () => {
  // A small seeded random generator, so a failure can be reproduced exactly.
  function mulberry32(seed: number) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it("every plan is valid, has a status and a reason, and takes under 200 ms", { ...SPEED_TEST, timeout: 60_000 }, () => {
    const rnd = mulberry32(20261115);
    const { south, north, west, east } = site.bounds;
    const grids = new Map<string, CostGrid>();
    const counts: Record<string, number> = { GO: 0, CAUTION: 0, "NO-GO": 0 };
    let slowest = 0;
    let slowestN = 0;
    let withOutside = 0;
    const times: number[] = [];

    for (let n = 0; n < 500; n++) {
      const stopCount = Math.floor(rnd() * 7); // 0 to 6 stops
      const stops: Stop[] = [];
      let outside = false;
      for (let i = 0; i < stopCount; i++) {
        // About 1 stop in 10 lands outside the map; the rest are anywhere inside it.
        let lat = south + rnd() * (north - south);
        let lng = west + rnd() * (east - west);
        if (rnd() < 0.1) {
          lat += (rnd() < 0.5 ? -1 : 1) * (0.1 + rnd() * 0.05);
          lng += (rnd() < 0.5 ? -1 : 1) * (0.14 + rnd() * 0.05);
          outside = true;
        }
        stops.push(stopAt(`f${n}-${i}`, { lat, lng }, Math.floor(rnd() * 121))); // 0 to 120 min
      }
      if (outside) withOutside++;
      const startLmst = Math.floor(rnd() * 24 * 4) / 4; // any quarter hour of the sol
      const storm = rnd() < 0.08;
      const spe = rnd() < 0.08;
      // The cell costs depend only on the storm flag, so two grids are built and the
      // other conditions are attached to a copy (500 full rebuilds would only slow the test).
      const key = String(storm);
      let base = grids.get(key);
      if (!base) grids.set(key, (base = buildCostGrid(site, { storm, spe: false, startLmst: 13 })));
      const grid: CostGrid = { ...base, conditions: { storm, spe, startLmst } };

      const t0 = cpuNow();
      const plan = planRoute(site, grid, site.habitat, stops);
      const ms = cpuNow() - t0;
      times.push(ms);
      if (ms > slowest) [slowest, slowestN] = [ms, n];

      expectValidPlan(plan);
      expect(plan.legs).toHaveLength(stopCount === 0 ? 0 : stopCount + 1);
      if (outside) expect(plan.status).toBe("NO-GO");
      if (storm || spe) expect(plan.status).toBe("NO-GO");
      expect(ms, `plan ${n} took ${ms.toFixed(0)} ms`).toBeLessThan(200);
      counts[plan.status]++;

      // Every 50th plan also goes through everything downstream.
      if (n % 50 === 0) {
        const conditions = { storm, spe, startLmst };
        exercise(site, grid, conditions, stops);
      }
    }
    times.sort((a, b) => a - b);
    console.log(
      `fuzz: 500 plans → GO ${counts.GO}, CAUTION ${counts.CAUTION}, NO-GO ${counts["NO-GO"]}; ` +
        `${withOutside} had a stop outside the map; time median ${times[250].toFixed(1)} ms, ` +
        `95th pct ${times[475].toFixed(1)} ms, slowest ${slowest.toFixed(1)} ms (plan ${slowestN})`,
    );
    expect(counts.GO + counts.CAUTION + counts["NO-GO"]).toBe(500);
    expect(counts.GO).toBeGreaterThan(0);
    expect(counts["NO-GO"]).toBeGreaterThan(0);
  });
});
