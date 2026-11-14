// Oxygen budget helpers (Contracts 2 and 3). Shared by planRoute, safeZone and abortRoute.

import { CONSUMABLE_HOURS, RESERVE_MIN, STORM_EXTRA_RESERVE_MIN } from "./constants";

/** Contract 3: CAUTION when the margin is below this fraction of the usable budget. */
export const CAUTION_MARGIN_FRACTION = 0.25;

export type OxygenBudget = {
  /** Total life support, seconds (CONSUMABLE_HOURS × 3600). */
  budgetSec: number;
  /** Oxygen that must remain at return, seconds (includes the storm extra when a storm is active). */
  reserveSec: number;
  /** What the EVA may actually spend: budgetSec − reserveSec. */
  usableSec: number;
};

export function oxygenBudget(storm: boolean): OxygenBudget {
  const budgetSec = CONSUMABLE_HOURS * 3600;
  const reserveSec = (RESERVE_MIN + (storm ? STORM_EXTRA_RESERVE_MIN : 0)) * 60;
  return { budgetSec, reserveSec, usableSec: budgetSec - reserveSec };
}

/** True when the margin is positive but below 25% of the usable budget. */
export function isLowMargin(marginSec: number, budget: OxygenBudget): boolean {
  return marginSec < CAUTION_MARGIN_FRACTION * budget.usableSec;
}
