import { ShelterGuidance } from "./components/ShelterGuidance";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Hud, OpeningScreen } from "./components/DesignIntegration";
import { ElevationProfile } from "./components/ElevationProfile";
import { StopCard as StopDetailCard } from "./components/StopCard";
import { WORK_BURN, formatMinutes, roundHalfUp, SPE_IS_ILLUSTRATIVE, SPE_MEASURED_2017_PEAK_MULTIPLIER } from "./lib/planner";
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
import { EMERGENCY_TEXT } from "./lib/emergency-run";
import { LayerRail } from "./components/LayerRail";
import { useMedia } from "./lib/useMedia";
import { Map3DToggle } from "./components/Map3DToggle";
import { EmptyPlanCard, Jargon, ViewMenu, type ViewMenuItem } from "./components/PlanChrome";
import "./styles/plan-view.css";
import "./styles/sidebar-polish.css";

// 3D terrain view (stretch feature). three.js loads only when someone opens it.
const Terrain3D = lazy(() => import("./components/Terrain3D"));
import "./console.css";
import {
  AssistantIntegration,
  assistantAvailable,
} from "./components/AssistantIntegration";
import { Dialog } from "./components/Dialog";
import { AppBar, AppLogo, AppTabs } from "./components/AppTabs";
import { GuidedDemo } from "./components/GuidedDemo";
import { SciencePage } from "./components/SciencePage";
import { CONSOLE_TABS, hashOfTab, runDemo, tabFromHash, type AppTab } from "./lib/appTabs";
import { demoBriefing } from "./lib/story";
const EMPTY_PATH: LatLng[] = [];
function Console({ initialHash }: { initialHash?: string }) {
  const m = useMission();
  // The Story page's poll: the demo mission's briefing, not whatever is (or is not) planned on the Plan tab.
  const briefing = useMemo(
    () => (m.site ? demoBriefing(m.site, m.demo) : null),
    [m.site, m.demo],
  );
  const stopScores = useMemo(
    () => (m.site && m.plan ? scienceScore(m.site, m.plan, { stops: m.stops }) : []),
    [m.site, m.plan, m.stops],
  );
  const inBrowser = typeof window !== "undefined";
  const frontendOnly = inBrowser && new URLSearchParams(window.location.search).has("frontend");
  // The page on screen: one of the three tabs, or the helmet HUD (a full-screen view of the Plan tab).
  // Story is the default; a link such as #science opens that tab directly.
  const homeTab: AppTab = frontendOnly ? "plan" : "story";
  const [screen, setScreen] = useState<AppTab | "hud">(() =>
      tabFromHash(initialHash ?? (inBrowser ? window.location.hash : ""), homeTab),
    ),
    [active, setActive] = useState<OverlayName[]>([]),
    [probe, setProbe] = useState(-1),
    [tab, setTab] = useState("Map"),
    [sources, setSources] = useState(false),
    [assistant, setAssistant] = useState(false),
    [sidebarCollapsed, setSidebarCollapsed] = useState(false),
    [detail, setDetail] = useState("");
  const [view3d, setView3d] = useState(false);
  // Layers popover on the map toolbar, and the terrain profile toggle (null = follow playback).
  const [layersOpen, setLayersOpen] = useState(false);
  const [profileChoice, setProfileChoice] = useState<boolean | null>(null);
  // Desktop uses one consolidated left panel; tablet keeps the Map / Plan / Layers tabs.
  const desktop = useMedia("(min-width: 1025px)");
  // The consolidated layout belongs to the Deep Space / Mono themes; ?theme=classic keeps the three-column console.
  const consolidated =
    desktop && document.documentElement.dataset.theme !== "classic";
  const { site, plan, cost, position, emergency, abort } = m;
  // Open a tab and put it in the URL (#story, #plan, #science), so back and forward work.
  const go = (tab: AppTab) => {
    setScreen(tab);
    if (inBrowser && window.location.hash !== hashOfTab(tab)) window.location.hash = tab;
  };
  useEffect(() => {
    const onHash = () => setScreen(tabFromHash(window.location.hash, homeTab));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [homeTab]);
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
        setLayersOpen(false);
        setScreen((current) => (current === "hud" ? "plan" : current));
        return;
      }
      if (
        el.closest('input,textarea,select,[contenteditable="true"]') ||
        screen === "story" ||
        screen === "science" ||
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
  if (screen === "story")
    return (
      <div className="app-page app-page--story">
        <AppBar current="story" onSelect={go} />
        <OpeningScreen
          onBeginPlanning={() => go("plan")}
          onRunDemo={() => runDemo(go)}
          terrainImageUrl={m.basemap?.url}
          imageCredit={m.basemap?.credit}
          rows={briefing?.rows ?? []}
          status={briefing?.status ?? "GO"}
          reasons={briefing?.reasons ?? []}
        />
      </div>
    );
  if (screen === "science")
    return (
      <div className="app-page app-page--science">
        <AppBar current="science" onSelect={go}>
          <button type="button" className="app-run-demo" onClick={() => runDemo(go)}>
            Run the demo
          </button>
        </AppBar>
        <SciencePage />
      </div>
    );
  if (m.error)
    return (
      <div className="app-page app-page--plan-wait">
        <AppBar current="plan" onSelect={go} />
        <main className="load-state" role="alert">
          Terrain could not load: {m.error}{" "}
          <button onClick={() => location.reload()}>Retry</button>
        </main>
      </div>
    );
  if (!site || !plan || !cost)
    return (
      <div className="app-page app-page--plan-wait">
        <AppBar current="plan" onSelect={go} />
        <main className="load-state" role="status">
          Loading Jezero terrain…
        </main>
      </div>
    );
  const next = m.stops[position.legIndex] ?? site.habitat;
  const shelter = m.emergencyOutcome?.shelter;
  const winningShelter = emergency?.kind === "spe" && shelter?.checked && shelter.betterThanHome ? shelter : undefined;
  const target = emergency ? site.habitat : next;
  const status = m.evaStatus;
  // No stops and no emergency: there is no plan to give a status to yet.
  const noPlan = !emergency && plan.legs.length === 0;
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
  // Header: one pill and its tooltip.
  const headerPillText = emergency && abort ? `${m.replanned ? "NEW PLAN" : "RETURN HOME"} · ${abort.status}` : `EVA · ${status}`;
  const headerPillTitle =
    emergency && abort
      ? [
          `EVA · ${status}${m.replanned ? " · RE-PLANNED" : " · ABORTED"}`,
          ...abort.reasons.filter((r) => !r.startsWith("Shelter")),
        ].join(" · ")
      : m.evaReasons.join(" · ");
  // The less-used views live in one menu.
  const viewItems: ViewMenuItem[] = [
    { id: "3d", label: "3D terrain", checked: view3d, onSelect: () => setView3d((v) => !v) },
    { id: "hud", label: "Helmet HUD", hint: "H", onSelect: () => setScreen("hud") },
    { id: "sources", label: "Sources", onSelect: () => setSources(true) },
    ...(consolidated
      ? [{ id: "sidebar", label: sidebarCollapsed ? "Show sidebar" : "Hide sidebar", onSelect: () => setSidebarCollapsed((c) => !c) }]
      : []),
    ...(assistantAvailable ? [{ id: "assistant", label: "Assistant", onSelect: () => setAssistant(true) }] : []),
  ];
  // The terrain profile strip: on during playback, unless the toggle was used.
  const profileOn = profileChoice ?? (m.playing || m.returnPlaying);
  const changeStop = (id: string, patch: object) =>
    m.edit(m.stops.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const selected = m.stops.find((s) => s.id === detail);
  const mapColumn = (
        <section className={`map-column${profileOn ? "" : " no-profile"}`} aria-label="Mission map and playback">
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
            blocked={m.scenario?.blocked}
            comparePaths={m.shortestPlan?.legs.map((leg) => leg.path)}
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
            walkHome={m.home?.cost}
            toolbar={
              <>
                <button
                  type="button"
                  className={`map-tool${layersOpen ? " is-on" : ""}`}
                  aria-expanded={layersOpen}
                  aria-controls="map-layers-popover"
                  title="Choose the terrain layers drawn on the map"
                  onClick={() => setLayersOpen((o) => !o)}
                >
                  Layers
                </button>
                <Map3DToggle active={view3d} onToggle={() => setView3d((v) => !v)} />
              </>
            }
          >
            {layersOpen && (
              <div className="map-layers-popover" id="map-layers-popover" role="group" aria-label="Map layers">
                <p>Map layers</p>
                <LayerRail part="list" active={active} onChange={setActive} probe={probe} onSources={() => setSources(true)} />
              </div>
            )}
            {/* No plan yet: say what the page is for and offer the next click. */}
            {noPlan && !view3d && (
              <EmptyPlanCard onRunDemo={() => runDemo(go)} onLoadDemo={m.loadDemo} canLoadDemo={m.demo.length > 0} />
            )}
            {/* The guided demo's caption card. It stays closed until "Run the demo" starts it. */}
            <GuidedDemo />
            {view3d && (
              <Suspense
                fallback={
                  <div className="terrain-3d terrain-3d--loading" role="status">
                    Loading 3D terrain…
                  </div>
                }
              >
                <Terrain3D
                  site={site}
                  cost={cost}
                  zone={m.zone}
                  active={active}
                  basemapUrl={m.basemap?.url}
                  plan={plan}
                  stops={m.stops}
                  position={position}
                  abort={abort?.path ?? EMPTY_PATH}
                  emergency={!!emergency}
                  elapsedSec={m.elapsed}
                  returnElapsedSec={m.returnElapsed}
                  incidentAt={emergency?.at}
                  abortSec={abort?.sec}
                />
              </Suspense>
            )}
            {emergency && (
              <aside className="storm-alert" role="alert">
                <div>
                  <strong>
                    {EMERGENCY_TEXT[emergency.kind].title}{" "}
                    · T+{clock(emergency.at)}
                  </strong>
                  <p>{m.scenario ? m.scenario.evaReasons[0] : (abort?.reasons.find((r) => r.startsWith("Return home:")) ?? "No return guidance available.")}</p>
                  <ShelterGuidance shelter={shelter} from={m.emergencyOutcome!.position} />
                  <small>
                    {EMERGENCY_TEXT[emergency.kind].note}{" "}
                    {abort?.path.length
                      ? `${m.replanned ? "New plan ends in" : "Walk home"} ${minutes(Math.max(0, abort.sec - m.returnElapsed))} min · margin ${m.scenario ? `${formatMinutes(m.scenario.before.marginSec)} → ${formatMinutes(m.scenario.after.marginSec)}` : `${minutes(abort.marginSec)} min`}`
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
          {profileOn && (
            <ElevationProfile
              site={site}
              plan={emergency ? (m.returnPlan ?? plan) : plan}
              currentTSec={emergency ? m.returnElapsed : m.elapsed}
            />
          )}
          <FlightTimeline profileOn={profileOn} onToggleProfile={() => setProfileChoice(!profileOn)} />
        </section>
  );
  return (
    <main className={`console-app ${emergency ? "has-emergency" : ""}`}>
      <header className="console-header">
        <div className="console-brand">
          <AppLogo onSelect={go} />
          <AppTabs current="plan" onSelect={go} />
        </div>
        <div className="header-actions">
          {/* ONE status pill. In an emergency it is the status of the route to follow now;
              the EVA's own status and the reasons are in its tooltip. */}
          {noPlan ? (
            <span className="status status--NONE">NO PLAN</span>
          ) : emergency && abort ? (
            <span className={`status status--${abort.status}`} title={headerPillTitle} aria-label={`${headerPillText}. ${headerPillTitle}`}>
              {headerPillText}
            </span>
          ) : (
            <span className={`status status--${status}`} title={headerPillTitle}>
              EVA · {status}
            </span>
          )}
          {!noPlan && <Jargon term={emergency ? "status" : "EVA"} />}
          <button type="button" className="app-run-demo" onClick={() => runDemo(go)}>
            Run the demo
          </button>
          <ViewMenu items={viewItems} />
        </div>
      </header>
      <nav className="tablet-tabs" aria-label="Console panels">
        {CONSOLE_TABS.map((t) => (
          <button key={t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      {/* Phones: the console needs more room than a phone has. CSS shows this note under 700 px wide and hides the console. */}
      <p className="phone-note" role="note">
        ARES is built for laptop and tablet screens. The Story and Science tabs work here.
      </p>
      <div
        className={`console-body ${consolidated ? "consolidated" : ""} ${sidebarCollapsed ? "sidebar-collapsed" : ""} tablet-${tab.toLowerCase()}`}
      >
        {consolidated ? (
          <>
            <aside
              id="mission-sidebar"
              className="telemetry-col"
              hidden={sidebarCollapsed}
              aria-label="Mission telemetry and plan"
            >
              {/* The one scroll container of the column. The emergency block sits under it, always visible. */}
              <div className="telemetry-scroll">
                <MissionPanel part="status" onDetail={setDetail} />
                <MissionPanel part="stops" onDetail={setDetail} />
                <MissionPanel part="budget" onDetail={setDetail} />
                {/* Everything a first-time visitor does not need yet, behind one expander. */}
                <details className="collapsible more-details">
                  <summary>
                    <span>More details</span>
                    <small>reliability · layers · start time</small>
                  </summary>
                  <div className="more-details-body">
                    {/* Off by default. Shows what the shortest walkable path would cost, next to the ARES route. */}
                    <label className="compare-toggle" title="Draw the shortest walkable path as a dashed grey line, and show its real time and oxygen next to the ARES route.">
                      <input
                        type="checkbox"
                        checked={m.compareShortest}
                        disabled={!!emergency || plan.legs.length === 0}
                        onChange={(event) => m.setCompareShortest(event.target.checked)}
                      />
                      <span>Compare: shortest path</span>
                    </label>
                    <MissionPanel part="reliability" onDetail={setDetail} />
                    <LayerRail
                      part="layers"
                      active={active}
                      onChange={setActive}
                      probe={probe}
                      onSources={() => setSources(true)}
                    />
                    <LayerRail
                      part="start"
                      active={active}
                      onChange={setActive}
                      probe={probe}
                      onSources={() => setSources(true)}
                    />
                  </div>
                </details>
              </div>
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
          <h3>Data and model</h3>
          <p>
            Map image: HiRISE · MRO local orthomosaic ·{" "}
            {m.basemap ? `${roundHalfUp(m.basemap.metersPerPixel, 1)} m / pixel` : "elevation fallback"}.
            <br />
            Routing model: Tobler variant · 25 m grid · speed and burn rates assumed.
          </p>
          <h3>Layer sources</h3>
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
/** `initialHash` is for tests; in the browser the tab comes from the page's own URL. */
export default function App({ initialHash }: { initialHash?: string } = {}) {
  return (
    <MissionProvider>
      <Console initialHash={initialHash} />
    </MissionProvider>
  );
}
