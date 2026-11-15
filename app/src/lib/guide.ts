// The user guide's words, its tour of the Plan view, and the "have they seen the hint"
// memory. No React here, so tests can use it directly.
//
// Numbers in the guide are never typed: the reserve comes from the planner's RESERVE_MIN,
// the number of simulated walks from DEFAULT_TRIALS, the demo's step count from the guided
// demo, and the sample oxygen bar from planRoute on the real demo mission.
import { RESERVE_MIN, buildCostGrid, formatMinutes, oxygenBudget, planRoute, type Evidence, type Site, type Status, type Stop } from "../planner";
import { DEFAULT_TRIALS } from "../planner/montecarlo";
import { GUIDED_STEP_COUNT } from "./guided-demo";

/** The reserve and the number of simulated walks, as the app shows them. */
export const GUIDE_RESERVE = formatMinutes(RESERVE_MIN * 60);
export const GUIDE_TRIALS = DEFAULT_TRIALS.toLocaleString("en-US");

export const GUIDE_TITLE = "How to use ARES";
export const GUIDE_HINT_TEXT = "New here? Start with the guide.";
export const PLAY_HINT_TEXT = "Press Play to watch the walk";

// ---- The four tabs ----
export const GUIDE_TABS = [
  { id: "start", label: "Get started" },
  { id: "screen", label: "Read the screen" },
  { id: "colours", label: "What the colours mean" },
  { id: "words", label: "Words" },
] as const;
export type GuideTab = (typeof GUIDE_TABS)[number]["id"];

/** The tab an arrow key moves to. It wraps round at both ends; any other key keeps the tab. */
export function guideTabAfterKey(current: GuideTab, key: string): GuideTab {
  const i = GUIDE_TABS.findIndex((t) => t.id === current);
  const n = GUIDE_TABS.length;
  if (key === "ArrowRight") return GUIDE_TABS[(i + 1) % n].id;
  if (key === "ArrowLeft") return GUIDE_TABS[(i + n - 1) % n].id;
  if (key === "Home") return GUIDE_TABS[0].id;
  if (key === "End") return GUIDE_TABS[n - 1].id;
  return current;
}

// ---- 1. Get started: four cards, each does what it says ----
export type GuideAction = "demo" | "load" | "emergency" | "whatif";
export const GUIDE_CARDS: { id: GuideAction; title: string; line: string }[] = [
  { id: "demo", title: `Watch the ${GUIDED_STEP_COUNT}-step demo`, line: "A guided tour of one Mars walk: the plan, the check, a storm, the way home." },
  { id: "load", title: "Load the demo mission", line: "Three science stops on real terrain. Then press Play to watch the walk." },
  { id: "emergency", title: "Throw an emergency at it", line: "Pick a dust storm or an oxygen loss, and watch ARES re-plan." },
  { id: "whatif", title: "Change the assumptions", line: "Move the What if? sliders: less oxygen, a slower walk, a bigger reserve." },
];
export const GUIDE_SCIENCE_LINE = "Then open the Science tab to see how we checked it";

// ---- 2. Read the screen: the spotlight tour of the real Plan view ----
export type TourStop = {
  id: string;
  /** Short name, for the preview strip. */
  label: string;
  /** What to light up: every element matching this, taken together. */
  selector: string;
  /** Keep the lit area inside this element (for things that run past the map's edge). */
  clip?: string;
  /** Which tablet console tab shows it ("Map" or "Plan"; "Plan" is the Mission sheet). */
  consoleTab: "Map" | "Plan";
  text: string;
};
export const TOUR_STOPS: TourStop[] = [
  { id: "status", label: "Mission status", selector: '[data-tour="status"]', consoleTab: "Plan", text: "One word: GO, CAUTION or NO-GO, with the reason for it. Read this first." },
  { id: "stops", label: "Stops list", selector: '[data-tour="stops"]', consoleTab: "Plan", text: "The science stops in walking order, each with its arrival time and science value." },
  { id: "oxygen", label: "Oxygen", selector: '[data-tour="oxygen"]', consoleTab: "Plan", text: "The oxygen left when she gets home. The hatched end of the bar is the reserve. The tiles give distance, time, margin and dose." },
  { id: "route", label: "The route", selector: ".leaflet-routes-pane path.route-line", clip: '[data-tour="map"]', consoleTab: "Map", text: "The white line is the fastest safe route: from the habitat to each stop, and home." },
  { id: "zone", label: "Safe-return edge", selector: ".safe-zone", clip: '[data-tour="map"]', consoleTab: "Map", text: "The blue edge shows where she could still detour after her last stop and get home with the reserve. Ground outside it is dimmed." },
  { id: "probe", label: "Hover box", selector: '[data-tour="map"]', consoleTab: "Map", text: "Move your mouse over the map. A small box says whether the ground is walkable, and why not if it is off-limits." },
  { id: "emergency", label: "Emergencies", selector: '[data-tour="emergency"]', consoleTab: "Plan", text: "Pick an emergency and press Trigger. ARES re-plans from where she is standing." },
  { id: "timeline", label: "Timeline and Play", selector: '[data-tour="timeline"]', consoleTab: "Map", text: "Press Play to watch the walk. The track shows walking in white and science in grey." },
  { id: "tools", label: "Mission tools", selector: '[data-tour="tools"]', consoleTab: "Plan", text: "Try What if? to see how our assumptions change the answer. Briefing prints a one-page plan. Share copies a link to this exact mission." },
];

