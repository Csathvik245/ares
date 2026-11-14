// Contract 3 status rules: low sun in planRoute, and abortRoute's status.
import { describe, expect, it } from "vitest";
import {
  SUN_CAUTION_DEG,
  abortRoute,
  buildCostGrid,
  cellCenter,
  envAt,
  loadSite,
  lowSunDuring,
  planRoute,
  sunElevationSeries,
} from "./index";
import type { Conditions, Site, Stop } from "./index";

/** A flat, firm 40 × 40 site with 25 m cells and the habitat in the middle. */
function flatSite(): Site {
  const size = 40;
  const count = size * size;
  const site = loadSite({
    name: "flat test site",
    bounds: { south: 0, north: size * 0.001, west: 0, east: size * 0.001 },
    width: size,
    height: size,
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
  site.habitat = { name: "HAB", ...cellCenter(site, 20 * size + 20) };
  return site;
}

const site = flatSite();
const stop = (dwellMin: number): Stop => ({ id: "s1", label: "Test stop", dwellMin, ...cellCenter(site, 20 * site.width + 30) });
const conditions = (startLmst: number, extra: Partial<Conditions> = {}): Conditions => ({ storm: false, spe: false, startLmst, ...extra });
const planAt = (startLmst: number, dwellMin: number, extra: Partial<Conditions> = {}) =>
  planRoute(site, buildCostGrid(site, conditions(startLmst, extra)), site.habitat, [stop(dwellMin)]);

/** LMST in the afternoon when the sun drops through 10° (found from the model, not hard-coded). */
const duskLmst = (() => {
  const series = sunElevationSeries(12, 12 * 3600, 60);
  return series.find((s) => s.sunElevationDeg < SUN_CAUTION_DEG)!.lmst;
})();

describe("index.ts exports the environment model", () => {
  it("envAt and sunElevationSeries are available from the planner entry point", () => {
    expect(envAt(12, false).sunElevationDeg).toBeGreaterThan(60);
    expect(sunElevationSeries(12, 120, 60)).toHaveLength(3);
  });
});

describe("planRoute: sun below 10° gives CAUTION (Contract 3)", () => {
  it("the sun drops below 10° late in the afternoon, before sunset", () => {
    expect(duskLmst).toBeGreaterThan(17);
    expect(duskLmst).toBeLessThan(18.7); // sunset is about 18:41 LMST at Ls 0
  });

  it("a start time near dusk returns CAUTION with a sun reason", () => {
    const plan = planAt(duskLmst - 0.25, 20); // starts 15 min before the sun reaches 10°
    expect(plan.marginSec).toBeGreaterThan(0.25 * (8 * 60 - 45) * 60); // plenty of oxygen
    expect(plan.status).toBe("CAUTION");
    expect(plan.reasons).toHaveLength(1);
    const reason = plan.reasons[0];
    expect(reason).toMatch(/low sun/i);
    expect(reason).toMatch(/below 10°/);
    expect(reason).toMatch(/\d\d:\d\d LMST/); // gives the time
    expect(reason).toMatch(/elevation \d+\.\d°/); // gives the elevation
    expect(reason).toMatch(/1[45] min into the EVA/);
    console.log(`dusk start ${(duskLmst - 0.25).toFixed(2)} h LMST → ${plan.status}: ${reason}`);
  });

  it("a midday start with the same stops does not", () => {
    const plan = planAt(12, 20);
    expect(plan.status).toBe("GO");
    expect(plan.reasons.join(" ")).not.toMatch(/sun/i);
    expect(lowSunDuring(12, plan.totalSec)).toBeNull();
  });

  it("an afternoon start is CAUTION only if the EVA runs on into low sun", () => {
    const short = planAt(15, 20); // back well before dusk
    expect(short.status).toBe("GO");
    const long = planAt(15, 200); // still out when the sun gets low
    expect(long.status).toBe("CAUTION");
    expect(long.reasons.join(" ")).toMatch(/low sun/i);
    expect(long.reasons.join(" ")).toMatch(/\d h \d\d min into the EVA/);
  });

  it("a start at night says the sun is low from the start and that it is dark", () => {
    const plan = planAt(2, 20);
    expect(plan.status).toBe("CAUTION");
    expect(plan.reasons.join(" ")).toMatch(/from the start/);
    expect(plan.reasons.join(" ")).toMatch(/darkness/);
    expect(plan.reasons.join(" ")).toMatch(/−\d+\.\d°/);
  });

  it("is listed alongside other CAUTION reasons", () => {
    const plan = planAt(duskLmst - 0.25, 20, { storm: true });
    expect(plan.status).toBe("CAUTION");
    expect(plan.reasons.join(" ")).toMatch(/storm/i);
    expect(plan.reasons.join(" ")).toMatch(/low sun/i);
  });

  it("NO-GO still wins over the sun CAUTION", () => {
    const plan = planAt(duskLmst - 0.25, 600); // 10 h of science does not fit in the oxygen budget
    expect(plan.marginSec).toBeLessThan(0);
    expect(plan.status).toBe("NO-GO");
    expect(plan.reasons.join(" ")).toMatch(/margin is negative/i);
  });

  it("an empty plan is not flagged, whatever the time", () => {
    const plan = planRoute(site, buildCostGrid(site, conditions(2)), site.habitat, []);
    expect(plan.status).toBe("GO");
  });

  it("lowSunDuring reports the first low moment and the lowest point", () => {
    const low = lowSunDuring(duskLmst - 0.5, 2 * 3600)!;
    expect(low.first.sunElevationDeg).toBeLessThan(SUN_CAUTION_DEG);
    expect(low.first.sunElevationDeg).toBeGreaterThan(SUN_CAUTION_DEG - 0.5);
    expect(low.first.tSec).toBeGreaterThan(25 * 60);
    expect(low.first.tSec).toBeLessThan(35 * 60);
    expect(low.lowest.tSec).toBe(2 * 3600); // the sun keeps sinking to the end
    expect(low.lowest.sunElevationDeg).toBeLessThan(0);
  });
});

describe("abortRoute status follows Contract 3", () => {
  const from = cellCenter(site, 20 * site.width + 35); // 375 m east of the habitat
  const calm = buildCostGrid(site, conditions(12));
  const storm = buildCostGrid(site, conditions(12, { storm: true }));
  const spe = buildCostGrid(site, conditions(12, { spe: true }));
  const hours = (h: number) => h * 3600;

  it("an active storm with enough oxygen is CAUTION, not NO-GO", () => {
    const abort = abortRoute(site, storm, from, hours(1));
    expect(abort.marginSec).toBeGreaterThan(0);
    expect(abort.status).toBe("CAUTION");
    expect(abort.reasons.join(" ")).toMatch(/dust storm active/i);
  });

  it("an active solar particle event with enough oxygen is CAUTION", () => {
    const abort = abortRoute(site, spe, from, hours(1));
    expect(abort.status).toBe("CAUTION");
    expect(abort.reasons.join(" ")).toMatch(/solar particle event/i);
  });

  it("a negative margin is NO-GO, storm or not, and the reasons say why", () => {
    const inStorm = abortRoute(site, storm, from, hours(7.5));
    expect(inStorm.marginSec).toBeLessThan(0);
    expect(inStorm.status).toBe("NO-GO");
    expect(inStorm.reasons[0]).toMatch(/not enough oxygen/i);
    expect(inStorm.reasons.join(" ")).toMatch(/dust storm active/i);

    const noStorm = abortRoute(site, calm, from, hours(7.5));
    expect(noStorm.status).toBe("NO-GO");
    expect(noStorm.reasons).toHaveLength(1);
  });

  it("a low but positive margin is CAUTION", () => {
    const abort = abortRoute(site, calm, from, hours(6.5));
    expect(abort.marginSec).toBeGreaterThan(0);
    expect(abort.status).toBe("CAUTION");
    expect(abort.reasons.join(" ")).toMatch(/margin on arrival is low/i);
  });

  it("no emergency and plenty of oxygen is GO", () => {
    const abort = abortRoute(site, calm, from, hours(1));
    expect(abort.status).toBe("GO");
    expect(abort.reasons).toHaveLength(1);
  });

  it("the status always matches the margin and conditions", () => {
    for (const grid of [calm, storm, spe]) {
      for (const used of [0, 2, 4, 6, 6.5, 7, 7.5, 8]) {
        const abort = abortRoute(site, grid, from, hours(used));
        const emergency = grid.conditions.storm || grid.conditions.spe;
        if (abort.marginSec < 0) expect(abort.status).toBe("NO-GO");
        else if (emergency) expect(abort.status).toBe("CAUTION");
        else expect(["GO", "CAUTION"]).toContain(abort.status);
        expect(abort.reasons.length).toBeGreaterThan(0);
      }
    }
  });
});
