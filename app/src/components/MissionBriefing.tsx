import { CONSUMABLE_HOURS } from "../lib/planner";
import type { BriefingRow, Status } from "../planner";
import { EvidenceTag } from "./EvidenceTag";
import "../styles/tokens.css";
import "./mission-screens.css";

export type MissionBriefingProps = {
  onBeginPlanning: () => void;
  onRunDemo?: () => void;
  terrainImageUrl?: string;
  imageCredit?: string;
  missionTitle?: string;
  siteName?: string;
  objective?: string;
  crewSummary?: string;
  rows?: BriefingRow[];
  status?: Status;
  reasons?: string[];
};

export function MissionBriefing({
  onBeginPlanning,
  onRunDemo,
  terrainImageUrl,
  imageCredit,
  missionTitle = "ARES-1 EVA",
  siteName = "Jezero Crater delta front",
  rows = [],
  status = "GO",
  reasons = [],
}: MissionBriefingProps) {
  return (
    <main className="mission-briefing" aria-label="Story">
      <div
        className="briefing-terrain"
        aria-hidden="true"
        style={
          terrainImageUrl
            ? { backgroundImage: `url("${terrainImageUrl}")` }
            : undefined
        }
      />
      <header>
        ARES <span>MISSION CONTROL · STORY</span>
      </header>
      <section className="briefing-content" aria-labelledby="briefing-title">
        <div className="briefing-intro">
          <p className="briefing-eyebrow">{missionTitle} · {siteName}</p>
          <h1 id="briefing-title">Can the astronaut get there and back?</h1>
        </div>
        <ol className="briefing-beats" aria-label="The mission story">
          <li><span aria-hidden="true">01</span><p>Jezero Crater, 2030s. {CONSUMABLE_HOURS} hours of oxygen, 5 km of unknown terrain.</p></li>
          <li><span aria-hidden="true">02</span><p>Mission Control is up to 20 minutes away by radio. The answer has to come from the suit.</p></li>
          <li><span aria-hidden="true">03</span><p>ARES plans the walk on real NASA terrain, checked against Perseverance&apos;s own drive.</p></li>
          <li><span aria-hidden="true">04</span><p>When a storm hits, ARES re-plans the way home, right then.</p></li>
        </ol>
        <section className="briefing-poll" aria-labelledby="briefing-poll-title">
          <div className="briefing-poll-heading">
            <h2 id="briefing-poll-title">Pre-EVA · GO / NO-GO poll</h2>
            {rows.length > 0 && (
              <p className="briefing-overall">Overall <span className={`briefing-status status--${status}`}>{status}</span></p>
            )}
          </div>
          {rows.length > 0 ? (
            <>
              {reasons.length > 0 && (
                <ul className="briefing-reasons" aria-label="Overall status reasons">
                  {reasons.map((reason, index) => <li key={index}>{reason}</li>)}
                </ul>
              )}
              <table aria-label="Pre-EVA poll">
                <thead className="briefing-table-head">
                  <tr><th scope="col">System</th><th scope="col">Assessment</th><th scope="col">Status</th><th scope="col">Evidence</th></tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row">{row.key}</th>
                      <td>{row.value}</td>
                      <td><span className={`briefing-status status--${row.status}`}>{row.status}</span></td>
                      <td><EvidenceTag level={row.evidence} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : <p className="briefing-empty" role="status">Loading mission data…</p>}
        </section>
        <div className="briefing-actions">
          {onRunDemo && <button type="button" className="briefing-primary" onClick={onRunDemo}>Run the demo</button>}
          <button type="button" className="briefing-secondary" onClick={onBeginPlanning}>Start planning</button>
        </div>
      </section>
      <footer>
        <span>The Ares Initiative · NASA Space Apps 2026</span>
        <span>{imageCredit ?? "Terrain imagery pending"}</span>
      </footer>
    </main>
  );
}
export default MissionBriefing;
