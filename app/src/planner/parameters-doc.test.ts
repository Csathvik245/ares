// docs/parameters.md must list every number the planner exports as a constant.
// If someone adds a constant to constants.ts (or to oxygen.ts, env.ts, science.ts,
// shelter.ts) without documenting it, this test fails and names it.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as constants from "./constants";
import * as env from "./env";
import * as oxygen from "./oxygen";
import * as science from "./science";
import * as shelter from "./shelter";

const doc = readFileSync(fileURLToPath(new URL("../../../docs/parameters.md", import.meta.url)), "utf8");

/** Table rows of the doc, keyed by the constant named in their first cell. */
const rows = new Map<string, string>();
for (const line of doc.split("\n")) {
  const match = /^\| `([A-Z][A-Z0-9_]*)` \|/.exec(line);
  if (match) rows.set(match[1], line);
}

/** Exported constants of a module: numbers, booleans and strings (not functions or types). */
const constantsOf = (module: Record<string, unknown>) =>
  Object.entries(module).filter(([name, value]) => /^[A-Z][A-Z0-9_]*$/.test(name) && ["number", "boolean", "string"].includes(typeof value));

describe("docs/parameters.md covers every planner constant", () => {
  it("every exported constant in constants.ts has a row", () => {
    const missing = constantsOf(constants).map(([name]) => name).filter((name) => !rows.has(name));
    expect(missing, `missing from docs/parameters.md: ${missing.join(", ")}`).toEqual([]);
    expect(constantsOf(constants).length).toBeGreaterThanOrEqual(17);
  });

  it("every exported constant in oxygen.ts, env.ts, science.ts and shelter.ts has a row", () => {
    const missing: string[] = [];
    for (const [file, module] of Object.entries({ oxygen, env, science, shelter })) {
      for (const [name] of constantsOf(module)) if (!rows.has(name)) missing.push(`${file}.ts: ${name}`);
    }
    expect(missing, `missing from docs/parameters.md: ${missing.join(", ")}`).toEqual([]);
  });

  it("each constants.ts row shows the value that is in the code", () => {
    for (const [name, value] of constantsOf(constants)) {
      const cells = rows.get(name)!.split("|").map((c) => c.trim());
      const shown = cells[2];
      // Numbers are compared as numbers, so "3.0" in the doc matches 3 in the code.
      const same = typeof value === "number" ? Number(shown) === value : shown === String(value);
      expect(same, `${name}: the doc says "${shown}", the code says ${value}`).toBe(true);
    }
  });

  it("every row names one of the four evidence levels", () => {
    for (const [name, row] of rows) {
      const evidence = row.split("|")[4];
      expect(evidence, name).toMatch(/OBSERVED|CALCULATED|INTERPRETED|ASSUMED/);
    }
  });

  it("the radiation rows say where the values were measured and that the SPE is illustrative", () => {
    expect(rows.get("DOSE_MSV_PER_SOL")).toMatch(/Gale Crater/);
    expect(rows.get("DOSE_MSV_PER_SOL")).toMatch(/transferred to Jezero as an estimate/);
    expect(rows.get("SPE_MULTIPLIER")).toMatch(/ASSUMED \(illustrative scenario\)/);
    expect(rows.get("SPE_MULTIPLIER")).toMatch(/Not a measurement/);
    expect(rows.get("SPE_MEASURED_2017_PEAK_MULTIPLIER")).toMatch(/Gale Crater/);
  });
});
