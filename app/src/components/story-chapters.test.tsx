// Render checks for the story chapters, on the real site.json.
// The chapters are rendered to an HTML string with the story worked out by the real planner.
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SCIENCE_NUMBERS as N } from "../lib/scienceNumbers";
import { STORY_SEED, computeStory, projectToImage, timelineOf } from "../lib/story";
import { formatDuration, formatKm, formatMet, formatMinutes, formatPct, roundHalfUp } from "../planner";
import { MissionBriefing } from "./MissionBriefing";
import { SIMULATION_SMALL_PRINT, STORY_CHAPTERS, STORY_CLOSING, StoryChaptersView, StoryClosing } from "./StoryChapters";

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));
const read = (relative: string) => readFileSync(path(relative), "utf8");
const basemap = JSON.parse(read("../../public/data/basemap.json"));
const image = { width: basemap.width, height: basemap.height };
const data = computeStory(JSON.parse(read("../../public/data/site.json")), image, basemap.bounds);
const html = renderToStaticMarkup(<StoryChaptersView data={data} onRunDemo={() => {}} onOpenPlanner={() => {}} />);
const clean = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const text = clean(html);
const pct1 = (fraction: number) => `${roundHalfUp(fraction * 100, 1).toFixed(1)}%`;

function elementsOf(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  const out: ReactElement<Record<string, unknown>>[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return;
    out.push(child, ...elementsOf(child.props.children as ReactNode));
  });
  return out;
}

