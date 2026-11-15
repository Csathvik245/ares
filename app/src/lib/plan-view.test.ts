// Checks for the Plan view polish: the terrain layer the demo switches on, the drawn
// safe-return zone (fill, smooth edge, the box the map fits to) and the header rules.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMO_LAYER, withDemoLayer } from "../components/LayerRail";
import { buildCostGrid, loadSite, planRoute, safeZone } from "../planner";
import type { Stop } from "../planner";
import { LAYER_OPACITY, ZONE_SCALE, difficultyAlpha, layerOpacity, layers, smoothZoneMask, zoneBounds } from "./layers";
import { removeSmallIslands } from "./zoneCleanup";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");
const site = loadSite(JSON.parse(read("../../public/data/site.json")));
const cost = buildCostGrid(site, { storm: false, spe: false, startLmst: 13 });
const demoStops: Stop[] = site.pois
  .filter((p) => p.kind === "science")
  .slice(0, 3)
  .map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin: 30 }));
const plan = planRoute(site, cost, site.habitat, demoStops);
const zone = safeZone(site, cost, plan);

describe("terrain layer for the demo mission", () => {
  it("is Walking difficulty, drawn lighter than the other layers", () => {
    expect(layers.find((l) => l.id === DEMO_LAYER)?.name).toBe("Walking difficulty");
    expect(layerOpacity(DEMO_LAYER)).toBeCloseTo(0.25, 2);
    // In an emergency it fades so the route home dominates; Reset ends the emergency and restores it.
    expect(layerOpacity(DEMO_LAYER, true)).toBeCloseTo(0.12, 2);
    expect(layerOpacity(DEMO_LAYER, false)).toBe(LAYER_OPACITY[DEMO_LAYER]);
    expect(layerOpacity("science", true)).toBe(LAYER_OPACITY.science);
    expect(read("../components/MissionMap.tsx")).toContain("layerOpacity(kind, emergency)");
    for (const l of layers) if (l.id !== DEMO_LAYER) expect(LAYER_OPACITY[l.id]).toBeGreaterThan(layerOpacity(DEMO_LAYER));
  });

  it("is added once, keeps the layers already on, and does nothing when it is on", () => {
    expect(withDemoLayer([])).toEqual(["difficulty"]);
    expect(withDemoLayer(["science"])).toEqual(["science", "difficulty"]);
    const on = ["difficulty", "sand"] as const;
    expect(withDemoLayer([...on])).toEqual([...on]);
  });

  it("only loading the demo asks for it: adding a stop by hand does not", () => {
    const source = read("./MissionContext.tsx");
    expect(source.match(/setTerrainHint\(true\)/g)).toHaveLength(1);
    const loadDemo = source.slice(source.indexOf("const loadDemo"), source.indexOf("const add ="));
    expect(loadDemo).toContain("setTerrainHint(true)");
  });

  it("tints slow ground and leaves the fastest ground clear", () => {
    const min = cost.minSecPerM;
    expect(difficultyAlpha(min, min)).toBe(0);
    expect(difficultyAlpha(min * 4, min)).toBe(255);
    expect(difficultyAlpha(min * 40, min)).toBe(255);
    expect(difficultyAlpha(Infinity, min)).toBe(0); // no-go cells get their own red, not a tint
    let last = -1;
    for (let k = 1; k <= 4; k += 0.25) {
      const a = difficultyAlpha(min * k, min);
      expect(a).toBeGreaterThanOrEqual(last);
      last = a;
    }
    // Soft sand alone (speed x 0.55) must already be easy to see.
    expect(difficultyAlpha(min / 0.55, min)).toBeGreaterThan(100);
  });
});

