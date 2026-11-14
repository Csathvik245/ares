# NASA Space Apps Challenge 2026 — rules and submission requirements

What we must do to submit ARES, taken from the official Space Apps pages. Every fact links to the page it came from.
Pages read on **14 November 2026**. The submission and judging guides are dated 13 November 2026 on the site.

| Short name | Official page | Date shown on page |
|---|---|---|
| Submission guide | [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/) | 13 Nov 2026 |
| Judging guide | [Judging & Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/) | 13 Nov 2026 |
| FAQ | [Participant FAQs](https://www.spaceappschallenge.org/resources/participant-faqs/) | 13 Nov 2026 |
| Terms | [2026 Participant Terms and Conditions](https://www.spaceappschallenge.org/legal/) | Updated 7 Aug 2026 |
| Hackathon page | [2026 Hackathon](https://www.spaceappschallenge.org/2026/) | — |
| Our challenge | [Interplanetary Survival Guide: Martian Map](https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/) | — |

---

## ⚠️ Things that change our plan

These conflict with what `CLAUDE.md` and `CHECKLIST.md` currently say. `CLAUDE.md` is a shared file, so the team must agree before anyone edits it.

1. **The demo video must be 30 seconds or less, not 60.** Or we can submit a slide deck of up to **7 slides** (title and intro slides count). Going over either limit makes the project **ineligible for Global Judging**. ([Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), "Limitations"; [Judging guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/), "Minimum requirements")
2. **No names, faces, voices or likenesses of anyone under 18** in the demo or the submission. Our team is high school students. ([FAQ](https://www.spaceappschallenge.org/resources/participant-faqs/), "Can participants under the age of 18 participate?"; [Terms](https://www.spaceappschallenge.org/legal/), "Submissions" and "Media Release")
   - The video must not show or voice any teammate who is under 18. Use screen recording, captions, or a narrator who is 18 or older.
   - Under-18 teammates should not upload a photo of themselves as their avatar or on the team page ([FAQ](https://www.spaceappschallenge.org/resources/participant-faqs/)).
   - **README and slides list teammates by first name.** If the final project link points to the GitHub repo, those names count as part of the submission. Check each teammate's age and decide as a team whether to keep the names (see [open questions](#open-questions)).
3. **AI-generated content needs a visible label.** Images and videos made with AI need a visible watermark. AI-generated code and data must be acknowledged in descriptive text and metadata. ([Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), "Use of Super Intelligence (SI)") See [AI rules](#ai-tool-use-super-intelligence-si) below.

---

## Deadline

- Submission **opens Saturday 14 November 2026, 9:00 a.m.** and **closes Sunday 15 November 2026, 11:59 p.m.**, in the **time zone of our team's Local Event**. ([Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), "Project Submission Start & End Times")
- If we are registered for the virtual **Universal Event** instead, the times follow the local time where our **Team Owner** lives. ([Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/))
- We must click **"Submit for Judging"** before the deadline. Anything saved or submitted after it is not judged. ([Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), "Submitting Your Project")
- Local Events may hold local judging and awards at different times; ask the Local Lead. ([Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/))
- **Our exact deadline in clock time depends on which Local Event we registered for. That is not written in this repo — fill it in:** `Local Event: ______  Time zone: ______  Deadline: Sun 15 Nov 2026, 23:59 ______`

## Editing after submitting

- We can **edit and resubmit as many times as we like until the hackathon ends**. Only the last saved submission is judged. ([Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), "Submitting Your Project")
- Changes are visible only to our team until we submit. Save often with "Save Progress". ([Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), "How to Edit Your Project Page")
- Turn the edit **Lock** on while editing. A teammate can still remove it and overwrite unsaved work, so tell the group chat before editing. ([Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/))
- Go to: profile icon → **My Team** → **Project** tab → **Edit**. ([Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/))

## Required fields on the project page

From the [Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), "Project Page Form Field Instructions". **All required fields must be filled or the Submit button won't work.** The guide does not say which fields are optional, and gives **no character or word limits**. Treat every field as required.

| Field | What to put | ARES draft lives in |
|---|---|---|
| Project Name | Name of the project | "ARES — Astronaut Route & EVA Safety system" |
| High-Level Project Summary | What we built, how it addresses the challenge, why it matters | README "What ARES is" |
| Link to Project Demo | Public link to a ≤ 30 s video **or** ≤ 7-slide deck | _TBD_ |
| Link to Final Project | Public link to the project (website, repo, etc.) | Live app and/or GitHub repo |
| Detailed Project Description | What it does, how it works, benefits, goals, tools/languages/software used | README "Key features" and "How it works" |
| Use of Super Intelligence (SI) | Did we use AI tools? If yes, how? | See [AI rules](#ai-tool-use-super-intelligence-si) |
| NASA Data | Specific NASA data and resources used. **At least one is required for a Global Award.** | [`sources.md`](sources.md) |
| Space Agency Partner Data and Other References | **Every** data source, resource and tool, including open-source code, text and images | [`sources.md`](sources.md) + npm dependencies |

Other page rules ([Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/)):

- Images (JPG, PNG, GIF up to 10 MB) can be uploaded to the page. **Videos and documents cannot**; host them elsewhere and link them.
- Every link must be **public with no login, permission or registration**. Test each link in a private browser window.
- For a new website (our Vercel app), the guide recommends (not requires) requesting a FortiGuard Web Filter Classification so judges' networks don't block it. Company Name: "N/A".
- **Everything must be in English**, on the page and in linked materials. ([Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/))

Before submitting we must tick two boxes ([Judging guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/), "Minimum requirements"):

1. We have read the submission requirements and agree to the Terms and Conditions and Privacy Policy.
2. The project is our team's original work, **every external resource (code, text, images, even open-source or free) is listed in the References field**, and we used no copyrighted material without permission.

A banner and confirmation message appear when submission succeeds. ([Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/))

## Demo: video or slides

From the [Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), "Tips for Creating a Project Demo":

| Rule | Detail |
|---|---|
| Required? | Yes, every team must make a demo |
| Format | Video **30 seconds or less**, or slide deck **up to 7 slides** (including title and intro) |
| File format | **Not stated.** Any format the hosting site plays (e.g. YouTube) |
| Hosting | External site (YouTube, Google Drive, GitHub, OneDrive, Dropbox…), public link, no login |
| Language | English. A video may be spoken in another language only with English subtitles. Slides must be English. |
| Over the limit | Not eligible for Global Judging |
| Weight | Considered in the evaluation, but most of the score comes from the project submission. A strong demo helps the **Presentation** score. |

Suggested 30-second outline from the guide:

| Time | Content |
|---|---|
| 0:00 | Who you are and your team name |
| 0:02 | Which challenge, and what inspired you |
| 0:05 | Project title and tagline |
| 0:10 | How it works: images or prototype, the user's experience, how NASA open data made it possible |
| 0:20–0:30 | The future: what it could do for people and beyond |

A slide deck should show an image of the project, the user experience, how NASA data makes it possible, the team name, team member names, and the challenge. ([Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/)) Note the under-18 rule above when listing names.

## AI tool use ("Super Intelligence", SI)

Space Apps 2026 uses the term **"Super Intelligence (SI)"** for what is usually called AI, following a 29 September 2026 U.S. Executive Order. Examples given: large language models, chat assistants, image and video generators, foundation models, **code generation tools**. ([FAQ](https://www.spaceappschallenge.org/resources/participant-faqs/), "What is Super Intelligence?")

- **Allowed:** SI tools may be used to speed up development and support creativity. ([FAQ](https://www.spaceappschallenge.org/resources/participant-faqs/); [Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/))
- **Not allowed:** using SI to come up with the idea for how to solve the challenge. ([Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), "Use of Super Intelligence (SI)")
- **No NASA branding** in generated content: no NASA logos, flags or mission identifiers. ([Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/))
- **Disclosure is required** — "We require that you clearly indicate where and how SI tools were utilized in your project" ([Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/)):
  - Images and videos: **visible watermark**.
  - Audio: acknowledge in descriptive text and metadata.
  - Code and data: acknowledge in descriptive text and metadata.
- The SI form field itself is for data collection and **judges don't see it**. Judges **do** see the watermarks, text and metadata inside the project, and judge "originality, intent, and execution" of the SI-assisted parts. ([Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/))
- Every project submission must describe how SI tools were used. ([FAQ](https://www.spaceappschallenge.org/resources/participant-faqs/))

**What this means for ARES:** we used an AI coding assistant to help write code and docs. We need (a) an honest answer in the SI field, (b) an "AI use" note in the README and on the project page, and (c) a watermark on any AI-generated image or video frame. Our repo rule against AI attribution lines in commit messages is separate. It does not replace the disclosure Space Apps requires. The planned in-app AI assistant (stretch) would also be SI use to describe.

## Team rules

- **Max 6 members.** A Local Event team needs at least 1; a Universal Event team needs at least 2. ([Judging guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/); [FAQ](https://www.spaceappschallenge.org/resources/participant-faqs/))
- **Everyone (including the Team Owner) must be registered for the same Local Event**, not waitlisted, and listed on the team's Members tab. No members can be added after submission closes. ([Judging guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/); [Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/))
- One team per person, one challenge per team. ([FAQ](https://www.spaceappschallenge.org/resources/participant-faqs/))
- **Under 18:** must be registered by a parent or legal guardian and be accompanied by one **at all times** during the event. Local Events may add rules. ([FAQ](https://www.spaceappschallenge.org/resources/participant-faqs/); [Terms](https://www.spaceappschallenge.org/legal/), "Participation")
- **No work before the hackathon:** "Teams are not allowed to begin working on the challenges prior to the hackathon." ([FAQ](https://www.spaceappschallenge.org/resources/participant-faqs/), "What are the challenges?")
- Teams may not participate, collaborate or coordinate with China or Chinese-owned entities; teams are reviewed for this before Global Judging. This is about affiliation, not nationality. ([Terms](https://www.spaceappschallenge.org/legal/); [Judging guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/))

## Licences, sources and content rules

From the [Terms](https://www.spaceappschallenge.org/legal/):

- Our original content must be freely available or under an **OSI open-source licence**. Default if none given: Apache 2.0. **ARES uses MIT, which is OSI-approved.** ("Intellectual Property Rights in Solutions")
- Any non-NASA material (e.g. npm packages, non-NASA data) must be free/open, and **its licence must be named in our documentation**. ("Use of Third-Party Materials")
- **Cite every source**, even open-source and free ones. NASA can remove awards from teams that don't. ("Use of Third-Party Materials")
- No export-controlled information. No commercial promotion. No personal information (birthdays, addresses, phone numbers). ("Submissions")
- By submitting, we let NASA display, copy and distribute the solution. ("Submissions")

## How judges score

At every level, each project gets **1 to 5 points on each of five criteria**. ([Judging guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/), "Judging Criteria")

| Criterion | What judges look for (paraphrased from the guide) | Where ARES scores |
|---|---|---|
| **Impact** | How big a problem it solves and how many people it helps or inspires | Astronaut safety on future Mars EVAs |
| **Creativity** | Original, new, or a meaningful improvement on existing ideas | Safe-return zone, science per oxygen-minute, time as a dimension |
| **Validity** | Grounded in science; technically feasible; works; usable and user-friendly | Deterministic planner, unit tests, every number sourced or labelled ([`assumptions.md`](assumptions.md)) |
| **Relevance** | Directly answers the challenge; NASA data is **core**, not decoration | Six NASA data types combined into three answers |
| **Presentation** | Clear, engaging story of the challenge, the solution and why it matters. Judges score the demo **and** the full project. | 30 s video, project page, README |

The guide tells teams to "pay equal attention to the final criterion: presentation." ([Judging guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/))

### Judging timeline ([Judging guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/))

| Phase | Who judges | Announced |
|---|---|---|
| 1. Local judging → Global Nominees | Local Event judges (or Universal Event experts) | 3 Dec 2026 |
| 2. Global Finalists + Honorable Mentions | Expert global judges | 17 Dec 2026 |
| 3. Global Winners | Executive committee from NASA and Space Agency Partners | 26 Jan 2027 |

Ten Global Awards. Most relevant to ARES: **Best Use of Science**, **Best Use of Data**, **Best Mission Concept**, **Best Storytelling**. The others: Best Use of Technology, Galactic Impact, Most Inspirational, Global Connection, Art & Technology, Local Impact. ([Judging guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/), "Phase 3")

Every team that submits by the deadline gets a participant certificate on their profile. ([Judging guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/); [Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/))

## Not published / not found

- Exact clock deadline for our team: depends on our Local Event's time zone (see [Deadline](#deadline)).
- Character or word limits for project-page fields: not stated.
- Video file format or resolution: not stated (only length, hosting and language).
- Which fields are optional: not stated; only "all required fields".
- Whether pre-existing code libraries are allowed: not stated directly. The Terms allow third-party open-source materials if cited and licensed ([Terms](https://www.spaceappschallenge.org/legal/)).

## Open questions

Decide as a team:

1. **Video length.** Cut the 60 s script in `CLAUDE.md` section 9 to ≤ 30 s, or switch to a ≤ 7-slide deck. Update `CLAUDE.md` and `CHECKLIST.md` after agreeing.
2. **Names and faces of under-18 teammates.** Whether to drop first names from the README and slides. No team faces or voices in the video either way.
3. **AI disclosure wording** for the SI field and README.
4. **Our Local Event and time zone**, written into the [Deadline](#deadline) section.

## Pre-submit checklist

- [ ] All teammates registered for the same Local Event, not waitlisted, on the Members tab
- [ ] Demo ≤ 30 s video **or** ≤ 7 slides, English (or English subtitles), public link tested in a private window
- [ ] No under-18 names, faces or voices in the demo or submission
- [ ] Final project link public, tested in a private window
- [ ] Every field filled; NASA Data field lists at least one NASA dataset
- [ ] References field lists every dataset, paper, image, library and tool, with licences for non-NASA material
- [ ] SI use described; AI-made images/video watermarked; AI-assisted code noted in README
- [ ] No NASA logo, flags or mission insignia in our branding or generated content
- [ ] Both checkboxes ticked; "Submit for Judging" clicked; confirmation banner seen
- [ ] Done before **Sun 15 Nov 2026, 23:59 local time** of our Local Event — submit early
