// Shareable mission links: a plan to text and back, and no crash on bad text.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCostGrid, loadSite, planRoute } from "../planner";
import type { Stop } from "../planner";
import { tabFromHash } from "./appTabs";
import { MAX_LINK_STOPS, MISSION_LINK_VERSION, decodeMission, encodeMission, missionParamOf, planHashFor, stopsFromLink } from "./missionLink";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");
const site = loadSite(JSON.parse(read("../../public/data/site.json")));
const demoStops: Stop[] = site.pois
  .filter((p) => p.kind === "science")
  .slice(0, 3)
  .map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin: 30 }));
const custom: Stop = { id: "x", label: "My stop: 50%, a/b; c & d?", lat: 18.4567891, lng: 77.4012345, dwellMin: 12.5 };

describe("mission link: encode and decode", () => {
  it("round trip: the demo mission comes back with the same stops, names, science minutes and start time", () => {
    const encoded = encodeMission({ startLmst: 13, stops: demoStops });
    expect(encoded.startsWith(`${MISSION_LINK_VERSION};13;`)).toBe(true);
    const decoded = decodeMission(encoded)!;
    expect(decoded.startLmst).toBe(13);
    expect(decoded.stops).toHaveLength(3);
    decoded.stops.forEach((s, i) => {
      expect(s.label).toBe(demoStops[i].label); // including the accents in "Séítah" and "Máaz"
      expect(s.dwellMin).toBe(30);
      expect(s.lat).toBeCloseTo(demoStops[i].lat, 5);
      expect(s.lng).toBeCloseTo(demoStops[i].lng, 5);
    });
    // Encoding the decoded mission again gives the same text: the link is stable.
    expect(encodeMission(decoded)).toBe(encoded);
  });

  it("the restored plan is the same plan: same distance, time, oxygen and status", () => {
    const cost = buildCostGrid(site, { storm: false, spe: false, startLmst: 13 });
    const before = planRoute(site, cost, site.habitat, demoStops);
    const restored = stopsFromLink(decodeMission(encodeMission({ startLmst: 13, stops: demoStops }))!, site);
    const after = planRoute(site, cost, site.habitat, restored);
    expect(after.distM).toBe(before.distM);
    expect(after.totalSec).toBe(before.totalSec);
    expect(after.marginSec).toBe(before.marginSec);
    expect(after.status).toBe(before.status);
    // Stops on the site's points of interest get their id, note and photo back.
    expect(restored.map((s) => s.id)).toEqual(demoStops.map((s) => s.id));
    expect(restored[0].photo).toBe(site.pois.find((p) => p.id === demoStops[0].id)!.photo);
    expect(restored[0].why).toBe(site.pois.find((p) => p.id === demoStops[0].id)!.note);
  });

  it("keeps awkward names, fractional minutes, a custom place and another start time", () => {
    const encoded = encodeMission({ startLmst: 9.5, stops: [custom, demoStops[1]] });
    expect(encoded).not.toMatch(/[\s#?&]/); // safe inside a hash, after "m="
    const decoded = decodeMission(encoded)!;
    expect(decoded.startLmst).toBe(9.5);
    expect(decoded.stops[0]).toEqual({ lat: 18.45679, lng: 77.40123, dwellMin: 12.5, label: custom.label });
    const restored = stopsFromLink(decoded, site);
    expect(restored[0].id).toBe("link-1"); // not on a point of interest
    expect(restored[1].id).toBe(demoStops[1].id);
    // Positions keep 5 decimals: well under a metre.
    expect(Math.abs(decoded.stops[0].lat - custom.lat)).toBeLessThan(0.00001);
  });

  it("an empty plan has no link text, and the Plan hash is then just #plan", () => {
    expect(encodeMission({ startLmst: 13, stops: [] })).toBe("");
    expect(planHashFor({ startLmst: 13, stops: [] })).toBe("#plan");
    const hash = planHashFor({ startLmst: 13, stops: demoStops });
    expect(hash.startsWith("#plan?m=1;13;")).toBe(true);
    expect(missionParamOf(hash)).toBe(encodeMission({ startLmst: 13, stops: demoStops }));
    expect(missionParamOf("#plan")).toBeNull();
    expect(missionParamOf("#plan?x=1")).toBeNull();
    expect(missionParamOf("")).toBeNull();
    expect(missionParamOf(undefined)).toBeNull();
  });

  it("two visits to the same place still get two different ids", () => {
    const twice = stopsFromLink(decodeMission(encodeMission({ startLmst: 13, stops: [demoStops[0], demoStops[1], demoStops[0]] }))!, site);
    expect(new Set(twice.map((s) => s.id)).size).toBe(3);
  });

  it("bad dwell times are stored as zero, and very long plans are cut at the limit", () => {
    const odd = decodeMission(encodeMission({ startLmst: 13, stops: [{ ...custom, dwellMin: NaN }, { ...custom, dwellMin: -5 }] }))!;
    expect(odd.stops.map((s) => s.dwellMin)).toEqual([0, 0]);
    const many = Array.from({ length: MAX_LINK_STOPS + 10 }, () => demoStops[0]);
    expect(decodeMission(encodeMission({ startLmst: 13, stops: many }))!.stops).toHaveLength(MAX_LINK_STOPS);
  });
});

describe("mission link: a bad link does not crash", () => {
  const good = encodeMission({ startLmst: 13, stops: demoStops });
  const bad: [string, unknown][] = [
    ["nothing", ""],
    ["null", null],
    ["undefined", undefined],
    ["a number", 42],
    ["garbage", "hello world"],
    ["an old or unknown version", good.replace(/^1;/, "0;")],
    ["a newer version", good.replace(/^1;/, "2;")],
    ["no stops", "1;13"],
    ["no start time", "1;;18.4,77.4,30,A"],
    ["a start time that is not a time", "1;25;18.4,77.4,30,A"],
    ["a stop with a missing part", "1;13;18.4,77.4,30"],
    ["a stop with too many parts", "1;13;18.4,77.4,30,A,B"],
    ["a position that is not a number", "1;13;abc,77.4,30,A"],
    ["an empty position", "1;13;,77.4,30,A"],
    ["a latitude off the planet", "1;13;120,77.4,30,A"],
    ["a negative science time", "1;13;18.4,77.4,-5,A"],
    ["Infinity", "1;13;18.4,77.4,Infinity,A"],
    ["a broken percent-escape", "1;13;18.4,77.4,30,%E0%A4%A"],
    ["too many stops", `1;13;${Array.from({ length: MAX_LINK_STOPS + 1 }, () => "18.4,77.4,30,A").join(";")}`],
    ["an enormous link", `1;13;18.4,77.4,30,${"A".repeat(7000)}`],
    ["an object", {}],
  ];
  it.each(bad)("%s gives no mission, and no error", (_name, value) => {
    expect(() => decodeMission(value as string)).not.toThrow();
    expect(decodeMission(value as string)).toBeNull();
  });

  it("a link to somewhere off the map still decodes; the planner then explains the problem instead of crashing", () => {
    const far = decodeMission("1;13;10,20,30,Far%20away")!;
    const stops = stopsFromLink(far, site);
    const plan = planRoute(site, buildCostGrid(site, { storm: false, spe: false, startLmst: 13 }), site.habitat, stops);
    expect(plan.status).toBe("NO-GO");
    expect(plan.reasons.join(" ")).toContain("outside the mapped area");
  });

  it("random text never throws", () => {
    let seed = 7;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
    const alphabet = "0123456789;,.%-+eE~ aZ?=&#";
    for (let i = 0; i < 2000; i++) {
      let text = "1;13;";
      const length = next() % 60;
      for (let k = 0; k < length; k++) text += alphabet[next() % alphabet.length];
      expect(() => decodeMission(text)).not.toThrow();
      const decoded = decodeMission(text);
      if (decoded) for (const s of decoded.stops) expect([s.lat, s.lng, s.dwellMin].every(Number.isFinite)).toBe(true);
    }
  });
});

describe("mission link: in the app", () => {
  it("the tab router still treats a mission link as the Plan tab", () => {
    expect(tabFromHash(planHashFor({ startLmst: 13, stops: demoStops }))).toBe("plan");
    expect(tabFromHash("#plan?m=nonsense")).toBe("plan");
    expect(tabFromHash("#plan?")).toBe("plan");
    expect(tabFromHash("#science?m=1")).toBe("science");
    expect(tabFromHash("#plan")).toBe("plan");
    expect(tabFromHash("#nope?m=1", "story")).toBe("story");
  });

  it("the address follows the plan with replaceState, a link is restored once the terrain has loaded, and Copy link says Copied for 2 s", () => {
    const app = read("../App.tsx");
    expect(app).toContain("window.history.replaceState(null, \"\", `${window.location.pathname}${window.location.search}${planHash}`);"); // no history spam
    expect(app).not.toMatch(/history\.pushState/);
    expect(app).toMatch(/const mission = decodeMission\(param\);\s*if \(!mission\) return;/); // a bad link restores nothing
    expect(app).toMatch(/m\.edit\(stopsFromLink\(mission, m\.site\)\);\s*m\.setConditions\(\(c\) => \(\{ \.\.\.c, startLmst: mission\.startLmst \}\)\);/);
    expect(app).toMatch(/if \(!m\.site \|\| linkReady\) return;\s*restoreFromHash\(\);\s*setLinkReady\(true\);/);
    expect(app).toContain('{linkCopied ? "Copied" : "Copy link"}');
    expect(app).toMatch(/window\.setTimeout\(\(\) => setLinkCopied\(false\), 2000\)/);
    const more = app.slice(app.indexOf('<div className="plan-share">'), app.indexOf("</div>", app.indexOf('<div className="plan-share">')));
    expect(more.indexOf("Download briefing")).toBeLessThan(more.indexOf("Copy link")); // next to Download briefing
  });
});
