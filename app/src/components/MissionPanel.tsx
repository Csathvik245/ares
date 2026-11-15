import { ShelterGuidance } from "./ShelterGuidance";
import { useMemo, useState } from "react";
import { useMission } from "../lib/MissionContext";
import { clock, shortStop, stopKind, minutes } from "../lib/presentation";
import {
  oxygenBudget,
  sunElevationSeries,
  SOL_HOURS,
  envAt,
} from "../lib/planner";
import {
  formatDuration,
  formatKm,
  formatMinutes,
  formatPct,
  roundHalfUp,
  SPE_IS_ILLUSTRATIVE,
  SPE_MEASURED_2017_PEAK_MULTIPLIER,
  formatMet,
} from "../lib/planner";
import { scienceScore, suggestStops } from "../planner/science";
import { EVIDENCE_LABELS } from "../lib/evidenceLabels";
import { ReliabilityPanel } from "./ReliabilityPanel";
import { reliabilityOf, simulatedRangeNote } from "../lib/reliability";
import { Jargon } from "./PlanChrome";
import { SCENARIO_BUTTONS, type UiEmergencyKind } from "../lib/emergency-run";

/**
 * "all" is the single rail (tablet, classic theme). The other parts let the
 * consolidated desktop column place each block: status, stops and budget scroll
 * together; the emergency block is pinned under them.
 */
export type MissionPart = "all" | "status" | "stops" | "budget" | "reliability" | "emergency";

/** Plain names for the emergency menu. The official term (SPE) stays visible in brackets. */
const PLAIN_EMERGENCY_LABELS: Record<UiEmergencyKind, string> = {
  storm: "Dust storm",
  spe: "Solar radiation storm (SPE)",
  "oxygen-loss": "Oxygen leak",
  "slow-walk": "Slower walking",
  "blocked-path": "Path blocked",
};
/** The emergencies in the order the menu shows them. */
const EMERGENCY_OPTIONS: { kind: UiEmergencyKind; label: string }[] = (
  ["storm", "spe", ...SCENARIO_BUTTONS.map((b) => b.kind)] as UiEmergencyKind[]
).map((kind) => ({ kind, label: PLAIN_EMERGENCY_LABELS[kind] }));

/** T+1:16 of the demo mission: the storm preset used in the video. */
const DEMO_STORM_SEC = 4560;

/** "1:16" or "76" (minutes) → seconds. NaN if it is neither. */
export function parseElapsed(text: string): number {
  const t = text.trim();
  const hm = /^(\d{1,2}):([0-5]\d)$/.exec(t);
  if (hm) return (Number(hm[1]) * 60 + Number(hm[2])) * 60;
  if (/^\d{1,3}$/.test(t)) return Number(t) * 60;
  return NaN;
}

