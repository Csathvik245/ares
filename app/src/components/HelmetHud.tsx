import { minutes } from "../lib/presentation";
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
  returnStatus?: HudStatus;
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
            aria-label={`Heading ${Math.round(p.headingDeg)} degrees`}
            style={{ transform: `rotate(${p.headingDeg}deg)` }}
          >
            <path d="M50 8 78 88 50 70 22 88Z" fill="currentColor" />
          </svg>
        </div>
        <div>
          <p>
            {p.status === "NO-GO" ? "ABORT · RETURN TO HAB-1" : "NEXT WAYPOINT"}
          </p>
          <h1>{p.nextStop}</h1>
          <strong>
            {p.distanceM >= 1000
              ? `${(p.distanceM / 1000).toFixed(1)} km`
              : `${Math.round(p.distanceM)} m`}
          </strong>
          {p.abortWalkMin !== undefined && (
            <p>Walk home {minutes(p.abortWalkMin * 60)} min</p>
          )}
        </div>
      </section>
      <section className="hud-readouts">
        <article>
          <label>OXYGEN LEFT</label>
          <strong>
            {Math.round(pct)}
            <small>%</small>
          </strong>
          <progress max="100" value={pct} />
          <span>
            {Math.max(0, Math.round(p.oxygenRemainingMin))} nominal min
          </span>
        </article>
        <article>
          <label>RETURN MARGIN</label>
          <strong>
            {minutes(p.marginMin * 60)}
            <small>min</small>
          </strong>
          <span>After reserve · calculated</span>
        </article>
        <article>
          <label>DOSE</label>
          <strong>
            {p.doseMsv.toFixed(3)}
            <small>mSv</small>
          </strong>
          <span>{Math.round(p.temperatureC)} °C · MEDA interpolation</span>
        </article>
      </section>
    </main>
  );
}
export default HelmetHud;
