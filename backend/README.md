> **Experimental, not enabled in the submitted app (team decision, Nov 14). Do not deploy the backend or mount ChatPanel.**

# backend/ — ARES assistant API

One Vercel serverless function, `api/assistant.ts`. It lets the in-app assistant talk to the model.

**The assistant explains plans. It never decides.** Routes, oxygen numbers and the GO / CAUTION / NO-GO status come only from the planner in the browser. This server does no planner maths: it passes the conversation to the model and passes the model's tool requests back to the browser, which runs them on the local planner.

## How one question flows

1. The browser sends `{ messages, planSummary }` to `POST /api/assistant`.
2. The server calls the model (`claude-opus-5-5`) with the system prompt (`lib/prompt.ts`) and the nine tool descriptions (`lib/tools.ts`: the seven Contract 5 tools plus `score_stops` and `suggest_stops`).
3. The model either answers, or asks for tools. The server returns that turn unchanged.
4. If tools were asked for, **the browser runs them** (`app/src/ai/tools.ts`) and sends the results back in a new request. Repeat until the model answers in words.

`GET /api/assistant` returns `{ online, model }`: whether an API key is configured.

## The API key

- It is read from the **`ANTHROPIC_API_KEY` environment variable only**. It is never in the repo, never in the frontend, never logged.
- On Vercel: Project → Settings → Environment Variables → add `ANTHROPIC_API_KEY`. Do not prefix it with `VITE_` (that would publish it to the browser).
- With no key, the function answers 503 `{ offline: true }` and the panel shows "Assistant offline". The app works normally.

## Deploy

The app and this function are **two Vercel projects** from the same repo, because the app's project root is `app/`.

1. Create a second Vercel project from this repo with **Root Directory = `backend`**. No build command and no output directory are needed.
2. Add `ANTHROPIC_API_KEY` to that project's environment variables.
3. Optional: set `ALLOWED_ORIGINS` to a comma-separated list of the origins allowed to call it. The default is `https://ares-mission-console.vercel.app` plus the local dev servers (`http://localhost:5173`, `http://localhost:4173`).
4. In the **app** project, set `VITE_ASSISTANT_URL` to the function's address, for example `https://<backend-project>.vercel.app/api/assistant`, and redeploy the app. This is a public address, not a secret.

For local development: run `npx vercel dev` in this folder with `ANTHROPIC_API_KEY` set in the shell, and set `VITE_ASSISTANT_URL=http://localhost:3000/api/assistant` for the app.

## Try it without the UI

```bash
cd backend
npm ci
npm run try:dry     # no key needed: prints the planner facts for the three demo questions
npm run try         # needs ANTHROPIC_API_KEY in the shell: asks the model the three demo questions
```

The three questions are "Why this route?", "Can I add another clay stop?" and "What if a dust storm hits at stop 2?". `try.ts` uses the same tool executor and loop as the app and calls the same request handler, on the real `site.json`.

## Limits to know about

- **No rate limiting.** The function checks the calling origin, the request size and the conversation length, but an allowed page can call it as often as it likes, and a request with no `Origin` header (for example from `curl`) is not blocked. Set a spending limit on the API key before sharing the live link.
- The function allows up to 60 seconds per request (`vercel.json`). Check that the team's Vercel plan allows that.
- **Not yet run against the live model.** There was no API key where this was built. See "Not checked" in `app/src/ai/README.md`.
