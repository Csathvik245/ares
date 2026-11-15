// The on-screen evidence labels use only the four levels, and stay short.
import { describe, expect, it } from "vitest";
import { SCIENCE_EVIDENCE } from "../planner";
import { EVIDENCE_LABELS } from "./evidenceLabels";

const LEVELS = ["OBSERVED", "CALCULATED", "INTERPRETED", "ASSUMED"];

describe("EVIDENCE_LABELS", () => {
  it("every label starts with one of the four evidence levels", () => {
    for (const label of Object.values(EVIDENCE_LABELS)) {
      expect(LEVELS.some((level) => label.startsWith(level))).toBe(true);
    }
  });

  it("matches the level each kind of number should carry", () => {
    expect(EVIDENCE_LABELS.route).toBe("CALCULATED");
    expect(EVIDENCE_LABELS.oxygen.startsWith("CALCULATED")).toBe(true);
    expect(EVIDENCE_LABELS.radiation).toContain("OBSERVED at Gale");
    expect(EVIDENCE_LABELS.spe).toBe("ASSUMED");
    expect(EVIDENCE_LABELS.science).toBe(SCIENCE_EVIDENCE);
  });

  it("is no longer than the free-text labels it replaced, so nothing reflows", () => {
    expect(EVIDENCE_LABELS.route.length).toBeLessThanOrEqual("calculated".length);
    expect(EVIDENCE_LABELS.oxygen.length).toBeLessThanOrEqual("calculated · assumed burn rates".length);
    expect(EVIDENCE_LABELS.sun.length).toBeLessThanOrEqual("calculated · Mars24".length);
    expect(EVIDENCE_LABELS.radiation.length).toBeLessThanOrEqual("projected · RAD baseline".length);
    expect(EVIDENCE_LABELS.spe.length).toBeLessThanOrEqual("illustrative".length);
    expect(EVIDENCE_LABELS.emergency.length).toBeLessThanOrEqual("assumed response".length);
  });
});
