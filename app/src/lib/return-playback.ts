import {
  oxygenBudget,
  polylineLengthM,
  WALK_BURN,
  type AbortRoute,
  type Plan,
} from "./planner";
/** Display adapter only: abortRoute supplies the path, time, margin and status. */
export function returnPlaybackPlan(
  abort: AbortRoute,
  usedSec: number,
  storm: boolean,
): Plan | null {
  if (!abort.path.length || !Number.isFinite(abort.sec)) return null;
  const distM = polylineLengthM(abort.path),
    oxygenUsedSec = abort.sec * WALK_BURN;
  const budget = oxygenBudget(storm);
  return {
    ok: true,
    legs: [
      { path: abort.path, walkSec: abort.sec, distM, arriveSec: abort.sec },
    ],
    totalSec: abort.sec,
    walkSec: abort.sec,
    workSec: 0,
    distM,
    oxygenUsedSec,
    marginSec: abort.marginSec,
    oxygenAtReturnPct: Math.max(
      0,
      (100 * (budget.budgetSec - usedSec - oxygenUsedSec)) / budget.budgetSec,
    ),
    status: abort.status,
    reasons: abort.reasons,
  };
}
