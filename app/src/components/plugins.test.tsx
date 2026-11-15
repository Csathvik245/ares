// Render checks for the plug-in components, on the real site.json.
// They render to an HTML string (no browser needed) and look for what must be there.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildCostGrid, loadSite, planRoute } from "../planner";
import type { Stop } from "../planner";
import { ORBITAL_ZOOM, orbitalCrop } from "../lib/orbitalCrop";
import { PHOTO_CREDITS, photoCreditFor } from "../lib/photoCredits";
import { elevationProfile, profileDistanceAt } from "../lib/profile";
import { ElevationProfile } from "./ElevationProfile";
import { StopCard, tPlus } from "./StopCard";

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const site = loadSite(read("../../public/data/site.json"));
const basemapJson = read("../../public/data/basemap.json");
const basemap = { url: "/data/basemap.png", bounds: basemapJson.bounds, credit: basemapJson.credit };
const cost = buildCostGrid(site, { storm: false, spe: false, startLmst: 13 });
const stops: Stop[] = site.pois
  .filter((p) => p.kind === "science")
  .slice(0, 3)
  .map((p) => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin: 30 }));
const plan = planRoute(site, cost, site.habitat, stops);
const poiOf = (id: string) => site.pois.find((p) => p.id === id)!;

describe("ElevationProfile", () => {
  it("draws the line, a marker and label per stop, and the min/max labels", () => {
    const html = renderToStaticMarkup(<ElevationProfile site={site} plan={plan} />);
    const profile = elevationProfile(site, plan);
    expect(html).toContain("elevation-profile__line");
    expect(html).toContain("elevation-profile__fill");
    expect(html.match(/class="elevation-profile__stop"/g)).toHaveLength(3);
    for (const label of ["01", "02", "03"]) expect(html).toContain(`>${label}</span>`);
    expect(html).toContain(`−${Math.abs(Math.round(profile.minElevM)).toLocaleString("en-US")} m`);
    expect(html).toContain(`−${Math.abs(Math.round(profile.maxElevM)).toLocaleString("en-US")} m`);
    expect(html).toContain('role="img"');
    expect(html).toMatch(/aria-label="Elevation profile of the planned walk: \d\.\d\d km/);
    expect(html).not.toContain("elevation-profile__cursor"); // no time given, no cursor
  });

  it("puts the cyan cursor where positionAt says the astronaut is", () => {
    const tSec = plan.legs[1].arriveSec - plan.legs[1].walkSec / 2; // halfway along leg 2
    const html = renderToStaticMarkup(<ElevationProfile site={site} plan={plan} currentTSec={tSec} />);
    const profile = elevationProfile(site, plan);
    const expectedX = (profileDistanceAt(plan, profile, tSec) / profile.totalM) * 1000;
    const x1 = Number(/elevation-profile__cursor" x1="([\d.]+)"/.exec(html)![1]);
    expect(x1).toBeCloseTo(expectedX, 6);
    expect(expectedX).toBeGreaterThan((profile.legStartM[1] / profile.totalM) * 1000);
    expect(expectedX).toBeLessThan((profile.legStartM[2] / profile.totalM) * 1000);
  });

  it("shows a plain message for a plan with no route", () => {
    const html = renderToStaticMarkup(
      <ElevationProfile site={site} plan={planRoute(site, cost, site.habitat, [])} currentTSec={0} />,
    );
    expect(html).toContain("no route yet");
    expect(html).not.toContain("<svg");
  });
});

describe("StopCard", () => {
  it("shows a rover stop with its photo, credit, camera and sol", () => {
    const html = renderToStaticMarkup(
      <StopCard stop={stops[0]} index={0} poi={poiOf("seitah-brac")} arriveSec={plan.legs[0].arriveSec} onClose={() => {}} />,
    );
    expect(html).toContain(">01<");
    expect(html).toContain("Séítah outcrop (Brac)");
    expect(html).toContain(poiOf("seitah-brac").note!.slice(0, 40));
    expect(html).toContain('src="/photos/seitah-brac.jpg"');
    expect(html).toContain('alt="Perseverance at this sampling site"');
    expect(html).toContain("NASA/JPL-Caltech");
    expect(html).toContain("Front Left Hazcam");
    expect(html).toContain(">262<");
    expect(html).toContain("30 min");
    expect(html).toContain(tPlus(plan.legs[0].arriveSec));
    expect(html).toMatch(/<button type="button"[^>]*aria-label="Close Séítah outcrop \(Brac\)"/);
    expect(html).not.toContain("orbital view");
  });

  it("shows the delta front toe with a HiRISE crop and no rover photo", () => {
    const html = renderToStaticMarkup(
      <StopCard stop={stops[1]} index={1} poi={poiOf("delta-toe")} arriveSec={plan.legs[1].arriveSec} basemap={basemap} />,
    );
    const crop = orbitalCrop(stops[1], basemapJson.bounds);
    expect(html).toContain(">02<");
    expect(html).toContain("No rover visit · orbital view");
    expect(html).not.toContain("<img");
    expect(html).toContain("/data/basemap.png");
    expect(html).toContain(`background-position:${crop.backgroundPosition}`);
    expect(html).toContain(`background-size:${crop.backgroundSize}`);
    expect(html).toMatch(/role="img" aria-label="HiRISE orbital image of the ground around Delta front toe/);
    expect(html).toContain("NASA/JPL-Caltech/University of Arizona/USGS");
    expect(html).not.toContain("<button"); // no onClose given, so no close button
  });

  it("works for a stop that is not a POI", () => {
    const custom: Stop = { id: "x", label: "Science stop 4", lat: 18.45, lng: 77.43, dwellMin: 15 };
    const html = renderToStaticMarkup(<StopCard stop={custom} index={3} arriveSec={7200} basemap={basemap} />);
    expect(html).toContain(">04<");
    expect(html).toContain("T+2:00");
    expect(html).toContain("15 min");
    expect(html).toContain("No science note is recorded");
  });

  it("formats arrival time as T+h:mm", () => {
    expect(tPlus(0)).toBe("T+0:00");
    expect(tPlus(21 * 60 + 20)).toBe("T+0:21");
    expect(tPlus(3 * 3600 + 35 * 60)).toBe("T+3:35");
    expect(tPlus(Infinity)).toBe("—");
  });
});

describe("orbitalCrop", () => {
  const b = basemapJson.bounds;
  it("centres a point in the middle of the map", () => {
    const mid = { lat: (b.north + b.south) / 2, lng: (b.east + b.west) / 2 };
    const crop = orbitalCrop(mid, b);
    expect(crop.backgroundPosition).toBe("50.00% 50.00%");
    expect(crop.backgroundSize).toBe(`${ORBITAL_ZOOM * 100}% ${ORBITAL_ZOOM * 100}%`);
    expect(crop.marker.x).toBeCloseTo(0.5, 9);
    expect(crop.marker.y).toBeCloseTo(0.5, 9);
    // The site is about 7.9 km wide, so one sixth of it is about 1.3 km.
    expect(crop.widthM).toBeGreaterThan(1200);
    expect(crop.widthM).toBeLessThan(1400);
  });

  it("centres the delta front toe: north-west of the middle", () => {
    const crop = orbitalCrop(stops[1], b);
    const [px, py] = crop.backgroundPosition.split(" ").map(parseFloat);
    expect(px).toBeLessThan(50); // west of centre
    expect(py).toBeLessThan(50); // north of centre (row 0 = north)
    expect(crop.marker.x).toBeCloseTo(0.5, 6);
    expect(crop.marker.y).toBeCloseTo(0.5, 6);
  });

  it("never shows past the edge: a corner point keeps the crop inside and moves the marker", () => {
    const crop = orbitalCrop({ lat: b.north, lng: b.west }, b);
    expect(crop.backgroundPosition).toBe("0.00% 0.00%");
    expect(crop.marker).toEqual({ x: 0, y: 0 });
    const far = orbitalCrop({ lat: b.south, lng: b.east }, b);
    expect(far.backgroundPosition).toBe("100.00% 100.00%");
    expect(far.marker.x).toBeCloseTo(1, 9);
  });
});

describe("photo credits", () => {
  it("has a camera, sol and NASA link for every photo in site.json, and the file exists", () => {
    const withPhoto = site.pois.filter((p) => p.photo);
    expect(withPhoto).toHaveLength(7);
    expect(Object.keys(PHOTO_CREDITS).sort()).toEqual(withPhoto.map((p) => p.photo!).sort());
    for (const poi of withPhoto) {
      const credit = photoCreditFor(poi.photo)!;
      expect(credit.sourceUrl).toBe(`https://mars.nasa.gov/mars2020/multimedia/raw-images/${credit.imageId}`);
      // The sol is written into NASA's image ID (e.g. FLF_0262_...).
      expect(Number(credit.imageId.split("_")[1])).toBe(credit.sol);
      expect(poi.photoCredit).toBe("NASA/JPL-Caltech");
      expect(existsSync(fileURLToPath(new URL(`../../public/${poi.photo}`, import.meta.url))), poi.photo).toBe(true);
    }
    expect(photoCreditFor(undefined)).toBeUndefined();
    expect(photoCreditFor("photos/unknown.jpg")).toBeUndefined();
  });
});
