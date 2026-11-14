# ARES demo video script

> ⚠️ **Length rule.** Space Apps 2026 accepts a demo video of **30 seconds or less**. Longer videos are **not eligible for Global Judging** ([Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), "Limitations"; details in [`submission.md`](submission.md)).
> The **60-second version** below follows `CLAUDE.md` section 9 and suits local judging, the project page or social media. **Submit the 30-second cut** at the end of this file, unless the team agrees to submit a slide deck instead.

**Under-18 rule:** no recognisable faces, voices or names of anyone under 18 ([FAQ](https://www.spaceappschallenge.org/resources/participant-faqs/); [Terms](https://www.spaceappschallenge.org/legal/)). So the video is **screen recording only**. Use a narrator aged 18 or older, or on-screen captions with no voice. An AI text-to-speech voice counts as AI ("SI") audio and must be disclosed in the description text and the file metadata. AI-generated images or video need a visible watermark.

**Emergency rule (as the app shows it).** When a dust storm or solar particle event starts, the **EVA is aborted, so the mission status is NO-GO**. The **walk home has its own status**, shown in the red banner as `Walk home: … · margin … min · <status>`. It is usually **CAUTION**: the walk home is still safe, but a storm or SPE is active, and that is always CAUTION (Contract 3). Say both in the voiceover; never call the abort itself "GO".

**Demo mission** (real terrain, three Perseverance-region stops, loaded with **Load demo mission**):

| # | Stop | Why it matters |
|---|---|---|
| 1 | Séítah outcrop (Brac) | Perseverance sampling site, crater-floor igneous rock |
| 2 | Delta front toe | Chosen from the CRISM clay/carbonate layer, base of the ancient delta |
| 3 | Máaz lava rock (Sid) | Perseverance sampling site, close to the habitat |

Measured by the planner: **4.97 km, 3 h 35 min, about 192 min margin, GO** (commit `b18348f`). Check these on screen before recording; they change if the terrain or constants change.

Voiceover pace: about **2.5 words per second**. Each line below is counted to fit its slot.

---

## 60-second script

| Time | On screen | Voiceover (words) | Exact clicks / keys |
|---|---|---|---|
| 0:00–0:08 | Opening briefing screen: ARES patch, "2040 MISSION SCENARIO", Jezero site, science objective, LIFE SUPPORT 8 HRS, RETURN RESERVE 45 MIN | "2040. Jezero Crater. Eight hours of oxygen, a sample kit, and four kilometres of unknown terrain." (16) | Start on the briefing screen (app root URL, fresh load). Hold still for 5 s, slowly move the cursor to **BEGIN PLANNING**, click at ~0:07. |
| 0:08–0:18 | Planning console. Terrain layers switch on one at a time: Slope → Soft sand risk → Boulders → Science value. Each card shows data type and source. | "ARES layers NASA data: HiRISE elevation, THEMIS thermal inertia for soft sand, CRISM minerals for science." (17) | In **Terrain layers** (left), tick **Slope** (0:09), **Soft sand risk** (0:11), **Boulders** (0:13), **Science value** (0:15). At 0:17 untick all but **Walking difficulty** and **Science value**. |
| 0:18–0:32 | Three numbered orange stops appear; orange route draws; cyan safe-return zone shrinks; oxygen ring and margin update; status **GO** | "She picks three science stops. ARES finds the fastest safe route around cliffs and sand, and draws everywhere she can still reach and get home. Status: GO." (28) | Click **Load demo mission** (right panel) at 0:19. Hover the cursor over the oxygen ring at 0:25, then over the **GO** status and its reasons at 0:29. |
| 0:32–0:45 | Playback: astronaut marker walks; LMST clock runs; storm starts after stop 2; red banner **DUST STORM · ABORT EVA**; status **NO-GO**; zone collapses; red abort route home; banner shows walk-home time, margin and **CAUTION** | "Mid-walk, a dust storm hits. EVA aborted: NO-GO. ARES instantly plots the safest way home, slower in low visibility, still inside her oxygen reserve." (24) | Before recording, pre-set the slider (see checklist). At 0:32 press **Space** (Play). At ~0:36 click **Simulate dust storm** (right panel, *Conditions*). Hold. At 0:42 hover over the banner's `Walk home … · CAUTION` text. |
| 0:45–0:55 | Stop detail card for stop 2 (photo if available), then full-screen Helmet HUD: heading, NEXT SCIENCE STOP, distance, oxygen, return margin, dose; HUD shows ABORT / RETURN TO HABITAT | "Outside, the same plan becomes her helmet display: heading, next stop, oxygen, margin and radiation dose." (16) | Click **Reset emergency and playback** at 0:45, then **Details** on stop 2's card (0:46). Close it with **Esc** at 0:50, then press **H** (Helmet HUD) at 0:51. |
| 0:55–1:00 | End card: ARES patch, "ARES, by The Ares Initiative. Science first. Safety always." Small credit line "Imagery and data: NASA/JPL-Caltech, USGS, ASU" | "ARES, by The Ares Initiative. Science first. Safety always." (9) | Press **Esc** to leave the HUD, cut to the end card (made in the editor, no NASA logo). |

Total spoken: about 110 words in 60 s.

**Note on the HUD shot:** if you want the HUD in abort mode ("ABORT / RETURN TO HABITAT", red), skip the reset. Press **H** straight after the storm shot, then do the Details shot. Pick one version and practise it.

---

## 30-second submission cut

Same recording, tighter edit. About 60 words. This is the version to upload as the **Link to Project Demo**.

| Time | On screen | Voiceover (words) | Clicks (record once, cut in editor) |
|---|---|---|---|
| 0:00–0:05 | Briefing screen, then BEGIN PLANNING | "The Ares Initiative, answering NASA's Martian Map challenge. This is ARES." (11) | Click **BEGIN PLANNING** at 0:04 |
| 0:05–0:12 | Layers flicking on (fast cut of the 60 s shot) | "It fuses HiRISE terrain, THEMIS sand and CRISM minerals into one walking map." (13) | Ticks from the layer shot, sped up 2× |
| 0:12–0:20 | Load demo mission → route, safe zone, GO | "Pick science stops; ARES plans the safest route, oxygen, and a safe-return zone. GO." (14) | **Load demo mission** |
| 0:20–0:27 | Storm → NO-GO, abort route, banner CAUTION, then 2 s of HUD | "Dust storm: EVA aborted, NO-GO. ARES routes her home, inside her oxygen reserve." (13) | **Space**, **Simulate dust storm**, then **H** |
| 0:27–0:30 | End card | "Science first. Safety always." (4) | — |

The guide's suggested 30 s order is: team, challenge, project name, how it works, future ([Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/)). This cut covers team, challenge and name at 0:00–0:05, how it works at 0:05–0:27, and the tagline at the end. There's no time for a "future" line; it goes on the project page instead.

---

## Shot list

Record each shot as its own clip at 1440 × 900, then edit. Get extra seconds at both ends of every clip.

| # | Shot | Length to capture | Start state | Notes |
|---|---|---|---|---|
| S1 | Briefing screen idle → BEGIN PLANNING | 12 s | Fresh load of the live URL | Cursor hidden until 0:05 |
| S2 | Layers on one by one | 15 s | Console, no stops, all layers off | Click slowly; pause 1 s on each layer's source line |
| S3 | Load demo mission → route draws → GO | 15 s | Layers: Walking difficulty + Science value | Route draws in over 600 ms; don't move the mouse until it finishes |
| S4 | Oxygen ring + stats close-up | 6 s | After S3 | Crop or zoom in the editor; numbers in JetBrains Mono must be readable |
| S5 | Playback walking | 8 s | Slider pre-set just after stop 2 | Astronaut marker must be visible on screen |
| S6 | Dust storm → NO-GO + abort route + banner with CAUTION | 12 s | Continues from S5 | Hold 4 s on the banner so viewers can read both statuses |
| S7 | (Optional) Solar particle event | 10 s | Reset, slider after stop 2 | Backup shot; banner reads SOLAR PARTICLE EVENT. SPE ×30 is illustrative; don't claim a real dose |
| S8 | Stop 2 Details card | 6 s | Planning, after reset | Shows photo + credit if photos have landed; otherwise skip |
| S9 | Helmet HUD | 8 s | Press H | Try both normal and abort versions |
| S10 | End card | 5 s | Editor | Patch + tagline + credits; no NASA logo |
| S11 | Data sources dialog | 5 s | Click **Data sources** | B-roll for the layers voiceover or the slides |

---

## Pre-recording checklist

**Rules**
- [ ] Final cut is **≤ 30 s** for submission (the 60 s version is for other uses only)
- [ ] No faces, voices or names of anyone under 18; narrator is 18+ or captions only
- [ ] English voiceover, or English subtitles if spoken in another language
- [ ] AI voice, music or images (if any) disclosed in the video description and metadata; AI images and video watermarked
- [ ] No NASA logo, flags or mission insignia in our end card or graphics. Credit "NASA/JPL-Caltech" + instrument team
- [ ] Music is our own or clearly licensed for reuse; licence listed in the References field

**App state**
- [ ] Live URL (https://ares-mission-console.vercel.app) is on the latest `main` and loads the real NASA terrain (the **Data sources** dialog lists the HiRISE, THEMIS and CRISM datasets)
- [ ] Fresh browser profile or private window: no extensions, bookmarks bar hidden, zoom 100%
- [ ] Browser window **exactly 1440 × 900** (content area), on a screen where it fits without scaling
- [ ] **Load demo mission** gives 3 stops, **GO**, about 4.97 km and about 192 min margin. Write down the real numbers if they changed
- [ ] Start LMST left at **13** (so the sun is above 10° and the plan stays GO)
- [ ] Map zoomed and panned so habitat, all 3 stops and the delta front fit on screen
- [ ] Basemap tiles loaded (or the hillshade fallback looks good); no grey missing tiles
- [ ] For S5/S6: drag the **EVA timeline** slider until the status line reads `walk` just after the second science block (stop 2, delta front toe). Pause. Then start recording
- [ ] Dust storm banner shows `DUST STORM · ABORT EVA`, mission status **NO-GO**, and `Walk home: … · CAUTION`. If the walk-home status is not CAUTION, update the voiceover to match the screen
- [ ] Photos in `app/public/photos/` have landed if you want the Details shot (S8)
- [ ] DevTools console shows no errors (close DevTools before recording)

**Recording**
- [ ] Do Not Disturb on; notifications, dock and other windows hidden
- [ ] Screen recorder at 1440 × 900, 30 or 60 fps, cursor highlight on
- [ ] Practise the click sequence twice with a stopwatch against the table timings
- [ ] Record voiceover separately in a quiet room and lay it over the screen recording
- [ ] Export MP4 (H.264), upload to YouTube as **Unlisted or Public**, and test the link in a private window with no login
