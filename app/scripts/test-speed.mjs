// Runs the whole test suite WITH the speed-limit tests switched on.
// Used by `npm run test:speed`. Works the same on Windows, macOS and Linux
// (setting an environment variable inline in an npm script does not).
//
// Normal `npm test` skips every speed-limit test, so it can never fail because the
// laptop happened to be busy. Run this on a quiet machine to check performance.
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["vitest", "run", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: true, // needed on Windows, where npx is a .cmd file
  env: { ...process.env, RUN_SPEED_TESTS: "1" },
});
process.exit(result.status ?? 1);
