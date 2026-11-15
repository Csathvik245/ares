// Planner Web Worker: runs the planner off the main thread so the map never stutters.
//
// The worker loads site.json ONCE, keeps the site, the cost grids and the current
// plan, and answers messages. It only CALLS the planner; every number still comes
// from the same pure functions the app uses directly.
//
// Start it from the main thread through app/src/lib/plannerClient.ts, which gives
// a typed promise API. The message shapes below are the whole protocol.
//
// This file has two parts:
//   1. createPlannerHost(): the message handler, with no Worker API in it, so tests
//      can run the very same code in-process.
//   2. A few lines at the bottom that connect the handler to the worker's messages.

import { abortRoute } from "./abort";
import type { AbortRoute } from "./abort";
import { buildCostGrid } from "./cost";
import { fieldFrom } from "./fields";
import { planRoute } from "./plan";
import { suggestStops } from "./science";
import type { StopSuggestion } from "./science";
import { cellIndexOf, loadSite } from "./site";
import { positionAt } from "./timeline";
import type { Position } from "./timeline";
import type { Bounds, Conditions, CostGrid, LatLng, Plan, Poi, Site, Stop } from "./types";
import { safeZone } from "./zone";

// ---- Protocol ---------------------------------------------------------------

/** What the main thread learns about the site without copying its big layers. */
export type SiteSummary = {
  name: string;
  bounds: Bounds;
  width: number;
  height: number;
  cellSizeM: { x: number; y: number };
  habitat: { name: string; lat: number; lng: number };
  pois: Poi[];
  sources: Record<string, string>;
};

/** One entry per message type: what is sent and what comes back. */
export type PlannerApi = {
  /** Load site.json from `siteUrl`. Must be the first message; later ones wait for it. */
  init: { args: { siteUrl: string }; result: SiteSummary };
  /** Plan the EVA. The worker remembers this plan for safeZone, positionAt and suggestStops. */
  plan: { args: { stops: Stop[]; conditions: Conditions }; result: Plan };
  /** Safe-return zone of the current plan: 1 = inside, one byte per cell. Buffer is transferred. */
  safeZone: { args: Record<string, never>; result: Uint8Array };
  /**
   * Abort route home from `from`. `conditions` are the emergency conditions
   * (storm and/or spe true); the emergency cost grid is built once and reused.
   */
  abort: { args: { from: LatLng; oxygenUsedSec: number; conditions: Conditions }; result: AbortRoute };
  /** Where the astronaut is `tSec` seconds into the current plan. */
  positionAt: { args: { tSec: number }; result: Position };
  /** Extra stops worth adding to the current plan (science per oxygen-minute). */
  suggestStops: { args: { n?: number; dwellMin?: number }; result: StopSuggestion[] };
  /**
   * Walk-home time in seconds from every cell, for the cursor probe (Infinity =
   * cannot get home). Uses the current plan's conditions. Buffer is transferred.
   */
  walkHome: { args: Record<string, never>; result: Float32Array };
};

export type PlannerMethod = keyof PlannerApi;

export type PlannerRequest = {
  [M in PlannerMethod]: { id: number; type: M; args: PlannerApi[M]["args"] };
}[PlannerMethod];

export type PlannerResponse =
  | { id: number; ok: true; result: PlannerApi[PlannerMethod]["result"] }
  | { id: number; ok: false; error: string };

/** A reply plus the buffers to hand over (transfer) instead of copying. */
export type HostReply = { response: PlannerResponse; transfer: ArrayBuffer[] };

export type PlannerHost = {
  handle(request: PlannerRequest): Promise<HostReply>;
};

// ---- Host -------------------------------------------------------------------