describe("the drawn safe-return zone", () => {
  const drawn = removeSmallIslands(zone, site.width, site.height);

  it("the box around the zone holds every zone cell, the habitat and all demo stops", () => {
    const box = zoneBounds(site, drawn)!;
    expect(box.south).toBeGreaterThanOrEqual(site.bounds.south);
    expect(box.north).toBeLessThanOrEqual(site.bounds.north);
    expect(box.west).toBeGreaterThanOrEqual(site.bounds.west);
    expect(box.east).toBeLessThanOrEqual(site.bounds.east);
    for (const p of [site.habitat, ...demoStops]) {
      expect(p.lat).toBeGreaterThan(box.south);
      expect(p.lat).toBeLessThan(box.north);
      expect(p.lng).toBeGreaterThan(box.west);
      expect(p.lng).toBeLessThan(box.east);
    }
    const dLat = (site.bounds.north - site.bounds.south) / site.height;
    const dLng = (site.bounds.east - site.bounds.west) / site.width;
    for (let i = 0; i < drawn.length; i++) {
      if (!drawn[i]) continue;
      const row = Math.floor(i / site.width),
        col = i % site.width;
      expect(site.bounds.north - (row + 0.5) * dLat).toBeGreaterThan(box.south);
      expect(site.bounds.north - (row + 0.5) * dLat).toBeLessThan(box.north);
      expect(site.bounds.west + (col + 0.5) * dLng).toBeGreaterThan(box.west);
      expect(site.bounds.west + (col + 0.5) * dLng).toBeLessThan(box.east);
    }
  });

  it("an empty zone (an emergency) has no box", () => {
    expect(zoneBounds(site, new Uint8Array(0))).toBeNull();
    expect(zoneBounds(site, new Uint8Array(site.width * site.height))).toBeNull();
  });

  it("smoothing keeps the zone's size and never moves the edge by more than a cell", () => {
    const smooth = smoothZoneMask(drawn, site.width, site.height);
    expect(smooth.length).toBe(drawn.length * ZONE_SCALE * ZONE_SCALE);
    const W = site.width * ZONE_SCALE;
    let before = 0,
      after = 0;
    for (const v of drawn) before += v;
    for (const v of smooth) after += v;
    expect(Math.abs(after / (ZONE_SCALE * ZONE_SCALE) - before) / before).toBeLessThan(0.02);
    // A cell whose whole 3 x 3 neighbourhood agrees keeps its value in every pixel.
    for (let row = 1; row < site.height - 1; row++)
      for (let col = 1; col < site.width - 1; col++) {
        const v = drawn[row * site.width + col];
        let same = true;
        for (let dr = -1; dr <= 1 && same; dr++)
          for (let dc = -1; dc <= 1 && same; dc++) same = drawn[(row + dr) * site.width + col + dc] === v;
        if (!same) continue;
        for (let py = 0; py < ZONE_SCALE; py++)
          for (let px = 0; px < ZONE_SCALE; px++)
            if (smooth[(row * ZONE_SCALE + py) * W + col * ZONE_SCALE + px] !== v)
              throw new Error(`cell ${row},${col} changed deep inside or outside the zone`);
      }
  });

  it("smoothing rounds a staircase: a diagonal edge has no full-cell steps left", () => {
    const n = 12;
    const stairs = new Uint8Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) stairs[y * n + x] = x + y < n ? 1 : 0;
    const smooth = smoothZoneMask(stairs, n, n, 4);
    // Along the diagonal the edge now moves one pixel at a time, not four.
    const edgeX = (Y: number) => {
      let x = 0;
      while (x < n * 4 && smooth[Y * n * 4 + x]) x++;
      return x;
    };
    for (let Y = 8; Y < n * 4 - 8; Y++) expect(Math.abs(edgeX(Y) - edgeX(Y + 1))).toBeLessThanOrEqual(2);
    expect(smoothZoneMask(new Uint8Array(0), n, n)).toHaveLength(0);
  });

  it("is drawn with a faint fill as well as the edge", () => {
    const source = read("./layers.ts");
    const fill = /const ZONE_FILL = \[(\d+), (\d+), (\d+), (\d+)\]/.exec(source)!;
    expect(Number(fill[4]) / 255).toBeGreaterThan(0.05);
    expect(Number(fill[4]) / 255).toBeLessThan(0.07);
    expect(read("../components/MissionMap.tsx")).toContain("zoneRaster(site, drawnZone)");
  });
});

