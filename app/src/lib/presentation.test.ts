import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  loadSite,
  buildCostGrid,
  planRoute,
  positionAt,
  polylineLengthM,
  abortRoute,
} from "./planner";
import { returnPlaybackPlan } from "./return-playback";
import { demoStopsFromSite } from "./data";
import { clock, lmst, routeParts, routeHeading, minutes } from "./presentation";
const site = loadSite(
  JSON.parse(
    readFileSync(
      new URL("../../public/data/site.json", import.meta.url),
      "utf8",
    ),
  ),
);
const plan = planRoute(
  site,
  buildCostGrid(site, { storm: false, spe: false, startLmst: 13 }),
  site.habitat,
  demoStopsFromSite(site),
);
describe("route presentation", () => {
  it("splits at the same position as playback without losing route geometry", () => {
    for (const time of [
      0,
      plan.legs[0].walkSec / 2,
      plan.legs[0].arriveSec + 600,
      4560,
      plan.totalSec,
    ]) {
      const parts = routeParts(plan, time);
      const length = [...parts.walked, ...parts.cancelled].reduce(
        (sum, p) => sum + polylineLengthM(p),
        0,
      );
      expect(length).toBeCloseTo(
        plan.legs.reduce((s, l) => s + polylineLengthM(l.path), 0),
        1,
      );
      if (
        positionAt(plan, time).phase === "walk" &&
        time > 0 &&
        time < plan.totalSec
      ) {
        expect(parts.walked.at(-1)?.at(-1)).toMatchObject({
          lat: positionAt(plan, time).lat,
          lng: positionAt(plan, time).lng,
        });
      }
    }
  });
  it("formats duration and wraps LMST through midnight", () => {
    expect(clock(Infinity)).toBe("—");
    expect(clock(4560)).toBe("1:16");
    expect(lmst(25.5)).toBe("01:30");
  });
  it("points along the next route segment", () => {
    expect(
      routeHeading(
        [
          { lat: 18, lng: 77 },
          { lat: 18.01, lng: 77 },
        ],
        { lat: 18.005, lng: 77 },
      ),
    ).toBeCloseTo(0);
    expect(routeHeading([], { lat: 18, lng: 77 })).toBe(0);
  });
});

it("uses the supplied storm scenario without fixed display values", () => {
  const incident = positionAt(plan, 4560);
  expect(incident.legIndex).toBe(1);
  expect(incident.phase).toBe("walk");
  const cost = buildCostGrid(site, { storm: true, spe: false, startLmst: 13 });
  const eva = planRoute(site, cost, site.habitat, demoStopsFromSite(site));
  const abort = abortRoute(site, cost, incident, incident.oxygenUsedSec);
  const returning = returnPlaybackPlan(abort, incident.oxygenUsedSec, true)!;
  expect(eva.status).toBe("NO-GO");
  expect(abort.status).toBe("CAUTION");
  expect(Math.round(abort.sec / 60)).toBe(57);
  expect(Math.round(returning.oxygenAtReturnPct)).toBe(66);
});

it("uses identical nearest-minute rounding in panel and HUD values", () => {
  for (const seconds of [0, 2279, 2280, 2310, Infinity, -90]) {
    expect(minutes(seconds)).toBe(
      Number.isFinite(seconds) ? String(Math.round(seconds / 60)).replace("-", "−") : "—",
    );
  }
});
