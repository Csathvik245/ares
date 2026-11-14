# The Ares Initiative — scroll site

Marketing/story page for ARES. Separate from the mission console in `/app` so the live demo is never at risk.
Vite + React + TypeScript, GSAP ScrollTrigger + Lenis. Same design tokens as the console (Contract 6).

```
cd site
npm ci
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
```

Deploy as its own Vercel project (root directory `site`, build `npm run build`, output `dist`).

## Hero animation

The hero is a scroll-scrubbed canvas (technique adapted from the 21st.dev "Hero Scrub" pattern).

- **Now:** a procedural descent (`src/lib/descent.ts`): stars streak past, terrain ridges rise, HAB-1 appears.
  It is labelled "Illustration — not NASA imagery" on screen.
- **Later:** swap in the generated film. Convert the clip to frames and set the frame count:

```
# 5 s clip -> ~120 frames, 1280 px wide, WebP
mkdir -p public/frames
ffmpeg -i descent.mp4 -vf "fps=24,scale=1280:-2" -c:v libwebp -quality 80 public/frames/%04d.webp
echo "VITE_FRAME_COUNT=120" > .env.local     # set to the real number of frames
```

With `VITE_FRAME_COUNT` unset or `0`, no frame requests are made and the procedural version is used.

## Honesty rules

- The generated film is an illustration, never NASA imagery. Keep the on-screen label.
- The interactive demo uses only shared-contract constants (8 h consumables, 45 min reserve, ×1.3 walk burn,
  ×0.9 science burn, 3.0 km/h). The 30-minute stop is the console's demonstration assumption.
- No NASA logo. Credit data as NASA/JPL-Caltech and instrument teams. Not affiliated with or endorsed by NASA.

## Generation prompt (Kling 3.0, 16:9, 5 s, pro, sound off)

> Single continuous cinematic shot, no cuts. A slow, steady, gliding camera descends from high above Mars toward the
> Jezero Crater river delta. It starts in near-black, with the thin dark edge of the sky at the top of the frame and
> the dusty rust-orange crater floor below. It moves forward and down at one constant, smooth speed. Fan-shaped delta
> with layered cliff terraces, dry riverbed channels, dark basalt patches, soft wind-blown dunes. Low raking
> late-afternoon sun from the left, long soft shadows, a butterscotch haze at the horizon, a deep indigo-black sky.
> Photoreal documentary realism, shot on a large-format cinema lens, fine dust, subtle atmospheric depth. In the last
> second, the camera settles low over the delta front. Far ahead, a single small pressurized habitat module sits on the
> plain with one soft cyan light on. Stable exposure and lighting from the first frame to the last, no flicker, no
> camera shake, no sudden accelerations. No people, no vehicles, no text, no logos, no UI overlays, no lens flares.
