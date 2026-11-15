# ARES: Space Apps project page text (draft)

Text to paste into our team's **Project** tab on spaceappschallenge.org. One section per form field, in the order of the [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/) ("Project Page Form Field Instructions").

**Before pasting:**
- No team member names anywhere. "The Ares Initiative" only (under-18 rule, see [`submission.md`](submission.md)).
- All text in English. Every link public and tested in a private window.
- Re-check every number against the live app; the numbers below were measured on the real terrain (commit `b18348f`).
- Fill the two **TEAM** links below (video and repo). Data credits come from [`sources.md`](sources.md); the AI answer comes from [`ai-disclosure.md`](ai-disclosure.md).

---

## Project Name

ARES: Astronaut Route & EVA Safety system

## High-Level Project Summary

ARES is a route planner for an astronaut walking on Mars. It is built for a single spacewalk at Jezero Crater's ancient river delta, where carbonate and clay layers may preserve signs of past life. The astronaut picks science stops. ARES combines NASA terrain, thermal, mineral and radiation data to plan the fastest safe walk around steep slopes, boulders and soft sand. It adds up walking time, oxygen and radiation dose, and draws a safe-return zone: everywhere the astronaut can still reach and get home from with the oxygen reserve intact. A GO / CAUTION / NO-GO status always states its reason. Dust storm and solar particle event simulations abort the EVA and give an instant route home. The challenge asks for a layered, hyperlocal map that helps a human explorer plan and carry out a Marswalk while doing science; ARES answers it at the scale of one EVA and puts astronaut safety first.

## Link to Project Demo

**TEAM: paste the public YouTube link** to the 30-second caption-only video once it is uploaded (script: [`video-script.md`](video-script.md)).

## Link to Final Project

- Live app: https://ares-mars-alpha.vercel.app
- Code and docs: **TEAM: paste the public GitHub repo link** (MIT licence). The current repo address contains a teammate's GitHub username; decide whether to use it or move the repo to a team account first (under-18 rule).

## Detailed Project Description

**What it does.** ARES is a mission console for planning one Marswalk, plus a helmet display for carrying it out.

- **Layered map** of the Jezero delta front (about 6 × 8 km) with toggleable layers: walking difficulty, slope, soft sand risk, boulders (terrain roughness) and science value. Each layer names its data type and NASA source.
- **Route planner.** Click to add science stops and set how long to stay at each. ARES finds the fastest safe route from the habitat through every stop and back.
- **Oxygen budget and safe-return zone.** A gauge shows oxygen left at return and the margin above a 45-minute reserve. An electric-blue boundary shows everywhere still reachable with a safe walk home; it shrinks as stops are added.
- **Status light.** GO, CAUTION or NO-GO, always with the reason written out, never colour alone.
- **Sol timeline.** Play or scrub the walk across the Martian day; the astronaut marker moves while sun elevation, temperature and radiation dose update.
- **Emergencies.** A dust storm or solar particle event aborts the EVA (NO-GO), collapses the zone and draws an abort route home from the astronaut's current position. The walk home gets its own status, usually CAUTION.
- **Helmet HUD.** A full-screen minimal view: heading, next stop and distance, oxygen, return margin and dose; it turns red in an abort.

Demo mission on real terrain: three stops: Séítah outcrop "Brac" and Máaz lava rock "Sid", both Perseverance sampling sites, and between them the delta front toe, a new clay target ARES selected from CRISM data. The loop is 4.97 km and takes about 3.5 hours (3 h 35 min), with 49% oxygen at return (about 192 minutes above the reserve). Status: GO.

**How it works.**

