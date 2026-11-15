import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { drawDescent } from "../lib/descent";
import { useReducedMotion } from "../lib/useReducedMotion";

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll-scrubbed hero. Technique adapted from the 21st.dev "Hero Scrub" pattern:
 * a tall section + sticky stage, GSAP ScrollTrigger scrubs a canvas, the card scales
 * from a framed window to full-bleed.
 *
 * Frames: set VITE_FRAME_COUNT (e.g. 120) and drop 0001.webp … NNNN.webp in /public/frames.
 * With no frames (default) a procedural descent is drawn instead — no network requests.
 */
const FRAME_COUNT = Number(import.meta.env.VITE_FRAME_COUNT ?? 0);
const frameUrl = (i: number) => `/frames/${String(i + 1).padStart(4, "0")}.webp`;

const W = 1280;
const H = 720;

export function HeroScrub() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const line1Ref = useRef<HTMLParagraphElement>(null);
  const line2Ref = useRef<HTMLParagraphElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const eyebrowRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const section = sectionRef.current;
    const card = cardRef.current;
    const canvas = canvasRef.current;
    if (!section || !card || !canvas) return;
    const c = canvas.getContext("2d");
    if (!c) return;

    canvas.width = W;
    canvas.height = H;

    const frames: HTMLImageElement[] = [];
    let framesReady = false;
    let cancelled = false;

    const isLoaded = (i: number) => !!frames[i] && frames[i].complete && frames[i].naturalWidth > 0;

    const render = (p: number) => {
      if (framesReady) {
        let idx = Math.min(FRAME_COUNT - 1, Math.floor(p * FRAME_COUNT));
        if (!isLoaded(idx)) {
          for (let d = 1; d < FRAME_COUNT; d++) {
            if (idx - d >= 0 && isLoaded(idx - d)) { idx -= d; break; }
            if (idx + d < FRAME_COUNT && isLoaded(idx + d)) { idx += d; break; }
          }
        }
        if (isLoaded(idx)) {
          c.drawImage(frames[idx], 0, 0, canvas.width, canvas.height);
          return;
        }
      }
      drawDescent(c, W, H, p);
    };

    if (FRAME_COUNT > 0) {
      for (let i = 0; i < FRAME_COUNT; i++) {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
          if (cancelled) return;
          if (i === 0) {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            framesReady = true;
          }
        };
        img.src = frameUrl(i);
        frames[i] = img;
      }
    }

    render(reduced ? 0.97 : 0);

    if (reduced) {
      return () => { cancelled = true; };
    }

    const ctx = gsap.context(() => {
      const startScale = () => (window.innerWidth < 768 ? 0.84 : 0.6);
      const immerse = () => {
        const w = card.offsetWidth || 1;
        const h = card.offsetHeight || 1;
        return Math.max(window.innerWidth / w, window.innerHeight / h) * 1.04;
      };

      gsap.set(card, { scale: startScale(), transformOrigin: "50% 50%" });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.4,
          invalidateOnRefresh: true,
          onUpdate: (self) => render(self.progress),
        },
      });

      // Frame the window, then push in until it fills the screen.
      tl.to(card, { scale: 1, ease: "power2.out", duration: 0.15 }, 0)
        .to(topRef.current, { x: () => (window.innerWidth < 768 ? "-70vw" : "-55vw"), ease: "power2.inOut", duration: 0.15 }, 0)
        .to(bottomRef.current, { x: () => (window.innerWidth < 768 ? "70vw" : "55vw"), ease: "power2.inOut", duration: 0.15 }, 0)
        .to(hintRef.current, { opacity: 0, duration: 0.06 }, 0)
        .to(card, { scale: immerse, ease: "power2.in", duration: 0.6 }, 0.15)
        .to([topRef.current, bottomRef.current, eyebrowRef.current], { opacity: 0, ease: "power1.in", duration: 0.2 }, 0.1)
        // The two pitch lines ride on top of the full-bleed descent, one at a time.
        .fromTo(line1Ref.current, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.08 }, 0.32)
        .to(line1Ref.current, { opacity: 0, y: -24, duration: 0.06 }, 0.5)
        .fromTo(line2Ref.current, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.08 }, 0.6)
        .to({}, { duration: 0.001 }, 0.999);
    }, section);

    return () => {
      cancelled = true;
      ctx.revert();
    };
  }, [reduced]);

  return (
    <section
      ref={sectionRef}
      className={`hero${reduced ? " hero--static" : ""}`}
      aria-label="Introduction"
    >
      <h1 className="sr-only">The Ares Initiative. Science first. Safety always.</h1>
      <div className="hero__sticky">
        <div ref={eyebrowRef} className="hero__eyebrow">
          <span>The Ares Initiative</span>
          <span className="hero__eyebrow-sub">A studio for people in spacesuits</span>
        </div>

        <div ref={topRef} className="hero__title" aria-hidden="true">
          Science first.
        </div>

        <div ref={cardRef} className="hero__card">
          <canvas ref={canvasRef} className="hero__canvas" aria-hidden="true" />
          <div className="hero__vignette" aria-hidden="true" />
          <div className="hero__tele hero__tele--tl" aria-hidden="true">ARES-1 EVA · JEZERO DELTA FRONT</div>
          <div className="hero__tele hero__tele--bl" aria-hidden="true">HAB-1 · 18.4446 N 77.4509 E</div>
          <div className="hero__tele hero__tele--br" aria-hidden="true">ILLUSTRATION — NOT NASA IMAGERY</div>
        </div>

        <div ref={bottomRef} className="hero__title" aria-hidden="true">
          Safety always.
        </div>

        <p ref={line1Ref} className="hero__line" aria-hidden={reduced}>8 hours of oxygen.</p>
        <p ref={line2Ref} className="hero__line" aria-hidden={reduced}>4 km of unknown terrain.</p>

        <div ref={hintRef} className="hero__hint" aria-hidden="true">
          <span>Scroll</span>
          <i />
        </div>
      </div>
    </section>
  );
}
