// The user guide: the button on every tab, the full-screen guide and its four tabs, the
// spotlight tour, and the first-visit hint. Pages are rendered to an HTML string (no
// browser); the map library needs a browser, so it is replaced by an empty stand-in.
import { readFileSync } from "node:fs";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("leaflet", () => ({ default: {} }));

import App from "./App";
import { GuideTour, TourCard, placeCard } from "./components/GuideTour";
import { OxygenBar, oxygenBarWidths } from "./components/OxygenBar";
import { ColoursPanel, GetStartedPanel, GuideButton, ReadScreenPanel, UserGuide, UserGuideView, WordChip, type GuideHandlers } from "./components/UserGuide";
import {
  GUIDE_CARDS,
  GUIDE_HINT_KEY,
  GUIDE_HINT_TEXT,
  GUIDE_RESERVE,
  GUIDE_STATUSES,
  GUIDE_SWATCHES,
  GUIDE_TABS,
  GUIDE_TAGS,
  GUIDE_TITLE,
  GUIDE_WORDS,
  PLAY_HINT_TEXT,
  TOUR_STOPS,
  demoOxygenSample,
  guideTabAfterKey,
  hintNeeded,
  rememberHint,
  resetHintMemoryForTests,
  tourAfter,
  type GuideTab,
  type HintStore,
} from "./lib/guide";
import { GUIDED_STEP_COUNT } from "./lib/guided-demo";
import { RESERVE_MIN, buildCostGrid, formatMinutes, loadSite, oxygenBudget, planRoute } from "./planner";
import type { Stop } from "./planner";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const nothing = () => {};
const handlers: GuideHandlers = { onClose: nothing, onAction: nothing, onScience: nothing, onStartTour: nothing };

function elementsOf(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  const out: ReactElement<Record<string, unknown>>[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return;
    out.push(child, ...elementsOf(child.props.children as ReactNode));
  });
  return out;
}
const buttonsOf = (node: ReactNode) => elementsOf(node).filter((el) => el.type === "button");

const site = loadSite(JSON.parse(read("../public/data/site.json")));
const demoStops: Stop[] = site.pois
  .filter((p) => p.kind === "science")
  .slice(0, 3)
  .map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin: 30 }));
const sample = demoOxygenSample(site, demoStops)!;
const view = (tab: GuideTab) => renderToStaticMarkup(<UserGuideView tab={tab} onTab={nothing} sample={sample} {...handlers} />);

