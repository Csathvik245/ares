// Result numbers quoted on the Science page that cannot be imported from the planner at
// render time (they need the pipeline's output files or a whole mission run).
// Each one is COPIED, character for character, from docs/demo-numbers.md, which
// `npm test` keeps equal to the planner and the data files. (One number, the length of
// the rover routes used for route learning, is not in that file; it is copied from
// docs/route-learning.md and checked against it instead.) A test
// (components/science-page.test.tsx) fails if any value here is no longer in that file,
// so these cannot drift. Never type a number here from memory.
//
// Suit and mission constants (reserve, slope limit, burn rates, ...) are NOT here: the
// page imports them from the planner.

const DEMO = "docs/demo-numbers.md";
const ROUTE_LEARNING = "docs/route-learning.md";

export type CopiedNumber = { value: string; source: string; section: string };
const from = (section: string, value: string): CopiedNumber => ({ value, source: DEMO, section });

export const SCIENCE_NUMBERS = {
  // 1. Demo mission
  demoDistance: from("1", "4.97 km"),
  demoMargin: from("1", "192 min"),

  // 2. Dust storm at T+1:16
  stormAt: from("2", "T+1:16"),
  stormWalkHome: from("2", "57 min"),
  stormMargin: from("2", "244 min"),

  // 3. Solar particle event and shelter (Wildcat Ridge demo)
  shelterDistance: from("3", "160 m"),
  shelterDoseCut: from("3", "12%"),

  // 4. Validation against Perseverance's real drive
  roverPath: from("4", "20.57 km"),
  roverPassable: from("4", "99.8%"),
  sitePassable: from("4", "98.6%"),
  tiltCorrelation: from("4", "r = 0.82"),
  waypoints: from("4", "313 waypoints"),
  noGoPlace: from("4", "18.4588 N, 77.4060 E"),
  noGoLength: from("4", "41.7 m"),
  noGoSlope: from("4", "25.8°"),

  // 5. Route learning (held-out routes; the physics planner stays the planner)
  learnRoutes: from("5", "31 held-out routes"),
  learnStraightLine: from("5", "35.3 m"),
  learnPhysics: from("5", "24.8 m"),
  learnSameRoute: from("5", "31 of 31 routes"),
  /** Not in demo-numbers.md: from the data table of docs/route-learning.md. */
  learnRouteLength: { value: "15.38 km", source: ROUTE_LEARNING, section: "" } as CopiedNumber,

  // 6. Monte Carlo reliability of the demo mission
  demoTrials: from("6", "1000 of 1000 trials"),
  demoFailureBound: from("6", "0.3%"),

  // 7. Stretch mission
  stretchDistance: from("7", "6.87 km"),
  stretchTime: from("7", "6:25"),
  stretchMargin: from("7", "18 min"),
  stretchWithReserve: from("7", "72.1% (721 of 1000 trials)"),
  stretchHomeAtAll: from("7", "98.0%"),

  // 8. New emergencies (default sizes, demo mission at T+1:16)
  oxygenLossMargin: from("8", "194 min → 96 min"),
  slowWalkMargin: from("8", "194 min → 151 min"),
  blockedMargin: from("8", "194 min → 193 min"),
  bigLossHomeMargin: from("8", "111 min"),
  bigLossContinueMargin: from("8", "31 min"),

  // 9. ARES vs terrain-blind route (demo mission)
  terrainBlindSlower: from("9", "13 min more"),
  terrainBlindLessSpare: from("9", "18 min less spare oxygen"),
} as const;
