// The printable mission briefing, rendered to an HTML string on the real site.json:
// it must carry the plan's own numbers, formatted as the app formats them.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { reliabilityOf } from "../lib/reliability";
import {
  buildCostGrid,
  computeBriefing,
  formatDuration,
  formatKm,
  formatLmst,
  formatMet,
  formatMinutes,
  formatPct,
  loadSite,
  oxygenBudget,
  planRoute,
} from "../planner";
import type { Conditions, Stop, WhatIf } from "../planner";
import { MONTE_CARLO_DISCLAIMER } from "../planner/montecarlo";
import { BRIEFING_CREDITS, BriefingSheet } from "./PrintBriefing";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const site = loadSite(JSON.parse(read("../../public/data/site.json")));
const conditions: Conditions = { storm: false, spe: false, startLmst: 13 };
const cost = buildCostGrid(site, conditions);
const demoStops: Stop[] = site.pois
  .filter((p) => p.kind === "science")
  .slice(0, 3)
  .map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin: 30 }));
const plan = planRoute(site, cost, site.habitat, demoStops);
const sheet = (props: { whatIf?: WhatIf; stops?: Stop[] } = {}) => {
  const stops = props.stops ?? demoStops;
  const p = planRoute(site, cost, site.habitat, stops, props.whatIf ? { whatIf: props.whatIf } : {});
  return renderToStaticMarkup(
    <BriefingSheet site={site} plan={p} stops={stops} conditions={conditions} basemapUrl="/data/basemap.png" whatIf={props.whatIf} printedOn="15 November 2026" />,
  );
};
const html = sheet();
const t = text(html);

