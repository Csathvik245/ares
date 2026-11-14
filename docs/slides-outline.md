# ARES slides outline

12 slides for the full presentation (local judging, the project page, or a live pitch).

> ⚠️ **If the slides are the Space Apps demo**, they must be **7 slides or fewer, including title and intro**. Longer decks are **not eligible for Global Judging** ([Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), "Limitations"). The demo deck must also show the team name, team member names and the chosen challenge. Use the [7-slide cut](#7-slide-demo-cut) at the end. See [`submission.md`](submission.md).

**Rules for every slide**
- English only. No NASA logo, flags or mission insignia in our branding.
- Credit every image: "NASA/JPL-Caltech" + instrument team (e.g. "NASA/JPL-Caltech/University of Arizona" for HiRISE). Screenshots of our app credit the underlying data.
- No photos, names or likenesses of anyone under 18 (see slide 11).
- Every number comes from the app or [`assumptions.md`](assumptions.md). Re-check numbers against the live app before exporting.
- Any AI-generated image needs a visible watermark ([Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), "Use of Super Intelligence (SI)").
- Style: Contract 6 tokens. Dark console background, orange = plan, cyan = safety, red = danger only; Space Grotesk headings, Inter body, JetBrains Mono numbers.

---

## 1. The problem: maps of Mars aren't built for a walk

- Mars Trek and USGS geologic maps show regions and the whole planet. A spacewalk covers a few kilometres.
- An astronaut on foot needs to know: is this slope too steep? Is this sand soft? Do I have enough oxygen to get home?
- NASA's challenge: a layered, integrated view that helps a human explorer plan and carry out a Marswalk while doing science.

**Visual:** split image. Left: Mars Trek global view of Mars (credit NASA/JPL-Caltech). Right: the same spot zoomed to the Jezero delta front in the ARES console, with the 6 × 8 km site box. Caption: "Global map → one EVA."

## 2. Mission story: ARES-1 EVA, Jezero Crater, 2040

- Commander Reyes leaves HAB-1 with 8 hours of oxygen, a 20 kg sample kit and about 4–5 km of unknown terrain.
- Goal: sample the carbonate and clay layers of an ancient river delta, top targets for signs of life from about 3.5 billion years ago.
- Why Jezero: Perseverance's landing region, so it has high-resolution terrain data and thousands of rover photos.

**Visual:** ARES opening briefing screen (ARES patch, "2040 MISSION SCENARIO", science objective, 8 HRS / 45 MIN). Optional inset: HiRISE orthomosaic crop of the delta front.

## 3. How ARES works

- **Data → grid:** NASA datasets clipped and resampled to one 320 × 240 grid of 25 m cells.
- **Grid → route:** walking speed per cell from Tobler's hiking function, slowed for sand and boulders. Dijkstra / A\* finds the fastest safe path.
- **Route → safety:** time → oxygen → margin → GO / CAUTION / NO-GO. Deterministic: no machine learning in safety decisions.
- **One plan, two screens:** habitat console for planning, helmet HUD outside.

**Visual:** the data → grid → planner → app diagram from the README (redrawn in Figma with the token colours), plus a small console screenshot on the right.

## 4. Six NASA data types → three answers

- **Where is it safe to walk?** HiRISE elevation and slope (MRO), HiRISE-derived roughness for boulders, THEMIS thermal inertia for soft sand (Mars Odyssey). MOLA (Mars Global Surveyor) is the backup elevation.
- **Where is the best science?** CRISM clay and carbonate detections (MRO).
- **When is it safe to be outside?** MEDA weather (Perseverance), RAD surface radiation (Curiosity, Gale Crater, applied to Jezero), Mars24 sun position.

**Visual:** a 2 × 3 grid of layer thumbnails of the same site: Slope, Soft sand risk, Boulders, Science value, Walking difficulty, basemap. Each labelled with data type + mission chip, as in the app's layer cards. Export from `pipeline/preview_site.py` (`docs/images/`) or crop console screenshots.

## 5. The safe-return zone

- A glowing cyan boundary: everywhere the astronaut can still reach after the last stop **and** walk home with the 45-minute reserve intact.
- Computed live over real terrain, not as a circle: cliffs and sand bend the boundary.
- It shrinks as stops are added. It comes from aviation's "point of no return" and Apollo walkback limits.

**Visual:** two console screenshots side by side. Left: no stops, large cyan zone. Right: demo mission loaded, smaller zone and orange route. Arrow labelled "add stops → zone shrinks".

## 6. Emergencies: dust storm and solar particle event

- One click simulates the emergency. The EVA is aborted, so status is **NO-GO**. The zone collapses and a red abort route goes home from where she is now.
- The walk home gets its own status, usually **CAUTION** (still inside the reserve, but an emergency is active).
- Dust storm slows walking because of **low visibility and dust on the visor**, not wind: Mars air is about 1% as dense as Earth's (NASA).
- The SPE dose spike (×30) is **illustrative**; the largest event RAD has measured was 2–3× background (Zeitlin et al. 2018).

**Visual:** console screenshot mid-walk with the red banner "DUST STORM · ABORT EVA", NO-GO pill, red abort route and the `Walk home … · CAUTION` line. Circle the two statuses.

## 7. Helmet HUD

- Full-screen, minimal: heading arrow, next science stop and distance, oxygen remaining, return margin, cumulative dose.
- Very large text and high contrast for use through a visor; turns red with "ABORT / RETURN TO HABITAT" in an emergency.
- Same plan as the habitat console; nothing re-entered.

**Visual:** two HUD screenshots: normal (cyan) and abort (red). Optional: a stop detail card with the Perseverance photo of the next stop.

## 8. What's new

- Built for a **person in a spacesuit**, not a rover.
- **Safe-return zone** computed live over real terrain.
- **Science per oxygen-minute**: where you go is weighed against what it costs to get back. (Stop suggestions ranked this way are a stretch feature; check whether they shipped before claiming them.)
- **Time as a dimension**: when to walk (sun, temperature, dose), not just where.
- **"The AI explains, the planner decides"**: the routing is deterministic, so it's predictable, explainable and testable.

**Visual:** five icon tiles (Lucide icons) in a row, one per point. Small Apollo traverse map inset (Lunar and Planetary Institute, credited) as the heritage link.

## 9. Model assumptions (honest numbers)

- 8 h life support (Shuttle/ISS EMU rating); 45 min reserve (+30 min in a storm), our choice.
- Walking: 3 km/h on flat firm ground (Tobler 5 km/h × 3/5 off-path); slopes over 25° and dense boulders are no-go.
- Radiation: 0.64 mSv/sol Curiosity RAD baseline applied to Jezero; SPE ×30 illustrative.
- Sun from Mars24 at one fixed season (Ls 0°); temperature curve is a placeholder until MEDA data is loaded.

**Visual:** the "Model assumptions (slide-ready)" list from [`assumptions.md`](assumptions.md) as a two-column table, with a status chip on each row: Sourced (green), Assumption (amber), Placeholder (grey).

## 10. Sources

- Terrain: Mars 2020 TRN HiRISE DTM mosaic and orthomosaic (USGS Astrogeology).
- Sand: THEMIS-derived thermal inertia of Jezero (Edwards & Buz 2021). Science: CRISM MTRDR summary parameters (PDS Geosciences Node).
- Conditions: Curiosity RAD (Hassler et al. 2014; Zeitlin et al. 2018), Mars24 (Allison & McEwen 2000), Perseverance MEDA (Rodriguez-Manfredi et al. 2023).
- Full list with links: [`sources.md`](sources.md). Every source is also in the Space Apps References field.

**Visual:** text slide; small logos are **not** used (no agency logos). Put the repo URL and a QR code to `docs/sources.md` in the corner.

## 11. Team: The Ares Initiative

- Sathvik, Anish, Viren, Arjun. All share every role: data & GIS, planner, frontend, design, science & story.
- Built in about 48 hours for NASA Space Apps Challenge 2026, *Interplanetary Survival Guide: Martian Map*.
- Open source, MIT licence: `github.com/Csathvik245/ares`.
- **AI use:** say how AI tools were used (Space Apps requires disclosure; wording to be agreed by the team).

**Visual:** ARES mission patch (our own design) and team name. **No photos of team members** (under-18 rule). Decide as a team whether first names stay (see [`submission.md`](submission.md), open questions).

## 12. Next steps

- **Moon / Artemis version:** same planner on lunar terrain (LRO LOLA elevation, LROC imagery, Diviner thermal data) for the south-pole EVAs. Contracts stay the same; only the data and constants change.
- **ML hazard maps:** boulder and dune detection from HiRISE images (e.g. trained on AI4Mars) to replace the roughness proxy. The routing itself stays deterministic.
- **Live data:** real-time MEDA weather and NASA DONKI space-weather alerts driving the storm and SPE warnings, instead of buttons.
- Also: buddy mode (two astronauts plus a rover as a mobile safe haven), voice commands in the HUD, real suit metabolic rates.

**Visual:** three-column roadmap (Moon · ML · Live), each with a small image: an LRO view of the lunar south pole (NASA/GSFC/Arizona State University), a HiRISE boulder field crop, and a mock alert banner.

---

## 7-slide demo cut

Use this if the team submits slides instead of a video. It meets the 7-slide limit, including title and intro.

| # | Slide | Built from |
|---|---|---|
| 1 | Title: ARES, The Ares Initiative, challenge name, team member names (see under-18 note) | 11 |
| 2 | Problem + mission story | 1 + 2 |
| 3 | How ARES works + six data types | 3 + 4 |
| 4 | Safe-return zone | 5 |
| 5 | Emergencies + HUD | 6 + 7 |
| 6 | What's new + key assumptions | 8 + 9 |
| 7 | Next steps + sources link | 12 + 10 |

The guide asks the demo deck to show an image of the project, the user experience, how NASA data makes it possible, the team name, the team member names and the challenge ([Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/)). All six are covered above.
