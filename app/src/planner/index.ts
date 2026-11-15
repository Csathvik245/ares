// Planner entry point. Pure functions only — no UI code in this folder.
export * from "./constants";
export * from "./types";
export { loadSite, cellIndexOf, cellCenter } from "./site";
export { buildCostGrid, walkingSpeedMps } from "./cost";
export { dijkstraField, aStar, pathTo, pathLengthM } from "./search";
export { planRoute } from "./plan";
export { smoothPath, segmentIsClear, segmentTimeSec, forEachCellOnSegment, distanceM, polylineLengthM } from "./geom";
export { oxygenBudget, isLowMargin, CAUTION_MARGIN_FRACTION } from "./oxygen";
export type { OxygenBudget } from "./oxygen";
export { fieldFrom, walkHomeSec } from "./fields";
export { safeZone } from "./zone";
export { positionAt } from "./timeline";
export type { Position } from "./timeline";
export { abortRoute } from "./abort";
export type { AbortRoute } from "./abort";
export { explainSegment } from "./explain";
export type { SegmentExplanation } from "./explain";
export {
  envAt,
  sunElevationSeries,
  sunElevationDeg,
  lowSunDuring,
  solarDeclinationDeg,
  equationOfTimeDeg,
  lmstToLtst,
  ltstToLmst,
  temperatureC,
  doseRateMsvPerHr,
  SITE_LAT_DEG,
  DEMO_LS_DEG,
  SUN_CAUTION_DEG,
  TEMP_IS_SOURCED,
  TEMP_SOURCE_LS_DEG,
  TEMP_MIN_K,
  TEMP_MAX_K,
  TEMP_MIN_LTST,
  TEMP_MAX_LTST,
  TEMP_MIN_C,
  TEMP_MIN_LMST,
  TEMP_MAX_C,
  TEMP_MAX_LMST,
} from "./env";
export type { LowSun } from "./env";
export {
  NO_VALUE,
  roundHalfUp,
  wholeMinutes,
  formatMinutes,
  formatDuration,
  formatKm,
  formatPct,
  formatDose,
  formatLmst,
  formatMet,
} from "./format";
export { stormAt } from "./storm";
export type { EmergencyKind, StormOutcome } from "./storm";
export { computeBriefing } from "./briefing";
export type { Briefing, BriefingRow, BriefingStatus, Evidence } from "./briefing";
export { scienceScore, suggestStops } from "./science";
export type { StopScience, StopSuggestion, ScoreOptions, SuggestOptions } from "./science";
