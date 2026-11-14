import { useId, useState } from "react";

/**
 * Interactive illustration of ARES's safe-return zone on flat, open ground.
 * Every constant below is from the ARES shared contract (Contract 2), not invented here.
 * The 30-minute stop is the console's demonstration assumption.
 */
const CONSUMABLE_HOURS = 8; // life support at nominal rate
const RESERVE_MIN = 45; // oxygen time that must remain at return
const WALK_BURN = 1.3; // oxygen multiplier while walking with load
const WORK_BURN = 0.9; // oxygen multiplier during science at a stop
const BASE_SPEED_KMH = 3.0; // suited speed on flat firm ground
const DWELL_H = 0.5; // demonstration assumption: 30 min per stop

const USABLE_H = CONSUMABLE_HOURS - RESERVE_MIN / 60; // 7.25 h

type Status = "GO" | "CAUTION" | "NO-GO";

function hm(hours: number) {
  const neg = hours < 0;
  const total = Math.round(Math.abs(hours) * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${neg ? "−" : ""}${h}h ${String(m).padStart(2, "0")}m`;
}

function model(distKm: number, stops: number) {
  const walkH = (2 * distKm) / BASE_SPEED_KMH;
  const used = walkH * WALK_BURN + stops * DWELL_H * WORK_BURN;
  const margin = USABLE_H - used;

  let status: Status = "GO";
  let reason = "Margin is above 25% of the usable oxygen budget.";
  if (margin < 0) {
    status = "NO-GO";
    reason = "Margin is negative: this plan needs more oxygen than the usable budget.";
  } else if (margin < 0.25 * USABLE_H) {
    status = "CAUTION";
    reason = "Margin is under 25% of the usable oxygen budget.";
  }

  // Oxygen left (after reserve) when leaving the last stop, then the walk-home reach.
  const leftAtLastStop = margin + (distKm / BASE_SPEED_KMH) * WALK_BURN;
  const reachKm = Math.max(0, (leftAtLastStop / WALK_BURN) * BASE_SPEED_KMH); // total path length allowed: stop→cell→home
  const a = reachKm / 2; // ellipse semi-major (foci = habitat and last stop)
  const c = distKm / 2;
  const b = a > c ? Math.sqrt(a * a - c * c) : 0;
  return { walkH, used, margin, status, reason, a, b, c, empty: margin < 0 || a <= c };
}

export function SafeReturnDemo() {
  const [dist, setDist] = useState(2.5);
  const [stops, setStops] = useState(2);
  const idD = useId();
  const idS = useId();
  const m = model(dist, stops);

  // SVG in km: viewBox is 18 km square, habitat at the origin.
  const cx = dist / 2;

  return (
    <div className="demo" aria-label="Interactive safe-return zone illustration">
      <div className="demo__map">
        <svg viewBox="-9 -9 18 18" role="img" aria-label={`Safe-return zone. Status ${m.status}.`}>
          {[2, 4, 6, 8].map((r) => (
            <g key={r}>
              <circle r={r} className="demo__ring" />
              <text x={r * 0.7071 + 0.12} y={-r * 0.7071 - 0.1} className="demo__ringlabel">{r} km</text>
            </g>
          ))}
          <line x1="-9" y1="0" x2="9" y2="0" className="demo__axis" />
          <line x1="0" y1="-9" x2="0" y2="9" className="demo__axis" />

          {!m.empty && (
            <ellipse cx={cx} cy={0} rx={m.a} ry={m.b} className="demo__zone" />
          )}

          <line x1="0" y1="0" x2={dist} y2="0" className="demo__route" />
          <rect x="-0.28" y="-0.28" width="0.56" height="0.56" className="demo__hab" />
          <text x="0.5" y="-0.45" className="demo__label demo__label--safe">HAB-1</text>
          <circle cx={dist} cy="0" r="0.3" className="demo__stop" />
          <text
            x={dist > 6 ? dist - 0.5 : dist + 0.5}
            y="-0.45"
            textAnchor={dist > 6 ? "end" : "start"}
            className="demo__label demo__label--mars"
          >
            STOP {stops}
          </text>
        </svg>
        <p className="demo__note">
          Flat open ground, constant {BASE_SPEED_KMH.toFixed(1)} km/h, {Math.round(DWELL_H * 60)}-minute stops. Real terrain
          reshapes the zone; the console computes it on a HiRISE-derived cost grid.
        </p>
      </div>

      <div className="demo__panel">
        <div className={`status status--${m.status.toLowerCase()}`} role="status" aria-live="polite">
          <span className="status__light" aria-hidden="true" />
          <div>
            <div className="status__word">{m.status}</div>
            <div className="status__reason">{m.reason}</div>
          </div>
        </div>

        <div className="demo__ctl">
          <label htmlFor={idD}>
            Distance to farthest stop <b>{dist.toFixed(1)} km</b>
          </label>
          <input
            id={idD}
            type="range"
            min={0.5}
            max={8}
            step={0.1}
            value={dist}
            onChange={(e) => setDist(Number(e.target.value))}
            aria-valuetext={`${dist.toFixed(1)} kilometres`}
          />
        </div>
        <div className="demo__ctl">
          <label htmlFor={idS}>
            Science stops <b>{stops}</b>
          </label>
          <input
            id={idS}
            type="range"
            min={1}
            max={4}
            step={1}
            value={stops}
            onChange={(e) => setStops(Number(e.target.value))}
            aria-valuetext={`${stops} stops`}
          />
        </div>

        <dl className="demo__stats">
          <div><dt>Walking</dt><dd>{hm(m.walkH)}</dd></div>
          <div><dt>Oxygen used</dt><dd>{hm(m.used)}</dd></div>
          <div><dt>Usable budget</dt><dd>{hm(USABLE_H)}</dd></div>
          <div><dt>Margin</dt><dd>{hm(m.margin)}</dd></div>
        </dl>
        <p className="demo__fine">
          8 h consumables − 45 min reserve. Walking burns oxygen ×{WALK_BURN}, science ×{WORK_BURN}.
        </p>
      </div>
    </div>
  );
}
