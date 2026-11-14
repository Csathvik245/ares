// Shared planner types (Contract 4, CLAUDE.md section 5).

export type LatLng = { lat: number; lng: number };
export type Stop = { id: string; lat: number; lng: number; dwellMin: number; label: string };
export type Conditions = { storm: boolean; spe: boolean; startLmst: number };

export type Bounds = { south: number; north: number; west: number; east: number };
export type LayerName = "elevation" | "slope" | "rock" | "thermalInertia" | "science";

export type Poi = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: string;
  note?: string;
  photo?: string;
  photoCredit?: string;
};

/** The terrain file (Contract 1) after loading. Missing values (null) become NaN. */
export type Site = {
  name: string;
  bounds: Bounds;
  width: number;
  height: number;
  /** Size of one grid cell in meters (x = east-west, y = north-south). */
  cellSizeM: { x: number; y: number };
  /** Row-major grids: index = row * width + col. Row 0 = north, column 0 = west. */
  layers: Record<LayerName, Float32Array>;
  habitat: { name: string; lat: number; lng: number };
  pois: Poi[];
  sources: Record<string, string>;
};

/** Walking cost of every cell, built by buildCostGrid. */
export type CostGrid = {
  width: number;
  height: number;
  cellSizeM: { x: number; y: number };
  /** Seconds needed to walk one meter in each cell. Infinity = no-go. */
  secPerM: Float32Array;
  /** Smallest (fastest) value in secPerM. Used by the A* heuristic. */
  minSecPerM: number;
  /** The conditions this grid was built for (planRoute reads storm/spe from here). */
  conditions: Conditions;
};

/** Result of a Dijkstra or A* search. Both arrays have one entry per cell. */
export type SearchResult = {
  /** Walking time in seconds from the start cell. Infinity = not reached. */
  cost: Float64Array;
  /** The previous cell on the best path back to the start. -1 = none. */
  cameFrom: Int32Array;
};

export type Leg = {
  /** Cell centers along the leg, from its start to its end. Empty if unreachable. */
  path: LatLng[];
  walkSec: number;
  distM: number;
  /** Seconds since the start of the EVA when the astronaut arrives at the end of this leg. */
  arriveSec: number;
};

export type Status = "GO" | "CAUTION" | "NO-GO";

export type Plan = {
  /** False if any stop (or the way home) is unreachable. */
  ok: boolean;
  /** One leg per stop, plus a final leg back to the habitat. */
  legs: Leg[];
  totalSec: number;
  walkSec: number;
  workSec: number;
  distM: number;
  oxygenUsedSec: number;
  marginSec: number;
  oxygenAtReturnPct: number;
  status: Status;
  reasons: string[];
};
