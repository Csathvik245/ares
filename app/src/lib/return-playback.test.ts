import { expect, it } from "vitest";
import { returnPlaybackPlan } from "./return-playback";
import { positionAt, CONSUMABLE_HOURS, WALK_BURN } from "./planner";
const abort = {
  path: [
    { lat: 18.44, lng: 77.45 },
    { lat: 18.441, lng: 77.452 },
  ],
  sec: 600,
  marginSec: 1000,
  status: "CAUTION" as const,
  reasons: ["Return to habitat."],
};
it("animates the real abort polyline and keeps incident oxygen separate", () => {
  const used = 1200,
    p = returnPlaybackPlan(abort, used, true)!;
  expect(positionAt(p, 0)).toMatchObject(abort.path[0]);
  expect(positionAt(p, 600)).toMatchObject(abort.path[1]);
  expect(positionAt(p, 300).oxygenUsedSec + used).toBe(1200 + 300 * WALK_BURN);
  expect(p.oxygenAtReturnPct).toBeCloseTo(
    (100 * (CONSUMABLE_HOURS * 3600 - used - 600 * WALK_BURN)) /
      (CONSUMABLE_HOURS * 3600),
  );
  expect(p.marginSec).toBe(abort.marginSec);
});
it("does not animate an unreachable return", () =>
  expect(
    returnPlaybackPlan({ ...abort, path: [], sec: Infinity }, 1200, true),
  ).toBeNull());
