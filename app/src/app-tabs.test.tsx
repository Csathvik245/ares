// The three top-level tabs (Story | Plan | Science), the URL hash, and "Run the demo".
// Pages are rendered to an HTML string (no browser). The map library needs a browser,
// so it is replaced by an empty stand-in; nothing here draws a map.
import { readFileSync } from "node:fs";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("leaflet", () => ({ default: {} }));

import App from "./App";
import { AppBar, AppTabs } from "./components/AppTabs";
import { GuidedDemoCard } from "./components/GuidedDemo";
import { MissionBriefing } from "./components/MissionBriefing";
import { APP_TABS, CONSOLE_TABS, hashOfTab, runDemo, tabFromHash, type AppTab } from "./lib/appTabs";
import { GUIDED_STEP_COUNT, guidedCaption, newDemoMemo, onGuidedDemoStart, settleStep, type DemoMission } from "./lib/guided-demo";
import { buildCostGrid, loadSite, planRoute, formatKm } from "./planner";
import type { Stop } from "./planner";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
const page = (hash?: string) => renderToStaticMarkup(<App initialHash={hash} />);
const currentTab = (html: string) => /<a href="#(\w+)" class="is-current" aria-current="page">/.exec(html)?.[1];

function elementsOf(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  const out: ReactElement<Record<string, unknown>>[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return;
    out.push(child, ...elementsOf(child.props.children as ReactNode));
  });
  return out;
}

describe("URL hash and tabs", () => {
  it("there are three tabs, in order: Story, Plan, Science", () => {
    expect(APP_TABS.map((t) => t.label)).toEqual(["Story", "Plan", "Science"]);
    expect(APP_TABS.map((t) => hashOfTab(t.id))).toEqual(["#story", "#plan", "#science"]);
  });

  it("reads the tab from the hash, and falls back to Story", () => {
    expect(tabFromHash("#story")).toBe("story");
    expect(tabFromHash("#plan")).toBe("plan");
    expect(tabFromHash("#science")).toBe("science");
    expect(tabFromHash("#SCIENCE")).toBe("science");
    expect(tabFromHash("")).toBe("story");
    expect(tabFromHash(undefined)).toBe("story");
    expect(tabFromHash("#briefing-story")).toBe("story"); // the Story page's own in-page link
    expect(tabFromHash("#nope", "plan")).toBe("plan");
  });

  it("the tablet console tabs no longer include a second 'Plan'", () => {
    expect(CONSOLE_TABS.map((t) => t.label)).toEqual(["Map", "Mission", "Layers"]);
    expect(CONSOLE_TABS.map((t) => t.label)).not.toContain("Plan");
    expect(read("./App.tsx")).toContain("CONSOLE_TABS.map");
  });
});

describe("each tab renders its page", () => {
  it("Story is the default: the title screen and the story, with the Story tab marked", () => {
    const html = page();
    expect(currentTab(html)).toBe("story");
    expect(html).toContain('class="mission-briefing"');
    expect(html).toContain('id="briefing-story-title">Can the astronaut get there and back?</h2>');
    expect(html).not.toContain('class="science-page"');
    expect(page("#story")).toBe(html);
  });

  it("#science opens Science", () => {
    const html = page("#science");
    expect(currentTab(html)).toBe("science");
    expect(html).toContain('class="science-page"');
    expect(text(html)).toContain("the science behind the map");
    expect(html).not.toContain('class="mission-briefing"');
  });

  it("#plan opens the Plan console (still loading its terrain in this test)", () => {
    const html = page("#plan");
    expect(currentTab(html)).toBe("plan");
    expect(text(html)).toContain("Loading Jezero terrain…");
    expect(html).not.toContain('class="mission-briefing"');
    expect(html).not.toContain('class="science-page"');
  });

  it("every page shows all three tabs as links, and the logo leads to Story", () => {
    for (const hash of ["#story", "#plan", "#science"]) {
      const html = page(hash);
      expect(html).toContain('<nav class="app-tabs" aria-label="Main">');
      for (const tab of APP_TABS) expect(html).toMatch(new RegExp(`<a href="#${tab.id}"[^>]*>${tab.label}</a>`));
      expect(html).toMatch(/<a class="console-home app-logo" href="#story"/);
      expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    }
  });

  it("the Plan console's own header carries the tabs, the logo and a small Run the demo button", () => {
    const app = read("./App.tsx");
    const header = app.slice(app.indexOf('<header className="console-header">'), app.indexOf("</header>", app.indexOf('<header className="console-header">')));
    expect(header).toContain("<AppLogo onSelect={go} />");
    expect(header).toContain('<AppTabs current="plan" onSelect={go} />');
    expect(header).toMatch(/className="app-run-demo" onClick=\{\(\) => runDemo\(go\)\}/);
    // The demo card is mounted once, inside the map.
    expect(app.match(/<GuidedDemo \/>/g)).toHaveLength(1);
    const map = app.slice(app.indexOf("<MissionMap"), app.indexOf("</MissionMap>"));
    expect(map).toContain("<GuidedDemo />");
  });
});

