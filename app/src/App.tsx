import { useEffect, useMemo, useState } from "react";
import { HelmetHud } from "./components/HelmetHud";
import type { HelmetHudProps } from "./components/HelmetHud";
import { MissionBriefing } from "./components/MissionBriefing";
import { bearingDeg, distanceM } from "./geo";
import {
  CONSUMABLE_HOURS,
  DOSE_MSV_PER_SOL,
  SOL_HOURS,
  WALK_BURN,
  buildCostGrid,
  loadSite,
  planRoute,
} from "./planner";
import type { Conditions, Plan, Site, Stop } from "./planner";

type Screen = "briefing" | "planning" | "hud";

// ASSUMPTION: 30 minutes of science at each stop until the stop editor exists.
const DEFAULT_DWELL_MIN = 30;

// TODO: not real yet — the start time will come from the timeline's start-time selector.
const PLACEHOLDER_START_LMST = 13;
// TODO: not real yet — local time needs the timeline clock (LMST).
const PLACEHOLDER_LOCAL_TIME = "13:00";
// TODO: not real yet — temperature needs envAt(). −23 °C is the early-afternoon
// placeholder from CLAUDE.md section 6; replace with MEDA values.
const PLACEHOLDER_TEMPERATURE_C = -23;

const CONDITIONS: Conditions = { storm: false, spe: false, startLmst: PLACEHOLDER_START_LMST };

type Mission = { site: Site; isFake: boolean; stops: Stop[]; plan: Plan };

/** Load the terrain, use the three science POIs as stops, and run the planner. */
function buildMission(json: unknown): Mission {
  const site = loadSite(json);
  const stops: Stop[] = site.pois
    .filter((poi) => poi.kind === "science")
    .slice(0, 3)
    .map((poi) => ({ id: poi.id, label: poi.name, lat: poi.lat, lng: poi.lng, dwellMin: DEFAULT_DWELL_MIN }));
  const cost = buildCostGrid(site, CONDITIONS);
  const plan = planRoute(site, cost, site.habitat, stops);
  const isFake = (json as { fake?: unknown }).fake === true;
  return { site, isFake, stops, plan };
}

/**
 * Numbers for the helmet HUD, all taken from the plan.
 * Next stop = the first stop. Distance and heading are from the habitat to it;
 * oxygen and dose are what the astronaut will have on arriving there.
 */
function hudPropsFor({ site, stops, plan }: Mission): Omit<HelmetHudProps, "onExitHud"> | null {
  const firstStop = stops[0];
  const firstLeg = plan.legs[0];
  if (!firstStop || !firstLeg) return null;

  const reachable = firstLeg.path.length > 0;
  const budgetSec = CONSUMABLE_HOURS * 3600;
  // Oxygen left on arrival at the first stop: the budget minus the oxygen burned walking there.
  const oxygenAtFirstStopSec = budgetSec - firstLeg.walkSec * WALK_BURN;
  // Dose picked up by the time of arrival, at the average surface rate (Curiosity RAD).
  const doseMsv = (DOSE_MSV_PER_SOL / SOL_HOURS) * (firstLeg.arriveSec / 3600);

  return {
    status: plan.status,
    nextStop: firstStop.label,
    // Walking distance along the planned route; straight-line if no route exists.
    distanceM: reachable ? firstLeg.distM : distanceM(site.habitat, firstStop),
    headingDeg: bearingDeg(site.habitat, firstStop),
    oxygenRemainingMin: Math.round(oxygenAtFirstStopSec / 60),
    oxygenCapacityMin: CONSUMABLE_HOURS * 60,
    marginMin: plan.marginSec / 60,
    doseMsv,
    localTime: PLACEHOLDER_LOCAL_TIME, // TODO: not real yet
    temperatureC: PLACEHOLDER_TEMPERATURE_C, // TODO: not real yet
  };
}