1. **Data → grid.** Python scripts clip NASA and USGS datasets to the site, reproject them onto one Mars sphere (radius 3,396.19 km) and resample them to a 320 × 240 grid of 25 m cells.
2. **Grid → cost.** Walking speed in each cell follows a version of Tobler's hiking function: 3 km/h on flat firm ground, slower on slopes, in soft sand (low thermal inertia) and over rough ground. Slopes over 25° and very rough cells are no-go.
3. **Cost → route.** Dijkstra and A\* search find the fastest safe path between stops. The planner is deterministic, with no machine learning in safety decisions, so every route is predictable, explainable and tested.
4. **Route → safety.** Walking and science time become oxygen use (walking burns more than standing work), then margin and status. A search from the habitat gives the walk-home time from every cell; that powers the safe-return zone and the abort route.
5. **Environment.** Sun elevation uses NASA GISS's Mars24 algorithm. Radiation uses the Curiosity RAD surface baseline, applied to Jezero. A dust storm slows walking because of low visibility and dust on the visor, not wind: Mars air is about 1% as dense as Earth's.

**Validation.**

- **Perseverance's real drive.** We compared the terrain model with 20.57 km of the rover's real path, which was not used to build it. ARES rates 99.8% of that path as passable, and our slope layer agrees with the rover's own tilt sensor (r = 0.82). Details: [`validation.md`](validation.md).
- **Machine learning check.** We trained a machine-learning model (maximum margin planning) on 31 of Perseverance's real drives to learn how NASA's drivers choose routes. Tested on routes it had not seen, it could not beat our physics planner (24.8 m vs 35.3 m for a straight line), so the planner stays deterministic and the ML serves as independent validation. The model saw 15.38 km of drives, and both planners end up on average 24.8 m from the drivers' routes. Details: [`route-learning.md`](route-learning.md).

Every number is either sourced or labelled as our assumption; the full list is in [`assumptions.md`](assumptions.md). For example, the solar particle event dose multiplier (×30) is illustrative, about ten times larger than the biggest event RAD has measured.

**Benefits.** Existing Mars maps are regional or global. ARES works at the scale of one EVA and answers the astronaut's real questions: where is it safe to walk, where is the best science, and when is it safe to be outside? The safe-return zone borrows from aviation's point of no return and Apollo walkback limits, but computes it live over real terrain.

**What we hope to achieve.** A planning tool that mission planners and astronauts could trust because every decision is explainable: the same inputs always give the same route and status, and every number shows its source.

**Tools.** TypeScript, React, Vite and Leaflet (equirectangular map, matching NASA Mars Trek tiles) for the app; Vitest for tests; Python (numpy, rasterio, matplotlib, Pillow) for the data pipeline; Vercel for hosting. AI coding and chat assistants helped build the project; see the SI answer below.

**What's next.**

- **Moon / Artemis version:** the same planner on lunar south-pole terrain (LRO elevation and imagery).
- **ML hazard maps:** boulder and dune detection from HiRISE images, replacing the roughness proxy. Routing stays deterministic.
- **Live data:** Perseverance MEDA weather and NASA DONKI space-weather alerts driving the storm and radiation warnings.
- Buddy mode (two astronauts and a support rover), real suit metabolic rates, and voice commands in the HUD.

## Use of Super Intelligence (SI)

