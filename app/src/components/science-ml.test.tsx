// Section 5 of the Science page: "Can machine learning do better?". Every number shown must
// be the one in docs/route-learning.md AND in pipeline/data/route_learning.json, and the
// three charts must be real files drawn by pipeline/make_ml_charts.py.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("leaflet", () => ({ default: {} }));
const { SciencePage, SCIENCE_SECTIONS } = await import("./SciencePage");
const { ML_NUMBERS } = await import("../lib/mlNumbers");

const repoFile = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
const file = (path: string) => readFileSync(repoFile(path), "utf8").replace(/\r\n/g, "\n");
const html = renderToStaticMarkup(<SciencePage />);
const start = html.indexOf('<section id="science-ml">');
const section5 = html.slice(start, html.indexOf("</section>", start));
const t5 = section5.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const doc = file("docs/route-learning.md");
const json = JSON.parse(file("pipeline/data/route_learning.json"));
const round = (value: number, places: number) => (Math.round(value * 10 ** places + 1e-9) / 10 ** places).toFixed(places);

describe("section 5: can machine learning do better?", () => {
  it("is a section of its own, fifth in the page and in the 'On this page' list, and the later sections are renumbered", () => {
    expect(SCIENCE_SECTIONS.map((s) => s.id)).toEqual([
      "science-why-jezero",
      "science-data",
      "science-route",
      "science-reality",
      "science-ml",
      "science-uncertainty",
      "science-emergencies",
      "science-evidence",
      "science-related",
    ]);
    expect(section5).toContain('<h2 tabindex="-1">5. Can machine learning do better?</h2>');
    expect(html).toMatch(/<a href="#science" data-section="science-ml"[^>]*>Can machine learning do better\?<\/a>/);
    for (const later of ["6. Uncertainty", "7. Emergencies", "8. How sure are we", "9. Builds on"]) expect(html).toContain(`<h2 tabindex="-1">${later}</h2>`);
  });

  it("answers the seven parts in order, in short plain paragraphs", () => {
    const parts = [...section5.matchAll(/<h3>([a-g])\. ([^<]*)<\/h3>/g)].map((m) => `${m[1]}. ${m[2]}`);
    expect(parts).toEqual([
      "a. The question",
      "b. What it learned from",
      "c. How it learns",
      "d. How we tested it fairly",
      "e. The result",
      "f. What that means",
      "g. Limits",
    ]);
    for (const paragraph of section5.matchAll(/<p>([\s\S]*?)<\/p>/g)) {
      const words = paragraph[1].replace(/<[^>]*>/g, " ").trim().split(/\s+/).length;
      expect(words, paragraph[1].slice(0, 50)).toBeLessThanOrEqual(110);
    }
  });

  it("says the honest things: the answer is no, how it learns, how it was tested, and what it means", () => {
    expect(t5).toMatch(/Short answer: no\./);
    expect(t5).toMatch(/It starts as our physics model\./);
    expect(t5).toMatch(/nudges how much it dislikes each kind of ground/);
    expect(t5).toContain("maximum margin planning (Ratliff, Bagnell and Zinkevich 2006");
    expect(section5).toContain('<a href="https://doi.org/10.1145/1143844.1143936"');
    expect(doc).toContain("doi:10.1145/1143844.1143936");
    expect(t5).toMatch(/only scored on routes it never saw/);
    expect(t5).toMatch(/five blocks in driving order/);
    expect(t5).toMatch(/the best model was the physics model itself/);
    expect(t5).toMatch(/drifted towards less caution and its routes got worse/);
    expect(t5).toMatch(/planner stays deterministic/);
    expect(t5).toMatch(/independent check/);
    expect(t5).toMatch(/Rover drivers are not astronauts\./);
    expect(t5).toMatch(/A 25 m grid\./);
    expect(t5).toMatch(/A small sample\./);
    expect(t5).not.toMatch(/ML-powered|first ever|machine learning (picks|chooses|plans) the route/i);
  });

  it.each(Object.entries(ML_NUMBERS))("%s is quoted from docs/route-learning.md and shown in section 5", (_name, n) => {
    expect(n.source).toBe("docs/route-learning.md");
    expect(doc).toContain(n.quote); // the document still says this
    expect(n.quote).toContain(n.value.replace(/ m$/, "")); // and the value is in the quote
    expect(`${t5} ${section5}`).toContain(n.value); // on the page (text, or a chart's description)
  });

  it("the numbers are the ones in pipeline/data/route_learning.json", () => {
    const M = ML_NUMBERS;
    const e = json.evaluation;
    expect(M.routes.value).toBe(String(json.source.routes));
    expect(json.routes).toHaveLength(json.source.routes);
    expect(M.km.value).toBe(`${json.source.km} km`);
    expect([M.firstSol.value, M.lastSol.value]).toEqual(json.source.sols.map(String));
    expect(M.routeLength.value).toBe(`${json.training.routeLengthM} m`);
    expect(M.dropped.value).toBe(String(json.training.dropped.wandering));
    expect(M.straightness.value).toBe(String(json.training.minStraightness));
    expect(M.features.value).toBe(String(json.features.length));
    expect(M.steps.value).toBe(String(json.training.iterations));
    expect(e.method).toContain(`Blocked ${M.folds.value} cross-validation in driving order`);
    expect(e.weights_per_fold.learned_safe).toHaveLength(5);
    expect(M.straightMean.value).toBe(`${round(e.straight_line.mean_dev_m.mean, 1)} m`);
    expect(M.physicsMean.value).toBe(`${round(e.physics.mean_dev_m.mean, 1)} m`);
    const versus = e.physics_vs_straight_line;
    expect(M.gain.value).toBe(`${round(versus.mean_gain_m, 1)} m`);
    expect([M.gainLow.value, M.gainHigh.value]).toEqual([round(versus.gain_95ci_m[0], 1), `${round(versus.gain_95ci_m[1], 1)} m`]);
    expect([M.closer.value, M.further.value, M.same.value]).toEqual([versus.closer, versus.further, versus.same].map(String));
    const learned = e.learned_safe_vs_physics;
    expect(M.learnedSame.value).toBe(String(learned.same));
    expect([learned.closer, learned.further]).toEqual([0, 0]);
    expect(M.learnedGain.value).toBe(`${round(learned.mean_gain_m, 1)} m`);
    const free = json.finalWeights.learned_no_rule;
    expect(M.noRuleEnd.value).toBe(`${round(free.endOfTrainingDeviationM, 1)} m`);
    expect(M.physicsTraining.value).toBe(`${round(free.physicsDeviationM, 2)} m`);
    expect(M.noRuleRoughness.value).toBe(`×${round(free.endOfTrainingFactors.roughness, 2)}`);
    // "On every fold the best model was the physics model itself": power 1, every other weight 0.
    for (const version of ["learned_safe", "learned_no_rule"]) for (const fold of e.weights_per_fold[version]) expect(fold).toEqual([1, 0, 0, 0, 0, 0, 0]);
    // With the safety rule, nothing moved by the end of training.
    for (const factor of Object.values(json.finalWeights.learned_safe.endOfTrainingFactors)) expect(factor).toBe(1);
    // Without it, every factor ended at or below 1 (less careful), and the routes were further from the drivers'.
    for (const factor of Object.values(free.endOfTrainingFactors) as number[]) expect(factor).toBeLessThanOrEqual(1);
    expect(free.endOfTrainingDeviationM).toBeGreaterThan(free.physicsDeviationM);
  });

  it("every number in the section's text is in docs/route-learning.md or docs/demo-numbers.md", () => {
    const all = `${doc}\n${file("docs/demo-numbers.md")}`;
    const body = t5.replace(/docs\/[a-z-]+\.md/g, " ").replace(/^\s*5\. Can machine learning do better\?/, " ");
    const numbers = [...new Set(body.match(/\d[\d,]*(?:\.\d+)?/g) ?? [])].map((n) => n.replace(/,$/, ""));
    expect(numbers.length).toBeGreaterThan(15);
    const missing = numbers.filter((n) => !new RegExp(`(?<![\\d.])${n.replace(/[.,]/g, "\\$&")}(?![\\d])`).test(all));
    expect(missing).toEqual([]);
  });

  it("has four pictures: three charts drawn by pipeline/make_ml_charts.py (at most 300 KB each) and the existing route_learning image, all credited", () => {
    const images = [...section5.matchAll(/<img src="\/images\/([^"]+)"/g)].map((m) => m[1]);
    expect(images).toEqual(["ml_routes_dumbbell.png", "ml_win_tie_loss.png", "route_learning.jpg", "ml_dislike_factors.png"]);
    const script = file("pipeline/make_ml_charts.py");
    for (const chart of ["ml_routes_dumbbell.png", "ml_win_tie_loss.png", "ml_dislike_factors.png"]) {
      const bytes = readFileSync(repoFile(`app/public/images/${chart}`));
      expect(bytes.subarray(1, 4).toString()).toBe("PNG");
      expect(bytes.length).toBeLessThanOrEqual(300_000);
      expect(script).toContain(chart);
    }
    expect(existsSync(repoFile("app/public/images/route_learning.jpg"))).toBe(true);
    expect(section5.match(/<img[^>]*loading="lazy"/g)).toHaveLength(4);
    expect(section5.match(/<img[^>]* alt="[^"]{60,}"/g)).toHaveLength(4);
    expect(section5.match(/<figcaption>[\s\S]*?NASA\/JPL-Caltech \(Mars 2020 traverse\)[\s\S]*?<\/figcaption>/g)).toHaveLength(4);
    // The charts are drawn from the results file only, in the validation charts' dark style, with the credit on them.
    expect(script).toContain('os.path.join(ROOT, "pipeline", "data", "route_learning.json")');
    expect(script).toContain("NASA/JPL-Caltech (Mars 2020 traverse)");
    expect(script).toContain('VOID, TEXT, MUTED, LINE = "#0a0a0a", "#ededed", "#a3a3a3", "#3a3a3a"');
    expect(script).toContain('final["learned_safe"]["endOfTrainingFactors"]');
    expect(script).toContain('final["learned_no_rule"]["endOfTrainingFactors"]');
    // The factors chart says that the model we kept fell back to physics.
    expect(t5).toMatch(/The model we kept fell back to physics/);
    expect(script).toContain("fell back to the physics model");
  });
});
