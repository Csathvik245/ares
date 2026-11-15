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

## Tests

`npm test` runs `lib/zoneCleanup.test.ts`, `lib/profile.test.ts` and `components/plugins.test.tsx` (the components are rendered to HTML and checked on the real `site.json`).

## Not checked

The components were tested by rendering them to HTML, not in a browser. Look at them once at 1440 × 900 after plugging in.
