// Grid geometry helpers: walking a straight line across the grid, path smoothing
// (CLAUDE.md section 6, step 9) and path lengths in meters. Pure functions, no UI.

import { MARS_RADIUS_M } from "./constants";
import { cellCenter } from "./site";
import type { LatLng, Site } from "./types";

type GridGeometry = Pick<Site, "bounds" | "width" | "height">;

const DEG_TO_RAD = Math.PI / 180;

/** A lat/lng as fractional grid coordinates: x = columns from the west edge, y = rows from the north edge. */
function toGrid(site: GridGeometry, p: LatLng): { x: number; y: number } {
  const { south, north, west, east } = site.bounds;
  return {
    x: ((p.lng - west) / (east - west)) * site.width,
    y: ((north - p.lat) / (north - south)) * site.height,
  };
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Visit every cell the straight segment a → b touches, in order ("supercover").
 * When the segment passes exactly through a cell corner, BOTH cells beside the
 * corner are visited too, so a line can never slip diagonally between two cells.
 * Stops early (and returns false) as soon as `visit` returns false.
 */
export function forEachCellOnSegment(
  site: GridGeometry,
  a: LatLng,
  b: LatLng,
  visit: (cell: number) => boolean,
): boolean {
  const { width, height } = site;
  const p0 = toGrid(site, a);
  const p1 = toGrid(site, b);
  // A point exactly on the south or east edge belongs to the last row / column (as in cellIndexOf).
  let col = clamp(Math.floor(p0.x), 0, width - 1);
  let row = clamp(Math.floor(p0.y), 0, height - 1);
  const endCol = clamp(Math.floor(p1.x), 0, width - 1);
  const endRow = clamp(Math.floor(p1.y), 0, height - 1);

  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const stepCol = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepRow = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  // Fraction of the segment needed to cross one whole column / row.
  const tDeltaX = dx !== 0 ? 1 / Math.abs(dx) : Infinity;
  const tDeltaY = dy !== 0 ? 1 / Math.abs(dy) : Infinity;
  // Fraction of the segment at which we first cross a column / row boundary.
  let tMaxX = dx > 0 ? (col + 1 - p0.x) / dx : dx < 0 ? (p0.x - col) / -dx : Infinity;
  let tMaxY = dy > 0 ? (row + 1 - p0.y) / dy : dy < 0 ? (p0.y - row) / -dy : Infinity;

  if (!visit(row * width + col)) return false;
  // Never take more steps than the Manhattan distance between the two end cells.
  let steps = Math.abs(endCol - col) + Math.abs(endRow - row);
  while (steps > 0 && (col !== endCol || row !== endRow)) {
    if (Math.abs(tMaxX - tMaxY) < 1e-9) {
      // Through a corner: check the two side cells, then move diagonally.
      const sideA = row * width + (col + stepCol);
      const sideB = (row + stepRow) * width + col;
      if (col + stepCol >= 0 && col + stepCol < width && !visit(sideA)) return false;
      if (row + stepRow >= 0 && row + stepRow < height && !visit(sideB)) return false;
      col += stepCol;
      row += stepRow;
      tMaxX += tDeltaX;
      tMaxY += tDeltaY;
      steps -= 2;
    } else if (tMaxX < tMaxY) {
      col += stepCol;
      tMaxX += tDeltaX;
      steps -= 1;
    } else {
      row += stepRow;
      tMaxY += tDeltaY;
      steps -= 1;
    }
    if (col < 0 || col >= width || row < 0 || row >= height) break;
    if (!visit(row * width + col)) return false;
  }
  return true;
}

/** True if every cell the straight segment a → b touches is passable. */
export function segmentIsClear(
  site: GridGeometry,
  passable: (cell: number) => boolean,
  a: LatLng,
  b: LatLng,
): boolean {
  return forEachCellOnSegment(site, a, b, passable);
}

/**
 * Turn a path of cell indices into a smooth line to draw (CLAUDE.md section 6, step 9).
 *
 * - The first and last points are the exact `start` / `end` coordinates (habitat or
 *   stop), not cell centers. The cells in between are represented by their centers.
 * - A waypoint is dropped when the straight line from the last kept point to the
 *   next one crosses only passable cells, so the smoothed line never touches a
 *   no-go cell (it is checked with the same corner-safe cell walk as above).
 *
 * Greedy and deterministic: from each kept point, keep extending the straight
 * line forward until the next extension would cross a no-go cell.
 */
export function smoothPath(
  site: GridGeometry,
  passable: (cell: number) => boolean,
  cells: number[],
  start: LatLng,
  end: LatLng,
): LatLng[] {
  if (cells.length === 0) return [];
  const points: LatLng[] = cells.map((c) => cellCenter(site, c));
  points[0] = { lat: start.lat, lng: start.lng };
  if (cells.length === 1) return [points[0], { lat: end.lat, lng: end.lng }];
  points[points.length - 1] = { lat: end.lat, lng: end.lng };

  const out: LatLng[] = [points[0]];
  let anchor = 0;
  while (anchor < points.length - 1) {
    let next = anchor + 1; // neighbouring cells on the grid path are always connected
    while (next + 1 < points.length && segmentIsClear(site, passable, points[anchor], points[next + 1])) {
      next++;
    }
    out.push(points[next]);
    anchor = next;
  }
  return out;
}

/** Ground distance in meters between two nearby points (local flat approximation on the Mars sphere). */
export function distanceM(a: LatLng, b: LatLng): number {
  const midLat = ((a.lat + b.lat) / 2) * DEG_TO_RAD;
  const dx = (b.lng - a.lng) * DEG_TO_RAD * Math.cos(midLat) * MARS_RADIUS_M;
  const dy = (b.lat - a.lat) * DEG_TO_RAD * MARS_RADIUS_M;
  return Math.hypot(dx, dy);
}

/** Length in meters of a lat/lng polyline. */
export function polylineLengthM(path: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += distanceM(path[i - 1], path[i]);
  return total;
}