const CALM: Conditions = { storm: false, spe: false, startLmst: 13 };
/** Cost grids kept at once (calm, storm, SPE and a spare). Each is ~300 kB plus its cached fields. */
const MAX_GRIDS = 4;

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Terrain HTTP ${response.status}`);
  return response.json();
}

/**
 * The worker's message handler. `fetchSite` reads and parses site.json; the default
 * uses fetch, and tests pass their own.
 *
 * Messages are answered in the order they arrive. State kept between messages:
 * the site, a few cost grids (so cached Dijkstra fields are reused) and the
 * current plan with its stops and conditions.
 */
export function createPlannerHost(fetchSite: (url: string) => Promise<unknown> = fetchJson): PlannerHost {
  let ready: Promise<Site> | null = null;
  const grids = new Map<string, CostGrid>();
  let current: { plan: Plan; cost: CostGrid; stops: Stop[]; conditions: Conditions } | null = null;

  /** One cost grid per set of conditions. Reusing the object keeps its fields cached. */
  function gridFor(site: Site, c: Conditions): CostGrid {
    const key = `${c.storm ? 1 : 0}|${c.spe ? 1 : 0}|${c.startLmst}`;
    let grid = grids.get(key);
    if (grid) {
      grids.delete(key); // move to the back: last to be dropped
    } else {
      grid = buildCostGrid(site, c);
      if (grids.size >= MAX_GRIDS) grids.delete(grids.keys().next().value!);
    }
    grids.set(key, grid);
    return grid;
  }

  /** The current plan, or an empty calm plan if none has been asked for yet. */
  function state(site: Site) {
    if (!current) {
      const cost = gridFor(site, CALM);
      current = { plan: planRoute(site, cost, site.habitat, []), cost, stops: [], conditions: CALM };
    }
    return current;
  }

  function run(site: Site, request: PlannerRequest): { result: PlannerApi[PlannerMethod]["result"]; transfer: ArrayBuffer[] } {
    switch (request.type) {
      case "init":
        return {
          result: {
            name: site.name,
            bounds: site.bounds,
            width: site.width,
            height: site.height,
            cellSizeM: site.cellSizeM,
            habitat: site.habitat,
            pois: site.pois,
            sources: site.sources,
          },
          transfer: [],
        };
      case "plan": {
        const { stops, conditions } = request.args;
        const cost = gridFor(site, conditions);
        current = { plan: planRoute(site, cost, site.habitat, stops), cost, stops, conditions };
        return { result: current.plan, transfer: [] };
      }
      case "safeZone": {
        const s = state(site);
        // safeZone returns a new array each call, so its buffer is ours to give away.
        const zone = safeZone(site, s.cost, s.plan);
        return { result: zone, transfer: [zone.buffer as ArrayBuffer] };
      }
      case "abort": {
        const { from, oxygenUsedSec, conditions } = request.args;
        return { result: abortRoute(site, gridFor(site, conditions), from, oxygenUsedSec), transfer: [] };
      }
      case "positionAt":
        return { result: positionAt(state(site).plan, request.args.tSec), transfer: [] };
      case "suggestStops": {
        const s = state(site);
        const { n, dwellMin } = request.args;
        // In a storm or solar event the EVA is aborted: nothing to suggest.
        if (s.conditions.storm || s.conditions.spe) return { result: [], transfer: [] };
        return {
          result: suggestStops(site, site.habitat, s.stops, n, {
            dwellMin,
            startLmst: s.conditions.startLmst,
            cost: s.cost,
          }),
          transfer: [],
        };
      }
      case "walkHome": {
        const s = state(site);
        const home = cellIndexOf(site, site.habitat);
        // The cached field is shared inside the worker, so send a copy (as 32-bit: half the size).
        const seconds = Float32Array.from(fieldFrom(s.cost, home).cost);
        return { result: seconds, transfer: [seconds.buffer as ArrayBuffer] };
      }
    }
  }

  return {
    async handle(request) {
      try {
        if (request.type === "init") {
          ready ??= fetchSite(request.args.siteUrl).then(loadSite);
        }
        if (!ready) throw new Error('planner worker: send "init" before any other message');
        const site = await ready;
        const { result, transfer } = run(site, request);
        return { response: { id: request.id, ok: true, result }, transfer };
      } catch (error) {
        if (request.type === "init") ready = null; // let the main thread try again
        return {
          response: { id: request.id, ok: false, error: error instanceof Error ? error.message : String(error) },
          transfer: [],
        };
      }
    },
  };
}

// ---- Worker wiring ----------------------------------------------------------

/** The little of the worker global scope this file uses (the app's tsconfig has no WebWorker types). */
type WorkerScope = {
  onmessage: ((event: { data: PlannerRequest }) => void) | null;
  postMessage(message: PlannerResponse, transfer: ArrayBuffer[]): void;
};

// True only inside a real Web Worker, so importing this file in tests or on the
// main thread does nothing.
const scope = globalThis as unknown as { WorkerGlobalScope?: unknown; importScripts?: unknown };
if (typeof scope.WorkerGlobalScope !== "undefined" && typeof document === "undefined") {
  const worker = globalThis as unknown as WorkerScope;
  const host = createPlannerHost();
  // Replies go out in the order the messages came in, even though init waits for a download.
  let queue: Promise<void> = Promise.resolve();
  worker.onmessage = (event) => {
    queue = queue.then(async () => {
      const { response, transfer } = await host.handle(event.data);
      worker.postMessage(response, transfer);
    });
  };
}
