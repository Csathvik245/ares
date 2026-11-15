import { ShelterGuidance } from "./components/ShelterGuidance";
import { useEffect, useMemo, useState } from "react";
import { Hud, OpeningScreen } from "./components/DesignIntegration";
import { ElevationProfile } from "./components/ElevationProfile";
import { StopCard as StopDetailCard } from "./components/StopCard";
import { WORK_BURN, computeBriefing, formatMinutes, SPE_IS_ILLUSTRATIVE, SPE_MEASURED_2017_PEAK_MULTIPLIER } from "./lib/planner";
import { photoCreditFor } from "./lib/photoCredits";
import { scienceScore } from "./planner/science";
import { MissionMap } from "./components/MissionMap";
import { MissionProvider, useMission } from "./lib/MissionContext";
import { type OverlayName } from "./lib/layers";
import { cellIndexOf, CONSUMABLE_HOURS, SOL_HOURS } from "./lib/planner";
import type { LatLng } from "./lib/planner";
import { distanceM } from "./geo";
import { routeHeading, clock, lmst, minutes } from "./lib/presentation";
import { FlightTimeline } from "./components/FlightTimeline";
import { MissionPanel } from "./components/MissionPanel";
import { LayerRail } from "./components/LayerRail";
import { useMedia } from "./lib/useMedia";
import "./console.css";
import {
  AssistantIntegration,
  assistantAvailable,
} from "./components/AssistantIntegration";
import { Dialog } from "./components/Dialog";
const EMPTY_PATH: LatLng[] = [];
function Console() {
  const m = useMission();
  const briefing = useMemo(
    () => (m.site && m.plan ? computeBriefing(m.site, m.plan, m.conditions) : null),
    [m.site, m.plan, m.conditions],
  );
  const stopScores = useMemo(
    () => (m.site && m.plan ? scienceScore(m.site, m.plan, { stops: m.stops }) : []),
    [m.site, m.plan, m.stops],
  );
  const frontendOnly = new URLSearchParams(window.location.search).has(
    "frontend",
  );
  const [screen, setScreen] = useState<"briefing" | "plan" | "hud">(
      frontendOnly ? "plan" : "briefing",
    ),
    [active, setActive] = useState<OverlayName[]>([]),
    [probe, setProbe] = useState(-1),
    [tab, setTab] = useState("Map"),
    [sources, setSources] = useState(false),
    [assistant, setAssistant] = useState(false),
    [detail, setDetail] = useState("");
  // Desktop uses one consolidated left panel; tablet keeps the Map / Plan / Layers tabs.
  const desktop = useMedia("(min-width: 1025px)");
  // The consolidated layout belongs to the Deep Space / Mono themes; ?theme=classic keeps the three-column console.
  const consolidated =
    desktop && document.documentElement.dataset.theme !== "classic";
  const { site, plan, cost, position, emergency, abort } = m;
  const remove = () => {
    if (!emergency && m.selected)
      m.edit(m.stops.filter((s) => s.id !== m.selected));
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (e.key === "Escape") {
        setDetail("");
        setSources(false);
        setAssistant(false);
        setScreen((current) => (current === "hud" ? "plan" : current));
        return;
      }
      if (
        el.closest('input,textarea,select,[contenteditable="true"]') ||
        screen === "briefing" ||
        sources ||
        assistant ||
        !!detail
      )
        return;
      if (e.key.toLowerCase() === "h") {
        e.preventDefault();
        setScreen((current) => (current === "hud" ? "plan" : "hud"));
        return;
      }
      if (e.code === "Space") {
        // Focused buttons retain native Space activation; avoid toggling twice.
        if (el.closest('button,a[href],[role="button"]')) return;
        e.preventDefault();
        if (emergency) m.toggleReturnPlayback();
        else m.togglePlayback();
      }
      if (e.key === "Delete" && screen === "plan") {
        e.preventDefault();
        remove();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  if (screen === "briefing")
    return (
      <OpeningScreen
        onBeginPlanning={() => setScreen("plan")}
        terrainImageUrl={m.basemap?.url}
        imageCredit={m.basemap?.credit}
        rows={briefing?.rows ?? []}
        status={briefing?.status ?? "GO"}
        reasons={briefing?.reasons ?? []}
      />
    );
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
  const shelter = m.emergencyOutcome?.shelter;
  const winningShelter = emergency?.kind === "spe" && shelter?.checked && shelter.betterThanHome ? shelter : undefined;
  const target = emergency ? site.habitat : next;
  const status = m.evaStatus;
  if (screen === "hud")
    return (
      <Hud
        status={status}
        returnStatus={emergency ? abort?.status : undefined}
        nextStop={winningShelter ? "SHELTER" : "label" in target ? target.label : target.name}
        distanceM={
          winningShelter
            ? distanceM(position, winningShelter.target)
            : emergency
            ? m.returnPlan
              ? m.returnPlan.distM *
                (1 -
                  (m.returnPlan.totalSec
                    ? m.returnElapsed / m.returnPlan.totalSec
                    : 1))
              : 0
            : distanceM(position, target)
        }
        headingDeg={routeHeading(
          winningShelter
            ? winningShelter.path
            : emergency
            ? (abort?.path ?? [])
            : (plan.legs[position.legIndex]?.path ?? []),
          position,
        )}
        shelterWalkSec={winningShelter?.sec}
        shelterSimplified={winningShelter?.simplified}
        abortWalkMin={
          emergency
            ? Math.max(0, (abort?.sec ?? 0) - m.returnElapsed) / 60
            : undefined
        }
        doseIsIllustrative={SPE_IS_ILLUSTRATIVE && m.emergency?.kind === "spe"}
        measuredEventMultiplier={SPE_MEASURED_2017_PEAK_MULTIPLIER}
        oxygenRemainingMin={Math.max(
          0,
          (CONSUMABLE_HOURS * 3600 - position.oxygenUsedSec) / 60,
        )}
        marginMin={(abort?.marginSec ?? plan.marginSec) / 60}
        doseMsv={m.dose}
        localTime={lmst(
          m.conditions.startLmst + ((m.clockElapsed / 3600) * 24) / SOL_HOURS,
        )}
        temperatureC={m.env.tempC}
        onExitHud={() => setScreen("plan")}
      />
    );
  const changeStop = (id: string, patch: object) =>
    m.edit(m.stops.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const selected = m.stops.find((s) => s.id === detail);
  const mapColumn = (
        <section className="map-column" aria-label="Mission map and playback">
          <MissionMap
            site={site}
            basemap={m.basemap}
            cost={cost}
            plan={plan}
            stops={m.stops}
            zone={m.zone}
            active={active}
            position={position}
            abort={abort?.path ?? EMPTY_PATH}
            shelter={winningShelter}
            emergency={!!emergency}
            incidentAt={emergency?.at}
            viewRequest={m.viewRequest}
            onAdd={m.add}
            onMove={(id, p) => {
              if (!emergency && cellIndexOf(site, p) >= 0)
                changeStop(id, { lat: p.lat, lng: p.lng });
            }}
            onSelect={(id) => {
              m.setSelected(id);
              setDetail(id);
            }}
            onProbe={setProbe}
          >
            {emergency && (
              <aside className="storm-alert" role="alert">
                <div>
                  <strong>
                    {emergency.kind === "storm"
                      ? "DUST STORM"
                      : "SOLAR PARTICLE EVENT"}{" "}
                    · T+{clock(emergency.at)}
                  </strong>
                  <p>{abort?.reasons.find((r) => r.startsWith("Return home:")) ?? "No return guidance available."}</p>
                  <ShelterGuidance shelter={shelter} from={m.emergencyOutcome!.position} />
                  <small>
                    {emergency.kind === "storm"
                      ? "Low visibility and visor dust slow walking."
                      : "Illustrative SPE dose rate ×30."}{" "}
                    {abort?.path.length
                      ? `Walk home ${minutes(Math.max(0, abort.sec - m.returnElapsed))} min · margin ${minutes(abort.marginSec)} min`
                      : "No terrain-safe return path."}
                  </small>
                </div>
                <div>
                  <button
                    disabled={
                      !m.returnPlan || m.returnElapsed >= m.returnPlan.totalSec
                    }
                    onClick={m.toggleReturnPlayback}
                  >
                    {m.returnPlaying ? "Pause return" : "Play return"}
                  </button>
                  <button onClick={m.reset}>Reset</button>
                </div>
              </aside>
            )}
          </MissionMap>
          <ElevationProfile
            site={site}
            plan={emergency ? (m.returnPlan ?? plan) : plan}
            currentTSec={emergency ? m.returnElapsed : m.elapsed}
          />
          <FlightTimeline />
        </section>
  );
  return (
    <main className={`console-app ${emergency ? "has-emergency" : ""}`}>
      <header className="console-header">
        <div className="console-brand">
          <img className="console-patch" src="/brand/ares-patch.png" alt="The Ares Initiative mission patch" width="48" height="40" />
          <b>ARES</b>
          <span>
            ARES-1 EVA <small>Jezero delta front</small>
          </span>
          {consolidated && (
            <span className="brand-context">
              Jezero delta front · Surface Traverse Software
            </span>
          )}
        </div>
        <div className="header-actions">
          <span className="header-clock">
            LMST{" "}
            {lmst(
              m.conditions.startLmst +
                (m.clockElapsed * 24) / (SOL_HOURS * 3600),
            )}
          </span>
          <span className={`status status--${status}`}>
            EVA · {status}
            {emergency ? " · ABORTED" : ""}
          </span>
          {emergency && abort && (
            <span className={`return-status ink-${abort.status}`}>
              RETURN HOME · {abort.status}{abort.reasons.length ? ` · ${abort.reasons.filter((r) => !r.startsWith("Shelter")).join(" · ")}` : ""}
            </span>
          )}
          {assistantAvailable && (
            <button onClick={() => setAssistant(true)}>Assistant</button>
          )}
          <button onClick={() => setScreen("hud")}>Helmet HUD · H</button>
          {consolidated && (
            <button onClick={() => setSources(true)}>Sources</button>
          )}
        </div>
      </header>
      <nav className="tablet-tabs" aria-label="Console panels">
        {["Map", "Plan", "Layers"].map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
      <div
        className={`console-body ${consolidated ? "consolidated" : ""} tablet-${tab.toLowerCase()}`}
      >
        {consolidated ? (
          <>
            <aside
              className="telemetry-col"
              aria-label="Mission telemetry and plan"
            >
              <MissionPanel part="telemetry" onDetail={setDetail} />
              <LayerRail
                part="layers"
                active={active}
                onChange={setActive}
                probe={probe}
                onSources={() => setSources(true)}
              />
              <MissionPanel part="stops" onDetail={setDetail} />
              <LayerRail
                part="probe"
                active={active}
                onChange={setActive}
                probe={probe}
                onSources={() => setSources(true)}
              />
              <MissionPanel part="emergency" onDetail={setDetail} />
            </aside>
            {mapColumn}
          </>
        ) : (
          <>
            <LayerRail
              active={active}
              onChange={setActive}
              probe={probe}
              onSources={() => setSources(true)}
            />
            {mapColumn}
            <MissionPanel onDetail={setDetail} />
          </>
        )}
      </div>
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
          {m.basemap && (
            <p>
              <b>Local basemap:</b> {m.basemap.source}
              <br />
              {m.basemap.credit} · {m.basemap.metersPerPixel} m/pixel
            </p>
          )}
          <p>
            Fallback imagery: NASA/JPL-Caltech Viking MDIM 2.1. Terrain:{" "}
            {m.fake
              ? "synthetic demonstration grid"
              : "see layer sources above"}
            .
          </p>
          <p>
            Radiation: surface baseline measured by Curiosity RAD at Gale,
            applied to Jezero. 0.64 mSv/sol; SPE ×30 illustrative; measured
            2017 event x{SPE_MEASURED_2017_PEAK_MULTIPLIER}. Suit, walking
            and reserve constants are demonstration assumptions in CLAUDE.md.
            Temperature interpolates measured Perseverance MEDA daily extrema
            (Table 1, doi:10.1029/2022JE007559, Ls 25°); sun uses Mars24 at Ls
            0°. These are not live weather observations.
          </p>
          <p>
            Safe-zone, position, abort and segment explanations use the real
            planner. Sun uses the planner’s Mars24 model at a fixed Ls of 0°.
            Temperature uses a smooth interpolation of MEDA measurements, not
            live weather. AI assistant is unavailable until its component and
            backend land.
          </p>
        </Dialog>
      )}
      {selected && (
        <Dialog title={selected.label} onClose={() => setDetail("")}>
          <StopDetailCard
            stop={selected}
            index={m.stops.indexOf(selected)}
            poi={site.pois.find(
              (p) =>
                p.id === selected.id ||
                (Math.abs(p.lat - selected.lat) < 0.00001 &&
                  Math.abs(p.lng - selected.lng) < 0.00001),
            )}
            arriveSec={plan.legs[m.stops.indexOf(selected)]?.arriveSec ?? NaN}
            basemap={m.basemap}
            scienceScore={stopScores.find((score) => score.id === selected.id)}
          />
          <p className="stop-work-cost">
            Science oxygen cost: {minutes(selected.dwellMin * 60 * WORK_BURN)}{" "}
            nominal min · assumed burn rate
          </p>
          {photoCreditFor(selected.photo) && (
            <a
              href={photoCreditFor(selected.photo)!.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              NASA original image
            </a>
          )}
        </Dialog>
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
