// Render checks for ReliabilityPanel and EvidenceTag, on the real site.json.
// They render to an HTML string (no browser needed) and look for what must be there.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildCostGrid, formatDuration, formatPct, loadSite, planRoute } from "../planner";
import type { Stop } from "../planner";
import { MONTE_CARLO_DISCLAIMER, simulateMission } from "../planner/montecarlo";
import { EvidenceTag } from "./EvidenceTag";
import { ReliabilityPanel } from "./ReliabilityPanel";

const site = loadSite(JSON.parse(readFileSync(new URL("../../public/data/site.json", import.meta.url), "utf8")));
const cost = buildCostGrid(site, { storm: false, spe: false, startLmst: 13 });
const stopsWith = (dwellMin: number): Stop[] =>
  site.pois
    .filter((p) => p.kind === "science")
    .slice(0, 3)
    .map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin }));
const demo = planRoute(site, cost, site.habitat, stopsWith(30));

describe("ReliabilityPanel", () => {
  it("is collapsed by default and opens on request", () => {
    const closed = renderToStaticMarkup(<ReliabilityPanel site={site} plan={demo} />);
    expect(closed).toContain("MISSION RELIABILITY");
    expect(closed).toMatch(/<details class="reliability">/);
    expect(renderToStaticMarkup(<ReliabilityPanel site={site} plan={demo} defaultOpen />)).toMatch(/<details class="reliability" open="">/);
  });

  it("shows the run, the result, the percentiles, the histogram, three sensitivity bars and the disclaimer", () => {
    const r = simulateMission(site, demo);
    const html = renderToStaticMarkup(<ReliabilityPanel site={site} plan={demo} defaultOpen />);
    expect(html).toContain("1,000 trials · seed 42");
    expect(html).toContain("100.0%</b>");
    expect(html).toContain("returned with the reserve intact");
    expect(html).toContain(`Success ${r.successCount.toLocaleString("en-US")} · Fail ${r.failCount}`);
    for (const q of ["p5", "p50", "p95"] as const) {
      expect(html).toContain(`<td>${formatPct(r.oxygenAtReturnPct[q])}</td>`);
      expect(html).toContain(`<td>${formatDuration(r.durationMin[q] * 60)}</td>`);
    }
    expect(html.match(/class="reliability__bar/g)).toHaveLength(r.histogramMarginMin.counts.length);
    expect(html.match(/class="reliability__fill"/g)).toHaveLength(3);
    for (const s of r.sensitivity.slice(0, 3)) expect(html).toContain(s.label);
    expect(html).not.toContain(r.sensitivity[3].label);
    expect(html).toContain(MONTE_CARLO_DISCLAIMER);
    expect(html).toContain(">ASSUMED</span>");
    expect(html).not.toContain("NaN");
  });

  it("marks the reserve line when some trials end inside the reserve", () => {
    // 100 min at each stop leaves a thin margin, so the trials fall on both sides of the reserve.
    const tight = planRoute(site, cost, site.habitat, stopsWith(100));
    const r = simulateMission(site, tight);
    expect(r.failCount).toBeGreaterThan(0);
    expect(r.successCount).toBeGreaterThan(0);
    const html = renderToStaticMarkup(<ReliabilityPanel site={site} plan={tight} defaultOpen />);
    expect(html).toContain('class="reliability__reserve"');
    expect(html).toContain("reliability__bar--fail");
    expect(html).toContain("red line = reserve");
    // The demo plan never touches the reserve: no line, and the caption says so.
    const demoHtml = renderToStaticMarkup(<ReliabilityPanel site={site} plan={demo} defaultOpen />);
    expect(demoHtml).not.toContain('class="reliability__reserve"');
    expect(demoHtml).toContain("every trial kept the reserve");
  });

  it("gives a plain message, and still the disclaimer, when there is nothing to simulate", () => {
    const empty = renderToStaticMarkup(<ReliabilityPanel site={site} plan={planRoute(site, cost, site.habitat, [])} defaultOpen />);
    expect(empty).toContain("Add a stop to simulate the mission.");
    expect(empty).toContain(MONTE_CARLO_DISCLAIMER);
    const unreachable = planRoute(site, cost, site.habitat, [{ id: "x", label: "x", lat: 10, lng: 10, dwellMin: 10 }]);
    const html = renderToStaticMarkup(<ReliabilityPanel site={site} plan={unreachable} defaultOpen />);
    expect(html).toContain("cannot be simulated");
    expect(html).not.toContain("NaN");
  });
});

describe("EvidenceTag", () => {
  it("shows the level as a word, with its meaning as a tooltip", () => {
    for (const level of ["OBSERVED", "CALCULATED", "INTERPRETED", "ASSUMED"] as const) {
      const html = renderToStaticMarkup(<EvidenceTag level={level} />);
      expect(html).toContain(`>${level}</span>`);
      expect(html).toContain(`evidence-tag--${level.toLowerCase()}`);
      expect(html).toMatch(/title="[^"]{10,}"/);
    }
  });
});
