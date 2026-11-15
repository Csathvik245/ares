// "What if?" overrides: plan the same walk with a different suit oxygen supply, walking
// speed or reserve, to see how much our assumptions change the answer.
//
// Nothing here is a second formula. The oxygen budget is still oxygenBudget() (oxygen.ts)
// and a different walking speed is still slowedGrid() (emergencies.ts, the grid the
// "slower walking" emergency uses). With no overrides every result is exactly what it
// was before this file existed.
import { CONSUMABLE_HOURS, RESERVE_MIN } from "./constants";
import { slowedGrid } from "./emergencies";
import type { CostGrid } from "./types";

export type WhatIf = {
  /** Suit life support, hours at the nominal rate. Default CONSUMABLE_HOURS. */
  consumableHours?: number;
  /** Walking speed as a multiple of the planned speed (0.7 = 30% slower, 1.3 = 30% faster). Default 1. */
  speedFactor?: number;
  /** Oxygen that must remain at return, minutes. Default RESERVE_MIN. */
  reserveMin?: number;
};

/** The planner's own values: what every override falls back to. */
export const WHAT_IF_DEFAULTS: Required<WhatIf> = { consumableHours: CONSUMABLE_HOURS, speedFactor: 1, reserveMin: RESERVE_MIN };

const usable = (value: number | undefined): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

/** The overrides with every missing or unusable value replaced by the planner's default. */
export function resolveWhatIf(whatIf?: WhatIf): Required<WhatIf> {
  return {
    consumableHours: usable(whatIf?.consumableHours) ? whatIf.consumableHours : WHAT_IF_DEFAULTS.consumableHours,
    speedFactor: usable(whatIf?.speedFactor) ? whatIf.speedFactor : WHAT_IF_DEFAULTS.speedFactor,
    reserveMin: usable(whatIf?.reserveMin) ? whatIf.reserveMin : WHAT_IF_DEFAULTS.reserveMin,
  };
}

/** True when at least one value differs from the planner's default. */
export function isWhatIf(whatIf?: WhatIf): boolean {
  const w = resolveWhatIf(whatIf);
  return w.consumableHours !== WHAT_IF_DEFAULTS.consumableHours || w.speedFactor !== WHAT_IF_DEFAULTS.speedFactor || w.reserveMin !== WHAT_IF_DEFAULTS.reserveMin;
}

/**
 * The cost grid to plan on: `cost` itself at the default speed, or the same grid with
 * walking `speedFactor` times as fast. planRoute({ whatIf }) uses this, so pass the same
 * grid to safeZone and the walk-home field when a speed override is set. It is built once
 * per grid and factor.
 */
export function whatIfGrid(cost: CostGrid, whatIf?: WhatIf): CostGrid {
  const { speedFactor } = resolveWhatIf(whatIf);
  return speedFactor === 1 ? cost : slowedGrid(cost, speedFactor);
}
