# ARES — slide text (7 slides)

The exact words for the 7-slide demo deck. Rules, image credits and the 7-slide limit are in [`slides-outline.md`](slides-outline.md); follow them.

**Numbers.** Every number is a placeholder like `⟦N1⟧`: *Numbers: see demo-numbers.md*. Fill each one from `docs/demo-numbers.md` (measured on the live app), not from memory. The [table at the end](#placeholders) gives each placeholder's current value in this repo and where it comes from, to check against.

**Before export:** no team names, faces or photos (under-18 rule); every NASA image credited; no NASA logo. **Mission patch:** do not put it on a slide until the team has confirmed whether it is AI-generated (see [`ai-disclosure.md`](ai-disclosure.md)). If it is, it needs a visible "AI-generated" watermark on every slide it appears on.

---

## Slide 1 — The problem

**ARES: Astronaut Route & EVA Safety**
The Ares Initiative · NASA Space Apps 2026 · *Interplanetary Survival Guide: Martian Map*

- Mars maps show the whole planet. A spacewalk is a few kilometers.
- An astronaut on foot needs to know: Is this slope too steep? Is this sand soft? Can I still get home?
- Oxygen is fixed: ⟦N1⟧ h of life support, ⟦N2⟧ min reserve.

*Visual:* Mars Trek global view → the Jezero delta front. Credit: NASA/JPL-Caltech.

## Slide 2 — The idea

- Google Maps for a person in a spacesuit, built for one Marswalk.
- Jezero Crater, ⟦N3⟧: sample clays and carbonates where an ancient river met a lake.
- Pick science stops. ARES plans the safest walk and shows when you must turn back.
- Science first. Safety always.

*Visual:* ARES opening briefing screen. Credit: NASA/JPL-Caltech/University of Arizona (HiRISE).

## Slide 3 — How it works

- ⟦N4⟧ NASA data types → one ⟦N5⟧ m grid: HiRISE terrain, THEMIS soft sand, CRISM minerals, RAD radiation, MEDA temperature, Mars24 sun.
- Walking speed per cell (Tobler's hiking function), slower on slopes, sand and rough ground.
- Dijkstra / A\* finds the fastest safe route. Deterministic: same stops, same route.
- Time → oxygen → margin → GO / CAUTION / NO-GO, always with the reason.

*Visual:* data → grid → planner → app diagram, plus layer thumbnails. Credit: NASA/JPL-Caltech/University of Arizona (HiRISE), NASA/JPL-Caltech/ASU (THEMIS), NASA/JPL-Caltech/JHUAPL (CRISM).

## Slide 4 — The demo: a normal plan, then a storm

**Normal plan:** Brac → delta front toe → Sid → home
- ⟦N6⟧ km, ⟦N7⟧, ⟦N8⟧% oxygen at return, ⟦N9⟧ min above reserve: **GO**
- Cyan safe-return zone: everywhere she can still reach and walk home from.

**Dust storm at ⟦N10⟧ into the walk:**
- **EVA: NO-GO**: the plan is aborted; the zone collapses.
- **Return home: CAUTION**: red route home, ⟦N11⟧ min walk, ⟦N12⟧ min margin, ⟦N13⟧% oxygen on arrival.

*Visual:* console with the demo GO plan; console mid-storm with both statuses. Credit: NASA/JPL-Caltech/University of Arizona (HiRISE basemap).

## Slide 5 — Checked against Perseverance

- We compared ARES with ⟦N14⟧ km of Perseverance's real drives (NASA traverse file). None of it was used to build the map.
- ARES rates ⟦N15⟧% of the rover's path as walkable.
- Our slope agrees with the rover's own tilt sensor (correlation ⟦N16⟧).
- ARES routes are ⟦N17⟧ m from the drivers' real routes, against ⟦N18⟧ m for a straight line. A model trained on ⟦N19⟧ of their routes could not do better, so the planner stays deterministic.

*Visual:* `docs/images/route_learning.png` or `docs/images/validation_traverse.png`. Credit: NASA/JPL-Caltech (traverse); NASA/JPL-Caltech/University of Arizona/USGS (HiRISE).

## Slide 6 — Related work: what we build on

- **SEXTANT** (MIT and NASA Ames): walking routes for astronauts, with AR navigation, field-tested in NASA's BASALT campaign.
- **xGDS traverse planner** (NASA Ames): reachability, where you can still get to and by when.
- **MoonPath**: lunar south-pole traverses that minimize metabolic workload.
- What ARES adds (in emphasis): Mars thermal and mineral layers, a live oxygen-aware safe-return zone, emergency re-planning with two statuses.

*Visual:* text only. Sources: Norheim 2018; Bresina et al. 2017; Peña-Asensio et al. 2024 (see [`sources.md`](sources.md)).

## Slide 7 — Team and limits

**The Ares Initiative**: a team of ⟦N20⟧. Everyone shares every role.

Honest limits ([`LIMITATIONS.md`](LIMITATIONS.md)):
- Rocks are a roughness proxy; ⟦N5⟧ m cells; one site.
- Walking and oxygen rates are estimates, not suit data.
- Solar storm dose ×⟦N21⟧ is illustrative (the largest one measured on the surface was about ×⟦N22⟧).

Open source (MIT) · Sources: `docs/sources.md` · AI use: `docs/ai-disclosure.md`

*Visual:* team name only. No names, faces or photos.

---

## Placeholders

Each value here is what this repo says today, with its source. Replace each `⟦N…⟧` with the value in `docs/demo-numbers.md`. If the two disagree, use `demo-numbers.md` (measured on the live app) and tell the team.

| Placeholder | What | Value in this repo | Source |
|---|---|---|---|
| N1 | Life support | 8 | `CONSUMABLE_HOURS`, `app/src/planner/constants.ts` |
| N2 | Oxygen reserve | 45 | `RESERVE_MIN`, `constants.ts` |
| N3 | Story year | 2040 | `CLAUDE.md` pitch story |
| N4 | NASA data types | 6 | `CLAUDE.md` section 2 table |
| N5 | Grid cell size | 25 | `CLAUDE.md` decisions (cells are 24.6 × 24.7 m) |
| N6 | Demo distance | 4.97 | `real-site.test.ts` / `learned.test.ts` demo test |
| N7 | Demo duration | 3 h 35 min | planner output (214.9 min), recomputed 14 Nov; `CLAUDE.md` demo mission |
| N8 | Oxygen at return | 49 | `learned.test.ts` demo test |
| N9 | Margin above reserve | 192 | planner output, recomputed 14 Nov; `CLAUDE.md` demo mission |
| N10 | Storm time | T+1:16 | storm preset in the app (4560 s) |
| N11 | Walk home | 57 | `app/src/lib/presentation.test.ts` (storm at 4560 s) |
| N12 | Return margin | 244 | `abortRoute` output for the same storm, recomputed 14 Nov (no test checks it) |
| N13 | Oxygen on arrival | 66 | `app/src/lib/presentation.test.ts` (storm at 4560 s) |
| N14 | Rover path inside the site | 20.57 | `docs/validation.md` |
| N15 | Path rated walkable | 99.8 | `docs/validation.md` |
| N16 | Tilt vs slope correlation | 0.82 | `docs/validation.md` |
| N17 | ARES route distance from drivers' routes | 24.8 | `docs/route-learning.md` |
| N18 | Straight line distance from drivers' routes | 35.3 | `docs/route-learning.md` |
| N19 | Routes the model trained on | 31 | `docs/route-learning.md` |
| N20 | Team size | six | `README.md` |
| N21 | SPE multiplier (illustrative) | 30 | `SPE_MULTIPLIER`, `constants.ts` |
| N22 | Measured 2017 SPE peak | 1.5 | `SPE_MEASURED_2017_PEAK_MULTIPLIER`, `constants.ts` |
