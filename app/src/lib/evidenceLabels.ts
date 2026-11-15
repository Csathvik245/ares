// The short evidence labels shown next to numbers on screen.
// Every label starts with one of the four levels from planner/briefing.ts
// (OBSERVED / CALCULATED / INTERPRETED / ASSUMED), typed as Evidence, so a level can
// never be misspelt or drift from docs/parameters.md.
import { SCIENCE_EVIDENCE } from "../planner";
import type { Evidence } from "../planner";

const OBSERVED: Evidence = "OBSERVED";
const CALCULATED: Evidence = "CALCULATED";
const ASSUMED: Evidence = "ASSUMED";

export const EVIDENCE_LABELS = {
  /** Route distance and time, walking and science time, the status. */
  route: CALCULATED as string,
  /** Oxygen budget and margin: calculated, but from burn rates we assumed. */
  oxygen: `${CALCULATED} · ${ASSUMED} burn rates`,
  /** Lowest sun during the EVA. */
  sun: `${CALCULATED} · Mars24`,
  /** Quiet-time radiation dose: measured by Curiosity RAD at Gale Crater, applied to Jezero. */
  radiation: `${OBSERVED} at Gale · est.`,
  /** Anything during a solar particle event: the ×30 dose rate is illustrative. */
  spe: ASSUMED as string,
  /** The emergency buttons simulate a response we chose. */
  emergency: `${ASSUMED} response`,
  /** Science value and science score: a reading of the CRISM clay and carbonate signal. */
  science: SCIENCE_EVIDENCE as string,
} as const;