const formatKm = (meters: number) => `${(meters / 1000).toFixed(2)} km`;
const formatDuration = (sec: number) => {
  const totalMin = Math.round(sec / 60);
  return `${Math.floor(totalMin / 60)} h ${String(totalMin % 60).padStart(2, "0")} min`;
};
const formatMargin = (sec: number) => `${sec < 0 ? "−" : ""}${Math.abs(Math.round(sec / 60))} min`;

function PlanningScreen({ mission, error, onOpenHud }: { mission: Mission | null; error: string | null; onOpenHud: () => void }) {
  if (error) {
    return (
      <main className="planning">
        <p className="planning__message planning__message--error" role="alert">
          COULD NOT LOAD TERRAIN: {error}
        </p>
      </main>
    );
  }
  if (!mission) {
    return (
      <main className="planning">
        <p className="planning__message">LOADING TERRAIN…</p>
      </main>
    );
  }

  const { site, isFake, stops, plan } = mission;
  const statusClass = plan.status.toLowerCase().replace("-", "");

  return (
    <main className="planning">
      <header className="planning__header">
        <div>
          <p className="planning__eyebrow">
            EVA PLANNING · {site.habitat.name}
            {isFake && <span className="planning__fake"> · FAKE TERRAIN DATA</span>}
          </p>
          <h1 className="planning__title">{site.name}</h1>
        </div>
        <button className="planning__button" type="button" onClick={onOpenHud} disabled={stops.length === 0}>
          HELMET HUD <kbd>H</kbd>
        </button>
      </header>

      <div className="planning__grid">
        <section className="planning__panel planning__map-placeholder" aria-label="Map">
          <p>
            MAP GOES HERE
            <br />
            {site.width} × {site.height} CELLS · {site.cellSizeM.x} × {site.cellSizeM.y} M
          </p>
        </section>

        <section className="planning__panel" aria-label="Plan summary">
          <p className="planning__eyebrow">STATUS</p>
          <span className={`planning__status planning__status--${statusClass}`}>{plan.status}</span>
          <ul className="planning__reasons">
            {plan.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>

          <dl className="planning__stats">
            <dt>TOTAL DISTANCE</dt>
            <dd>{formatKm(plan.distM)}</dd>
            <dt>DURATION</dt>
            <dd>{formatDuration(plan.totalSec)}</dd>
            <dt>OXYGEN MARGIN</dt>
            <dd>{formatMargin(plan.marginSec)}</dd>
          </dl>

          <p className="planning__eyebrow" style={{ marginTop: "var(--space-6)" }}>
            STOPS
          </p>
          <ol className="planning__stops">
            {stops.map((stop) => (
              <li key={stop.id}>
                {stop.label} <span>· {stop.dwellMin} min science</span>
              </li>
            ))}
          </ol>
          <p className="planning__note">
            Stops are the three science points from site.json, {DEFAULT_DWELL_MIN} min each (assumed).
          </p>
        </section>
      </div>
    </main>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("briefing");
  const [mission, setMission] = useState<Mission | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/site.json")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((json) => {
        if (!cancelled) setMission(buildMission(json));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hudProps = useMemo(() => (mission ? hudPropsFor(mission) : null), [mission]);
  const canShowHud = hudProps !== null;

  // H toggles the helmet HUD from the planning screen; Esc leaves it.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const key = event.key.toLowerCase();
      if (key === "h" && canShowHud) {
        setScreen((current) => (current === "planning" ? "hud" : current === "hud" ? "planning" : current));
      } else if (key === "escape") {
        setScreen((current) => (current === "hud" ? "planning" : current));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canShowHud]);

  if (screen === "briefing") {
    return <MissionBriefing onBeginPlanning={() => setScreen("planning")} />;
  }
  if (screen === "hud" && hudProps) {
    return <HelmetHud {...hudProps} onExitHud={() => setScreen("planning")} />;
  }
  return <PlanningScreen mission={mission} error={error} onOpenHud={() => setScreen("hud")} />;
}
