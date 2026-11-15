// The judge-friendly Plan view: one status pill and a View menu in the header, a card on
// the empty map, "More details" closed by default, a map toolbar and legend chip, and the
// plain-word tips. Rendered to HTML strings (no browser); the map library is replaced by
// an empty stand-in.
import { readFileSync } from "node:fs";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("leaflet", () => ({ default: {} }));

import { MissionContextForTests } from "../lib/MissionContext";
import { buildCostGrid, envAt, loadSite, planRoute, type Stop } from "../planner";
import { FlightTimeline } from "./FlightTimeline";
import { LayerRail } from "./LayerRail";
import { MissionPanel } from "./MissionPanel";
import { EmptyPlanCard, InfoTip, Jargon, MapLegend, PLAIN_WORDS, ViewMenu, legendItems, type ViewMenuItem } from "./PlanChrome";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
const app = read("../App.tsx");

function elementsOf(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  const out: ReactElement<Record<string, unknown>>[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return;
    out.push(child, ...elementsOf(child.props.children as ReactNode));
  });
  return out;
}

const site = loadSite(JSON.parse(read("../../public/data/site.json")));
const conditions = { storm: false, spe: false, startLmst: 13 };
const cost = buildCostGrid(site, conditions);
const demoStops: Stop[] = site.pois
  .filter((p) => p.kind === "science")
  .slice(0, 3)
  .map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin: 30 }));
const nothing = () => {};
type Mission = NonNullable<React.ContextType<typeof MissionContextForTests>>;
function missionWith(stops: Stop[]): Mission {
  const plan = planRoute(site, cost, site.habitat, stops);
  return {
    site, cost, plan, stops, demo: demoStops, conditions,
    elapsed: 0, clockElapsed: 0, selected: "", emergency: null, emergencyOutcome: null, scenario: null, replanned: false,
    returnPlan: null, returnElapsed: 0, returnPlaying: false, playing: false, abort: null,
    evaStatus: plan.status, evaReasons: plan.reasons, env: envAt(13, false),
    position: { ...site.habitat, phase: "walk", legIndex: 0, oxygenUsedSec: 0 },
    wildcat: undefined, basemap: null, terrainHint: false,
    edit: nothing, loadDemo: nothing, setSelected: nothing, setConditions: nothing, trigger: () => null, reset: nothing,
    loadWildcatSpe: nothing, togglePlayback: nothing, toggleReturnPlayback: nothing, setPlaying: nothing, setElapsed: nothing, clearTerrainHint: nothing,
  } as unknown as Mission;
}
const withMission = (stops: Stop[], node: ReactNode) =>
  renderToStaticMarkup(<MissionContextForTests.Provider value={missionWith(stops)}>{node}</MissionContextForTests.Provider>);

