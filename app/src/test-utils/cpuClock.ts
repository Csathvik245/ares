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
 * Speed-limit tests are OPT-IN. They run only when the environment variable
 * RUN_SPEED_TESTS is "1", which `npm run test:speed` sets. A normal `npm test` skips
 * them, so it can never fail because the laptop was busy at that moment.
 */
export const RUN_SPEED_TESTS = process.env.RUN_SPEED_TESTS === "1";

/**
 * Options for every test that ONLY checks a time limit:
 * - skipped unless RUN_SPEED_TESTS is on (see above);
 * - when it does run, retried up to 2 more times, so it fails only if the code is slow
 *   on 3 separate tries. One unlucky moment (the OS parks the test on a slow efficiency
 *   core, or another app grabs the CPU) cannot fail it; really slow code still does.
 * Never use it on a test that also checks logic: that logic would be skipped too. For
 * those, keep the test always on and wrap only the time check in `if (RUN_SPEED_TESTS)`.
 */
export const SPEED_TEST = { retry: 2, skip: !RUN_SPEED_TESTS } as const;
