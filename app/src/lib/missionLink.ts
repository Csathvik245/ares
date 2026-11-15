// Shareable mission links: the stops and the start time, written into the page address as
//   #plan?m=1;13;18.43397,77.44301,30,S%C3%A9%C3%ADtah%20outcrop;...
// so a plan can be sent to someone as a link. No React and no planner here: this file only
// turns a mission into text and back, and never throws on bad text.
import type { Site, Stop } from "../planner";
import type { DemoStop } from "./data";

/** The format's version. A link from another version is treated as invalid (an empty plan). */
export const MISSION_LINK_VERSION = "1";
/** The name of the value in the hash: #plan?m=... */
export const MISSION_PARAM = "m";
/** Limits, so a mangled or hostile link cannot ask for an absurd plan. */
export const MAX_LINK_STOPS = 30;
const MAX_LABEL = 80;
const MAX_DWELL_MIN = 24 * 60;
const MAX_LINK_LENGTH = 6000;

export type LinkStop = { lat: number; lng: number; dwellMin: number; label: string };
export type LinkMission = { startLmst: number; stops: LinkStop[] };

const fixed = (value: number, places: number) => String(Number(value.toFixed(places)));

/**
 * The mission as link text. Positions keep 5 decimals (well under a metre on Mars), names
 * are percent-encoded. An empty plan gives "" (no value in the address at all).
 */
export function encodeMission(mission: { startLmst: number; stops: Pick<Stop, "lat" | "lng" | "dwellMin" | "label">[] }): string {
  if (mission.stops.length === 0) return "";
  const stops = mission.stops.slice(0, MAX_LINK_STOPS).map((s) => {
    const dwell = Number.isFinite(s.dwellMin) && s.dwellMin > 0 ? Math.min(s.dwellMin, MAX_DWELL_MIN) : 0;
    return [fixed(s.lat, 5), fixed(s.lng, 5), fixed(dwell, 1), encodeURIComponent(String(s.label ?? "").slice(0, MAX_LABEL))].join(",");
  });
  const start = Number.isFinite(mission.startLmst) ? fixed(mission.startLmst, 2) : "13";
  return [MISSION_LINK_VERSION, start, ...stops].join(";");
}

/** Link text back into a mission, or null if it is not a valid link of this version. Never throws. */
export function decodeMission(text: string | null | undefined): LinkMission | null {
  try {
    if (typeof text !== "string" || text.length === 0 || text.length > MAX_LINK_LENGTH) return null;
    const [version, startText, ...stopTexts] = text.split(";");
    if (version !== MISSION_LINK_VERSION) return null;
    const startLmst = Number(startText);
    if (startText === "" || !Number.isFinite(startLmst) || startLmst < 0 || startLmst >= 24) return null;
    if (stopTexts.length === 0 || stopTexts.length > MAX_LINK_STOPS) return null;
    const stops: LinkStop[] = [];
    for (const stopText of stopTexts) {
      const parts = stopText.split(",");
      if (parts.length !== 4) return null;
      const [lat, lng, dwellMin] = parts.slice(0, 3).map((p) => (p === "" ? NaN : Number(p)));
      if (![lat, lng, dwellMin].every(Number.isFinite)) return null;
      if (lat < -90 || lat > 90 || lng < -360 || lng > 360 || dwellMin < 0 || dwellMin > MAX_DWELL_MIN) return null;
      const label = decodeURIComponent(parts[3]).slice(0, MAX_LABEL);
      stops.push({ lat, lng, dwellMin, label });
    }
    return { startLmst, stops };
  } catch {
    return null; // for example a broken percent-escape in a name
  }
}

/** The "m" value from a page hash such as "#plan?m=1;13;...", or null if there is none. */
export function missionParamOf(hash: string | null | undefined): string | null {
  const text = String(hash ?? "");
  const q = text.indexOf("?");
  if (q < 0) return null;
  for (const pair of text.slice(q + 1).split("&")) {
    const eq = pair.indexOf("=");
    if (eq > 0 && pair.slice(0, eq) === MISSION_PARAM) return pair.slice(eq + 1);
  }
  return null;
}

/** The Plan tab's hash for a mission: "#plan" for an empty plan, else "#plan?m=...". */
export function planHashFor(mission: { startLmst: number; stops: Pick<Stop, "lat" | "lng" | "dwellMin" | "label">[] }): string {
  const encoded = encodeMission(mission);
  return encoded ? `#plan?${MISSION_PARAM}=${encoded}` : "#plan";
}

/**
 * The stops of a decoded link as the app's own stops. A stop that sits on one of the
 * site's points of interest gets that point's id, note and photo back (the link does not
 * carry them); any other stop gets a plain id.
 */
export function stopsFromLink(mission: LinkMission, site: Pick<Site, "pois">): DemoStop[] {
  const used = new Set<string>();
  return mission.stops.map((s, i) => {
    const poi = site.pois.find((p) => Math.abs(p.lat - s.lat) < 0.00002 && Math.abs(p.lng - s.lng) < 0.00002);
    // Every stop needs its own id, also when a link visits the same place twice.
    let id = poi ? poi.id : `link-${i + 1}`;
    if (used.has(id)) id = `${id}-${i + 1}`;
    used.add(id);
    return {
      id,
      lat: poi ? poi.lat : s.lat,
      lng: poi ? poi.lng : s.lng,
      label: s.label || poi?.name || `Science stop ${i + 1}`,
      dwellMin: s.dwellMin,
      why: poi?.note,
      photo: poi?.photo,
      photoCredit: poi?.photoCredit,
    };
  });
}

/** Copy text to the clipboard. Resolves true if it worked. Browser only; never throws. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the older way (clipboard access can be refused).
  }
  try {
    const box = document.createElement("textarea");
    box.value = text;
    box.setAttribute("readonly", "");
    box.style.position = "fixed";
    box.style.opacity = "0";
    document.body.appendChild(box);
    box.select();
    const ok = document.execCommand("copy");
    box.remove();
    return ok;
  } catch {
    return false;
  }
}