describe("Guide button and shortcuts", () => {
  it("is in the header of every tab, just left of Run the demo where there is one", () => {
    const story = renderToStaticMarkup(<App initialHash="#story" />);
    expect(story).toMatch(/<header class="app-bar">[\s\S]*class="guide-button"[\s\S]*<\/header>/);
    const science = renderToStaticMarkup(<App initialHash="#science" />);
    const bar = /<header class="app-bar">[\s\S]*?<\/header>/.exec(science)![0];
    expect(bar.indexOf('class="guide-button"')).toBeGreaterThan(0);
    expect(bar.indexOf('class="guide-button"')).toBeLessThan(bar.indexOf('class="app-run-demo"'));
    expect(text(bar)).toContain("? Guide");
    const app = read("./App.tsx");
    const header = app.slice(app.indexOf('<header className="console-header">'), app.indexOf("</header>", app.indexOf('<header className="console-header">')));
    expect(header).toMatch(/\{guideButton\}\s*<button type="button" className="app-run-demo"/);
    expect(app.match(/\{guideButton\}/g)).toHaveLength(3); // Story, Science, Plan
    expect(app.match(/\{guidePanel\}/g)).toHaveLength(3);
  });

  it("says whether the guide is open, and toggles it", () => {
    const onToggle = vi.fn();
    expect(renderToStaticMarkup(<GuideButton open={false} onToggle={onToggle} />)).toContain('aria-expanded="false"');
    expect(renderToStaticMarkup(<GuideButton open onToggle={onToggle} />)).toContain('aria-expanded="true"');
    (buttonsOf(GuideButton({ open: false, onToggle }))[0].props.onClick as () => void)();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("? opens it from any tab and Esc closes it", () => {
    const app = read("./App.tsx");
    expect(app).toMatch(/if \(e\.key === "Escape"\) \{\s*setGuideOpen\(false\);/);
    expect(app).toMatch(/e\.key !== "\?" \|\| el\?\.closest\?\.\('input,textarea,select/); // not while typing
    expect(app).toMatch(/e\.preventDefault\(\);\s*setGuideOpen\(true\);/);
  });
});

describe("the guide opens full-screen", () => {
  it("renders nothing while closed", () => {
    expect(renderToStaticMarkup(<UserGuide open={false} site={site} demoStops={demoStops} {...handlers} />)).toBe("");
  });

  it("when open: a full-screen dialog titled 'How to use ARES', with a close button and four tabs", () => {
    const open = renderToStaticMarkup(<UserGuide open site={site} demoStops={demoStops} {...handlers} />);
    expect(open).toContain('<div id="user-guide" class="guide-overlay" role="dialog" aria-modal="true" aria-label="How to use ARES">');
    expect(GUIDE_TITLE).toBe("How to use ARES");
    expect(open).toContain("<h2>How to use ARES</h2>");
    expect(open).toContain('aria-label="Close the guide"');
    expect(GUIDE_TABS.map((t) => t.label)).toEqual(["Get started", "Read the screen", "What the colours mean", "Words"]);
    const tabs = [...open.matchAll(/<button type="button" role="tab"[^>]*aria-selected="(true|false)"[^>]*>([^<]*)<\/button>/g)].map((m) => [m[2], m[1]]);
    expect(tabs).toEqual([["Get started", "true"], ["Read the screen", "false"], ["What the colours mean", "false"], ["Words", "false"]]);
    const css = read("./styles/user-guide.css");
    const overlay = /\.guide-overlay \{([^}]*)\}/.exec(css)![1];
    expect(overlay).toContain("position: fixed");
    expect(overlay).toContain("inset: 0"); // the whole screen
    expect(overlay).toMatch(/backdrop-filter: blur\(\d+px\)/); // a slight blur of the app behind
    expect(css).not.toContain("gradient(");
  });

  it("the close button closes it, and a tab click selects that tab", () => {
    const onClose = vi.fn();
    const onTab = vi.fn();
    const buttons = buttonsOf(UserGuideView({ tab: "start", onTab, sample, ...handlers, onClose }));
    (buttons.find((b) => b.props.className === "guide__close")!.props.onClick as () => void)();
    expect(onClose).toHaveBeenCalledTimes(1);
    const tabButtons = buttons.filter((b) => b.props.role === "tab");
    expect(tabButtons).toHaveLength(4);
    (tabButtons[2].props.onClick as () => void)();
    expect(onTab).toHaveBeenCalledWith("colours");
  });

  it("arrow keys switch tabs, wrapping round at the ends", () => {
    expect(guideTabAfterKey("start", "ArrowRight")).toBe("screen");
    expect(guideTabAfterKey("screen", "ArrowRight")).toBe("colours");
    expect(guideTabAfterKey("words", "ArrowRight")).toBe("start");
    expect(guideTabAfterKey("start", "ArrowLeft")).toBe("words");
    expect(guideTabAfterKey("colours", "ArrowLeft")).toBe("screen");
    expect(guideTabAfterKey("colours", "Home")).toBe("start");
    expect(guideTabAfterKey("colours", "End")).toBe("words");
    expect(guideTabAfterKey("colours", "a")).toBe("colours");
    // The tab list listens for them.
    const list = elementsOf(UserGuideView({ tab: "start", onTab: nothing, sample, ...handlers })).find((el) => el.props.role === "tablist")!;
    const onTab = vi.fn();
    const withSpy = elementsOf(UserGuideView({ tab: "start", onTab, sample, ...handlers })).find((el) => el.props.role === "tablist")!;
    expect(typeof list.props.onKeyDown).toBe("function");
    (withSpy.props.onKeyDown as (e: unknown) => void)({ key: "ArrowRight", preventDefault: nothing, currentTarget: { querySelector: () => null } });
    expect(onTab).toHaveBeenCalledWith("screen");
  });

  it("tabs fade and slide in, but not for readers who ask for less motion", () => {
    const css = read("./styles/user-guide.css");
    expect(css).toMatch(/\.guide__panel \{\s*animation: guide-in \d+ms/);
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/\.guide__panel \{\s*animation: none;/);
    expect(reduced).toMatch(/\.emergency-controls\.is-flash \{\s*animation: none;/);
    // Tablet: the tabs scroll sideways and the cards stack.
    expect(css).toMatch(/\.guide__tabs \{[^}]*overflow-x: auto;/);
    const tablet = css.slice(css.indexOf("@media (max-width: 1024px)"));
    expect(tablet).toMatch(/\.guide-cards,[\s\S]*?\{\s*grid-template-columns: minmax\(0, 1fr\);/);
  });
});

describe("tab 1: Get started", () => {
  it("renders three large cards, each with an icon, a bold title and one line, and the Science link", () => {
    const html = view("start");
    expect(GUIDE_CARDS.map((c) => c.title)).toEqual([`Watch the ${GUIDED_STEP_COUNT}-step demo`, "Load the demo mission", "Throw an emergency at it"]);
    expect(GUIDE_CARDS[0].title).toBe("Watch the 4-step demo");
    const cards = [...html.matchAll(/<button type="button" class="guide-card" data-action="(\w+)">([\s\S]*?)<\/button>/g)];
    expect(cards.map((c) => c[1])).toEqual(["demo", "load", "emergency"]);
    cards.forEach((c, i) => {
      expect(c[2]).toContain("<svg"); // an inline icon
      expect(c[2]).toContain(`<strong>${GUIDE_CARDS[i].title}</strong>`);
      expect(c[2]).toContain(`<span>${GUIDE_CARDS[i].line}</span>`);
    });
    expect(text(html)).toContain("Then open the Science tab to see how we checked it");
    expect(html).toContain('<a href="#science">');
  });

  it("each card triggers its action, and the link opens Science", () => {
    const onAction = vi.fn();
    const onScience = vi.fn();
    const panel = GetStartedPanel({ onAction, onScience });
    const cards = buttonsOf(panel);
    expect(cards).toHaveLength(3);
    cards.forEach((card) => (card.props.onClick as () => void)());
    expect(onAction.mock.calls.map((c) => c[0])).toEqual(["demo", "load", "emergency"]);
    const link = elementsOf(panel).find((el) => el.type === "a")!;
    const event = { preventDefault: vi.fn() };
    (link.props.onClick as (e: unknown) => void)(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onScience).toHaveBeenCalledTimes(1);
  });

  it("in the app each action closes the guide and does the real thing on the Plan tab", () => {
    const app = read("./App.tsx");
    const action = app.slice(app.indexOf("const onGuideAction"), app.indexOf("const guidePanel"));
    expect(action).toMatch(/setGuideOpen\(false\);\s*if \(action === "demo"\) \{\s*runDemo\(go\);/); // startGuidedDemo, through runDemo
    expect(read("./lib/appTabs.ts")).toContain("startGuidedDemo();");
    expect(action).toMatch(/go\("plan"\);\s*if \(action === "load"\) \{[\s\S]*m\.loadDemo\(\);[\s\S]*setPlayHint\(true\);/);
    expect(action).toMatch(/ensurePlan\(\);[\s\S]*scrollIntoView\(\{ block: "nearest" \}\);[\s\S]*classList\.add\("is-flash"\)/);
    expect(app).toMatch(/const ensurePlan = \(\) => \{\s*if \(!m\.emergency && m\.stops\.length === 0\) m\.loadDemo\(\);/);
    expect(PLAY_HINT_TEXT).toBe("Press Play to watch the walk");
    expect(app).toContain("{PLAY_HINT_TEXT}");
    expect(app).toMatch(/onScience=\{\(\) => \{\s*setGuideOpen\(false\);\s*go\("science"\);/);
  });
});

describe("tab 2: Read the screen, and the spotlight tour", () => {
  it("renders a Start the tour button and a preview strip of the eight stops", () => {
    const html = view("screen");
    expect(html).toContain('<button type="button" class="guide-primary">Start the tour</button>');
    const strip = [...html.matchAll(/<li><svg[\s\S]*?<\/svg><span><b>(\d)<\/b> ([^<]*)<\/span><\/li>/g)].map((m) => `${m[1]} ${m[2]}`);
    expect(strip).toEqual(TOUR_STOPS.map((s, i) => `${i + 1} ${s.label}`));
    const onStartTour = vi.fn();
    (buttonsOf(ReadScreenPanel({ onStartTour }))[0].props.onClick as () => void)();
    expect(onStartTour).toHaveBeenCalledTimes(1);
  });

  it("has eight stops, in the asked order, each pointing at a real element of the Plan view", () => {
    expect(TOUR_STOPS.map((s) => s.id)).toEqual(["status", "stops", "oxygen", "route", "zone", "probe", "emergency", "timeline"]);
    const sources = ["./components/MissionPanel.tsx", "./components/MissionMap.tsx", "./components/FlightTimeline.tsx"].map(read).join("\n");
    for (const marker of ["status", "stops", "oxygen", "emergency", "timeline", "map"]) expect(sources).toContain(`data-tour="${marker}"`);
    for (const stop of TOUR_STOPS) {
      const markers = [...`${stop.selector} ${stop.clip ?? ""}`.matchAll(/data-tour="(\w+)"/g)].map((m) => m[1]);
      for (const marker of markers) expect(sources).toContain(`data-tour="${marker}"`);
      expect(stop.text.split(/(?<=[.!?])\s+/).length).toBeLessThanOrEqual(3); // one or two sentences (three at most)
    }
    expect(TOUR_STOPS[3].selector).toContain("route-line"); // the drawn route
    expect(TOUR_STOPS[4].selector).toBe(".safe-zone"); // the blue safe-return edge
    expect(TOUR_STOPS[5].text).toMatch(/^Move your mouse over the map\./);
  });

  it("the tour visits all eight stops with Next, goes back with Back, and ends on the last Next", () => {
    const visited: number[] = [];
    let index = 0;
    while (index >= 0 && visited.length < 20) {
      visited.push(index);
      index = tourAfter(index, "next");
    }
    expect(visited).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(index).toBe(-1); // finished
    expect(tourAfter(3, "back")).toBe(2);
    expect(tourAfter(0, "back")).toBe(0);
  });

  it("can be skipped from any stop", () => {
    for (let i = 0; i < TOUR_STOPS.length; i++) expect(tourAfter(i, "skip")).toBe(-1);
    expect(renderToStaticMarkup(<GuideTour index={-1} onChange={nothing} />)).toBe(""); // off: nothing on screen
  });

  it("each stop shows its text, 'n of 8', and Back / Next / Skip that call their handlers", () => {
    TOUR_STOPS.forEach((stop, i) => {
      const card = renderToStaticMarkup(<TourCard index={i} onBack={nothing} onNext={nothing} onSkip={nothing} />);
      expect(text(card)).toContain(`${i + 1} of 8 · ${stop.label}`);
      expect(text(card)).toContain(stop.text);
    });
    const onBack = vi.fn(), onNext = vi.fn(), onSkip = vi.fn();
    const buttons = buttonsOf(TourCard({ index: 2, onBack, onNext, onSkip }));
    expect(buttons.map((b) => b.props.children)).toEqual(["Back", "Next", "Skip"]);
    buttons.forEach((b) => (b.props.onClick as () => void)());
    expect([onBack, onNext, onSkip].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
    expect(buttonsOf(TourCard({ index: 0, onBack, onNext, onSkip }))[0].props.disabled).toBe(true); // nowhere to go back to
    expect(buttonsOf(TourCard({ index: 7, onBack, onNext, onSkip })).map((b) => b.props.children)).toEqual(["Back", "Finish"]);
  });

  it("the running tour dims the page around a spotlight and shows the card", () => {
    const running = renderToStaticMarkup(<GuideTour index={0} onChange={nothing} />);
    expect(running).toContain('<div class="tour" data-stop="status">');
    expect(running).toContain("tour-spot");
    expect(running).toContain("tour-card");
    const css = read("./styles/user-guide.css");
    const spot = /\.tour-spot \{([^}]*)\}/.exec(css)![1];
    expect(spot).toContain("border-radius: 8px"); // a rounded cut-out
    expect(spot).toMatch(/0 0 0 9999px rgba\(5, 5, 5, 0\.\d+\)/); // everything else dimmed
    expect(spot).toMatch(/0 0 \d+px \d+px rgba\(61, 123, 255/); // a soft glow in the accent colour
    expect(spot).toContain("pointer-events: none"); // the page under it still works (the hover-box stop needs the mouse)
  });

  it("the card is always fully on screen, beside the lit area when there is room", () => {
    const screen = { width: 1440, height: 900 };
    const beside = placeCard({ left: 0, top: 48, width: 410, height: 120 }, screen);
    expect(beside.left).toBe(410 + 16); // to the right of the sidebar
    for (const rect of [null, { left: 410, top: 48, width: 1030, height: 700 }, { left: 0, top: 800, width: 410, height: 100 }, { left: 1100, top: 300, width: 300, height: 200 }]) {
      const at = placeCard(rect, screen);
      expect(at.left).toBeGreaterThanOrEqual(16);
      expect(at.left + 320).toBeLessThanOrEqual(1440 - 16);
      expect(at.top).toBeGreaterThanOrEqual(16);
      expect(at.top + 190).toBeLessThanOrEqual(900 - 16);
    }
  });

  it("in the app, Start the tour closes the guide, opens Plan, loads the demo if there is no plan, and starts at stop 1", () => {
    const app = read("./App.tsx");
    expect(app).toMatch(/onStartTour=\{\(\) => \{\s*setGuideOpen\(false\);\s*go\("plan"\);\s*ensurePlan\(\);[\s\S]{0,120}setTourIndex\(0\);/);
    expect(app).toContain("<GuideTour index={guideOpen ? -1 : tourIndex} onChange={setTourIndex} onStop={onTourStop} />");
    expect(app).toMatch(/if \(screen !== "plan"\) setTourIndex\(-1\);/); // leaving the Plan tab ends it
  });
});

describe("tab 3: What the colours mean", () => {
  const html = view("colours");
  const t = text(html);

  it("shows the three real status pills, each with a three to six word meaning", () => {
    for (const s of GUIDE_STATUSES) {
      expect(html).toContain(`<span class="status status--${s.status}">EVA · ${s.status}</span><figcaption>${s.meaning}</figcaption>`);
      const words = s.meaning.split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(3);
      expect(words).toBeLessThanOrEqual(6);
    }
    expect(GUIDE_STATUSES.map((s) => s.status)).toEqual(["GO", "CAUTION", "NO-GO"]);
  });

  it("shows a live oxygen bar drawn by the app's own bar component, with the demo mission's numbers", () => {
    const plan = planRoute(site, buildCostGrid(site, { storm: false, spe: false, startLmst: 13 }), site.habitat, demoStops);
    const budget = oxygenBudget(false);
    expect(sample).toEqual({ usedSec: plan.oxygenUsedSec, marginSec: plan.marginSec, reserveSec: budget.reserveSec, budgetSec: budget.budgetSec });
    expect(html).toContain(renderToStaticMarkup(<OxygenBar {...sample} />)); // the very same markup as the sidebar's bar
    expect(read("./components/MissionPanel.tsx")).toContain("<OxygenBar usedSec={used}");
    const w = oxygenBarWidths(sample);
    expect(w.used + w.margin + w.reserve).toBeCloseTo(100, 6);
    // Labels with pointer lines: used, spare, and the reserve with its value from the planner.
    expect(GUIDE_RESERVE).toBe(formatMinutes(RESERVE_MIN * 60));
    expect(html).toMatch(new RegExp(`<span style="left:[\\d.]+%">used</span><span style="left:[\\d.]+%">spare</span><span class="is-end" style="left:[\\d.]+%">${GUIDE_RESERVE} reserve</span>`));
    expect(read("./lib/guide.ts") + read("./components/UserGuide.tsx")).not.toMatch(/\b45 min\b|\b1,000\b|\b1000\b/);
    expect(demoOxygenSample(null, demoStops)).toBeNull();
    expect(text(renderToStaticMarkup(<ColoursPanel sample={null} />))).toContain("Loading the demo mission");
  });

  it("shows swatches for the route, the route home, the safe-return edge, slow ground and off-limits ground, in the map's colours", () => {
    expect(GUIDE_SWATCHES.map((s) => s.label)).toEqual(["Planned route", "Route home in an emergency", "Blue edge: where she could still detour after her last stop and get home with the reserve", "Slow ground", "Off-limits ground"]);
    for (const s of GUIDE_SWATCHES) {
      expect(html).toContain(`<i class="guide-swatch guide-swatch--${s.id}" aria-hidden="true"></i>${s.label}`);
    }
    const css = read("./styles/user-guide.css");
    expect(css).toMatch(/\.guide-swatch--route::before \{[^}]*background: var\(--mars\);/); // white, as the route is drawn
    expect(css).toMatch(/\.guide-swatch--home::before \{[^}]*background: var\(--nogo\);/); // the red abort route
    expect(css).toMatch(/\.guide-swatch--zone::before \{[^}]*background: var\(--safe\);/); // the blue edge
    expect(css).toMatch(/\.guide-swatch--slow \{[^}]*var\(--caution\)/); // amber
    expect(css).toMatch(/\.guide-swatch--nogo \{[^}]*var\(--nogo\)/); // red
  });

  it("shows the four evidence tags as the real tag component, with one example each", () => {
    expect(GUIDE_TAGS.map((g) => g.level)).toEqual(["OBSERVED", "CALCULATED", "INTERPRETED", "ASSUMED"]);
    for (const g of GUIDE_TAGS) {
      expect(html).toContain(`class="evidence-tag evidence-tag--${g.level.toLowerCase()}"`);
      expect(t).toContain(g.example);
    }
  });
});

describe("tab 4: Words", () => {
  it("renders a grid of eight chips", () => {
    const html = view("words");
    expect(GUIDE_WORDS.map((w) => w.word)).toEqual(["EVA", "T+", "LMST", "SPE", "Reserve", "Margin", "No-go", "Safe-return zone"]);
    expect(html.match(/class="guide-chip"/g)).toHaveLength(8);
    for (const w of GUIDE_WORDS) {
      expect(html).toContain(`<span class="guide-chip__word">${w.word}</span>`);
      expect(text(html)).toContain(w.meaning);
      expect(w.meaning.split(/(?<=[.!?])\s+/)).toHaveLength(1); // one short line
    }
  });

  it("a chip flips to its meaning when clicked, and on hover or keyboard focus", () => {
    const onFlip = vi.fn();
    const front = renderToStaticMarkup(<WordChip word="EVA" meaning="The astronaut's walk outside." flipped={false} onFlip={onFlip} />);
    const back = renderToStaticMarkup(<WordChip word="EVA" meaning="The astronaut's walk outside." flipped onFlip={onFlip} />);
    expect(front).toContain('class="guide-chip" aria-pressed="false"');
    expect(back).toContain('class="guide-chip is-flipped" aria-pressed="true"');
    (WordChip({ word: "EVA", meaning: "x", flipped: false, onFlip }).props.onClick as () => void)();
    expect(onFlip).toHaveBeenCalledTimes(1);
    const css = read("./styles/user-guide.css");
    expect(css).toMatch(/\.guide-chip\.is-flipped \.guide-chip__meaning,\s*\.guide-chip:hover \.guide-chip__meaning,\s*\.guide-chip:focus-visible \.guide-chip__meaning \{\s*opacity: 1;/);
    expect(css).toMatch(/\.guide-chip__meaning \{\s*opacity: 0;/); // hidden until turned
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
    resetHintMemoryForTests(); // a later visit: a new page load, the same browser storage
    expect(hintNeeded(store)).toBe(false);
  });

  it("if storage fails it never throws, and shows once per page load", () => {
    expect(hintNeeded(broken)).toBe(true);
    expect(() => rememberHint(broken)).not.toThrow();
    expect(hintNeeded(broken)).toBe(false);
    resetHintMemoryForTests(); // a reload
    expect(hintNeeded(broken)).toBe(true);
    expect(hintNeeded(null)).toBe(true);
  });

  it("the bubble says 'New here? Start with the guide.', closes when clicked, and hides while the guide is open", () => {
    expect(GUIDE_HINT_TEXT).toBe("New here? Start with the guide.");
    const onDismissHint = vi.fn();
    const bubble = buttonsOf(GuideButton({ open: false, onToggle: nothing, hint: true, onDismissHint })).find((b) => b.props.className === "guide-hint")!;
    expect(bubble.props.children).toBe(GUIDE_HINT_TEXT);
    (bubble.props.onClick as () => void)();
    expect(onDismissHint).toHaveBeenCalledTimes(1);
    expect(renderToStaticMarkup(<GuideButton open onToggle={nothing} hint onDismissHint={nothing} />)).not.toContain("guide-hint");
  });

  it("appears on the Plan tab only, and opening the guide remembers it was seen", () => {
    const app = read("./App.tsx");
    expect(app).toContain('if (screen === "plan" && hintNeeded()) setGuideHint(true);');
    expect(app).toContain('hint={guideHint && screen === "plan"}');
    expect(app).toMatch(/const toggleGuide = \(\) => \{[^}]*dismissGuideHint\(\);/);
    expect(renderToStaticMarkup(<App initialHash="#story" />)).not.toContain("guide-hint");
  });
});
