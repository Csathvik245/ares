// One Monte Carlo result per plan, shared by everything that shows it (the Mission
// reliability panel and the simulated range under the oxygen estimate), so the
// simulation runs once however many places read it.
import type { Plan, Site } from "../planner";
import { simulateMission, type ReliabilityResult } from "../planner/montecarlo";

type Options = { trials?: number; seed?: number; startLmst?: number };

// Keyed by the site and plan objects themselves: a new plan (any edit) gets a new entry,
// and old entries are dropped with their plan.
const cache = new WeakMap<Site, WeakMap<Plan, Map<string, ReliabilityResult>>>();

/** simulateMission(site, plan, options), computed once per plan and set of options. */
export function reliabilityOf(site: Site, plan: Plan, options: Options = {}): ReliabilityResult {
  let plans = cache.get(site);
  if (!plans) cache.set(site, (plans = new WeakMap()));
  let results = plans.get(plan);
  if (!results) plans.set(plan, (results = new Map()));
  const key = `${options.trials ?? ""}|${options.seed ?? ""}|${options.startLmst ?? ""}`;
  let result = results.get(key);
  if (!result) results.set(key, (result = simulateMission(site, plan, options)));
  return result;
}

/** What the tooltip beside the simulated range says. */
export const simulatedRangeNote = (trials: number) =>
  `${trials.toLocaleString("en-US")} simulated versions of this walk under our assumptions. Not a measured probability.`;
