/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

function publicFiles(directory: string, prefix = ""): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const name = `${prefix}${entry.name}`;
    return entry.isDirectory()
      ? publicFiles(join(directory, entry.name), `${name}/`)
      : [name];
  });
}

export default defineConfig({
  plugins: [react()],
  // Optional science assets are requested only when included in this deployment.
  define: {
    "import.meta.env.ARES_PUBLIC_FILES": JSON.stringify(
      publicFiles(fileURLToPath(new URL("./public", import.meta.url))),
    ),
  },
  test: {
    // Run test files one at a time. The planner has speed tests ("median under
    // 100 ms" on the real 320 x 240 grid, CLAUDE.md section 6). When all test
    // files run in parallel they compete for the CPU and those tests fail on a
    // laptop even though each function is fast on its own.
    fileParallelism: false,
  },
});
