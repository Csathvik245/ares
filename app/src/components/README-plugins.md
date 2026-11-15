# Plug-in pieces for the console

Three standalone pieces for the frontend lead to plug in. Each one is new files only: nothing in `App.tsx`, `MissionMap.tsx`, `MissionPanel.tsx`, `FlightTimeline.tsx` or the existing CSS was changed. Each needs one import line and one usage line.

The components bring their own styles (`components/plugins.css`, imported by the components themselves) and use only the Contract 6 tokens.

## 1. Safe-zone clean-up

Removes specks and pin-holes smaller than 12 cells (about 0.75 ha) from the safe-zone mask before it is drawn. Takes about 4 ms on the real grid.

```ts
import { removeSmallIslands } from "../lib/zoneCleanup";
```

In `MissionMap.tsx`, where the zone is drawn (or in `App.tsx`, where `zone={m.zone}` is passed):

```tsx
zone={removeSmallIslands(m.zone, site.width, site.height)}
```

- Wrap it in `useMemo(..., [m.zone, site])` so it runs once per plan, not on every playback tick.
- An empty mask (the app passes one during an emergency) comes back empty.
- **Drawing only.** Filling a pin-hole can mark a few no-go cells as inside. Keep using the planner's own `m.zone` for any yes/no answer.

## 2. Elevation profile

A 70 px tall strip: orange elevation line for the whole walk, dashed markers labelled 01 / 02 / 03 at the stops, lowest and highest elevation, and a cyan cursor at the playback time.

```tsx
import { ElevationProfile } from "./components/ElevationProfile";
```

In `App.tsx` under the map (or in `FlightTimeline.tsx` with `m.site!` and `m.plan!`):

```tsx
<ElevationProfile site={site} plan={plan} currentTSec={m.elapsed} />
```

- Leave `currentTSec` out for a profile with no cursor.
- With no stops it shows one line of text instead of a chart.
- Distance is measured along the drawn route (4.68 km for the demo mission), which is a little shorter than the planner's grid-path distance (4.97 km). The strip shows no distance numbers, so the two never appear side by side.
- The pure helper is `elevationProfile(site, plan)` in `lib/profile.ts`.

## 3. Stop card

Stop number, name, why it matters, arrival time (T+h:mm), science time, and the ground view. Rover stops show the Perseverance photo with "NASA/JPL-Caltech", camera and sol. A stop no rover visited (the delta front toe) shows a HiRISE crop of the spot labelled "No rover visit · orbital view".

```tsx
import { StopCard as StopDetailCard } from "./components/StopCard";
```

In `App.tsx`, in place of the current `{selected && <StopCard … />}` block (`selected` is the stop being viewed):

```tsx
{selected && <div className="detail-backdrop"><StopDetailCard stop={selected} index={m.stops.indexOf(selected)} poi={site.pois.find((p) => p.id === selected.id)} arriveSec={plan.legs[m.stops.indexOf(selected)]?.arriveSec ?? NaN} basemap={m.basemap} onClose={() => setDetail("")} /></div>}
```

- It is imported under another name because `App.tsx` already imports a `StopCard` from `DesignIntegration`.
- The card is a plain panel with its own Close button. It does not trap focus. To keep the focus trap and Escape handling, put it inside the existing `<Dialog>` and leave `onClose` off the card, so there is only one close button.
- `basemap` is optional. Without it the card reads `/data/basemap.json` itself.
- `poi` is optional. A stop clicked on the map (not a POI) shows the orbital view and a short "no science note" line.
- Camera and sol come from `lib/photoCredits.ts`. Add a line there when a photo is added.

## 4. Science per oxygen-minute

Planner functions in `planner/science.ts`. They are not exported from `planner/index.ts` yet (the backend owner adds the exports), so import from the file for now.

```ts
import { scienceScore, suggestStops } from "../planner/science";
```

**Score per stop card** (stop list in the mission panel, or the stop detail card). One entry per stop, in order: `{ id, science, extraO2Min, score }`.

```ts
const scores = scienceScore(site, plan, { stops: m.stops, cost });
```

