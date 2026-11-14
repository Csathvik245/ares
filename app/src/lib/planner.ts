// I2 integration boundary: the UI imports planner functions only from this file.
// Safe zone, playback, abort, and segment explanations now use real planner exports.
export * from "../planner";
import {
  cellIndexOf,
  fieldFrom,
  DOSE_MSV_PER_SOL,
  SOL_HOURS,
  SPE_MULTIPLIER,
} from "../planner";
import type { CostGrid, Site } from "../planner";

export function homeField(site: Site, cost: CostGrid) {
  return fieldFrom(cost, cellIndexOf(site, site.habitat));
}

// STUB: fixed demonstration conditions, not Mars24 or live MEDA observations.
// Replace with `export { envAt } from '../planner'` when the real model lands.
export function envAt(_lmst: number, spe: boolean) {
  return {
    sunElevationDeg: 45,
    tempC: -23,
    doseRateMsvPerHr:
      (DOSE_MSV_PER_SOL / SOL_HOURS) * (spe ? SPE_MULTIPLIER : 1),
  };
}
