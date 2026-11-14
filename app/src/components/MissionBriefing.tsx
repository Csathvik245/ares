import { CONSUMABLE_HOURS } from "../lib/planner";
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

export function MissionBriefing({
  onBeginPlanning,
  terrainImageUrl,
  imageCredit,
  missionTitle = "ARES-1 EVA",
  siteName = "Jezero Crater delta front",
}: MissionBriefingProps) {
  return (
    <main className="mission-briefing">
      <div
        className="briefing-terrain"
        style={
          terrainImageUrl
            ? { backgroundImage: `url("${terrainImageUrl}")` }
            : undefined
        }
      />
      <header>
        ARES <span>MISSION CONTROL</span>
      </header>
      <section>
        <p>
          {missionTitle} · {siteName}
        </p>
        <h1>
          {CONSUMABLE_HOURS} hours of oxygen.
          <br />5 km of unknown terrain.
        </h1>
        <p>Sample carbonate and clay. Return safely.</p>
        <button onClick={onBeginPlanning}>Begin planning</button>
      </section>
      <footer>
        <span>The Ares Initiative</span>
        <span>{imageCredit ?? "Terrain imagery pending"}</span>
      </footer>
    </main>
  );
}
export default MissionBriefing;
