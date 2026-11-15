// Guided demo checks, on the real site.json.
// The steps are driven against a small stand-in for MissionContext that keeps the same
// state and uses the same planner calls (planRoute, runEmergency, emergencyCourse), so
// "each step sets the right state" is checked without a browser.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildCostGrid, formatKm, formatMinutes, formatPct, loadSite, planRoute, readSkyView, stormAt, type Stop } from "../planner";
import { simulateMission } from "../planner/montecarlo";
import { emergencyCourse, runEmergency, type UiEmergencyKind } from "../lib/emergency-run";
import {
  GUIDED_STEP_COUNT,
  GUIDED_STORM_AT_SEC,
  guidedCaption,
  newDemoMemo,
  onGuidedDemoStart,
  settleStep,
  startGuidedDemo,
  type DemoMission,
} from "../lib/guided-demo";
import { GuidedDemoCard } from "./GuidedDemo";

const raw = JSON.parse(readFileSync(new URL("../../public/data/site.json", import.meta.url), "utf8"));
const site = loadSite(raw);
const skyView = readSkyView(raw);
const cost = buildCostGrid(site, { storm: false, spe: false, startLmst: 13 });
const demoStops: Stop[] = site.pois
  .filter((p) => p.kind === "science")
  .slice(0, 3)
  .map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin: 30 }));
const demoPlan = planRoute(site, cost, site.habitat, demoStops);

/** A stand-in for MissionContext with the same behaviour for the parts the demo uses. */
function fakeMission(): DemoMission & { log: string[] } {
  const m: DemoMission & { log: string[] } = {
    log: [],
    site,
    demo: demoStops,
    stops: [],
    plan: planRoute(site, cost, site.habitat, []),
    emergency: null,
    emergencyOutcome: null,
    abort: null,
    returnPlan: null,
    returnElapsed: 0,
    returnPlaying: false,
    reset() {
      m.log.push("reset");
      m.emergency = null;
      m.emergencyOutcome = null;
      m.abort = null;
      m.returnPlan = null;
      m.returnElapsed = 0;
      m.returnPlaying = false;
    },
    edit(next) {
      m.log.push(`edit:${next.length}`);
      m.stops = next;
      m.plan = planRoute(site, cost, site.habitat, next);
      m.reset();
    },
    loadDemo() {
      m.log.push("loadDemo");
      m.edit(demoStops.map((s) => ({ ...s })));
    },
    trigger(kind: UiEmergencyKind, at = 0) {
      m.log.push(`trigger:${kind}@${at}`);
      const outcome = runEmergency(site, m.plan!, at, kind, { startLmst: 13, skyView, stops: m.stops });
      const course = emergencyCourse(outcome, kind === "storm");
      m.emergency = { kind, at };
      m.emergencyOutcome = outcome;
      m.abort = course.abort;
      m.returnPlan = course.returnPlan;
      m.returnElapsed = 0;
      m.returnPlaying = false;
    },
    toggleReturnPlayback() {
      m.log.push("play");
      m.returnPlaying = !m.returnPlaying;
    },
  };
  return m;
}

/** Call settleStep until it says the step is ready, playing the return when it is running. */
function settle(step: number, m: DemoMission, memo = newDemoMemo()) {
  for (let i = 0; i < 500; i++) {
    if (settleStep(step, m, memo)) return memo;
    // What the app's playback timer does: 60 s of walking per tick, then stop at the end.
    if (m.returnPlaying && m.returnPlan) {
      m.returnElapsed = Math.min(m.returnPlan.totalSec, m.returnElapsed + 60);
      if (m.returnElapsed >= m.returnPlan.totalSec) m.returnPlaying = false;
    }
  }
  throw new Error(`step ${step} never settled`);
}

