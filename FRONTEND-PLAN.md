ARES frontend plan: from "works" to "looks like flight software"
For: frontend. Put this file at the repo root; your Claude Code can read it.
 Target look: the design canvas "ARES console: target design" (2 screens: Planning GO, Dust storm abort). Ask the team for the link.
 Deadline: feature freeze Sunday 2 pm. Video recorded Sunday afternoon at 1440 × 900. Tick items only when they're pushed to main and checked at 1440 × 900.

The direction in one paragraph
The console should feel like real mission software, calm until something goes wrong. The map is the hero: big, sharp, zoomed to the mission. Everything else is thin lines, small labels and monospaced numbers. Color only means something: orange = the plan, cyan = safety/return, red = danger, violet = science. In GO state the screen is quiet. In a storm it turns loud in one place (the header and the alert) without the page moving.
Don't (this is what makes UIs look AI-made)
No gradients, glows, neon shadows, glassmorphism or blurred panels
No emoji, no sparkle icons, no "AI" badges
No colored left-border cards, no rounded "pill everything", no giant drop shadows
No filler text ("Unlock the power of…"); labels are short and specific
No more than ~3 font sizes per panel; numbers always in JetBrains Mono
No ring gauges unless they carry information a bar can't

🟥 Tier 1: must have (do tonight)
Layout and fit
[x] Whole console fits 1440 × 900 with no page scroll in GO, playback and storm states (panels may scroll internally)
[x] Grid: left rail ~264 px, map flexible, right rail ~336 px, header 56 px, timeline ~96 px under the map
[x] Remove "Demonstration · " and any "SYNTHETIC" wording from the header
Map
[x] On load and after "Load demo mission": fit the map to habitat + stops with padding (not the whole site)
[x] Numbered stop markers draw above the purple rover-site markers (stop 1 is currently hidden)
[x] Short labels next to stops: "Brac · Séítah", "Delta front toe · new clay target", "Sid · Máaz"
[x] Route: 3 px orange line with a thin dark outline underneath so it reads on bright terrain
[x] Safe zone: dim the ground outside the zone and draw a thin cyan edge, instead of tinting everything cyan
[x] Scale bar (500 m) bottom-left, HiRISE credit bottom-right ("NASA/JPL-Caltech/UArizona/USGS")
[x] Small legend chips top-left: Planned route · Edge of safe return · Rover sample site
Status and emergencies (matches planner Contract 3)
[x] Header shows "EVA · GO" in normal state
[ ] In a storm or SPE: header shows "EVA · NO-GO · ABORTED" (filled red) and "RETURN HOME · CAUTION" (amber outline)
[x] EVA status comes from planRoute with the storm/SPE cost grid; return status from abortRoute (never GO). Remove the hard-coded NO-GO in App.tsx
[x] Show abort.reasons (real planner text) instead of "Emergency abort required"
[ ] If abort.path is empty: NO-GO and show abort.reasons[0]
[x] Storm alert = overlay strip at the top of the map, not a block that pushes the page down. Contains: what happened, time, "Play return", "Reset"
[x] Storm map: dim the basemap, draw walked part faint orange, cancelled part dashed grey, return route bold red, astronaut marker cyan
Mission panel (right rail)
[x] Status block: big "GO" (or "CAUTION" for return) + one-line reason
[x] Oxygen budget bar instead of (or under) the ring: used / margin (cyan) / reserve (hatched), with minutes under each
[x] Big number: "49% left at return" (storm: "66% left on arrival at HAB-1")
[x] Stats in a 2-column hairline grid: Distance, Duration, Walking, Science, Radiation dose, Lowest sun
[x] Stop list: number, name, one-line "why" (rover sample site / new clay target), arrival time (T+0:21 …)
[x] Emergency buttons at the bottom of the rail: "Dust storm" (red outline), "Solar particle event"
Timeline
[x] Play/pause, T+ clock "T+0:00 / 3:35", current activity ("walking to stop 1 · Brac")
[x] Segmented track: walking orange, science violet, with labels 0:00 · 0:21 · 1:42 · 3:02 · 3:35
[x] Conditions on the same row: "Sun 71° · −25 °C · 0.026 mSv/h"
[x] In a storm: storm marker at T+1:16 in red, return segment red, cancelled part dashed

