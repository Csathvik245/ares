// The three re-planning emergencies (emergencies.ts) on the real demo mission.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CONSUMABLE_HOURS,
  RESERVE_MIN,
  abortRoute,
  blockedGrid,
  blockedPathAt,
  buildCostGrid,
  cellIndexOf,
  formatMinutes,
  loadSite,
  oxygenLossAt,
  planRoute,
  positionAt,
  scenarioAt,
  slowWalkAt,
  slowedGrid,
  stormAt,
} from "./index";
import type { Conditions, ScenarioOutcome, Stop } from "./index";

const site = loadSite(JSON.parse(readFileSync(fileURLToPath(new URL("../../public/data/site.json", import.meta.url)), "utf8")));
const CALM: Conditions = { storm: false, spe: false, startLmst: 13 };
const calm = buildCostGrid(site, CALM);
const stops: Stop[] = site.pois
  .filter((p) => p.kind === "science")
  .slice(0, 3)
  .map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin: 30 }));
const plan = planRoute(site, calm, site.habitat, stops);
const T = 1 * 3600 + 16 * 60; // T+1:16, walking leg 2 (to the delta front toe)
const here = positionAt(plan, T);
const opts = { stops, startLmst: CALM.startLmst };
const ahead = stops.slice(1); // delta toe, Sid

const path = (o: ScenarioOutcome) => o.route.legs.flatMap((l) => l.path);
const oldPathAhead = plan.legs.slice(1).flatMap((l) => l.path);

/** Checks every outcome must pass, whatever the scenario. */
function checkShape(o: ScenarioOutcome) {
  expect(o.position).toEqual(here);
  expect(o.startSec).toBe(T);
  expect(o.keptStops.length + o.droppedStops.length).toBe(o.before.stopCount);
  expect([...o.keptStops, ...o.droppedStops].map((s) => s.id)).toEqual(ahead.map((s) => s.id));
  // "before" is the same stops re-planned from here with no emergency: close to the old plan.
  expect(Math.abs(o.before.marginSec - plan.marginSec)).toBeLessThan(5 * 60);
  expect(o.marginMin).toBeCloseTo(o.after.marginSec / 60, 9);
  expect(o.abort.status).not.toBe("GO"); // Contract 3: return home is never GO
  expect(o.abort.reasons.length).toBeGreaterThan(0);
  expect(o.evaReasons.length).toBeGreaterThan(0);
  expect(o.shelter).toEqual({ checked: false });
  // The new route starts where the astronaut is and ends at the habitat.
  expect(o.route.legs[0].path[0]).toEqual({ lat: here.lat, lng: here.lng });
  const last = o.route.legs[o.route.legs.length - 1].path;
  expect(last[last.length - 1]).toEqual({ lat: site.habitat.lat, lng: site.habitat.lng });
  if (o.aborted) {
    expect(o.evaStatus).toBe("NO-GO");
    expect(o.evaReasons[0]).toMatch(/^EVA aborted: /);
    expect(o.returnRoute.path).toEqual(o.abort.path);
    expect(o.after.marginSec).toBe(o.abort.marginSec);
  } else {
    expect(o.evaStatus).toBe(o.route.status);
    expect(o.after.marginSec).toBe(o.route.marginSec);
    expect(o.after.marginSec).toBeGreaterThanOrEqual(0);
    expect(o.arriveSec).toBeCloseTo(T + o.route.totalSec, 6);
  }
}

describe("oxygen-loss", () => {
  const mild = oxygenLossAt(site, plan, T, { ...opts, lossFraction: 0.1 });
  const severe = oxygenLossAt(site, plan, T, { ...opts, lossFraction: 0.7 });
  const total = oxygenLossAt(site, plan, T, { ...opts, lossFraction: 0.95 });

  it("has the shared outcome shape", () => {
    for (const o of [mild, severe, total]) checkShape(o);
    expect(oxygenLossAt(site, plan, T, opts).evaReasons[0]).toContain("25% of the oxygen left");
  });

  it("recomputes oxygen: the lost share comes off the oxygen left", () => {
    const full = CONSUMABLE_HOURS * 3600;
    const left = full - here.oxygenUsedSec;
    expect(mild.oxygenNowPct).toBeCloseTo(((left * 0.9) / full) * 100, 6);
    expect(severe.oxygenNowPct).toBeCloseTo(((left * 0.3) / full) * 100, 6);
    // Same route as before, so the new margin is the old one minus exactly the oxygen lost.
    expect(mild.droppedStops).toEqual([]);
    expect(mild.after.marginSec).toBeCloseTo(mild.before.marginSec - left * 0.1, 3);
  });

  it("mild case keeps all stops; the route ahead is the same, the margin smaller", () => {
    expect(mild.keptStops.map((s) => s.id)).toEqual(ahead.map((s) => s.id));
    expect(mild.aborted).toBe(false);
    expect(mild.after.marginSec).toBeLessThan(mild.before.marginSec);
  });

  it("severe case drops stops from the end and the status uses the new margin", () => {
    expect(severe.droppedStops.length).toBeGreaterThan(0);
    expect(severe.droppedStops[severe.droppedStops.length - 1].id).toBe(stops[2].id);
    expect(severe.evaReasons.some((r) => r.startsWith("Dropped "))).toBe(true);
    expect(path(severe)).not.toEqual(oldPathAhead);
    // The new margin is low, so Contract 3 makes the plan at least CAUTION (or aborted).
    expect(["CAUTION", "NO-GO"]).toContain(severe.evaStatus);
  });

  it("losing nearly everything aborts the EVA: straight home, NO-GO", () => {
    expect(total.aborted).toBe(true);
    expect(total.keptStops).toEqual([]);
    expect(total.evaStatus).toBe("NO-GO");
    expect(total.abort.status).toBe(total.abort.marginSec < 0 ? "NO-GO" : "CAUTION");
    expect(total.abort.marginSec).toBeLessThan(0);
    expect(total.abort.status).toBe("NO-GO");
  });
});

