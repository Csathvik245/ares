// The user guide: the button on every tab, the panel and its four sections, and the
// first-visit hint. Pages are rendered to an HTML string (no browser); the map library
// needs a browser, so it is replaced by an empty stand-in.
import { readFileSync } from "node:fs";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("leaflet", () => ({ default: {} }));

import App from "./App";
import { GuideButton, UserGuide, UserGuideView } from "./components/UserGuide";
import {
  GUIDE_HINT_KEY,
  GUIDE_HINT_TEXT,
  GUIDE_RESERVE,
  GUIDE_RESULTS,
  GUIDE_SECTIONS,
  GUIDE_START,
  GUIDE_TAGS,
  GUIDE_TRIALS,
  GUIDE_WORDS,
  hintNeeded,
  rememberHint,
  resetHintMemoryForTests,
  type HintStore,
} from "./lib/guide";
import { RESERVE_MIN, formatMinutes } from "./planner";
import { DEFAULT_TRIALS } from "./planner/montecarlo";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const nothing = () => {};

function elementsOf(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  const out: ReactElement<Record<string, unknown>>[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return;
    out.push(child, ...elementsOf(child.props.children as ReactNode));
  });
  return out;
}
const buttonsOf = (node: ReactNode) => elementsOf(node).filter((el) => el.type === "button");

