import { MARS_RADIUS_M } from "./lib/planner";
import type { LatLng } from "./lib/planner";

const RAD = Math.PI / 180;

/** Compass heading in degrees (0 = north, 90 = east) from one point toward another. */
export function bearingDeg(from: LatLng, to: LatLng): number {
  const lat1 = from.lat * RAD;
  const lat2 = to.lat * RAD;
  const dLng = (to.lng - from.lng) * RAD;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** Straight-line distance in meters over the Mars sphere (haversine formula). */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * MARS_RADIUS_M * Math.asin(Math.sqrt(h));
}
