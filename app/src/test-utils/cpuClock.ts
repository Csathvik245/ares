// Test-only clock for the speed tests (CLAUDE.md section 6: "well under 100 ms").
//
// performance.now() is wall-clock time: when other programs on the laptop are busy
// (a browser tab, Spotlight, other test files), the planner gets less of the CPU and
// looks slow even though its code did not change, so speed tests failed at random.
// cpuNow() counts only the CPU time this test process has used (user + system,
// from process.cpuUsage()), which other programs cannot inflate. Use it exactly like
// performance.now(): take the difference of two readings, in milliseconds.
//
// Never import this from app code: `process` exists in Node (tests), not browsers.
export function cpuNow(): number {
  const { user, system } = process.cpuUsage();
  return (user + system) / 1000;
}

/**
 * Options for every test that checks a time limit: retry up to 2 more times, so a
 * speed test fails only if the code is slow on 3 separate tries. One unlucky moment
 * (the OS parks the test on a slow efficiency core, or another app grabs the CPU)
 * cannot fail the suite; really slow code still does. Never use it on logic tests.
 */
export const SPEED_TEST = { retry: 2 } as const;