🟧 Tier 2: should have (Sunday morning)
Stop detail card
[ ] Click a stop → card with real Perseverance photo (from app/public/photos/, credits in credits.json), why it matters, dwell time, oxygen cost of the stop, arrival time
[x] Delta front toe has no rover photo: show a HiRISE crop of the spot instead, labelled "orbital view, no rover visit"
Briefing (opening) screen
[x] Full-bleed HiRISE image of Jezero, slow 10–15 s pan (respect reduced motion)
[x] Lines: "ARES-1 EVA · Jezero Crater delta front", "8 hours of oxygen. 5 km of unknown terrain.", one "Begin planning" button
[ ] ARES logo (from app/public/brand/ when it lands)
Helmet HUD
[x] Driven by positionAt during playback: heading arrow to next stop, distance, O₂ left, margin, dose, LMST, status
[x] Storm: red frame + "ABORT · RETURN TO HAB-1" + walk-home time and margin
[x] Very large text, nothing else on screen; visor vignette subtle (no glow)
Data honesty
[ ] Evidence tags next to key numbers: Measured (HiRISE, RAD), Calculated (route, oxygen, slope), Assumed (burn rates, storm slowdown, SPE ×30). Small mono tags, not badges
[x] Data sources panel lists every layer with its citation (read from site.json sources)
[ ] Remove the * temperature marks once the MEDA values land
Motion (small and purposeful)
[ ] Route draws in over 600 ms when the plan changes
[ ] Status change: 250 ms color fade; NO-GO header pulses once, not forever
[ ] Oxygen bar animates 500 ms
[ ] All motion off when prefers-reduced-motion is set

🟦 Tier 3: nice to have (only if Tier 1–2 are done)
[x] Cursor probe card in the left rail (elevation, slope, ground type, walk-home time)
[x] Layer toggles show a tiny legend when on (slope 0–25°, sand, clay signal 0–1)
[x] Keyboard: Space play/pause, H HUD, Esc close, Delete stop
[x] Tablet layout ≤ 1024 px

Before recording (Sunday ~2:30 pm)
[ ] Live Vercel link loads in a fresh Chrome window with no console errors
[ ] Browser window exactly 1440 × 900, zoom 100%, bookmarks bar hidden
[x] "Load demo mission" → GO, 4.97 km, 3 h 35 m, 49% at return
[ ] Storm at T+1:16 → EVA NO-GO, Return home CAUTION, 57 min, 66% on arrival
[ ] Every number on screen matches README, slides, project page and video captions
[ ] No real names anywhere in the UI
Suggested order
Layout + fit (everything else depends on it)
Map zoom, marker order, safe-zone dimming
Status labels + storm overlay
Mission panel + timeline
Push, share a screenshot in the group chat, then Tier 2


## Current handoff

Checked boxes refer to committed frontend work verified locally; they do not certify the current production deployment.

- Photo credit metadata and original NASA image links are now implemented locally in app/public/photos/credits.json; commit/push is still needed. Brac photo was visually verified in Chrome at 1440 × 900; remaining photo files and metadata are covered by automated checks.
- Emergency no-path rendering, both emergency types, reduced motion, and remaining animation details need final visual sign-off before ticking their boxes.
- Evidence labels are present; review full coverage against the target Figma file when its link is supplied.
- ARES logo, MEDA data, production browser sign-off and cross-document/video consistency remain outstanding.

Production CLI deployment succeeded at https://ares-mission-console.vercel.app. Public app shell, credits.json and both demo rover JPEGs returned HTTP 200. Exact 4560-second storm numbers pass regression tests; final production browser recording run is still pending.


## Recording console fixes

Implemented and checked locally at 1440 × 900: padded mission fit with storm-banner clearance, separate HAB-1/03 labels and marker leader, wrapping status reasons, exact T+1:16 dust-storm preset, dual emergency HUD statuses, shared minute rounding, scale label above bar, populated lower-left probe, subtle coordinate grid, frame corners and north arrow. Screenshots and reproduction notes are in docs/frontend-screenshots/. All 147 tests, typecheck and build pass.

Plugin integration is pending receipt of zoneCleanup.ts, ElevationProfile.tsx, StopCard.tsx and app/src/components/README-plugins.md. No planner or pipeline code was edited. Approved branding, MEDA observations, Figma comparison and final cross-document/video review remain separate inputs.