/**
 * Where the tour goes next. `index` is the stop on screen (0 to 8); the result is the new
 * stop, or -1 when the tour is over (Skip, or Next on the last stop).
 */
export function tourAfter(index: number, action: "next" | "back" | "skip", count: number = TOUR_STOPS.length): number {
  if (action === "skip") return -1;
  if (action === "back") return Math.max(0, index - 1);
  return index + 1 >= count ? -1 : index + 1;
}

// ---- 3. What the colours mean ----
export const GUIDE_STATUSES: { status: Status; meaning: string }[] = [
  { status: "GO", meaning: "Safe, with oxygen to spare" },
  { status: "CAUTION", meaning: "Safe but tight, take care" },
  { status: "NO-GO", meaning: "Not safe, or walk aborted" },
];
/** Swatches drawn like the things on the map (the CSS matches the map's own colours). */
export const GUIDE_SWATCHES: { id: "route" | "home" | "zone" | "slow" | "nogo"; label: string }[] = [
  { id: "route", label: "Planned route" },
  { id: "home", label: "Route home in an emergency" },
  { id: "zone", label: "Blue edge: where she could still detour after her last stop and get home with the reserve" },
  { id: "slow", label: "Slow ground" },
  { id: "nogo", label: "Off-limits ground" },
];
/** The four evidence levels, each with an example from the app. */
export const GUIDE_TAGS: { level: Evidence; example: string }[] = [
  { level: "OBSERVED", example: "The slope of the ground, from the HiRISE terrain model." },
  { level: "CALCULATED", example: "The route, its time and the oxygen margin." },
  { level: "INTERPRETED", example: "A stop's science value, read from CRISM clay signals." },
  { level: "ASSUMED", example: `Walking speed in a suit, and the ${GUIDE_RESERVE} reserve.` },
];

/** The demo mission's oxygen numbers, for the sample bar. Null until the terrain has loaded. */
export function demoOxygenSample(site: Site | null, demoStops: Stop[]): { usedSec: number; marginSec: number; reserveSec: number; budgetSec: number } | null {
  if (!site || demoStops.length === 0) return null;
  const calm = { storm: false, spe: false, startLmst: 13 };
  const plan = planRoute(site, buildCostGrid(site, calm), site.habitat, demoStops);
  if (!plan.ok) return null;
  const budget = oxygenBudget(false);
  return { usedSec: plan.oxygenUsedSec, marginSec: plan.marginSec, reserveSec: budget.reserveSec, budgetSec: budget.budgetSec };
}

// ---- 4. Words: chips that flip to their meaning ----
export const GUIDE_WORDS: { word: string; meaning: string }[] = [
  { word: "EVA", meaning: "The astronaut's walk outside." },
  { word: "T+", meaning: "Time since leaving the habitat." },
  { word: "LMST", meaning: "Local Mars time." },
  { word: "SPE", meaning: "Solar particle event: a burst of radiation." },
  { word: "Reserve", meaning: `Oxygen kept back for emergencies (${GUIDE_RESERVE}).` },
  { word: "Margin", meaning: "Spare oxygen above the reserve." },
  { word: "No-go", meaning: "Ground too steep or rough to cross." },
  { word: "Safe-return zone", meaning: "Where she could still detour after her last stop and get home with the reserve." },
];

// ---- The first-visit hint: shown once, ever, if the browser lets us remember ----
export const GUIDE_HINT_KEY = "ares.guideHintSeen";
/** The part of localStorage the hint needs (so a test can pass its own). */
export type HintStore = Pick<Storage, "getItem" | "setItem">;

// If storage cannot be used (private mode, blocked, full), remember for this page load only.
let seenThisPageLoad = false;

const browserStore = (): HintStore | null => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
};

/** Should the "New here?" hint be shown? False once it has been seen. */
export function hintNeeded(store: HintStore | null = browserStore()): boolean {
  if (seenThisPageLoad) return false;
  try {
    return store ? store.getItem(GUIDE_HINT_KEY) !== "1" : true;
  } catch {
    return true;
  }
}

/** Remember that the hint was seen (clicked away, or the guide was opened). Never throws. */
export function rememberHint(store: HintStore | null = browserStore()): void {
  seenThisPageLoad = true;
  try {
    store?.setItem(GUIDE_HINT_KEY, "1");
  } catch {
    // Storage failed: the page-load memory above still stops it showing again until a reload.
  }
}

/** For tests: forget the page-load memory. */
export function resetHintMemoryForTests(): void {
  seenThisPageLoad = false;
}
