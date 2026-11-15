import { readFileSync, existsSync } from "node:fs";
import { it, expect } from "vitest";
import credits from "../../public/photos/credits.json";
import { photoDetails } from "./photos";
it("supplies credits and NASA source links for every supplied rover photo", () => {
  const site = JSON.parse(
    readFileSync(
      new URL("../../public/data/site.json", import.meta.url),
      "utf8",
    ),
  );
  for (const poi of site.pois.filter((p: { photo?: string }) => p.photo)) {
    const entry = photoDetails(poi.photo)!;
    expect(entry.credit).toBe("NASA/JPL-Caltech");
    expect(new URL(entry.sourceUrl).hostname).toBe("mars.nasa.gov");
    expect(entry.sourceUrl.endsWith(entry.imageId)).toBe(true);
    const path = new URL(`../../public/${poi.photo}`, import.meta.url);
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path).subarray(0, 3)).toEqual(
      Buffer.from([255, 216, 255]),
    );
  }
  expect(Object.keys(credits)).toHaveLength(7);
  expect(photoDetails("photos/delta-toe.jpg")).toBeUndefined();
  expect(photoDetails("../other.jpg")).toBeUndefined();
});
