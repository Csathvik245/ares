// Oxygen budget helpers (Contracts 2 and 3). Shared by planRoute, safeZone and abortRoute.

import { CONSUMABLE_HOURS, RESERVE_MIN, STORM_EXTRA_RESERVE_MIN, WALK_BURN, WORK_BURN } from "./constants";

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

/**
 * The oxygen budget. `overrides` is for "What if?" planning (whatif.ts): a different suit
 * supply or reserve. Leave it out (or leave a value out) for the planner's own constants.
 */
export function oxygenBudget(storm: boolean, overrides: { consumableHours?: number; reserveMin?: number } = {}): OxygenBudget {
  const budgetSec = (overrides.consumableHours ?? CONSUMABLE_HOURS) * 3600;
  const reserveSec = ((overrides.reserveMin ?? RESERVE_MIN) + (storm ? STORM_EXTRA_RESERVE_MIN : 0)) * 60;
  return { budgetSec, reserveSec, usableSec: budgetSec - reserveSec };
}

/**
 * Oxygen used, in seconds of nominal life support (Contract 2):
 * walkSec × WALK_BURN + scienceSec × WORK_BURN. The burn rates can be passed in, so
 * the Monte Carlo simulator (montecarlo.ts) can vary them without a second formula.
 */
export function oxygenUsedSec(walkSec: number, scienceSec: number, walkBurn: number = WALK_BURN, workBurn: number = WORK_BURN): number {
  return walkSec * walkBurn + scienceSec * workBurn;
}

/** True when the margin is positive but below 25% of the usable budget. */
export function isLowMargin(marginSec: number, budget: OxygenBudget): boolean {
  return marginSec < CAUTION_MARGIN_FRACTION * budget.usableSec;
}
