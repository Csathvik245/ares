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

Planner function in `planner/shelter.ts`. In a solar particle event it checks whether waiting at a nearby spot with less open sky (the foot of a scarp, a crater wall) gives a lower dose than walking straight home. It is not exported from `planner/index.ts` yet, and `stormAt` does not call it yet (the planner lead adds both), so import from the file for now.

```ts
import { readSkyView, shelterRoute } from "../planner/shelter";
```

Once, where `site.json` is loaded (the sky-view layer is not one of the five layers `loadSite` keeps):

```ts
const skyView = readSkyView(json);
```

When an SPE is triggered, with the SPE cost grid and the astronaut's position from `positionAt`:

```ts
const shelter = skyView ? shelterRoute(site, speCost, position, position.oxygenUsedSec, { skyView }) : null;
```

It returns `{ target, path, sec, skyView, doseToShelterMsv, doseIfHomeMsv, doseReductionPct, betterThanHome, reasons }`.

- **When `betterThanHome` is false**, the target is the habitat and the result is the same advice as the abort route: walk home. Show nothing extra.
- **When it is true**, a suggested way to show it:
  - a cyan shelter marker at `target` (cyan = safety) and `path` drawn as a cyan dashed line, next to the red abort route home;
  - one line in the SPE banner from `reasons[0]`, for example "Shelter 320 m away (sky view 0.71) cuts the SPE dose by 29% compared with walking home (46 min)." A shorter form: `Shelter: ${Math.round(sec / 60)} min away, −${Math.round(doseReductionPct)}% dose`;
  - `reasons[1]` and `reasons[2]` (the walk and wait times, and the oxygen check) in the details.
- **Always show the two caveats** that come at the end of `reasons`: the model is simplified (`SHELTER_MODEL_IS_SIMPLIFIED`) and the SPE dose rate is illustrative (`SPE_IS_ILLUSTRATIVE`). Label the dose numbers "illustrative".
- **It is an option, not an order.** The EVA status stays NO-GO and the return-home status still comes from `abortRoute`. The astronaut chooses between the red route home and the cyan shelter.
- The comparison is over an assumed 60 minute event (`waitMin` option), a shelter must cut the dose by at least 5% to be offered (`minReductionPct` option), and it is only offered if there is oxygen to walk home afterwards.
- It throws if no sky-view layer is given, so keep the `skyView ? … : null` guard.

## Tests

`npm test` runs `lib/zoneCleanup.test.ts`, `lib/profile.test.ts`, `planner/science.test.ts`, `lib/plannerClient.test.ts` and `components/plugins.test.tsx` (the components are rendered to HTML and checked on the real `site.json`).

## Not checked

The components were tested by rendering them to HTML, not in a browser. Look at them once at 1440 × 900 after plugging in.

The planner worker was tested by running its message handler in-process, with every message passed through `structuredClone`. Vite bundles it as its own chunk, but it has not been run as a real Web Worker in a browser yet.
