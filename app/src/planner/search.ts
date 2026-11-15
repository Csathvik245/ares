// Pathfinding on the terrain grid (CLAUDE.md section 6). Deterministic — no ML.
//
// - Every cell is a node with 8 neighbors (4 straight, 4 diagonal).
// - Edge cost = step length in meters × average of the two cells' seconds-per-meter.
// - No corner-cutting: a diagonal step is forbidden if either of the two cells it
//   squeezes between is no-go.
// - dijkstraField: walking time from one cell to EVERY cell (no target).
// - aStar: the fastest path to ONE target, using a straight-line heuristic.

import type { CostGrid, SearchResult } from "./types";

/** Neighbor offsets: 4 straight steps first, then 4 diagonal steps. */
const D_ROW = [-1, 1, 0, 0, -1, -1, 1, 1];
const D_COL = [0, 0, -1, 1, -1, 1, -1, 1];

/**
 * Binary min-heap of cell indices, ordered by an external key array.
 * It tracks where each cell sits in the heap so a cell's key can be lowered
 * in place ("decrease-key") instead of adding duplicates.
 */
class MinHeap {
  private readonly heap: Int32Array;
  private readonly pos: Int32Array;
  private size = 0;

  constructor(
    capacity: number,
    private readonly key: Float64Array,
  ) {
    this.heap = new Int32Array(capacity);
    this.pos = new Int32Array(capacity).fill(-1);
  }

  get length(): number {
    return this.size;
  }

  /** Add a cell, or move it up if it is already in the heap and its key got smaller. */
  pushOrDecrease(node: number): void {
    let i = this.pos[node];
    if (i === -1) {
      i = this.size++;
      this.heap[i] = node;
      this.pos[node] = i;
    }
    this.siftUp(i);
  }

  /** Remove and return the cell with the smallest key. */
  pop(): number {
    const top = this.heap[0];
    this.pos[top] = -1;
    const last = this.heap[--this.size];
    if (this.size > 0) {
      this.heap[0] = last;
      this.pos[last] = 0;
      this.siftDown(0);
    }
    return top;
  }

  private siftUp(i: number): void {
    const { heap, pos, key } = this;
    const node = heap[i];
    const k = key[node];
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const p = heap[parent];
      if (key[p] <= k) break;
      heap[i] = p;
      pos[p] = i;
      i = parent;
    }
    heap[i] = node;
    pos[node] = i;
  }

  private siftDown(i: number): void {
    const { heap, pos, key, size } = this;
    const node = heap[i];
    const k = key[node];
    for (;;) {
      let child = 2 * i + 1;
      if (child >= size) break;
      if (child + 1 < size && key[heap[child + 1]] < key[heap[child]]) child++;
      const c = heap[child];
      if (key[c] >= k) break;
      heap[i] = c;
      pos[c] = i;
      i = child;
    }
    heap[i] = node;
    pos[node] = i;
  }
}

/**
 * Shared search loop. With goal = -1 it is plain Dijkstra over the whole grid.
 * With a goal it is A*: the queue is ordered by time-so-far + a straight-line
 * estimate of the time still to go, and the search stops when the goal is reached.
 */
