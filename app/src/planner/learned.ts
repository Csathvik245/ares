// Learned route cost: route SHAPE learned from the routes Perseverance's drivers chose.
// OFF BY DEFAULT. Nothing in the app uses it unless a caller passes
// planRoute(..., { routeGrid: buildLearnedCostGrid(...) }).
//
// The weights are trained offline by pipeline/learn_route_cost.py (maximum margin
// planning, LEARCH-style; Ratliff et al. 2006, 2009) and shipped in
// app/public/data/route-model.json. At run time nothing is learned: the grid is a
// fixed function of the terrain,
//   cost ratio = walk_time^a × exp(v1·f1 + v2·f2 + …)
// (walk_time = Contract 2 walking time ÷ flat firm ground; e^v = how many times
// dearer that kind of ground is), and A* runs on it exactly as on the physics grid.
// Same stops, same route, every time. Results: docs/route-learning.md.
//
// Safety rules this file keeps:
//   - A cell is no-go here exactly when it is no-go in buildCostGrid (Contract 2).
//   - The model can only make a route MORE careful than the physics route, never
//     less: loadRouteModel refuses a walking-time power below 1 or any negative
//     hazard weight, whatever the file says.
//   - The grid only chooses the path. planRoute's `routeGrid` option still works out
//     walking time, oxygen and status on the Contract 2 grid.
//
// Feature definitions must match pipeline/learn_route_cost.py (cell_features). The
// model file carries `checks` (cell index → expected cost ratio) so a unit test can
// prove the two agree.

import { BASE_SPEED_KMH, SAND_TI_THRESHOLD, STORM_SPEED_FACTOR } from "./constants";
import { walkingSpeedMps } from "./cost";
import { distanceM, forEachCellOnSegment } from "./geom";
import type { Conditions, CostGrid, Plan, Site } from "./types";

/** Feature order used by the weights. */
export const ROUTE_FEATURES = [
  "log_walk_time",
  "slope_over_8",
  "slope_over_15",
  "roughness",
  "soft_sand",
  "loose_ground",
  "near_no_go",
] as const;
export type RouteFeature = (typeof ROUTE_FEATURES)[number];

export type RouteModel = {
  /** Weight per feature, in ROUTE_FEATURES order. log_walk_time's weight is the power a. */
  weights: Float64Array;
  /** Weights by name, for display. */
  weightOf: Record<RouteFeature, number>;
  nearNoGoRadiusCells: number;
  looseTiHigh: number;
  about: string;
  assumption: string;
  source: { traverse: string; credit: string; sols: [number, number]; routes: number; km: number };
  /** Held-out scores from training (see docs/route-learning.md); shape owned by the pipeline. */
  evaluation: Record<string, unknown> | null;
  checks: { index: number; ratio: number | null }[];
};

/** Seconds per meter on flat firm ground in calm weather (Contract 2). */
const FLAT_SEC_PER_M = 3.6 / BASE_SPEED_KMH;

/**
 * Read route-model.json. Throws if a feature is missing, unknown or out of order
 * (a model trained with other features can never be used by mistake), or if the
 * weights would make any ground look safer than the physics model says.
 */
export function loadRouteModel(json: any): RouteModel {
  if (!json || !Array.isArray(json.features)) throw new Error("route model: missing features");
  const ids = json.features.map((f: any) => f?.id);
  if (ids.length !== ROUTE_FEATURES.length || ROUTE_FEATURES.some((id, k) => ids[k] !== id)) {
    throw new Error(`route model: expected features ${ROUTE_FEATURES.join(", ")}, got ${ids.join(", ")}`);
  }
  const weights = new Float64Array(ROUTE_FEATURES.length);
  const weightOf = {} as Record<RouteFeature, number>;
  ROUTE_FEATURES.forEach((id, k) => {
    const w = Number(json.features[k].weight);
    if (!Number.isFinite(w)) throw new Error(`route model: bad weight for ${id}`);
    weights[k] = w;
    weightOf[id] = w;
  });
  // Safety rule: never less careful than the physics model.
  if (!(weights[0] >= 1)) {
    throw new Error("route model: log_walk_time power must be at least 1 (never less careful than physics)");
  }
  for (let k = 1; k < weights.length; k++) {
    if (weights[k] < 0) {
      throw new Error(`route model: ${ROUTE_FEATURES[k]} weight is negative (would make that ground look safer than physics says)`);
    }
  }
  const radius = Number(json.nearNoGoRadiusCells);
  const looseTiHigh = Number(json.looseTiHigh);
  if (!Number.isInteger(radius) || radius < 0) throw new Error("route model: bad nearNoGoRadiusCells");
  if (!(looseTiHigh > SAND_TI_THRESHOLD)) throw new Error("route model: bad looseTiHigh");
  return {
    weights,
    weightOf,
    nearNoGoRadiusCells: radius,
    looseTiHigh,
    about: String(json.about ?? ""),
    assumption: String(json.assumption ?? ""),
    source: json.source,
    evaluation: json.evaluation ?? null,
    checks: Array.isArray(json.checks) ? json.checks : [],
  };
}

/** 1 where the cell is no-go under Contract 2 (calm weather; storms don't change what is passable). */
function noGoMask(site: Site): Uint8Array {
  const { slope, rock, thermalInertia } = site.layers;
  const n = site.width * site.height;
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = walkingSpeedMps(slope[i], rock[i], thermalInertia[i], false) > 0 ? 0 : 1;
  return mask;
}