describe("recommendation: continue or return home", () => {
  it("a healthy re-plan keeps going: recommendation continue, no alternative", () => {
    for (const o of [oxygenLossAt(site, plan, T, opts), slowWalkAt(site, plan, T, opts), blockedPathAt(site, plan, T, opts)]) {
      expect(o.recommendation).toBe("continue");
      expect(o.alternative).toBeNull();
      expect(o.aborted).toBe(false);
      expect(o.droppedStops).toEqual([]);
    }
  });

  it("a thin margin sends her home, and keeps continuing as the alternative with its margin", () => {
    const o = oxygenLossAt(site, plan, T, { ...opts, lossFraction: 0.5 });
    expect(o.recommendation).toBe("return home");
    expect(o.aborted).toBe(true);
    expect(o.evaStatus).toBe("NO-GO"); // Contract 3: the EVA is aborted
    expect(o.abort.status).toBe("CAUTION"); // the walk home is never GO
    expect(o.keptStops).toEqual([]);
    expect(o.returnRoute.path).toEqual(o.abort.path);
    expect(o.after.marginSec).toBe(o.abort.marginSec);
    const alt = o.alternative!;
    expect(alt.stops.map((s) => s.id)).toEqual([stops[1].id]);
    expect(alt.route.ok).toBe(true);
    expect(alt.marginSec).toBe(alt.route.marginSec);
    expect(alt.marginSec).toBeGreaterThanOrEqual(0);
    expect(alt.marginSec).toBeLessThan(o.abort.marginSec);
    expect(["GO", "CAUTION"]).toContain(alt.status);
    expect(o.evaReasons.some((r) => r.startsWith("Returning home is safer"))).toBe(true);
  });

  it("when no stop fits at all there is nothing to offer as an alternative", () => {
    const o = oxygenLossAt(site, plan, T, { ...opts, lossFraction: 0.7 });
    expect(o.recommendation).toBe("return home");
    expect(o.alternative).toBeNull();
  });

  it("never recommends continuing with less margin than one more reserve", () => {
    for (let f = 0.05; f < 1; f += 0.05) {
      for (const t of [600, T, 7200, 10800]) {
        const o = oxygenLossAt(site, plan, t, { ...opts, lossFraction: f });
        if (o.recommendation === "continue" && o.keptStops.length > 0) {
          expect(o.after.marginSec).toBeGreaterThanOrEqual(45 * 60);
        }
        if (o.alternative) expect(o.alternative.marginSec).toBeLessThan(o.abort.marginSec);
      }
    }
  });
});

describe("slow-walk", () => {
  const mild = slowWalkAt(site, plan, T, { ...opts, speedFactor: 0.9 });
  const severe = slowWalkAt(site, plan, T, { ...opts, speedFactor: 0.15 });

  it("has the shared outcome shape", () => {
    checkShape(mild);
    checkShape(severe);
    expect(slowWalkAt(site, plan, T, opts).evaReasons[0]).toContain("70% of normal");
  });

  it("slowedGrid makes every passable cell slower by 1 / factor", () => {
    const g = slowedGrid(calm, 0.7);
    expect(g).not.toBe(calm);
    const i = cellIndexOf(site, site.habitat);
    expect(g.secPerM[i]).toBeCloseTo(calm.secPerM[i] / 0.7, 5);
    expect(calm.secPerM[i]).toBe(buildCostGrid(site, CALM).secPerM[i]); // base untouched
  });

  it("mild case keeps all stops; the timeline gets longer and oxygen is recomputed", () => {
    expect(mild.droppedStops).toEqual([]);
    const oldRest = plan.totalSec - T;
    expect(mild.route.totalSec).toBeGreaterThan(oldRest);
    expect(mild.arriveSec).toBeGreaterThan(plan.totalSec);
    expect(mild.after.marginSec).toBeLessThan(plan.marginSec);
    expect(mild.route.oxygenUsedSec).toBeGreaterThan(plan.oxygenUsedSec);
  });

  it("severe case drops stops, and the return home is slower than calm", () => {
    expect(severe.droppedStops.length).toBeGreaterThan(0);
    const calmHome = abortRoute(site, calm, here, here.oxygenUsedSec);
    expect(severe.abort.sec).toBeGreaterThan(calmHome.sec);
    expect(severe.after.stopCount).toBe(severe.keptStops.length);
  });
});

