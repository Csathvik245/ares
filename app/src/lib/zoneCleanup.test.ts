import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCostGrid, loadSite, planRoute, safeZone } from "../planner";
import type { Stop } from "../planner";
import { DEFAULT_MIN_CELLS, removeSmallIslands } from "./zoneCleanup";

const W = 20;
const H = 16;
const at = (row: number, col: number) => row * W + col;
const count = (m: Uint8Array) => m.reduce((n, v) => n + v, 0);

/** A big inside block (rows 2-11, cols 2-13 = 120 cells) on an outside background. */
function block(): Uint8Array {
  const m = new Uint8Array(W * H);
  for (let r = 2; r <= 11; r++) for (let c = 2; c <= 13; c++) m[at(r, c)] = 1;
  return m;
}

describe("removeSmallIslands", () => {
  it("defaults to 12 cells", () => expect(DEFAULT_MIN_CELLS).toBe(12));

  it("fills a small outside pocket inside the zone", () => {
    const m = block();
    for (const [r, c] of [[5, 5], [5, 6], [6, 6]]) m[at(r, c)] = 0; // 3-cell hole, joined diagonally
    const out = removeSmallIslands(m, W, H);
    expect(out[at(5, 5)]).toBe(1);
    expect(out[at(6, 6)]).toBe(1);
    expect(count(out)).toBe(120);
  });

  it("removes a small inside speck outside the zone", () => {
    const m = block();
    m[at(14, 17)] = 1;
    m[at(15, 18)] = 1; // touches only diagonally: one 2-cell speck with 8-connectivity
    const out = removeSmallIslands(m, W, H);
    expect(out[at(14, 17)]).toBe(0);
    expect(out[at(15, 18)]).toBe(0);
    expect(count(out)).toBe(120);
  });

  it("keeps big regions and big holes", () => {
    const m = block();
    for (let r = 4; r <= 7; r++) for (let c = 4; c <= 7; c++) m[at(r, c)] = 0; // 16-cell hole
    const out = removeSmallIslands(m, W, H);
    expect(Array.from(out)).toEqual(Array.from(m));
  });

  it("uses minCells as the cut-off: a group of exactly minCells stays", () => {
    const m = new Uint8Array(W * H);
    for (let c = 0; c < 5; c++) m[at(8, c + 3)] = 1; // 5-cell speck
    expect(count(removeSmallIslands(m, W, H, 5))).toBe(5);
    expect(count(removeSmallIslands(m, W, H, 6))).toBe(0);
    expect(count(removeSmallIslands(m, W, H, 1))).toBe(5); // 1 = remove nothing
  });

  it("does not change the input and returns a new array", () => {
    const m = block();
    m[at(5, 5)] = 0;
    m[at(14, 17)] = 1;
    const before = Array.from(m);
    const out = removeSmallIslands(m, W, H);
    expect(out).not.toBe(m);
    expect(Array.from(m)).toEqual(before);
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out.length).toBe(m.length);
  });

  it("handles all-inside and all-outside masks, and rejects a wrong size", () => {
    expect(count(removeSmallIslands(new Uint8Array(W * H), W, H))).toBe(0);
    expect(count(removeSmallIslands(new Uint8Array(W * H).fill(1), W, H))).toBe(W * H);
    expect(() => removeSmallIslands(new Uint8Array(10), W, H)).toThrow(RangeError);
    // An empty mask ("no zone", as the app passes during an emergency) stays empty.
    expect(removeSmallIslands(new Uint8Array(0), W, H)).toEqual(new Uint8Array(0));
  });
});

describe("removeSmallIslands on the real 320 x 240 zone", () => {
  const site = loadSite(
    JSON.parse(readFileSync(new URL("../../public/data/site.json", import.meta.url), "utf8")),
  );
  const cost = buildCostGrid(site, { storm: false, spe: false, startLmst: 13 });
  const stops: Stop[] = site.pois
    .filter((p) => p.kind === "science")
    .slice(0, 3)
    .map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin: 30 }));
  const zone = safeZone(site, cost, planRoute(site, cost, site.habitat, stops));

  it("runs in under 20 ms and only changes small groups", () => {
    removeSmallIslands(zone, site.width, site.height); // warm-up
    const times: number[] = [];
    let out = zone;
    for (let i = 0; i < 9; i++) {
      const t0 = performance.now();
      out = removeSmallIslands(zone, site.width, site.height);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    let changed = 0;
    for (let i = 0; i < zone.length; i++) if (zone[i] !== out[i]) changed++;
    console.log(
      `removeSmallIslands on the demo-mission zone: median ${times[4].toFixed(2)} ms; ` +
        `${count(zone)} cells inside before, ${count(out)} after, ${changed} cells changed`,
    );
    expect(times[4]).toBeLessThan(20);
    expect(count(zone)).toBeGreaterThan(1000); // a real zone, so the timing means something
    expect(changed).toBeLessThan(zone.length * 0.02);
    // Cleaning twice changes nothing more.
    expect(Array.from(removeSmallIslands(out, site.width, site.height))).toEqual(Array.from(out));
  });
});
