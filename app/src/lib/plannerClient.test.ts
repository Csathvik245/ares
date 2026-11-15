// The planner client and worker, with the worker's own handler run in-process.
// Messages still go through structuredClone (with transfers), as they would
// between a page and a real Web Worker, so anything that could not cross is caught.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  abortRoute,
  buildCostGrid,
  cellIndexOf,
  fieldFrom,
  loadSite,
  planRoute,
  positionAt,
  safeZone,
} from "../planner";
import type { Conditions, Stop } from "../planner";
import { suggestStops } from "../planner/science";
import { createPlannerHost } from "../planner/worker";
import type { PlannerRequest, PlannerResponse } from "../planner/worker";
import { PlannerCancelled, createPlannerClient, isCancelled } from "./plannerClient";
import type { WorkerLike } from "./plannerClient";

const raw = JSON.parse(readFileSync(new URL("../../public/data/site.json", import.meta.url), "utf8"));
const site = loadSite(raw);
const CALM: Conditions = { storm: false, spe: false, startLmst: 13 };
const STORM: Conditions = { ...CALM, storm: true };
const stops: Stop[] = site.pois
  .filter((p) => p.kind === "science")
  .slice(0, 3)
  .map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin: 30 }));
const cost = buildCostGrid(site, CALM);
const plan = planRoute(site, cost, site.habitat, stops);

/**
 * Stands in for `new Worker(...)`: the same host code, in this process.
 * Requests and replies are structured-cloned, replies are delivered later (as real
 * messages are), and they come back in the order the requests were sent.
 */
function inProcessWorker(fetchSite: (url: string) => Promise<unknown> = async () => raw) {
  const log: { requests: PlannerRequest[]; detached: boolean[]; fetched: string[] } = {
    requests: [],
    detached: [],
    fetched: [],
  };
  const host = createPlannerHost(async (url) => {
    log.fetched.push(url);
    return fetchSite(url);
  });
  let queue: Promise<void> = Promise.resolve();
  const worker: WorkerLike = {
    onmessage: null,
    postMessage(message) {
      const request = structuredClone(message);
      log.requests.push(request);
      queue = queue.then(async () => {
        const { response, transfer } = await host.handle(request);
        const delivered: PlannerResponse = structuredClone(response, { transfer });
        for (const buffer of transfer) log.detached.push(buffer.byteLength === 0);
        await new Promise((resolve) => setTimeout(resolve, 0));
        worker.onmessage?.({ data: delivered });
      });
    },
  };
  return { worker, log };
}

describe("planner client gives the same answers as the planner (demo mission)", () => {
  const { worker, log } = inProcessWorker();
  const client = createPlannerClient({ worker, siteUrl: "/data/site.json" });

  it("loads the site once and reports its shape", async () => {
    const summary = await client.ready;
    expect(summary).toMatchObject({ name: site.name, width: 320, height: 240, habitat: site.habitat });
    expect(summary.pois).toHaveLength(site.pois.length);
    expect(log.fetched).toEqual(["/data/site.json"]);
  });

  it("plan", async () => {
    const fromWorker = await client.plan(stops, CALM);
    expect(fromWorker).toEqual(plan);
    expect(fromWorker.status).toBe("GO");
  });

  it("safeZone, with the buffer transferred instead of copied", async () => {
    const zone = await client.safeZone();
    expect(zone).toBeInstanceOf(Uint8Array);
    expect(zone).toEqual(safeZone(site, cost, plan));
    expect(log.detached.at(-1)).toBe(true); // the worker's copy was handed over
  });

  it("positionAt", async () => {
    for (const tSec of [0, 1234, plan.legs[1].arriveSec + 60, plan.totalSec]) {
      expect(await client.positionAt(tSec)).toEqual(positionAt(plan, tSec));
    }
  });

  it("abort, in a dust storm, from the middle of the walk", async () => {
    const at = positionAt(plan, plan.totalSec * 0.45);
    const direct = abortRoute(site, buildCostGrid(site, STORM), at, at.oxygenUsedSec);
    expect(await client.abort(at, at.oxygenUsedSec, STORM)).toEqual(direct);
    expect(direct.status).toBe("CAUTION");
    // The abort did not replace the current plan.
    expect(await client.positionAt(600)).toEqual(positionAt(plan, 600));
  });

  it("suggestStops", async () => {
    const direct = suggestStops(site, site.habitat, stops, 3, { startLmst: 13, cost });
    expect(await client.suggestStops(3)).toEqual(direct);
    expect(direct).toHaveLength(3);
  });

  it("walkHome, as a transferred Float32Array", async () => {
    const seconds = await client.walkHome();
    expect(seconds).toBeInstanceOf(Float32Array);
    expect(seconds).toEqual(Float32Array.from(fieldFrom(cost, cellIndexOf(site, site.habitat)).cost));
    expect(log.detached.at(-1)).toBe(true);
  });

  it("a storm plan is NO-GO with nothing to suggest, and site.json was still loaded only once", async () => {
    const storm = await client.plan(stops, STORM);
    expect(storm).toEqual(planRoute(site, buildCostGrid(site, STORM), site.habitat, stops));
    expect(storm.status).toBe("NO-GO");
    expect(await client.suggestStops()).toEqual([]);
    expect(await client.safeZone()).toEqual(safeZone(site, buildCostGrid(site, STORM), storm));
    expect(log.fetched).toHaveLength(1);
  });

  it("before any plan() the current plan is the empty one", async () => {
    const fresh = createPlannerClient({ worker: inProcessWorker().worker, siteUrl: "x" });
    const empty = planRoute(site, cost, site.habitat, []);
    expect(await fresh.safeZone()).toEqual(safeZone(site, cost, empty));
    expect(Number.isNaN((await fresh.positionAt(10)).lat)).toBe(true);
  });
});

