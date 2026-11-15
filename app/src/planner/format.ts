// One formatter for every number the UI shows.
//
// Why: the HUD and the mission panel once showed the same oxygen margin as 39 min
// and 38 min, because one rounded and the other cut the decimals off. Every screen
// should call these functions instead of doing its own Math.round / toFixed.
//
// ONE ROUNDING RULE: round half up. A value exactly halfway goes up (38.5 → 39).
// Durations are rounded to the whole minute FIRST and then split into hours and
// minutes, so "39 min", "0:39" and "T+0:39" always agree.
//
// Anything that is not a real number (NaN, Infinity, undefined) is shown as "—".
//
// Pure functions, no UI code.

/** Shown when there is no value. */
export const NO_VALUE = "—";
/** A real minus sign (not a hyphen), so negative numbers line up and read clearly. */
const MINUS = "−";

/**
 * Round half up to `decimals` places: 38.5 → 39, 2.345 → 2.35, −38.5 → −38.
 * The tiny nudge stops binary-fraction noise (2309.9999999/60) from tipping a
 * halfway value the wrong way.
 */
export function roundHalfUp(value: number, decimals = 0): number {
  const scale = 10 ** decimals;
  return Math.floor(value * scale + 0.5 + 1e-9) / scale;
}

const ok = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value);
const pad2 = (n: number) => String(n).padStart(2, "0");

/** Whole minutes from seconds, with the shared rounding rule. Returns NaN for a missing value. */
export function wholeMinutes(sec: number | null | undefined): number {
  return ok(sec) ? roundHalfUp(sec / 60) : NaN;
}

/** Seconds → "39 min". Negative values use a real minus sign: "−12 min". */
export function formatMinutes(sec: number | null | undefined): string {
  if (!ok(sec)) return NO_VALUE;
  const min = wholeMinutes(sec);
  return `${min < 0 ? MINUS : ""}${Math.abs(min)} min`;
}

/** Seconds → "3:35" (hours:minutes). Under an hour: "0:39". Negative: "−0:12". */
export function formatDuration(sec: number | null | undefined): string {
  if (!ok(sec)) return NO_VALUE;
  const min = wholeMinutes(sec);
  const abs = Math.abs(min);
  return `${min < 0 ? MINUS : ""}${Math.floor(abs / 60)}:${pad2(abs % 60)}`;
}

/** Meters → "4.97 km" (always two decimals). */
export function formatKm(meters: number | null | undefined): string {
  if (!ok(meters)) return NO_VALUE;
  return `${roundHalfUp(meters / 1000, 2).toFixed(2)} km`;
}

/** A percentage (0–100) → "49%". */
export function formatPct(pct: number | null | undefined): string {
  if (!ok(pct)) return NO_VALUE;
  return `${roundHalfUp(pct)}%`;
}

/** Radiation dose in mSv → "0.093 mSv" (always three decimals). */
export function formatDose(mSv: number | null | undefined): string {
  if (!ok(mSv)) return NO_VALUE;
  return `${roundHalfUp(mSv, 3).toFixed(3)} mSv`;
}

/** Local mean solar time in hours → "13:05". Wraps past midnight: 24.5 → "00:30". */
export function formatLmst(hours: number | null | undefined): string {
  if (!ok(hours)) return NO_VALUE;
  const totalMin = ((roundHalfUp(hours * 60) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(totalMin / 60))}:${pad2(totalMin % 60)}`;
}

/** Mission elapsed time from seconds → "T+1:16". Before the start: "T−0:05". */
export function formatMet(sec: number | null | undefined): string {
  if (!ok(sec)) return NO_VALUE;
  const min = wholeMinutes(sec);
  const abs = Math.abs(min);
  return `T${min < 0 ? MINUS : "+"}${Math.floor(abs / 60)}:${pad2(abs % 60)}`;
}
