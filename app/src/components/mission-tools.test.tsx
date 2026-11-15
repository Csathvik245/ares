// The Mission tools row: What if?, Briefing and Share, always on screen under the oxygen tiles.
import { readFileSync } from "node:fs";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WHAT_IF_PULSE_KEY, rememberWhatIfPulse, resetPulseMemoryForTests, whatIfPulseNeeded, type PulseStore } from "../lib/missionTools";
import { WHAT_IF_DEFAULTS } from "../planner";
import { MISSION_TOOLS_TITLE, MissionTools, MissionToolsRow, WHAT_IF_PULSE_MS } from "./MissionTools";
import { WhatIfPanel } from "./WhatIfPanel";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");
const nothing = () => {};
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const row = (props: Partial<Parameters<typeof MissionTools>[0]> = {}) => (
  <MissionTools whatIfOpen={false} copied={false} canWhatIf canBrief canShare onWhatIf={nothing} onBriefing={nothing} onShare={nothing} {...props} />
);
const sliders = <WhatIfPanel values={{ ...WHAT_IF_DEFAULTS }} active={false} onChange={nothing} onReset={nothing} />;

describe("Mission tools row", () => {
  it("renders three buttons, each with a small inline icon: What if?, Briefing, Share", () => {
    const html = renderToStaticMarkup(row());
    expect(html).toContain(`<section class="mission-tools" data-tour="tools" aria-label="${MISSION_TOOLS_TITLE}">`);
    const buttons = [...html.matchAll(/<button type="button" class="mission-tools__button[^"]*"[^>]*>(<svg[\s\S]*?<\/svg>)([^<]*)<\/button>/g)];
    expect(buttons.map((b) => b[2])).toEqual(["What if?", "Briefing", "Share"]);
    for (const b of buttons) expect(b[1]).toContain('aria-hidden="true"');
    expect(html).not.toContain("<input"); // the sliders are closed
  });

  it("What if? opens the sliders right below the row, and says so to screen readers", () => {
    const closed = renderToStaticMarkup(row());
    expect(closed).toMatch(/class="mission-tools__button" aria-expanded="false"/);
    const open = renderToStaticMarkup(row({ whatIfOpen: true, children: sliders }));
    expect(open).toMatch(/class="mission-tools__button is-open" aria-expanded="true"/);
    expect(open.indexOf("mission-tools__row")).toBeLessThan(open.indexOf('class="whatif"'));
    expect(open.match(/<input type="range"/g)).toHaveLength(3);
    expect(text(open)).toContain("Reset to defaults");
    // In the app the button toggles the panel.
    const app = read("../App.tsx");
    expect(app).toContain("onWhatIf={() => setWhatIfOpen((open) => !open)}");
  });

  it("each button calls its handler, Share says Copied, and buttons that cannot work are disabled", () => {
    const onWhatIf = vi.fn(), onBriefing = vi.fn(), onShare = vi.fn();
    const tree = MissionToolsRow({ whatIfOpen: false, copied: false, canWhatIf: true, canBrief: true, canShare: true, onWhatIf, onBriefing, onShare }) as ReactElement<{ children: ReactNode[] }>;
    const rowEl = (tree.props.children as ReactElement<{ children: ReactElement<{ onClick: () => void }>[] }>[])[0];
    rowEl.props.children.forEach((b) => b.props.onClick());
    expect([onWhatIf, onBriefing, onShare].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
    expect(text(renderToStaticMarkup(row({ copied: true })))).toBe("What if? Briefing Copied");
    expect(renderToStaticMarkup(<MissionToolsRow whatIfOpen={false} copied={false} canWhatIf canBrief canShare onWhatIf={nothing} onBriefing={nothing} onShare={nothing} pulse />)).toContain('class="mission-tools__button is-pulse"');
    const off = renderToStaticMarkup(row({ canWhatIf: false, canBrief: false }));
    expect(off.match(/disabled=""/g)).toHaveLength(2); // an emergency: no What if?, no Briefing; Share still works
  });

  it("sits directly under the oxygen budget, only when there is a plan, and More details no longer holds the duplicates", () => {
    const app = read("../App.tsx");
    expect(app).toMatch(/<MissionPanel part="budget" onDetail=\{setDetail\} \/>\s*\{missionTools\}/);
    expect(app).toMatch(/const missionTools =\s*plan\.legs\.length > 0 \? \(/);
    expect(app).toContain("<MissionPanel onDetail={setDetail} tools={missionTools} />"); // tablet and classic layouts
    const more = app.slice(app.indexOf('<details className="collapsible more-details">'), app.indexOf("</details>", app.indexOf('<details className="collapsible more-details">')));
    for (const gone of ["WhatIfPanel", "Download briefing", "Copy link", "plan-share"]) expect(more).not.toContain(gone);
    expect(app).toContain('{ id: "briefing", label: "Download briefing", onSelect: () => setBriefingOpen(true) }'); // still in the View menu
  });

  it("is one line of three equal buttons, also on short screens", () => {
    const css = read("../styles/sidebar-fit.css");
    expect(css).toMatch(/\.mission-tools__row \{\s*display: grid;\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
    expect(css).toMatch(/\.mission-tools \.mission-tools__button \{[^}]*white-space: nowrap;/);
    expect(css).toMatch(/@media \(max-height: 759px\) and \(min-width: 1025px\) \{\s*html\[data-theme\] \.console-app \.telemetry-col \.mission-tools button\.mission-tools__button[^{]*\{\s*min-height: 28px;/);
  });
});

describe("the first-visit pulse on What if?", () => {
  const memory = (): PulseStore & { data: Record<string, string> } => {
    const data: Record<string, string> = {};
    return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
  };

  it("is needed once, then remembered in localStorage", () => {
    resetPulseMemoryForTests();
    const store = memory();
    expect(whatIfPulseNeeded(store)).toBe(true);
    rememberWhatIfPulse(store);
    expect(store.data[WHAT_IF_PULSE_KEY]).toBe("1");
    resetPulseMemoryForTests(); // a new page load
    expect(whatIfPulseNeeded(store)).toBe(false);
  });

  it("never throws when storage is blocked, and still pulses only once per page load", () => {
    resetPulseMemoryForTests();
    const broken: PulseStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(whatIfPulseNeeded(broken)).toBe(true);
    expect(() => rememberWhatIfPulse(broken)).not.toThrow();
    expect(whatIfPulseNeeded(broken)).toBe(false);
    resetPulseMemoryForTests();
    expect(whatIfPulseNeeded(null)).toBe(true);
    const source = read("../lib/missionTools.ts");
    expect(source.match(/try \{/g)!.length).toBeGreaterThanOrEqual(3);
  });

  it("runs once for 2 s, and not at all under prefers-reduced-motion", () => {
    expect(WHAT_IF_PULSE_MS).toBe(2000);
    const css = read("../styles/sidebar-fit.css");
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\) \{\s*html\[data-theme\] \.console-app \.mission-tools \.mission-tools__button\.is-pulse \{\s*animation: mission-tools-pulse 2000ms ease-in-out 1;/);
    expect(css.match(/mission-tools-pulse 2000ms/g)).toHaveLength(1); // only inside that media query
    const component = read("./MissionTools.tsx");
    expect(component).toMatch(/if \(!whatIfPulseNeeded\(\)\) return;\s*rememberWhatIfPulse\(\);\s*setPulse\(true\);/);
  });
});
