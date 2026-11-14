import {
  BASE_SPEED_KMH,
  MAX_SLOPE_DEG,
  ROCK_NO_GO,
  SAND_SPEED_FACTOR,
  SAND_TI_THRESHOLD,
  STORM_SPEED_FACTOR,
} from "./constants";
import type { Conditions, CostGrid, Site } from "./types";

const DEG_TO_RAD = Math.PI / 180;

/**
 * Walking speed in meters per second for one cell (Contract 2).
 * This is a variant of Tobler's hiking function:
 *   speed = BASE_SPEED × exp(−3.0 × tan(slope))
 *           × (SAND_SPEED_FACTOR if thermal inertia < 175)
 *           × (1 − 0.6 × rock)
 *           × (STORM_SPEED_FACTOR if storm)
 * Returns 0 for no-go cells: slope > MAX_SLOPE_DEG or rock > ROCK_NO_GO.
 *
 * ASSUMPTION: a cell with a missing slope or rock value is treated as no-go
 * (we do not walk across terrain we have no data for). Missing thermal inertia
 * is treated as firm ground.
 */
export function walkingSpeedMps(
  slopeDeg: number,
  rock: number,
  thermalInertia: number,
  storm: boolean,
): number {
  if (Number.isNaN(slopeDeg) || Number.isNaN(rock)) return 0;
  if (slopeDeg > MAX_SLOPE_DEG || rock > ROCK_NO_GO) return 0;
  let speed = (BASE_SPEED_KMH / 3.6) * Math.exp(-3.0 * Math.tan(slopeDeg * DEG_TO_RAD));
  if (thermalInertia < SAND_TI_THRESHOLD) speed *= SAND_SPEED_FACTOR;
  speed *= 1 - 0.6 * rock;
  if (storm) speed *= STORM_SPEED_FACTOR;
  return speed;
}

/**
 * Cost of every cell in seconds per meter (1 / speed). No-go cells are Infinity.
 * Rebuild it whenever the conditions change (for example when a storm starts).
 */
export function buildCostGrid(site: Site, conditions: Conditions): CostGrid {
  const { slope, rock, thermalInertia } = site.layers;
  const count = site.width * site.height;
  const secPerM = new Float32Array(count);
  let minSecPerM = Infinity;
  for (let i = 0; i < count; i++) {
    const speed = walkingSpeedMps(slope[i], rock[i], thermalInertia[i], conditions.storm);
    const cost = speed > 0 ? 1 / speed : Infinity;
    secPerM[i] = cost;
    // Read the value back so minSecPerM matches the stored 32-bit number exactly.
    if (secPerM[i] < minSecPerM) minSecPerM = secPerM[i];
  }
  return {
    width: site.width,
    height: site.height,
    cellSizeM: { x: site.cellSizeM.x, y: site.cellSizeM.y },
    secPerM,
    minSecPerM,
    conditions: { ...conditions },
  };
}