describe("blocked-path", () => {
  const mild = blockedPathAt(site, plan, T, opts); // default: 75 m on the leg being walked
  // Block the last stop (Sid, 96 m from the habitat): it cannot be reached, so it is dropped.
  const severe = blockedPathAt(site, plan, T, { ...opts, blockAt: stops[2], blockRadiusM: 30 });
  // Block everything around the habitat: no way home at all.
  const cutOff = blockedPathAt(site, plan, T, { ...opts, blockAt: site.habitat, blockRadiusM: 400 });

  it("has the shared outcome shape", () => {
    checkShape(mild);
    checkShape(severe);
    expect(mild.blocked!.radiusM).toBe(75);
    expect(mild.blocked!.cellCount).toBeGreaterThan(0);
  });

  it("blockedGrid marks cells within the radius no-go and leaves the base grid alone", () => {
    const { grid, cellCount } = blockedGrid(site, calm, stops[1], 75);
    expect(cellCount).toBeGreaterThan(0);
    expect(grid.secPerM[cellIndexOf(site, stops[1])]).toBe(Infinity);
    expect(calm.secPerM[cellIndexOf(site, stops[1])]).not.toBe(Infinity);
  });

  it("mild case keeps all stops; the route detours and the margin is compared", () => {
    expect(mild.droppedStops).toEqual([]);
    expect(path(mild)).not.toEqual(oldPathAhead);
    expect(mild.after.endSec).toBeGreaterThan(mild.before.endSec);
    expect(mild.after.marginSec).toBeLessThan(mild.before.marginSec);
  });

  it("severe case drops the unreachable stop and keeps the one before it", () => {
    expect(severe.droppedStops.map((s) => s.id)).toEqual([stops[2].id]);
    expect(severe.keptStops.map((s) => s.id)).toEqual([stops[1].id]);
    expect(severe.evaStatus).toBe(severe.route.status);
  });

  it("no way home: aborted, EVA NO-GO and return home NO-GO", () => {
    expect(cutOff.aborted).toBe(true);
    expect(cutOff.evaStatus).toBe("NO-GO");
    expect(cutOff.abort.status).toBe("NO-GO");
    expect(cutOff.abort.path).toEqual([]);
    expect(cutOff.oxygenOnArrivalPct).toBeNaN();
  });
});

describe("other moments and the existing emergencies", () => {
  it("never throws or returns NaN margins over the whole timeline", () => {
    for (const kind of ["oxygen-loss", "blocked-path", "slow-walk"] as const) {
      for (let t = 0; t <= plan.totalSec; t += 1800) {
        const o = scenarioAt(site, plan, t, kind, opts);
        expect(Number.isNaN(o.after.marginSec)).toBe(false);
        expect(o.keptStops.length + o.droppedStops.length).toBe(o.before.stopCount);
      }
    }
  });

  it("during science the current stop keeps only its remaining time", () => {
    const t = plan.legs[0].arriveSec + 10 * 60; // 10 min into the 30 min at stop 1
    const o = slowWalkAt(site, plan, t, { ...opts, speedFactor: 0.95 });
    expect(o.before.stopCount).toBe(3);
    expect(o.route.workSec).toBeCloseTo((20 + 30 + 30) * 60, 3);
  });

  it("dust storm and SPE outcomes are unchanged", () => {
    const dust = stormAt(site, plan, T, "dust", 13);
    expect(dust.evaStatus).toBe("NO-GO");
    expect(dust.evaReasons[0]).toBe("EVA aborted: active dust storm");
    expect(dust.abort.status).toBe("CAUTION");
  });

  it("prints the demo numbers for each scenario", () => {
    for (const o of [oxygenLossAt(site, plan, T, opts), blockedPathAt(site, plan, T, opts), slowWalkAt(site, plan, T, opts)]) {
      console.log(
        `${o.kind} at T+1:16: EVA ${o.evaStatus}, kept ${o.keptStops.length}, dropped ${o.droppedStops.length}, ` +
          `margin ${formatMinutes(o.before.marginSec)} -> ${formatMinutes(o.after.marginSec)}, return home ${o.abort.status}`,
      );
    }
    expect(RESERVE_MIN).toBe(45);
  });
});
