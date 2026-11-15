# ARES demo video script (30 seconds, captions only)

This is the video we submit as the Space Apps **Link to Project Demo**.

**Rules this script follows** (details and links in [`submission.md`](submission.md)):

- **30 seconds or less.** Longer videos are not eligible for Global Judging ([Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), "Limitations").
- **No names, voices or likenesses of anyone under 18** ([2026 Participant Terms and Conditions](https://www.spaceappschallenge.org/legal/)). Our team is under 18, so the video has **no voiceover, no faces and no names**. It is a **screen recording of the app with captions added in editing**. The only name on screen is "The Ares Initiative".
- **English captions** ([Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), "Language Requirements").
- **AI disclosure.** If any AI tool makes images, video, music or captions for the video, images and video need a visible watermark, and audio must be acknowledged in the description and metadata. See [`ai-disclosure.md`](ai-disclosure.md). The plan below uses no AI-generated media.
- **No NASA logo**, flags or mission insignia in our own graphics. Data credits go in the end card.

**Caption length:** every caption is **8 words or fewer** (a number, a time such as T+1:16, or a web address counts as one word).

**Where it is recorded:** on the live app, https://ares-mars-alpha.vercel.app, not on a local copy.

**It follows the guided demo.** The video is the app's own guided demo, start to finish: the Story title screen, **Run the demo**, its four steps, then the Story's closing line and the live URL. The demo's card on screen already says what is happening; the captions repeat the key words in a larger size.

**Emergency rule (as the app shows it):** when the dust storm starts, the **EVA is aborted, so the EVA status is NO-GO**. The **walk home has its own status**, **Return home: CAUTION**: she gets home with the oxygen reserve intact, but a storm is active. Captions say both and never call the abort "GO".

**Numbers.** Every number in a caption is copied from [`demo-numbers.md`](demo-numbers.md), which `npm test` keeps equal to the planner:

| Caption number | Where it is in `demo-numbers.md` |
|---|---|
| 4.97 km, GO | Section 1, "Distance" and "Status" |
| 1000 of 1000 | Section 6, "Home with the oxygen reserve intact" |
| T+1:16, NO-GO | Section 2, title and "EVA status" |
| 66%, CAUTION | Section 2, "Oxygen on arrival" and "Return home status" |

"8 hours of oxygen" is the planner constant `CONSUMABLE_HOURS`, and is on the title screen itself. If a number on screen ever differs from this table, stop: fix the cause, do not edit the caption.

---

## Main script: 30 seconds

| Time | On screen (screen recording of the live app) | Caption (added in editing) | Words / max | Clicks to record this shot |
|---|---|---|---|---|
| 0:00–0:03 | **Story** tab, title screen: "8 hours of oxygen. 5 km of unknown terrain." | **ARES · The Ares Initiative · NASA Space Apps 2026** | 8 / 8 | Fresh load of the live URL. Hold still. |
| 0:03–0:06 | Same screen; the cursor moves to **Run the demo** and clicks | **Can the astronaut get there and back?** | 7 / 8 | Click **Run the demo** at the end of the shot. |
| 0:06–0:10 | **Plan** tab, guided demo **Step 1 of 4**: the three stops, the white route, the blue safe-return edge, **EVA · GO** | **A 4.97 km science walk. Status: GO.** | 7 / 8 | None: step 1 loads by itself. Don't move the mouse while the route draws. |
| 0:10–0:14 | **Step 2 of 4**: the card's simulation line | **1000 of 1000 simulated walks keep the reserve.** | 8 / 8 | Click **Next**. |
| 0:14–0:18 | **Step 3 of 4**: red banner **DUST STORM · T+1:16**, header **EVA · NO-GO · ABORTED**, red route home | **Dust storm at T+1:16. EVA aborted: NO-GO.** | 7 / 8 | Click **Next**. |
| 0:18–0:22 | **Step 4 of 4**: the astronaut marker walks home along the red route; **RETURN HOME · CAUTION** | **Home with 66% oxygen. Return home: CAUTION.** | 7 / 8 | Click **Next**. The walk home takes about 15 s in the app: speed this clip up in the editor. |
| 0:22–0:25 | **Story** tab, scrolled to the closing line | **ARES doesn't just tell astronauts where to walk.** | 8 / 8 | Click **Explore on your own**, open **Story**, scroll to the end. |
| 0:25–0:28 | Same closing line, held | **It tells them whether they'll make it back.** | 8 / 8 | Hold still. |
| 0:28–0:30 | End card: "ARES, by The Ares Initiative", the live URL, credit line "Data: NASA/JPL-Caltech, University of Arizona, USGS, ASU" | **ares-mars-alpha.vercel.app** | 1 / 8 | Made in the editor (no app). |

**Total: 30 seconds, 61 words of captions, 9 captions, none over 8 words.**

Caption style: IBM Plex Sans, white (`#ededed`) on a dark bar (`#0a0a0a` at 80% opacity), bottom centre, at least 36 px tall at 1440 × 900. Put status words in their colours: **GO** `#3DDC97`, **CAUTION** `#FFB020`, **NO-GO** `#FF4D5A`, always with the word (never colour alone). Keep the caption bar clear of the guided demo's card (bottom left of the map): if they overlap, move the caption bar to the top for those shots.

Eight-word captions are short for their time on screen, so each one can be read at about 3 words per second.

This order follows the guide's 30-second outline: team and challenge first, then the question, how it works, and the payoff ([Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), "Video Demo"). There's no time for a "future" line; it goes on the project page ([`project-page.md`](project-page.md)).

---

## Shot list

Record each shot as its own clip in a **1440 × 900** browser window, with 2 s of spare footage at both ends. Cut and caption in the editor.

| # | Shot | Capture | Start state | Used at |
|---|---|---|---|---|
| S1 | Story title screen, idle, then click **Run the demo** | 10 s | Fresh load of https://ares-mars-alpha.vercel.app | 0:00–0:06 |
| S2 | Guided demo step 1: route draws, **EVA · GO** | 8 s | Straight after S1 (the app switches to **Plan** by itself) | 0:06–0:10 |
| S3 | Step 2: simulation line on the card | 8 s | Click **Next** | 0:10–0:14 |
| S4 | Step 3: dust storm banner, **EVA · NO-GO · ABORTED**, red route home | 8 s | Click **Next** | 0:14–0:18 |
| S5 | Step 4: the whole walk home, to "Home with 66% oxygen left" on the card | 20 s | Click **Next**; keep recording until the marker reaches HAB-1 | 0:18–0:22 (sped up) |
| S6 | Story closing line | 10 s | **Explore on your own**, then **Story**, scroll to the end | 0:22–0:28 |
| S7 | End card | 3 s | Editor | 0:28–0:30 |
| B1 | (Backup) Story chapters 05–08 scrolling past (route map, validation, storm timeline, simulation) | 15 s | **Story** tab | Spare / slides |
| B2 | (Backup) **Science** tab, top of the page | 5 s | Click **Science** | Spare / slides |

---

## Pre-recording checklist

**Rules**
- [ ] Final export is **30 s or less** (check the file length, not just the timeline)
- [ ] **No voiceover**, no faces, no webcam, no names except "The Ares Initiative"
- [ ] No personal details visible: browser profile picture, account names, bookmarks, file paths, notifications
- [ ] Captions in English, **8 words or fewer** each, and each on screen long enough to read
- [ ] Any music is our own or licensed for reuse; licence listed in the References field. If music is AI-generated, acknowledge it in the video description and metadata
- [ ] No AI-generated images or video. If any are added, they carry a visible watermark. **The mission patch in the app's top bar is AI-generated**: its "AI-generated" label must stay visible in every shot that shows it (see [`ai-disclosure.md`](ai-disclosure.md))
- [ ] No NASA logo, flags or mission insignia in the end card or captions

**App state**
- [ ] Recording on the live URL, https://ares-mars-alpha.vercel.app, in a private window (it auto-deploys from `main`, so it already runs the latest code)
- [ ] The Story title screen shows **Run the demo**, and the **Demo mission briefing** further down shows **Overall GO**
- [ ] Step 1's card reads "ARES plans a 4.97 km science walk …  Status: GO."; step 2's reads "1,000 of 1,000 …"; step 3's reads "Dust storm at T+1:16 …"; step 4's ends "Home with 66% oxygen left …". These match the table at the top of this file
- [ ] Start time left at **13:00 LMST** (the default), so the numbers match
- [ ] No extensions, bookmarks bar hidden, zoom 100%
- [ ] Browser content area **exactly 1440 × 900**, on a screen where it fits without scaling
- [ ] Basemap imagery loaded (the HiRISE picture, not a grey or brown fallback)
- [ ] DevTools console shows no errors (then close DevTools)

**Recording and editing**
- [ ] Do Not Disturb on; dock, menu-bar clock and other windows hidden
- [ ] Screen recorder set to the 1440 × 900 window, 30 or 60 fps, system audio off
- [ ] Practise the whole run twice against the table timings
- [ ] Add captions in the editor (not burned into the app); check spelling of Jezero
- [ ] Export MP4 (H.264), 1440 × 900 or 1920 × 1080 with letterbox
- [ ] Upload to YouTube as **Unlisted or Public**; description lists data credits, links to the repo and the live app, and states AI use (see [`ai-disclosure.md`](ai-disclosure.md))
- [ ] Test the link in a private window with no login
