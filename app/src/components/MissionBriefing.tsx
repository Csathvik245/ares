import type { CSSProperties } from "react";
import { CONSUMABLE_HOURS, RESERVE_MIN } from "../lib/planner";
import "../styles/tokens.css";
import "./mission-screens.css";

export type MissionBriefingProps = {
  onBeginPlanning: () => void;
  terrainImageUrl?: string;
  imageCredit?: string;
  missionTitle?: string;
  siteName?: string;
  objective?: string;
  crewSummary?: string;
};

// Life support as HH:MM, e.g. 8 hours -> "08:00".
const lifeSupportMin = Math.round(CONSUMABLE_HOURS * 60);
const lifeSupportLabel = `${String(Math.floor(lifeSupportMin / 60)).padStart(2, "0")}:${String(lifeSupportMin % 60).padStart(2, "0")}`;

function AresPatch() {
  return (
    <svg
      className="briefing__patch"
      viewBox="0 0 96 96"
      role="img"
      aria-label="ARES mission patch"
    >
      <circle
        cx="48"
        cy="48"
        r="45"
        fill="#111318"
        stroke="#4fd1ff"
        strokeWidth="1.5"
      />
      <circle cx="48" cy="48" r="37" fill="none" stroke="#242833" />
      <path
        d="M48 17 70 68H59l-4-10H40l-4 10H25L48 17Zm0 20-5 12h10l-5-12Z"
        fill="#eceae6"
      />
      <path d="m23 75 25-8 25 8-25 5-25-5Z" fill="#ff6b35" />
      <circle cx="70" cy="27" r="3" fill="#4fd1ff" />
    </svg>
  );
}

export function MissionBriefing({
  onBeginPlanning,
  terrainImageUrl,
  imageCredit,
  missionTitle = "ARES-1 EVA",
  siteName = "JEZERO CRATER · DELTA FRONT",
  objective = "Sample carbonate and clay layers at the ancient river delta.",
  crewSummary = "Commander Reyes · HAB-1",
}: MissionBriefingProps) {
  const terrainStyle = terrainImageUrl
    ? ({ "--terrain-image": `url("${terrainImageUrl}")` } as CSSProperties & {
        "--terrain-image": string;
      })
    : undefined;

  return (
    <main className="mission-briefing" style={terrainStyle}>
      <div className="mission-briefing__terrain" aria-hidden="true" />
      <div className="mission-briefing__shade" aria-hidden="true" />
      <div className="mission-briefing__contours" aria-hidden="true" />

      <header className="briefing__topline">
        <a
          className="briefing__wordmark"
          href="#briefing"
          aria-label="ARES home"
        >
          <span className="briefing__wordmark-mark">A</span>
          <span>
            ARES <small>MISSION SYSTEMS</small>
          </span>
        </a>
        <div className="briefing__telemetry">
          <span>MISSION CONTROL</span>
          <span className="briefing__live">
            <i /> SYSTEMS NOMINAL
          </span>
        </div>
      </header>

      <section
        className="briefing__content"
        id="briefing"
        aria-labelledby="briefing-title"
      >
        <div className="briefing__identity">
          <AresPatch />
          <div>
            <p className="eyebrow">
              MARS SURFACE OPERATIONS <span>·</span> 2040 MISSION SCENARIO
            </p>
            <h1 id="briefing-title">{missionTitle}</h1>
            <p className="briefing__site">{siteName}</p>
          </div>
        </div>

        <div className="briefing__rule" />

        <div className="briefing__details">
          <article>
            <p className="eyebrow">SCIENCE OBJECTIVE</p>
            <p className="briefing__objective">{objective}</p>
          </article>
          <div className="briefing__facts">
            <div>
              <span>CREW</span>
              <strong>{crewSummary}</strong>
            </div>
            <div>
              <span>LIFE SUPPORT</span>
              <strong className="mono">
                {lifeSupportLabel} <small>HRS</small>
              </strong>
            </div>
            <div>
              <span>RETURN RESERVE</span>
              <strong className="mono">
                {RESERVE_MIN} <small>MIN</small>
              </strong>
            </div>
          </div>
        </div>

        <div className="briefing__actions">
          <button
            className="briefing__begin"
            type="button"
            onClick={onBeginPlanning}
          >
            <span>BEGIN PLANNING</span>
            <span aria-hidden="true">↗</span>
          </button>
          <span className="briefing__action-note">
            ROUTE · OXYGEN · SAFE RETURN
          </span>
        </div>
      </section>

      <footer className="briefing__footer">
        <span>ARES · ASTRONAUT ROUTE &amp; EVA SAFETY</span>
        <span>{imageCredit ?? "SCIENCE FIRST. SAFETY ALWAYS."}</span>
      </footer>
    </main>
  );
}

export default MissionBriefing;
