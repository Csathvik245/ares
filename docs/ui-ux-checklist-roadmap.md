# ARES UI/UX Designer Checklist and Roadmap

**Role:** UI/UX Designer  
**Product:** ARES-1 EVA planning system for Jezero Crater  
**Design principle:** the map is the hero; panels frame it. Science first. Safety always.

Use this as the working task list. Check items off as they are completed and keep the Figma file, implementation, and team handoffs in sync.

## Current starting point

- [x] Contract 6 color, type, spacing, radius, and touch-target tokens are in `app/src/styles/tokens.css`.
- [x] React mission briefing screen exists in `app/src/components/MissionBriefing.tsx`.
- [x] React helmet HUD exists in `app/src/components/HelmetHud.tsx`.
- [x] Shared styling for these screens exists in `app/src/components/mission-screens.css`.
- [x] Figma build plan exists in `docs/ui-ux-figma-plan.md`.
- [ ] Remaining screen designs, complete component set, prototype, tablet layout, stop detail card, slide template, and visual review are still to do.

## Roadmap

### Phase 1 — Align and lock the visual system

- [ ] Confirm Contract 6 values and semantic meaning with the team: orange = route/stops/actions; cyan = safety; red = active danger only; green/amber/red = GO/CAUTION/NO-GO.
- [ ] Confirm the three typefaces and their use: Space Grotesk for headings, Inter for body, JetBrains Mono for telemetry and numbers.
- [ ] In Figma, create the `ARES / Foundations` variable collection and `Mars / Dark` mode using the token names and values in `docs/ui-ux-figma-plan.md`.
- [ ] Bind color, spacing, and radius variables in the components. Keep `tokens.css` as the code source of truth.
- [ ] Agree with the frontend engineer on component names, props, screen dimensions, and where the React components will live.
- [ ] Request a credited, usable Jezero HiRISE/Mars Trek image from the GIS teammate; keep map imagery replaceable in Figma and in the UI.

**Phase exit:** Figma foundations match `tokens.css`; no shared token or status meaning is ambiguous.

### Phase 2 — Build the reusable instrument components

- [ ] Status pill: GO, CAUTION, NO-GO, with a text reason and an icon/shape cue in addition to color.
- [ ] Layer card: on/off, plain-language layer name, data type, source mission, and legend.
- [ ] Stop card: default/selected states, stop number/name, dwell time, and science note.
- [ ] Stat tile: label, value, unit, and compact/regular sizes.
- [ ] Oxygen ring gauge: remaining oxygen, capacity, reserve, and status state.
- [ ] Timeline: start time, play/pause, scrubber, and current EVA time.
- [ ] Map markers: habitat, science stop, astronaut, and hazard.
- [ ] HUD readouts: oxygen, return margin, and dose.
- [ ] Alert banner: dust storm and solar particle event states, with clear return/abort action.
- [ ] Chat bubble: astronaut and ARES roles.
- [ ] Apply auto-layout, named variants/properties, and a minimum 44 px touch target to touch controls.
- [ ] Pair every color-coded state with a written label. Use plain labels such as “Soft sand risk.”

**Phase exit:** teammates can reuse the components without recreating their appearance or guessing state behavior.

### Phase 3 — Design the core desktop mission flow

Create eight linked 1440 × 900 frames. Keep the map dominant in planning screens and make the current safety status understandable at a glance.

- [ ] **Mission briefing:** ARES-1 EVA, Jezero delta front, science objective, crew summary, life support/reserve, and Begin planning.
- [ ] **Planning console / Empty:** map, layer controls, mission status, route/stop panel, and a clear first action.
- [ ] **Planning console / GO:** route and science stops, oxygen/return margin, safe-return zone, source-aware layers, and status reason.
- [ ] **EVA playback:** astronaut position, route progress, timeline, sun/temperature/radiation context, and telemetry.
- [ ] **Dust storm / NO-GO:** obvious danger state, status reason, current position, abort route home, and emergency context.
- [ ] **Stop detail:** rover photo and credit, why the stop matters, dwell time, tools, and oxygen cost.
- [ ] **AI assistant open:** example questions and answers; make clear that ARES explains planner output and does not decide safety.
- [ ] **Helmet HUD:** curved visor treatment, large heading cue, next stop/distance, oxygen, margin, dose, local time, temperature, and status.
- [ ] Use the actual demo scenario and representative data supplied by the team; do not invent scientific values.
- [ ] Link the frames into the demo sequence: briefing → empty planner → GO plan → playback → storm/NO-GO → HUD. Make stop detail and assistant available as branches from the GO plan.

