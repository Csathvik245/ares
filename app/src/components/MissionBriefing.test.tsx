import { Children, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CONSUMABLE_HOURS } from "../lib/planner";
import type { BriefingRow } from "../planner";
import { MissionBriefing } from "./MissionBriefing";

const rows: BriefingRow[] = [
  { key: "TERRAIN", value: "Route checked against the elevation grid", status: "GO", evidence: "OBSERVED" },
  { key: "CONSUMABLES", value: "Oxygen reserve needs attention", status: "CAUTION", evidence: "CALCULATED" },
  { key: "RADIATION", value: "Solar particle event: EVA aborted", status: "NO-GO", evidence: "ASSUMED" },
  { key: "WEATHER", value: "No storm now; keep watching", status: "MONITOR", evidence: "ASSUMED" },
];

describe("MissionBriefing Story", () => {
  it("renders the four numbered story beats, terrain, header and credit", () => {
    const html = renderToStaticMarkup(<MissionBriefing onBeginPlanning={() => {}} terrainImageUrl="/data/basemap.png" imageCredit="NASA/JPL-Caltech · HiRISE" />);
    expect(html).toContain("Can the astronaut get there and back?");
    for (const number of ["01", "02", "03", "04"]) expect(html).toContain(`>${number}</span>`);
    expect(html).toContain(`Jezero Crater, 2030s. ${CONSUMABLE_HOURS} hours of oxygen, 5 km of unknown terrain.`);
    expect(html).toContain("Mission Control is up to 20 minutes away by radio. The answer has to come from the suit.");
    expect(html).toContain("ARES plans the walk on real NASA terrain, checked against Perseverance&#x27;s own drive.");
    expect(html).toContain("When a storm hits, ARES re-plans the way home, right then.");
    expect(html).toContain("/data/basemap.png");
    expect(html).toContain("MISSION CONTROL · STORY");
    expect(html).toContain("The Ares Initiative · NASA Space Apps 2026");
    expect(html).toContain("NASA/JPL-Caltech · HiRISE");
  });

  it("renders every supplied poll value, status, evidence tag and overall reason", () => {
    const html = renderToStaticMarkup(<MissionBriefing onBeginPlanning={() => {}} rows={rows} status="NO-GO" reasons={["RADIATION: EVA aborted"]} />);
    expect(html).toContain("Pre-EVA · GO / NO-GO poll");
    expect(html).toContain('Overall <span class="briefing-status status--NO-GO">NO-GO</span>');
    expect(html).toContain("RADIATION: EVA aborted");
    for (const row of rows) {
      expect(html).toContain(`<th scope="row">${row.key}</th>`);
      expect(html).toContain(`<td>${row.value}</td>`);
      expect(html).toContain(`class="briefing-status status--${row.status}">${row.status}</span>`);
      expect(html).toContain(`>${row.evidence}</span>`);
    }
    expect(html).not.toContain("Loading mission data…");
  });

  it("shows loading rather than a GO clearance when no rows have arrived", () => {
    const html = renderToStaticMarkup(<MissionBriefing onBeginPlanning={() => {}} rows={[]} />);
    expect(html).toContain('role="status">Loading mission data…');
    expect(html).not.toContain("Overall");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("Run the demo");
    expect(html).toContain(">Start planning</button>");
  });

  it("renders optional demo and planning buttons with their supplied callbacks", () => {
    const onRunDemo = vi.fn(), onBeginPlanning = vi.fn();
    const tree = MissionBriefing({ onRunDemo, onBeginPlanning });
    const html = renderToStaticMarkup(tree);
    expect(html).toContain('class="briefing-primary">Run the demo</button>');
    expect(html).toContain('class="briefing-secondary">Start planning</button>');
    const visit = (node: ReactNode) => Children.forEach(node, (child) => {
      if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(child)) return;
      if (child.type === "button") child.props.onClick?.();
      visit(child.props.children);
    });
    visit(tree);
    expect(onRunDemo).toHaveBeenCalledOnce();
    expect(onBeginPlanning).toHaveBeenCalledOnce();
  });
});
