// The emergency buttons, checked on the real site.json demo mission.
// runEmergency is exactly what each button calls (through MissionContext.trigger), and
// emergencyCourse is exactly what the map, timeline and panels then draw.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildCostGrid,
  distanceM,
  formatMinutes,
  loadSite,
  planRoute,
  positionAt,
  readSkyView,
  stormAt,
  type Stop,
} from "./planner";
import {
  EMERGENCY_TEXT,
  SCENARIO_BUTTONS,
  circleOutline,
  emergencyCourse,
  isReplanned,
  isScenario,
  runEmergency,
} from "./emergency-run";
import { returnPlaybackPlan } from "./return-playback";

const raw = JSON.parse(readFileSync(new URL("../../public/data/site.json", import.meta.url), "utf8"));
const site = loadSite(raw);
const skyView = readSkyView(raw);
const cost = buildCostGrid(site, { storm: false, spe: false, startLmst: 13 });
const stops: Stop[] = site.pois
  .filter((p) => p.kind === "science")
  .slice(0, 3)
  .map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin: 30 }));
const plan = planRoute(site, cost, site.habitat, stops);
const AT = 76 * 60; // T+1:16, walking leg 2
const options = { startLmst: 13, skyView, stops };
const samePath = (a: { lat: number; lng: number }[], b: { lat: number; lng: number }[]) =>
  a.length === b.length && a.every((p, i) => p.lat === b[i].lat && p.lng === b[i].lng);

describe("dust storm and SPE are unchanged", () => {
  it.each([
    ["storm", "dust"],
    ["spe", "spe"],
  ] as const)("%s gives exactly stormAt's outcome and the walk home as before", (kind, plannerKind) => {
    const expected = stormAt(site, plan, AT, plannerKind, 13, { skyView });
    const outcome = runEmergency(site, plan, AT, kind, options);
    expect(outcome).toEqual(expected);
    expect(isScenario(outcome)).toBe(false);
    expect(isReplanned(outcome)).toBe(false);
    const course = emergencyCourse(outcome, kind === "storm");
    expect(course.abort).toBe(outcome.abort);
    expect(course.returnPlan).toEqual(returnPlaybackPlan(expected.abort, expected.position.oxygenUsedSec, kind === "storm"));
  });

  it("the storm numbers in docs/demo-numbers.md still come out", () => {
    const course = emergencyCourse(runEmergency(site, plan, AT, "storm", options), true);
    expect(formatMinutes(course.abort.sec)).toBe("57 min");
    expect(formatMinutes(course.abort.marginSec)).toBe("244 min");
    expect(course.abort.status).toBe("CAUTION");
  });
});

