// The "What if?" sliders: the panel, the amber tag by the status, and what is switched off
// while what-if values are set. Rendered to an HTML string on the real site.json.
import { readFileSync } from "node:fs";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MissionContextForTests, type MissionState } from "../lib/MissionContext";
import { homeField } from "../lib/planner";
import { WHAT_IF_DEFAULTS, buildCostGrid, envAt, formatMinutes, formatPct, loadSite, planRoute } from "../planner";
import type { Conditions, Stop, WhatIf } from "../planner";
import { MissionPanel, type MissionPart } from "./MissionPanel";
import { WHAT_IF_INVITE, WHAT_IF_SLIDERS, WHAT_IF_TAG, WhatIfPanel } from "./WhatIfPanel";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
const nothing = () => {};
const site = loadSite(JSON.parse(read("../../public/data/site.json")));
const conditions: Conditions = { storm: false, spe: false, startLmst: 13 };
const cost = buildCostGrid(site, conditions);
const demoStops: Stop[] = site.pois
  .filter((p) => p.kind === "science")
  .slice(0, 3)
  .map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin: 30 }));

/** A calm mission as the provider hands it out, planned with the given what-if values. */
function missionWith(whatIf: WhatIf = {}): MissionState {
  const values = { ...WHAT_IF_DEFAULTS, ...whatIf };
  const whatIfOn = Object.keys(whatIf).length > 0;
  const plan = planRoute(site, cost, site.habitat, demoStops, whatIfOn ? { whatIf: values } : {});
  return {
    site,
    cost,
    plan,
    evaPlan: plan,
    stops: demoStops,
    demo: demoStops,
    conditions,
    elapsed: 0,
    clockElapsed: 0,
    selected: "",
    emergency: null,
    emergencyOutcome: null,
    scenario: null,
    replanned: false,
    returnPlan: null,
    returnElapsed: 0,
    abort: null,
    shortestPlan: null,
    whatIf: values,
    whatIfDraft: values,
    whatIfOn,
    evaStatus: plan.status,
    evaReasons: plan.reasons,
    env: envAt(13, false),
    position: { ...site.habitat, phase: "walk", legIndex: 0, oxygenUsedSec: 0 },
    home: homeField(site, cost),
    wildcat: site.pois.find((p) => p.id === "delta-wildcat-ridge"),
    basemap: null,
    edit: nothing,
    loadDemo: nothing,
    setSelected: nothing,
    setConditions: nothing,
    trigger: () => null,
    reset: nothing,
    loadWildcatSpe: nothing,
  } as unknown as MissionState;
}
const panel = (part: MissionPart, whatIf?: WhatIf) =>
  renderToStaticMarkup(
    <MissionContextForTests.Provider value={missionWith(whatIf)}>
      <MissionPanel part={part} onDetail={nothing} />
    </MissionContextForTests.Provider>,
  );

function elementsOf(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  const out: ReactElement<Record<string, unknown>>[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return;
    out.push(child, ...elementsOf(child.props.children as ReactNode));
  });
  return out;
}

