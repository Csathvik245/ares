// Shows one spot of the HiRISE basemap inside a small box, using only CSS
// (background-size + background-position). Pure math, no UI.

import { MARS_RADIUS_M } from "../planner";
import type { Bounds, LatLng } from "../planner";

/** How many times larger than its box the basemap is drawn. 6 shows about 1.4 km of ground. */
export const ORBITAL_ZOOM = 6;

export type OrbitalCrop = {
  /** CSS background-size, e.g. "600% 600%". */
  backgroundSize: string;
  /** CSS background-position, e.g. "44.87% 40.60%". */
  backgroundPosition: string;
  /** Where the spot itself lands inside the box, as fractions 0..1 (0.5, 0.5 unless near an edge). */
  marker: { x: number; y: number };
  /** Ground distance across the box, meters (east-west). */
  widthM: number;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * CSS values that centre `point` in a box showing 1/zoom of the basemap in each direction.
 *
 * The basemap is a plain lat/lng image of `bounds` (row 0 = north, column 0 = west),
 * so the spot is at u = (lng − west) / (east − west), v = (north − lat) / (north − south).
 * With the image drawn `zoom` times the box size, CSS background-position p% lines up
 * the image's p% point with the box's p% point, which centres u when
 *   p = (u × zoom − 0.5) / (zoom − 1).
 * Near an edge p is clamped so the box never shows past the image; the marker then
 * moves off-centre to stay on the spot.
 *
 * The box should have the same shape as the image (the basemap is 1.4 : 1), so one
 * zoom number works for both directions.
 */
export function orbitalCrop(point: LatLng, bounds: Bounds, zoom: number = ORBITAL_ZOOM): OrbitalCrop {
  const z = Math.max(1.0001, zoom);
  const u = clamp01((point.lng - bounds.west) / (bounds.east - bounds.west));
  const v = clamp01((bounds.north - point.lat) / (bounds.north - bounds.south));
  const px = clamp01((u * z - 0.5) / (z - 1));
  const py = clamp01((v * z - 0.5) / (z - 1));
  const midLat = ((bounds.north + bounds.south) / 2) * (Math.PI / 180);
  const siteWidthM = (bounds.east - bounds.west) * (Math.PI / 180) * Math.cos(midLat) * MARS_RADIUS_M;
  return {
    backgroundSize: `${(z * 100).toFixed(0)}% ${(z * 100).toFixed(0)}%`,
    backgroundPosition: `${(px * 100).toFixed(2)}% ${(py * 100).toFixed(2)}%`,
    // The box shows image fractions [px × (1 − 1/z), px × (1 − 1/z) + 1/z].
    marker: { x: (u - px * (1 - 1 / z)) * z, y: (v - py * (1 - 1 / z)) * z },
    widthM: siteWidthM / z,
  };
}
