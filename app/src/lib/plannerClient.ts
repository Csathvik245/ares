// Typed promise API for the planner Web Worker (app/src/planner/worker.ts).
//
//   const planner = createPlannerClient();
//   const plan = await planner.plan(stops, conditions);
//   const zone = await planner.safeZone();
//
// Latest wins: if a newer request of the same kind is sent before the old one has
// answered, the old promise rejects with PlannerCancelled and its late answer is
// thrown away. A new plan() also cancels pending safeZone(), positionAt(),
// suggestStops() and walkHome() calls, because their answers would describe the old plan.
//
// Not wired into the UI yet. No planner maths happens here.

import type { AbortRoute, Conditions, LatLng, Plan, Position, Stop } from "../planner";
import type { StopSuggestion } from "../planner/science";
import type { PlannerApi, PlannerMethod, PlannerRequest, PlannerResponse, SiteSummary } from "../planner/worker";

/** The part of a Worker the client uses. A real Worker fits; tests pass an in-process stand-in. */
export type WorkerLike = {
  postMessage(message: PlannerRequest, transfer?: Transferable[]): void;
  onmessage: ((event: { data: PlannerResponse }) => void) | null;
  onerror?: ((event: { message?: string }) => void) | null;
  terminate?(): void;
};

/** Thrown into a promise whose request was replaced by a newer one (or by close()). */
export class PlannerCancelled extends Error {
  constructor(method: string) {
    super(`planner: ${method} request was replaced by a newer one`);
    this.name = "PlannerCancelled";
  }
}

/** True for the error an outdated request rejects with. Usual use: `.catch((e) => { if (!isCancelled(e)) throw e; })`. */
export const isCancelled = (error: unknown): error is PlannerCancelled => error instanceof PlannerCancelled;

export type PlannerClient = {
  /** Resolves when the worker has loaded site.json. Other calls wait for it by themselves. */
  ready: Promise<SiteSummary>;
  /** Plan the EVA: habitat → stops → habitat. The worker keeps this as the current plan. */
  plan(stops: Stop[], conditions: Conditions): Promise<Plan>;
  /** Safe-return zone of the current plan (1 = inside, per cell). */
  safeZone(): Promise<Uint8Array>;
  /** Abort route home. `conditions` are the emergency conditions (storm and/or spe true). */
  abort(from: LatLng, oxygenUsedSec: number, conditions: Conditions): Promise<AbortRoute>;
  /** Where the astronaut is `tSec` seconds into the current plan. */
  positionAt(tSec: number): Promise<Position>;
  /** Up to `n` extra stops worth adding to the current plan. */
  suggestStops(n?: number, dwellMin?: number): Promise<StopSuggestion[]>;
  /** Walk-home seconds from every cell under the current plan's conditions (Infinity = cut off). */
  walkHome(): Promise<Float32Array>;
  /** Stop the worker. Pending requests reject with PlannerCancelled. */
  close(): void;
};

export type PlannerClientOptions = {
  /** Worker to talk to. Default: a new module worker running planner/worker.ts. */
  worker?: WorkerLike;
  /** Where site.json is. Default: the app's own data/site.json. */
  siteUrl?: string;
};

/** Requests whose answers describe the current plan, so a new plan() makes them outdated. */
const DEPENDS_ON_PLAN: PlannerMethod[] = ["safeZone", "positionAt", "suggestStops", "walkHome"];

type Pending = { method: PlannerMethod; resolve: (value: never) => void; reject: (error: Error) => void };

export function createPlannerClient(options: PlannerClientOptions = {}): PlannerClient {
  const worker: WorkerLike =
    options.worker ??
    (new Worker(new URL("../planner/worker.ts", import.meta.url), { type: "module" }) as unknown as WorkerLike);
  const siteUrl = options.siteUrl ?? `${import.meta.env.BASE_URL}data/site.json`;

  let nextId = 1;
  let closed = false;
  const pending = new Map<number, Pending>();
  /** The newest request id of each kind: an older one still waiting is outdated. */
  const latest = new Map<PlannerMethod, number>();

  function cancel(method: PlannerMethod) {
    const id = latest.get(method);
    const waiting = id === undefined ? undefined : pending.get(id);
    if (id !== undefined && waiting) {
      pending.delete(id);
      waiting.reject(new PlannerCancelled(method));
    }
  }

  function call<M extends PlannerMethod>(method: M, args: PlannerApi[M]["args"]): Promise<PlannerApi[M]["result"]> {
    if (closed) return Promise.reject(new PlannerCancelled(method));
    cancel(method);
    if (method === "plan") DEPENDS_ON_PLAN.forEach(cancel);
    const id = nextId++;
    latest.set(method, id);
    return new Promise((resolve, reject) => {
      pending.set(id, { method, resolve: resolve as (value: never) => void, reject });
      worker.postMessage({ id, type: method, args } as PlannerRequest);
    });
  }

  worker.onmessage = (event) => {
    const message = event.data;
    const waiting = pending.get(message.id);
    if (!waiting) return; // answer to a cancelled request: ignore it
    pending.delete(message.id);
    if (message.ok) waiting.resolve(message.result as never);
    else waiting.reject(new Error(message.error));
  };
  worker.onerror = (event) => {
    const error = new Error(`planner worker failed: ${event.message ?? "unknown error"}`);
    for (const waiting of pending.values()) waiting.reject(error);
    pending.clear();
  };

  const ready = call("init", { siteUrl });
  // A failed load is reported by `ready` and by every later call; no unhandled-rejection noise.
  ready.catch(() => undefined);

  return {
    ready,
    plan: (stops, conditions) => call("plan", { stops, conditions }),
    safeZone: () => call("safeZone", {}),
    abort: (from, oxygenUsedSec, conditions) => call("abort", { from, oxygenUsedSec, conditions }),
    positionAt: (tSec) => call("positionAt", { tSec }),
    suggestStops: (n, dwellMin) => call("suggestStops", { n, dwellMin }),
    walkHome: () => call("walkHome", {}),
    close() {
      closed = true;
      for (const waiting of pending.values()) waiting.reject(new PlannerCancelled(waiting.method));
      pending.clear();
      worker.terminate?.();
    },
  };
}