describe("What if? panel", () => {
  it("has three sliders with the asked ranges and steps, each showing its value and the default", () => {
    expect(WHAT_IF_SLIDERS.map((s) => [s.label, s.min, s.max, s.step])).toEqual([
      ["Suit oxygen", 6, 10, 0.5],
      ["Walking speed", -30, 30, 5],
      ["Reserve", 30, 60, 5],
    ]);
    const html = renderToStaticMarkup(<WhatIfPanel values={{ ...WHAT_IF_DEFAULTS }} active={false} onChange={nothing} onReset={nothing} />);
    expect(html.match(/<input type="range"/g)).toHaveLength(3);
    expect(html).toContain('min="6" max="10" step="0.5" aria-valuetext="8 h" value="8"');
    expect(html).toContain('min="-30" max="30" step="5" aria-valuetext="normal" value="0"');
    expect(html).toContain(`min="30" max="60" step="5" aria-valuetext="${formatMinutes(WHAT_IF_DEFAULTS.reserveMin * 60)}" value="${WHAT_IF_DEFAULTS.reserveMin}"`);
    const t = text(html);
    expect(t).toContain("Suit oxygen 8 h default 8 h");
    expect(t).toContain("Walking speed normal default normal");
    expect(t).toContain(`Reserve ${formatMinutes(WHAT_IF_DEFAULTS.reserveMin * 60)} default ${formatMinutes(WHAT_IF_DEFAULTS.reserveMin * 60)}`);
    // The defaults shown are the planner's constants, not typed-in numbers.
    expect(read("./WhatIfPanel.tsx")).not.toMatch(/\b45\b|= 8\b/);
  });

  it("shows changed values, marks them, and keeps the default beside them", () => {
    const html = renderToStaticMarkup(
      <WhatIfPanel values={{ consumableHours: 6.5, speedFactor: 0.8, reserveMin: 60 }} active onChange={nothing} onReset={nothing} />,
    );
    const t = text(html);
    expect(t).toContain("Suit oxygen 6.5 h default 8 h");
    expect(t).toContain("Walking speed −20% default normal");
    expect(t).toContain("Reserve 60 min default 45 min");
    expect(html.match(/class="whatif__row is-changed"/g)).toHaveLength(3);
    expect(t).toMatch(/These are not our planning values/);
    expect(text(renderToStaticMarkup(<WhatIfPanel values={{ ...WHAT_IF_DEFAULTS, speedFactor: 1.15 }} active onChange={nothing} onReset={nothing} />))).toContain("Walking speed +15%");
  });

  it("moving a slider reports the new planner value; Reset to defaults calls its handler", () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    const tree = WhatIfPanel({ values: { ...WHAT_IF_DEFAULTS }, active: true, onChange, onReset });
    const sliders = elementsOf(tree).filter((el) => el.type === "input");
    const move = (i: number, value: string) => (sliders[i].props.onChange as (e: unknown) => void)({ target: { value } });
    move(0, "6.5");
    move(1, "-30");
    move(2, "35");
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([{ consumableHours: 6.5 }, { speedFactor: 0.7 }, { reserveMin: 35 }]);
    const reset = elementsOf(tree).find((el) => el.type === "button")!;
    expect(reset.props.children).toBe("Reset to defaults");
    expect(reset.props.disabled).toBe(false);
    (reset.props.onClick as () => void)();
    expect(onReset).toHaveBeenCalledTimes(1);
    // At the defaults there is nothing to reset.
    const idle = WhatIfPanel({ values: { ...WHAT_IF_DEFAULTS }, active: false, onChange, onReset });
    expect(elementsOf(idle).find((el) => el.type === "button")!.props.disabled).toBe(true);
  });

  it("opens from the map's Mission tools toolbar (not More details), re-plans after a short pause, and is off with no plan or during an emergency", () => {
    const app = read("../App.tsx");
    const more = app.slice(app.indexOf('<details className="collapsible more-details">'), app.indexOf("</details>", app.indexOf('<details className="collapsible more-details">')));
    expect(more).not.toContain("<WhatIfPanel");
    const tools = app.slice(app.indexOf("<MissionTools"), app.indexOf("</MissionTools>"));
    expect(tools).toMatch(/\{whatIfOpen && !emergency && \(\s*<WhatIfPanel/);
    expect(tools).toContain("disabled={!!emergency || plan.legs.length === 0}");
    const context = read("../lib/MissionContext.tsx");
    expect(context).toMatch(/setTimeout\(\(\) => setWhatIf\(whatIfDraft\), 150\)/); // debounced
    expect(context).toContain("planRoute(site, normalCost, site.habitat, stops, whatIfOn ? { whatIf } : {})"); // defaults pass no option at all
    expect(context).toContain("safeZone(site, whatIfGrid(cost, whatIf), plan)"); // the zone follows
  });
});

describe("while What-if values are set", () => {
  const whatIf: WhatIf = { consumableHours: 6, reserveMin: 60 };

  it("an amber 'What-if values' tag sits next to the status, in the sidebar and in the header", () => {
    expect(WHAT_IF_TAG).toBe("What-if values");
    expect(panel("status")).not.toContain("whatif-tag");
    const html = panel("status", whatIf);
    expect(html).toMatch(/<strong class="large-status ink-\w+(-\w+)?">[A-Z-]+<\/strong><span class="whatif-tag"[^>]*>What-if values<\/span>/);
    expect(read("../App.tsx")).toContain("{m.whatIfOn && !emergency && !noPlan && <WhatIfTag />}");
    expect(read("../styles/sidebar-fit.css")).toMatch(/\.whatif-tag \{[^}]*color: var\(--caution\);/);
  });

  it("the status, oxygen bar and tiles show the what-if plan", () => {
    const m = missionWith(whatIf);
    const standard = missionWith();
    expect(m.plan!.marginSec).toBeLessThan(standard.plan!.marginSec);
    const html = panel("budget", whatIf);
    const t = text(html);
    expect(t).toContain(`${formatPct(m.plan!.oxygenAtReturnPct)} left at return`);
    expect(t).toContain(`Reserve target ${formatMinutes(60 * 60)}`); // the what-if reserve, not the default
    expect(t).toContain(formatMinutes(m.plan!.marginSec));
    expect(panel("status", whatIf)).toContain(`ink-${m.plan!.status}`);
    // The bar is drawn against the what-if supply: a full bar is 6 hours, and the three parts fill it.
    const widths = [...html.matchAll(/class="budget-(?:used|margin|reserve)" style="width:([\d.]+)%"/g)].map((x) => Number(x[1]));
    expect(widths).toHaveLength(3);
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 3);
    expect(widths[2]).toBeCloseTo((60 / (6 * 60)) * 100, 3);
  });

  it("emergencies are disabled, with a note saying why", () => {
    const html = panel("emergency", whatIf);
    expect(html).toMatch(/<button class="emergency-trigger" title="Emergencies use the planner&#x27;s own values[^"]*" disabled="">Trigger<\/button>/);
    expect(html).toMatch(/class="text-button storm-preset" disabled=""/);
    expect(html).toMatch(/<button class="text-button" disabled="">Demo: SPE at Wildcat Ridge<\/button>/);
    expect(text(html)).toContain("Reset the What if? sliders to run one.");
    // With the defaults they work as before.
    expect(panel("emergency")).toMatch(/<button class="emergency-trigger" title="Starts at the playback time[^"]*">Trigger<\/button>/);
    // Anything that starts an emergency from code (the guided demo) puts the sliders back first.
    expect(read("../lib/MissionContext.tsx")).toMatch(/if \(whatIfOn\) resetWhatIf\(\);/);
  });

  it("Mission reliability, its range under the oxygen estimate and Suggest stops are off, with a note", () => {
    expect(text(panel("reliability", whatIf))).toBe("Mission reliability is off while What-if values are set. Reset the sliders to see it.");
    expect(panel("reliability")).toContain("reliability");
    expect(panel("reliability")).not.toContain("whatif-off-note");
    expect(panel("budget", whatIf)).not.toContain("oxygen-range");
    expect(panel("budget")).toContain("oxygen-range");
    expect(panel("stops", whatIf)).toMatch(/<button disabled="" title="Suggestions use the planner&#x27;s own values[^"]*">Suggest stops<\/button>/);
  });
});

describe("the invitation to try them", () => {
  it("is one line in the guide's Read the screen tab and in section 7 of the Science page", () => {
    expect(WHAT_IF_INVITE).toBe("Try the What if? sliders to see how our assumptions change the answer.");
    const guide = read("./UserGuide.tsx");
    expect(guide.slice(guide.indexOf("export function ReadScreenPanel"), guide.indexOf("// ---- Tab 3"))).toContain("{WHAT_IF_INVITE}");
    const science = read("./SciencePage.tsx");
    const section7 = science.slice(science.indexOf("<section id={evidence.id}>"), science.indexOf("<section id={related.id}>"));
    expect(section7).toContain("{WHAT_IF_INVITE}");
  });
});