Paste the "Disclosure" section of [`ai-disclosure.md`](ai-disclosure.md). Short version (judges don't see this field, so the full text also goes in the README and repo):

> Yes. The Ares Initiative used AI coding assistants, Claude Code (Anthropic) and ChatGPT (OpenAI), to write and review code and documentation. Early on, we used an AI assistant to brainstorm options. The team chose and developed the ARES concept from a teammate's design document, and decided its scope, data, methods and validation. After that, an AI chat assistant (Claude, by Anthropic) helped with planning, task breakdown, code review and debugging. All route and safety decisions in the app come from deterministic algorithms (Dijkstra / A\* on a terrain grid with documented formulas), not AI. We also trained our own small machine-learning model on Perseverance drive data as a validation check; it is off by default and did not beat the deterministic planner. The code for an in-app AI chat assistant is in our repository but is not enabled in the submission. Our mission patch is AI-generated. It carries a visible "AI-generated" label wherever it appears as an image, and it uses no NASA branding. Details: docs/ai-disclosure.md in our repository.

## NASA Data

At least one NASA data source is required for a Global Award ([Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/)). ARES uses:

- **Elevation, slope and roughness:** Mars 2020 Terrain Relative Navigation HiRISE DTM Mosaic, 1 m/pixel (USGS Astrogeology, Fergason et al. 2020, doi:10.5066/P9REJ9JN), from MRO HiRISE stereo.
- **Basemap:** Mars 2020 TRN HiRISE orthorectified image mosaic (USGS Astrogeology), plus NASA Mars Trek tiles (JPL).
- **Soft sand:** THEMIS-derived thermal inertia of Jezero Crater, 100 m/pixel (Mars Odyssey THEMIS; Edwards & Buz 2021, doi:10.5281/zenodo.4931348).
- **Science value:** MRO CRISM MTRDR summary parameters for Fe/Mg clay and carbonate (PDS Geosciences Node).
- **Radiation:** Curiosity RAD surface dose (Hassler et al. 2014; Zeitlin et al. 2018 for solar particle events).
- **Sun position:** NASA GISS Mars24 algorithm (Allison & McEwen 2000).
- **Science stops:** Perseverance sampling sites from the Mars 2020 Initial Reports.
- **Context:** Perseverance MEDA (Jezero weather), NASA NSSDC Mars Fact Sheet, NASA EVA and spacesuit references for oxygen and walking limits.

Full list with links: [`sources.md`](sources.md).

## Space Agency Partner Data and Other References

List **every** data source, paper, image, library and tool, even open-source ones ([Terms](https://www.spaceappschallenge.org/legal/), "Use of Third-Party Materials"). Paste the tables from [`sources.md`](sources.md), then add:

- Papers and references: Tobler 1993 (hiking function); Allison & McEwen 2000 (Mars24); Hassler et al. 2014 and Zeitlin et al. 2018 (RAD); Edwards et al. 2009 (THEMIS bedrock); Horgan et al. 2020 (Jezero carbonates); Viviano-Beck et al. 2014 (CRISM parameters); Rodriguez-Manfredi et al. 2023 (MEDA); Gernhardt et al. 2008 and Chullen et al. 2023 (suits and EVA).
- Software (with licences, read from each installed package on 14 Nov 2026): React and React DOM (MIT), Leaflet (BSD-2-Clause), Vite (MIT), TypeScript (Apache-2.0), Vitest (MIT); pipeline: numpy (BSD-3-Clause), SciPy (BSD-3-Clause), rasterio (BSD-3-Clause, built on GDAL, MIT; not installed on the machine we checked, so this one is from our earlier notes: confirm on its project page), matplotlib (matplotlib licence, PSF-based), Pillow (MIT-CMU). QGIS was not used.
- Fonts: Space Grotesk, Inter, JetBrains Mono, IBM Plex Sans and IBM Plex Mono (SIL Open Font License, via Google Fonts).
- AI tools: Claude Code (Anthropic), ChatGPT (OpenAI). See [`ai-disclosure.md`](ai-disclosure.md).
- Images: NASA/JPL-Caltech plus the instrument team named with each image.
- Space Agency Partner data: none used.
- Our own code and docs: MIT licence.

## Challenge addressed

*Interplanetary Survival Guide: Martian Map* ([challenge page](https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/)). The challenge asks for "a layered, integrated view of a location or route on the Martian surface that pulls together data from multiple NASA science missions and could help a human explorer plan and carry out a successful Marswalk while conducting new and exciting science along the way." ARES layers six NASA data types for one EVA route at Jezero, puts astronaut safety (oxygen, terrain, radiation, space weather) first, offers a habitat console and a helmet HUD, and is built around a science objective: sampling the delta's carbonates and clays.
