// The oxygen bar: white = used, blue = spare (margin), hatched = the reserve.
// One component, so the sidebar and the user guide draw exactly the same bar.
// It only draws: every number is worked out by the caller from the planner.
import { formatMinutes } from "../planner";

export type OxygenBarProps = {
  /** Oxygen used, seconds at the nominal rate. */
  usedSec: number;
  /** Spare oxygen above the reserve, seconds. */
  marginSec: number;
  /** The reserve shown as the hatched end, seconds. */
  reserveSec: number;
  /** What a full bar stands for, seconds (the planner's oxygen budget). */
  budgetSec: number;
  /** The reserve to name in the accessible label, when it differs from the part drawn. Default: reserveSec. */
  reserveRequiredSec?: number;
};

/** The widths of the three parts, in percent of the bar. */
export function oxygenBarWidths({ usedSec, marginSec, reserveSec, budgetSec }: OxygenBarProps): { used: number; margin: number; reserve: number } {
  return {
    used: 100 * Math.min(1, usedSec / budgetSec),
    margin: (100 * Math.max(0, marginSec)) / budgetSec,
    reserve: (100 * reserveSec) / budgetSec,
  };
}

export function OxygenBar(props: OxygenBarProps) {
  const w = oxygenBarWidths(props);
  return (
    <div
      className="budget-bar"
      role="img"
      aria-label={`Oxygen: ${formatMinutes(props.usedSec)} used, ${formatMinutes(props.marginSec)} margin, ${formatMinutes(props.reserveRequiredSec ?? props.reserveSec)} reserve required`}
    >
      <span className="budget-used" style={{ width: `${w.used}%` }} />
      <span className="budget-margin" style={{ width: `${w.margin}%` }} />
      <span className="budget-reserve" style={{ width: `${w.reserve}%` }} />
    </div>
  );
}
