// stormAt on the real demo mission (app/public/data/site.json).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CONSUMABLE_HOURS,
  WALK_BURN,
  abortRoute,
  buildCostGrid,
  formatMet,
  formatMinutes,
  formatPct,
  loadSite,
  planRoute,
  positionAt,
  stormAt,
} from "./index";
import type { Conditions, Stop } from "./index";

const site = loadSite(JSON.parse(readFileSync(fileURLToPath(new URL("../../public/data/site.json", import.meta.url)), "utf8")));
const CALM: Conditions = { storm: false, spe: false, startLmst: 13 };
const stops: Stop[] = site.pois
  .filter((p) => p.kind === "science")
  .slice(0, 3)
  .map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin: 30 }));
const plan = planRoute(site, buildCostGrid(site, CALM), site.habitat, stops);
const T_STORM = 1 * 3600 + 16 * 60; // T+1:16
const BUDGET = CONSUMABLE_HOURS * 3600;

describe("stormAt: dust storm on leg 2 of the demo mission at T+1:16", () => {
  const out = stormAt(site, plan, T_STORM, "dust", CALM.startLmst);
  const here = positionAt(plan, T_STORM);

  it("T+1:16 is on leg 2, walking to the delta front toe", () => {
    expect(plan.status).toBe("GO");
    expect(formatMet(T_STORM)).toBe("T+1:16");
    expect(out.position).toEqual(here);
    expect(here).toMatchObject({ phase: "walk", legIndex: 1 });
  });

  it("EVA is NO-GO with the abort reason first", () => {
    expect(out.evaStatus).toBe("NO-GO");
    expect(out.evaReasons[0]).toBe("EVA aborted: active dust storm");
  });

  it("Return home is CAUTION, and its numbers match abortRoute", () => {
    const stormGrid = buildCostGrid(site, { ...CALM, storm: true });
    const direct = abortRoute(site, stormGrid, here, here.oxygenUsedSec);
    expect(out.abort.status).toBe("CAUTION");
    expect(out.abort.status).toBe(direct.status);
    expect(out.abort.sec).toBeCloseTo(direct.sec, 6);
    expect(out.abort.marginSec).toBeCloseTo(direct.marginSec, 6);
    expect(out.abort.reasons).toEqual(direct.reasons);
    expect(out.abort.path).toEqual(direct.path);
    expect(out.abort.path[0]).toEqual({ lat: here.lat, lng: here.lng });
    expect(out.abort.path[out.abort.path.length - 1]).toEqual({ lat: site.habitat.lat, lng: site.habitat.lng });

    expect(out.walkHomeMin).toBeCloseTo(direct.sec / 60, 9);
    expect(out.marginMin).toBeCloseTo(direct.marginSec / 60, 9);
    expect(out.marginMin).toBeGreaterThan(0);
    expect(out.arriveSec).toBeCloseTo(T_STORM + direct.sec, 6);
    expect(out.abort.reasons[0]).toContain(formatMinutes(direct.marginSec));
  });

  it("oxygen percentages follow from the same numbers", () => {
    expect(out.oxygenNowPct).toBeCloseTo(((BUDGET - here.oxygenUsedSec) / BUDGET) * 100, 9);
    expect(out.oxygenOnArrivalPct).toBeCloseTo(((BUDGET - here.oxygenUsedSec - out.abort.sec * WALK_BURN) / BUDGET) * 100, 9);
    expect(out.oxygenOnArrivalPct).toBeLessThan(out.oxygenNowPct);
    // Margin = oxygen on arrival minus the storm reserve (45 + 30 min).
    expect(out.marginMin).toBeCloseTo((out.oxygenOnArrivalPct / 100) * (BUDGET / 60) - 75, 6);
    console.log(
      `storm at ${formatMet(T_STORM)}: EVA ${out.evaStatus}; return home ${out.abort.status}, walk ${formatMinutes(out.abort.sec)}, ` +
        `margin ${formatMinutes(out.abort.marginSec)}, arrive ${formatMet(out.arriveSec)}, ` +
        `oxygen now ${formatPct(out.oxygenNowPct)}, on arrival ${formatPct(out.oxygenOnArrivalPct)}`,
    );
  });

  it("walking home in a storm is slower than in calm air", () => {
    const calmAbort = abortRoute(site, buildCostGrid(site, CALM), here, here.oxygenUsedSec);
    expect(out.abort.sec).toBeGreaterThan(calmAbort.sec);
  });
});

describe("stormAt: solar particle event (Contract 3)", () => {
  const out = stormAt(site, plan, T_STORM, "spe", CALM.startLmst);
  const here = positionAt(plan, T_STORM);

  it("EVA is NO-GO with the SPE abort reason; return home is CAUTION", () => {
    expect(out.evaStatus).toBe("NO-GO");
    expect(out.evaReasons[0]).toBe("EVA aborted: active solar particle event");
    expect(out.abort.status).toBe("CAUTION");
    expect(out.abort.reasons.join(" ")).toMatch(/solar particle event/i);
  });

  it("an SPE does not slow walking or add reserve, so it matches a calm-air abort", () => {
    const calmAbort = abortRoute(site, buildCostGrid(site, CALM), here, here.oxygenUsedSec);
    expect(out.abort.sec).toBeCloseTo(calmAbort.sec, 6);
    expect(out.abort.marginSec).toBeCloseTo(calmAbort.marginSec, 6);
    const dust = stormAt(site, plan, T_STORM, "dust", CALM.startLmst);
    expect(out.marginMin).toBeGreaterThan(dust.marginMin);
  });
});

describe("stormAt: other moments", () => {
  it("return home is never GO, at any time, for either emergency", () => {
    for (const kind of ["dust", "spe"] as const) {
      for (let t = 0; t <= plan.totalSec; t += 600) {
        const out = stormAt(site, plan, t, kind, CALM.startLmst);
        expect(out.evaStatus).toBe("NO-GO");
        expect(out.abort.status).toBe(out.abort.marginSec < 0 ? "NO-GO" : "CAUTION");
        expect(out.arriveSec).toBeCloseTo(t + out.abort.sec, 6);
      }
    }
  });

  it("at the habitat (start of the EVA) the walk home is zero", () => {
    const out = stormAt(site, plan, 0, "dust", CALM.startLmst);
    expect(out.walkHomeMin).toBeCloseTo(0, 6);
    expect(out.oxygenNowPct).toBeCloseTo(100, 9);
    expect(out.oxygenOnArrivalPct).toBeCloseTo(100, 6);
  });

  it("with too little oxygen left, return home is NO-GO", () => {
    // Same route, but 2 h 30 min of science at each stop: by late in the EVA the reserve is gone.
    const longStops = stops.map((s) => ({ ...s, dwellMin: 150 }));
    const longPlan = planRoute(site, buildCostGrid(site, CALM), site.habitat, longStops);
    const late = stormAt(site, longPlan, longPlan.legs[2].arriveSec + 140 * 60, "dust", CALM.startLmst);
    expect(late.marginMin).toBeLessThan(0);
    expect(late.abort.status).toBe("NO-GO");
    expect(late.evaStatus).toBe("NO-GO");
  });

  it("an empty plan is handled: the astronaut is at the habitat", () => {
    const empty = planRoute(site, buildCostGrid(site, CALM), site.habitat, []);
    const out = stormAt(site, empty, 0, "dust", CALM.startLmst);
    expect(out.evaStatus).toBe("NO-GO");
    expect(out.abort.status).toBe("CAUTION");
    expect(out.walkHomeMin).toBeCloseTo(0, 6);
  });
});
