import type { Bounds } from "./planner";
import { publicAssetUrl } from "./assets";
export type Basemap = {
  url: string;
  bounds: Bounds;
  source: string;
  credit: string;
  metersPerPixel: number;
};
/** Load only a bundled local image with explicit, compatible geographic bounds. */
export function readBasemap(
  value: unknown,
  siteBounds: Bounds,
  resolve: (path: string) => string | undefined = publicAssetUrl,
): Basemap | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>,
    b = data.bounds as Bounds | undefined;
  if (
    typeof data.file !== "string" ||
    !b ||
    !["south", "north", "west", "east"].every((k) =>
      Number.isFinite(b[k as keyof Bounds]),
    ) ||
    b.south >= b.north ||
    b.west >= b.east
  )
    return null;
  if (
    (Object.keys(siteBounds) as (keyof Bounds)[]).some(
      (k) => Math.abs(siteBounds[k] - b[k]) > 1e-6,
    )
  )
    return null;
  if (
    data.file.includes("..") ||
    data.file.includes("/") ||
    !/^.+\.(png|jpe?g|webp)$/i.test(data.file)
  )
    return null;
  const url = resolve(`data/${data.file}`);
  if (
    !url ||
    typeof data.source !== "string" ||
    typeof data.credit !== "string" ||
    typeof data.metersPerPixel !== "number" ||
    !Number.isFinite(data.metersPerPixel) ||
    data.metersPerPixel <= 0
  )
    return null;
  return {
    url,
    bounds: b,
    source: data.source,
    credit: data.credit,
    metersPerPixel: data.metersPerPixel,
  };
}
