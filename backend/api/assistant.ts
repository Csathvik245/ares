// Vercel serverless function: POST /api/assistant
//
//   GET  /api/assistant            -> { online: boolean, model }   (is an API key configured?)
//   POST /api/assistant            -> one model turn (see lib/assistant-core.ts)
//        body: { messages, planSummary }
//
// The API key lives ONLY in the ANTHROPIC_API_KEY environment variable of this
// Vercel project. It is never in the repo and never reaches the browser.
//
// The app and this function are separate Vercel projects (the app's root is /app,
// this one's is /backend), so the browser calls it from another origin and needs
// the CORS headers below. ALLOWED_ORIGINS is a comma-separated list of origins that
// may call it; it defaults to the production app and local dev servers.

import type { IncomingMessage, ServerResponse } from "node:http";
import { assistantOnline, handleAssistant, MODEL } from "../lib/assistant-core";

const DEFAULT_ORIGINS = "https://ares-mission-console.vercel.app,http://localhost:5173,http://localhost:4173";
/** Largest request body accepted, bytes. */
const MAX_BODY_BYTES = 500_000;

function allowedOrigin(origin: string | undefined): string | null {
  if (!origin) return null;
  const allowed = (process.env.ALLOWED_ORIGINS ?? DEFAULT_ORIGINS).split(",").map((o) => o.trim());
  return allowed.includes(origin) ? origin : null;
}

/** Vercel parses JSON bodies onto req.body; elsewhere (plain Node) read the stream. */
async function readBody(req: IncomingMessage & { body?: unknown }): Promise<unknown> {
  if (req.body !== undefined) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error("too large");
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  const origin = allowedOrigin(req.headers.origin);
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method === "GET") {
    send(res, 200, { online: assistantOnline(), model: MODEL });
    return;
  }
  if (req.method !== "POST") {
    send(res, 405, { ok: false, error: "Use POST." });
    return;
  }
  // A browser on a page we don't know gets no answer (and so spends no API credit).
  if (req.headers.origin && !origin) {
    send(res, 403, { ok: false, error: "This origin may not use the assistant." });
    return;
  }
  let body: unknown;
  try {
    body = await readBody(req);
  } catch {
    send(res, 400, { ok: false, error: "Request body must be JSON." });
    return;
  }
  const reply = await handleAssistant(body);
  send(res, reply.ok ? 200 : reply.status, reply);
}
