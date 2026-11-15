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
      "Does it match reality?",
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
    expect(section4).toContain("<h3>A second check: machine learning</h3>");
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
