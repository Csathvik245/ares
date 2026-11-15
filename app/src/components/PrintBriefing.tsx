// The printable mission briefing: one page about the CURRENT plan, on a light background.
// "Download briefing" opens it over the app and calls window.print(), so it can be saved
// as a PDF. Every number is the planner's, formatted with format.ts.
import { useEffect, useRef } from "react";
import { reliabilityOf } from "../lib/reliability";
import {
  WHAT_IF_DEFAULTS,
  computeBriefing,
  formatDuration,
  formatKm,
  formatLmst,
  formatMet,
  formatMinutes,
  formatPct,
  isWhatIf,
  oxygenBudget,
  roundHalfUp,
  type Conditions,
  type LatLng,
  type Plan,
  type Site,
  type Stop,
  type WhatIf,
} from "../planner";
import { MONTE_CARLO_DISCLAIMER } from "../planner/montecarlo";
import { OxygenBar } from "./OxygenBar";
import { WHAT_IF_SLIDERS, WHAT_IF_TAG } from "./WhatIfPanel";
import "../styles/print-briefing.css";

export const BRIEFING_CREDITS =
  "Data: HiRISE image and elevation (NASA/JPL-Caltech/University of Arizona/USGS), THEMIS thermal inertia (NASA/JPL-Caltech/ASU), CRISM minerals (NASA/JPL-Caltech/JHUAPL), MEDA temperature and RAD radiation (NASA/JPL-Caltech).";

export type BriefingProps = {
  site: Site;
  plan: Plan;
  stops: Stop[];
  conditions: Conditions;
  /** The HiRISE picture for the route map. Without it the route is drawn on a plain panel. */
  basemapUrl?: string;
  /** The What if? values in use. Leave out (or pass the defaults) for the standard plan. */
  whatIf?: WhatIf;
  /** The date printed under the title. A string, so a test can fix it. */
  printedOn: string;
};

// The route map is drawn in a made-up picture 1000 units tall and as wide as the site is
// (in degrees, like the basemap image itself), then cropped to the route.
const MAP_H = 1000;
function routeMap(site: Site, plan: Plan, stops: Stop[]) {
  const { south, north, west, east } = site.bounds;
  const W = (MAP_H * (east - west)) / (north - south);
  const at = (p: LatLng) => ({ x: ((p.lng - west) / (east - west)) * W, y: ((north - p.lat) / (north - south)) * MAP_H });
  const legs = plan.legs.map((leg) => leg.path.map(at));
  const marks = stops.map((s, i) => ({ ...at(s), number: String(i + 1).padStart(2, "0") }));
  const habitat = at(site.habitat);
  const all = [habitat, ...marks, ...legs.flat()];
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  // A 3:2 frame around everything, with air, kept inside the picture.
  let w = Math.max(60, (Math.max(...xs) - Math.min(...xs)) * 1.3);
  let h = Math.max(40, (Math.max(...ys) - Math.min(...ys)) * 1.3);
  if (w / h < 1.5) w = h * 1.5;
  else h = w / 1.5;
  w = Math.min(w, W);
  h = Math.min(h, MAP_H);
  const x = Math.min(Math.max(0, (Math.max(...xs) + Math.min(...xs)) / 2 - w / 2), W - w);
  const y = Math.min(Math.max(0, (Math.max(...ys) + Math.min(...ys)) / 2 - h / 2), MAP_H - h);
  return { W, legs, marks, habitat, view: { x, y, w, h } };
}
const points = (list: { x: number; y: number }[]) => list.map((p) => `${roundHalfUp(p.x, 1)},${roundHalfUp(p.y, 1)}`).join(" ");

