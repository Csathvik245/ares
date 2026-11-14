import { expect, it } from 'vitest';
import { optionalJson } from './data';
it('ignores the HTTP 200 HTML fallback for a missing optional file', async () => {
  expect(await optionalJson(new Response('<!doctype html><html></html>', {headers:{'content-type':'text/html'}}))).toBeNull();
});
it('ignores malformed and missing optional JSON', async () => {
  expect(await optionalJson(new Response('{broken', {headers:{'content-type':'application/json'}}))).toBeNull();
  expect(await optionalJson(new Response('', {status:404}))).toBeNull();
  expect(await optionalJson(null)).toBeNull();
});
it('loads valid optional JSON', async () => {
  expect(await optionalJson(Response.json([{id:'clay-1'}]))).toEqual([{id:'clay-1'}]);
});
