import type { LatLng, LayerName, Site } from "./types";

const LAYER_NAMES: LayerName[] = ["elevation", "slope", "rock", "thermalInertia", "science"];

/**
 * Turn the parsed site.json (Contract 1) into a typed Site.
 * Each layer becomes a Float32Array; missing values (null) become NaN.
 * Unknown keys such as "fake" are ignored.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadSite(json: any): Site {
  if (!json || typeof json !== "object") throw new Error("site.json: not an object");
  const { width, height } = json;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("site.json: width and height must be positive whole numbers");
  }
  const count = width * height;

  const layers = {} as Record<LayerName, Float32Array>;
  for (const name of LAYER_NAMES) {
    const raw = json.layers?.[name];
    if (!Array.isArray(raw)) throw new Error(`site.json: layer "${name}" is missing`);
    if (raw.length !== count) {
      throw new Error(`site.json: layer "${name}" has ${raw.length} values, expected ${count}`);
    }
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const v = raw[i];
      arr[i] = typeof v === "number" ? v : NaN;
    }
    layers[name] = arr;
  }

  const b = json.bounds;
  if (!b || !(b.north > b.south) || !(b.east > b.west)) {
    throw new Error("site.json: bounds are missing or invalid");
  }
  const cs = json.cellSizeM;
  if (!cs || !(cs.x > 0) || !(cs.y > 0)) {
    throw new Error("site.json: cellSizeM is missing or invalid");
  }

  return {
    name: String(json.name ?? ""),
    bounds: { south: b.south, north: b.north, west: b.west, east: b.east },
    width,
    height,
    cellSizeM: { x: cs.x, y: cs.y },
    layers,
    habitat: { name: json.habitat.name, lat: json.habitat.lat, lng: json.habitat.lng },
    pois: Array.isArray(json.pois) ? json.pois : [],
    sources: json.sources ?? {},
  };
}

type GridGeometry = Pick<Site, "bounds" | "width" | "height">;

/**
 * Cell index for a lat/lng using the Contract 1 "click → cell" formula.
 * Returns -1 if the point is outside the site bounds.
 */
export function cellIndexOf(site: GridGeometry, p: LatLng): number {
  const { south, north, west, east } = site.bounds;
  if (!(p.lat >= south && p.lat <= north && p.lng >= west && p.lng <= east)) return -1;
  // A point exactly on the south or east edge belongs to the last row / column.
  const col = Math.min(site.width - 1, Math.floor(((p.lng - west) / (east - west)) * site.width));
  const row = Math.min(site.height - 1, Math.floor(((north - p.lat) / (north - south)) * site.height));
  return row * site.width + col;
}

/** Lat/lng of the center of a cell. */
export function cellCenter(site: GridGeometry, index: number): LatLng {
  const { south, north, west, east } = site.bounds;
  const row = Math.floor(index / site.width);
  const col = index - row * site.width;
  return {
    lat: north - ((row + 0.5) / site.height) * (north - south),
    lng: west + ((col + 0.5) / site.width) * (east - west),
  };
}
