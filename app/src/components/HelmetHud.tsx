import type { CSSProperties } from "react";
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
  onExitHud?: () => void;
};

const formatDistance = (meters: number) =>
  meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${Math.round(meters)} m`;

export function HelmetHud({
  status,
  nextStop,
  distanceM,
  headingDeg,
  oxygenRemainingMin: oxygenRemainingMinRaw,
  oxygenCapacityMin = 480,
  marginMin,
  doseMsv,
  localTime,
  temperatureC,
  onExitHud,
}: HelmetHudProps) {
  // Whole minutes, so the hours and minutes always display as whole numbers.
  const oxygenRemainingMin = Math.round(oxygenRemainingMinRaw);
  const oxygenPct = Math.max(
    0,
    Math.min(100, (oxygenRemainingMin / Math.max(1, oxygenCapacityMin)) * 100),
  );
  const statusClass = status.toLowerCase().replace("-", "");

  return (
    <main
      className={`helmet-hud helmet-hud--${statusClass}`}
      aria-label="Helmet display"
    >
      <div className="helmet-hud__visor" aria-hidden="true" />
      <div className="helmet-hud__contours" aria-hidden="true" />

      <header className="hud-topline">
        <div className="hud-topline__brand">
          <span className="hud-brand-mark">A</span>
          <span>
            ARES-1 <small>EVA</small>
          </span>
        </div>
        <div className="hud-topline__conditions">
          <span className={`hud-status hud-status--${statusClass}`}>
            <i />
            {status}
          </span>
          <span className="hud-time">
            LMST <b>{localTime}</b>
          </span>
          <span className="hud-temperature">
            {temperatureC > 0 ? "+" : ""}
            {Math.round(temperatureC)}°C
          </span>
        </div>
      </header>

      <section className="hud-main" aria-live="polite">
        <div
          className="hud-heading"
          aria-label={`Heading ${Math.round(headingDeg)} degrees`}
        >
          <div className="hud-heading__ring">
            <span className="hud-heading__north">N</span>
            <svg
              viewBox="0 0 88 108"
              aria-hidden="true"
              style={{ transform: `rotate(${headingDeg}deg)` }}
            >
              <path d="M44 7 72 91 44 75 16 91 44 7Z" fill="#4fd1ff" />
              <path
                d="M44 7v68"
                stroke="#08090b"
                strokeWidth="2"
                opacity=".7"
              />
            </svg>
          </div>
          <span className="hud-heading__readout mono">
            HDG{" "}
            {String(Math.round(((headingDeg % 360) + 360) % 360)).padStart(
              3,
              "0",
            )}
            °
          </span>
        </div>

        <div className="hud-next">
          <p className="eyebrow">NEXT SCIENCE STOP</p>
          <h1>{nextStop}</h1>
          <div className="hud-next__distance mono">
            {formatDistance(distanceM)} <span>TO WAYPOINT</span>
          </div>
          {status === "NO-GO" && (
            <p className="hud-danger-note">ABORT / RETURN TO HABITAT</p>
          )}
        </div>
      </section>

      <section className="hud-telemetry" aria-label="Mission telemetry">
        <article className="hud-metric hud-metric--oxygen">
          <div className="hud-metric__label">
            <span>OXYGEN</span>
            <span>REMAINING</span>
          </div>
          <div className="hud-oxygen">
            <div
              className="hud-oxygen__ring"
              style={
                { "--oxygen-progress": `${oxygenPct}%` } as CSSProperties & {
                  "--oxygen-progress": string;
                }
              }
            >
              <div className="hud-oxygen__center">
                <strong>
                  {Math.floor(oxygenRemainingMin / 60)}
                  <small>h</small>
                </strong>
                <span>{oxygenRemainingMin % 60}m</span>
              </div>
            </div>
            <div className="hud-oxygen__bar">
              <i style={{ width: `${oxygenPct}%` }} />
            </div>
          </div>
        </article>
        <article className="hud-metric">
          <div className="hud-metric__label">
            <span>RETURN MARGIN</span>
            <span>AFTER RESERVE</span>
          </div>
          <strong className="hud-metric__value mono">
            {marginMin < 0 ? "−" : ""}
            {Math.abs(Math.round(marginMin))}
            <small>MIN</small>
          </strong>
          <span className="hud-metric__sub">WALK BACK BUFFER</span>
        </article>
        <article className="hud-metric">
          <div className="hud-metric__label">
            <span>RADIATION DOSE</span>
            <span>CUMULATIVE</span>
          </div>
          <strong className="hud-metric__value mono">
            {doseMsv.toFixed(2)}
            <small>mSv</small>
          </strong>
          <span className="hud-metric__sub">SURFACE EXPOSURE</span>
        </article>
      </section>

      <footer className="hud-footer">
        <div>
          <span>HAB-1</span>
          <i /> <span>DELTA FRONT</span>
        </div>
        <span className="hud-footer__center">
          HELMET DISPLAY · ARES ROUTE GUIDANCE
        </span>
        {onExitHud ? (
          <button type="button" onClick={onExitHud}>
            EXIT HUD <b>ESC</b>
          </button>
        ) : (
          <span className="hud-footer__mode">EVA MODE ACTIVE</span>
        )}
      </footer>
    </main>
  );
}

export default HelmetHud;
