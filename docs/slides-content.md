# ARES: slide text (7 slides)

The exact words for the 7-slide demo deck. Rules, image credits and the 7-slide limit are in [`slides-outline.md`](slides-outline.md); follow them.

**Numbers.** Every number is a placeholder like `8`: *Numbers: see demo-numbers.md*. Fill each one from `docs/demo-numbers.md` (measured on the live app), not from memory. The [table at the end](#placeholders) gives each placeholder's current value in this repo and where it comes from, to check against.

**Before export:** no team names, faces or photos (under-18 rule); every NASA image credited; no NASA logo. **Mission patch:** it is AI-generated (see [`ai-disclosure.md`](ai-disclosure.md)), so it needs a visible "AI-generated" label on every slide it appears on.

---

## Slide 1: The problem

**ARES: Astronaut Route & EVA Safety**
The Ares Initiative · NASA Space Apps 2026 · *Interplanetary Survival Guide: Martian Map*

- Mars maps show the whole planet. A spacewalk is a few kilometers.
- An astronaut on foot needs to know: Is this slope too steep? Is this sand soft? Can I still get home?
- Oxygen is fixed: 8 h of life support, 45 min reserve.

*Visual:* Mars Trek global view → the Jezero delta front. Credit: NASA/JPL-Caltech.

## Slide 2: The idea

- Google Maps for a person in a spacesuit, built for one Marswalk.
- Jezero Crater, 2040: sample clays and carbonates where an ancient river met a lake.
- Pick science stops. ARES plans the safest walk and shows when you must turn back.
- Science first. Safety always.

*Visual:* ARES opening briefing screen. Credit: NASA/JPL-Caltech/University of Arizona (HiRISE).

## Slide 3: How it works

- Six NASA data types → one 25 m grid: HiRISE terrain, THEMIS soft sand, CRISM minerals, RAD radiation, MEDA temperature, Mars24 sun.
- Walking speed per cell (Tobler's hiking function), slower on slopes, sand and rough ground.
- Dijkstra / A\* finds the fastest safe route. Deterministic: same stops, same route.
- Time → oxygen → margin → GO / CAUTION / NO-GO, always with the reason.

*Visual:* data → grid → planner → app diagram, plus layer thumbnails. Credit: NASA/JPL-Caltech/University of Arizona (HiRISE), NASA/JPL-Caltech/ASU (THEMIS), NASA/JPL-Caltech/JHUAPL (CRISM).

## Slide 4: The demo: a normal plan, then emergencies

**Normal plan:** Brac → delta front toe → Sid → home
- 4.97 km, 3 h 35 min, 49% oxygen at return, 192 min above reserve: **GO**
- Electric-blue safe-return zone: everywhere she can still reach and walk home from.

**Dust storm at T+1:16 into the walk:**
- **EVA: NO-GO**: the plan is aborted; the zone collapses.
- **Return home: CAUTION**: red route home, 57 min walk, 244 min margin, 66% oxygen on arrival.

**Oxygen loss at T+1:16 (ARES compares carrying on with going home, and picks the safer one):**
- A 50% oxygen loss: ARES cancels the remaining stops and sends her straight home with 111 min of margin. Continuing to Delta front toe would leave only 31 min. **EVA: NO-GO**, **Return home: CAUTION**.
- The size of the loss is illustrative, not measured failure data.

*Visual:* console with the demo GO plan; console mid-storm with both statuses; if there is room, the route home after the oxygen loss. Credit: NASA/JPL-Caltech/University of Arizona (HiRISE basemap).

## Slide 5: Checked against Perseverance, and against our own assumptions

**Against the rover:**
- We compared ARES with 20.57 km of Perseverance's real drives (NASA traverse file). None of it was used to build the map.
- ARES rates 99.8% of the rover's path as walkable, and our slope agrees with the rover's own tilt sensor (correlation 0.82).
- **Machine learning check.** We trained a machine-learning model (maximum margin planning) on 31 of Perseverance's real drives to learn how NASA's drivers choose routes. Tested on routes it had not seen, it could not beat our physics planner (24.8 m vs 35.3 m for a straight line), so the planner stays deterministic and the ML serves as independent validation.

**Reliability (Monte Carlo): each plan re-run 1000 times with our assumptions varied:**
- Demo plan: 1000 of 1000 trials home with the reserve (0 failures: failure rate likely below 0.3%).
- Stretch plan (one more stop, Wildcat Ridge, with 120 min of sampling; 6.87 km, 6:25): on paper CAUTION with 18 min of margin, but in about 1 in 4 versions (279 of 1000 trials) she gets home below the 45-minute reserve.
- This is a simulation of our own assumptions in calm conditions, not a measured mission success rate.

*Visual:* `docs/images/route_learning.png` or `docs/images/validation_traverse.png`. Credit: NASA/JPL-Caltech (traverse); NASA/JPL-Caltech/University of Arizona/USGS (HiRISE).

## Slide 6: Related work: what we build on

- **SEXTANT** (MIT and NASA Ames): walking routes for astronauts, with AR navigation, field-tested in NASA's BASALT campaign.
- **xGDS traverse planner** (NASA Ames): reachability, where you can still get to and by when.
- **MoonPath**: lunar south-pole traverses that minimize metabolic workload.
- What ARES adds (in emphasis): Mars thermal and mineral layers, a live oxygen-aware safe-return zone, emergency re-planning with two statuses.

*Visual:* text only. Sources: Norheim 2018; Bresina et al. 2017; Peña-Asensio et al. 2024 (see [`sources.md`](sources.md)).

## Slide 7: Team and limits

**The Ares Initiative**: a team of six. Everyone shares every role.

Honest limits ([`LIMITATIONS.md`](LIMITATIONS.md)):
- Rocks are a roughness proxy; 25 m cells; one site.
- Walking and oxygen rates are estimates, not suit data.
- Solar storm dose ×30 is illustrative (the largest one measured on the surface was about ×1.5).

Open source (MIT) · Sources: `docs/sources.md` · AI use: `docs/ai-disclosure.md`

*Visual:* team name only. No names, faces or photos.

---

## Numbers

Every number on the slides and where it comes from. `demo-numbers.md` is checked by `app/src/planner/demo-numbers.test.ts`, so `npm test` fails if it stops matching the code.

| # | What | On the slide | Source |
|---|---|---|---|
| N1 | Life support | 8 h | `CONSUMABLE_HOURS`, constants.ts |
| N2 | Oxygen reserve | 45 min | `RESERVE_MIN`, constants.ts |
| N3 | Story year | 2040 | CLAUDE.md pitch story |
| N4 | NASA data types | 6 | CLAUDE.md section 2 |
| N5 | Grid cell size | 25 m (24.6 × 24.7 m) | CLAUDE.md decisions; site.json `cellSizeM` |
| N6 | Demo distance | 4.97 km | demo-numbers.md §1 |
| N7 | Demo total time | 3 h 35 min (3:35) | demo-numbers.md §1 |
| N8 | Oxygen at return | 49% | demo-numbers.md §1 |
| N9 | Oxygen margin | 192 min | demo-numbers.md §1 |
| N10 | Storm time | T+1:16 | demo-numbers.md §2 |
| N11 | Walk home | 57 min | demo-numbers.md §2 |
| N12 | Margin on arrival | 244 min | demo-numbers.md §2 |
| N13 | Oxygen on arrival | 66% | demo-numbers.md §2 |
| N14 | Rover path in the site | 20.57 km | demo-numbers.md §4 |
| N15 | Rover path rated passable | 99.8% | demo-numbers.md §4 |
| N16 | Slope vs rover tilt | r = 0.82 | demo-numbers.md §4 |
| N17 | ARES vs drivers' routes | 24.8 m | demo-numbers.md §5 |
| N18 | Straight line vs drivers' routes | 35.3 m | demo-numbers.md §5 |
| N19 | Held-out routes | 31 | demo-numbers.md §5 |
| N20 | Team size | six | README.md |
| N21 | SPE multiplier (illustrative) | ×30 | `SPE_MULTIPLIER`, constants.ts |
| N22 | Measured 2017 SPE peak | ×1.5 | `SPE_MEASURED_2017_PEAK_MULTIPLIER`, constants.ts |
| N23 | Demo oxygen loss | 50% at T+1:16 | demo-numbers.md §8 (demo case) |
| N24 | Recommendation; riskier option | return home; continue to Delta front toe | demo-numbers.md §8 (demo case) |
| N25 | Margin going home; margin if she continued | 111 min; 31 min | demo-numbers.md §8 (demo case) |
| N26 | Statuses after the oxygen loss | EVA NO-GO, Return home CAUTION | demo-numbers.md §8 (demo case) |
| N27 | Demo plan reliability | 1000 of 1000 trials; failure rate likely below 0.3% | demo-numbers.md §6 |
| N28 | Stretch plan: extra stop and sampling time | Wildcat Ridge, 120 min | demo-numbers.md §7 |
| N29 | Stretch plan: distance, total time | 6.87 km, 6:25 | demo-numbers.md §7 |
| N30 | Stretch plan: status and margin on paper | CAUTION, 18 min | demo-numbers.md §7 |
| N31 | Stretch plan: home below the reserve | about 1 in 4 (279 of 1000 trials) | demo-numbers.md §7 |
| N32 | Reserve | 45 min | `RESERVE_MIN`, constants.ts |
