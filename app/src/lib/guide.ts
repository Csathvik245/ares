// The user guide's words, and the "have they seen the hint" memory. No React here, so
// tests can use it directly.
//
// Numbers in the guide are never typed: the reserve comes from the planner's RESERVE_MIN
// and the number of simulated walks from DEFAULT_TRIALS, both through format.ts.
import { RESERVE_MIN, formatMinutes, type Evidence } from "../planner";
import { DEFAULT_TRIALS } from "../planner/montecarlo";
import { PLAIN_WORDS } from "../components/PlanChrome";

/** The reserve and the number of simulated walks, as the app shows them. */
export const GUIDE_RESERVE = formatMinutes(RESERVE_MIN * 60);
export const GUIDE_TRIALS = DEFAULT_TRIALS.toLocaleString("en-US");

export const GUIDE_HINT_TEXT = "New here? Start with the guide.";

/** a. START HERE. Step 1 carries the button that starts the guided demo. */
export const GUIDE_START: string[] = [
  'Press "Run the guided demo" for a 4-step tour.',
  'Or press "Load demo mission", then press Play to watch the walk.',
  "Try an emergency from the bottom of the left column and watch ARES re-plan.",
  "Open the Science tab to see how we checked it.",
];

/** b. HOW TO READ THE RESULTS. */
export const GUIDE_RESULTS: { term: string; meaning: string; tone?: "GO" | "CAUTION" | "NO-GO" }[] = [
  { term: "GO", tone: "GO", meaning: "Safe, with oxygen to spare." },
  { term: "CAUTION", tone: "CAUTION", meaning: "Safe but tight, or something is wrong but she can still get home." },
  { term: "NO-GO", tone: "NO-GO", meaning: "Not safe, or the walk has been aborted." },
  { term: "Oxygen bar", meaning: `White is oxygen used, blue is spare, and the hatched end is the ${GUIDE_RESERVE} reserve that must not be touched.` },
  { term: "Margin", meaning: "Spare oxygen above the reserve when she gets home." },
  { term: "Blue edge on the map", meaning: "Everywhere she could walk to and still get home." },
  { term: "Amber and red terrain", meaning: "Amber is slow ground. Red is off-limits ground." },
  { term: "Hover the map", meaning: "The small box says why a spot is off-limits, or what slows it down." },
  { term: "Mission reliability", meaning: `${GUIDE_TRIALS} simulated versions of the walk. It is model-based, not a measured probability.` },
];

/** c. WHAT THE TAGS MEAN: the four evidence levels, each with an example from the app. */
export const GUIDE_TAGS: { level: Evidence; meaning: string; example: string }[] = [
  { level: "OBSERVED", meaning: "Measured by an instrument.", example: "The slope of the ground, from the HiRISE terrain model." },
  { level: "CALCULATED", meaning: "Worked out by the planner from measured data and stated rules.", example: "The route, its time and the oxygen margin." },
  { level: "INTERPRETED", meaning: "A reading of measured data that depends on a judgement.", example: "A stop's science value, read from CRISM clay and carbonate signals." },
  { level: "ASSUMED", meaning: "Our own choice. Not measured.", example: `Walking speed in a suit, oxygen use, and the ${GUIDE_RESERVE} reserve.` },
];

/** d. WORDS YOU'LL SEE. The first five reuse the app's own (?) explanations. */
export const GUIDE_WORDS: { word: string; meaning: string }[] = [
  { word: "EVA", meaning: PLAIN_WORDS.EVA },
  { word: "T+", meaning: PLAIN_WORDS["T+"] },
  { word: "LMST", meaning: PLAIN_WORDS.LMST },
  { word: "SPE", meaning: PLAIN_WORDS.SPE },
  { word: "Reserve", meaning: `${PLAIN_WORDS.reserve} (${GUIDE_RESERVE})` },
  { word: "No-go", meaning: "ground the planner will not route across: too steep, too rough, or no data" },
  { word: "Margin", meaning: "spare oxygen above the reserve" },
];

export const GUIDE_SECTIONS = ["Start here", "How to read the results", "What the tags mean", "Words you'll see"] as const;

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
