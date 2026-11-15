> **Experimental, not enabled in the submitted app (team decision, Nov 14). Do not deploy the backend or mount ChatPanel.**

# app/src/ai/ — ARES assistant (browser side)

The assistant **explains** the plan and **never decides**. It can only call tools, and every tool is a call to the local planner. Server side and deployment: `backend/README.md`.

| File | What it is |
|---|---|
| `tools.ts` | Runs the nine tools on the local planner. Edits change a draft only. |
| `assistantLoop.ts` | The tool loop: send, run requested tools, send results, repeat. No React. |
| `useAssistant.ts` | React hook around the loop: conversation, status, proposal. |
| `ChatPanel.experimental.tsx` + `chat.css` | The panel. Props: `plan`, `onApplyStops`. Named so the app does not pick it up. |
| `assistant.test.ts` | Tools and loop tested on the real `site.json` with a scripted model. |

## Mounting it

**It is not mounted, on purpose.** `components/AssistantIntegration.tsx` looks for a file named exactly `ai/ChatPanel.tsx` and shows an Assistant button when it finds one. The panel is therefore kept as `ChatPanel.experimental.tsx`, which that lookup does not match, so the app has no Assistant button and its build contains none of this folder.

If the team later decides to enable it: rename the file back to `ChatPanel.tsx` (the header button then appears by itself), or mount it by hand anywhere inside `<MissionProvider>`:

```tsx
import { ChatPanel } from "./ai/ChatPanel.experimental";
```

```tsx
<ChatPanel plan={plan} onApplyStops={(stops) => m.edit(stops)} />
```

- `plan` is the astronaut's current plan. Its status and first reason are always shown above the chat.
- `onApplyStops` is called with the proposed stops when the astronaut presses **Apply to plan**. Leave it out and the panel calls the mission state's own `edit()`.
- The panel reads the site, the current stops and the start time from the mission context, so it must be inside `<MissionProvider>`.

## Turning it on

Set `VITE_ASSISTANT_URL` in the app's environment to the assistant function's address (see `backend/README.md`) and rebuild. It is a public address, not a secret. **Never put the API key in a `VITE_` variable.**

Without `VITE_ASSISTANT_URL`, or when the server has no API key, the panel shows **Assistant offline**, makes no requests, and the rest of the app works as normal.

## How a change reaches the plan

`add_stop`, `remove_stop` and `reorder_stops` change a draft copy of the stops. After the answer, the panel shows "PROPOSED STOPS · NOT APPLIED" with the planner's status for the draft and two buttons: **Apply to plan** and **Dismiss**. Nothing changes until the astronaut applies it.

## Not checked

- **No live model run.** There was no API key where this was built, so the three demo questions have not been answered by the real model yet. Run `npm run try` in `backend/` with the team's key and read the answers before the video.
- **Not seen in a browser.** The loop and tools are tested; the panel's layout is not. Open it once at 1440 × 900.
