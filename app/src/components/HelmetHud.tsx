import { formatDose, formatKm, formatPct, formatMinutes, roundHalfUp } from "../lib/planner";
import "../styles/tokens.css";
import "./mission-screens.css";

export type HudStatus = "GO" | "CAUTION" | "NO-GO";

export type HelmetHudProps = {
  status: HudStatus;
  nextStop: string;
  distanceM: number;
  headingDeg: number;
  oxygenRemainingMin: number;
  oxygenCapacityMin?: number;
  marginMin: number;
  doseMsv: number;
  localTime: string;
  temperatureC: number;
  abortWalkMin?: number;
  shelterWalkSec?: number;
  shelterSimplified?: boolean;
  returnStatus?: HudStatus;
  doseIsIllustrative?: boolean;
  measuredEventMultiplier?: number;
  onExitHud?: () => void;
};

export function HelmetHud(p: HelmetHudProps) {
  const pct = Math.max(
    0,
    Math.min(100, (p.oxygenRemainingMin / (p.oxygenCapacityMin ?? 480)) * 100),
  );
  return (
    <main
      className={`helmet-hud ${p.status === "NO-GO" ? "hud-abort" : ""}`}
      aria-label="Helmet display"
    >
      <header>
        <b>ARES-1 EVA</b>
        <span>
          EVA {p.status}
          {p.returnStatus ? " · ABORTED" : ""} · LMST {p.localTime}
          {p.returnStatus && (
            <span className={`hud-return ink-${p.returnStatus}`}>
              RETURN HOME {p.returnStatus}
            </span>
          )}
        </span>
        <button onClick={p.onExitHud}>Exit HUD · Esc</button>
      </header>
      <section className="hud-guidance">
        <div className="hud-direction">
          <span>N</span>
          <svg
            viewBox="0 0 100 100"
            aria-label={`Heading ${roundHalfUp(p.headingDeg)} degrees`}
            style={{ transform: `rotate(${p.headingDeg}deg)` }}
          >
            <path d="M50 8 78 88 50 70 22 88Z" fill="currentColor" />
          </svg>
        </div>
        <div>
          <p>
            {p.nextStop === "SHELTER" ? "ABORT · SHELTER OPTION" : p.status === "NO-GO" ? "ABORT · RETURN TO HAB-1" : "NEXT WAYPOINT"}
          </p>
          <h1>{p.nextStop}</h1>
          <strong>
            {formatKm(p.distanceM)}
          </strong>
          {p.shelterWalkSec !== undefined && (
            <p>Shelter walk {formatMinutes(p.shelterWalkSec)} {p.shelterSimplified && <small className="model-tag">simplified model</small>}</p>
          )}
          {p.abortWalkMin !== undefined && (
            <p>Walk home {formatMinutes(p.abortWalkMin * 60)}</p>
          )}
        </div>
      </section>
      <section className="hud-readouts">
        <article>
          <label>OXYGEN LEFT</label>
          <strong>
            {formatPct(pct)}
          </strong>
          <progress max="100" value={pct} />
          <span>{formatMinutes(Math.max(0, p.oxygenRemainingMin) * 60)} nominal</span>
        </article>
        <article>
          <label>RETURN MARGIN</label>
          <strong>
            {formatMinutes(p.marginMin * 60)}
          </strong>
          <span>After reserve · calculated</span>
        </article>
        <article>
          <label>DOSE</label>
          <strong>
            {formatDose(p.doseMsv)}
          </strong>
          <span>{roundHalfUp(p.temperatureC)} °C · MEDA measured data</span>
          {p.doseIsIllustrative && (
            <span>Illustrative · measured 2017 event: x{p.measuredEventMultiplier}</span>
          )}
        </article>
      </section>
    </main>
  );
}
export default HelmetHud;