describe("Guide button", () => {
  it("is in the header of the Story and Science tabs, just left of Run the demo where there is one", () => {
    const story = renderToStaticMarkup(<App initialHash="#story" />);
    expect(story).toMatch(/<header class="app-bar">[\s\S]*class="guide-button"[\s\S]*<\/header>/);
    const science = renderToStaticMarkup(<App initialHash="#science" />);
    const bar = /<header class="app-bar">[\s\S]*?<\/header>/.exec(science)![0];
    expect(bar.indexOf('class="guide-button"')).toBeGreaterThan(0);
    expect(bar.indexOf('class="guide-button"')).toBeLessThan(bar.indexOf('class="app-run-demo"'));
    expect(text(bar)).toContain("? Guide");
  });

  it("is in the Plan header too, just left of Run the demo", () => {
    const app = read("./App.tsx");
    const header = app.slice(app.indexOf('<header className="console-header">'), app.indexOf("</header>", app.indexOf('<header className="console-header">')));
    expect(header).toMatch(/\{guideButton\}\s*<button type="button" className="app-run-demo"/);
    expect(app.match(/\{guideButton\}/g)).toHaveLength(3); // Story, Science, Plan
    expect(app.match(/\{guidePanel\}/g)).toHaveLength(3);
  });

  it("says whether the guide is open, and toggles it", () => {
    const onToggle = vi.fn();
    const closed = renderToStaticMarkup(<GuideButton open={false} onToggle={onToggle} />);
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).toContain('aria-controls="user-guide"');
    expect(renderToStaticMarkup(<GuideButton open onToggle={onToggle} />)).toContain('aria-expanded="true"');
    (buttonsOf(GuideButton({ open: false, onToggle }))[0].props.onClick as () => void)();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("the keyboard opens it with ? and closes it with Esc, from any tab", () => {
    const app = read("./App.tsx");
    expect(app).toMatch(/if \(e\.key === "Escape"\) \{\s*setGuideOpen\(false\);/);
    expect(app).toMatch(/e\.key !== "\?" \|\| el\?\.closest\?\.\('input,textarea,select/); // not while typing
    expect(app).toMatch(/e\.preventDefault\(\);\s*setGuideOpen\(true\);/);
  });
});

describe("Guide panel", () => {
  const open = renderToStaticMarkup(<UserGuide open onClose={nothing} onRunDemo={nothing} />);
  const t = text(open);

  it("renders nothing while closed, and a labelled panel with a close button when open", () => {
    expect(renderToStaticMarkup(<UserGuide open={false} onClose={nothing} onRunDemo={nothing} />)).toBe("");
    expect(open).toContain('<aside id="user-guide" class="user-guide" role="dialog" aria-label="User guide">');
    expect(open).toContain('aria-label="Close the guide"');
    const onClose = vi.fn();
    const close = buttonsOf(UserGuideView({ onClose, onRunDemo: nothing })).find((b) => b.props.className === "user-guide__close")!;
    (close.props.onClick as () => void)();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("has the four sections, in order", () => {
    expect([...GUIDE_SECTIONS]).toEqual(["Start here", "How to read the results", "What the tags mean", "Words you'll see"]);
    const titles = [...open.matchAll(/<h3 id="[^"]+">([^<]*)<\/h3>/g)].map((m) => m[1].replace(/&#x27;/g, "'"));
    expect(titles).toEqual([...GUIDE_SECTIONS]);
  });

  it("START HERE: four steps, and a button that starts the guided demo", () => {
    expect(GUIDE_START).toHaveLength(4);
    for (const step of GUIDE_START) expect(t).toContain(step);
    expect(t).toMatch(/Run the guided demo.*Load demo mission.*Try an emergency.*Open the Science tab/);
    const onRunDemo = vi.fn();
    const run = buttonsOf(UserGuideView({ onClose: nothing, onRunDemo })).find((b) => b.props.className === "user-guide__run")!;
    expect(run.props.children).toBe("Run the guided demo");
    (run.props.onClick as () => void)();
    expect(onRunDemo).toHaveBeenCalledTimes(1);
    // In the app, starting the tour closes the guide first, so it never covers the demo's card.
    expect(read("./App.tsx")).toMatch(/onRunDemo=\{\(\) => \{\s*setGuideOpen\(false\);[^}]*runDemo\(go\);/);
  });

  it("HOW TO READ THE RESULTS: the three statuses, the oxygen bar and reserve, margin, the blue edge, terrain colours, hover, reliability", () => {
    expect(GUIDE_RESULTS.map((r) => r.term)).toEqual(["GO", "CAUTION", "NO-GO", "Oxygen bar", "Margin", "Blue edge on the map", "Amber and red terrain", "Hover the map", "Mission reliability"]);
    for (const r of GUIDE_RESULTS) {
      expect(t).toContain(r.term);
      expect(t).toContain(r.meaning);
    }
    expect(open).toContain('<dt class="ink-GO">GO</dt>');
    expect(open).toContain('<dt class="ink-NO-GO">NO-GO</dt>');
    expect(t).toMatch(/model-based, not a measured probability/);
  });

  it("its numbers come from the planner, not from the keyboard", () => {
    expect(GUIDE_RESERVE).toBe(formatMinutes(RESERVE_MIN * 60));
    expect(GUIDE_TRIALS).toBe(DEFAULT_TRIALS.toLocaleString("en-US"));
    expect(t).toContain(`the hatched end is the ${GUIDE_RESERVE} reserve`);
    expect(t).toContain(`${GUIDE_TRIALS} simulated versions of the walk`);
    const source = read("./lib/guide.ts") + read("./components/UserGuide.tsx");
    expect(source).not.toMatch(/\b45 min\b|\b1,000\b|\b1000\b/);
  });

  it("WHAT THE TAGS MEAN: the four evidence levels, each with an example from the app", () => {
    expect(GUIDE_TAGS.map((g) => g.level)).toEqual(["OBSERVED", "CALCULATED", "INTERPRETED", "ASSUMED"]);
    for (const g of GUIDE_TAGS) {
      expect(open).toContain(`>${g.level}</span>`);
      expect(t).toContain(g.meaning);
      expect(t).toContain(`Example: ${g.example}`);
    }
  });

  it("WORDS YOU'LL SEE: EVA, T+, LMST, SPE, reserve, no-go, margin", () => {
    expect(GUIDE_WORDS.map((w) => w.word)).toEqual(["EVA", "T+", "LMST", "SPE", "Reserve", "No-go", "Margin"]);
    for (const w of GUIDE_WORDS) expect(open).toContain(`<dt>${w.word}</dt>`);
    for (const w of GUIDE_WORDS) expect(t).toContain(w.meaning);
  });

  it("lies over the page on the right, about 420 px wide, scrolls by itself, and is full-width on tablet", () => {
    const css = read("./styles/user-guide.css");
    const panel = /\.user-guide \{([^}]*)\}/.exec(css)![1];
    expect(panel).toContain("position: fixed"); // an overlay: the map is not resized
    expect(panel).toMatch(/right: 0;/);
    expect(panel).toContain("width: 420px");
    expect(panel).toContain("overflow-y: auto");
    const tablet = css.slice(css.indexOf("@media (max-width: 1024px)"));
    expect(tablet).toMatch(/\.user-guide \{[^}]*width: 100vw;/);
    expect(css).not.toContain("gradient(");
  });
});

describe("first-visit hint", () => {
  /** A stand-in for localStorage. */
  const memory = (): HintStore & { data: Record<string, string> } => {
    const data: Record<string, string> = {};
    return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => void (data[k] = String(v)) };
  };
  const broken: HintStore = {
    getItem: () => {
      throw new Error("storage blocked");
    },
    setItem: () => {
      throw new Error("storage blocked");
    },
  };
  beforeEach(() => resetHintMemoryForTests());

  it("shows once: needed at first, never again after it was seen", () => {
    const store = memory();
    expect(hintNeeded(store)).toBe(true);
    rememberHint(store);
    expect(store.data[GUIDE_HINT_KEY]).toBe("1");
    expect(hintNeeded(store)).toBe(false);
    // A later visit: a new page load, the same browser storage.
    resetHintMemoryForTests();
    expect(hintNeeded(store)).toBe(false);
  });

  it("if storage fails it never throws, and shows once per page load", () => {
    expect(hintNeeded(broken)).toBe(true);
    expect(() => rememberHint(broken)).not.toThrow();
    expect(hintNeeded(broken)).toBe(false); // not again on this page load
    resetHintMemoryForTests(); // a reload
    expect(hintNeeded(broken)).toBe(true);
    expect(hintNeeded(null)).toBe(true); // no storage at all
  });

  it("the bubble says 'New here? Start with the guide.', closes when clicked, and hides while the guide is open", () => {
    expect(GUIDE_HINT_TEXT).toBe("New here? Start with the guide.");
    const onDismissHint = vi.fn();
    const withHint = GuideButton({ open: false, onToggle: nothing, hint: true, onDismissHint });
    const bubble = buttonsOf(withHint).find((b) => b.props.className === "guide-hint")!;
    expect(bubble.props.children).toBe(GUIDE_HINT_TEXT);
    (bubble.props.onClick as () => void)();
    expect(onDismissHint).toHaveBeenCalledTimes(1);
    expect(renderToStaticMarkup(<GuideButton open onToggle={nothing} hint onDismissHint={nothing} />)).not.toContain("guide-hint");
    expect(renderToStaticMarkup(<GuideButton open={false} onToggle={nothing} />)).not.toContain("guide-hint");
  });

  it("appears on the Plan tab only, and opening the guide (button or ?) remembers it was seen", () => {
    const app = read("./App.tsx");
    expect(app).toContain('if (screen === "plan" && hintNeeded()) setGuideHint(true);');
    expect(app).toContain('hint={guideHint && screen === "plan"}');
    expect(app).toMatch(/const dismissGuideHint = \(\) => \{\s*setGuideHint\(false\);\s*rememberHint\(\);/);
    expect(app).toMatch(/const toggleGuide = \(\) => \{[^}]*dismissGuideHint\(\);/);
    // Server render (no browser, so no stored memory is read): the Story tab shows no hint.
    expect(renderToStaticMarkup(<App initialHash="#story" />)).not.toContain("guide-hint");
  });
});