**Phase exit:** a teammate unfamiliar with the design can click through the full ARES story and explain the current status and next action.

### Phase 4 — Tablet adaptation and visual identity

- [ ] Create the 1024 × 768 tablet frame with the map visible and Plan / Layers / Conditions controls accessible as a bottom sheet or similarly clear layout.
- [ ] Check that map, stop selection, emergency action, and key readouts remain usable at tablet size.
- [ ] Draw an original ARES wordmark/mission patch. Do not use the NASA logo.
- [ ] Create a slide template for the Science and Story Lead using the same colors, type, and source-credit style.
- [ ] Ensure every map layer can show its source mission and data type; preserve photo credits in stop details.

**Phase exit:** tablet and presentation materials look like the same product and retain clear source attribution.

### Phase 5 — Implement, integrate, and review

- [ ] Deliver `tokens.css` and Figma component/frame links to the frontend engineer.
- [x] Briefing screen implementation exists; review it against the Figma frame and connect a real terrain image when the credited asset is available.
- [x] HUD implementation exists; review it in GO, CAUTION, and NO-GO states against the Figma frame.
- [ ] Implement the stop detail card and hand its props/data needs to the frontend teammate.
- [ ] Match motion to the agreed timings: route 600 ms, safe-zone pulse 3 s, status 250 ms, gauge 500 ms.
- [ ] Respect `prefers-reduced-motion`; keep state changes understandable with motion disabled.
- [ ] Review every desktop and tablet frame in the running app before recording the video.
- [ ] Check spacing/alignment, clipping, contrast (at least 4.5:1 for text), typography, map prominence, 44 px touch controls, and keyboard focus visibility.
- [ ] Confirm danger red appears only for danger, and GO/CAUTION/NO-GO always includes a written label and reason.
- [ ] Capture and resolve visual mismatches with the frontend engineer; keep Figma and implemented behavior aligned.
- [ ] Hand the approved slide template and final visual assets to the Science and Story Lead.

**Phase exit:** the implemented screens match the approved frames closely enough for a judge to understand the status within two seconds; demo visuals are ready to record.

## Priority order for a short hackathon

1. Design system and status language.
2. Planning console GO and emergency NO-GO states (the product’s core story).
3. Briefing and HUD polish, then playback.
4. Stop details, assistant panel, and tablet adaptation.
5. Patch, slide template, motion refinements, and final visual QA.

Protect time for integration and review. If time gets tight, ship a coherent GO-to-NO-GO journey before polishing secondary states or adding decorative motion.

## Handoff checklist

### To the Frontend Engineer

- [ ] Figma link with foundations, component library, screen frames, and prototype flow.
- [ ] `app/src/styles/tokens.css` with values matching Figma variables.
- [ ] Component/frame specs for status, layers, stops, oxygen, timeline, markers, HUD, alerts, and assistant.
- [ ] HUD, briefing, and stop detail React components, with prop expectations and status variants.
- [ ] Motion timings, reduced-motion behavior, focus states, and touch-target requirements.
- [ ] Credited map background asset or a clear placeholder note until GIS supplies it.

### To the Science and Story Lead

- [ ] Slide template and original ARES logo/patch assets.
- [ ] Source-credit treatment for NASA datasets and rover images.
- [ ] Approved screenshot(s) that communicate the product and its safety status quickly.

### Before recording the demo

- [ ] Mission flow works from briefing through planning, playback, emergency return, and HUD.
- [ ] No unsourced science number is introduced by the UI; assumptions are labeled as such.
- [ ] Map/layer labels and source credits are legible.
- [ ] GO, CAUTION, and NO-GO states are visually distinct and understandable without color alone.
- [ ] Tablet and reduced-motion states have received a quick pass.
- [ ] Figma prototype and running app show the same labels, status meanings, and key values.
