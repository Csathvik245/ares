import { expect, it } from "vitest";
import { publicAssetUrl } from "./assets";
it("requests only files included in the deployment", () => {
  const files = ["data/stops.json", "photos/clay.jpg"];
  expect(publicAssetUrl("/photos/clay.jpg", files)).toBe("/photos/clay.jpg");
  expect(publicAssetUrl("photos/missing.jpg", files)).toBeUndefined();
  expect(publicAssetUrl(undefined, files)).toBeUndefined();
});
