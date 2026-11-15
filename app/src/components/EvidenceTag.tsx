// A small, quiet tag saying how far a number can be trusted:
// OBSERVED / CALCULATED / INTERPRETED / ASSUMED (the four levels in docs/parameters.md).
// Standalone: give it the level, for example a briefing row's `evidence`.
import type { Evidence } from "../planner";
import "./reliability.css";

const MEANING: Record<Evidence, string> = {
  OBSERVED: "Measured by an instrument",
  CALCULATED: "Worked out by the planner from observed data and stated rules",
  INTERPRETED: "A reading of measured data that depends on a judgement",
  ASSUMED: "Rests on an assumption we chose (see docs/assumptions.md)",
};

export function EvidenceTag({ level }: { level: Evidence }) {
  return (
    <span className={`evidence-tag evidence-tag--${level.toLowerCase()}`} title={MEANING[level]}>
      {level}
    </span>
  );
}