- `science` is the mean science value (0 to 1) within 50 m of the stop. It is a relative CRISM index, not a mineral abundance.
- `extraO2Min` is the oxygen the stop adds: the walking detour compared with skipping it, plus its science time.
- `score` = `science / extraO2Min`. It is a small number (0.004 to 0.005 for the demo stops), so show it per oxygen-hour (`score * 60`, about 0.23 to 0.31) or show the two parts side by side ("science 0.54 · 131 O2-min").
- Demo mission: the delta front toe has by far the highest science (0.54) but costs the most oxygen; Sid scores best per minute because it is almost on the way home.

**"Suggest stops" button** (mission panel, next to "Load demo mission"). Up to 3 stops that keep the plan GO, best score first. About 100 ms the first time, about 35 ms after.

```ts
const ideas = suggestStops(site, site.habitat, m.stops, 3, { startLmst: m.conditions.startLmst });
```

To add one where it is cheapest: `const next = [...m.stops]; next.splice(idea.insertAt, 0, idea); m.edit(next);`

- Each idea is a full `Stop` plus `science`, `extraO2Min`, `score`, `insertAt` and `marginMin` (the margin after adding it).
- Each idea is checked on its own. After adding one, call `suggestStops` again rather than adding a second from the old list.
- It returns `[]` when the current plan is not GO, and during a storm or solar event.
- The suggested spots are picked from orbital CRISM data only. Label them as suggestions: the planner suggests, the astronaut decides.

## 5. Planner worker client

Runs the planner in a Web Worker so the map and playback never wait for it. The worker (`planner/worker.ts`) loads `site.json` once; `lib/plannerClient.ts` is the typed promise API. **Not wired into the UI yet.** It is for replacing the direct planner calls in `MissionContext.tsx` (`planRoute`, `safeZone`, `abortRoute`, `positionAt`).

```ts
import { createPlannerClient, isCancelled } from "./plannerClient";
```

```ts
const planner = createPlannerClient(); // once, e.g. in a useRef or at module level
```

Then, in place of the direct calls:

```ts
const plan = await planner.plan(stops, conditions);
const zone = await planner.safeZone();                                   // zone of that plan
const abort = await planner.abort(from, oxygenUsedSec, { ...conditions, storm: true });
const here = await planner.positionAt(tSec);
const ideas = await planner.suggestStops(3);
const walkHomeSec = await planner.walkHome();                            // Float32Array, for the cursor probe
```

- **Latest wins.** A newer call of the same kind makes the older one reject with `PlannerCancelled`, and a new `plan()` also cancels pending `safeZone()`, `positionAt()`, `suggestStops()` and `walkHome()`. In an effect: `planner.plan(stops, conditions).then(setPlan).catch((e) => { if (!isCancelled(e)) throw e; })`.
- `safeZone()`, `positionAt()` and `suggestStops()` use the plan from the last `plan()` call, so call `plan()` first.
- `planner.ready` resolves with the site's name, bounds, size, habitat, POIs and sources. The big layers stay in the worker, so the map still needs its own `site.json` for drawing layers.
- `positionAt` is cheap. During playback, calling the planner's own `positionAt(plan, t)` on the main thread with the plan you already have is simpler than a message per frame.
- Plan + zone through the client takes about 30 ms in tests (worker code run in-process). Call `planner.close()` when done.

## 6. Radiation shelter (solar particle event)

In a solar particle event, `stormAt` now also checks whether waiting at a nearby spot with less open sky (the foot of a scarp, a crater wall) gives a lower dose than walking straight home. The result is on the outcome you already get from `stormAt`. Nothing changes for a dust storm.

### One line to turn it on

`loadSite` keeps only the five Contract 1 layers, so the sky-view layer has to be read from the same JSON and handed to `stormAt`. Where `site.json` is loaded (`MissionContext.tsx`), keep it next to the site:

```ts
import { readSkyView } from "./planner";
const skyView = readSkyView(json); // Float32Array, or null if the file has no skyView layer
```

and pass it as the new last argument of the existing `stormAt` call:

```ts
const outcome = stormAt(site, plan, incidentAt, kind === "storm" ? "dust" : "spe", conditions.startLmst, { skyView });
```

Until that is done, an SPE gives `outcome.shelter = { checked: false }` and the app behaves exactly as before.

### New fields on the `stormAt` outcome

