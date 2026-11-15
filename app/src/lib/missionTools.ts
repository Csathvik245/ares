// The Mission tools row's one piece of memory: has this browser already seen the
// What if? button pulse? No React here, so tests can use it directly.

export const WHAT_IF_PULSE_KEY = "ares.whatIfPulseSeen";
/** The part of localStorage this needs (so a test can pass its own). */
export type PulseStore = Pick<Storage, "getItem" | "setItem">;

// If storage cannot be used (private mode, blocked, full), remember for this page load only.
let seenThisPageLoad = false;

const browserStore = (): PulseStore | null => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
};

/** Should the What if? button pulse? Only the first time a plan exists in this browser. */
export function whatIfPulseNeeded(store: PulseStore | null = browserStore()): boolean {
  if (seenThisPageLoad) return false;
  try {
    return store ? store.getItem(WHAT_IF_PULSE_KEY) !== "1" : true;
  } catch {
    return true;
  }
}

/** Remember that the pulse was shown. Never throws. */
export function rememberWhatIfPulse(store: PulseStore | null = browserStore()): void {
  seenThisPageLoad = true;
  try {
    store?.setItem(WHAT_IF_PULSE_KEY, "1");
  } catch {
    // Storage failed: the page-load memory above still stops a second pulse until a reload.
  }
}

/** For tests: forget the page-load memory. */
export function resetPulseMemoryForTests(): void {
  seenThisPageLoad = false;
}
