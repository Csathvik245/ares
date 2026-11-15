# ARES — AI use disclosure

Space Apps 2026 uses the term **"Artificial Intelligence (AI)"** for AI tools, including large language models, chat assistants and code generation tools ([Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), "Use of Artificial Intelligence"). **Flag:** the [Participant FAQs](https://www.spaceappschallenge.org/resources/participant-faqs/) no longer appear to have a dedicated "What is AI/SI" section; see the note at the end of this file. Teams must say where and how they used these tools. This file is our disclosure: the "descriptive text" the rules ask for. It is linked from the README and the project page.

> **Two questions in this file are marked "TEAM: confirm"**: the brainstorming rule (item 3) and whether the mission patch is AI-generated (item 6). Only the team can answer them; nothing else is open. Before submitting, also re-read the official [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/) ("Use of Artificial Intelligence") in case it changed. The wording we read on 14 Nov 2026 is quoted at the end of this file.

---

## Disclosure (for the project page and the AI form field)

**Did we use AI tools? Yes.**

1. **Coding assistants.** The Ares Initiative used AI coding assistants, **Claude Code (Anthropic)** and **ChatGPT (OpenAI)**, to write and review code and documentation across the project: the route planner, the web app, the data-processing scripts, the unit tests, and the project docs (including this file, the README, the video script and the slides). Team members gave the instructions, reviewed the output, ran the tests and decided what to keep.
2. **Brainstorming with an AI chat assistant.** Early on, we used an AI chat assistant (**Claude, by Anthropic**) to brainstorm. The AI proposed early concept options. These included a "walkback zone" showing where the astronaut can still return from, Jezero Crater as one candidate site, a route planner and a helmet display.
3. **The design document.** A team member then wrote the ARES design document, and the team chose it as our project. It shares several of the elements the AI proposed in brainstorming. That document is the source for our shared rules and contracts in the repo (`CLAUDE.md`). After that, the AI chat assistant helped with planning, breaking the work into tasks, code review and debugging.

> **TEAM: confirm** with our Local Lead that this brainstorming is allowed, before submitting. An older rule said AI should not be used to come up with the idea; we could not find it on the current official pages (see the note at the end of this file), so we are not assuming either way.

4. **No AI in route or safety decisions.** Every route, oxygen number, safe-return zone, abort route and GO / CAUTION / NO-GO status in the app comes from **deterministic algorithms**: Dijkstra and A\* search on a terrain grid, with fixed formulas and constants documented in [`assumptions.md`](assumptions.md). No machine-learning model or AI service makes or changes these decisions. The same inputs always give the same answer, and the planner has unit tests.
   - **Our own trained model, trained on Perseverance drive data (separate from the AI chat tools).** We trained a small route-cost model ourselves: seven terrain weights, no neural network, no AI service. `pipeline/learn_route_cost.py` learns it from Perseverance's real drive routes (NASA's traverse file) with maximum margin planning. It is **off by default**. The planner only uses it if a caller passes it to `planRoute` as `routeGrid`, and the app has no button for it. Even then it can only change a route's shape: no-go ground stays no-go, its weights may never be less careful than the physics model, and time, oxygen and status are still worked out by the deterministic model. In testing it did not beat the physics model; the method and results are in [`route-learning.md`](route-learning.md). This is our own machine learning on NASA data. It is not generative AI, and it is separate from the AI coding and chat tools described in this file.
5. **Data is NASA's, not AI-generated.** The terrain, thermal and mineral layers come from NASA and USGS datasets listed in [`sources.md`](sources.md). AI tools helped write the scripts that process this data; they did not create the data values.
6. **Media.** Our demo video is a screen recording of the app with captions and no voice. Our rover and orbital images are NASA's, credited in [`sources.md`](sources.md).
   - **Mission patch (`app/public/brand/ares-patch.png`, also in `site/`): TEAM: confirm whether it is AI-generated.** We have not decided this. What we found: the file carries an embedded content-credentials (C2PA) record naming the software "ChatGPT" (version "gpt-image") and the claim generator "OpenAI Media Service API", with the source type `trainedAlgorithmicMedia` (the standard code for AI-generated images). If it is AI-generated, the rules require a **visible watermark** saying so on the patch wherever it appears (app, website, slides, video), and this line should say "AI-generated". If a team member drew it, say so here and explain the record. The file in the repo is now a resized copy (192 × 160) that no longer carries that record; the original with the record is in the git history. It has no NASA logo or wordmark.
7. **No NASA branding** (logos, flags, mission identifiers) was generated or modified with AI.

## Which folders were AI-assisted

"AI-assisted" means an AI coding assistant wrote or edited some of the files, and a team member reviewed them.

