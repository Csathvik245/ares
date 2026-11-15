// Numbers quoted in the Science page's validation report (section 4) that are not already
// in lib/scienceNumbers.ts. Each one is COPIED from docs/validation.md or
// docs/route-learning.md, and carries the exact piece of that document it was copied
// from (`quote`). A test (components/science-page.test.tsx) fails if a quote is no longer
// in its document, or if a value is not inside its quote. Never type a number here from
// memory.

const VALIDATION = "docs/validation.md";
const LEARNING = "docs/route-learning.md";

export type QuotedNumber = { value: string; source: string; quote: string };
const from = (source: string, value: string, quote: string): QuotedNumber => ({ value, source, quote });

export const VALIDATION_NUMBERS = {
  // a. What we compared against
  firstSol: from(VALIDATION, "14", "(sols 14–896)"),
  lastSol: from(VALIDATION, "896", "(sols 14–896)"),
  downloaded: from(VALIDATION, "14 November 2026", "Downloaded 14 November 2026"),
  cellsTouched: from(VALIDATION, "755", "touching 755 of our cells"),

  // b. What 99.8% passable means
  pathMetres: from(VALIDATION, "20,570 m", "41.7 m of 20,570 m"),
  waypointsPassable: from(VALIDATION, "310 of 313", "310 of 313 (99.04%)"),

  // c. What r = 0.82 measures
  tiltMedian: from(VALIDATION, "3.3°", "3.3° / 11.1° / 20.3°"),
  ourSlopeMedian: from(VALIDATION, "5.0°", "5.0° / 12.4° / 25.8°"),
  slopeAtLeastTilt: from(VALIDATION, "78.6%", "| Waypoints where our slope is at least the rover's tilt | 78.6% |"),

  // d. The one failure
  overLimitBy: from(VALIDATION, "0.8°", "(here by 0.8°)"),
  noGoRock: from(VALIDATION, "0.53", "| 41.7 m | 25.8° | 0.53 |"),

  // e. Sensitivity (share of the rover's path rated passable, and of the whole site, at our rock limit)
  slope20Path: from(VALIDATION, "99.47%", "99.47% (site 97.38%)"),
  slope20Site: from(VALIDATION, "97.38%", "99.47% (site 97.38%)"),
  slope25Path: from(VALIDATION, "99.80%", "**99.80% (site 98.63%)**"),
  slope25Site: from(VALIDATION, "98.63%", "**99.80% (site 98.63%)**"),
  slope30Path: from(VALIDATION, "100.00%", "100.00% (site 99.19%)"),
  slope30Site: from(VALIDATION, "99.19%", "100.00% (site 99.19%)"),
  rockLimitLow: from(VALIDATION, "0.65", "Rock limit 0.65"),
  rockLimitHigh: from(VALIDATION, "0.85", "Rock limit 0.85"),
  roughestCrossed: from(VALIDATION, "0.58", "never crossed a cell rougher than 0.58"),

  // The second chart: the ground under the rover against the whole site
  slopeMedianPath: from(VALIDATION, "3.6°", "| Slope, middle value (median) | 3.6° | 4.3° |"),
  slopeMedianSite: from(VALIDATION, "4.3°", "| Slope, middle value (median) | 3.6° | 4.3° |"),
  sandPath: from(VALIDATION, "4.8%", "| Soft sand (thermal inertia under 175) | 4.8% | 9.2% |"),
  sandSite: from(VALIDATION, "9.2%", "| Soft sand (thermal inertia under 175) | 4.8% | 9.2% |"),
  difficultyPath: from(VALIDATION, "1.48", "| 1.48 | 1.65 |"),
  difficultySite: from(VALIDATION, "1.65", "| 1.48 | 1.65 |"),

  // f. The machine-learning check
  folds: from(LEARNING, "5-fold", "Blocked 5-fold cross-validation in driving order"),
  closerThanStraight: from(LEARNING, "10.4 m", "**10.4 m closer than a straight line**"),
} as const;
