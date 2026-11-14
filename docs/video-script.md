# ARES demo video script (30 seconds, captions only)

This is the video we submit as the Space Apps **Link to Project Demo**.

**Rules this script follows** (details and links in [`submission.md`](submission.md)):

- **30 seconds or less.** Longer videos are not eligible for Global Judging ([Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), "Limitations").
- **No names, voices or likenesses of anyone under 18** ([2026 Participant Terms and Conditions](https://www.spaceappschallenge.org/legal/)). Our team is under 18, so the video has **no voiceover, no faces and no names**. It is a **screen recording of the app with captions added in editing**. The only name on screen is "The Ares Initiative".
- **English captions** ([Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), "Language Requirements").
- **AI disclosure.** If any AI tool makes images, video, music or captions for the video, images and video need a visible watermark, and audio must be acknowledged in the description and metadata. See [`ai-disclosure.md`](ai-disclosure.md). The plan below uses no AI-generated media.
- **No NASA logo**, flags or mission insignia in our own graphics. Data credits go in the end card.

**Caption reading speed:** about **3 words per second**. Each caption below shows its word count and the most words its time allows.

**Emergency rule (as the app shows it):** when a dust storm starts, the **EVA is aborted, so mission status is NO-GO**. The **walk home has its own status** in the red banner (`Walk home: … · margin … min · <status>`), usually **CAUTION**: still inside the reserve, but a storm is active. Captions must say both and never call the abort "GO".

**Demo mission:** **Load demo mission** gives 3 stops on the real terrain: Séítah outcrop (Brac), Delta front toe (a new clay target ARES selected from CRISM data), Máaz lava rock (Sid). The planner measured **4.97 km, 3 h 35 min (about 3.5 hours), about 192 min margin, 49% oxygen at return, GO** (commit `b18348f`). Check the numbers on screen before recording.

---

## Main script: 30 seconds

| Time | On screen (screen recording) | Caption (added in editing) | Words / max | Clicks to record this shot |
|---|---|---|---|---|
| 0:00–0:04 | Opening briefing screen: ARES patch, "2040 MISSION SCENARIO", Jezero, LIFE SUPPORT 8 HRS | **ARES · The Ares Initiative**<br>NASA Space Apps 2026 · Martian Map | 10 / 12 | Fresh load of the app URL. Hold still. |
| 0:04–0:07 | Same screen; cursor moves to **BEGIN PLANNING** and clicks | **2040. Jezero Crater. 8 hours of oxygen.** | 7 / 9 | Click **BEGIN PLANNING** at the end of the shot. |
| 0:07–0:12 | Console. Layers switch on fast: Slope → Soft sand risk → Science value. Layer cards show their NASA source. | **NASA HiRISE, THEMIS, CRISM data → one walking map** | 8 / 15 | In **Terrain layers** (left), tick **Slope**, **Soft sand risk**, **Science value**, one per second (cut to 2× speed if needed). |
| 0:12–0:16 | **Load demo mission**: three numbered orange stops, orange route draws in | **Pick science stops. ARES plans the safest route.** | 8 / 12 | Click **Load demo mission** (right panel). Don't move the mouse while the route draws. |
| 0:16–0:19 | Cyan safe-return zone, oxygen ring, status pill **GO** | **Cyan: everywhere she can still get home from. GO.** | 9 / 9 | Hover over the **GO** status. |
| 0:19–0:22 | Playback: astronaut marker walking after stop 2; click **Simulate dust storm**; red banner **DUST STORM · ABORT EVA**; status **NO-GO** | **Dust storm. EVA aborted: NO-GO.** | 5 / 9 | Pre-set the slider (see checklist), press **Space** to play, then click **Simulate dust storm** (right panel, *Conditions*) after about 2 s. |
| 0:22–0:26 | Zone collapses; red abort route home; banner shows `Walk home … · CAUTION` | **Safest way home: CAUTION, still inside the oxygen reserve.** | 9 / 12 | Hold still; hover over the banner's walk-home line. |
| 0:26–0:28 | Helmet HUD (abort mode, red): ABORT / RETURN TO HABITAT, oxygen, margin, dose | **Same plan, in her helmet.** | 5 / 6 | Press **H**. |
| 0:28–0:30 | End card: ARES patch, tagline, credit line "Data: NASA/JPL-Caltech, USGS, ASU" | **Science first. Safety always.** | 4 / 6 | Made in the editor (no app). |

**Total: 30 seconds, 65 words of captions.**

Caption style: Inter or Space Grotesk, white (`#ECEAE6`) on a dark bar (`#08090B` at 80% opacity), bottom centre, at least 36 px tall at 1440 × 900. Put status words in their colours: **GO** `#3DDC97`, **CAUTION** `#FFB020`, **NO-GO** `#FF4D5A`, always with the word (never colour alone).

This order follows the guide's 30-second outline: team and challenge first, then the project name, how it works, and the payoff ([Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), "Video Demo"). There's no time for a "future" line; it goes on the project page ([`project-page.md`](project-page.md)).

---

## Shot list

Record each shot as its own clip in a **1440 × 900** browser window, with 2 s of spare footage at both ends. Cut and caption in the editor.

| # | Shot | Capture | Start state | Used at |
|---|---|---|---|---|
| S1 | Briefing screen idle → BEGIN PLANNING | 10 s | Fresh load of the live URL | 0:00–0:07 |
| S2 | Layers on one by one | 8 s | Console, no stops, all layers off | 0:07–0:12 |
| S3 | Load demo mission → route draws → safe zone → GO | 10 s | Layers: Walking difficulty + Science value | 0:12–0:19 |
| S4 | Playback after stop 2 → dust storm → NO-GO → abort route → banner with CAUTION | 12 s | Demo loaded, slider pre-set just after stop 2 | 0:19–0:26 |
| S5 | Helmet HUD in abort mode | 5 s | Straight after S4, press **H** | 0:26–0:28 |
| S6 | End card | 3 s | Editor | 0:28–0:30 |
| B1 | (Backup) Solar particle event instead of storm | 12 s | Reset, slider after stop 2, **Simulate solar particle event** | Spare |
| B2 | (Backup) **Data sources** dialog | 5 s | Click **Data sources** | Spare / slides |
| B3 | (Backup) Stop 1 (Brac) **Details** card with photo (stop 2 has no rover photo) | 5 s | After reset; only if photos have landed | Spare / slides |

---

## Pre-recording checklist

**Rules**
- [ ] Final export is **30 s or less** (check the file length, not just the timeline)
- [ ] **No voiceover**, no faces, no webcam, no names except "The Ares Initiative"
- [ ] No personal details visible: browser profile picture, account names, bookmarks, file paths, notifications
- [ ] Captions in English, each on screen long enough to read (≈ 3 words per second)
- [ ] Any music is our own or licensed for reuse; licence listed in the References field. If music is AI-generated, acknowledge it in the video description and metadata
- [ ] No AI-generated images or video. If any are added, they carry a visible watermark
- [ ] No NASA logo, flags or mission insignia in the end card or captions

**App state**
- [ ] Live URL (https://ares-mission-console.vercel.app) is deployed from the latest `main` and shows the real NASA terrain (the **Data sources** dialog lists HiRISE, THEMIS and CRISM)
- [ ] **Load demo mission** is enabled on the live URL (it is disabled when the deployed `site.json` has no demo stops). It gives 3 stops and **GO**; write down the real distance, duration and margin
- [ ] Start LMST left at **13**, so the sun stays above 10° and the plan stays GO
- [ ] Fresh browser profile or private window, no extensions, bookmarks bar hidden, zoom 100%
- [ ] Browser content area **exactly 1440 × 900**, on a screen where it fits without scaling
- [ ] Map panned and zoomed so the habitat, all 3 stops and the delta front fit on screen
- [ ] Basemap imagery loaded (or the hillshade fallback looks clean); no grey missing tiles
- [ ] For S4: drag the **EVA timeline** slider until the status line reads `walk` just after the second science block (stop 2, Delta front toe), then pause and start recording
- [ ] After the storm click, the banner shows `DUST STORM · ABORT EVA`, the mission status is **NO-GO**, and the walk-home line ends in **CAUTION**. If the walk-home status differs, change the 0:22 caption to match the screen
- [ ] DevTools console shows no errors (then close DevTools)

**Recording and editing**
- [ ] Do Not Disturb on; dock, menu-bar clock and other windows hidden
- [ ] Screen recorder set to the 1440 × 900 window, 30 or 60 fps, system audio off
- [ ] Practise each shot twice against the table timings
- [ ] Add captions in the editor (not burned into the app); check spelling of Séítah, Máaz, Jezero
- [ ] Export MP4 (H.264), 1440 × 900 or 1920 × 1080 with letterbox
- [ ] Upload to YouTube as **Unlisted or Public**; description lists data credits, links to the repo, and states AI use (see [`ai-disclosure.md`](ai-disclosure.md))
- [ ] Test the link in a private window with no login

---

## Appendix: 60-second version — NOT FOR SUBMISSION

> ⚠️ **Not for submission.** Over the 30-second limit, so it is not eligible for Global Judging. Use it only for local judging (if the Local Lead allows), the project page or social media. It follows `CLAUDE.md` section 9 and uses the same caption-only rules: no voiceover, no faces, no names.

| Time | On screen | Caption | Words / max | Clicks |
|---|---|---|---|---|
| 0:00–0:04 | Briefing screen | **ARES · The Ares Initiative**<br>NASA Space Apps 2026 · Martian Map | 10 / 12 | Fresh load |
| 0:04–0:08 | Briefing screen, click BEGIN PLANNING | **2040. Jezero Crater. 8 hours of oxygen. 5 km of unknown terrain.** | 12 / 12 | **BEGIN PLANNING** |
| 0:08–0:13 | Layers on: Slope, Soft sand risk | **Slope from HiRISE elevation. Soft sand from THEMIS.** | 8 / 15 | Tick **Slope**, **Soft sand risk** |
| 0:13–0:18 | Layers on: Boulders, Science value | **Boulders from HiRISE roughness. Clays and carbonates from CRISM.** | 9 / 15 | Tick **Boulders**, **Science value** |
| 0:18–0:23 | Load demo mission, route draws | **Three science stops. The fastest safe route around cliffs and sand.** | 11 / 15 | **Load demo mission** |
| 0:23–0:28 | Safe zone, oxygen ring | **Cyan zone: everywhere she can reach and still get home.** | 10 / 15 | Hover oxygen ring |
| 0:28–0:32 | Status GO with reasons | **Oxygen margin healthy. Status: GO.** | 5 / 12 | Hover **GO** |
| 0:32–0:37 | Playback after stop 2, storm starts, NO-GO | **Dust storm hits. EVA aborted: NO-GO.** | 6 / 15 | **Space**, then **Simulate dust storm** |
| 0:37–0:41 | Zone collapses, red abort route | **ARES plots the safest way home, instantly.** | 7 / 12 | Hold |
| 0:41–0:45 | Banner walk-home line | **Walk home: CAUTION, but inside her oxygen reserve.** | 8 / 12 | Hover banner |
| 0:45–0:50 | Reset, stop 1 (Séítah outcrop, Brac) Details card with its rover photo | **Every stop: why it matters, and a real rover photo.** | 10 / 15 | **Reset emergency and playback**, then **Details** on stop 1. Not stop 2: Perseverance never went to the delta front toe, so it has no rover photo |
| 0:50–0:55 | Helmet HUD | **Outside, the same plan becomes her helmet display.** | 8 / 15 | **Esc**, then **H** |
| 0:55–1:00 | End card | **ARES, by The Ares Initiative. Science first. Safety always.** | 9 / 15 | Editor |
