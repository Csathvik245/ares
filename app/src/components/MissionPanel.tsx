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
  formatDose,
  formatKm,
  formatMinutes,
  formatPct,
  roundHalfUp,
  SPE_IS_ILLUSTRATIVE,
  SPE_MEASURED_2017_PEAK_MULTIPLIER,
  formatMet,
} from "../lib/planner";
import { scienceScore, suggestStops } from "../planner/science";

export function MissionPanel({ onDetail }: { onDetail: (id: string) => void }) {
  const m = useMission(),
    plan = m.plan!,
    display = m.emergency ? m.returnPlan : plan;
  const budget = oxygenBudget(m.conditions.storm);
  const used = (display?.oxygenUsedSec ?? 0) + (m.emergencyOutcome?.position.oxygenUsedSec ?? 0),
    margin = m.abort?.marginSec ?? plan.marginSec;
  const reserve = Math.min(
    budget.reserveSec,
    Math.max(0, budget.budgetSec - used),
  );
  const status = m.emergency ? m.emergencyOutcome!.abort.status : m.evaStatus;
  const reasons = m.emergency ? m.emergencyOutcome!.abort.reasons : m.evaReasons;
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
  const scores = useMemo(
    () => scienceScore(m.site!, plan, { stops: m.stops, cost: m.cost! }),
    [m.site, plan, m.stops, m.cost],
  );
  const [ideas, setIdeas] = useState<ReturnType<typeof suggestStops>>([]);
  return (
    <aside className="mission-rail" aria-label="Mission plan">
      <section className="rail-status">
        <div className="panel-heading">
          <span>{m.emergency ? "RETURN HOME" : "MISSION STATUS"}</span>
          <small>calculated</small>
        </div>
        <strong className={`large-status ink-${status}`}>{status}</strong>
        <p>{reasons.join(" · ")}</p>
        {m.emergency && (
          <p className="return-readout">
            Walk home{" "}
            {minutes(Math.max(0, (m.abort?.sec ?? Infinity) - m.returnElapsed))}{" "}
            min · margin {minutes(margin)} min
          </p>
        )}
        <details>
          <summary>Planner reasons</summary>
          <ul>
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </details>
      </section>
      <section className="oxygen-panel">
        <div className="panel-heading">
          <span>OXYGEN BUDGET</span>
          <small>calculated · assumed burn rates</small>
        </div>
        <div className="oxygen-headline">
          <strong>
            {formatPct(pct)}
          </strong>
          <p>{m.emergency ? "left on arrival at HAB-1" : "left at return"}</p>
        </div>
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
        <div className="budget-labels">
          <span>
            Used <b>{formatMinutes(used)}</b>
          </span>
          <span className={margin < 0 ? "ink-NO-GO" : ""}>
            Margin <b>{formatMinutes(margin)}</b>
          </span>
          <span>
            Reserve target <b>{formatMinutes(budget.reserveSec)}</b>
          </span>
        </div>
      </section>
      <dl className="telemetry-grid">
        {[
          [
            "Distance",
            display ? formatKm(display.distM) : "—",
            "calculated",
          ],
          ["Duration", display ? clock(display.totalSec) : "—", "calculated"],
          ["Walking", display ? clock(display.walkSec) : "—", "calculated"],
          ["Science", display ? clock(display.workSec) : "—", "calculated"],
          [
            "Radiation dose",
            formatDose(dose) + (SPE_IS_ILLUSTRATIVE && m.emergency?.kind === "spe" ? ` · illustrative · measured 2017 event x${SPE_MEASURED_2017_PEAK_MULTIPLIER}` : ""),
            "projected · RAD baseline",
          ],
            ["Lowest sun", `${roundHalfUp(lowest)}°`, "calculated · Mars24"],
        ].map(([label, value, evidence]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
            <small>{evidence}</small>
          </div>
        ))}
      </dl>
      <section className="stop-section">
        <div className="panel-heading">
          <span>
            {m.emergency ? "ORIGINAL SCIENCE STOPS" : "SCIENCE STOPS"}
          </span>
            <span>{String(m.stops.length).padStart(2, "0")}</span>
        </div>
        <div className="mission-actions">
          <button
            disabled={!!m.emergency || !m.demo.length}
            onClick={m.loadDemo}
          >
            Load demo mission
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
        {!m.stops.length && (
          <p className="empty-stops">
            Choose science stops on the map or load the demo mission.
          </p>
        )}
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
              <span className="stop-number">{i + 1}</span>
              <div className="stop-summary">
                <button
                  className="text-button stop-name"
                  title={s.label}
                  onClick={() => {
                    m.setSelected(s.id);
                    onDetail(s.id);
                  }}
                >
                  {shortStop(s.id, s.label)}
                </button>
                <span className="stop-why" title={s.why}>
                  {stopKind(s.id)}
                </span>
                <span className="stop-arrival">
                  {formatMet(plan.legs[i]?.arriveSec ?? 0)}{" "}
                  <span>· {s.dwellMin} min science</span>
                </span>
                <span className="stop-science-score">
                  {scores[i] ? `Science ${roundHalfUp(scores[i].science, 2)} · ${roundHalfUp(scores[i].score * 60, 2)} per O₂-hour` : "Science score unavailable"}
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
      <footer className="emergency-controls">
        <span>
          EMERGENCY SIMULATION <small>assumed response</small>
        </span>
        <button disabled={!!m.emergency} onClick={() => m.trigger("storm")}>
          Dust storm
        </button>
        <button disabled={!!m.emergency} onClick={() => m.trigger("spe")}>
          Solar particle event
        </button>
        <button
          className="storm-preset"
          disabled={!!m.emergency || !plan.ok || plan.totalSec < 4560}
          onClick={() => m.trigger("storm", 4560)}
        >
          Storm at T+1:16
        </button>
      </footer>
    </aside>
  );
}