describe("1. header", () => {
  const start = app.indexOf('<header className="console-header">');
  const header = app.slice(start, app.indexOf("</header>", start));

  it("holds the logo, the tabs, one status pill, Run the demo and the View menu, and nothing else", () => {
    expect(header).toContain("<AppLogo onSelect={go} />");
    expect(header).toContain('<AppTabs current="plan" onSelect={go} />');
    expect(header).toMatch(/className="app-run-demo" onClick=\{\(\) => runDemo\(go\)\}/);
    expect(header).toContain("<ViewMenu items={viewItems} />");
    // The loose buttons and the clock moved out.
    expect(header).not.toMatch(/Helmet HUD|Sources|Hide sidebar|Map3DToggle|LMST|header-clock|return-status/);
    expect(header.match(/<button/g)).toHaveLength(1); // only "Run the demo"
  });

  it("shows ONE pill: the route-to-follow status in an emergency, with the EVA status in its tooltip", () => {
    // Exactly one of the three pill branches renders, and the emergency one carries a tooltip.
    expect(header.match(/className=\{?[`"]status /g)).toHaveLength(3);
    expect(header).toMatch(/\) : emergency && abort \? \(\s*<span className=\{`status status--\$\{abort\.status\}`\} title=\{headerPillTitle\}/);
    expect(app).toMatch(/const headerPillText = emergency && abort \? `\$\{m\.replanned \? "NEW PLAN" : "RETURN HOME"\} · \$\{abort\.status\}` : `EVA · \$\{status\}`/);
    expect(app).toMatch(/`EVA · \$\{status\}\$\{m\.replanned \? " · RE-PLANNED" : " · ABORTED"\}`/);
  });

  it("the View menu is given 3D, Helmet HUD and Sources (and the sidebar switch on desktop)", () => {
    const items = app.slice(app.indexOf("const viewItems"), app.indexOf("];", app.indexOf("const viewItems")));
    for (const label of ['"3D terrain"', '"Helmet HUD"', '"Sources"', '"Show sidebar" : "Hide sidebar"']) expect(items).toContain(label);
  });
});

describe("ViewMenu", () => {
  const calls: string[] = [];
  const items: ViewMenuItem[] = [
    { id: "3d", label: "3D terrain", checked: false, onSelect: () => calls.push("3d") },
    { id: "hud", label: "Helmet HUD", hint: "H", onSelect: () => calls.push("hud") },
    { id: "sources", label: "Sources", onSelect: () => calls.push("sources") },
    { id: "sidebar", label: "Hide sidebar", onSelect: () => calls.push("sidebar") },
  ];

  it("is closed until asked: one button that says it has a menu", () => {
    const html = renderToStaticMarkup(<ViewMenu items={items} />);
    expect(html).toMatch(/<button type="button" class="view-menu__button" aria-haspopup="menu" aria-expanded="false"/);
    expect(text(html)).toBe("View ▾");
    expect(html).not.toContain('role="menu"');
  });

  it("open, it lists 3D, HUD, Sources and Hide sidebar as menu items", () => {
    const html = renderToStaticMarkup(<ViewMenu items={items} defaultOpen />);
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('role="menu"');
    expect(html).toMatch(/role="menuitemcheckbox" aria-checked="false"><span>3D terrain<\/span><small>off<\/small>/);
    expect(html).toMatch(/role="menuitem"><span>Helmet HUD<\/span><small>H<\/small>/);
    expect(html).toMatch(/role="menuitem"><span>Sources<\/span>/);
    expect(html).toMatch(/role="menuitem"><span>Hide sidebar<\/span>/);
    expect(html.match(/role="menuitem/g)).toHaveLength(4);
  });

  it("has keyboard handling for arrows, Home, End and Escape", () => {
    const source = read("./PlanChrome.tsx");
    for (const key of ['"ArrowDown"', '"ArrowUp"', '"Home"', '"End"', '"Escape"']) expect(source).toContain(key);
  });
});

describe("2. empty map", () => {
  it("the card says what the page is for and offers the next click", () => {
    const html = renderToStaticMarkup(<EmptyPlanCard onRunDemo={nothing} onLoadDemo={nothing} />);
    const t = text(html);
    expect(t).toContain("Plan a walk on Mars");
    expect(t).toContain("ARES checks that the astronaut can get there and back.");
    expect(t).toContain("or click the map to add your own stops");
    expect(html).toMatch(/<button type="button" class="plan-primary">Run the guided demo<\/button>/);
    expect(html).toMatch(/<button type="button">Load demo mission<\/button>/);
  });

  it("its buttons call their handlers", () => {
    const onRunDemo = vi.fn();
    const onLoadDemo = vi.fn();
    const buttons = elementsOf(EmptyPlanCard({ onRunDemo, onLoadDemo })).filter((el) => el.type === "button");
    expect(buttons).toHaveLength(2);
    (buttons[0].props.onClick as () => void)();
    (buttons[1].props.onClick as () => void)();
    expect(onRunDemo).toHaveBeenCalledOnce();
    expect(onLoadDemo).toHaveBeenCalledOnce();
  });

  it("is shown only while there is no plan, starts the guided demo, and sits inside the map", () => {
    const map = app.slice(app.indexOf("<MissionMap"), app.indexOf("</MissionMap>"));
    expect(map).toMatch(/\{noPlan && !view3d && \(\s*<EmptyPlanCard onRunDemo=\{\(\) => runDemo\(go\)\} onLoadDemo=\{m\.loadDemo\}/);
    expect(app).toContain("const noPlan = !emergency && plan.legs.length === 0;");
  });
});

describe("3. left column", () => {
  it("More details is closed by default and holds reliability, map layers and start time", () => {
    const start = app.indexOf('<details className="collapsible more-details">');
    expect(start).toBeGreaterThan(0);
    const block = app.slice(start, app.indexOf("</details>", start));
    expect(block).not.toMatch(/<details[^>]*\bopen\b/);
    expect(block).toContain("<span>More details</span>");
    expect(block).toContain('<MissionPanel part="reliability"');
    expect(block).toContain('part="layers"');
    expect(block).toContain('part="start"');
    // Status, stops and oxygen stay outside it, always on screen, in that order.
    const before = app.slice(app.indexOf('<div className="telemetry-scroll">'), start);
    const order = ['part="status"', 'part="stops"', 'part="budget"'].map((p) => before.indexOf(p));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // The emergency block is pinned under the scrolling part.
    expect(app.indexOf('<MissionPanel part="emergency"')).toBeGreaterThan(app.indexOf("</details>", start));
  });

  it("the emergency menu uses plain names, with the official term SPE kept visible", () => {
    const html = withMission(demoStops, <MissionPanel part="emergency" onDetail={nothing} />);
    expect([...html.matchAll(/<option value="[^"]+"[^>]*>([^<]+)<\/option>/g)].map((m) => m[1])).toEqual([
      "Dust storm",
      "Solar radiation storm (SPE)",
      "Oxygen leak",
      "Slower walking",
      "Path blocked",
    ]);
    expect(html.match(/<select/g)).toHaveLength(1);
    expect(text(html)).toContain("Trigger");
    expect(text(html)).toContain("Demo: storm at T+1:16");
  });
});

describe("4. map controls", () => {
  const mapSource = read("./MissionMap.tsx");
  it("one vertical toolbar: zoom in, zoom out, the page's tools, then north", () => {
    const start = mapSource.indexOf('<div className="map-toolbar"');
    const bar = mapSource.slice(start, mapSource.indexOf("</div>", start));
    expect(bar).toContain('role="toolbar"');
    expect(bar).toContain('aria-orientation="vertical"');
    const order = ['aria-label="Zoom in"', 'aria-label="Zoom out"', "{toolbar}", 'aria-label="North is up"'].map((s) => bar.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(mapSource).toContain("zoomControl: false");
    // The page adds Layers and 3D.
    const tools = app.slice(app.indexOf("toolbar={"), app.indexOf("</>", app.indexOf("toolbar={")));
    expect(tools).toMatch(/aria-expanded=\{layersOpen\}[\s\S]*Layers[\s\S]*<Map3DToggle/);
  });

  it("the Layers popover lists the layer rows", () => {
    const html = withMission(demoStops, <LayerRail part="list" active={["slope"]} onChange={nothing} probe={-1} onSources={nothing} />);
    expect(html).toMatch(/^<div class="layer-list" aria-label="Terrain layers">/);
    expect(html.match(/class="layer-row/g)!.length).toBeGreaterThanOrEqual(4);
    expect(html).toContain('class="layer-row is-active"');
  });

  it("the legend lists only what is on the map", () => {
    const labels = (on: Parameters<typeof legendItems>[0]) => legendItems(on).map((i) => i.label);
    const none = { route: false, safeZone: false, sampleSites: false, emergency: false, shelter: false, blocked: false };
    expect(labels(none)).toEqual([]);
    expect(labels({ ...none, sampleSites: true })).toEqual(["Rover sample site"]);
    expect(labels({ ...none, route: true, safeZone: true, sampleSites: true })).toEqual(["Planned route", "Edge of safe return", "Rover sample site"]);
    expect(labels({ ...none, route: true, safeZone: true, sampleSites: true, emergency: true })).toEqual([
      "Route to follow now",
      "Cancelled part of the plan",
      "Rover sample site",
    ]);
    expect(labels({ ...none, route: true, emergency: true, shelter: true, blocked: true })).toContain("Shelter option");
    expect(labels({ ...none, route: true, emergency: true, blocked: true })).toContain("Blocked area");
  });

  it("the legend is a small chip, collapsed until hover, focus or a click", () => {
    const items = legendItems({ route: true, safeZone: true, sampleSites: true, emergency: false, shelter: false, blocked: false });
    const html = renderToStaticMarkup(<MapLegend items={items} />);
    expect(html).toMatch(/^<div class="map-legend-chip"><button type="button" class="map-legend-chip__button" aria-expanded="false"/);
    expect(text(html)).toContain("Legend");
    expect(renderToStaticMarkup(<MapLegend items={items} defaultOpen />)).toContain('class="map-legend-chip is-open"');
    expect(renderToStaticMarkup(<MapLegend items={[]} />)).toBe("");
    const css = read("../styles/plan-view.css");
    expect(css).toMatch(/\.map-legend-chip ul \{\s*display: none;/);
    expect(css).toMatch(/\.map-legend-chip\.is-open ul,\s*\.map-legend-chip:hover ul,\s*\.map-legend-chip:focus-within ul \{\s*display: block;/);
  });
});

describe("5. bottom", () => {
  it("the timeline shows Play, the T+ clock, Mars time and a Terrain profile toggle", () => {
    const html = withMission(demoStops, <FlightTimeline profileOn={false} onToggleProfile={nothing} />);
    const t = text(html);
    expect(html).toMatch(/<button>Play<\/button>/);
    expect(t).toContain("T+0:00");
    expect(t).toContain("LMST 13:00");
    expect(html).toMatch(/class="timeline-profile-toggle" aria-pressed="false"[^>]*>Terrain profile<\/button>/);
    expect(withMission(demoStops, <FlightTimeline profileOn onToggleProfile={nothing} />)).toContain('class="timeline-profile-toggle is-on" aria-pressed="true"');
  });

  it("sun, temperature and dose rate are inside the (i) tooltip", () => {
    const html = withMission(demoStops, <FlightTimeline profileOn={false} onToggleProfile={nothing} />);
    const tip = html.slice(html.indexOf('class="info-tip__body"'));
    expect(html).toContain('aria-label="Conditions at this moment: sun, temperature and radiation dose rate"');
    expect(text(tip)).toMatch(/Sun \d+° above the horizon/);
    expect(text(tip)).toMatch(/Air −?-?\d+ °C/);
    expect(text(tip)).toMatch(/Dose rate 0\.\d+ mSv\/h/);
  });

  it("the terrain profile is on by default only during playback", () => {
    expect(app).toContain("const profileOn = profileChoice ?? (m.playing || m.returnPlaying);");
    expect(app).toMatch(/\{profileOn && \(\s*<ElevationProfile/);
    expect(app).toContain("useState<boolean | null>(null)");
  });
});

describe("6. plain words", () => {
  it("has the six explanations", () => {
    expect(PLAIN_WORDS).toEqual({
      EVA: "the astronaut's walk outside",
      LMST: "local Mars time",
      SPE: "solar particle event: a burst of radiation",
      status: "GO / CAUTION / NO-GO: safe / safe but tight / not safe",
      "T+": "time since leaving the habitat",
      reserve: "oxygen kept back for emergencies",
    });
  });

  it("a (?) is a button whose name and tooltip give the plain meaning", () => {
    const html = renderToStaticMarkup(<Jargon term="LMST" />);
    expect(html).toContain('aria-label="LMST: local Mars time"');
    expect(html).toMatch(/role="tooltip"[^>]*>local Mars time<\/span>/);
    expect(renderToStaticMarkup(<InfoTip label="More">x</InfoTip>)).toMatch(/<button type="button" class="info-tip__button" aria-label="More"/);
  });

  it("each term has its (?) on screen, next to the official word", () => {
    const status = withMission(demoStops, <MissionPanel part="status" onDetail={nothing} />);
    expect(status).toContain('aria-label="GO, CAUTION, NO-GO: GO / CAUTION / NO-GO: safe / safe but tight / not safe"');
    const budget = withMission(demoStops, <MissionPanel part="budget" onDetail={nothing} />);
    expect(budget).toContain('aria-label="reserve: oxygen kept back for emergencies"');
    const emergency = withMission(demoStops, <MissionPanel part="emergency" onDetail={nothing} />);
    expect(emergency).toContain('aria-label="SPE: solar particle event: a burst of radiation"');
    const timeline = withMission(demoStops, <FlightTimeline />);
    expect(timeline).toContain('aria-label="T+: time since leaving the habitat"');
    expect(timeline).toContain('aria-label="LMST: local Mars time"');
    expect(app).toMatch(/<Jargon term=\{emergency \? "status" : "EVA"\} \/>/);
    // With no plan there is no status word to explain, so no (?) either.
    expect(withMission([], <MissionPanel part="status" onDetail={nothing} />)).not.toContain("jargon");
  });
});

describe("7. consistency", () => {
  const css = read("../styles/plan-view.css");
  it("one button height: 36 px on desktop, 44 px on tablet", () => {
    expect(css).toMatch(/min-height: 36px;/);
    expect(css).toMatch(/@media \(max-width: 1024px\) \{[\s\S]*?min-height: 44px;/);
  });
  it("overlays share one background and border, and controls have hover and focus states", () => {
    expect(css).toMatch(/:is\(\.view-menu__list, \.jargon__tip, \.info-tip__body, \.empty-plan-card, \.map-layers-popover[^)]*\) \{\s*background: var\(--console\);\s*border: 1px solid var\(--hairline\);\s*border-radius: 0;/);
    expect(css).toMatch(/:focus-visible \{\s*outline: 2px solid var\(--safe\);/);
    expect(css).toMatch(/:hover \{\s*border-color: var\(--safe\);/);
  });
  it("uses only theme variables for colour, apart from the shelter path's own colour", () => {
    const hexes = css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hexes.filter((h) => !["#ffffff", "#4fd1ff"].includes(h.toLowerCase()))).toEqual([]);
  });
});