/** The sheet itself. No state: what is printed is exactly what it is given. */
export function BriefingSheet({ site, plan, stops, conditions, basemapUrl, whatIf, printedOn }: BriefingProps) {
  const whatIfOn = isWhatIf(whatIf);
  const overrides = whatIfOn ? whatIf : undefined;
  const poll = computeBriefing(site, plan, conditions, overrides);
  const budget = oxygenBudget(conditions.storm, overrides);
  const hasRoute = plan.legs.length > 0;
  // The Monte Carlo run varies the planner's own values, so it is only quoted for the standard plan.
  const sim = hasRoute && plan.ok && !whatIfOn ? reliabilityOf(site, plan, { startLmst: conditions.startLmst }) : null;
  const map = hasRoute ? routeMap(site, plan, stops) : null;
  const r = map ? map.view.w / 46 : 0; // marker radius, in map units

  return (
    <article className="briefing-sheet">
      <header className="briefing-sheet__head">
        <div>
          <p className="briefing-sheet__kicker">ARES · Astronaut Route &amp; EVA Safety</p>
          <h1>ARES-1 EVA mission briefing</h1>
          <p className="briefing-sheet__meta">
            {site.name} · EVA start {formatLmst(conditions.startLmst)} LMST · printed {printedOn}
          </p>
        </div>
        <div className={`briefing-sheet__status is-${poll.status}`}>
          <span>Overall</span>
          <strong>{plan.legs.length === 0 ? "NO PLAN" : plan.status}</strong>
          {whatIfOn && <em>{WHAT_IF_TAG}</em>}
        </div>
      </header>

      {plan.reasons.length > 0 && (
        <ul className="briefing-sheet__reasons">
          {plan.reasons.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>
      )}

      {whatIfOn && whatIf && (
        <section className="briefing-sheet__whatif" aria-label={WHAT_IF_TAG}>
          <h2>{WHAT_IF_TAG}: not the planner's own assumptions</h2>
          <p>
            {WHAT_IF_SLIDERS.map((s) => {
              const value = whatIf[s.key] ?? WHAT_IF_DEFAULTS[s.key];
              return `${s.label} ${s.show(value)} (default ${s.show(WHAT_IF_DEFAULTS[s.key])})`;
            }).join(" · ")}
          </p>
        </section>
      )}

      <div className="briefing-sheet__columns">
        <section aria-label="Stops">
          <h2>Stops</h2>
          <table>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Stop</th>
                <th scope="col">Arrive</th>
                <th scope="col">Science</th>
              </tr>
            </thead>
            <tbody>
              {stops.map((s, i) => (
                <tr key={s.id}>
                  <td>{String(i + 1).padStart(2, "0")}</td>
                  <th scope="row">{s.label}</th>
                  <td>{formatMet(plan.legs[i]?.arriveSec ?? NaN)}</td>
                  <td>{formatMinutes((Number.isFinite(s.dwellMin) && s.dwellMin > 0 ? s.dwellMin : 0) * 60)}</td>
                </tr>
              ))}
              {hasRoute && (
                <tr>
                  <td>H</td>
                  <th scope="row">Back at {site.habitat.name}</th>
                  <td>{formatMet(plan.totalSec)}</td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
          <dl className="briefing-sheet__totals">
            <div>
              <dt>Distance</dt>
              <dd>{formatKm(plan.distM)}</dd>
            </div>
            <div>
              <dt>Total time</dt>
              <dd>{formatDuration(plan.totalSec)}</dd>
            </div>
            <div>
              <dt>Walking</dt>
              <dd>{formatDuration(plan.walkSec)}</dd>
            </div>
            <div>
              <dt>Science</dt>
              <dd>{formatDuration(plan.workSec)}</dd>
            </div>
          </dl>
        </section>

        <figure className="briefing-sheet__map" aria-label="Route map">
          {map ? (
            <svg viewBox={`${roundHalfUp(map.view.x, 1)} ${roundHalfUp(map.view.y, 1)} ${roundHalfUp(map.view.w, 1)} ${roundHalfUp(map.view.h, 1)}`} role="img" aria-label="The planned route on the HiRISE image: habitat, the numbered stops, and back.">
              <rect x="0" y="0" width={map.W} height={MAP_H} className="briefing-map__ground" />
              {basemapUrl && <image href={basemapUrl} x="0" y="0" width={map.W} height={MAP_H} preserveAspectRatio="none" className="briefing-map__image" />}
              {map.legs.map((leg, i) => (
                <g key={i}>
                  <polyline className="briefing-map__edge" points={points(leg)} style={{ strokeWidth: r * 0.62 }} />
                  <polyline className="briefing-map__route" points={points(leg)} style={{ strokeWidth: r * 0.3 }} />
                </g>
              ))}
              <rect className="briefing-map__habitat" x={map.habitat.x - r} y={map.habitat.y - r} width={r * 2} height={r * 2} style={{ strokeWidth: r * 0.2 }} />
              {map.marks.map((m) => (
                <g key={m.number}>
                  <circle className="briefing-map__stop" cx={m.x} cy={m.y} r={r} style={{ strokeWidth: r * 0.2 }} />
                  <text className="briefing-map__number" x={m.x} y={m.y + r * 0.36} fontSize={r * 0.95} textAnchor="middle">
                    {m.number}
                  </text>
                </g>
              ))}
            </svg>
          ) : (
            <p className="briefing-sheet__empty">No route yet.</p>
          )}
          <figcaption>Route on the HiRISE image. Square: {site.habitat.name}. Image: NASA/JPL-Caltech/University of Arizona/USGS.</figcaption>
        </figure>
      </div>

      <section aria-label="GO / NO-GO poll">
        <h2>GO / NO-GO poll</h2>
        <table className="briefing-sheet__poll">
          <thead>
            <tr>
              <th scope="col">System</th>
              <th scope="col">Assessment</th>
              <th scope="col">Status</th>
              <th scope="col">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {poll.rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.key}</th>
                <td>{row.value}</td>
                <td>
                  <span className={`briefing-sheet__pill is-${row.status}`}>{row.status}</span>
                </td>
                <td>
                  <span className="briefing-sheet__evidence">{row.evidence}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="briefing-sheet__columns briefing-sheet__columns--even">
        <section aria-label="Oxygen budget">
          <h2>Oxygen budget</h2>
          {hasRoute ? (
            <>
              <OxygenBar usedSec={plan.oxygenUsedSec} marginSec={plan.marginSec} reserveSec={budget.reserveSec} budgetSec={budget.budgetSec} />
              <dl className="briefing-sheet__totals">
                <div>
                  <dt>Used</dt>
                  <dd>{formatMinutes(plan.oxygenUsedSec)}</dd>
                </div>
                <div>
                  <dt>Margin</dt>
                  <dd>{formatMinutes(plan.marginSec)}</dd>
                </div>
                <div>
                  <dt>Reserve</dt>
                  <dd>{formatMinutes(budget.reserveSec)}</dd>
                </div>
                <div>
                  <dt>Left at return</dt>
                  <dd>{formatPct(plan.oxygenAtReturnPct)}</dd>
                </div>
              </dl>
              <p className="briefing-sheet__small">Suit supply {formatMinutes(budget.budgetSec)}. Calculated from assumed burn rates.</p>
            </>
          ) : (
            <p className="briefing-sheet__empty">No route yet.</p>
          )}
        </section>

        <section aria-label="Reliability">
          <h2>Reliability</h2>
          {sim ? (
            <>
              <p className="briefing-sheet__big">
                {sim.successCount.toLocaleString("en-US")} of {sim.trials.toLocaleString("en-US")}
              </p>
              <p>simulated versions of this walk get home with the reserve intact.</p>
              <p>
                Oxygen at return, 90% of runs: {formatPct(sim.oxygenAtReturnPct.p5).replace("%", "")} to {formatPct(sim.oxygenAtReturnPct.p95)}. Margin: {formatMinutes(sim.marginMin.p5 * 60)} to{" "}
                {formatMinutes(sim.marginMin.p95 * 60)}.
              </p>
              <p className="briefing-sheet__small">{MONTE_CARLO_DISCLAIMER}</p>
            </>
          ) : (
            <p className="briefing-sheet__empty">
              {whatIfOn ? "Not run with What-if values: the simulation varies the planner's own assumptions." : hasRoute ? "Not run: the plan has a stop that cannot be reached." : "No route yet."}
            </p>
          )}
        </section>
      </div>

      <footer className="briefing-sheet__foot">
        <p>{BRIEFING_CREDITS}</p>
        <p>The Ares Initiative · NASA Space Apps 2026 · A student prototype. Walking speed, oxygen use and the reserve are our assumptions, not spacesuit data.</p>
      </footer>
    </article>
  );
}

/**
 * The briefing as an overlay, with Print and Close. It asks the browser to print once,
 * shortly after it appears (so the map picture has loaded). In print, only the sheet shows.
 */
export function PrintBriefing({ onClose, ...sheet }: Omit<BriefingProps, "printedOn"> & { onClose: () => void }) {
  const printed = useRef(false);
  // While the briefing is open the page is marked, so the print rules hide the app behind it.
  useEffect(() => {
    document.body.classList.add("is-printing-briefing");
    return () => document.body.classList.remove("is-printing-briefing");
  }, []);
  useEffect(() => {
    if (printed.current) return;
    printed.current = true;
    const timer = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const printedOn = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="print-briefing" role="dialog" aria-modal="true" aria-label="Mission briefing, ready to print">
      <div className="print-briefing__bar">
        <span>Mission briefing. Choose "Save as PDF" in the print window to download it.</span>
        <button type="button" className="print-briefing__print" onClick={() => window.print()}>
          Print or save as PDF
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <BriefingSheet {...sheet} printedOn={printedOn} />
    </div>
  );
}
