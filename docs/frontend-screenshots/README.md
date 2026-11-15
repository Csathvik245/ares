# Frontend recording checks

Chrome responsive viewport: 1440 × 900 CSS pixels, device pixel ratio 1. Exported with DevTools Capture screenshot; each PNG is exactly 1440 × 900 and contains only the application.

- go-plan.png: demo loaded, GO, 4.97 km, 3:35, 49% oxygen at return. HAB-1 and 03 have separate marker/label positions; a leader links the displaced 03 marker to its actual coordinate.
- playback-leg-2.png: paused playback at 4531 seconds, walking on leg 2 toward stop 02 (clock rounds to T+1:16).
- storm-leg-2.png: exact 4560-second preset, EVA NO-GO/ABORTED, return CAUTION, 57 min home, 244 min margin, 66% oxygen on arrival. Stop 02 remains below the alert strip.
- storm-hud.png: same incident; both statuses, 57 min home and 244 min margin agree with the console.
- stop-card-photo.png: Séítah outcrop (Brac) card with rover photo, camera and sol credit, and the caption “Perseverance at this sampling site.”
- delta-front-toe-orbital.png: Delta front toe card with the orbital HiRISE view and science score.

No page scrollbar or overlapping waypoint labels was visible in the captured states. The stop list scrolls inside the mission panel. Left probe defaults to the current astronaut position and updates while pointing over terrain. Coordinate grid is a 0.01-degree presentation overlay, not new scientific data.

Planner and pipeline source were not edited. All three supplied plugins are integrated per components/README-plugins.md. Safe-zone cleanup changes only the drawn mask. The 70 px elevation strip follows normal playback and switches to the return route during an emergency. Supplied orbital and rover stop cards were inspected inside the existing focus-trapped dialog. Temperature labels now identify the pulled MEDA interpolation. The photo dialog extends below the 900 px viewport at this card size; this is a visual follow-up for the UI/UX pass.


## SPE shelter routing

- `spe-demo-walk-home.jpg`: standard three-stop demo, SPE at T+1:16. The planner checks shelter and chooses walking home (31 min).
- `spe-wildcat-ridge.jpg`: “SPE at Wildcat Ridge” preset walks the calm route to the supplied Wildcat Ridge POI, then triggers SPE at arrival. Shelter wins: about 160 m away, 9 min walk, 12% lower modeled dose. Cyan shelter path/target and faint dashed red home route.
- Both production-preview captures use 1440 × 900. Document scroll size equals the viewport; no page scroll. Both HUD destinations and dust-storm omission were also checked; no browser warnings or errors were observed.
- Shelter numbers are simplified and SPE dose is illustrative. Planner reasons remain available in the Return home details and guidance tooltip. Return-home status and playback continue to describe the route to HAB-1.
- MissionContext reads the sky-view layer alongside the terrain and passes it to the native `stormAt` API. All shelter guidance comes from `outcome.shelter`. No planner files were edited.
