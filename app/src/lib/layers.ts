import type { Site, CostGrid } from "./planner";
export const layers = [
  {
    id: "difficulty",
    name: "Walking difficulty",
    type: "Combined",
    source: "slope",
    legend: "Easy → impassable",
  },
  {
    id: "slope",
    name: "Slope",
    type: "Topographic",
    source: "slope",
    legend: "0–25° · steeper blocked",
  },
  {
    id: "sand",
    name: "Soft sand risk",
    type: "Thermal",
    source: "thermalInertia",
    legend: "Thermal inertia < 175",
  },
  {
    id: "rock",
    name: "Ground roughness",
    type: "Optical / terrain",
    source: "rock",
    legend: "0–1 · > 0.75 blocked",
  },
  {
    id: "science",
    name: "Science value",
    type: "Spectral",
    source: "science",
    legend: "0–1 · higher is better",
  },
] as const;
export type OverlayName = (typeof layers)[number]["id"];
/** Opacity of each analysis layer on the map. Walking difficulty is lighter, so the route stays readable on top of it. */
export const LAYER_OPACITY: Record<OverlayName, number> = {
  difficulty: 0.45,
  slope: 0.8,
  sand: 0.8,
  rock: 0.8,
  science: 0.8,
};
export const layerOpacity = (kind: OverlayName) => LAYER_OPACITY[kind];

/**
 * How strongly a cell is tinted on the "Walking difficulty" layer, 0 to 255.
 * It compares the cell with the fastest ground on the map: the fastest ground is left
 * clear, ground four times slower (or worse) gets the full tint. The square root makes
 * moderately slow ground, such as soft sand, show up too. A display choice only.
 */
export function difficultyAlpha(secPerM: number, minSecPerM: number): number {
  if (!Number.isFinite(secPerM) || !(minSecPerM > 0)) return 0;
  const t = Math.min(1, Math.max(0, (secPerM / minSecPerM - 1) / 3));
  return Math.round(255 * Math.sqrt(t));
}

// Safe-return zone colours (RGBA). The Mono theme turns the light blue into the electric-blue accent.
const ZONE_EDGE = [79, 209, 255, 220];
/** A faint fill, about 10% opacity, so the zone reads as an area and not only a line. */
const ZONE_FILL = [79, 209, 255, 26];
const ZONE_OUTSIDE = [8, 9, 11, 155];

/** How many picture pixels per terrain cell the smooth zone is drawn with. */
export const ZONE_SCALE = 4;

/**
 * A smoother, larger copy of a zone mask, for drawing only: `scale` pixels per cell.
 * Each cell is averaged with its 8 neighbours, the result is read between cell centres
 * and cut at one half. That rounds the staircase edge without moving it by more than
 * about one cell. The planner's own mask is never changed; use it for safety answers.
 */
export function smoothZoneMask(zone: Uint8Array, width: number, height: number, scale: number = ZONE_SCALE): Uint8Array {
  if (zone.length !== width * height) return new Uint8Array(0);
  const soft = new Float32Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let sum = 0,
        n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx,
            yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
          sum += zone[yy * width + xx] ? 1 : 0;
          n++;
        }
      soft[y * width + x] = sum / n;
    }
  const W = width * scale,
    H = height * scale,
    out = new Uint8Array(W * H);
  for (let Y = 0; Y < H; Y++) {
    const fy = Math.min(height - 1, Math.max(0, (Y + 0.5) / scale - 0.5)),
      y0 = Math.floor(fy),
      y1 = Math.min(height - 1, y0 + 1),
      ty = fy - y0;
    for (let X = 0; X < W; X++) {
      const fx = Math.min(width - 1, Math.max(0, (X + 0.5) / scale - 0.5)),
        x0 = Math.floor(fx),
        x1 = Math.min(width - 1, x0 + 1),
        tx = fx - x0;
      const v =
        (soft[y0 * width + x0] * (1 - tx) + soft[y0 * width + x1] * tx) * (1 - ty) +
        (soft[y1 * width + x0] * (1 - tx) + soft[y1 * width + x1] * tx) * ty;
      out[Y * W + X] = v >= 0.5 ? 1 : 0;
    }
  }
  return out;
}

