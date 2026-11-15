// Render checks for the Science page, and a guard on every number it copies from the docs.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MAX_SLOPE_DEG, RESERVE_MIN, formatMinutes } from "../planner";
import { MONTE_CARLO_DISCLAIMER } from "../planner/montecarlo";
import { SCIENCE_NUMBERS } from "../lib/scienceNumbers";
import { SCIENCE_SECTIONS, SciencePage, goToScienceSection } from "./SciencePage";

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
      "How we validated ARES",
      "Uncertainty",
      "Emergencies",
      "How sure are we",
      "Builds on",
    ]);
    expect(html.match(/<h2 tabindex="-1">/g)).toHaveLength(8);
    SCIENCE_SECTIONS.forEach((s, i) => {
      expect(html).toContain(`<section id="${s.id}"><h2 tabindex="-1">${i + 1}. ${s.title}</h2>`);
      expect(html).toMatch(new RegExp(`<a href="#science" data-section="${s.id}"[^>]*>${s.title.replace("?", "\\?")}</a>`));
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

  it("shows the route-learning check in section 4, with its picture and credit", () => {
    const start = html.indexOf('<section id="science-reality">');
    const section4 = html.slice(start, html.indexOf("</section>", start));
    const t = section4.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
    expect(section4).toContain("<h3>f. A second check: machine learning</h3>");
    expect(t).toContain("31 of Perseverance's real drives");
    expect(t).toMatch(/could not beat the ARES physics planner/);
    expect(t).toMatch(/planner stays deterministic/);
    expect(section4).toContain('src="/images/route_learning.jpg"');
    expect(t).toContain("Routes: NASA/JPL-Caltech (Mars 2020 traverse). Basemap: NASA/JPL-Caltech/University of Arizona/USGS (HiRISE).");
    expect(existsSync(repoFile("app/public/images/route_learning.jpg"))).toBe(true);
    // Section 3 still says the planner has no machine learning, and points here.
    expect(text).toContain("There is no machine learning in it: the same stops always give the same route.");
    expect(text).toContain("We did test a machine-learning alternative (section 4); it didn't beat the physics model.");
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

describe("contents links scroll in place", () => {
  /** A stand-in page: every section records how it was scrolled and whether its heading got the focus. */
  function fakePage() {
    const calls: { id: string; options?: ScrollIntoViewOptions }[] = [];
    const focused: { id: string; options?: FocusOptions }[] = [];
    const page = {
      getElementById: (id: string) =>
        SCIENCE_SECTIONS.some((s) => s.id === id)
          ? {
              scrollIntoView: (options?: ScrollIntoViewOptions) => void calls.push({ id, options }),
              querySelector: (selector: string) =>
                selector === "h2" ? { focus: (options?: FocusOptions) => void focused.push({ id, options }) } : null,
            }
          : null,
    };
    return { page, calls, focused };
  }

  it("a click does not change location.hash and scrolls the matching section into view", () => {
    const location = { hash: "#science" };
    vi.stubGlobal("window", { location, matchMedia: () => ({ matches: false }) });
    try {
      for (const s of SCIENCE_SECTIONS) {
        const { page, calls, focused } = fakePage();
        const event = { preventDefault: vi.fn() };
        expect(goToScienceSection(s.id, event, page)).toBe(true);
        expect(event.preventDefault).toHaveBeenCalledOnce(); // the browser never follows the link
        expect(location.hash).toBe("#science");
        expect(calls).toEqual([{ id: s.id, options: { behavior: "smooth", block: "start" } }]);
        // Keyboard focus moves to that section's heading, without a second jump.
        expect(focused).toEqual([{ id: s.id, options: { preventScroll: true } }]);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not animate under prefers-reduced-motion", () => {
    const { page, calls } = fakePage();
    goToScienceSection("science-data", { preventDefault: () => {} }, page, true);
    expect(calls[0].options).toEqual({ behavior: "auto", block: "start" });
    vi.stubGlobal("window", { location: { hash: "#science" }, matchMedia: () => ({ matches: true }) });
    try {
      const again = fakePage();
      goToScienceSection("science-data", { preventDefault: () => {} }, again.page);
      expect(again.calls[0].options?.behavior).toBe("auto");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("an unknown section still cancels the navigation, and does nothing else", () => {
    const { page, calls } = fakePage();
    const event = { preventDefault: vi.fn() };
    expect(goToScienceSection("nope", event, page)).toBe(false);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(calls).toEqual([]);
  });

  it("the links are real links that keep the URL on #science, and the first section starts as current", () => {
    const links = [...html.matchAll(/<a href="([^"]+)" data-section="([^"]+)"/g)];
    expect(links).toHaveLength(SCIENCE_SECTIONS.length);
    expect(links.every((m) => m[1] === "#science")).toBe(true);
    expect(links.map((m) => m[2])).toEqual(SCIENCE_SECTIONS.map((s) => s.id));
    expect(html).not.toMatch(/href="#science-/); // nothing can send the hash router an unknown tab
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html).toMatch(/data-section="science-why-jezero" class="is-current" aria-current="true"/);
    const source = readFileSync(repoFile("app/src/components/SciencePage.tsx"), "utf8");
    expect(source).not.toMatch(/location\.hash\s*=/);
    expect(source).toContain("new IntersectionObserver(");
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

  it.each(Object.entries(SCIENCE_NUMBERS))("%s is still in its source document, in its section, and on the page", (_name, n) => {
    if (n.source === "docs/route-learning.md") {
      // The one number that is not in demo-numbers.md: checked against the route-learning write-up.
      expect(readFileSync(repoFile(n.source), "utf8")).toContain(n.value);
    } else {
      expect(n.source).toBe("docs/demo-numbers.md");
      expect(section(n.section)).toContain(n.value);
    }
    expect(text).toContain(n.value);
  });

  it("only the route length comes from outside docs/demo-numbers.md", () => {
    const outside = Object.entries(SCIENCE_NUMBERS).filter(([, n]) => n.source !== "docs/demo-numbers.md");
    expect(outside.map(([name]) => name)).toEqual(["learnRouteLength"]);
  });
});

describe("dataset metadata table (section 2, mirrored in README.md)", async () => {
  const { DATASETS, DATASET_COLUMNS, COARSE_LAYER_NOTE, NOT_RECORDED } = await import("../lib/datasetMetadata");
  const file = (path: string) => readFileSync(repoFile(path), "utf8").replace(/\r\n/g, "\n");
  const sources = file("docs/sources.md");
  const buildSite = file("pipeline/build_site.py");
  const buildBasemap = file("pipeline/build_basemap.py");
  const validation = file("docs/validation.md");
  const row = (id: string) => DATASETS.find((d) => d.id === id)!;

  it("has the six columns and the eight datasets, and every cell is on the page", () => {
    expect([...DATASET_COLUMNS]).toEqual(["Dataset", "Native resolution", "On our grid (25 m)", "Acquisition date / sols", "Resampling method", "DOI / source link"]);
    expect(DATASETS.map((d) => d.id)).toEqual(["hirise-dtm", "hirise-image", "themis", "crism", "meda", "rad", "traverse", "photos"]);
    for (const c of DATASET_COLUMNS) expect(html).toContain(`<th scope="col">${c}</th>`);
    for (const d of DATASETS) for (const cell of [d.name, d.native, d.grid, d.date, d.resample, d.source]) expect(text).toContain(cell);
    for (const d of DATASETS) expect(html).toContain(`href="${d.link}"`);
    expect(text).toContain(COARSE_LAYER_NOTE);
    expect(COARSE_LAYER_NOTE).toBe("Layers coarser than 25 m are resampled, so neighbouring cells can share one measurement; they don't add detail the instrument didn't see.");
  });

  it("scrolls sideways on narrow screens instead of squeezing", () => {
    expect(html).toContain('<div class="science-page__scroll" role="region" aria-label="Dataset metadata" tabindex="0">');
    const css = file("app/src/components/science-page.css");
    expect(css).toMatch(/\.science-page__scroll \{\s*overflow-x: auto;/);
    expect(css).toMatch(/\.science-page__meta \{\s*min-width: \d+px;/);
  });

  it("native resolutions are the ones in docs/sources.md", () => {
    for (const [id, inSources] of [["hirise-dtm", "DTM Mosaic, 1 m/pixel"], ["hirise-image", "Image Mosaic, 25 cm/pixel"], ["themis", "100 m/pixel"], ["crism", "(36 m/pixel)"]] as const) {
      expect(sources).toContain(inSources);
      expect(row(id).native).toBe(inSources.match(/\d+ c?m/)![0] + " per pixel");
    }
    for (const id of ["meda", "rad"]) {
      expect(row(id).native).toBe("Point measurement, not a map; applied over time");
      expect(row(id).grid).toBe(row(id).native);
    }
  });

  it("resampling methods are what the pipeline code does", () => {
    expect(buildSite).toContain("z5 = resample_dtm(SUB_5M, Resampling.average)"); // 1 m pixels averaged to 5 m
    expect(buildSite).toContain("elevation = np.nanmean(z_blocks, axis=2)");
    expect(buildSite).toContain("SLOPE_PERCENTILE = 90");
    expect(buildSite).toContain("slope = np.nanpercentile(blocks(slope5, SUB_5M), SLOPE_PERCENTILE, axis=2)");
    expect(buildSite).toMatch(/SUB_5M = 5 /);
    expect(buildSite).toMatch(/SUB_1M = 25 /);
    expect(row("hirise-dtm").resample).toMatch(/averaged to 5 m.*mean of the cell's 25 five-metre values.*90th percentile.*625 one-metre heights/);
    expect(buildSite).toContain("return to_site_grid(TI_CACHE, 1, Resampling.bilinear, 0.0)");
    expect(row("themis").resample).toMatch(/^Bilinear interpolation/);
    expect(buildSite).toContain("gridded = to_site_grid(CRISM_CACHE, names.index(name) + 1, Resampling.bilinear, CRISM_NODATA)");
    expect(buildSite).toContain("SCIENCE_FULL_SCALE_PERCENTILE = 99.5");
    expect(buildSite).toContain("science = np.nanmax(stack, axis=0)");
    expect(row("crism").resample).toMatch(/Bilinear interpolation.*99\.5th percentile.*highest of the three/);
    expect(buildBasemap).toContain("read two full-resolution image rows for every output row");
    expect(row("hirise-image").resample).toMatch(/two full-resolution rows are read and averaged/);
    expect(file("app/public/data/basemap.json")).toContain("averaged down from 25 cm to about 3.5 m per pixel");
    expect(row("hirise-image").grid).toContain("about 3.5 m per pixel");
    expect(file("pipeline/validate_traverse.py")).toContain("STEP_M = 10.0");
    expect(row("traverse").resample).toContain("every 10 m or closer");
  });

  it("dates and sols are the ones in the docs, and anything else says 'not recorded'", () => {
    expect(sources).toContain("mtrdr/2007/2007_029/hrl000040ff");
    expect(row("crism").date).toBe("29 January 2007 (day 029 of 2007, from the PDS folder name)");
    expect(sources).toContain("Ls 25° (sols 34–40): Tmin 191 K at 05:00, Tmax 243 K at 15:00");
    expect(row("meda").date).toBe("Sols 34 to 40 (Ls 25°)");
    expect(row("meda").resample).toContain("191 K at 05:00");
    expect(row("meda").resample).toContain("243 K at 15:00");
    expect(sources).toContain("0.64 ± 0.12 mSv/day");
    expect(sources).toContain("~300 sols, 7 Aug 2012 – 1 Jun 2013");
    expect(row("rad").date).toBe("7 Aug 2012 to 1 Jun 2013 (about 300 sols)");
    expect(row("rad").resample).toContain("0.64 ± 0.12 mSv per day");
    expect(validation).toContain("(sols 14–896)");
    expect(validation).toContain("Downloaded 14 November 2026");
    expect(row("traverse").date).toBe("Sols 14 to 896 inside our site (file downloaded 14 November 2026)");
    // Photo sols: the first and last in the rover photo table of docs/sources.md.
    const photoSols = [...sources.matchAll(/\| `[a-z-]+\.jpg` \|[^|]*\|[^|]*\| (\d+) \(/g)].map((m) => Number(m[1]));
    expect(photoSols).toHaveLength(7);
    expect(row("photos").date).toBe(`Sols ${Math.min(...photoSols)} to ${Math.max(...photoSols)}`);
    // What our sources do not hold is said plainly, never guessed.
    const unknown = DATASETS.flatMap((d) => (["native", "date"] as const).filter((k) => d[k].startsWith(NOT_RECORDED)).map((k) => `${d.id}.${k}`));
    expect(unknown).toEqual(["hirise-dtm.date", "hirise-image.date", "themis.date", "photos.native"]);
  });

  it("README.md has the same table, cell for cell", () => {
    const readme = file("README.md");
    expect(readme).toContain(`| ${DATASET_COLUMNS.join(" | ")} |`);
    for (const d of DATASETS) {
      const line = readme.split("\n").find((l) => l.startsWith(`| **${d.name}**`));
      expect(line, d.id).toBeDefined();
      for (const cell of [d.mission, d.product, d.native, d.grid, d.date, d.resample, `[${d.source}](${d.link})`]) expect(line, `${d.id}: ${cell}`).toContain(cell);
    }
    expect(readme).toContain(COARSE_LAYER_NOTE);
    expect(readme).not.toMatch(/[\u2014\u2013]/);
  });
});

describe("section 4: the validation report", async () => {
  const { VALIDATION_NUMBERS } = await import("../lib/validationNumbers");
  const file = (path: string) => readFileSync(repoFile(path), "utf8").replace(/\r\n/g, "\n");
  const docs = { demo: file("docs/demo-numbers.md"), validation: file("docs/validation.md"), learning: file("docs/route-learning.md") };
  const start = html.indexOf('<section id="science-reality">');
  const section4 = html.slice(start, html.indexOf("</section>", start));
  const t4 = section4.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");

  it("is titled 'How we validated ARES' and answers the seven questions in order", () => {
    expect(section4).toContain('<h2 tabindex="-1">4. How we validated ARES</h2>');
    const questions = [...section4.matchAll(/<h3>([a-g])\. ([^<]*)<\/h3>/g)].map((m) => `${m[1]}. ${m[2]}`);
    expect(questions).toEqual([
      "a. What did we compare against?",
      "b. What does 99.8% passable mean?",
      "c. What does r = 0.82 measure?",
      "d. The one failure",
      "e. Sensitivity: does the answer depend on our limits?",
      "f. A second check: machine learning",
      "g. Limits of this validation",
    ]);
    // Each answer is short: two to four sentences of text under its heading (lists and tables aside).
    const parts = section4.split(/<h3>[a-g]\. [^<]*<\/h3>/).slice(1, 7); // a to f; g is a list
    for (const part of parts) {
      const prose = [...part.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1].replace(/<[^>]*>/g, " ")).join(" ");
      const sentences = prose.split(/(?<=[.:?])\s+(?=[A-Z])/).filter((x) => x.trim().length > 0);
      expect(sentences.length, prose.slice(0, 60)).toBeGreaterThanOrEqual(2);
      expect(sentences.length, prose.slice(0, 60)).toBeLessThanOrEqual(8);
    }
  });

  it("is marked in the 'On this page' list", () => {
    expect(html).toMatch(/<a href="#science" data-section="science-reality" class="is-key">How we validated ARES<\/a>/);
    expect(html.match(/class="[^"]*is-key/g)).toHaveLength(1);
    const css = file("app/src/components/science-page.css");
    expect(css).toMatch(/\.science-page__toc a\.is-key \{[^}]*border-left: 2px solid var\(--safe\);/);
  });

  it.each(Object.entries(VALIDATION_NUMBERS))("%s is quoted from its document and shown in section 4", (_name, n) => {
    expect(file(n.source)).toContain(n.quote); // the document still says this
    expect(n.quote).toContain(n.value.replace(/ m$| to \d+$/, "").replace("5-fold", "5-fold")); // and the value is in the quote
    expect(t4.replace(/<[^>]*>/g, "")).toContain(n.value);
  });

  it("every number in section 4 is in docs/demo-numbers.md, docs/validation.md or docs/route-learning.md", () => {
    const all = `${docs.demo}\n${docs.validation}\n${docs.learning}`;
    // Numbers as written: 20.57, 99.80%, 20,570, 18.4588, 0.8 and so on. File names and the heading number are not data.
    const body = t4.replace(/docs\/[a-z-]+\.md/g, " ").replace(/^\s*4\. How we validated ARES/, " ");
    const numbers = [...new Set(body.match(/\d[\d,]*(?:\.\d+)?/g) ?? [])].map((n) => n.replace(/,$/, ""));
    expect(numbers.length).toBeGreaterThan(30);
    const missing = numbers.filter((n) => !new RegExp(`(?<![\d.])${n.replace(/[.,]/g, "\$&")}(?![\d])`).test(all));
    expect(missing).toEqual([]);
    // The headline four, spelled out: these are the frozen values.
    for (const value of ["20.57 km", "99.8%", "98.6%", "r = 0.82", "313 waypoints", "41.7 m", "25.8°", "35.3 m", "24.8 m", "15.38 km"]) expect(t4).toContain(value);
  });

  it("says what each number does and does not show", () => {
    expect(t4).toMatch(/none of it was used to build the terrain layers/);
    expect(t4).toMatch(/even a random path would score in the high nineties/);
    expect(t4).toMatch(/does not show that everything we call passable really is/);
    expect(t4).toMatch(/Correlation does not mean the two values are equal/);
    expect(t4).toMatch(/says nothing about ground the rover never visited/);
    expect(t4).toMatch(/ARES would send an astronaut around it/);
    expect(t4).toMatch(/cannot tell us whether our roughness limit is right/);
    expect(t4).toMatch(/A rover is not an astronaut/);
    expect(t4).not.toMatch(/ML-powered|machine learning (picks|chooses) the route/i);
  });

  it("has the four pictures: the two new charts are real files drawn by the pipeline script, at most 300 KB, with a NASA/JPL-Caltech credit", () => {
    const images = [...section4.matchAll(/<img src="\/images\/([^"]+)"/g)].map((m) => m[1]);
    expect(images).toEqual(["validation_traverse.jpg", "validation_path_vs_site.png", "validation_slope_vs_tilt.png", "route_learning.jpg"]);
    const script = file("pipeline/make_validation_charts.py");
    for (const chart of ["validation_path_vs_site.png", "validation_slope_vs_tilt.png"]) {
      const bytes = readFileSync(repoFile(`app/public/images/${chart}`));
      expect(bytes.subarray(1, 4).toString()).toBe("PNG");
      expect(bytes.length).toBeLessThanOrEqual(300_000);
      expect(script).toContain(chart);
    }
    expect(section4.match(/<img[^>]*loading="lazy"/g)).toHaveLength(4);
    expect(section4.match(/<figcaption>[\s\S]*?NASA\/JPL-Caltech[\s\S]*?<\/figcaption>/g)).toHaveLength(4);
    // The scatter plot's points are computed the way validate_traverse.py does, and the page says so.
    expect(script).toContain("rover-waypoints-sample.json");
    expect(script).toContain('recorded["tilt_vs_our_slope_correlation"]');
    expect(t4).toMatch(/summary file stores only the correlation, so the dots are computed the same way the validation script does it/);
  });
});