describe("guided demo steps", () => {
  it("has four steps", () => {
    expect(GUIDED_STEP_COUNT).toBe(4);
    expect(GUIDED_STORM_AT_SEC).toBe(4560);
  });

  it("step 1 loads the demo mission and the caption gives its distance and status", () => {
    const m = fakeMission();
    settle(1, m);
    expect(m.stops.map((s) => s.id)).toEqual(demoStops.map((s) => s.id));
    expect(m.emergency).toBeNull();
    expect(guidedCaption(1, m)).toBe(
      `ARES plans a ${formatKm(demoPlan.distM)} science walk to clay deposits seen from orbit. Status: ${demoPlan.status}.`,
    );
    expect(guidedCaption(1, m)).toContain("4.97 km");
    expect(guidedCaption(1, m)).toContain("Status: GO.");
  });

  it("step 2 keeps the calm demo plan and the caption gives the Monte Carlo count (seed 42)", () => {
    const m = fakeMission();
    const memo = settle(1, m);
    settle(2, m, memo);
    expect(m.emergency).toBeNull();
    expect(m.stops).toHaveLength(3);
    const r = simulateMission(site, demoPlan, { seed: 42 });
    expect(guidedCaption(2, m)).toBe(
      `${r.successCount.toLocaleString("en-US")} of 1,000 simulated versions of this walk return home with the oxygen reserve.`,
    );
    expect(guidedCaption(2, m)).toContain("1,000 of 1,000");
  });

  it("step 3 triggers the dust storm at T+1:16", () => {
    const m = fakeMission();
    const memo = settle(2, m);
    settle(3, m, memo);
    expect(m.emergency).toEqual({ kind: "storm", at: 4560 });
    expect(m.emergencyOutcome).toEqual(stormAt(site, demoPlan, 4560, "dust", 13, { skyView }));
    expect(m.returnElapsed).toBe(0);
    expect(m.log.filter((l) => l.startsWith("trigger"))).toEqual(["trigger:storm@4560"]);
    expect(guidedCaption(3, m)).toBe("Dust storm at T+1:16. ARES aborts the EVA and re-plans the walk home immediately.");
  });

  it("step 4 plays the return to the end and the caption gives oxygen and margin on arrival", () => {
    const m = fakeMission();
    const memo = settle(3, m);
    settle(4, m, memo);
    expect(m.returnElapsed).toBe(m.returnPlan!.totalSec);
    expect(m.returnPlaying).toBe(false);
    expect(m.log.filter((l) => l === "play")).toHaveLength(1);
    const storm = stormAt(site, demoPlan, 4560, "dust", 13, { skyView });
    expect(guidedCaption(4, m)).toBe(
      `Home with ${formatPct(storm.oxygenOnArrivalPct)} oxygen left: ${formatMinutes(storm.abort.marginSec)} above the reserve.`,
    );
    expect(guidedCaption(4, m)).toBe("Home with 66% oxygen left: 244 min above the reserve.");
  });

  it("going straight to step 4 works too, and a paused return is not restarted", () => {
    const m = fakeMission();
    const memo = newDemoMemo();
    for (let i = 0; i < 20 && !m.returnPlaying; i++) settleStep(4, m, memo);
    expect(m.returnPlaying).toBe(true);
    m.toggleReturnPlayback(); // the user pauses
    for (let i = 0; i < 5; i++) settleStep(4, m, memo);
    expect(m.returnPlaying).toBe(false);
  });

  it("starts cleanly when another emergency and other stops were already there", () => {
    const m = fakeMission();
    m.edit([demoStops[2], demoStops[0]]);
    m.trigger("spe", 1800);
    m.log.length = 0;
    const memo = settle(1, m);
    // First the plan is cleared (which also resets the emergency), then the demo is loaded.
    expect(m.log.slice(0, 3)).toEqual(["edit:0", "reset", "loadDemo"]);
    expect(m.emergency).toBeNull();
    expect(m.stops.map((s) => s.id)).toEqual(demoStops.map((s) => s.id));
    expect(guidedCaption(1, m)).toContain("4.97 km");
    // And the rest of the story still works from there.
    settle(4, m, memo);
    expect(guidedCaption(4, m)).toBe("Home with 66% oxygen left: 244 min above the reserve.");
  });

  it("Back from the storm to step 2 returns to the calm plan", () => {
    const m = fakeMission();
    const memo = settle(3, m);
    settle(2, m, memo);
    expect(m.emergency).toBeNull();
    expect(m.stops).toHaveLength(3);
    expect(guidedCaption(2, m)).toContain("simulated versions");
  });

  it("waits, without acting, while the site is still loading", () => {
    const m = fakeMission();
    m.site = null;
    expect(settleStep(1, m, newDemoMemo())).toBe(false);
    expect(m.log).toEqual([]);
    expect(guidedCaption(1, m)).toBe("Loading the mission…");
  });

  it("startGuidedDemo() tells the mounted card to open", () => {
    let started = 0;
    const off = onGuidedDemoStart(() => started++);
    startGuidedDemo();
    off();
    expect(started).toBe(1);
    // Pressed before the card is on screen: remembered, and delivered once when it mounts.
    startGuidedDemo();
    expect(started).toBe(1);
    const offLater = onGuidedDemoStart(() => started++);
    expect(started).toBe(2);
    offLater();
    const offAgain = onGuidedDemoStart(() => started++);
    expect(started).toBe(2);
    offAgain();
  });
});

describe("GuidedDemoCard", () => {
  const noop = () => {};
  it("shows the step, the caption and Back / Next / Exit", () => {
    const html = renderToStaticMarkup(<GuidedDemoCard step={2} caption="A caption." note="A note." onBack={noop} onNext={noop} onExit={noop} />);
    expect(html).toContain("Step 2 of 4");
    expect(html).toContain("A caption.");
    expect(html).toContain("A note.");
    for (const label of ["Back", "Next", "Exit"]) expect(html).toContain(`>${label}</button>`);
  });

  it("disables Back on step 1 and ends with 'Explore on your own'", () => {
    expect(renderToStaticMarkup(<GuidedDemoCard step={1} caption="" onBack={noop} onNext={noop} onExit={noop} />)).toMatch(/disabled=""[^>]*>Back/);
    const last = renderToStaticMarkup(<GuidedDemoCard step={4} caption="" onBack={noop} onNext={noop} onExit={noop} />);
    expect(last).toContain("Explore on your own");
    expect(last).not.toContain(">Next<");
    expect(last).not.toContain(">Exit<");
  });
});