/** 1 where a no-go cell lies within `r` cells (square neighbourhood, like scipy's binary_dilation). */
function nearMask(mask: Uint8Array, width: number, height: number, r: number): Uint8Array {
  const rows = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    const base = y * width;
    for (let x = 0; x < width; x++) {
      let hit = 0;
      for (let dx = -r; dx <= r && !hit; dx++) {
        const xx = x + dx;
        if (xx >= 0 && xx < width && mask[base + xx]) hit = 1;
      }
      rows[base + x] = hit;
    }
  }
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let hit = 0;
      for (let dy = -r; dy <= r && !hit; dy++) {
        const yy = y + dy;
        if (yy >= 0 && yy < height && rows[yy * width + x]) hit = 1;
      }
      out[y * width + x] = hit;
    }
  }
  return out;
}

/**
 * Learned cost of every cell as a multiple of flat firm ground (1 = flat firm ground
 * by the physics model). Infinity on no-go cells.
 */
export function learnedCostRatio(site: Site, model: RouteModel): Float64Array {
  const { slope, rock, thermalInertia } = site.layers;
  const n = site.width * site.height;
  const nogo = noGoMask(site);
  const near = nearMask(nogo, site.width, site.height, model.nearNoGoRadiusCells);
  const w = model.weights;
  const looseSpan = model.looseTiHigh - SAND_TI_THRESHOLD;
  const ratio = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    if (nogo[i]) {
      ratio[i] = Infinity;
      continue;
    }
    const s = slope[i];
    const ti = thermalInertia[i];
    const tiKnown = !Number.isNaN(ti);
    const walk = 1 / walkingSpeedMps(s, rock[i], ti, false) / FLAT_SEC_PER_M;
    const loose = tiKnown ? Math.min(1, Math.max(0, (model.looseTiHigh - ti) / looseSpan)) : 0;
    ratio[i] = Math.exp(
      w[0] * Math.log(walk) +
        w[1] * (Math.max(0, s - 8) / 10) +
        w[2] * (Math.max(0, s - 15) / 10) +
        w[3] * (rock[i] / 0.2) +
        w[4] * (tiKnown && ti < SAND_TI_THRESHOLD ? 1 : 0) +
        w[5] * loose +
        w[6] * near[i],
    );
  }
  return ratio;
}

/**
 * A cost grid for choosing the route shape only. Pass it to planRoute as
 * `{ routeGrid }`; never use its secPerM as a walking time.
 * No-go cells are exactly the Contract 2 no-go cells. In a storm every cell is
 * scaled by the same factor, so the route shape does not change.
 */
export function buildLearnedCostGrid(site: Site, model: RouteModel, conditions: Conditions): CostGrid {
  const ratio = learnedCostRatio(site, model);
  const scale = FLAT_SEC_PER_M / (conditions.storm ? STORM_SPEED_FACTOR : 1);
  const secPerM = new Float32Array(ratio.length);
  let minSecPerM = Infinity;
  for (let i = 0; i < ratio.length; i++) {
    secPerM[i] = ratio[i] * scale;
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

/** Slope above this counts as "steep ground" in route comparisons (degrees). */
export const STEEP_DEG = 15;

/** Where a planned route goes, in meters of the drawn line. */
export type RouteTerrain = {
  distM: number;
  /** Meters on soft sand (thermal inertia under 175). */
  sandM: number;
  /** Meters on slopes steeper than STEEP_DEG. */
  steepM: number;
  /** Meters within the model's no-go radius of a cliff or rough ground. */
  nearNoGoM: number;
  maxSlopeDeg: number;
  walkSec: number;
};

export type RouteComparison = {
  fastest: RouteTerrain;
  learned: RouteTerrain;
  /** learned − fastest walking time, seconds (Contract 2 walking model). Never negative. */
  extraWalkSec: number;
  /** learned − fastest oxygen margin, seconds (negative = less margin). */
  marginDeltaSec: number;
  /** True if the two plans draw the same line. */
  same: boolean;
};

function routeTerrain(site: Site, plan: Plan, near: Uint8Array): RouteTerrain {
  const { slope, thermalInertia } = site.layers;
  const out: RouteTerrain = { distM: 0, sandM: 0, steepM: 0, nearNoGoM: 0, maxSlopeDeg: 0, walkSec: plan.walkSec };
  for (const leg of plan.legs) {
    for (let i = 1; i < leg.path.length; i++) {
      const a = leg.path[i - 1];
      const b = leg.path[i];
      const len = distanceM(a, b);
      out.distM += len;
      forEachCellOnSegment(site, a, b, (cell, share) => {
        const m = share * len;
        if (thermalInertia[cell] < SAND_TI_THRESHOLD) out.sandM += m;
        if (slope[cell] > STEEP_DEG) out.steepM += m;
        if (near[cell]) out.nearNoGoM += m;
        if (share > 0 && slope[cell] > out.maxSlopeDeg) out.maxSlopeDeg = slope[cell];
        return true;
      });
    }
  }
  return out;
}

/**
 * Compare the fastest plan with the learned plan for the same stops: extra walking
 * time, oxygen margin change, and meters on sand, steep ground and next to no-go
 * terrain along each drawn line. Facts only; any UI decides the wording.
 */
export function compareRoutes(site: Site, model: RouteModel, fastest: Plan, learned: Plan): RouteComparison {
  const near = nearMask(noGoMask(site), site.width, site.height, model.nearNoGoRadiusCells);
  const f = routeTerrain(site, fastest, near);
  const l = routeTerrain(site, learned, near);
  const same =
    fastest.legs.length === learned.legs.length &&
    fastest.legs.every((leg, k) => {
      const other = learned.legs[k].path;
      return leg.path.length === other.length && leg.path.every((p, j) => p.lat === other[j].lat && p.lng === other[j].lng);
    });
  return {
    fastest: f,
    learned: l,
    extraWalkSec: Math.max(0, learned.walkSec - fastest.walkSec),
    marginDeltaSec: learned.marginSec - fastest.marginSec,
    same,
  };
}