export function MissionPanel({
  onDetail,
  part = "all",
}: {
  onDetail: (id: string) => void;
  part?: MissionPart;
}) {
  const m = useMission(),
    plan = m.plan!,
    display = m.emergency ? m.returnPlan : plan;
  // No stops and no emergency: there is nothing to judge yet, so no GO, no oxygen, no stats.
  const hasRoute = plan.legs.length > 0 || !!m.emergency;
  const budget = oxygenBudget(m.conditions.storm);
  const used = (display?.oxygenUsedSec ?? 0) + (m.emergencyOutcome?.position.oxygenUsedSec ?? 0),
    margin = m.abort?.marginSec ?? plan.marginSec;
  const reserve = Math.min(
    budget.reserveSec,
    Math.max(0, budget.budgetSec - used),
  );
  // A re-planned emergency (oxygen loss, slower walking, blocked path) keeps the EVA going
  // on a new plan, so it shows the EVA's own status; a storm, SPE or abort shows the walk home.
  const status = m.replanned ? m.evaStatus : m.emergency ? m.emergencyOutcome!.abort.status : m.evaStatus;
  const reasons = m.replanned ? m.evaReasons : m.emergency ? m.emergencyOutcome!.abort.reasons.filter((r) => !r.startsWith("Shelter")) : m.evaReasons;
  const lowest = useMemo(() => {
    const start =
      m.conditions.startLmst +
      (m.emergency ? (m.emergency.at * 24) / (SOL_HOURS * 3600) : 0);
    return Math.min(
      ...sunElevationSeries(start, display?.totalSec ?? 0, 60).map(
        (p) => p.sunElevationDeg,
      ),
    );
  }, [m.conditions.startLmst, m.emergency, display]);
  const dose = m.emergency
    ? (envAt(0, false).doseRateMsvPerHr * m.emergency.at) / 3600 +
      (m.env.doseRateMsvPerHr * (display?.totalSec ?? 0)) / 3600
    : (envAt(0, false).doseRateMsvPerHr * plan.totalSec) / 3600;
  const change = (id: string, patch: object) =>
    m.edit(m.stops.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const reorder = (id: string, delta: number) => {
    const next = [...m.stops],
      i = next.findIndex((s) => s.id === id),
      j = i + delta;
    if (i < 0 || j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    m.edit(next);
  };
  const pct = display?.oxygenAtReturnPct;
  const descriptor = m.replanned
    ? "Re-planned"
    : m.emergency
    ? "EVA aborted"
    : status === "GO"
      ? "Plan nominal"
      : status === "CAUTION"
        ? "Review reasons"
        : "Plan not viable";
  const scores = useMemo(
    () => scienceScore(m.site!, plan, { stops: m.stops }),
    [m.site, plan, m.stops],
  );
  const [ideas, setIdeas] = useState<ReturnType<typeof suggestStops>>([]);
  // Emergency menu: which emergency, and when. The time follows the playback clock until it is typed over.
  const [emergencyKind, setEmergencyKind] = useState<UiEmergencyKind>("storm");
  const [typedTime, setTypedTime] = useState<string | null>(null);

  const allReasons = [...new Set([...reasons, ...(m.emergencyOutcome?.shelter.checked ? m.emergencyOutcome.shelter.reasons : [])])];
  const sunLine = `Lowest sun during the EVA: ${roundHalfUp(lowest)}° above the horizon (${EVIDENCE_LABELS.sun}).`;

  const statusSection = (
      <section className="rail-status">
        <div className="panel-heading">
          <span>
            {m.replanned ? "EVA" : m.emergency ? "Return home" : "Mission status"}
            {hasRoute && <Jargon term="status" />}
          </span>
          {hasRoute && <small>{m.replanned ? "RE-PLANNED" : m.emergency?.kind === "spe" ? EVIDENCE_LABELS.spe : EVIDENCE_LABELS.route}</small>}
        </div>
        {!hasRoute ? (
          <>
            <div className="status-line">
              <strong className="large-status ink-NONE">NO PLAN</strong>
            </div>
            <p className="status-reason">Load the demo mission or click the map to add stops.</p>
          </>
        ) : (
          <>
            <div className="status-line">
              <strong className={`large-status ink-${status}`}>{status}</strong>
              <span className="status-descriptor">{descriptor}</span>
            </div>
            <p className="status-reason" title={reasons.join(" · ")}>
              {reasons[0]}
              {reasons.length > 1 && <span className="more-reasons"> +{reasons.length - 1} more</span>}
            </p>
            {m.emergency && (
              <p className="return-readout">
                {m.replanned ? "New plan ends in" : "Walk home"}{" "}
                {minutes(Math.max(0, (m.abort?.sec ?? Infinity) - m.returnElapsed))}{" "}
                min · margin {m.scenario ? `${formatMinutes(m.scenario.before.marginSec)} → ${formatMinutes(m.scenario.after.marginSec)}` : `${minutes(margin)} min`}
                {m.scenario && ` · dropped stops: ${m.scenario.droppedStops.length ? m.scenario.droppedStops.map((s) => s.label).join(", ") : "none"}`}
              </p>
            )}
            {m.emergencyOutcome && <ShelterGuidance shelter={m.emergencyOutcome.shelter} from={m.emergencyOutcome.position} />}
            <details>
              <summary>Planner reasons</summary>
              <ul>
                {allReasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
                <li>{sunLine}</li>
              </ul>
            </details>
          </>
        )}
      </section>
  );

  // Oxygen bar and the four stat tiles. Shown only when there is a route.
  const speDose = SPE_IS_ILLUSTRATIVE && m.emergency?.kind === "spe";
  // The simulated spread of the oxygen estimate: the same Monte Carlo result the Mission
  // reliability panel shows (same plan, default seed and trials), not a second simulation.
  // Only for a calm plan: in an emergency the number above it is the walk home's, not the plan's.
  const sim = hasRoute && !m.emergency ? reliabilityOf(m.site!, plan, { startLmst: m.conditions.startLmst }) : null;
  const simRange = sim && sim.trials > 0 && Number.isFinite(sim.oxygenAtReturnPct.p5) && Number.isFinite(sim.oxygenAtReturnPct.p95) ? sim : null;
  const budgetSection = !hasRoute ? null : (
      <section className="oxygen-panel budget-section">
        <div className="panel-heading">
          <span>Oxygen budget</span>
          <small>{EVIDENCE_LABELS.oxygen}</small>
        </div>
        <div className="oxygen-headline">
          <strong>
            {formatPct(pct)}
          </strong>
          <p>{m.emergency ? "left on arrival at HAB-1" : "left at return"}</p>
        </div>
        {simRange && (
          <p className="oxygen-range">
            90% simulated range{" "}
            <b>
              {formatPct(simRange.oxygenAtReturnPct.p5).replace("%", "")}–{formatPct(simRange.oxygenAtReturnPct.p95)}
            </b>
            <span className="jargon">
              <button type="button" className="jargon__button" aria-label={simulatedRangeNote(simRange.trials)} aria-describedby="oxygen-range-tip">
                ?
              </button>
              <span className="jargon__tip" role="tooltip" id="oxygen-range-tip">
                {simulatedRangeNote(simRange.trials)}
              </span>
            </span>
          </p>
        )}
        <div
          className="budget-bar"
          role="img"
          aria-label={`Oxygen: ${formatMinutes(used)} used, ${formatMinutes(margin)} margin, ${formatMinutes(budget.reserveSec)} reserve required`}
        >
          <span
            className="budget-used"
            style={{ width: `${100 * Math.min(1, used / budget.budgetSec)}%` }}
          />
          <span
            className="budget-margin"
            style={{
              width: `${(100 * Math.max(0, margin)) / budget.budgetSec}%`,
            }}
          />
          <span
            className="budget-reserve"
            style={{ width: `${(100 * reserve) / budget.budgetSec}%` }}
          />
        </div>
        <p className="budget-key">
          <span>Used <b>{formatMinutes(used)}</b></span>
          <span>Reserve target <b>{formatMinutes(budget.reserveSec)}</b><Jargon term="reserve" /></span>
        </p>
        <dl className="telemetry-grid stat-tiles">
          <div>
            <dt>Distance</dt>
            <dd>{display ? formatKm(display.distM) : "—"}</dd>
          </div>
          <div>
            <dt>Total duration</dt>
            <dd>{display ? clock(display.totalSec) : "—"}</dd>
            {display && (
              // Two parts that each stay whole: the line wraps between them instead of being cut.
              // On short screens the tiles are narrow and CSS shows "sci" for "science" (data-short).
              <small className="tile-parts">
                <span>{clock(display.walkSec)} walk</span>{" "}
                <span>
                  + {clock(display.workSec)} <span className="tile-long" data-short="sci">science</span>
                </span>
              </small>
            )}
          </div>
          <div>
            <dt>Margin</dt>
            <dd className={margin < 0 ? "ink-NO-GO" : ""}>{formatMinutes(margin)}</dd>
            <small>above the reserve</small>
          </div>
          <div>
            <dt>Dose</dt>
            <dd>{Number.isFinite(dose) ? `${roundHalfUp(dose, 2).toFixed(2)} mSv` : "—"}</dd>
            <small>
              {speDose
                ? `projected · illustrative SPE · measured 2017 event ×${roundHalfUp(SPE_MEASURED_2017_PEAK_MULTIPLIER, 1)}`
                : "projected · RAD baseline"}
            </small>
          </div>
        </dl>
        {m.shortestPlan && display && !m.emergency && (
          // "Compare: shortest path" is on: the same stops by the shortest walkable path, timed with the real walking model.
          <p className="compare-line" title="The shortest path is chosen by distance alone (same no-go ground), then timed with the same walking model as the ARES route.">
            <span>
              Shortest path: <b>{formatKm(m.shortestPlan.distM)}</b>, <b>{formatMinutes(m.shortestPlan.totalSec)}</b>,{" "}
              <b>{formatMinutes(m.shortestPlan.marginSec)}</b> spare
            </span>
            {"  ·  "}
            <span>
              ARES: <b>{formatKm(display.distM)}</b>, <b>{formatMinutes(display.totalSec)}</b>, <b>{formatMinutes(display.marginSec)}</b> spare
            </span>
          </p>
        )}
      </section>
  );

  const stopsSection = (
      <section className="stop-section">
        <div className="panel-heading">
          <span>
            {m.emergency ? "Original science stops" : "Science stops"}
          </span>
          {m.stops.length > 0 && <small>{m.stops.length === 1 ? "1 stop" : `${m.stops.length} stops`}</small>}
        </div>
        <div className="mission-actions">
          <button
            disabled={!!m.emergency || !m.demo.length}
            onClick={m.loadDemo}
          >
            Load demo
          </button>
          <button
            disabled={!!m.emergency || status !== "GO"}
            onClick={() => setIdeas(suggestStops(m.site!, m.site!.habitat, m.stops, 3, { startLmst: m.conditions.startLmst, cost: m.cost! }))}
          >
            Suggest stops
          </button>
          <button
            disabled={!!m.emergency || !m.stops.length}
            onClick={() => m.edit([])}
          >
            Clear
          </button>
        </div>
        <ol className="stop-list">
          {m.stops.map((s, i) => (
            <li
              key={s.id}
              className={m.selected === s.id ? "is-selected" : ""}
              draggable={!m.emergency}
              onDragStart={(e) => e.dataTransfer.setData("text/plain", s.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (m.emergency) return;
                const id = e.dataTransfer.getData("text/plain"),
                  next = [...m.stops],
                  from = next.findIndex((s) => s.id === id);
                if (from < 0) return;
                const moving = next.splice(from, 1)[0];
                next.splice(i, 0, moving);
                m.edit(next);
              }}
            >
              <span className="stop-number">{String(i + 1).padStart(2, "0")}</span>
              <div className="stop-summary">
                <button
                  className="text-button stop-name"
                  title={`${s.label} · ${stopKind(s.id)}`}
                  onClick={() => {
                    m.setSelected(s.id);
                    onDetail(s.id);
                  }}
                >
                  {shortStop(s.id, s.label)}
                </button>
                <span className="stop-arrival">
                  {formatMet(plan.legs[i]?.arriveSec ?? 0)}{" "}
                  <span>· {s.dwellMin} min science</span>
                </span>
                <span
                  className="stop-science-score"
                  title={scores[i] ? `${roundHalfUp(scores[i].score, 3).toFixed(3)} per oxygen-minute${s.why ? ` · ${s.why}` : ""}` : s.why}
                >
                  {scores[i] ? `Science ${roundHalfUp(scores[i].science, 2)}` : "Science score unavailable"}
                </span>
              </div>
              <button
                className="text-button edit-stop"
                aria-label={`Edit stop ${i + 1}`}
                disabled={!!m.emergency}
                onClick={() => m.setSelected(m.selected === s.id ? "" : s.id)}
              >
                Edit
              </button>
              {m.selected === s.id && !m.emergency && (
                <div className="stop-editor">
                  <label>
                    Name
                    <input
                      aria-label={`Stop ${i + 1} name`}
                      value={s.label}
                      onChange={(e) => change(s.id, { label: e.target.value })}
                    />
                  </label>
                  <label>
                    Science minutes
                    <input
                      aria-label={`Stop ${i + 1} science minutes`}
                      type="number"
                      min="0"
                      max="480"
                      value={s.dwellMin}
                      onChange={(e) =>
                        change(s.id, {
                          dwellMin: Math.max(
                            0,
                            Math.min(480, Number(e.target.value)),
                          ),
                        })
                      }
                    />
                  </label>
                  <div>
                    <button
                      disabled={i === 0}
                      onClick={() => reorder(s.id, -1)}
                    >
                      Move up
                    </button>
                    <button
                      disabled={i === m.stops.length - 1}
                      onClick={() => reorder(s.id, 1)}
                    >
                      Move down
                    </button>
                    <button
                      onClick={() =>
                        m.edit(m.stops.filter((x) => x.id !== s.id))
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
        {ideas.length > 0 && (
          <ul className="stop-suggestions" aria-label="Suggested science stops">
            {ideas.map((idea) => (
              <li key={idea.id}>
                <span>Suggestion · science {roundHalfUp(idea.science, 2)} · {formatMinutes(idea.extraO2Min * 60)} O₂ · margin {formatMinutes(idea.marginMin * 60)}</span>
                <button onClick={() => { const next = [...m.stops]; next.splice(idea.insertAt, 0, idea); m.edit(next); setIdeas([]); }}>Add stop</button>
              </li>
            ))}
          </ul>
        )}
      </section>
  );

  // ---- Emergency simulation: one menu, one time, one button ----
  const running = !!m.emergency;
  const canTrigger = !running && plan.legs.length > 0;
  // While nothing is typed, the field shows the playback time and the trigger uses it as is.
  const timeText = running ? formatDuration(m.emergency!.at) : (typedTime ?? formatDuration(m.elapsed));
  const typedSec = typedTime === null ? NaN : parseElapsed(typedTime);
  const timeOk = typedTime === null || Number.isFinite(typedSec);
  const emergencyHint = running
    ? "An emergency is running. Reset it to try another."
    : !plan.legs.length
      ? "Add a route first: an emergency needs a walk to interrupt."
      : !timeOk
        ? "Type the time as hours:minutes, for example 1:16."
        : "Starts at the playback time unless you type another.";
  const emergencyFooter = (
      <footer className="emergency-controls">
        <div className="panel-heading">
          <span>
            Emergency simulation
            {/* The hint that used to take a line of its own: here, and in the Trigger button's tooltip. */}
            <span className="jargon emergency-help">
              <button type="button" className="jargon__button" aria-label={emergencyHint} aria-describedby="emergency-hint-tip">
                ?
              </button>
              <span className="jargon__tip" role="tooltip" id="emergency-hint-tip">
                {emergencyHint}
              </span>
            </span>
          </span>
          <small>{EVIDENCE_LABELS.emergency}</small>
        </div>
        <div className="emergency-row">
          <select
            aria-label="Emergency type"
            value={running ? m.emergency!.kind : emergencyKind}
            disabled={running}
            onChange={(e) => setEmergencyKind(e.target.value as UiEmergencyKind)}
          >
            {EMERGENCY_OPTIONS.map((o) => (
              <option key={o.kind} value={o.kind}>
                {o.label}
              </option>
            ))}
          </select>
          <label className="emergency-time">
            <span>T+</span>
            <input
              aria-label="Emergency time, hours:minutes into the EVA"
              inputMode="numeric"
              value={timeText}
              disabled={!canTrigger}
              aria-invalid={!timeOk}
              onChange={(e) => setTypedTime(e.target.value)}
              onBlur={() => {
                // An untouched or emptied field goes back to following the playback clock.
                if (typedTime !== null && typedTime.trim() === "") setTypedTime(null);
              }}
            />
          </label>
          {running ? (
            <button className="emergency-trigger" title={emergencyHint} onClick={m.reset}>
              Reset
            </button>
          ) : (
            <button
              className="emergency-trigger"
              title={emergencyHint}
              disabled={!canTrigger || !timeOk}
              onClick={() => {
                // Same calls as the old buttons: no time given means "now" (the playback time).
                if (typedTime === null) m.trigger(emergencyKind);
                else m.trigger(emergencyKind, typedSec);
                setTypedTime(null);
              }}
            >
              Trigger
            </button>
          )}
        </div>
        <div className="emergency-demos">
          <button
            className="text-button storm-preset"
            disabled={running || !plan.ok || plan.totalSec < DEMO_STORM_SEC}
            onClick={() => m.trigger("storm", DEMO_STORM_SEC)}
          >
            Demo: storm at T+1:16
          </button>
          <button className="text-button" disabled={!m.wildcat || running} onClick={m.loadWildcatSpe}>
            Demo: SPE at Wildcat Ridge
          </button>
          <Jargon term="SPE" />
        </div>
      </footer>
  );

  const reliability = !m.emergency && hasRoute ? <ReliabilityPanel site={m.site!} plan={plan} startLmst={m.conditions.startLmst} /> : null;

  if (part === "status") return statusSection;
  if (part === "stops") return stopsSection;
  if (part === "budget") return budgetSection;
  if (part === "reliability") return reliability;
  if (part === "emergency") return emergencyFooter;
  return (
    <aside className="mission-rail" aria-label="Mission plan">
      <div className="rail-scroll">
        {statusSection}
        {stopsSection}
        {budgetSection}
        {reliability}
      </div>
      {emergencyFooter}
    </aside>
  );
}
