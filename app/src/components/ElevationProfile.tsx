import { useMemo } from "react";
import type { Plan, Site } from "../planner";
import { formatKm, roundHalfUp } from "../planner";
import { elevationProfile, profileDistanceAt } from "../lib/profile";
import "./plugins.css";

export type ElevationProfileProps = {
  site: Site;
  plan: Plan;
  /** Seconds into the EVA. When given, a cyan cursor shows where the astronaut is. */
  currentTSec?: number;
};

/** Drawing box in SVG units. The SVG stretches to the container, so only the ratios matter. */
const VIEW_W = 1000;
const VIEW_H = 70;
/** Room above the line for the stop labels and below it for breathing space, in SVG units. */
const PAD_TOP = 16;
const PAD_BOTTOM = 6;

const stopLabel = (index: number) => String(index + 1).padStart(2, "0");
const meters = (m: number) => `${m < 0 ? "−" : ""}${Math.abs(roundHalfUp(m)).toLocaleString("en-US")} m`;

/**
 * Elevation along the planned walk: habitat, each stop, and back to the habitat.
 * Orange line = the plan (Contract 6). Fluid width, about 70 px tall.
 * Elevation comes from the site's HiRISE DTM layer, sampled about every 25 m.
 */
export function ElevationProfile({ site, plan, currentTSec }: ElevationProfileProps) {
  const profile = useMemo(() => elevationProfile(site, plan), [site, plan]);
  const { points, stops, totalM, minElevM, maxElevM } = profile;

  if (points.length < 2 || totalM <= 0) {
    return (
      <div className="elevation-profile elevation-profile--empty" role="img" aria-label="Elevation profile: no route yet">
        <span>Elevation profile appears when the plan has a route</span>
      </div>
    );
  }

  const span = Math.max(1, maxElevM - minElevM); // flat ground: avoid dividing by zero
  const x = (distM: number) => (distM / totalM) * VIEW_W;
  const y = (elevM: number) => PAD_TOP + (1 - (elevM - minElevM) / span) * (VIEW_H - PAD_TOP - PAD_BOTTOM);
  const line = points.map((p) => `${x(p.distM).toFixed(1)},${y(p.elevM).toFixed(1)}`).join(" ");
  const fill = `0,${VIEW_H} ${line} ${VIEW_W},${VIEW_H}`;

  const cursorM = currentTSec === undefined ? NaN : profileDistanceAt(plan, profile, currentTSec);
  const hasCursor = Number.isFinite(cursorM);
  const pct = (distM: number) => `${((distM / totalM) * 100).toFixed(2)}%`;

  const summary =
    `Elevation profile of the planned walk: ${formatKm(totalM)}, ` +
    `lowest ${meters(minElevM)}, highest ${meters(maxElevM)}, ${stops.length} stop${stops.length === 1 ? "" : "s"}.`;

  return (
    <div className="elevation-profile" role="img" aria-label={summary}>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" aria-hidden="true">
        <polygon className="elevation-profile__fill" points={fill} />
        {stops.map((s) => (
          <line
            key={s.index}
            className="elevation-profile__stop"
            x1={x(s.distM)}
            x2={x(s.distM)}
            y1={PAD_TOP - 4}
            y2={VIEW_H}
          />
        ))}
        <polyline className="elevation-profile__line" points={line} />
        {hasCursor && (
          <line className="elevation-profile__cursor" x1={x(cursorM)} x2={x(cursorM)} y1={0} y2={VIEW_H} />
        )}
      </svg>
      {/* Labels are HTML, not SVG text, so they keep their shape when the strip stretches. */}
      {stops.map((s) => (
        <span key={s.index} className="elevation-profile__stop-label" style={{ left: pct(s.distM) }}>
          {stopLabel(s.index)}
        </span>
      ))}
      <span className="elevation-profile__max">{meters(maxElevM)}</span>
      <span className="elevation-profile__min">{meters(minElevM)}</span>
      <span className="elevation-profile__source">Elevation · HiRISE DTM</span>
    </div>
  );
}

export default ElevationProfile;
