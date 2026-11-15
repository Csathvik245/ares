// The map probe's verdict line, on the real site.json.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BASE_SPEED_KMH, MAX_SLOPE_DEG, ROCK_NO_GO, SAND_TI_THRESHOLD, buildCostGrid, loadSite, roundHalfUp } from "../planner";
import { groundProblem } from "../planner/cost";
import { PROBE_SOURCES, probeVerdict } from "./probe";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");
const site = loadSite(JSON.parse(read("../../public/data/site.json")));
const cost = buildCostGrid(site, { storm: false, spe: false, startLmst: 13 });
const count = site.width * site.height;
const first = (test: (i: number) => boolean) => {
  for (let i = 0; i < count; i++) if (test(i)) return i;
  return -1;
};
const sandy = (i: number) => site.layers.thermalInertia[i] < SAND_TI_THRESHOLD;

describe("map probe: why ground is off-limits", () => {
  it("is no-go exactly where the planner will not route, for every cell of the site", () => {
    let noGo = 0;
    for (let i = 0; i < count; i++) {
      const v = probeVerdict(site, i);
      if (v.walkable !== (groundProblem(site, i) === null)) throw new Error(`cell ${i}: verdict and groundProblem disagree`);
      if (v.walkable !== Number.isFinite(cost.secPerM[i])) throw new Error(`cell ${i}: verdict and the cost grid disagree`);
      if (!v.text.startsWith(v.walkable ? "Walkable" : "No-go: ")) throw new Error(`cell ${i}: "${v.text}"`);
      if (!v.walkable) noGo++;
    }
    expect(noGo).toBeGreaterThan(0);
  });

  it("a cell that is too steep says its slope and the limit", () => {
    const cell = first((i) => site.layers.slope[i] > MAX_SLOPE_DEG);
    expect(cell).toBeGreaterThanOrEqual(0);
    const text = probeVerdict(site, cell).text;
    expect(text).toBe(`No-go: slope ${roundHalfUp(site.layers.slope[cell])}° is over the ${MAX_SLOPE_DEG}° limit`);
    expect(text).toMatch(/^No-go: slope \d+° is over the 25° limit$/);
    expect(groundProblem(site, cell)).toContain("slope over");
  });

  it("a cell that is only too rough says its roughness and the limit", () => {
    const cell = first((i) => site.layers.slope[i] <= MAX_SLOPE_DEG && site.layers.rock[i] > ROCK_NO_GO);
    expect(cell).toBeGreaterThanOrEqual(0);
    expect(probeVerdict(site, cell).text).toBe(`No-go: roughness ${roundHalfUp(site.layers.rock[cell], 2).toFixed(2)} is over the ${ROCK_NO_GO} limit`);
    expect(groundProblem(site, cell)).toContain("too rough");
  });

  it("missing data and points off the map are explained too", () => {
    const hole = { ...site, layers: { ...site.layers, slope: Float32Array.from(site.layers.slope) } };
    hole.layers.slope[0] = NaN;
    expect(probeVerdict(hole, 0).text).toBe("No-go: no terrain data here");
    expect(probeVerdict(site, -1).text).toBe("No-go: outside the mapped area");
    expect(probeVerdict(site, count).text).toBe("No-go: outside the mapped area");
  });

  it("walkable ground says what slows it down: soft sand, slope, or nothing", () => {
    const sand = first((i) => groundProblem(site, i) === null && sandy(i));
    expect(probeVerdict(site, sand).text).toMatch(/^Walkable: \d+% of flat-ground speed \(.*soft sand.*\)$/);
    const steepButFine = first((i) => groundProblem(site, i) === null && site.layers.slope[i] > 15 && !sandy(i));
    const steepText = probeVerdict(site, steepButFine).text;
    expect(steepText).toMatch(/^Walkable: \d+% of flat-ground speed \(slope/);
    expect(steepText).not.toContain("soft sand");
    // The percentage is the planner's own speed for that cell, against flat firm ground.
    const pct = Number(/(\d+)%/.exec(steepText)![1]);
    expect(pct).toBe(roundHalfUp((1 / cost.secPerM[steepButFine] / (BASE_SPEED_KMH / 3.6)) * 100));
    const easy = first((i) => groundProblem(site, i) === null && site.layers.slope[i] < 0.5 && site.layers.rock[i] < 0.02 && !sandy(i));
    if (easy >= 0) expect(probeVerdict(site, easy).text).toBe("Walkable: firm, gentle ground");
  });

  it("each value carries its source tag, and the verdict is in the danger colour when no-go", () => {
    expect(PROBE_SOURCES).toEqual({ elevation: "HiRISE", slope: "HiRISE", ground: "THEMIS", science: "CRISM", walkHome: "calculated" });
    const map = read("../components/MissionMap.tsx");
    for (const key of Object.keys(PROBE_SOURCES)) expect(map).toContain(`<small>{PROBE_SOURCES.${key}}</small>`);
    expect(map).toContain("probeVerdict(site, hover.cell)");
    expect(map).toContain('verdict.walkable ? "is-walkable" : "is-nogo"');
    const css = read("../styles/sidebar-fit.css");
    expect(css).toMatch(/\.map-probe__verdict\.is-nogo \{\s*color: var\(--nogo\);/);
    expect(css).toMatch(/\.map-probe \{\s*width: 256px;\s*min-height: 156px;/); // one fixed size: no jumping
  });
});
