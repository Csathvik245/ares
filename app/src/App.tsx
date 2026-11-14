import { useEffect, useState } from "react";
import { Hud, OpeningScreen, StopCard } from "./components/DesignIntegration";
import { MissionMap, TREK_LAYER } from "./components/MissionMap";
import { MissionProvider, useMission } from "./lib/MissionContext";
import { layers, type OverlayName } from "./lib/layers";
import {
  cellIndexOf,
  CONSUMABLE_HOURS,
  RESERVE_MIN,
  SAND_TI_THRESHOLD,
  SOL_HOURS,
  explainSegment,
} from "./lib/planner";
import { bearingDeg, distanceM } from "./geo";
import "./console.css";
import {
  AssistantIntegration,
  assistantAvailable,
} from "./components/AssistantIntegration";
import { Dialog } from "./components/Dialog";
const duration = (s: number) =>
  Number.isFinite(s)
    ? `${Math.floor(Math.abs(s) / 3600)}h ${Math.floor(Math.abs(s) / 60) % 60}m`
    : "Unreachable";
const lmst = (h: number) => {
  const min = Math.floor((((h % 24) + 24) % 24) * 60);
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
};
function Console() {
  const m = useMission();
  const frontendOnly = new URLSearchParams(window.location.search).has(
    "frontend",
  );
  const [screen, setScreen] = useState<"briefing" | "plan" | "hud">(
      frontendOnly ? "plan" : "briefing",
    ),
    [active, setActive] = useState<OverlayName[]>([]),
    [probe, setProbe] = useState(-1),
    [tab, setTab] = useState("Plan"),
    [sources, setSources] = useState(false),
    [assistant, setAssistant] = useState(false),
    [detail, setDetail] = useState("");
  const { site, plan, cost, position, emergency, abort } = m;
  const remove = () => {
    if (!emergency && m.selected)
      m.edit(m.stops.filter((s) => s.id !== m.selected));
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        el.matches("input,textarea,select,button") ||
        el.isContentEditable
      )
        return;
      if (e.key === "Escape") {
        setDetail("");
        setSources(false);
        setScreen((s) => (s === "hud" ? "plan" : s));
      }
      if (screen === "briefing") return;
      if (!frontendOnly && e.key.toLowerCase() === "h")
        setScreen((s) => (s === "hud" ? "plan" : "hud"));
      if (e.code === "Space" && !emergency) {
        e.preventDefault();
        m.togglePlayback();
      }
      if (e.key === "Delete") remove();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  if (screen === "briefing")
    return <OpeningScreen onBeginPlanning={() => setScreen("plan")} />;
  if (m.error)
    return (
      <main className="load-state" role="alert">
        Terrain could not load: {m.error}{" "}
        <button onClick={() => location.reload()}>Retry</button>
      </main>
    );
  if (!site || !plan || !cost)
    return (
      <main className="load-state" role="status">
        Loading Jezero terrain…
      </main>
    );
  const next = m.stops[position.legIndex] ?? site.habitat;
  const target = emergency ? site.habitat : next;
  const status = emergency ? "NO-GO" : plan.status;
  if (screen === "hud")
    return (
      <Hud
        status={status}
        nextStop={"label" in target ? target.label : target.name}
        distanceM={
          emergency
            ? (abort?.path.reduce(
                (sum, p, i, path) =>
                  i ? sum + distanceM(path[i - 1], p) : sum,
                0,
              ) ?? 0)
            : distanceM(position, target)
        }
        headingDeg={bearingDeg(position, target)}
        oxygenRemainingMin={Math.max(
          0,
          Math.round((CONSUMABLE_HOURS * 3600 - position.oxygenUsedSec) / 60),
        )}
        marginMin={(abort?.marginSec ?? plan.marginSec) / 60}
        doseMsv={m.dose}
        localTime={lmst(
          m.conditions.startLmst + ((m.elapsed / 3600) * 24) / SOL_HOURS,
        )}
        temperatureC={m.env.tempC}
        onExitHud={() => setScreen("plan")}
      />
    );
  const changeStop = (id: string, patch: object) =>
    m.edit(m.stops.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const reorder = (id: string, delta: number) => {
    const i = m.stops.findIndex((s) => s.id === id),
      j = i + delta;
    if (j < 0 || j >= m.stops.length) return;
    const s = [...m.stops];
    [s[i], s[j]] = [s[j], s[i]];
    m.edit(s);
  };
  const selected = m.stops.find((s) => s.id === detail);
  const explanation = plan.legs.length
    ? explainSegment(site, plan, Math.max(0, position.legIndex))
    : null;
  return (
    <main className="console-app">
      <header className="console-header">
        <div>
          <span className="eyebrow">ARES-1 / SURFACE OPERATIONS</span>
          <h1>{site.name}</h1>
          <p>Carbonate & clay sampling · Science first. Safety always.</p>
        </div>
        <div className="header-actions">
          <span className="mono">
            LMST{" "}
            {lmst(
              m.conditions.startLmst + ((m.elapsed / 3600) * 24) / SOL_HOURS,
            )}
          </span>
          <span className={`status status--${status}`}>{status}</span>
          <button onClick={() => setSources(true)}>Data sources</button>
          {assistantAvailable && (
            <button onClick={() => setAssistant(true)}>ARES assistant</button>
          )}
          {!frontendOnly && (
            <button onClick={() => setScreen("hud")}>Helmet HUD · H</button>
          )}
        </div>
      </header>
      <div className="assumptions">
        {m.fake ? "SYNTHETIC TERRAIN · " : ""}Demonstration · Terrain-aware
        planner · Mars24 sun (Ls 0°) · Temperature model pending MEDA ·{" "}
        {TREK_LAYER}
      </div>
      {emergency && (
        <aside className="emergency" role="alert">
          <strong>
            {emergency.kind === "storm" ? "DUST STORM" : "SOLAR PARTICLE EVENT"}{" "}
            · ABORT EVA
          </strong>
          <p>
            {emergency.kind === "storm"
              ? "Visibility and visor dust slow walking."
              : "Illustrative 30× radiation dose rate."}{" "}
            Return guidance frozen at incident position.{" "}
            {abort?.path.length
              ? `Walk home: ${duration(abort.sec)} · margin ${Math.round(abort.marginSec / 60)} min · ${abort.status}`
              : "No terrain-safe return path found."}
          </p>
          <button onClick={m.reset}>Reset emergency and playback</button>
        </aside>
      )}
      <nav className="tablet-tabs" aria-label="Console panels">
        {["Plan", "Layers", "Conditions"].map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
      <div className="console-body">
        <aside
          className={`side layers-panel ${tab === "Layers" ? "mobile-open" : ""}`}
        >
          <h2>Terrain layers</h2>
          {layers.map((l) => (
            <label className="layer-card" key={l.id}>
              <span>
                <input
                  type="checkbox"
                  checked={active.includes(l.id)}
                  onChange={() =>
                    setActive((a) =>
                      a.includes(l.id)
                        ? a.filter((k) => k !== l.id)
                        : [...a, l.id],
                    )
                  }
                />
                {l.name}
              </span>
              <small>
                {l.type} · {site.sources[l.source]}
              </small>
              <small>{l.legend}</small>
            </label>
          ))}
          <h2>Cursor probe</h2>
          {probe >= 0 ? (
            <dl>
              <dt>Elevation</dt>
              <dd>{site.layers.elevation[probe].toFixed(0)} m</dd>
              <dt>Slope</dt>
              <dd>{site.layers.slope[probe].toFixed(1)}°</dd>
              <dt>Soft sand risk</dt>
              <dd>
                {site.layers.thermalInertia[probe] < SAND_TI_THRESHOLD
                  ? "High"
                  : "Low"}
              </dd>
              <dt>Science value</dt>
              <dd>{site.layers.science[probe].toFixed(2)}</dd>
              <dt>Walk home</dt>
              <dd>{duration(m.home?.cost[probe] ?? Infinity)}</dd>
            </dl>
          ) : (
            <p>Move over the map.</p>
          )}
        </aside>
        <section className="map-column">
          <MissionMap
            site={site}
            cost={cost}
            plan={plan}
            stops={m.stops}
            zone={m.zone}
            active={active}
            position={position}
            abort={abort?.path ?? []}
            onAdd={m.add}
            onMove={(id, p) => {
              if (!emergency && cellIndexOf(site, p) >= 0)
                changeStop(id, { lat: p.lat, lng: p.lng });
            }}
            onSelect={m.setSelected}
            onProbe={setProbe}
          />
          <section className="timeline" aria-label="EVA playback">
            <div>
              <button
                disabled={!plan.ok || !plan.legs.length || !!emergency}
                onClick={m.togglePlayback}
              >
                {m.playing ? "Pause" : "Play"} · Space
              </button>
              <span>
                {duration(m.elapsed)} / {duration(plan.totalSec)} ·{" "}
                {position.phase}
              </span>
              <label>
                Start LMST{" "}
                <input
                  aria-label="Start LMST"
                  type="number"
                  min="0"
                  max="23.99"
                  step=".25"
                  value={m.conditions.startLmst}
                  disabled={!!emergency}
                  onChange={(e) => {
                    m.setConditions((c) => ({
                      ...c,
                      startLmst: Number(e.target.value),
                    }));
                    m.reset();
                  }}
                />
              </label>
            </div>
            <input
              aria-label="EVA timeline"
              type="range"
              min="0"
              max={Math.max(1, plan.totalSec)}
              value={m.elapsed}
              disabled={!!emergency}
              onChange={(e) => {
                m.setPlaying(false);
                m.setElapsed(Number(e.target.value));
              }}
            />
            <div className="timeline-track">
              {plan.legs.flatMap((leg, i) => {
                const science = plan.legs[i + 1]
                  ? plan.legs[i + 1].arriveSec -
                    plan.legs[i + 1].walkSec -
                    leg.arriveSec
                  : 0;
                return [
                  <span
                    key={`w${i}`}
                    style={{ flex: leg.walkSec }}
                    title="Walking"
                  />,
                  <span
                    key={`s${i}`}
                    className="science-track"
                    style={{ flex: science }}
                    title="Science"
                  />,
                ];
              })}
              <span
                className="reserve-track"
                style={{ flex: RESERVE_MIN * 60 }}
                title="45 minute oxygen reserve"
              />
            </div>
            <small>
              Walking · Science · Oxygen reserve (reserve is not playback time)
              · Speed: 240×
            </small>
          </section>
        </section>
        <aside
          className={`side plan-panel ${tab === "Plan" ? "mobile-open" : ""}`}
        >
          <h2>Mission plan</h2>
          <span className={`status status--${status}`}>{status}</span>
          <ul>
            {(emergency
              ? ["Emergency abort required. See return guidance above."]
              : plan.reasons
            ).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <div
            className="oxygen-gauge"
            aria-label={`Oxygen at return ${plan.oxygenAtReturnPct.toFixed(0)} percent`}
          >
            <svg viewBox="0 0 80 80" aria-hidden="true">
              <circle
                cx="40"
                cy="40"
                r="32"
                fill="none"
                stroke="var(--hairline)"
                strokeWidth="5"
              />
              <circle
                cx="40"
                cy="40"
                r="32"
                fill="none"
                stroke="var(--safe)"
                strokeWidth="5"
                strokeDasharray="201.06"
                strokeDashoffset={
                  201.06 * (1 - Math.min(100, plan.oxygenAtReturnPct) / 100)
                }
                transform="rotate(-90 40 40)"
              />
            </svg>
            <b>{plan.oxygenAtReturnPct.toFixed(0)}%</b>
          </div>
          <label className="oxygen-label">
            Oxygen at return <b>{plan.oxygenAtReturnPct.toFixed(0)}%</b>
            <progress max="100" value={plan.oxygenAtReturnPct} />
          </label>
          <dl>
            <dt>Distance</dt>
            <dd>{(plan.distM / 1000).toFixed(2)} km</dd>
            <dt>Duration</dt>
            <dd>{duration(plan.totalSec)}</dd>
            <dt>Walking</dt>
            <dd>{duration(plan.walkSec)}</dd>
            <dt>Science</dt>
            <dd>{duration(plan.workSec)}</dd>
            <dt>Return margin</dt>
            <dd>{Math.round((abort?.marginSec ?? plan.marginSec) / 60)} min</dd>
            <dt>Dose so far</dt>
            <dd>{m.dose.toFixed(3)} mSv</dd>
          </dl>
          <div className="button-row">
            <button
              disabled={!!emergency || m.demo.length === 0}
              aria-describedby={
                m.demo.length === 0 ? "demo-unavailable" : undefined
              }
              onClick={() => m.edit(m.demo)}
            >
              Load demo mission
            </button>
            <button disabled={!!emergency} onClick={() => m.edit([])}>
              Clear
            </button>
          </div>
          {m.demo.length === 0 && (
            <p id="demo-unavailable" className="hint" role="status">
              Demo science stops have not been supplied for this terrain yet.
              Click the map to plan your own stops.
            </p>
          )}
          <details>
            <summary>Current leg terrain</summary>
            {explanation && (
              <p>
                Max slope {explanation.maxSlopeDeg.toFixed(1)}° · Sand{" "}
                {(explanation.sandFraction * 100).toFixed(0)}% · Boulder density{" "}
                {explanation.rockMax.toFixed(2)}. {explanation.detourNote}
              </p>
            )}
          </details>
          <p className="hint">
            Click map or + science markers. Drag numbered markers. Default
            dwell: 30 min (assumption).
          </p>
          {m.stops.map((s, i) => (
            <article
              className={`stop-card ${m.selected === s.id ? "selected" : ""}`}
              key={s.id}
              draggable={!emergency}
              onDragStart={(e) => e.dataTransfer.setData("text/plain", s.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (emergency) return;
                const id = e.dataTransfer.getData("text/plain"),
                  from = m.stops.findIndex((s) => s.id === id);
                if (from < 0) return;
                const a = [...m.stops],
                  moving = a.splice(from, 1)[0];
                a.splice(i, 0, moving);
                m.edit(a);
              }}
              onClick={() => m.setSelected(s.id)}
            >
              <label>
                Stop {i + 1}
                <input
                  aria-label={`Stop ${i + 1} name`}
                  value={s.label}
                  disabled={!!emergency}
                  onChange={(e) => changeStop(s.id, { label: e.target.value })}
                />
              </label>
              <label>
                Science minutes
                <input
                  type="number"
                  min="0"
                  max="480"
                  value={s.dwellMin}
                  disabled={!!emergency}
                  onChange={(e) =>
                    changeStop(s.id, {
                      dwellMin: Math.max(
                        0,
                        Math.min(480, Number(e.target.value)),
                      ),
                    })
                  }
                />
              </label>
              <div className="button-row">
                <button
                  disabled={!!emergency || i === 0}
                  onClick={() => reorder(s.id, -1)}
                  aria-label={`Move stop ${i + 1} earlier`}
                >
                  ↑
                </button>
                <button
                  disabled={!!emergency || i === m.stops.length - 1}
                  onClick={() => reorder(s.id, 1)}
                  aria-label={`Move stop ${i + 1} later`}
                >
                  ↓
                </button>
                <button onClick={() => setDetail(s.id)}>Details</button>
                <button
                  disabled={!!emergency}
                  onClick={() => m.edit(m.stops.filter((x) => x.id !== s.id))}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </aside>
      </div>
      <section
        className={`conditions ${tab === "Conditions" ? "mobile-open" : ""}`}
      >
        <h2>Conditions</h2>
        <span>
          Sun {m.env.sunElevationDeg.toFixed(1)}° · {m.env.tempC.toFixed(0)}°C ·{" "}
          {m.env.doseRateMsvPerHr.toFixed(3)} mSv/h (model)
        </span>
        <button disabled={!!emergency} onClick={() => m.trigger("storm")}>
          Simulate dust storm
        </button>
        <button disabled={!!emergency} onClick={() => m.trigger("spe")}>
          Simulate solar particle event
        </button>
      </section>
      {assistant && (
        <AssistantIntegration onClose={() => setAssistant(false)} />
      )}
      {sources && (
        <Dialog title="Data sources" onClose={() => setSources(false)}>
          <h2>Data sources & assumptions</h2>
          {Object.entries(site.sources).map(([name, source]) => (
            <p key={name}>
              <b>{name}:</b> {source}
            </p>
          ))}
          <p>
            Basemap: NASA/JPL-Caltech Viking MDIM 2.1. Terrain:{" "}
            {m.fake
              ? "synthetic demonstration grid"
              : "see layer sources above"}
            .
          </p>
          <p>
            Radiation: surface baseline measured by Curiosity RAD at Gale,
            applied to Jezero. 0.64 mSv/sol; SPE ×30 illustrative. Suit, walking
            and reserve constants are demonstration assumptions in CLAUDE.md.
            Temperature is a placeholder curve; sun uses Mars24 at Ls 0°. These
            are not live weather observations.
          </p>
          <p>
            Safe-zone, position, abort and segment explanations use the real
            planner. Sun uses the planner’s Mars24 model at a fixed Ls of 0°.
            Temperature uses a placeholder curve awaiting MEDA. AI assistant is
            unavailable until its component and backend land.
          </p>
        </Dialog>
      )}
      {selected && (
        <StopCard
          key={selected.id}
          stop={selected}
          onClose={() => setDetail("")}
        />
      )}
    </main>
  );
}
export default function App() {
  return (
    <MissionProvider>
      <Console />
    </MissionProvider>
  );
}