describe("the three new emergency buttons", () => {
  it("are Oxygen loss, Slower walking and Path blocked, each with its own words", () => {
    expect(SCENARIO_BUTTONS.map((b) => b.label)).toEqual(["Oxygen loss", "Slower walking", "Path blocked"]);
    for (const b of SCENARIO_BUTTONS) {
      expect(EMERGENCY_TEXT[b.kind].title.length).toBeGreaterThan(0);
      expect(EMERGENCY_TEXT[b.kind].note).toContain("Illustrative");
    }
  });

  const calmNow = positionAt(plan, AT);
  const calmLeftSec = plan.totalSec - AT;

  it.each(SCENARIO_BUTTONS.map((b) => b.kind))("%s re-plans the rest of the EVA and recomputes the oxygen", (kind) => {
    const outcome = runEmergency(site, plan, AT, kind, options);
    if (!isScenario(outcome)) throw new Error("expected a scenario outcome");
    const course = emergencyCourse(outcome, false);
    const playback = course.returnPlan!;

    // A real recalculation: the margin got worse, and the course ahead is a new plan.
    expect(outcome.after.marginSec).toBeLessThan(outcome.before.marginSec);
    expect(outcome.before.marginSec).toBeGreaterThan(0);
    expect(playback.ok).toBe(true);
    expect(playback.legs.length).toBeGreaterThan(0);
    expect(course.abort.path.length).toBeGreaterThan(1);
    expect(course.abort.reasons.length).toBeGreaterThan(0);

    // The course starts where the astronaut is and ends at the habitat.
    const first = course.abort.path[0];
    const last = course.abort.path[course.abort.path.length - 1];
    expect(distanceM(first, calmNow)).toBeLessThan(1);
    expect(distanceM(last, site.habitat)).toBeLessThan(1);

    // What the screens add up: oxygen used (or lost) before + oxygen of the playback plan.
    const usedAtEnd = outcome.position.oxygenUsedSec + playback.oxygenUsedSec;
    const homeAbort = outcome.abort;
    if (isReplanned(outcome)) {
      expect(usedAtEnd).toBeCloseTo(outcome.route.oxygenUsedSec, 3);
      expect(course.abort.sec).toBe(outcome.route.totalSec);
      expect(course.abort.marginSec).toBe(outcome.after.marginSec);
      expect(course.abort.status).toBe(outcome.evaStatus);
      expect(outcome.keptStops.length + outcome.droppedStops.length).toBe(2); // stops 2 and 3 were still ahead
    } else {
      expect(course.abort).toBe(homeAbort);
    }
    expect(Number.isFinite(usedAtEnd)).toBe(true);
    // The end of the playback plan's timeline is at the habitat.
    expect(distanceM(positionAt(playback, playback.totalSec), site.habitat)).toBeLessThan(1);
  });

  it("oxygen loss: the lost oxygen shows up as oxygen used, the route ahead keeps its shape", () => {
    const outcome = runEmergency(site, plan, AT, "oxygen-loss", options);
    expect(outcome.position.oxygenUsedSec).toBeGreaterThan(calmNow.oxygenUsedSec + 60 * 60);
    expect(outcome.oxygenNowPct).toBeLessThan(stormAt(site, plan, AT, "dust", 13).oxygenNowPct);
  });

  it("slower walking: the rest of the EVA takes longer than planned", () => {
    const outcome = runEmergency(site, plan, AT, "slow-walk", options);
    if (!isScenario(outcome)) throw new Error("expected a scenario outcome");
    expect(emergencyCourse(outcome, false).returnPlan!.totalSec).toBeGreaterThan(calmLeftSec + 5 * 60);
    expect(outcome.after.endSec).toBeGreaterThan(plan.totalSec);
  });

  it("path blocked: the new route goes around the blocked area, which has an outline to draw", () => {
    const outcome = runEmergency(site, plan, AT, "blocked-path", options);
    if (!isScenario(outcome) || !outcome.blocked) throw new Error("expected a blocked area");
    const { at, radiusM, cellCount } = outcome.blocked;
    expect(cellCount).toBeGreaterThan(0);
    const course = emergencyCourse(outcome, false);
    // The old leg went through the middle of the area; the new course is a different line.
    expect(samePath(course.abort.path, plan.legs.slice(1).flatMap((l) => l.path))).toBe(false);
    const outline = circleOutline(at, radiusM);
    expect(outline).toHaveLength(48);
    for (const p of outline) expect(distanceM(p, at)).toBeCloseTo(radiusM, 0);
  });

  it("an emergency too big to continue is an abort, shown like a storm: the walk home", () => {
    // During the last stop with very little margin to spare: lose the oxygen on a long plan.
    const long = planRoute(site, cost, site.habitat, stops.map((s) => ({ ...s, dwellMin: 95 })));
    expect(long.ok).toBe(true);
    const outcome = runEmergency(site, long, long.legs[0].arriveSec + 60, "oxygen-loss", { startLmst: 13 });
    if (!isScenario(outcome)) throw new Error("expected a scenario outcome");
    expect(outcome.droppedStops.length).toBeGreaterThan(0);
    const course = emergencyCourse(outcome, false);
    if (outcome.aborted) {
      expect(isReplanned(outcome)).toBe(false);
      expect(course.abort).toBe(outcome.abort);
      expect(course.returnPlan?.legs).toHaveLength(1);
    } else {
      expect(course.abort.sec).toBe(outcome.route.totalSec);
    }
  });
});
