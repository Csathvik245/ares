import { expect, it } from "vitest";
import { optionalJson } from "./data";
it("ignores the HTTP 200 HTML fallback for a missing optional file", async () => {
  expect(
    await optionalJson(
      new Response("<!doctype html><html></html>", {
        headers: { "content-type": "text/html" },
      }),
    ),
  ).toBeNull();
});
it("ignores malformed and missing optional JSON", async () => {
  expect(
    await optionalJson(
      new Response("{broken", {
        headers: { "content-type": "application/json" },
      }),
    ),
  ).toBeNull();
  expect(await optionalJson(new Response("", { status: 404 }))).toBeNull();
  expect(await optionalJson(null)).toBeNull();
});
it("loads valid optional JSON", async () => {
  expect(await optionalJson(Response.json([{ id: "clay-1" }]))).toEqual([
    { id: "clay-1" },
  ]);
});

import { readDemoStops } from "./data";
it("rejects invalid stop records and duplicate ids without throwing", () => {
  expect(readDemoStops([null])).toBeNull();
  const stop = {
    id: "one",
    label: "One",
    lat: 18.45,
    lng: 77.45,
    dwellMin: 30,
  };
  expect(readDemoStops([stop, stop])).toBeNull();
  expect(readDemoStops([{ ...stop, dwellMin: -1 }])).toBeNull();
  expect(readDemoStops([{ ...stop, tools: "hammer", photo: 42 }])).toEqual([
    {
      ...stop,
      tools: undefined,
      photo: undefined,
      why: undefined,
      photoCredit: undefined,
    },
  ]);
});