describe("header", () => {
  const css = read("../styles/theme-deep-space.css");
  const app = read("../App.tsx");

  it("no longer carries the mission name or a second pill: the header is logo, tabs, one pill, Run the demo, View", () => {
    const start = app.indexOf('<header className="console-header">');
    const header = app.slice(start, app.indexOf("</header>", start));
    expect(header).not.toContain("Surface Traverse Software");
    expect(header).not.toContain("brand-context");
    expect(header).not.toContain("return-status");
    expect(header).toContain("<ViewMenu items={viewItems} />");
  });

  it("the one status pill cannot shrink or wrap; in an emergency it names the route to follow, with the EVA status in its tooltip", () => {
    expect(css).toMatch(/\.header-actions > \.status \{\s*flex-shrink: 0;\s*white-space: nowrap;/);
    expect(app).toMatch(/const headerPillText = emergency && abort \? `\$\{m\.replanned \? "NEW PLAN" : "RETURN HOME"\} · \$\{abort\.status\}`/);
    expect(app).toContain("title={headerPillTitle}");
  });
});

describe("tablet touch targets", () => {
  const css = read("../styles/tablet-touch.css");
  it("the console tabs and the header, banner, demo and Play buttons are at least 44 px on tablet", () => {
    const tablet = css.slice(css.indexOf("@media (max-width: 1024px)"));
    expect(tablet).toMatch(/\.tablet-tabs button \{\s*min-height: var\(--touch-target\)/);
    for (const part of [".header-actions > button", ".storm-alert button", ".guided-demo__actions button", ".timeline-controls button"])
      expect(tablet).toContain(part);
    expect(read("../styles/tokens.css")).toMatch(/--touch-target:\s*44px/);
    expect(read("../main.tsx")).toContain('import "./styles/tablet-touch.css";');
  });
  it("the guided demo's main button uses the filled-button blue, which keeps white text readable", () => {
    const demo = read("../components/guided-demo.css");
    expect(demo).toMatch(/button\.guided-demo__next \{[^}]*background: var\(--ds-blue-fill\);[^}]*color: #ffffff;/);
  });
});

describe("sidebar fit: nothing hidden behind the pinned emergency block", () => {
  const css = read("../styles/sidebar-fit.css");
  const panel = read("../components/MissionPanel.tsx");
  const block = panel.slice(panel.indexOf('<footer className="emergency-controls"'), panel.indexOf("</footer>"));

  it("the emergency block is one row and one small line; the hint lives in tooltips", () => {
    expect(block).not.toContain('className="emergency-hint"');
    // The hint is still there for everyone: the (?) beside the title, and the button's own tooltip.
    expect(block).toContain('aria-label={emergencyHint}');
    expect(block.match(/title=\{emergencyHint\}/g)).toHaveLength(2); // Trigger and Reset
    expect(panel).toContain("Starts at the playback time unless you type another.");
    expect(panel).toContain("Add a route first: an emergency needs a walk to interrupt.");
    // Nothing was dropped: title, evidence tag, both demo links and the SPE explanation.
    for (const kept of ["Emergency simulation", "EVIDENCE_LABELS.emergency", "Demo: storm at T+1:16", "Demo: SPE at Wildcat Ridge", '<Jargon term="SPE" />'])
      expect(block).toContain(kept);
    expect(css).toMatch(/\.emergency-demos \{[^}]*flex-wrap: nowrap;/);
    expect(css).toMatch(/\.emergency-controls \.jargon__tip \{\s*top: auto;\s*bottom:/); // tooltips open upward, into view
  });

  it("the scrolling area keeps air above the block, and the block is a flex child, not an overlay", () => {
    expect(css).toMatch(/\.telemetry-scroll \{\s*padding-bottom: 16px;/);
    expect(css).not.toMatch(/\.emergency-controls \{[^}]*position: (absolute|fixed|sticky)/);
  });

  it("short screens: the four tiles become one compact row", () => {
    const short = css.slice(css.indexOf("@media (max-height: 759px)"), css.indexOf("/* ---------- 5."));
    expect(short).toMatch(/\.stat-tiles \{\s*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/);
    expect(short).toMatch(/\.stat-tiles dd \{[^}]*font: 600 13px/);
    expect(short).toMatch(/\.tile-long::after \{\s*content: attr\(data-short\);/);
  });

  it("the duration tile's sub-line wraps between its two parts and is never cut", () => {
    expect(panel).toMatch(/<small className="tile-parts">\s*<span>\{clock\(display\.walkSec\)\} walk<\/span>/);
    expect(panel).toContain('<span className="tile-long" data-short="sci">science</span>');
    expect(css).toMatch(/\.tile-parts > span \{\s*white-space: nowrap;/);
    expect(css).toMatch(/\.stat-tiles small \{[^}]*text-overflow: clip;/);
  });

  it("the empty-plan card sits at the top and the map fits below it, clear of HAB-1", () => {
    expect(css).toMatch(/\.empty-plan-card \{\s*top: 12px;\s*transform: translateX\(-50%\);/);
    expect(read("../components/MissionMap.tsx")).toContain('bottomOf(".empty-plan-card", 44)');
  });
});