describe("latest wins", () => {
  it("a newer plan() cancels the older one, and only the newer answer arrives", async () => {
    const client = createPlannerClient({ worker: inProcessWorker().worker, siteUrl: "x" });
    const older = client.plan(stops.slice(0, 1), CALM);
    const newer = client.plan(stops, CALM);
    await expect(older).rejects.toBeInstanceOf(PlannerCancelled);
    expect(await newer).toEqual(plan);
    // The worker's current plan is the newer one.
    expect(await client.safeZone()).toEqual(safeZone(site, cost, plan));
  });

  it("a new plan() cancels pending safeZone() and positionAt() of the old plan", async () => {
    const client = createPlannerClient({ worker: inProcessWorker().worker, siteUrl: "x" });
    const first = client.plan(stops.slice(0, 1), CALM);
    const oldZone = client.safeZone();
    const oldPosition = client.positionAt(100);
    const second = client.plan(stops, CALM);
    const outcomes = await Promise.allSettled([first, oldZone, oldPosition, second]);
    expect(outcomes.map((o) => o.status)).toEqual(["rejected", "rejected", "rejected", "fulfilled"]);
    for (const o of outcomes.slice(0, 3)) expect(o.status === "rejected" && isCancelled(o.reason)).toBe(true);
  });

  it("requests of different kinds do not cancel each other", async () => {
    const client = createPlannerClient({ worker: inProcessWorker().worker, siteUrl: "x" });
    const [p, zone, position, abort] = await Promise.all([
      client.plan(stops, CALM),
      client.safeZone(),
      client.positionAt(300),
      client.abort(site.habitat, 0, STORM),
    ]);
    expect(p).toEqual(plan);
    expect(zone).toEqual(safeZone(site, cost, plan));
    expect(position).toEqual(positionAt(plan, 300));
    expect(abort.status).toBe("CAUTION");
  });

  it("scrubbing: of many positionAt() calls in a row only the last one answers", async () => {
    const client = createPlannerClient({ worker: inProcessWorker().worker, siteUrl: "x" });
    await client.plan(stops, CALM);
    const calls = [100, 200, 300, 400].map((t) => client.positionAt(t));
    const outcomes = await Promise.allSettled(calls);
    expect(outcomes.map((o) => o.status)).toEqual(["rejected", "rejected", "rejected", "fulfilled"]);
    expect(await calls[3]).toEqual(positionAt(plan, 400));
  });

  it("close() cancels what is pending and refuses new calls", async () => {
    const client = createPlannerClient({ worker: inProcessWorker().worker, siteUrl: "x" });
    const pending = client.plan(stops, CALM);
    client.close();
    await expect(pending).rejects.toSatisfy(isCancelled);
    await expect(client.safeZone()).rejects.toSatisfy(isCancelled);
  });
});

describe("errors", () => {
  it("a failed terrain download rejects ready and every later call with the reason", async () => {
    const { worker } = inProcessWorker(async () => {
      throw new Error("Terrain HTTP 404");
    });
    const client = createPlannerClient({ worker, siteUrl: "missing.json" });
    await expect(client.ready).rejects.toThrow("Terrain HTTP 404");
    await expect(client.plan(stops, CALM)).rejects.toThrow(/init/);
  });

  it("the handler refuses work before init and reports bad terrain", async () => {
    const host = createPlannerHost(async () => ({ not: "a site" }));
    const early = await host.handle({ id: 1, type: "safeZone", args: {} });
    expect(early.response).toMatchObject({ id: 1, ok: false });
    const bad = await host.handle({ id: 2, type: "init", args: { siteUrl: "x" } });
    expect(bad.response).toMatchObject({ id: 2, ok: false });
    expect((bad.response as { error: string }).error).toMatch(/site\.json/);
  });
});

describe("speed", () => {
  it("a full round trip (plan + zone) through the client stays well under 100 ms", async () => {
    const client = createPlannerClient({ worker: inProcessWorker().worker, siteUrl: "x" });
    await client.ready;
    await client.plan(stops, CALM); // warm-up
    await client.safeZone();
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const moved = stops.map((s, k) => (k === 2 ? { ...s, dwellMin: 30 + i } : s));
      const t0 = performance.now();
      await client.plan(moved, CALM);
      await client.safeZone();
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    console.log(`plannerClient round trip (plan + safeZone, in-process, incl. structured clone): median ${times[2].toFixed(1)} ms`);
    expect(times[2]).toBeLessThan(100);
  });
});
