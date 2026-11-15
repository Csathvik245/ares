import { useMission } from "../lib/MissionContext";
import { EMERGENCY_TEXT } from "../lib/emergency-run";
import { clock, shortStop } from "../lib/presentation";
import { formatDose, formatLmst, formatMet, roundHalfUp, SOL_HOURS, SPE_IS_ILLUSTRATIVE, SPE_MEASURED_2017_PEAK_MULTIPLIER } from "../lib/planner";
import { InfoTip, Jargon } from "./PlanChrome";
export function FlightTimeline({ profileOn, onToggleProfile }: { profileOn?: boolean; onToggleProfile?: () => void } = {}) {
  const m = useMission(),
    plan = m.plan!;
  const duration = Math.max(
    1,
    plan.totalSec,
    m.emergency ? m.emergency.at + (m.returnPlan?.totalSec ?? 0) : 0,
  );
  const activity = m.emergency
    ? m.returnPlan && m.returnElapsed >= m.returnPlan.totalSec
      ? m.replanned ? "At HAB-1 · re-planned EVA complete" : "At HAB-1 · EVA aborted"
      : m.replanned ? "Following the new plan" : "Returning to HAB-1"
    : m.position.phase === "science"
      ? `Science · ${m.stops[m.position.legIndex]?.label ?? "stop"}`
      : `Walking ${m.stops[m.position.legIndex] ? `to stop ${m.position.legIndex + 1} · ${shortStop(m.stops[m.position.legIndex].id, m.stops[m.position.legIndex].label)}` : "to HAB-1"}`;
  const end = m.emergency
    ? m.emergency.at + (m.returnPlan?.totalSec ?? 0)
    : plan.totalSec;
  const labels = [0, ...plan.legs.map((l) => l.arriveSec)];
  return (
    <section className="flight-timeline" aria-label="EVA timeline">
      <div className="timeline-controls">
        <button
          onClick={m.emergency ? m.toggleReturnPlayback : m.togglePlayback}
          disabled={
            m.emergency
              ? !m.returnPlan || m.returnElapsed >= m.returnPlan.totalSec
              : !plan.ok || !plan.legs.length
          }
        >
          {(m.emergency ? m.returnPlaying : m.playing) ? "Pause" : "Play"}
        </button>
        <span className="timeline-clock">
          {formatMet(m.clockElapsed)} <span>/ {formatMet(end)}</span>
          <Jargon term="T+" />
        </span>
        <span className="activity" title={activity}>
          {activity}
        </span>
        <span className="timeline-right">
          <span className="timeline-lmst">
            LMST {formatLmst(m.conditions.startLmst + (m.clockElapsed * 24) / (SOL_HOURS * 3600))}
            <Jargon term="LMST" />
          </span>
          {onToggleProfile && (
            <button
              type="button"
              className={`timeline-profile-toggle${profileOn ? " is-on" : ""}`}
              aria-pressed={!!profileOn}
              title="Show or hide the height of the ground along the walk"
              onClick={onToggleProfile}
            >
              Terrain profile
            </button>
          )}
          {/* Sun, temperature and dose rate at this moment: one hover or focus away. */}
          <InfoTip label="Conditions at this moment: sun, temperature and radiation dose rate">
            <span className="timeline-conditions">
              <span>Sun {roundHalfUp(m.env.sunElevationDeg)}° above the horizon</span>
              <span>
                Air {roundHalfUp(m.env.tempC)} °C <small>MEDA measured data</small>
              </span>
              <span>
                Dose rate {formatDose(m.env.doseRateMsvPerHr).replace(" mSv", " mSv/h")}
                {SPE_IS_ILLUSTRATIVE && m.conditions.spe && <small> illustrative · measured 2017 event x{SPE_MEASURED_2017_PEAK_MULTIPLIER}</small>}
              </span>
            </span>
          </InfoTip>
        </span>
      </div>
      <div className="timeline-track">
        {plan.legs.flatMap((leg, i) => {
          const start = leg.arriveSec - leg.walkSec,
            next = plan.legs[i + 1],
            work = next
              ? Math.max(0, next.arriveSec - next.walkSec - leg.arriveSec)
              : 0;
          return [
            <span
              key={`w${i}`}
              className={`track-walk ${m.emergency ? "track-cancelled" : ""}`}
              style={{
                left: `${(100 * start) / duration}%`,
                width: `${(100 * leg.walkSec) / duration}%`,
              }}
            />,
            <span
              key={`s${i}`}
              className={`track-science ${m.emergency ? "track-cancelled" : ""}`}
              style={{
                left: `${(100 * leg.arriveSec) / duration}%`,
                width: `${(100 * work) / duration}%`,
              }}
            />,
          ];
        })}
        {m.emergency && (
          <>
            <span
              className="track-walk"
              style={{
                left: 0,
                width: `${(100 * m.emergency.at) / duration}%`,
                opacity: 0.35,
              }}
            />
            <span
              className="track-return"
              style={{
                left: `${(100 * m.emergency.at) / duration}%`,
                width: `${(100 * (m.returnPlan?.totalSec ?? 0)) / duration}%`,
              }}
            />
            <i
              className="storm-tick"
              style={{ left: `${(100 * m.emergency.at) / duration}%` }}
            />
          </>
        )}
        <i
          className="playhead"
          style={{ left: `${(100 * m.clockElapsed) / duration}%` }}
        />
        <input
          aria-label="Scrub EVA time"
          type="range"
          min="0"
          max={Math.max(1, plan.totalSec)}
          value={m.elapsed}
          disabled={!!m.emergency}
          onChange={(e) => {
            m.setPlaying(false);
            m.setElapsed(Number(e.target.value));
          }}
        />
      </div>
      <div className="timeline-labels">
        {labels.map((t, i) => (
          <span key={i} style={{ left: `${(100 * t) / duration}%` }}>
            {clock(t)}
          </span>
        ))}
        {m.emergency && (
          <b style={{ left: `${(100 * m.emergency.at) / duration}%` }}>
            {EMERGENCY_TEXT[m.emergency.kind].short} T+
            {clock(m.emergency.at)}
          </b>
        )}
      </div>
    </section>
  );
}
