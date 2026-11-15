// The guided demo: four steps that drive the real app through the demo story.
// This file holds the logic only (what each step needs, and its caption), so it can be
// tested without a browser. The card itself is components/GuidedDemo.tsx.
//
// Every number in a caption is read from the planner at run time and formatted with
// format.ts. Nothing here is typed by hand.
import { formatKm, formatMet, formatMinutes, formatPct, type Plan, type Site, type Stop, type StormOutcome, type AbortRoute } from "./planner";
import { simulateMission } from "../planner/montecarlo";
import type { UiEmergencyKind } from "./emergency-run";

export const GUIDED_STEP_COUNT = 4;
/** The dust storm of step 3 starts here: T+1:16, the demo emergency moment. */
export const GUIDED_STORM_AT_SEC = 76 * 60;
export const GUIDED_SEED = 42;

/** The part of MissionContext the guided demo reads and drives. */
export type DemoMission = {
  site: Site | null;
  /** The demo mission's stops (from site.json). */
  demo: Stop[];
  stops: Stop[];
  plan: Plan | null;
  emergency: { kind: UiEmergencyKind; at: number } | null;
  emergencyOutcome: StormOutcome | null;
  abort: AbortRoute | null;
  returnPlan: Plan | null;
  returnElapsed: number;
  returnPlaying: boolean;
  edit: (next: Stop[]) => void;
  loadDemo: () => void;
  reset: () => void;
  trigger: (kind: UiEmergencyKind, at?: number) => unknown;
  toggleReturnPlayback: () => void;
};

/** What the demo remembers between ticks of one run. */
export type DemoMemo = {
  /** True once the plan and any emergency were cleared at the start of a run. */
  cleared: boolean;
  /** True once step 4 has started the return playback (so a user pause is respected). */
  playedReturn: boolean;
};
export const newDemoMemo = (): DemoMemo => ({ cleared: false, playedReturn: false });

const demoLoaded = (m: DemoMission) =>
  m.demo.length > 0 && m.stops.length === m.demo.length && m.stops.every((s, i) => s.id === m.demo[i].id);
const demoStorm = (m: DemoMission) => m.emergency?.kind === "storm" && m.emergency.at === GUIDED_STORM_AT_SEC;
const returnDone = (m: DemoMission) => !!m.returnPlan && m.returnElapsed >= m.returnPlan.totalSec;

/**
 * Move the app one action closer to what `step` (1 to 4) needs, and say whether it is
 * there yet. Call it again after every state change until it returns true. It does at
 * most one thing per call, so it works from any starting state: an emergency already
 * running, other stops on the map, or nothing loaded.
 *
 *   start   any emergency reset and the plan cleared (once per run)
 *   step 1  the demo mission loaded, calm
 *   step 2  the same (the Monte Carlo runs in the caption)
 *   step 3  the dust storm triggered at T+1:16
 *   step 4  the storm, with the return walk played to the end
 */
export function settleStep(step: number, m: DemoMission, memo: DemoMemo): boolean {
  if (!m.site || m.demo.length === 0) return false; // data still loading
  if (!memo.cleared) {
    memo.cleared = true;
    if (m.emergency || m.stops.length > 0) {
      m.edit([]); // edit() also resets any emergency and the playback
      return false;
    }
  }
  if (step <= 2) {
    if (m.emergency) {
      m.reset();
      return false;
    }
    if (!demoLoaded(m)) {
      m.loadDemo();
      return false;
    }
    memo.playedReturn = false;
    return !!m.plan;
  }
  // Steps 3 and 4 need the demo storm and nothing else.
  if (m.emergency && !demoStorm(m)) {
    m.reset();
    return false;
  }
  if (!m.emergency) {
    if (!demoLoaded(m)) {
      m.loadDemo();
      return false;
    }
    if (!m.plan?.ok) return false;
    m.trigger("storm", GUIDED_STORM_AT_SEC);
    memo.playedReturn = false;
    return false;
  }
  if (step === 3) return true;
  if (returnDone(m)) return true;
  if (!memo.playedReturn && m.returnPlan && !m.returnPlaying) {
    memo.playedReturn = true;
    m.toggleReturnPlayback();
  }
  return false;
}

const WAIT = "Loading the mission…";

/** The caption for `step` (1 to 4), built from the planner's current numbers. */
export function guidedCaption(step: number, m: DemoMission): string {
  if (!m.site || !m.plan) return WAIT;
  if (step === 1) {
    if (!demoLoaded(m) || m.emergency) return WAIT;
    return `ARES plans a ${formatKm(m.plan.distM)} science walk to clay deposits seen from orbit. Status: ${m.plan.status}.`;
  }
  if (step === 2) {
    if (!demoLoaded(m) || m.emergency) return WAIT;
    const r = simulateMission(m.site, m.plan, { seed: GUIDED_SEED });
    return `${r.successCount.toLocaleString("en-US")} of ${r.trials.toLocaleString("en-US")} simulated versions of this walk return home with the oxygen reserve.`;
  }
  if (!demoStorm(m) || !m.emergencyOutcome || !m.abort) return WAIT;
  if (step === 3) {
    return `Dust storm at ${formatMet(m.emergency!.at)}. ARES aborts the EVA and re-plans the walk home immediately.`;
  }
  return `Home with ${formatPct(m.emergencyOutcome.oxygenOnArrivalPct)} oxygen left: ${formatMinutes(m.abort.marginSec)} above the reserve.`;
}

/** Step 2's caption is a simulation of our own assumptions; the card shows this under it. */
export const GUIDED_STEP_NOTES: Record<number, string> = {
  2: "Model-based simulation of our own assumptions, not an empirical mission success probability.",
};

// ---- A tiny switch, so anything (the Story tab's "Run demo" button) can start the demo ----
type Listener = () => void;
const listeners = new Set<Listener>();
let pendingStart = false;
/**
 * Start the guided demo from step 1. Safe to call from anywhere. If <GuidedDemo /> is not
 * on screen yet (for example the opening briefing still covers the console), the start is
 * remembered and happens as soon as the card mounts.
 */
export function startGuidedDemo(): void {
  if (listeners.size === 0) pendingStart = true;
  listeners.forEach((listener) => listener());
}
/** Used by <GuidedDemo />: run `listener` whenever startGuidedDemo() is called. Returns the unsubscribe. */
export function onGuidedDemoStart(listener: Listener): () => void {
  listeners.add(listener);
  if (pendingStart) {
    pendingStart = false;
    listener();
  }
  return () => {
    listeners.delete(listener);
  };
}