describe("printable mission briefing", () => {
  it("has the title, the site, the start time and the date", () => {
    expect(html).toContain("<h1>ARES-1 EVA mission briefing</h1>");
    expect(t).toContain(`${site.name} · EVA start ${formatLmst(13)} LMST · printed 15 November 2026`);
    expect(t).toContain(`Overall ${plan.status}`);
  });

  it("lists every stop with its T+ arrival and science time, and the return", () => {
    demoStops.forEach((stop, i) => {
      expect(html).toContain(`<td>${String(i + 1).padStart(2, "0")}</td><th scope="row">${stop.label}</th><td>${formatMet(plan.legs[i].arriveSec)}</td><td>${formatMinutes(stop.dwellMin * 60)}</td>`);
    });
    expect(t).toContain(`Back at ${site.habitat.name} ${formatMet(plan.totalSec)}`);
    expect(t).toContain(`Distance ${formatKm(plan.distM)}`);
    expect(t).toContain(`Total time ${formatDuration(plan.totalSec)}`);
    expect(t).toContain(`Walking ${formatDuration(plan.walkSec)}`);
    expect(t).toContain(`Science ${formatDuration(plan.workSec)}`);
  });

  it("draws the real route on the map: one line per leg, the stops and the habitat", () => {
    const legs = [...html.matchAll(/<polyline class="briefing-map__route" points="([^"]+)"/g)].map((m) => m[1].split(" ").length);
    expect(legs).toEqual(plan.legs.map((leg) => leg.path.length));
    expect(html).toContain('<image href="/data/basemap.png"');
    expect(html.match(/class="briefing-map__stop"/g)).toHaveLength(3);
    expect(html).toContain('class="briefing-map__habitat"');
    for (const n of ["01", "02", "03"]) expect(html).toMatch(new RegExp(`class="briefing-map__number"[^>]*>${n}</text>`));
    expect(t).toContain("Image: NASA/JPL-Caltech/University of Arizona/USGS");
    // The crop is inside the picture and holds every point of the route.
    const [x, y, w, h] = /viewBox="([\d.\- ]+)"/.exec(html)![1].split(" ").map(Number);
    const mapW = (1000 * (site.bounds.east - site.bounds.west)) / (site.bounds.north - site.bounds.south);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(x + w).toBeLessThanOrEqual(mapW + 0.1);
    expect(y + h).toBeLessThanOrEqual(1000 + 0.1);
    for (const m of html.matchAll(/class="briefing-map__route" points="([^"]+)"/g))
      for (const pair of m[1].split(" ")) {
        const [px, py] = pair.split(",").map(Number);
        expect(px).toBeGreaterThanOrEqual(x - 0.1);
        expect(px).toBeLessThanOrEqual(x + w + 0.1);
        expect(py).toBeGreaterThanOrEqual(y - 0.1);
        expect(py).toBeLessThanOrEqual(y + h + 0.1);
      }
  });

  it("shows the GO / NO-GO poll rows with their status and evidence tag", () => {
    const poll = computeBriefing(site, plan, conditions);
    expect(poll.rows.map((r) => r.key)).toEqual(["TERRAIN", "CONSUMABLES", "RADIATION", "LIGHTING", "WEATHER"]);
    for (const row of poll.rows) {
      expect(html).toContain(`<th scope="row">${row.key}</th>`);
      expect(t).toContain(row.value);
      expect(html).toContain(`<span class="briefing-sheet__pill is-${row.status}">${row.status}</span>`);
      expect(html).toContain(`<span class="briefing-sheet__evidence">${row.evidence}</span>`);
    }
  });

  it("shows the oxygen budget with the plan's numbers and the app's own bar", () => {
    const budget = oxygenBudget(false);
    expect(t).toContain(`Used ${formatMinutes(plan.oxygenUsedSec)}`);
    expect(t).toContain(`Margin ${formatMinutes(plan.marginSec)}`);
    expect(t).toContain(`Reserve ${formatMinutes(budget.reserveSec)}`);
    expect(t).toContain(`Left at return ${formatPct(plan.oxygenAtReturnPct)}`);
    expect(t).toContain(`Suit supply ${formatMinutes(budget.budgetSec)}`);
    expect(html).toContain('class="budget-bar" role="img"');
  });

  it("shows the reliability summary from the shared simulation, with its disclaimer", () => {
    const sim = reliabilityOf(site, plan, { startLmst: 13 });
    expect(t).toContain(`${sim.successCount.toLocaleString("en-US")} of ${sim.trials.toLocaleString("en-US")} simulated versions of this walk get home with the reserve intact.`);
    expect(t).toContain(`Oxygen at return, 90% of runs: ${formatPct(sim.oxygenAtReturnPct.p5).replace("%", "")} to ${formatPct(sim.oxygenAtReturnPct.p95)}.`);
    expect(t).toContain(MONTE_CARLO_DISCLAIMER);
  });

  it("ends with the data credits, the team name and no personal names", () => {
    expect(t).toContain(BRIEFING_CREDITS);
    expect(BRIEFING_CREDITS).toMatch(/^Data: HiRISE.*NASA\/JPL-Caltech\/University of Arizona\/USGS.*THEMIS.*CRISM.*MEDA.*RAD/);
    expect(t).toContain("The Ares Initiative · NASA Space Apps 2026");
    expect(t).toMatch(/our assumptions, not spacesuit data/);
  });

  it("the numbers are the frozen demo numbers, and none is typed into the component", () => {
    const doc = read("../../../docs/demo-numbers.md");
    for (const shown of [formatKm(plan.distM), formatDuration(plan.totalSec), formatMinutes(plan.marginSec), formatPct(plan.oxygenAtReturnPct)]) {
      expect(doc).toContain(shown);
      expect(t).toContain(shown);
    }
    const source = read("./PrintBriefing.tsx");
    for (const number of [formatKm(plan.distM).replace(" km", ""), formatDuration(plan.totalSec), formatMinutes(plan.marginSec), "45 min", "1,000"]) expect(source.includes(number), number).toBe(false);
  });

  it("with What-if values: says so, lists them with the defaults, and uses them in the poll and the budget", () => {
    const whatIf = { consumableHours: 6, speedFactor: 0.8, reserveMin: 60 };
    const what = text(sheet({ whatIf }));
    const p = planRoute(site, cost, site.habitat, demoStops, { whatIf });
    expect(what).toContain("What-if values: not the planner's own assumptions");
    expect(what).toContain("Suit oxygen 6 h (default 8 h) · Walking speed −20% (default normal) · Reserve 60 min (default 45 min)");
    expect(what).toContain(`Overall ${p.status} What-if values`);
    expect(what).toContain(`Margin ${formatMinutes(p.marginSec)}`);
    expect(what).toContain(`Reserve ${formatMinutes(60 * 60)}`);
    expect(what).toContain(`Suit supply ${formatMinutes(6 * 3600)}`);
    expect(what).toContain(computeBriefing(site, p, conditions, whatIf).rows.find((r) => r.key === "CONSUMABLES")!.value);
    expect(what).toContain("the 60 min reserve"); // the poll quotes the what-if reserve
    expect(what).toContain("Not run with What-if values");
    expect(t).not.toContain("What-if values"); // the standard briefing has no such block
    // computeBriefing's new optional argument changes nothing when it is left out.
    expect(computeBriefing(site, plan, conditions, {})).toEqual(computeBriefing(site, plan, conditions));
  });

  it("an empty plan still prints: no route, no numbers made up", () => {
    const empty = text(sheet({ stops: [] }));
    expect(empty).toContain("Overall NO PLAN");
    expect(empty).toContain("No route yet.");
    expect(empty).not.toMatch(/NaN|undefined|Infinity/);
  });

  it("opens from the Mission tools row and the View menu, prints by itself, and prints on a light page", () => {
    const app = read("../App.tsx");
    const more = app.slice(app.indexOf('<details className="collapsible more-details">'), app.indexOf("</details>", app.indexOf('<details className="collapsible more-details">')));
    expect(more).not.toContain("setBriefingOpen"); // no duplicate in More details
    expect(app.slice(app.indexOf("<MissionTools"), app.indexOf("</MissionTools>"))).toMatch(/canBrief=\{canBrief\}[\s\S]*onBriefing=\{\(\) => setBriefingOpen\(true\)\}/);
    expect(app).toContain('{ id: "briefing", label: "Download briefing", onSelect: () => setBriefingOpen(true) }');
    const component = read("./PrintBriefing.tsx");
    expect(component).toMatch(/window\.setTimeout\(\(\) => window\.print\(\), \d+\)/); // prints automatically
    const css = read("../styles/print-briefing.css");
    expect(css).toMatch(/\.briefing-sheet \{[^}]*background: #ffffff;/); // light background
    const print = css.slice(css.indexOf("@media print"));
    expect(print).toContain("#root > * > *:not(.print-briefing)"); // only the sheet prints
    expect(print).toMatch(/\.print-briefing__bar \{\s*display: none;/);
  });
});
