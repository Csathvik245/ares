// Mission tools: What if?, Briefing and Share, in a floating toolbar at the top centre of the map.
import { readFileSync } from "node:fs";
import type { ComponentProps, ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WHAT_IF_PULSE_KEY, rememberWhatIfPulse, resetPulseMemoryForTests, whatIfPulseNeeded, type PulseStore } from "../lib/missionTools";
import { WHAT_IF_DEFAULTS } from "../planner";
import { BANNER_GAP_PX, MISSION_TOOLS_TITLE, MissionTools, MissionToolsRow, WHAT_IF_PULSE_MS } from "./MissionTools";
import { WhatIfPanel } from "./WhatIfPanel";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const nothing = () => {};
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const base: ComponentProps<typeof MissionTools> = { whatIfOpen: false, copied: false, canWhatIf: true, canBrief: true, canShare: true, onWhatIf: nothing, onBriefing: nothing, onShare: nothing, onCloseWhatIf: nothing };
const row = (props: Partial<ComponentProps<typeof MissionTools>> = {}) => <MissionTools {...{ ...base, ...props }} />;
const sliders = <WhatIfPanel values={{ ...WHAT_IF_DEFAULTS }} active={false} onChange={nothing} onReset={nothing} />;
const css = read("../styles/sidebar-fit.css");
const app = read("../App.tsx");