describe("the tabs themselves", () => {
  it("a click selects the tab; a ctrl-click is left to the browser", () => {
    const onSelect = vi.fn();
    const links = elementsOf(AppTabs({ current: "story", onSelect })).filter((el) => el.type === "a");
    expect(links).toHaveLength(3);
    const click = (i: number, extra = {}) => {
      const event = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, preventDefault: vi.fn(), ...extra };
      (links[i].props.onClick as (e: unknown) => void)(event);
      return event;
    };
    expect(click(2).preventDefault).toHaveBeenCalled();
    expect(onSelect).toHaveBeenLastCalledWith("science");
    click(1);
    expect(onSelect).toHaveBeenLastCalledWith("plan");
    const ctrl = click(0, { ctrlKey: true });
    expect(ctrl.preventDefault).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("have a visible focus ring and are styled as navigation, not as buttons", () => {
    const css = read("./styles/app-tabs.css");
    expect(css).toMatch(/\.app-tabs a:focus-visible[^{]*\{\s*outline: 2px solid var\(--safe\)/);
    expect(css).toMatch(/\.app-tabs a\.is-current::after \{[^}]*background: var\(--safe\)/);
    expect(css).toMatch(/@media \(max-width: 1024px\) \{[\s\S]*\.app-tabs a \{\s*min-height: var\(--touch-target\)/);
    expect(renderToStaticMarkup(<AppBar current="science" onSelect={() => {}} />)).toContain('aria-current="page">Science</a>');
  });
});

describe("Run the demo", () => {
  const site = loadSite(JSON.parse(read("../public/data/site.json")));
  const cost = buildCostGrid(site, { storm: false, spe: false, startLmst: 13 });
  const demoStops: Stop[] = site.pois
    .filter((p) => p.kind === "science")
    .slice(0, 3)
    .map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin: 30 }));

  /** The part of the mission the demo drives, starting from somebody's own two stops. */
  function mission(): DemoMission {
    const m: DemoMission = {
      site,
      demo: demoStops,
      stops: [demoStops[2], demoStops[0]],
      plan: null,
      emergency: null,
      emergencyOutcome: null,
      abort: null,
      returnPlan: null,
      returnElapsed: 0,
      returnPlaying: false,
      edit(next) {
        m.stops = next;
        m.plan = planRoute(site, cost, site.habitat, next);
      },
      loadDemo() {
        m.edit(demoStops.map((s) => ({ ...s })));
      },
      reset() {},
      trigger: () => null,
      toggleReturnPlayback() {},
    };
    m.edit(m.stops);
    return m;
  }

  it("the Story page has a primary Run the demo button that calls its handler", () => {
    const onRunDemo = vi.fn();
    const tree = MissionBriefing({ onBeginPlanning: () => {}, onRunDemo });
    const button = elementsOf(tree).find((el) => el.type === "button" && el.props.children === "Run the demo")!;
    expect(button.props.className).toBe("briefing-primary");
    (button.props.onClick as () => void)();
    expect(onRunDemo).toHaveBeenCalledTimes(1);
    // App gives the Story page that handler.
    expect(read("./App.tsx")).toMatch(/<OpeningScreen[\s\S]{0,120}onRunDemo=\{\(\) => runDemo\(go\)\}/);
    expect(page("#story")).toContain('class="briefing-primary">Run the demo</button>');
  });

  it("from Story it lands on Plan at step 1, with the demo mission loaded", () => {
    let tab: AppTab = "story";
    runDemo((next) => (tab = next));
    expect(tab).toBe("plan");

    // The card was not on screen (we were on Story). When it mounts, the start is still waiting for it.
    let step = 0;
    const off = onGuidedDemoStart(() => (step = 1));
    expect(step).toBe(1);

    // Step 1 then drives the app from whatever was there (two custom stops) to the demo mission.
    const m = mission();
    const memo = newDemoMemo();
    let settled = false;
    for (let i = 0; i < 10 && !settled; i++) settled = settleStep(step, m, memo);
    expect(settled).toBe(true);
    expect(m.stops.map((s) => s.id)).toEqual(demoStops.map((s) => s.id));
    const caption = guidedCaption(step, m);
    expect(caption).toContain(formatKm(m.plan!.distM));
    expect(caption).toContain(`Status: ${m.plan!.status}.`);
    const card = renderToStaticMarkup(<GuidedDemoCard step={step} caption={caption} onBack={() => {}} onNext={() => {}} onExit={() => {}} />);
    expect(text(card)).toContain(`Step 1 of ${GUIDED_STEP_COUNT}`);

    // Pressing it again while the card is on screen restarts it at once.
    step = 3;
    runDemo((next) => (tab = next));
    expect(step).toBe(1);
    off();
  });
});
