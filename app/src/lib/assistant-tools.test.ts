import { expect, it, vi } from "vitest";
import { loadSite, buildCostGrid, planRoute } from "./planner";
import { runAssistantTool, type AssistantState } from "./assistant-tools";
function state(): AssistantState {
  const site = loadSite({
    width: 5,
    height: 5,
    bounds: { south: 0, north: 0.01, west: 0, east: 0.01 },
    cellSizeM: { x: 25, y: 25 },
    habitat: { name: "HAB", lat: 0.005, lng: 0.005 },
    pois: [],
    sources: {},
    layers: {
      elevation: Array(25).fill(0),
      slope: Array(25).fill(0),
      thermalInertia: Array(25).fill(200),
      rock: Array(25).fill(0),
      science: Array(25).fill(0),
    },
  });
  const cost = buildCostGrid(site, { storm: false, spe: false, startLmst: 13 });
  return {
    site,
    cost,
    plan: planRoute(site, cost, site.habitat, []),
    stops: [],
    emergency: false,
    edit: vi.fn(),
    stormAt: vi.fn(() => ({ status: "CAUTION" })),
  };
}
it("keeps sequential tool mutations and returns actual planner summaries", () => {
  const s = state();
  const args = { lat: 0.005, lng: 0.007, dwellMin: 5, label: "A" };
  runAssistantTool(s, "add_stop", args);
  runAssistantTool(s, "add_stop", { ...args, label: "B" });
  const result = runAssistantTool(s, "get_plan_summary") as {
    stops: unknown[];
    oxygenUsedSec: number;
  };
  expect(result.stops).toHaveLength(2);
  expect(result.oxygenUsedSec).toBeGreaterThan(0);
  expect(s.edit).toHaveBeenCalledTimes(2);
});
it("rejects invalid reorder and outside-site stops without changing state", () => {
  const s = state();
  expect(() =>
    runAssistantTool(s, "add_stop", { lat: 99, lng: 99, dwellMin: 5 }),
  ).toThrow("outside");
  expect(() =>
    runAssistantTool(s, "reorder_stops", { stopIds: ["unknown"] }),
  ).toThrow();
  expect(s.edit).not.toHaveBeenCalled();
});
it("blocks edits after a storm in the same tool sequence", () => {
  const s = state();
  runAssistantTool(s, "simulate_storm", { atSec: 0 });
  expect(s.stormAt).toHaveBeenCalledWith(0);
  expect(() =>
    runAssistantTool(s, "add_stop", { lat: 0.005, lng: 0.005, dwellMin: 5 }),
  ).toThrow("Reset");
});