| Field | What it is |
|---|---|
| `outcome.shelter.checked` | `true` for an SPE with a sky-view layer. `false` for a dust storm, or when no layer was passed. When `false` there are no other shelter fields. |
| `outcome.shelter.betterThanHome` | `true` only if a shelter cuts the dose by at least 5% compared with walking home. |
| `outcome.shelter.target` | `{ lat, lng }` of the shelter, or of the habitat when home is better. |
| `outcome.shelter.path` | Line from the astronaut to `target`. |
| `outcome.shelter.sec` | Walking time to `target`, seconds. |
| `outcome.shelter.skyView` | Open fraction of the sky at the shelter, 0 to 1 (0 when the target is the habitat). |
| `outcome.shelter.doseToShelterMsv` | SPE dose for the recommended option over the assumed 60 min event. Illustrative. |
| `outcome.shelter.doseIfHomeMsv` | SPE dose for walking home over the same time. Illustrative. |
| `outcome.shelter.doseReductionPct` | How much lower the shelter's dose is, percent. 0 when home is better. |
| `outcome.shelter.reasons` | Sentences from the planner. `[0]` is the recommendation; the last two are the caveats. |
| `outcome.shelter.simplified` | Always `true`: the dose model is simplified. |
| `outcome.returnRoute` | `{ to: "home" \| "shelter", path, sec }`: the route to draw as "where to go now". |
| `outcome.abort` | Unchanged: the route **home** from `abortRoute`, with its status. Its `reasons` now also carry the shelter check (see below). |

### Exactly what the UI should show

**When `outcome.shelter.checked` is false** (dust storm, or no layer): nothing new. Draw `outcome.abort.path` in red as now.

**When checked and `betterThanHome` is false** (the demo mission: always):

- Draw the red route home as now (`outcome.returnRoute.path` is the same as `outcome.abort.path`).
- No shelter marker.
- `outcome.abort.reasons` already ends with one extra line, so the Return home reasons list shows it with no extra work: "Shelter checked: walking home is better (best nearby shelter hides 17% of the sky)."

**When checked and `betterThanHome` is true** (for example an SPE at Wildcat Ridge):

- Draw `outcome.returnRoute.path` (the path to the shelter) as the main route, in cyan (cyan = safety), with a cyan shelter marker at `outcome.shelter.target`.
- Keep the route home visible but secondary: `outcome.abort.path` as a thin or dashed red line. The astronaut can still choose it.
- SPE banner, one line, from `outcome.shelter.reasons[0]`: "Shelter 160 m away (sky view 0.84) cuts the SPE dose by 12% compared with walking home (73 min)." Short form if space is tight: `Shelter: ${formatMinutes(outcome.shelter.sec)} away, −${Math.round(outcome.shelter.doseReductionPct)}% dose`.
- Return home reasons: `outcome.abort.reasons` already starts with that same shelter sentence, followed by the usual walk-home reasons.
- Details (optional): `outcome.shelter.reasons[1]` (walk and wait times, the two doses) and `[2]` (the oxygen check for walking home afterwards).
- **Always show the two caveats** next to any shelter number: "Simplified shelter model…" and "The SPE dose rate is illustrative…". They are the last two entries of `outcome.shelter.reasons`. Label dose values "illustrative".

**Statuses do not change.** EVA stays NO-GO. The Return home status (`outcome.abort.status`) is still about the walk home. The shelter is an option the planner offers, not an order.

**Return playback:** `outcome.abort` still leads home, so the existing "Play return to habitat" keeps working as it is. Playing the walk to the shelter is not built.

### Calling it directly

`shelterRoute(site, speCost, position, position.oxygenUsedSec, { skyView })` is exported from `planner/index.ts` for use outside `stormAt`. It returns the same fields plus `bestShelterSkyView`. It throws if no sky-view layer is given. Options: `waitMin` (event length, default 60) and `minReductionPct` (default 5).

## Tests

`npm test` runs `lib/zoneCleanup.test.ts`, `lib/profile.test.ts`, `planner/science.test.ts`, `lib/plannerClient.test.ts` and `components/plugins.test.tsx` (the components are rendered to HTML and checked on the real `site.json`).

## Not checked

The components were tested by rendering them to HTML, not in a browser. Look at them once at 1440 × 900 after plugging in.

The planner worker was tested by running its message handler in-process, with every message passed through `structuredClone`. Vite bundles it as its own chunk, but it has not been run as a real Web Worker in a browser yet.