/** The safe-return zone as a picture for the 2D map: smooth edge, faint fill, darkened outside. */
export function zoneRaster(site: Site, zone: Uint8Array, scale: number = ZONE_SCALE): string {
  const W = site.width * scale,
    H = site.height * scale;
  const mask = smoothZoneMask(zone, site.width, site.height, scale);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  const thick = Math.max(1, Math.round(scale / 2));
  for (let i = 0; i < W * H; i++) {
    let color = ZONE_OUTSIDE;
    if (mask[i]) {
      const x = i % W,
        y = (i / W) | 0;
      let edge = x < thick || y < thick || x >= W - thick || y >= H - thick;
      for (let d = 1; d <= thick && !edge; d++)
        edge = !mask[i - d] || !mask[i + d] || !mask[i - d * W] || !mask[i + d * W];
      color = edge ? ZONE_EDGE : ZONE_FILL;
    }
    for (let c = 0; c < 4; c++) img.data[i * 4 + c] = color[c];
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

/** The box around a zone mask as map corners, or null when the zone is empty. */
export function zoneBounds(
  site: Pick<Site, "width" | "height" | "bounds">,
  zone: Uint8Array,
): { south: number; north: number; west: number; east: number } | null {
  if (zone.length !== site.width * site.height) return null;
  let r0 = Infinity,
    r1 = -1,
    c0 = Infinity,
    c1 = -1;
  for (let i = 0; i < zone.length; i++) {
    if (!zone[i]) continue;
    const r = (i / site.width) | 0,
      c = i - r * site.width;
    if (r < r0) r0 = r;
    if (r > r1) r1 = r;
    if (c < c0) c0 = c;
    if (c > c1) c1 = c;
  }
  if (r1 < 0) return null;
  const { south, north, west, east } = site.bounds;
  const dLat = (north - south) / site.height,
    dLng = (east - west) / site.width;
  return { north: north - r0 * dLat, south: north - (r1 + 1) * dLat, west: west + c0 * dLng, east: west + (c1 + 1) * dLng };
}

export function raster(
  site: Site,
  cost: CostGrid,
  kind: OverlayName | "hillshade" | "zone",
  zone?: Uint8Array,
) {
  const canvas = document.createElement("canvas");
  canvas.width = site.width;
  canvas.height = site.height;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(site.width, site.height);
  for (let i = 0; i < site.width * site.height; i++) {
    let color = [0, 0, 0, 0];
    if (kind === "hillshade") {
      const x = i % site.width,
        y = Math.floor(i / site.width),
        z = site.layers.elevation;
      const dx =
        (z[y * site.width + Math.min(x + 1, site.width - 1)] -
          z[y * site.width + Math.max(0, x - 1)]) /
        (2 * site.cellSizeM.x);
      const dy =
        (z[Math.min(y + 1, site.height - 1) * site.width + x] -
          z[Math.max(0, y - 1) * site.width + x]) /
        (2 * site.cellSizeM.y);
      const shade = Math.max(30, Math.min(200, 120 + (-dx + dy) * 90));
      color = [shade, shade * 0.8, shade * 0.67, 255];
    } else if (kind === "zone") {
      const x = i % site.width,
        y = Math.floor(i / site.width);
      const edge =
        zone?.[i] &&
        (x === 0 ||
          y === 0 ||
          x === site.width - 1 ||
          y === site.height - 1 ||
          !zone[i - 1] ||
          !zone[i + 1] ||
          !zone[i - site.width] ||
          !zone[i + site.width]);
      color = edge ? ZONE_EDGE : zone?.[i] ? ZONE_FILL : ZONE_OUTSIDE;
    } else if (kind === "science")
      color = [167, 139, 250, Math.round(site.layers.science[i] * 180)];
    else if (kind === "sand")
      color = [255, 176, 32, site.layers.thermalInertia[i] < 175 ? 150 : 0];
    else if (kind === "rock")
      color = [235, 234, 230, Math.round(site.layers.rock[i] * 210)];
    else if (kind === "slope")
      color = [
        255,
        176,
        32,
        Math.round(Math.min(1, site.layers.slope[i] / 25) * 180),
      ];
    else {
      const v = cost.secPerM[i];
      color = Number.isFinite(v) ? [255, 176, 32, difficultyAlpha(v, cost.minSecPerM)] : [255, 77, 90, 255];
    }
    for (let c = 0; c < 4; c++)
      img.data[i * 4 + c] = Number.isFinite(color[c]) ? color[c] : 0;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}
