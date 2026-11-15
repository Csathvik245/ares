# ARES slides outline

**Main plan: 7 slides**, the Space Apps limit for a slide demo (title and intro slides count). Decks over 7 slides are **not eligible for Global Judging** ([Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), "Limitations"). Our demo is the 30-second video ([`video-script.md`](video-script.md)); this deck is the backup demo, and the slides we link from the project page. A longer 12-slide version for a live pitch is in the [appendix](#appendix-12-slide-version--not-for-submission).

The guide asks a demo deck to show an image of the project, the user experience, how NASA data makes it possible, the team name, the team member names and the challenge ([Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), "Slide Demo"). **We show the team name only.** Our team is under 18, and the [2026 Participant Terms and Conditions](https://www.spaceappschallenge.org/legal/) say recognisable names and likenesses of anyone under 18 must not be in any submission. See [`submission.md`](submission.md).

**Rules for every slide**
- English only. No NASA logo, flags or mission insignia in our branding.
- **No names, photos, voices or likenesses of team members.** "The Ares Initiative" only.
- Credit every image: "NASA/JPL-Caltech" + instrument team (e.g. "NASA/JPL-Caltech/University of Arizona" for HiRISE). Screenshots of our app credit the underlying data. Every slide with a NASA image or an app screenshot carries a small credit line in its corner.
- **Before export, check every slide:** no team names, no faces, no team photos, no likenesses; every NASA image credited. Images from other NASA centres keep their own credit (e.g. LRO: NASA/GSFC/Arizona State University).
- Every number comes from the app or [`assumptions.md`](assumptions.md). Re-check numbers against the live app before exporting.
- Any AI-generated image needs a visible watermark ([Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), "Use of Super Intelligence (SI)"). The plan below uses only app screenshots and NASA imagery.
- Few words per slide, readable font size (guide's advice). Style: Contract 6 tokens. Dark console background, orange = plan, cyan = safety, red = danger only; Space Grotesk headings, Inter body, JetBrains Mono numbers.

---

## 1. ARES: Astronaut Route & EVA Safety

- **The Ares Initiative** · NASA Space Apps Challenge 2026
- Challenge: *Interplanetary Survival Guide: Martian Map*
- Tagline: Science first. Safety always.

**Visual:** ARES mission patch (our own design) over a dark HiRISE crop of the Jezero delta front (credit NASA/JPL-Caltech/University of Arizona). No team names or photos.

## 2. The problem and the mission

- Mars Trek and USGS geologic maps show regions and the whole planet; a spacewalk covers a few kilometres.
- 2040, Jezero Crater: an astronaut leaves HAB-1 with 8 hours of oxygen and a sample kit to collect delta carbonates and clays, top targets for signs of ancient life.
- She needs to know: is this slope too steep, is this sand soft, and can I still get home?

**Visual:** split image. Left: Mars Trek global view (credit NASA/JPL-Caltech). Right: the ARES opening briefing screen ("2040 MISSION SCENARIO", 8 HRS, 45 MIN reserve). Caption: "Global map → one EVA."

## 3. How ARES works: six NASA data types → three answers

- **Where is it safe to walk?** HiRISE elevation, slope and roughness (MRO); THEMIS thermal inertia for soft sand (Mars Odyssey).
- **Where is the best science?** CRISM clay and carbonate detections (MRO).
- **When is it safe to be outside?** Curiosity RAD radiation, Perseverance MEDA weather, Mars24 sun position.
- Data → 25 m grid → Tobler-based walking speed → Dijkstra / A* fastest safe route. Deterministic, no ML in safety decisions.

**Visual:** left, the data → grid → planner → app diagram from the README (Figma, token colours). Right, a strip of layer thumbnails (Slope, Soft sand risk, Boulders, Science value) from `docs/images/` or console crops, each with its mission chip. Credit line: "Data: NASA/JPL-Caltech/University of Arizona (HiRISE), NASA/JPL-Caltech/ASU (THEMIS), NASA/JPL-Caltech/JHUAPL (CRISM); processed by The Ares Initiative".

## 4. The plan and the safe-return zone

- Click science stops; ARES plans the fastest safe route and adds up time, oxygen and dose.
- The cyan safe-return zone shows everywhere she can still reach and walk home with the 45-minute reserve intact. It shrinks as stops are added.
- One status light, always with the reason: GO / CAUTION / NO-GO. Demo mission: 4.97 km, about 3.5 hours, 49% oxygen at return, GO (check on screen). Stops: Brac (rover site), the delta front toe (a new clay target ARES selected from CRISM data), Sid (rover site).

**Visual:** console screenshot with **Load demo mission**: three numbered orange stops, orange route, cyan zone, oxygen ring, **GO** pill with reasons. Small inset: the same map with no stops and a larger zone.

## 5. Emergencies and the helmet HUD

- Dust storm or solar particle event: the EVA is aborted (**NO-GO**), the zone collapses and a red route leads home from where she is.
- The walk home gets its own status, usually **CAUTION**: inside the reserve, but an emergency is active.
- Storm slowdown comes from low visibility and dusty visors, not wind (Mars air is ~1% of Earth's density, NASA). SPE ×30 is illustrative.
- The same plan in the helmet: heading, next stop, oxygen, margin, dose; red in an abort.

**Visual:** left, console mid-walk with the red banner "DUST STORM · ABORT EVA", NO-GO pill, red abort route and the `Walk home … · CAUTION` line, both statuses circled. Right, the helmet HUD in abort mode.

## 6. What's new, and honest numbers

- Built for a person in a spacesuit, not a rover. Safe-return zone over real terrain, Apollo walkback idea.
- Time as a dimension (sun, temperature, dose), and "the AI explains, the planner decides".
- Every number sourced or labelled: 8 h life support (EMU), 3 km/h suited walking (Tobler), 0.64 mSv/sol Curiosity RAD baseline; reserve and burn rates are our assumptions.

**Visual:** four icon tiles (Lucide) for the novelty points, and a compact assumptions table with status chips: Sourced (green), Assumption (amber), Placeholder (grey), from [`assumptions.md`](assumptions.md).

## 7. Next steps and sources

- **Moon / Artemis version:** same planner on lunar terrain (LRO elevation and imagery).
- **ML hazard maps:** boulder and dune detection from HiRISE images; routing stays deterministic.
- **Live data:** MEDA weather and NASA DONKI space-weather alerts trigger the warnings.
- Sources: USGS HiRISE DTM and orthomosaic, THEMIS thermal inertia, CRISM (PDS), Curiosity RAD, Mars24. Full list: [`sources.md`](sources.md). AI use: [`ai-disclosure.md`](ai-disclosure.md).

**Visual:** three-column roadmap (Moon · ML · Live) with small images: LRO lunar south pole (NASA/GSFC/Arizona State University), a HiRISE boulder crop (NASA/JPL-Caltech/University of Arizona), a mock alert banner. Footer: QR code to the live app and project page. No agency logos.

---

## Appendix: 12-slide version — NOT FOR SUBMISSION

> ⚠️ **Not for submission as the demo.** Over the 7-slide limit. Use it for a live pitch or local judging only if the Local Lead allows. Same rules: team name only, no names or photos.

### A1. The problem: maps of Mars aren't built for a walk

- Mars Trek and USGS geologic maps show regions and the whole planet. A spacewalk covers a few kilometres.
- An astronaut on foot needs to know: is this slope too steep? Is this sand soft? Do I have enough oxygen to get home?
- NASA's challenge: a layered, integrated view that helps a human explorer plan and carry out a Marswalk while doing science.

**Visual:** split image. Left: Mars Trek global view of Mars (credit NASA/JPL-Caltech). Right: the same spot zoomed to the Jezero delta front in the ARES console, with the 6 × 8 km site box. Caption: "Global map → one EVA."

### A2. Mission story: ARES-1 EVA, Jezero Crater, 2040

- Commander Reyes leaves HAB-1 with 8 hours of oxygen, a 20 kg sample kit and about 5 km of unknown terrain.
- Goal: sample the carbonate and clay layers of an ancient river delta, top targets for signs of life from about 3.5 billion years ago.
- Why Jezero: Perseverance's landing region, so it has high-resolution terrain data and thousands of rover photos.

**Visual:** ARES opening briefing screen (ARES patch, "2040 MISSION SCENARIO", science objective, 8 HRS / 45 MIN). Optional inset: HiRISE orthomosaic crop of the delta front (NASA/JPL-Caltech/University of Arizona; mosaic by USGS Astrogeology).

### A3. How ARES works

- **Data → grid:** NASA datasets clipped and resampled to one 320 × 240 grid of 25 m cells.
- **Grid → route:** walking speed per cell from Tobler's hiking function, slowed for sand and boulders. Dijkstra / A\* finds the fastest safe path.
- **Route → safety:** time → oxygen → margin → GO / CAUTION / NO-GO. Deterministic: no machine learning in safety decisions.
- **One plan, two screens:** habitat console for planning, helmet HUD outside.

**Visual:** the data → grid → planner → app diagram from the README (redrawn in Figma with the token colours), plus a small console screenshot on the right.

### A4. Six NASA data types → three answers

- **Where is it safe to walk?** HiRISE elevation and slope (MRO), HiRISE-derived roughness for boulders, THEMIS thermal inertia for soft sand (Mars Odyssey). MOLA (Mars Global Surveyor) is the backup elevation.
- **Where is the best science?** CRISM clay and carbonate detections (MRO).
- **When is it safe to be outside?** MEDA weather (Perseverance), RAD surface radiation (Curiosity, Gale Crater, applied to Jezero), Mars24 sun position.

**Visual:** a 2 × 3 grid of layer thumbnails of the same site: Slope, Soft sand risk, Boulders, Science value, Walking difficulty, basemap. Each labelled with data type + mission chip, as in the app's layer cards. Export from `pipeline/preview_site.py` (`docs/images/`) or crop console screenshots.

### A5. The safe-return zone

- A glowing cyan boundary: everywhere the astronaut can still reach after the last stop **and** walk home with the 45-minute reserve intact.
- Computed live over real terrain, not as a circle: cliffs and sand bend the boundary.
- It shrinks as stops are added. It comes from aviation's "point of no return" and Apollo walkback limits.

**Visual:** two console screenshots side by side. Left: no stops, large cyan zone. Right: demo mission loaded, smaller zone and orange route. Arrow labelled "add stops → zone shrinks".

### A6. Emergencies: dust storm and solar particle event

- One click simulates the emergency. The EVA is aborted, so status is **NO-GO**. The zone collapses and a red abort route goes home from where she is now.
- The walk home gets its own status, usually **CAUTION** (still inside the reserve, but an emergency is active).
- Dust storm slows walking because of **low visibility and dust on the visor**, not wind: Mars air is about 1% as dense as Earth's (NASA).
- The SPE dose spike (×30) is **illustrative**; in the largest event RAD has measured on the surface, the dose-equivalent rate rose only about ×1.5 (absorbed dose ×2–3; Zeitlin et al. 2018).

**Visual:** console screenshot mid-walk with the red banner "DUST STORM · ABORT EVA", NO-GO pill, red abort route and the `Walk home … · CAUTION` line. Circle the two statuses.

### A7. Helmet HUD

- Full-screen, minimal: heading arrow, next science stop and distance, oxygen remaining, return margin, cumulative dose.
- Very large text and high contrast for use through a visor; turns red with "ABORT / RETURN TO HABITAT" in an emergency.
- Same plan as the habitat console; nothing re-entered.

**Visual:** two HUD screenshots: normal (cyan) and abort (red). Optional: a stop detail card with the Perseverance photo of stop 1 or 3 (credit NASA/JPL-Caltech plus the camera team if given). Not stop 2: the delta front toe has no rover photo.

### A8. What's new

- Built for a **person in a spacesuit**, not a rover.
- **Safe-return zone** computed live over real terrain.
- **Science per oxygen-minute**: where you go is weighed against what it costs to get back. (Stop suggestions ranked this way are a stretch feature; check whether they shipped before claiming them.)
- **Time as a dimension**: when to walk (sun, temperature, dose), not just where.
- **"The AI explains, the planner decides"**: the routing is deterministic, so it's predictable, explainable and testable.

**Visual:** five icon tiles (Lucide icons) in a row, one per point. Small Apollo traverse map inset as the heritage link (credit NASA plus the Lunar and Planetary Institute as given on the source page; it is a NASA Apollo map, not JPL).

### A9. Model assumptions (honest numbers)

- 8 h life support (Shuttle/ISS EMU rating); 45 min reserve (+30 min in a storm), our choice.
- Walking: 3 km/h on flat firm ground (Tobler 5 km/h × 3/5 off-path); slopes over 25° and dense boulders are no-go.
- Radiation: 0.64 mSv/sol Curiosity RAD baseline applied to Jezero; SPE ×30 illustrative.
- Sun from Mars24 at one fixed season (Ls 0°); temperature from Perseverance MEDA measurements (Munguira et al. 2023), with our smooth curve between the measured low and high.

**Visual:** the "Model assumptions (slide-ready)" list from [`assumptions.md`](assumptions.md) as a two-column table, with a status chip on each row: Sourced (green), Assumption (amber), Placeholder (grey).

### A10. Sources

- Terrain: Mars 2020 TRN HiRISE DTM mosaic and orthomosaic (USGS Astrogeology).
- Sand: THEMIS-derived thermal inertia of Jezero (Edwards & Buz 2021). Science: CRISM MTRDR summary parameters (PDS Geosciences Node).
- Conditions: Curiosity RAD (Hassler et al. 2014; Zeitlin et al. 2018), Mars24 (Allison & McEwen 2000), Perseverance MEDA (Rodriguez-Manfredi et al. 2023).
- Full list with links: [`sources.md`](sources.md). Every source is also in the Space Apps References field.

**Visual:** text slide; small logos are **not** used (no agency logos). Put the repo URL and a QR code to `docs/sources.md` in the corner.

### A11. Team: The Ares Initiative

- The Ares Initiative. Everyone shares every role: data & GIS, planner, frontend, design, science & story.
- Built in about 48 hours for NASA Space Apps Challenge 2026, *Interplanetary Survival Guide: Martian Map*.
- Open source, MIT licence: link to the public GitHub repo (see the note under this slide about the repo URL).
- **AI use:** AI coding and chat assistants helped build ARES; the route and safety decisions are deterministic algorithms. Full disclosure: [`ai-disclosure.md`](ai-disclosure.md).

**Visual:** ARES mission patch (our own design) and the team name only. **No names, photos or likenesses of team members** (under-18 rule). The repo URL contains a teammate's GitHub username; decide as a team whether to show it or use a QR code to the project page instead.

### A12. Next steps

- **Moon / Artemis version:** same planner on lunar terrain (LRO LOLA elevation, LROC imagery, Diviner thermal data) for the south-pole EVAs. Contracts stay the same; only the data and constants change.
- **ML hazard maps:** boulder and dune detection from HiRISE images (e.g. trained on AI4Mars) to replace the roughness proxy. The routing itself stays deterministic.
- **Live data:** real-time MEDA weather and NASA DONKI space-weather alerts driving the storm and SPE warnings, instead of buttons.
- Also: buddy mode (two astronauts plus a rover as a mobile safe haven), voice commands in the HUD, real suit metabolic rates.

**Visual:** three-column roadmap (Moon · ML · Live), each with a small image: an LRO view of the lunar south pole (NASA/GSFC/Arizona State University), a HiRISE boulder field crop (NASA/JPL-Caltech/University of Arizona), and a mock alert banner.
