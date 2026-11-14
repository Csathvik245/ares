import type { Stop } from "./planner";

export type DemoStop = Stop & {
  why?: string;
  tools?: string[];
  photo?: string;
  photoCredit?: string;
};

/** Optional files may be absent, malformed, or served as Vite's HTML fallback. */
export async function optionalJson(
  response: Response | null,
): Promise<unknown> {
  if (
    !response?.ok ||
    !response.headers.get("content-type")?.includes("application/json")
  )
    return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** Accept the science team's stop contract; reject invalid files without breaking terrain. */
export function readDemoStops(value: unknown): DemoStop[] | null {
  if (!Array.isArray(value) || !value.length) return null;
  const ids = new Set<string>();
  const stops: DemoStop[] = [];
  for (const item of value) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.id !== "string" ||
      !item.id ||
      ids.has(item.id) ||
      typeof item.label !== "string" ||
      !Number.isFinite(item.lat) ||
      !Number.isFinite(item.lng) ||
      !Number.isFinite(item.dwellMin) ||
      item.dwellMin < 0 ||
      item.dwellMin > 480
    )
      return null;
    ids.add(item.id);
    stops.push({
      id: item.id,
      label: item.label,
      lat: item.lat,
      lng: item.lng,
      dwellMin: item.dwellMin,
      why: typeof item.why === "string" ? item.why : undefined,
      photo: typeof item.photo === "string" ? item.photo : undefined,
      photoCredit:
        typeof item.photoCredit === "string" ? item.photoCredit : undefined,
      tools:
        Array.isArray(item.tools) &&
        item.tools.every((tool: unknown) => typeof tool === "string")
          ? item.tools
          : undefined,
    });
  }
  return stops;
}
