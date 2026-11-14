# ARES UI/UX Figma build plan

Role 4 scope: establish the visual system, build the reusable instrument components, compose the mission screens, and connect them into the demo story. Keep the map visually dominant in planning screens; reserve red for active danger.

## Figma foundations

Create a `ARES / Foundations` variable collection. Keep the first mode named `Mars / Dark` and use CSS custom-property names as WEB code syntax.

| Group | Variables | Values / use |
|---|---|---|
| Color primitives | `primitive/void`, `primitive/console`, `primitive/console-2`, `primitive/hairline`, `primitive/text`, `primitive/muted`, `primitive/mars`, `primitive/safe`, `primitive/go`, `primitive/caution`, `primitive/nogo`, `primitive/science` | Contract 6 hex values; hidden from normal picker |
| Semantic colors | `color/background`, `color/surface`, `color/surface-raised`, `color/border`, `color/text`, `color/text-muted`, `color/plan`, `color/safety`, `color/status/go`, `color/status/caution`, `color/status/nogo`, `color/science` | Aliases to the color primitives; CSS: `var(--void)` through `var(--science)` |
| Typography | Text styles `Display / Mission`, `Heading / Panel`, `Body / Default`, `Label / Telemetry`, `Number / Large`, `Number / Compact` | Space Grotesk headings, Inter body, JetBrains Mono all numeric telemetry |
| Spacing | `space/0`, `space/1`, `space/2`, `space/3`, `space/4`, `space/5`, `space/6`, `space/8`, `space/10`, `space/12` | 0, 4, 8, 12, 16, 20, 24, 32, 40, 48 px; 4 px grid |
| Radius | `radius/card`, `radius/floating`, `radius/pill` | 6, 10, 999 px |

Use variable scopes: background/surface colors for frame fills, text colors for text fill, border for strokes, spacing for auto-layout gap/padding, radius for corners; primitive colors stay unscoped. In Figma, bind component fills, strokes, spacing, and radii to variables. The `tokens.css` file is the code source of truth for these values.

## Component inventory and API

Use auto-layout and component properties for text and visibility. Build state variants only where they change appearance or behavior.

| Component set | Variants / properties |
|---|---|
| `StatusPill` | `status=GO / CAUTION / NO-GO`; optional reason text |
| `LayerCard` | `state=On / Off`; label, data type, source, legend |
| `StopCard` | `state=Default / Selected`; stop number, label, dwell time |
| `StatTile` | label, value, unit; compact / regular |
| `OxygenGauge` | `state=GO / CAUTION / NO-GO`; value and reserve labels |
| `TimelineBar` | paused / playing; cursor position and start-time label |
| `MapMarker` | `kind=Habitat / Stop / Astronaut / Hazard`; numbered stop property |
| `HudReadout` | `kind=Oxygen / Margin / Dose`; label, value, unit |
| `AlertBanner` | `kind=Dust storm / Solar particle event`; active / dismissed |
| `ChatBubble` | `role=Astronaut / ARES`; message and timestamp |

Keep icons as swappable instances, not icon-specific variants. Use 44 px minimum touch targets for controls intended for tablet or HUD interaction. Pair every color state with its written status label.

## Pages and frames

1. `00 Cover` — ARES title, purpose, project owners, links to the prototype.
2. `01 Foundations` — color, typography, spacing/radius specimens and usage notes.
3. `02 Components` — all component sets with compact state examples.
4. `03 Mission flow` — eight 1440×900 frames: `Mission briefing`, `Planning console / Empty`, `Planning console / GO`, `EVA playback`, `Dust storm / NO-GO`, `Stop detail`, `AI assistant open`, `Helmet HUD`.
5. `04 Tablet` — one 1024×768 tablet frame showing the map and Plan / Layers / Conditions bottom sheet.

Use a real, credited HiRISE/Mars Trek Jezero image as the map background in map frames; keep the image in a replaceable image fill. Do not use the NASA logo. Prototype path: Briefing → Empty planner → GO plan → EVA playback → Dust storm NO-GO → Helmet HUD; expose Stop detail and AI assistant as branches from the GO plan.

## Build / review order

1. Create foundations and verify names, values, and code syntax against `app/src/styles/tokens.css`.
2. Build status, telemetry, and marker primitives, then cards, gauge, timeline, banner, and chat bubble.
3. Compose briefing and HUD first (implemented in React in this change), then the planning, playback, emergency, detail, assistant, and tablet frames.
4. Add the real Jezero imagery, wire prototype links, and review each frame at presentation size for contrast, clipping, touch targets, and legibility.
