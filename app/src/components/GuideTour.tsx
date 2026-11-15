// The spotlight tour of the real Plan view: everything is dimmed except one element, with a
// small card beside it. Eight stops (lib/guide.ts), Back / Next / Skip, arrow keys and Esc.
//
// The spotlight is one box placed over the element, with a very large shadow that dims the
// rest of the page. It does not catch the mouse, so the page under it still works: on the
// "hover box" stop you can really move the mouse over the map.
import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import { TOUR_STOPS, tourAfter, type TourStop } from "../lib/guide";
import "../styles/user-guide.css";

export type TourRect = { left: number; top: number; width: number; height: number };
type Size = { width: number; height: number };

const PAD = 6; // air between the element and the edge of the spotlight
const CARD_WIDTH = 320;
const CARD_HEIGHT = 190; // roomy guess; the card is placed so this fits on screen
const GAP = 16;

/** The area to light up: all matching elements together, kept inside `clip` and the screen. Null if nothing is visible. */
export function measureStop(stop: TourStop, doc: Document = document): TourRect | null {
  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  doc.querySelectorAll(stop.selector).forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  });
  if (right < left) return null;
  const frame = stop.clip ? doc.querySelector(stop.clip)?.getBoundingClientRect() : null;
  const view = doc.defaultView;
  const maxRight = Math.min(frame ? frame.right : Infinity, view ? view.innerWidth : Infinity);
  const maxBottom = Math.min(frame ? frame.bottom : Infinity, view ? view.innerHeight : Infinity);
  left = Math.max(left, frame ? frame.left : 0, 0);
  top = Math.max(top, frame ? frame.top : 0, 0);
  right = Math.min(right, maxRight);
  bottom = Math.min(bottom, maxBottom);
  if (right - left < 8 || bottom - top < 8) return null;
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * Where the card goes: beside the lit area if there is room (right, then left), else under
 * or over it, else inside its top-left corner. Always fully on screen. With nothing lit, the
 * middle of the screen.
 */
export function placeCard(rect: TourRect | null, screen: Size): { left: number; top: number } {
  const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v));
  const fitX = (x: number) => clamp(x, GAP, screen.width - CARD_WIDTH - GAP);
  const fitY = (y: number) => clamp(y, GAP, screen.height - CARD_HEIGHT - GAP);
  if (!rect) return { left: fitX((screen.width - CARD_WIDTH) / 2), top: fitY((screen.height - CARD_HEIGHT) / 2) };
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  if (right + GAP + CARD_WIDTH + GAP <= screen.width) return { left: right + GAP, top: fitY(rect.top) };
  if (rect.left - GAP - CARD_WIDTH >= GAP) return { left: rect.left - GAP - CARD_WIDTH, top: fitY(rect.top) };
  if (bottom + GAP + CARD_HEIGHT + GAP <= screen.height) return { left: fitX(rect.left), top: bottom + GAP };
  if (rect.top - GAP - CARD_HEIGHT >= GAP) return { left: fitX(rect.left), top: rect.top - GAP - CARD_HEIGHT };
  return { left: fitX(rect.left + GAP), top: fitY(rect.top + GAP) };
}

/** The card for one stop: its text, "n of 8", and Back / Next / Skip. No state of its own. */
export function TourCard({
  index,
  style,
  onBack,
  onNext,
  onSkip,
}: {
  index: number;
  style?: CSSProperties;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const stop = TOUR_STOPS[index];
  const last = index === TOUR_STOPS.length - 1;
  return (
    <aside className="tour-card" role="dialog" aria-label={`Tour, stop ${index + 1} of ${TOUR_STOPS.length}: ${stop.label}`} style={style}>
      <p className="tour-card__count">
        {index + 1} of {TOUR_STOPS.length} · {stop.label}
      </p>
      <p className="tour-card__text" aria-live="polite">
        {stop.text}
      </p>
      <div className="tour-card__actions">
        <button type="button" onClick={onBack} disabled={index === 0}>
          Back
        </button>
        <button type="button" className="tour-card__next" onClick={onNext}>
          {last ? "Finish" : "Next"}
        </button>
        {!last && (
          <button type="button" className="tour-card__skip" onClick={onSkip}>
            Skip
          </button>
        )}
      </div>
    </aside>
  );
}

/**
 * The running tour. `index` is the stop on screen, -1 when the tour is off (renders nothing).
 * `onChange` gets the next index (-1 to end). `onStop` is told which stop is about to show,
 * so the app can bring it on screen (the tablet's Map / Mission tabs).
 */
export function GuideTour({ index, onChange, onStop }: { index: number; onChange: (next: number) => void; onStop?: (stop: TourStop) => void }) {
  const stop = index >= 0 ? TOUR_STOPS[index] : undefined;
  const [rect, setRect] = useState<TourRect | null>(null);
  const [screen, setScreen] = useState<Size>({ width: 1440, height: 900 });

  // Tell the app before measuring, so the element is on screen when we look for it.
  useLayoutEffect(() => {
    if (stop) onStop?.(stop);
  }, [stop]);

  // Find the element, bring it into view, and keep following it: the map re-fits and the
  // sidebar scrolls, so one measurement is not enough.
  useEffect(() => {
    if (!stop) return;
    let brought = false;
    const measure = () => {
      const target = document.querySelector(stop.selector);
      if (target && !brought && !stop.clip) {
        brought = true;
        target.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
      setScreen({ width: window.innerWidth, height: window.innerHeight });
      const next = measureStop(stop);
      setRect((now) => (now && next && Math.abs(now.left - next.left) + Math.abs(now.top - next.top) + Math.abs(now.width - next.width) + Math.abs(now.height - next.height) < 1 ? now : next));
    };
    measure();
    const timer = window.setInterval(measure, 250);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", measure);
    };
  }, [stop]);

  useEffect(() => {
    if (!stop) return;
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (el?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
      const action = event.key === "ArrowRight" ? "next" : event.key === "ArrowLeft" ? "back" : event.key === "Escape" ? "skip" : null;
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      onChange(tourAfter(index, action));
    };
    // Capture: the tour's arrow keys must not also move the guided demo or the timeline.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [stop, index, onChange]);

  if (!stop) return null;
  const spot: CSSProperties | undefined = rect
    ? { left: rect.left - PAD, top: rect.top - PAD, width: rect.width + 2 * PAD, height: rect.height + 2 * PAD }
    : undefined;
  return (
    <div className="tour" data-stop={stop.id}>
      {/* With nothing to light up (the element is not on screen), the whole page is dimmed evenly. */}
      <div className={`tour-spot${spot ? "" : " is-empty"}`} style={spot} aria-hidden="true" />
      <TourCard
        index={index}
        style={placeCard(rect, screen)}
        onBack={() => onChange(tourAfter(index, "back"))}
        onNext={() => onChange(tourAfter(index, "next"))}
        onSkip={() => onChange(tourAfter(index, "skip"))}
      />
    </div>
  );
}
