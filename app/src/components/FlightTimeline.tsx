import { useMission } from "../lib/MissionContext";
import { clock, shortStop } from "../lib/presentation";
export function FlightTimeline() {
  const m = useMission(),
    plan = m.plan!;
  const duration = Math.max(
    1,
    plan.totalSec,
    m.emergency ? m.emergency.at + (m.returnPlan?.totalSec ?? 0) : 0,
  );
  const activity = m.emergency
    ? m.returnPlan && m.returnElapsed >= m.returnPlan.totalSec
      ? "At HAB-1 · EVA aborted"
      : "Returning to HAB-1"
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
          T+{clock(m.clockElapsed)} <span>/ {clock(end)}</span>
        </span>
        <span className="activity" title={activity}>
          {activity}
        </span>
        <span className="timeline-conditions">
          Sun {m.env.sunElevationDeg.toFixed(0)}° · {m.env.tempC.toFixed(0)} °C{" "}
          <small>MEDA curve</small> · {m.env.doseRateMsvPerHr.toFixed(3)} mSv/h
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
            {m.emergency.kind === "storm" ? "Storm" : "SPE"} T+
            {clock(m.emergency.at)}
          </b>
        )}
      </div>
    </section>
  );
}