describe("story chapters: headlines", () => {
  it("renders the four chapters in order, each with a mono kicker, then the closing line", () => {
    const headlines = [
      "A science walk, planned around the terrain.",
      "Perseverance drove it. Our map agreed.",
      `A dust storm at ${formatMet(data.storm.atSec)}.`,
      `The plan says ${data.stretch.plan.status}. The simulation shows why.`,
    ];
    const at = headlines.map((h) => text.indexOf(h));
    expect(at.every((i) => i >= 0), JSON.stringify(at)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    for (const c of STORY_CHAPTERS) expect(text).toContain(`${c.n} / ${c.kicker}`);
    expect(STORY_CHAPTERS.map((c) => c.n)).toEqual(["05", "06", "07", "08"]); // the existing story has beats 01 to 04
    expect(text.indexOf(STORY_CLOSING)).toBeGreaterThan(at[3]);
    expect(STORY_CLOSING).toBe("ARES doesn't just tell astronauts where to walk. It tells them whether they'll make it back.");
  });

  it("the stretch mission really is CAUTION, and the storm is at T+1:16", () => {
    expect(data.stretch.plan.status).toBe("CAUTION");
    expect(formatMet(data.storm.atSec)).toBe(N.stormAt.value);
  });

  it("is rendered once, at the end of the existing story", () => {
    const page = renderToStaticMarkup(<MissionBriefing onBeginPlanning={() => {}} onRunDemo={() => {}} />);
    expect(page.match(/class="story-chapters"/g)).toHaveLength(1);
    expect(page.indexOf('class="story-chapters"')).toBeGreaterThan(page.indexOf("Demo mission briefing"));
    const source = read("./MissionBriefing.tsx");
    expect(source.match(/StoryChapters/g)).toHaveLength(3); // one import line (the name twice) and one line of JSX
  });

  it("makes no 'first ever' claims and uses no emoji", () => {
    expect(text).not.toMatch(/first[- ]ever|world's first|the first (tool|app|system|map|planner)/i);
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("before the planner has run: headlines and text stay, computed visuals show a light placeholder", () => {
    const early = renderToStaticMarkup(<StoryChaptersView data={null} onOpenPlanner={() => {}} />);
    expect(clean(early)).toContain("A science walk, planned around the terrain.");
    expect(clean(early)).toContain(STORY_CLOSING);
    expect(early.match(/Working it out on the real terrain/g)).toHaveLength(3);
    expect(early).not.toContain("story-map__route");
    expect(early).not.toMatch(/NaN|undefined/);
  });
});

describe("story chapters: every number comes from the planner", () => {
  it("A: the real demo plan, with distance, duration, status and margin", () => {
    expect(data.plan.ok).toBe(true);
    expect(text).toContain(`Distance ${formatKm(data.plan.distM)}`);
    expect(text).toContain(`Duration ${formatDuration(data.plan.totalSec)}`);
    expect(text).toContain(`Status · ${formatMinutes(data.plan.marginSec)} of oxygen margin ${data.plan.status}`);
    // The drawn route is the planner's route: one line per leg, with the same number of points.
    const lines = [...html.matchAll(/<polyline class="story-map__route" points="([^"]+)"/g)].map((m) => m[1].split(" ").length);
    expect(lines).toEqual(data.plan.legs.map((leg) => leg.path.length));
    for (const n of ["01", "02", "03"]) expect(html).toMatch(new RegExp(`class="story-map__number"[^>]*>${n}</text>`));
    expect(text).toContain("HAB-1");
    expect(html).toContain('pathLength="1"'); // lets CSS draw the line with stroke-dashoffset
  });

  it("A: the line sits on the right terrain (lat/lng projected with the basemap's own bounds)", () => {
    const b = basemap.bounds;
    expect(projectToImage(b, image, { lat: b.north, lng: b.west })).toEqual({ x: 0, y: 0 });
    expect(projectToImage(b, image, { lat: b.south, lng: b.east })).toEqual({ x: image.width, y: image.height });
    // The picture covers exactly the site, so a point lands on the pixel of its own terrain cell.
    expect(b).toEqual(data.site.bounds);
    const { site } = data;
    [site.habitat, ...data.stops].forEach((p, i) => {
      const mark = i === 0 ? data.habitatMark : data.stopMarks[i - 1];
      const col = Math.floor(((p.lng - site.bounds.west) / (site.bounds.east - site.bounds.west)) * site.width);
      const row = Math.floor(((site.bounds.north - p.lat) / (site.bounds.north - site.bounds.south)) * site.height);
      expect(Math.floor((mark.x / image.width) * site.width)).toBe(col);
      expect(Math.floor((mark.y / image.height) * site.height)).toBe(row);
    });
    // Each leg starts where the last one ended, and the loop starts and ends at the habitat.
    const legs = data.routeLegs;
    expect(legs[0][0]).toEqual(data.habitatMark);
    expect(legs[legs.length - 1].at(-1)).toEqual(data.habitatMark);
    legs.slice(0, -1).forEach((leg, i) => {
      expect(leg.at(-1)!.x).toBeCloseTo(data.stopMarks[i].x, 6);
      expect(leg.at(-1)!.y).toBeCloseTo(data.stopMarks[i].y, 6);
    });
    // The frame holds every mark and stays inside the picture.
    const v = data.routeView;
    for (const p of [data.habitatMark, ...data.stopMarks]) {
      expect(p.x).toBeGreaterThan(v.x);
      expect(p.x).toBeLessThan(v.x + v.width);
      expect(p.y).toBeGreaterThan(v.y);
      expect(p.y).toBeLessThan(v.y + v.height);
    }
    expect(v.x).toBeGreaterThanOrEqual(0);
    expect(v.y).toBeGreaterThanOrEqual(0);
    expect(v.x + v.width).toBeLessThanOrEqual(image.width + 1e-6);
    expect(v.y + v.height).toBeLessThanOrEqual(image.height + 1e-6);
  });

  it("B: the two validation figures are the ones in docs/validation.md and docs/demo-numbers.md", () => {
    expect(text).toContain(`of the rover's path is ground ARES rates passable ${N.roverPassable.value}`);
    expect(text).toContain(N.tiltCorrelation.value);
    expect(text).toContain(`For comparison, ${N.sitePassable.value} of the whole site is passable`); // the caveat travels with the number
    const validation = read("../../../docs/validation.md");
    const demo = read("../../../docs/demo-numbers.md");
    expect(validation).toContain(`**${N.roverPassable.value}**`);
    expect(validation).toContain(`| Correlation between rover tilt and our slope | ${N.tiltCorrelation.value.replace("r = ", "")} |`);
    for (const n of [N.roverPassable, N.tiltCorrelation, N.sitePassable, N.roverPath, N.waypoints]) expect(demo).toContain(n.value);
  });

  it("C: the storm from stormAt, ending 'Home: <x>% oxygen'", () => {
    const s = data.storm;
    expect(text).toContain(`STORM ${formatMet(s.atSec)}`);
    expect(text).toContain(`WALK HOME ${formatMinutes(s.walkHomeSec)}`);
    expect(text).toContain(`Home: ${formatPct(s.oxygenOnArrivalPct)} oxygen at ${formatMet(s.arriveSec)}`);
    expect(text).toContain(`EVA ${s.evaStatus}`);
    expect(text).toContain(`Return home · ${formatMinutes(s.marginSec)} above the reserve ${s.returnStatus}`);
    expect(s.evaStatus).toBe("NO-GO");
    expect(s.returnStatus).toBe("CAUTION");
    expect(s.arriveSec).toBeCloseTo(s.atSec + s.walkHomeSec, 6);
    // The planned timeline covers the whole EVA with no gaps; the walk home is one accent bar.
    const segments = timelineOf(data.plan);
    expect(segments[0].fromSec).toBeCloseTo(0, 6);
    expect(segments.at(-1)!.toSec).toBeCloseTo(data.plan.totalSec, 3);
    for (let i = 1; i < segments.length; i++) expect(segments[i].fromSec).toBeCloseTo(segments[i - 1].toSec, 6);
    expect(html.match(/class="story-timeline__return"/g)).toHaveLength(1);
    expect(html).toContain('class="story-timeline__storm"');
    expect(html).toMatch(/class="story-timeline__(walk|science) is-cancelled"/);
  });

  it("D: the Monte Carlo run of the stretch mission, seed 42, with the small print", () => {
    const { sim, plan } = data.stretch;
    expect(STORY_SEED).toBe(42);
    expect(sim.seed).toBe(42);
    expect(data.stretch.stops).toHaveLength(4);
    expect(text).toContain(`home with the reserve intact ${pct1(sim.pReturnWithReserve)}`);
    expect(text).toContain(`home at all ${pct1(sim.pReturnAtAll)}`);
    expect(text).toContain(`The plan itself has ${formatMinutes(plan.marginSec)} of margin.`);
    expect(text).toContain("Model-based simulation of our assumptions, not an empirical probability.");
    expect(SIMULATION_SMALL_PRINT).toBe("Model-based simulation of our assumptions, not an empirical probability.");
    const { binStart, binWidth, counts } = sim.histogramMarginMin;
    expect(html.match(/class="story-histogram__bar/g)).toHaveLength(counts.length);
    // The bars left of the reserve line hold exactly the trials that ended below the reserve.
    const belowBars = html.match(/class="story-histogram__bar is-below"/g)!.length;
    expect(belowBars).toBe(counts.filter((_, k) => binStart + (k + 1) * binWidth <= 0).length);
    expect(counts.slice(0, belowBars).reduce((a, b) => a + b, 0)).toBe(sim.failCount);
    expect(html).toContain('class="story-histogram__reserve"');
    expect(text).toContain(`Into the reserve: ${sim.failCount.toLocaleString("en-US")} of ${sim.trials.toLocaleString("en-US")}`);
  });

  it("the numbers are the frozen ones in docs/demo-numbers.md", () => {
    const doc = read("../../../docs/demo-numbers.md");
    const row = (section: string, label: string) => {
      const part = doc.slice(doc.indexOf(section));
      return new RegExp(`\\| ${label} \\| ([^|]+) \\|`).exec(part)![1].trim();
    };
    expect(formatKm(data.plan.distM)).toBe(row("## 1. Demo mission", "Distance"));
    expect(formatDuration(data.plan.totalSec)).toBe(row("## 1. Demo mission", "Total time"));
    expect(formatMinutes(data.plan.marginSec)).toBe(row("## 1. Demo mission", "Oxygen margin"));
    expect(formatMinutes(data.storm.walkHomeSec)).toBe(row("## 2. Dust storm", "Walk-home time"));
    expect(formatPct(data.storm.oxygenOnArrivalPct)).toBe(row("## 2. Dust storm", "Oxygen on arrival"));
    expect(row("## 7. Stretch mission", "Home with the oxygen reserve intact")).toContain(pct1(data.stretch.sim.pReturnWithReserve));
    expect(row("## 7. Stretch mission", "Home at all \\(before the oxygen runs out\\)")).toBe(pct1(data.stretch.sim.pReturnAtAll));
    expect(formatMinutes(data.stretch.plan.marginSec)).toBe(row("## 7. Stretch mission", "Oxygen margin"));
  });

  it("no result number is typed into the component or its data module", () => {
    const shown = [
      formatKm(data.plan.distM).replace(" km", ""),
      formatDuration(data.plan.totalSec),
      formatMinutes(data.plan.marginSec),
      formatMinutes(data.storm.walkHomeSec),
      formatMinutes(data.storm.marginSec),
      formatMet(data.storm.arriveSec),
      formatPct(data.storm.oxygenOnArrivalPct),
      pct1(data.stretch.sim.pReturnWithReserve),
      pct1(data.stretch.sim.pReturnAtAll),
      formatMinutes(data.stretch.plan.marginSec),
      N.roverPassable.value,
      N.tiltCorrelation.value.replace("r = ", ""),
      N.roverPath.value.replace(" km", ""),
    ];
    for (const file of ["./StoryChapters.tsx", "../lib/story.ts"]) {
      const source = read(file);
      for (const number of shown) expect(source.includes(number), `${file} contains "${number}"`).toBe(false);
    }
  });
});

describe("story chapters: pictures and buttons", () => {
  it("both pictures are real files, lazy-loaded, described and credited", () => {
    const images = [...html.matchAll(/<img[^>]*>/g)].map((m) => m[0]);
    expect(images).toHaveLength(2);
    for (const img of images) {
      expect(img).toContain('loading="lazy"');
      expect(img).toMatch(/alt="[^"]{20,}"/);
      const file = /src="\/([^"]+)"/.exec(img)![1];
      expect(existsSync(path(`../../public/${file}`)), file).toBe(true);
    }
    expect(images[0]).toContain('src="/data/basemap.png"');
    expect(images[1]).toContain('src="/images/validation_traverse.jpg"');
    expect(statSync(path("../../public/images/validation_traverse.jpg")).size).toBeLessThanOrEqual(300_000);
    expect(text.match(/NASA\/JPL-Caltech\/University of Arizona\/USGS/g)).toHaveLength(2);
    expect(html.match(/class="story-credit"/g)).toHaveLength(2);
  });

  it("the fade-in is switched off for readers who ask for less motion", () => {
    const css = read("../styles/story-chapters.css");
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/\[data-reveal\] \{\s*opacity: 1;\s*transform: none;\s*transition: none;/);
    expect(reduced).toMatch(/\.story-map__route-edge \{\s*stroke-dashoffset: 0;/);
    expect(css).not.toContain("gradient(");
    expect(html.match(/ data-reveal="[^"]*"/g)).toHaveLength(5); // four chapters and the closing
  });

  const buttonsOf = (node: ReactNode) => elementsOf(node).filter((el) => el.type === "button");

  it("the two buttons call their handlers", () => {
    const onRunDemo = vi.fn();
    const onOpenPlanner = vi.fn();
    const buttons = buttonsOf(StoryClosing({ onRunDemo, onOpenPlanner }));
    expect(buttons.map((b) => b.props.children)).toEqual(["Run the demo", "Open the planner"]);
    expect(buttons[0].props.className).toContain("story-button--primary");
    (buttons[0].props.onClick as () => void)();
    expect(onRunDemo).toHaveBeenCalledTimes(1);
    expect(onOpenPlanner).not.toHaveBeenCalled();
    (buttons[1].props.onClick as () => void)();
    expect(onOpenPlanner).toHaveBeenCalledTimes(1);
  });

  it("'Run the demo' is left out when no handler is given", () => {
    expect(buttonsOf(StoryClosing({ onOpenPlanner: () => {} })).map((b) => b.props.children)).toEqual(["Open the planner"]);
  });
});

describe("Story poll: the demo mission's briefing", () => {
  it("is computed from the demo mission and never gives a status to 'no route'", async () => {
    const { demoBriefing, STORY_START_LMST } = await import("../lib/story");
    const { computeBriefing, buildCostGrid, planRoute } = await import("../planner");
    expect(demoBriefing(data.site, [])).toBeNull(); // no stops yet: no briefing, so no GO
    const briefing = demoBriefing(data.site, data.stops)!;
    // The same thing computeBriefing gives for the plan "Load demo" makes.
    const calm = { storm: false, spe: false, startLmst: STORY_START_LMST };
    const plan = planRoute(data.site, buildCostGrid(data.site, calm), data.site.habitat, data.stops);
    expect(briefing).toEqual(computeBriefing(data.site, plan, calm));
    expect(plan.distM).toBeCloseTo(data.plan.distM, 6);
    const row = (key: string) => briefing.rows.find((r) => r.key === key)!;
    expect(row("TERRAIN").value).not.toMatch(/no route/i);
    expect(row("CONSUMABLES").value).toContain(formatMinutes(data.plan.marginSec));
    expect(row("CONSUMABLES").value).not.toContain("100%");
    expect(briefing.status).toBe(data.plan.status);
    // App hands the Story page this briefing, not the Plan tab's plan.
    const app = read("../App.tsx");
    expect(app).toContain("demoBriefing(m.site, m.demo)");
    expect(app).not.toContain("computeBriefing(m.site, m.plan");
  });

  it("is labelled 'Demo mission briefing' and shows the planner's own row text", async () => {
    const { demoBriefing } = await import("../lib/story");
    const briefing = demoBriefing(data.site, data.stops)!;
    const page = renderToStaticMarkup(<MissionBriefing onBeginPlanning={() => {}} rows={briefing.rows} status={briefing.status} reasons={briefing.reasons} />);
    expect(page).toContain('id="briefing-poll-title">Demo mission briefing</h2>');
    for (const r of briefing.rows) expect(clean(page)).toContain(r.value);
    expect(clean(page)).not.toMatch(/No route yet/i);
  });

  it("the hero has no second ARES wordmark (the top bar has the one)", () => {
    const page = renderToStaticMarkup(<MissionBriefing onBeginPlanning={() => {}} />);
    expect(page).toContain("<header><span>MISSION CONTROL · STORY</span></header>");
  });
});

describe("contrast: white text on the filled-button blue", () => {
  it("is at least 4.5:1, and CLAUDE.md lists the same colour", () => {
    const hex = /--ds-blue-fill:\s*(#[0-9a-f]{6})/i.exec(read("../styles/theme-mono.css"))![1];
    const lin = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    expect(1.05 / (luminance + 0.05)).toBeGreaterThanOrEqual(4.5);
    expect(read("../../../CLAUDE.md")).toContain(`| \`--ds-blue-fill\` | \`${hex}\` |`);
  });
});
