// MISSION RELIABILITY: a collapsible panel (closed by default) that runs the Monte Carlo
// simulator on the current plan and shows how often the astronaut gets home with the
// oxygen reserve intact, if our assumptions are a bit off.
//
// Standalone: give it the site and the plan. It reads nothing else.
// 1,000 trials take a few milliseconds, so it runs in the page (no worker needed).
// The disclaimer is always shown when the panel is open.
import { useMemo } from "react";
import { formatDuration, formatMinutes, formatPct, roundHalfUp } from "../planner";
import type { Plan, Site } from "../planner";
import { reliabilityOf } from "../lib/reliability";
import type { ReliabilityResult } from "../planner/montecarlo";
import { EvidenceTag } from "./EvidenceTag";
import "./reliability.css";

type Props = {
  site: Site;
  plan: Plan;
  trials?: number;
  seed?: number;
  startLmst?: number;
  /** Start open (for screenshots and tests). Default: closed. */
  defaultOpen?: boolean;
};

/** A share 0..1 as a percentage with one decimal, half up, so 99.6% is not shown as 100%. */
const count = (n: number) => n.toLocaleString("en-US");
const share = (p: number) => `${roundHalfUp(p * 100, 1).toFixed(1)}%`;
const minutes = (min: number) => formatMinutes(min * 60);
const duration = (min: number) => formatDuration(min * 60);

function Histogram({ histogram }: { histogram: ReliabilityResult["histogramMarginMin"] }) {
  const { binStart, binWidth, counts } = histogram;
  if (counts.length === 0) return null;
  const W = 240;
  const H = 56;
  const peak = Math.max(...counts);
  const barW = W / counts.length;
  const end = binStart + binWidth * counts.length;
  // The reserve line is at margin 0: left of it the trial ended inside the reserve.
  const reserveInside = binStart <= 0 && 0 <= end;
  const reserveX = reserveInside ? ((0 - binStart) / (end - binStart)) * W : 0;
  return (
    <figure className="reliability__histogram">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Oxygen margin of the trials, from ${minutes(binStart)} to ${minutes(end)}`}
      >
        {counts.map((n, k) => {
          const h = peak > 0 ? (n / peak) * (H - 4) : 0;
          const below = binStart + (k + 1) * binWidth <= 0;
          return (
            <rect
              key={k}
              className={below ? "reliability__bar reliability__bar--fail" : "reliability__bar"}
              x={k * barW + 0.5}
              y={H - h}
              width={Math.max(0.5, barW - 1)}
              height={h}
            />
          );
        })}
        {reserveInside && <line className="reliability__reserve" x1={reserveX} x2={reserveX} y1={0} y2={H} />}
      </svg>
      <figcaption>
        <span>{minutes(binStart)}</span>
        <span>
          {reserveInside
            ? "oxygen margin · red line = reserve (0 min)"
            : binStart > 0
              ? "oxygen margin · every trial kept the reserve (reserve line is off the chart, to the left)"
              : "oxygen margin · every trial ended inside the reserve"}
        </span>
        <span>{minutes(end)}</span>
      </figcaption>
    </figure>
  );
}

export function ReliabilityPanel({ site, plan, trials, seed, startLmst, defaultOpen = false }: Props) {
  // Shared with the oxygen section's simulated range: the simulation runs once per plan.
  const r = useMemo(() => reliabilityOf(site, plan, { trials, seed, startLmst }), [site, plan, trials, seed, startLmst]);
  const walkable = plan.ok && plan.legs.length > 0;
  const top = r.sensitivity.slice(0, 3);
  // With no failures a bare "100%" would overclaim: show the counts and the failure-rate bound instead.
  const noFailures = r.failureUpperBound95 !== null;
  const allHome = `${count(r.successCount)} of ${count(r.trials)}`;
  const widest = Math.max(1e-9, ...top.map((s) => s.swingMin));

  return (
    <details className="reliability" open={defaultOpen}>
      <summary>
        <span>Mission reliability</span>
        <small>{!walkable ? "no route" : noFailures ? `${allHome} with reserve` : `${share(r.pReturnWithReserve)} with reserve`}</small>
      </summary>
      <div className="reliability__body">
        {!walkable ? (
          <p className="reliability__empty">
            {plan.ok ? "Add a stop to simulate the mission." : "A stop cannot be reached, so the mission cannot be simulated."}
          </p>
        ) : (
          <>
            <p className="reliability__run">
              {r.trials.toLocaleString("en-US")} trials · seed {r.seed} <EvidenceTag level="ASSUMED" />
            </p>
            <p className="reliability__headline">
              <b>{noFailures ? allHome : share(r.pReturnWithReserve)}</b>
              <span>{noFailures ? "trials home with reserve" : "returned with the reserve intact"}</span>
            </p>
            {noFailures && (
              <p className="reliability__counts">
                0 failures: failure rate likely below {roundHalfUp(r.failureUpperBound95! * 100, 1)}%
              </p>
            )}
            <p className="reliability__counts">
              Success {count(r.successCount)} · Fail {count(r.failCount)} · Home at all{" "}
              {r.pReturnAtAll === 1 ? "in every trial" : share(r.pReturnAtAll)}
            </p>
            <table className="reliability__table">
              <thead>
                <tr>
                  <th scope="col"></th>
                  <th scope="col">Low (p5)</th>
                  <th scope="col">Middle (p50)</th>
                  <th scope="col">High (p95)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Oxygen at return</th>
                  <td>{formatPct(r.oxygenAtReturnPct.p5)}</td>
                  <td>{formatPct(r.oxygenAtReturnPct.p50)}</td>
                  <td>{formatPct(r.oxygenAtReturnPct.p95)}</td>
                </tr>
                <tr>
                  <th scope="row">Duration</th>
                  <td>{duration(r.durationMin.p5)}</td>
                  <td>{duration(r.durationMin.p50)}</td>
                  <td>{duration(r.durationMin.p95)}</td>
                </tr>
                <tr>
                  <th scope="row">Margin</th>
                  <td>{minutes(r.marginMin.p5)}</td>
                  <td>{minutes(r.marginMin.p50)}</td>
                  <td>{minutes(r.marginMin.p95)}</td>
                </tr>
              </tbody>
            </table>
            <Histogram histogram={r.histogramMarginMin} />
            <div className="reliability__sensitivity">
              <span className="reliability__label">What moves the margin most</span>
              <ol>
                {top.map((s) => (
                  <li key={s.param}>
                    <span>{s.label}</span>
                    <span className="reliability__track">
                      <span className="reliability__fill" style={{ width: `${(s.swingMin / widest) * 100}%` }} />
                    </span>
                    <b>{minutes(s.swingMin)}</b>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}
        <p className="reliability__disclaimer">{r.disclaimer}</p>
      </div>
    </details>
  );
}
