import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import raw from "../../public/data/site.json";
import { buildCostGrid, loadSite, planRoute, stormAt, distanceM, readSkyView } from "../lib/planner";
import { ShelterGuidance } from "./ShelterGuidance";
import { HelmetHud } from "./HelmetHud";

const site = loadSite(raw);
const skyView = readSkyView(raw);
const cost = buildCostGrid(site, { storm: false, spe: false, startLmst: 13 });
const demo = site.pois.slice(0, 3).map(p => ({ ...p, label: p.name, dwellMin: 30 }));
const plan = planRoute(site, cost, site.habitat, demo);
const render = (outcome: ReturnType<typeof stormAt>) => renderToStaticMarkup(
  <ShelterGuidance shelter={outcome.shelter} from={outcome.position} />,
);
it("checks SPE shelter on the demo mission and preserves the planner reasons", () => {
  const outcome = stormAt(site, plan, 4560, "spe", 13, { skyView });
  expect(outcome.shelter.checked).toBe(true);
  if (!outcome.shelter.checked) throw Error("SPE shelter check missing");
  expect(outcome.shelter.betterThanHome).toBe(false);
  expect(render(outcome)).toContain("Shelter checked: walking home is better.");
  expect(render(outcome)).toContain("simplified model");
  expect(render(outcome)).toContain(outcome.shelter.reasons![0]);
});
it("offers a real shelter at Wildcat Ridge without changing return-home status", () => {
  const poi = site.pois.find(p => p.id === "delta-wildcat-ridge")!;
  const wildcatPlan = planRoute(site, cost, site.habitat, [{ ...poi, label: poi.name, dwellMin: 0 }]);
  expect(wildcatPlan.ok).toBe(true);
  const outcome = stormAt(site, wildcatPlan, wildcatPlan.legs[0].arriveSec, "spe", 13, { skyView });
  if (!outcome.shelter.checked) throw Error("Wildcat shelter check missing");
  expect(outcome.shelter.betterThanHome).toBe(true);
  expect(outcome.evaStatus).toBe("NO-GO");
  expect(outcome.abort.status).toBe("CAUTION");
  expect(distanceM(outcome.position, outcome.shelter.target!)).toBeGreaterThan(0);
  expect(render(outcome)).toContain("Shelter: 160 m away, 9 min walk, about 12% lower dose than walking home.");
  const hud = renderToStaticMarkup(<HelmetHud status="NO-GO" nextStop="SHELTER" distanceM={163} headingDeg={98}
    oxygenRemainingMin={385} marginMin={246} doseMsv={0.032} localTime="14:11" temperatureC={-34} shelterWalkSec={outcome.shelter.sec} shelterSimplified doseIsIllustrative />);
  expect(hud).toContain("SHELTER</h1>");
  expect(hud).toContain("ABORT · SHELTER OPTION");
  expect(hud).toContain("Illustrative");
  expect(hud).toContain("Shelter walk 9 min");
  expect(hud).toContain("simplified model");
});
it("shows no shelter guidance for dust storms", () => {
  const outcome = stormAt(site, plan, 4560, "dust", 13, { skyView });
  expect(outcome.shelter.checked).toBe(false);
  expect(render(outcome)).toBe("");
});
