// UI integration boundary. Replace STUB exports here as planner functions land.
export * from '../planner';
import { cellCenter, cellIndexOf, dijkstraField, pathTo, CONSUMABLE_HOURS, RESERVE_MIN, STORM_EXTRA_RESERVE_MIN, WALK_BURN, WORK_BURN, DOSE_MSV_PER_SOL, SOL_HOURS, SPE_MULTIPLIER } from '../planner';
import type { CostGrid, LatLng, Plan, Site } from '../planner';
const fields = new WeakMap<CostGrid, ReturnType<typeof dijkstraField>>();
export function homeField(site: Site, cost: CostGrid) {
  let field = fields.get(cost);
  if (!field) { field = dijkstraField(cost, cellIndexOf(site, site.habitat)); fields.set(cost, field); }
  return field;
}
// STUB: frontend implementation until planner/safeZone lands; terrain-aware, not a circle.
export function safeZone(site: Site, cost: CostGrid, plan: Plan): Uint8Array {
  const mask = new Uint8Array(site.width * site.height);
  if (!plan.ok) return mask;
  const home = homeField(site, cost);
  const lastLeg = plan.legs.at(-1);
  const start = lastLeg?.path[0] ?? site.habitat;
  const outward = dijkstraField(cost, cellIndexOf(site, start));
  const used = plan.oxygenUsedSec - (lastLeg?.walkSec ?? 0) * WALK_BURN;
  const budget = CONSUMABLE_HOURS * 3600 - (RESERVE_MIN + (cost.conditions.storm ? STORM_EXTRA_RESERVE_MIN : 0)) * 60 - used;
  for (let i = 0; i < mask.length; i++) mask[i] = (outward.cost[i] + home.cost[i]) * WALK_BURN <= budget ? 1 : 0;
  return mask;
}
// STUB: path interpolation; replace with planner positionAt when available.
export function positionAt(plan: Plan, time: number) {
  let used = 0;
  const t = Math.max(0, Math.min(time, plan.totalSec));
  for (let i = 0; i < plan.legs.length; i++) {
    const leg = plan.legs[i];
    const start = leg.arriveSec - leg.walkSec;
    if (t < leg.arriveSec && leg.path.length) {
      const fraction = leg.walkSec ? Math.max(0, (t - start) / leg.walkSec) : 0;
      const p = fraction * (leg.path.length - 1), a = Math.floor(p), b = Math.min(a + 1, leg.path.length - 1);
      return { lat: leg.path[a].lat + (leg.path[b].lat - leg.path[a].lat) * (p-a), lng: leg.path[a].lng + (leg.path[b].lng - leg.path[a].lng) * (p-a), phase: 'walk' as const, legIndex: i, oxygenUsedSec: used + Math.max(0,t-start) * WALK_BURN };
    }
    used += leg.walkSec * WALK_BURN;
    const end = plan.legs[i+1] ? plan.legs[i+1].arriveSec - plan.legs[i+1].walkSec : plan.totalSec;
    if (t < end && leg.path.length) return { ...leg.path.at(-1)!, phase: 'science' as const, legIndex: i, oxygenUsedSec: used + Math.max(0,t-leg.arriveSec) * WORK_BURN };
    used += Math.max(0,end-leg.arriveSec) * WORK_BURN;
  }
  return { ...(plan.legs.at(-1)?.path.at(-1) ?? {lat:0,lng:0}), phase: 'walk' as const, legIndex: Math.max(0,plan.legs.length-1), oxygenUsedSec: plan.oxygenUsedSec };
}
// STUB: terrain-aware return field, replace with planner abortRoute.
export function abortRoute(site: Site, cost: CostGrid, from: LatLng, used: number) {
  const cell = cellIndexOf(site, from), field = homeField(site,cost);
  const sec = cell < 0 ? Infinity : field.cost[cell];
  const path = cell < 0 ? [] : pathTo(field, cell).reverse().map(i => cellCenter(site,i));
  const marginSec = CONSUMABLE_HOURS*3600 - (RESERVE_MIN + (cost.conditions.storm ? STORM_EXTRA_RESERVE_MIN : 0))*60 - used - sec*WALK_BURN;
  return {path,sec,marginSec,status: (marginSec < 0 || !path.length ? 'NO-GO' : 'CAUTION') as 'NO-GO'|'CAUTION'};
}
// STUB: fixed demonstration conditions, not Mars24 or live MEDA observations.
export function envAt(_lmst: number, spe: boolean) {
  return {sunElevationDeg: 45, tempC: -23, doseRateMsvPerHr: DOSE_MSV_PER_SOL/SOL_HOURS*(spe ? SPE_MULTIPLIER : 1)};
}
