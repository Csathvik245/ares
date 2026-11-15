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
    expect(layerOpacity(DEMO_LAYER)).toBeCloseTo(0.45, 2);
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
    expect(Number(fill[4]) / 255).toBeGreaterThan(0.08);
    expect(Number(fill[4]) / 255).toBeLessThan(0.13);
    expect(read("../components/MissionMap.tsx")).toContain("zoneRaster(site, drawnZone)");
  });
});

describe("header", () => {
  const css = read("../styles/theme-deep-space.css");
  const app = read("../App.tsx");

  it("drops '· Surface Traverse Software' below 1600 px", () => {
    expect(app).toContain('Jezero delta front<span className="brand-context-long"> · Surface Traverse Software</span>');
    expect(css).toMatch(/@media \(max-width: 1599px\) \{\s*[^{}]*\.brand-context-long \{\s*display: none;/);
  });

  it("the status pills cannot shrink or wrap, and only the reason after 'RETURN HOME' may shorten", () => {
    expect(css).toMatch(/\.header-actions > \.status \{\s*flex-shrink: 0;\s*white-space: nowrap;/);
    expect(css).toMatch(/\.return-status > b \{\s*flex: none;[^}]*white-space: nowrap;/);
    expect(app).toMatch(/<b>\{m\.replanned \? "NEW PLAN" : "RETURN HOME"\} · \{abort\.status\}<\/b>/);
    expect(app).toContain('className="return-reason"');
  });
});
