# app/src/ai/ — ARES assistant (browser side)

The assistant **explains** the plan and **never decides**. It can only call tools, and every tool is a call to the local planner. Server side and deployment: `backend/README.md`.

| File | What it is |
|---|---|
| `tools.ts` | Runs the nine tools on the local planner. Edits change a draft only. |
| `assistantLoop.ts` | The tool loop: send, run requested tools, send results, repeat. No React. |
| `useAssistant.ts` | React hook around the loop: conversation, status, proposal. |
| `ChatPanel.tsx` + `chat.css` | The panel. Props: `plan`, `onApplyStops`. |
| `assistant.test.ts` | Tools and loop tested on the real `site.json` with a scripted model. |

## Mounting it

**It is already mounted.** `components/AssistantIntegration.tsx` looks for `ai/ChatPanel.tsx`, and now that the file exists the header shows an **Assistant** button that opens the panel in the existing dialog. No edit to `App.tsx` is needed.

To mount it somewhere else (for example as a rail or a tab), it is one import and one line, anywhere inside `<MissionProvider>`:

```tsx
import { ChatPanel } from "./ai/ChatPanel";
```

```tsx
<ChatPanel plan={plan} onApplyStops={(stops) => m.edit(stops)} />
```

- `plan` is the astronaut's current plan. Its status and first reason are always shown above the chat.
- `onApplyStops` is called with the proposed stops when the astronaut presses **Apply to plan**. Leave it out and the panel calls the mission state's own `edit()`. (`AssistantIntegration` passes `onToolCall` instead, which the panel ignores.)
- The panel reads the site, the current stops and the start time from the mission context, so it must be inside `<MissionProvider>`.

## Turning it on

Set `VITE_ASSISTANT_URL` in the app's environment to the assistant function's address (see `backend/README.md`) and rebuild. It is a public address, not a secret. **Never put the API key in a `VITE_` variable.**

Without `VITE_ASSISTANT_URL`, or when the server has no API key, the panel shows **Assistant offline**, makes no requests, and the rest of the app works as normal.

## How a change reaches the plan

`add_stop`, `remove_stop` and `reorder_stops` change a draft copy of the stops. After the answer, the panel shows "PROPOSED STOPS · NOT APPLIED" with the planner's status for the draft and two buttons: **Apply to plan** and **Dismiss**. Nothing changes until the astronaut applies it.

## Not checked

- **No live model run.** There was no API key where this was built, so the three demo questions have not been answered by the real model yet. Run `npm run try` in `backend/` with the team's key and read the answers before the video.
- **Not seen in a browser.** The loop and tools are tested; the panel's layout is not. Open it once at 1440 × 900.
