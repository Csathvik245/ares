// Display clean-up for the safe-return zone mask. The planner's safeZone result is
// not changed; this only tidies the picture drawn on the map.

/** About 0.75 ha at 25 m cells (12 × 625 m²). ASSUMPTION: a display choice, not a planner rule. */
export const DEFAULT_MIN_CELLS = 12;

/**
 * Returns a copy of `mask` (1 = inside the zone, 0 = outside) with small islands removed:
 * - an outside-zone pocket smaller than `minCells` is filled in (becomes 1)
 * - an inside-zone speck smaller than `minCells` is removed (becomes 0)
 *
 * Cells are grouped with an 8-connected flood fill (straight and diagonal neighbours).
 * Every group is measured on the ORIGINAL mask, so the result does not depend on the
 * order the groups are visited in. The input is never changed.
 *
 * Note for safety wording: filling a pocket can mark a few no-go or out-of-reach cells
 * as "inside". That is fine for the drawn outline, but use the planner's own safeZone
 * mask (not this one) for any yes/no safety answer.
 */
export function removeSmallIslands(
  mask: Uint8Array,
  width: number,
  height: number,
  minCells: number = DEFAULT_MIN_CELLS,
): Uint8Array {
  const count = width * height;
  // An empty mask means "no zone to draw" (the app uses one during an emergency).
  if (mask.length === 0) return new Uint8Array(0);
  if (mask.length !== count) {
    throw new RangeError(
      `removeSmallIslands: mask has ${mask.length} cells, expected ${width} x ${height} = ${count}`,
    );
  }
  const out = new Uint8Array(mask);
  if (minCells <= 1 || count === 0) return out;

  const seen = new Uint8Array(count);
  // Each cell is pushed once, so one array of `count` entries serves every group in turn.
  const stack = new Int32Array(count);

  for (let start = 0; start < count; start++) {
    if (seen[start]) continue;
    const value = mask[start] ? 1 : 0;
    let size = 0;
    stack[size++] = start;
    seen[start] = 1;
    // `stack[0..size)` is the group so far; `next` is the cell being expanded.
    for (let next = 0; next < size; next++) {
      const cell = stack[next];
      const row = (cell / width) | 0;
      const col = cell - row * width;
      const r0 = row > 0 ? row - 1 : row;
      const r1 = row < height - 1 ? row + 1 : row;
      const c0 = col > 0 ? col - 1 : col;
      const c1 = col < width - 1 ? col + 1 : col;
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const n = r * width + c;
          if (seen[n] || (mask[n] ? 1 : 0) !== value) continue;
          seen[n] = 1;
          stack[size++] = n;
        }
      }
    }
    if (size < minCells) {
      const flipped = value ? 0 : 1;
      for (let i = 0; i < size; i++) out[stack[i]] = flipped;
    }
  }
  return out;
}