| Path | What's in it | AI-assisted? |
|---|---|---|
| `app/src/planner/` | Route planner, oxygen, safe zone, abort route, environment model, tests | Yes |
| `app/src/` (other folders) | React frontend: map, mission panel, timeline, HUD, adapters, tests | Yes |
| `app/` config (`vite.config.ts`, `tsconfig.json`, `index.html`) | Build setup | Yes |
| `pipeline/` | Python scripts that turn NASA data into `site.json` and the basemap, plus `learn_route_cost.py` (trains and tests our route-cost model) | Yes |
| `app/public/data/route-model.json`, `pipeline/data/route_learning.json` | Our trained route-cost model and its test scores | **Generated by our training script** from NASA's Perseverance traverse (the script was AI-assisted; the weights are learned from NASA data, not written by an AI tool) |
| `app/public/data/site.json`, `basemap.png` | Terrain grid and basemap | **Generated by our pipeline scripts** from NASA/USGS data (the scripts were AI-assisted; the values are NASA data) |
| `docs/` | Sources, assumptions, submission rules, video script, slides outline, project page, this disclosure | Yes |
| `README.md`, `CHECKLIST.md`, `CLAUDE.md` | Project overview, task list, team rules and contracts | Yes (written from our design document) |
| `backend/`, `app/src/ai/` | In-app AI assistant (see [AI assistant in the app](#ai-assistant-in-the-app)) | Yes. The assistant is itself an AI feature. **It is not enabled in the submission** |
| `app/public/brand/ares-patch.png` | Mission patch | **TEAM: confirm** (see item 6 above) |

**Metadata.** The rules ask for acknowledgement in "descriptive text and metadata" for code. Our acknowledgement is this file, the README's "AI use" section that links to it, and the table above, which names every AI-assisted folder. Our commit messages do not carry AI attribution lines (a team repo rule), so this file is where the disclosure lives.

---

## AI assistant in the app

**Not enabled in the submission.** The code for an optional chat assistant is in the repo, but it is not mounted in the app (the panel file is `app/src/ai/ChatPanel.experimental.tsx`, which the app does not load), its server is not deployed, and judges will not see it. It is disclosed here because it is an AI feature and its code is public.

- **Model:** Claude Opus 5.5 (`claude-opus-5-5`), by Anthropic, called through Anthropic's API from one server function (`backend/api/assistant.ts`). If Anthropic's safety checks decline a request, the API may answer it with a fallback Claude model instead.
- **What it does:** it explains the current plan in plain words: why the route goes where it does, what a dust storm at a given moment would mean, what a map layer shows and where it comes from, and which extra stops the planner suggests.
- **How it gets its facts:** it has nine tools, and each tool is a call to the deterministic planner running in the browser (`app/src/ai/tools.ts`). The model asks for a tool; the browser runs it and sends the result back. The model is told to state numbers only from those results and to say "I don't know" when a tool cannot answer.
- **What it cannot do:**
  - It cannot change the route, the oxygen numbers or the GO / CAUTION / NO-GO status. Those come only from the planner, with or without the assistant.
  - It cannot change the plan. When it tries adding, removing or reordering stops, that changes a draft only. The astronaut must press **Apply to plan**.
  - It cannot start an emergency. Its dust-storm tool is a calculation, not an event.
  - It has no access to the terrain files, the internet or anything outside its nine tools.
- **Limits we know about:** a language model can still word something wrongly or misread a tool result. That is why the planner's own status and reason are always shown above the chat, and why the assistant never decides anything. The tool loop is tested with a scripted stand-in for the model (`app/src/ai/assistant.test.ts`). It has not been run against the live model.
- **In the judged build:** not live (see the top of this section). The rest of the app does not depend on it.
- **Data sent to Anthropic:** the questions typed into the chat and the plan facts from the tools (stop names and coordinates on Mars, times, oxygen numbers, status). No personal data is asked for. The API key stays in a server environment variable and is never in the repo or the browser.

---

## Decisions

| Question | Answer |
|---|---|
| Brainstorming vs. the "idea" rule | **TEAM: confirm** with our Local Lead (item 3 above) |
| Is the mission patch AI-generated? | **TEAM: confirm** (item 6 above) |
| Which tools were used | Claude Code (Anthropic) and ChatGPT (OpenAI) for code and docs; Claude (Anthropic) for brainstorming and planning (items 1–3) |
| Is the in-app assistant in the submission? | No. Code only, not mounted, server not deployed |
| `pipeline/` | AI-assisted scripts; NASA data values (table above) |
| Our own machine learning | The route-cost model, trained by us on Perseverance drive data; off by default (item 4) |
| Metadata | This file + the README link + the folder table |

---

## Official wording we read (14 Nov 2026)

From the NASA Space Apps [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), section "Use of Artificial Intelligence":

- "The use of Artificial Intelligence (AI) tools is permitted for the NASA Space Apps Challenge."
- **Generated content restriction:** AI-generated content may not use, contain, or modify any NASA branding or design elements.
- **Disclosure requirement:** teams must clearly indicate where and how AI tools were utilized in their project.
- **Images/video:** must include a visible watermark indicating AI generation.
- **Audio:** must acknowledge AI generation in descriptive text and metadata.
- **Code and data:** must acknowledge AI generation in descriptive text and metadata.
- **Judging note:** judges will consider originality, intent, and execution in the context of AI-assisted work.

> **⚠ VERIFY BEFORE SUBMITTING (team):**
> - The [Participant FAQs](https://www.spaceappschallenge.org/resources/participant-faqs/) page no longer appears to have a dedicated "What is AI/SI" section.
> - The earlier restriction that AI "should not be used to (come up with your idea of how to solve the challenge)" was **NOT found verbatim** on the current Project Submission Guide or Participant FAQs pages as of 14 Nov 2026.
> - Do **not** assume it still applies, and do **not** assume it has been removed. Check it directly against the **Participant Terms & Conditions** before submitting (this is the "TEAM: confirm" in item 3).
