// The three top-level pages of the app and how they map to the URL hash.
// No React here, so tests can use it directly.
import { startGuidedDemo } from "./guided-demo";

export const APP_TABS = [
  { id: "story", label: "Story" },
  { id: "plan", label: "Plan" },
  { id: "science", label: "Science" },
] as const;
export type AppTab = (typeof APP_TABS)[number]["id"];

/** "#science" → "science". Anything else (no hash, an unknown hash) → `fallback`. */
export function tabFromHash(hash: string | undefined | null, fallback: AppTab = "story"): AppTab {
  const name = (hash ?? "").replace(/^#/, "").toLowerCase();
  return APP_TABS.find((t) => t.id === name)?.id ?? fallback;
}
export const hashOfTab = (tab: AppTab) => `#${tab}`;

/**
 * "Run the demo", from anywhere: open the Plan tab, then start the guided demo at step 1.
 * The demo card lives on the Plan tab; if it is not on screen yet, startGuidedDemo()
 * remembers the request and the card opens as soon as it mounts.
 */
export function runDemo(go: (tab: AppTab) => void): void {
  go("plan");
  startGuidedDemo();
}

/** The names on the tablet's console tabs. The middle one is "Mission", so there is only one "Plan" on screen. */
export const CONSOLE_TABS = [
  { id: "Map", label: "Map" },
  { id: "Plan", label: "Mission" },
  { id: "Layers", label: "Layers" },
] as const;
