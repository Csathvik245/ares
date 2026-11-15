# Frontend recording checks

Chrome responsive viewport: 1440 × 900 CSS pixels, device pixel ratio 1. Exported with DevTools Capture screenshot; each PNG is exactly 1440 × 900 and contains only the application.

- go-plan.png: demo loaded, GO, 4.97 km, 3:35, 49% oxygen at return. HAB-1 and 03 have separate marker/label positions; a leader links the displaced 03 marker to its actual coordinate.
- playback-leg-2.png: paused playback at 4531 seconds, walking on leg 2 toward stop 02 (clock rounds to T+1:16).
- storm-leg-2.png: exact 4560-second preset, EVA NO-GO/ABORTED, return CAUTION, 57 min home, 244 min margin, 66% oxygen on arrival. Stop 02 remains below the alert strip.
- storm-hud.png: same incident; both statuses, 57 min home and 244 min margin agree with the console.

No page scrollbar or overlapping waypoint labels was visible in the captured states. The stop list scrolls inside the mission panel. Left probe defaults to the current astronaut position and updates while pointing over terrain. Coordinate grid is a 0.01-degree presentation overlay, not new scientific data.

Planner and pipeline source were not edited. All three supplied plugins are integrated per components/README-plugins.md. Safe-zone cleanup changes only the drawn mask. The 70 px elevation strip follows normal playback and switches to the return route during an emergency. Supplied orbital and rover stop cards were inspected inside the existing focus-trapped dialog. Temperature labels now identify the pulled MEDA interpolation. The screenshot set was refreshed after integration; the full suite passes 231 tests.
