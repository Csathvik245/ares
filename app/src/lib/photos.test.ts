import { readFileSync, existsSync } from "node:fs";
import { it, expect } from "vitest";
import { PHOTO_CREDITS, photoCreditFor } from "./photoCredits";
it("supplies credits and NASA source links for every supplied rover photo", () => {
  const site = JSON.parse(
    readFileSync(
      new URL("../../public/data/site.json", import.meta.url),
      "utf8",
    ),
  );
  for (const poi of site.pois.filter((p: { photo?: string }) => p.photo)) {
    const entry = photoCreditFor(poi.photo)!;
    expect(new URL(entry.sourceUrl).hostname).toBe("mars.nasa.gov");
    expect(entry.sourceUrl.endsWith(entry.imageId)).toBe(true);
    const path = new URL(`../../public/${poi.photo}`, import.meta.url);
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path).subarray(0, 3)).toEqual(
      Buffer.from([255, 216, 255]),
    );
  }
  expect(Object.keys(PHOTO_CREDITS)).toHaveLength(7);
  expect(photoCreditFor("photos/delta-toe.jpg")).toBeUndefined();
  expect(photoCreditFor("../other.jpg")).toBeUndefined();
});
