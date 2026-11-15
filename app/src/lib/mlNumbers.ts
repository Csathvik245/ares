// Numbers quoted in the Science page's machine-learning section (section 5).
// Each one is COPIED from docs/route-learning.md and carries the exact piece of that
// document it was copied from (`quote`). A test (components/science-ml.test.tsx) fails if
// a quote is no longer in the document, if a value is not inside its quote, or if a value
// disagrees with pipeline/data/route_learning.json. Never type a number here from memory.
import type { QuotedNumber } from "./validationNumbers";

const LEARNING = "docs/route-learning.md";
const from = (value: string, quote: string): QuotedNumber => ({ value, source: LEARNING, quote });

const KEPT = "**31 routes, 15.38 km, sols 105–770**";
const PHYSICS_VS_LINE = "| Physics vs straight line | 10.4 m closer | 4.0 to 17.1 m | 18 | 10 | 3 |";
const LEARNED_VS_PHYSICS = "| Learned (safety rule) vs physics | 0.0 m | 0.0 to 0.0 m | 0 | 0 | 31 |";

export const ML_NUMBERS = {
  // b. What it learned from
  routes: from("31", KEPT),
  km: from("15.38 km", KEPT),
  firstSol: from("105", KEPT),
  lastSol: from("770", KEPT),
  routeLength: from("500 m", "cut into routes of about 500 m"),
  dropped: from("9", "9 routes that wander"),
  straightness: from("0.6", "straight-line distance under 0.6 × path length"),

  // c. How it learns
  features: from("7", "Each passable cell gets 7 features"),
  steps: from("150", "150 steps."),

  // d. How we tested it
  folds: from("5-fold", "Blocked 5-fold cross-validation in driving order"),

  // e. The result
  straightMean: from("35.3 m", "| Straight line (no terrain) | 35.3 m | 35.3 m | 76.7% |"),
  physicsMean: from("24.8 m", "| **ARES physics model** | **24.8 m** | **25.0 m** | **89.9%** |"),
  gain: from("10.4 m", PHYSICS_VS_LINE),
  gainLow: from("4.0", PHYSICS_VS_LINE),
  gainHigh: from("17.1 m", PHYSICS_VS_LINE),
  closer: from("18", PHYSICS_VS_LINE),
  further: from("10", PHYSICS_VS_LINE),
  same: from("3", PHYSICS_VS_LINE),
  sameThreshold: from("0.5 m", "if the difference is more than 0.5 m"),
  learnedSame: from("31", LEARNED_VS_PHYSICS),
  learnedGain: from("0.0 m", LEARNED_VS_PHYSICS),

  // f. What that means
  noRuleEnd: from("27.4 m", "(27.4 m vs 24.85 m)"),
  physicsTraining: from("24.85 m", "(27.4 m vs 24.85 m)"),
  noRuleRoughness: from("×0.85", "| Roughness | ×0.85 |"),
} as const;
