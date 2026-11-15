import { formatDuration, formatLmst, formatMinutes, positionAt, polylineLengthM, type LatLng, type Plan } from "./planner";
import { distanceM, bearingDeg } from "../geo";

export function clock(sec: number): string {
  return formatDuration(sec);
}
export function lmst(hours: number): string {
  return formatLmst(hours);
}
export function shortStop(id: string, label: string): string {
  return (
    (
      {
        "seitah-brac": "Brac · Séítah",
        "delta-toe": "Delta front toe",
        "maaz-sid": "Sid · Máaz",
      } as Record<string, string>
    )[id] ?? label
  );
}
export function stopKind(id: string): string {
  return id === "delta-toe"
    ? "New clay target"
    : id.startsWith("maaz-") ||
        id.startsWith("seitah-") ||
        id.startsWith("delta-")
      ? "Rover sample site"
      : "User-selected stop";
}

/** Split only the drawn route; all pathfinding and oxygen math stay in the planner. */
export function routeParts(
  plan: Plan,
  time: number,
): { walked: LatLng[][]; cancelled: LatLng[][] } {
  const walked: LatLng[][] = [],
    cancelled: LatLng[][] = [];
  for (let i = 0; i < plan.legs.length; i++) {
    const leg = plan.legs[i];
    if (!leg.path.length) continue;
    const start = leg.arriveSec - leg.walkSec;
    if (time >= leg.arriveSec) {
      walked.push(leg.path);
      continue;
    }
    if (time <= start) {
      cancelled.push(leg.path);
      continue;
    }
    const fraction = (time - start) / leg.walkSec;
    const target = polylineLengthM(leg.path) * fraction;
    let distance = 0,
      index = 1;
    for (; index < leg.path.length; index++) {
      const step = distanceM(leg.path[index - 1], leg.path[index]);
      if (distance + step >= target) break;
      distance += step;
    }
    const point = positionAt(plan, time);
    walked.push([...leg.path.slice(0, index), point]);
    cancelled.push([point, ...leg.path.slice(index)]);
  }
  return { walked, cancelled };
}

/** Find the next vertex on the currently drawn leg, rather than pointing through obstacles. */
export function routeHeading(path: LatLng[], from: LatLng): number {
  if (path.length < 2) return 0;
  let best = Infinity,
    next = path[1];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      scale = Math.cos((from.lat * Math.PI) / 180);
    const ax = (a.lng - from.lng) * scale,
      ay = a.lat - from.lat,
      bx = (b.lng - from.lng) * scale,
      by = b.lat - from.lat;
    const dx = bx - ax,
      dy = by - ay,
      t = Math.max(
        0,
        Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)),
      );
    const d = (ax + t * dx) ** 2 + (ay + t * dy) ** 2;
    if (d < best) {
      best = d;
      next = b;
    }
  }
  return distanceM(from, next) < 0.1 ? 0 : bearingDeg(from, next);
}

/** All UI minute readouts share nearest-minute rounding; input is Earth seconds. */
export function minutes(sec: number): string {
  return formatMinutes(sec).replace(/ min$/, "");
}