function search(grid: CostGrid, start: number, goal: number): SearchResult {
  const { width, height, secPerM } = grid;
  const count = width * height;
  const cost = new Float64Array(count).fill(Infinity);
  const cameFrom = new Int32Array(count).fill(-1);
  if (start < 0 || start >= count) return { cost, cameFrom };

  const cellX = grid.cellSizeM.x;
  const cellY = grid.cellSizeM.y;
  const diag = Math.hypot(cellX, cellY);
  const stepLen = [cellY, cellY, cellX, cellX, diag, diag, diag, diag];

  // A* heuristic: straight-line meters × the fastest seconds-per-meter on the grid
  // (= 1 / max speed). It never over-estimates, so the result is still optimal.
  const useHeuristic = goal >= 0;
  const goalRow = useHeuristic ? Math.floor(goal / width) : 0;
  const goalCol = useHeuristic ? goal - goalRow * width : 0;
  const hScale = Number.isFinite(grid.minSecPerM) ? grid.minSecPerM : 0;
  const priority = useHeuristic ? new Float64Array(count).fill(Infinity) : cost;

  const done = new Uint8Array(count);
  const heap = new MinHeap(count, priority);

  cost[start] = 0;
  if (useHeuristic) {
    const sr = Math.floor(start / width);
    priority[start] = Math.hypot((start - sr * width - goalCol) * cellX, (sr - goalRow) * cellY) * hScale;
  }
  heap.pushOrDecrease(start);

  while (heap.length > 0) {
    const u = heap.pop();
    if (u === goal) break;
    done[u] = 1;

    const costU = secPerM[u];
    if (costU === Infinity) continue; // standing on a no-go cell: cannot step anywhere
    const row = Math.floor(u / width);
    const col = u - row * width;
    const timeU = cost[u];

    for (let d = 0; d < 8; d++) {
      const r = row + D_ROW[d];
      const c = col + D_COL[d];
      if (r < 0 || r >= height || c < 0 || c >= width) continue;
      const v = r * width + c;
      if (done[v]) continue;
      const costV = secPerM[v];
      if (costV === Infinity) continue;
      // No corner-cutting on diagonal steps.
      if (d >= 4 && (secPerM[row * width + c] === Infinity || secPerM[r * width + col] === Infinity)) {
        continue;
      }
      const t = timeU + stepLen[d] * 0.5 * (costU + costV);
      if (t < cost[v]) {
        cost[v] = t;
        cameFrom[v] = u;
        if (useHeuristic) {
          priority[v] = t + Math.hypot((c - goalCol) * cellX, (r - goalRow) * cellY) * hScale;
        }
        heap.pushOrDecrease(v);
      }
    }
  }
  return { cost, cameFrom };
}

/**
 * Full-field Dijkstra: walking time in seconds from `start` to every cell.
 * Costs are symmetric, so run from the habitat this is also "time to walk home"
 * for every cell, and following cameFrom from any cell leads home.
 */
export function dijkstraField(grid: CostGrid, start: number): SearchResult {
  return search(grid, start, -1);
}

/**
 * A* from `start` to `goal`. cost[goal] is the fastest walking time (Infinity if
 * unreachable). Other cells hold partial results only — use dijkstraField when
 * the whole field is needed.
 */
export function aStar(grid: CostGrid, start: number, goal: number): SearchResult {
  if (goal < 0 || goal >= grid.width * grid.height) {
    const count = grid.width * grid.height;
    return { cost: new Float64Array(count).fill(Infinity), cameFrom: new Int32Array(count).fill(-1) };
  }
  return search(grid, start, goal);
}

/**
 * Rebuild the path of cell indices from the search start to `target` by walking
 * cameFrom backwards. Returns [] if the target was not reached.
 */
export function pathTo(result: SearchResult, target: number): number[] {
  if (target < 0 || target >= result.cost.length || result.cost[target] === Infinity) return [];
  const path: number[] = [];
  for (let i = target; i !== -1; i = result.cameFrom[i]) path.push(i);
  return path.reverse();
}

/** Length in meters of a path of cell indices. */
export function pathLengthM(grid: CostGrid, path: number[]): number {
  const { width } = grid;
  const { x, y } = grid.cellSizeM;
  const diag = Math.hypot(x, y);
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const dRow = Math.floor(a / width) - Math.floor(b / width);
    const dCol = (a % width) - (b % width);
    total += dRow !== 0 && dCol !== 0 ? diag : dRow !== 0 ? y : x;
  }
  return total;
}

/**
 * Walking time in seconds along a path of cell indices on `grid`, with the same edge
 * rule as the search (step length × mean of the two cells' seconds per meter).
 * Infinity if the path crosses a no-go cell. For a path found on the same grid this
 * equals the search's own cost.
 */
export function pathTimeSec(grid: CostGrid, path: number[]): number {
  const { width, secPerM } = grid;
  const { x, y } = grid.cellSizeM;
  const diag = Math.hypot(x, y);
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const dRow = Math.floor(a / width) - Math.floor(b / width);
    const dCol = (a % width) - (b % width);
    const len = dRow !== 0 && dCol !== 0 ? diag : dRow !== 0 ? y : x;
    total += len * 0.5 * (secPerM[a] + secPerM[b]);
  }
  return total;
}