describe("Mission tools toolbar", () => {
  it("renders three buttons, each with a small inline icon and a label: What if?, Briefing, Share", () => {
    const html = renderToStaticMarkup(row());
    expect(html).toContain('<div class="mission-tools" data-tour="tools">');
    expect(html).toContain(`<div class="mission-tools__row" role="toolbar" aria-label="${MISSION_TOOLS_TITLE}">`);
    const buttons = [...html.matchAll(/<button type="button" class="mission-tools__button[^"]*"[^>]*>(<svg[\s\S]*?<\/svg>)([^<]*)<\/button>/g)];
    expect(buttons.map((b) => b[2])).toEqual(["What if?", "Briefing", "Share"]);
    for (const b of buttons) expect(b[1]).toContain('aria-hidden="true"');
    expect(html).not.toContain("<input"); // the sliders are closed
    expect(html).not.toContain("mission-tools__popover");
  });

  it("What if? opens the sliders in a popover under the toolbar, with Reset", () => {
    const closed = renderToStaticMarkup(row());
    expect(closed).toMatch(/class="mission-tools__button" aria-expanded="false" aria-controls="mission-tools-whatif"/);
    const open = renderToStaticMarkup(row({ whatIfOpen: true, children: sliders }));
    expect(open).toMatch(/class="mission-tools__button is-open" aria-expanded="true"/);
    expect(open).toContain('<div class="mission-tools__popover" id="mission-tools-whatif" role="dialog" aria-label="What if?">');
    expect(open.indexOf("mission-tools__row")).toBeLessThan(open.indexOf("mission-tools__popover"));
    expect(open.match(/<input type="range"/g)).toHaveLength(3);
    expect(text(open)).toContain("Reset to defaults");
    // In the app the button toggles the popover, and the amber tag beside the status is untouched.
    expect(app).toContain("onWhatIf={() => setWhatIfOpen((open) => !open)}");
    expect(app).toContain("{m.whatIfOn && !emergency && !noPlan && <WhatIfTag />}");
    expect(css).toMatch(/\.mission-tools__popover \{\s*width: min\(360px, calc\(100vw - 24px\)\);/);
  });

  it("the popover closes on Esc or a click outside the toolbar", () => {
    const component = read("./MissionTools.tsx");
    expect(component).toMatch(/if \(event\.key === "Escape"\) onCloseWhatIf\(\);/);
    expect(component).toMatch(/if \(root\.current && !root\.current\.contains\(event\.target as Node\)\) onCloseWhatIf\(\);/);
    expect(component).toContain('document.addEventListener("mousedown", onDown);');
    expect(component).toContain('document.removeEventListener("mousedown", onDown);');
    expect(app).toContain("onCloseWhatIf={closeWhatIf}");
    expect(app).toContain("const closeWhatIf = useCallback(() => setWhatIfOpen(false), []);");
  });

  it("each button calls its handler, Share says Copied, and buttons that cannot work are disabled", () => {
    const onWhatIf = vi.fn(), onBriefing = vi.fn(), onShare = vi.fn();
    const tree = MissionToolsRow({ whatIfOpen: false, copied: false, canWhatIf: true, canBrief: true, canShare: true, onWhatIf, onBriefing, onShare }) as ReactElement<{ children: unknown[] }>;
    const rowEl = (tree.props.children as ReactElement<{ children: ReactElement<{ onClick: () => void }>[] }>[])[0];
    rowEl.props.children.forEach((b) => b.props.onClick());
    expect([onWhatIf, onBriefing, onShare].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
    expect(text(renderToStaticMarkup(row({ copied: true })))).toBe("What if? Briefing Copied");
    expect(renderToStaticMarkup(<MissionToolsRow whatIfOpen={false} copied={false} canWhatIf canBrief canShare onWhatIf={nothing} onBriefing={nothing} onShare={nothing} pulse />)).toContain('class="mission-tools__button is-pulse"');
    const off = renderToStaticMarkup(row({ canWhatIf: false, canBrief: false }));
    expect(off.match(/disabled=""/g)).toHaveLength(2); // an emergency: no What if?, no Briefing; Share still works
  });

  it("floats at the top centre of the map, styled like an overlay control: translucent dark, hairline border, 6 px radius", () => {
    expect(css).toMatch(/\.mission-tools \{\s*position: absolute;\s*top: 12px;\s*left: 50%;\s*transform: translateX\(-50%\);/);
    expect(css).toMatch(/\.mission-tools__row \{[^}]*background: rgba\(17, 17, 17, 0\.86\);\s*border: 1px solid var\(--hairline\);\s*border-radius: var\(--radius-card\);/);
    expect(read("../styles/tokens.css")).toMatch(/--radius-card:\s*6px;/);
    // It is drawn inside the map, only when there is a plan, and not in the sidebar.
    expect(app).toMatch(/const missionTools =\s*plan\.legs\.length > 0 \? \(/);
    const map = app.slice(app.indexOf("<MissionMap"), app.indexOf("</MissionMap>"));
    expect(map).toContain("{!view3d && missionTools}");
    expect(app.match(/\{(?:!view3d && )?missionTools\}/g)).toHaveLength(1);
    expect(app).not.toContain("tools={missionTools}");
  });

  it("the sidebar is back to status, stops, oxygen, More details and the emergency block", () => {
    const sidebar = app.slice(app.indexOf('<div className="telemetry-scroll">'), app.indexOf('<MissionPanel part="emergency"'));
    expect(sidebar).not.toContain("missionTools");
    expect(sidebar).not.toContain("WhatIfPanel");
    expect(sidebar).toMatch(/part="status"[\s\S]*part="stops"[\s\S]*part="budget"[\s\S]*more-details/);
    const more = app.slice(app.indexOf('<details className="collapsible more-details">'), app.indexOf("</details>", app.indexOf('<details className="collapsible more-details">')));
    for (const gone of ["WhatIfPanel", "Download briefing", "Copy link", "plan-share"]) expect(more).not.toContain(gone);
    expect(app).toContain('{ id: "briefing", label: "Download briefing", onSelect: () => setBriefingOpen(true) }'); // still in the View menu
    expect(read("./MissionPanel.tsx")).not.toMatch(/\btools\b/);
  });

  it("during an emergency it sits just under the storm banner, and it stays under the banner and the guided demo card in stacking order", () => {
    expect(app).toContain("underBanner={!!emergency}");
    const component = read("./MissionTools.tsx");
    expect(component).toContain('querySelector<HTMLElement>(".storm-alert")');
    expect(component).toContain("setTop(banner.offsetTop + banner.offsetHeight + BANNER_GAP_PX)");
    expect(BANNER_GAP_PX).toBeGreaterThan(0);
    expect(renderToStaticMarkup(<MissionToolsRow whatIfOpen={false} copied={false} canWhatIf={false} canBrief={false} canShare onWhatIf={nothing} onBriefing={nothing} onShare={nothing} top={180} />)).toContain('style="top:180px"');
    const z = (source: string, selector: string) => Number(new RegExp(`${selector} \\{[^}]*z-index: (\\d+)`).exec(source)![1]);
    expect(z(css, "\\.mission-tools")).toBeLessThan(z(read("../console.css"), "\\.storm-alert"));
    expect(z(css, "\\.mission-tools")).toBeLessThan(z(read("./guided-demo.css"), "\\.guided-demo"));
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
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\) \{\s*html\[data-theme\] \.console-app \.mission-tools button\.mission-tools__button\.is-pulse \{\s*animation: mission-tools-pulse 2000ms ease-in-out 1;/);
    expect(css.match(/mission-tools-pulse 2000ms/g)).toHaveLength(1); // only inside that media query
    const component = read("./MissionTools.tsx");
    expect(component).toMatch(/if \(!whatIfPulseNeeded\(\)\) return;\s*rememberWhatIfPulse\(\);\s*setPulse\(true\);/);
  });
});
