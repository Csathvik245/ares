// Render checks for the Science page, and a guard on every number it copies from the docs.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MAX_SLOPE_DEG, RESERVE_MIN, formatMinutes } from "../planner";
import { MONTE_CARLO_DISCLAIMER } from "../planner/montecarlo";
import { SCIENCE_NUMBERS } from "../lib/scienceNumbers";
import { SCIENCE_SECTIONS, SciencePage } from "./SciencePage";

const repoFile = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
const html = renderToStaticMarkup(<SciencePage />);
/** The visible text, with tags removed and spaces tidied. */
const text = html
  .replace(/<[^>]*>/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&#x27;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/\s+/g, " ");

describe("SciencePage", () => {
  it("renders all eight section headings, numbered, with a matching table of contents", () => {
    expect(SCIENCE_SECTIONS.map((s) => s.title)).toEqual([
      "Why Jezero",
      "The data",
      "How ARES picks a route",
      "Does it match reality?",
      "Uncertainty",
      "Emergencies",
      "How sure are we",
      "Builds on",
    ]);
    expect(html.match(/<h2>/g)).toHaveLength(8);
    SCIENCE_SECTIONS.forEach((s, i) => {
      expect(html).toContain(`<section id="${s.id}"><h2>${i + 1}. ${s.title}</h2>`);
      expect(html).toContain(`<a href="#${s.id}">${s.title}</a>`);
    });
  });

  it("makes no 'first ever' claims", () => {
    expect(text).not.toMatch(/first[\s-]ever|first of its kind|never been done|world'?s first|\bthe first\b/i);
    expect(text).toContain("We did not invent route planning for astronauts");
    for (const name of ["SEXTANT", "xGDS", "MoonPath"]) expect(text).toContain(name);
  });

  it("names every data source with its credit", () => {
    for (const source of ["HiRISE", "THEMIS", "CRISM", "MEDA", "RAD", "Perseverance photos"]) expect(text).toContain(source);
    expect(text.match(/NASA\/JPL-Caltech/g)!.length).toBeGreaterThanOrEqual(7);
    for (const doi of ["10.5066/P9REJ9JN", "10.5281/zenodo.4931348", "10.1002/2014JE004627", "10.1029/2022JE007559", "10.1126/science.1244797"]) {
      expect(text).toContain(doi);
      expect(readFileSync(repoFile("docs/sources.md"), "utf8")).toContain(doi);
    }
  });

  it("shows the validation picture with its credit, and the file is in the app", () => {
    expect(html).toContain('src="/images/validation_traverse.jpg"');
    expect(html).toMatch(/<img[^>]* alt="[^"]{40,}"/);
    expect(text).toContain("Image: NASA/JPL-Caltech/University of Arizona/USGS (HiRISE). Path: NASA/JPL-Caltech (Mars 2020 traverse).");
    expect(existsSync(repoFile("app/public/images/validation_traverse.jpg"))).toBe(true);
  });

  it("uses the planner's own constants", () => {
    expect(text).toContain(`${formatMinutes(RESERVE_MIN * 60)} kept in reserve`);
    expect(text).toContain(`slope over ${MAX_SLOPE_DEG}°`);
    expect(text).toContain(MONTE_CARLO_DISCLAIMER);
  });

  it("says plainly that the human-performance numbers are assumed, and lists four evidence levels", () => {
    expect(text).toMatch(/walking speed, oxygen use and the reserve, are ASSUMED/);
    expect(text).toContain("not measurements from astronauts or suit tests");
    for (const level of ["OBSERVED", "CALCULATED", "INTERPRETED", "ASSUMED"]) expect(html).toContain(`>${level}</span>`);
    expect(text).toContain("The three biggest limits");
  });

  it("has no broken values", () => {
    expect(text).not.toMatch(/NaN|undefined|Infinity|—%/);
  });
});

describe("numbers copied onto the Science page", () => {
  const demoNumbers = readFileSync(repoFile("docs/demo-numbers.md"), "utf8").replace(/\r\n/g, "\n");
  /** The text of one numbered section ("## 4. ...") of docs/demo-numbers.md. */
  const section = (n: string) => {
    const start = demoNumbers.indexOf(`\n## ${n}. `);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = demoNumbers.indexOf("\n## ", start + 1);
    return demoNumbers.slice(start, end < 0 ? undefined : end);
  };

  it.each(Object.entries(SCIENCE_NUMBERS))("%s is still in docs/demo-numbers.md, in its section, and on the page", (_name, n) => {
    expect(n.source).toBe("docs/demo-numbers.md");
    expect(section(n.section)).toContain(n.value);
    expect(text).toContain(n.value);
  });
});
