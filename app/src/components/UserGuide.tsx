// The user guide: a "? Guide" button for the header of every tab, and the full-screen
// guide it opens. Four tabs: Get started (three cards that do what they say), Read the
// screen (starts the spotlight tour, see GuideTour.tsx), What the colours mean (the app's
// own pills, bar, map colours and evidence tags) and Words (chips that flip).
// Words and numbers come from lib/guide.ts.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import {
  GUIDE_CARDS,
  GUIDE_HINT_TEXT,
  GUIDE_RESERVE,
  GUIDE_SCIENCE_LINE,
  GUIDE_STATUSES,
  GUIDE_SWATCHES,
  GUIDE_TABS,
  GUIDE_TAGS,
  GUIDE_TITLE,
  GUIDE_WORDS,
  TOUR_STOPS,
  demoOxygenSample,
  guideTabAfterKey,
  type GuideAction,
  type GuideTab,
} from "../lib/guide";
import type { Site, Stop } from "../planner";
import { EvidenceTag } from "./EvidenceTag";
import { OxygenBar, oxygenBarWidths, type OxygenBarProps } from "./OxygenBar";
import { WHAT_IF_INVITE } from "./WhatIfPanel";
import "../styles/user-guide.css";

/**
 * The header button. `hint` shows the first-visit bubble under it ("New here? Start with
 * the guide."); clicking the bubble only closes it.
 */
export function GuideButton({
  open,
  onToggle,
  hint = false,
  onDismissHint,
}: {
  open: boolean;
  onToggle: () => void;
  hint?: boolean;
  onDismissHint?: () => void;
}) {
  return (
    <span className="guide-anchor">
      <button
        type="button"
        className="guide-button"
        aria-expanded={open}
        aria-controls="user-guide"
        title="Open the user guide (press ?)"
        onClick={onToggle}
      >
        <span aria-hidden="true">?</span> Guide
      </button>
      {hint && !open && (
        <button type="button" className="guide-hint" onClick={onDismissHint}>
          {GUIDE_HINT_TEXT}
        </button>
      )}
    </span>
  );
}

// ---- Icons: plain inline SVG, drawn with the current text colour ----
const Icon = ({ children }: { children: ReactNode }) => (
  <svg className="guide-icon" viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const CARD_ICONS: Record<GuideAction, ReactNode> = {
  // A play triangle in a ring.
  demo: (
    <Icon>
      <circle cx="24" cy="24" r="18" />
      <path d="M20 16 L33 24 L20 32 Z" fill="currentColor" stroke="none" />
    </Icon>
  ),
  // A route: habitat square, a bent line, a stop.
  load: (
    <Icon>
      <rect x="6" y="30" width="10" height="10" />
      <path d="M16 35 L26 35 L32 16 L40 12" />
      <circle cx="40" cy="12" r="4" />
    </Icon>
  ),
  // A warning triangle.
  emergency: (
    <Icon>
      <path d="M24 7 L43 40 L5 40 Z" />
      <path d="M24 19 L24 29" />
      <circle cx="24" cy="34.5" r="1.4" fill="currentColor" stroke="none" />
    </Icon>
  ),
  // Three sliders.
  whatif: (
    <Icon>
      <path d="M6 12 H42 M6 24 H42 M6 36 H42" />
      <circle cx="30" cy="12" r="4" fill="var(--console)" />
      <circle cx="16" cy="24" r="4" fill="var(--console)" />
      <circle cx="34" cy="36" r="4" fill="var(--console)" />
    </Icon>
  ),
};
/** A tiny icon for each stop of the tour, for the preview strip. */
const STOP_ICONS: Record<string, ReactNode> = {
  status: <circle cx="24" cy="24" r="9" fill="currentColor" stroke="none" />,
  stops: (
    <>
      <path d="M18 14 H38 M18 24 H38 M18 34 H38" />
      <circle cx="10" cy="14" r="2" fill="currentColor" stroke="none" />
      <circle cx="10" cy="24" r="2" fill="currentColor" stroke="none" />
      <circle cx="10" cy="34" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  oxygen: (
    <>
      <rect x="6" y="19" width="36" height="10" />
      <path d="M26 19 V29 M36 19 L32 29 M40 19 L36 29" />
    </>
  ),
  route: <path d="M8 38 L18 22 L30 28 L40 10" />,
  zone: <path d="M24 8 C36 8 42 18 40 28 C38 38 28 42 20 40 C10 38 6 28 10 18 C12 12 18 8 24 8 Z" />,
  probe: (
    <>
      <path d="M12 8 L12 30 L18 25 L23 36 L27 34 L22 23 L30 23 Z" />
    </>
  ),
  emergency: (
    <>
      <path d="M24 9 L41 39 L7 39 Z" />
      <path d="M24 20 V29" />
    </>
  ),
  timeline: (
    <>
      <path d="M8 32 H40" />
      <path d="M12 12 L22 18 L12 24 Z" fill="currentColor" stroke="none" />
      <path d="M26 28 V36" />
    </>
  ),
  tools: (
    <>
      <rect x="5" y="17" width="10" height="14" />
      <rect x="19" y="17" width="10" height="14" />
      <rect x="33" y="17" width="10" height="14" />
    </>
  ),
};

// ---- Tab 1: Get started ----
export function GetStartedPanel({ onAction, onScience }: { onAction: (action: GuideAction) => void; onScience: () => void }) {
  return (
    <>
      <div className="guide-cards">
        {GUIDE_CARDS.map((card) => (
          <button type="button" key={card.id} className="guide-card" data-action={card.id} onClick={() => onAction(card.id)}>
            {CARD_ICONS[card.id]}
            <strong>{card.title}</strong>
            <span>{card.line}</span>
          </button>
        ))}
      </div>
      <p className="guide-next">
        {GUIDE_SCIENCE_LINE}:{" "}
        <a
          href="#science"
          onClick={(event) => {
            event.preventDefault();
            onScience();
          }}
        >
          open the Science tab
        </a>
      </p>
    </>
  );
}

// ---- Tab 2: Read the screen ----
export function ReadScreenPanel({ onStartTour }: { onStartTour: () => void }) {
  return (
    <div className="guide-tour-intro">
      <div>
        <p className="guide-lead">A short tour of the real Plan screen: {TOUR_STOPS.length} stops, one at a time, each lit up with a sentence about what it shows.</p>
        <button type="button" className="guide-primary" onClick={onStartTour}>
          Start the tour
        </button>
        <p className="guide-note">{WHAT_IF_INVITE}</p>
      </div>
      <ol className="guide-strip" aria-label="The stops of the tour">
        {TOUR_STOPS.map((stop, i) => (
          <li key={stop.id}>
            <Icon>{STOP_ICONS[stop.id]}</Icon>
            <span>
              <b>{i + 1}</b> {stop.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---- Tab 3: What the colours mean ----
export function ColoursPanel({ sample }: { sample: OxygenBarProps | null }) {
  const widths = sample ? oxygenBarWidths(sample) : null;
  return (
    <div className="guide-colours">
      <section aria-label="Status">
        <h3>Status</h3>
        <div className="guide-pills">
          {GUIDE_STATUSES.map((s) => (
            <figure key={s.status}>
              {/* The same pill as the Plan header. */}
              <span className={`status status--${s.status}`}>EVA · {s.status}</span>
              <figcaption>{s.meaning}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section aria-label="Oxygen bar">
        <h3>Oxygen bar</h3>
        {sample && widths ? (
          <div className="guide-bar">
            <OxygenBar {...sample} />
            {/* A pointer line under the middle of each part, with its name. */}
            <div className="guide-bar__labels" aria-hidden="true">
              <span style={{ left: `${widths.used / 2}%` }}>used</span>
              <span style={{ left: `${widths.used + widths.margin / 2}%` }}>spare</span>
              <span className="is-end" style={{ left: `${widths.used + widths.margin + widths.reserve / 2}%` }}>
                {GUIDE_RESERVE} reserve
              </span>
            </div>
            <p className="guide-note">The demo mission. The hatched end is the reserve: the plan is GO only if it is still untouched at the airlock.</p>
          </div>
        ) : (
          <p className="guide-note" role="status">
            Loading the demo mission…
          </p>
        )}
      </section>

      <section aria-label="On the map">
        <h3>On the map</h3>
        <ul className="guide-swatches">
          {GUIDE_SWATCHES.map((s) => (
            <li key={s.id}>
              <i className={`guide-swatch guide-swatch--${s.id}`} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Evidence tags">
        <h3>How sure each number is</h3>
        <ul className="guide-tags">
          {GUIDE_TAGS.map((t) => (
            <li key={t.level}>
              <EvidenceTag level={t.level} />
              <span>{t.example}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ---- Tab 4: Words ----
/** One chip. Front: the word. Back: its meaning. A click flips it and keeps it; hover and focus peek. */
export function WordChip({ word, meaning, flipped, onFlip }: { word: string; meaning: string; flipped: boolean; onFlip: () => void }) {
  return (
    <button type="button" className={`guide-chip${flipped ? " is-flipped" : ""}`} aria-pressed={flipped} onClick={onFlip}>
      <span className="guide-chip__word">{word}</span>
      <span className="guide-chip__meaning">{meaning}</span>
    </button>
  );
}
export function WordsPanel() {
  const [flipped, setFlipped] = useState<string[]>([]);
  return (
    <>
      <p className="guide-lead">Click a word, or point at it, to turn it over.</p>
      <div className="guide-chips">
        {GUIDE_WORDS.map((w) => (
          <WordChip
            key={w.word}
            word={w.word}
            meaning={w.meaning}
            flipped={flipped.includes(w.word)}
            onFlip={() => setFlipped((now) => (now.includes(w.word) ? now.filter((x) => x !== w.word) : [...now, w.word]))}
          />
        ))}
      </div>
    </>
  );
}

export type GuideHandlers = {
  onClose: () => void;
  /** A Get started card was pressed. */
  onAction: (action: GuideAction) => void;
  onScience: () => void;
  onStartTour: () => void;
};

/** The open guide for a given tab. No state of its own (WordsPanel keeps which chips are turned). */
export function UserGuideView({
  tab,
  onTab,
  sample,
  closeButton,
  onClose,
  onAction,
  onScience,
  onStartTour,
}: GuideHandlers & { tab: GuideTab; onTab: (tab: GuideTab) => void; sample: OxygenBarProps | null; closeButton?: Ref<HTMLButtonElement> }) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = guideTabAfterKey(tab, event.key);
    if (next === tab) return;
    event.preventDefault();
    onTab(next);
    // Keep the keyboard on the tab that is now selected.
    (event.currentTarget.querySelector(`[data-tab="${next}"]`) as HTMLElement | null)?.focus();
  };
  return (
    <div id="user-guide" className="guide-overlay" role="dialog" aria-modal="true" aria-label={GUIDE_TITLE}>
      <div className="guide">
        <header className="guide__head">
          <h2>{GUIDE_TITLE}</h2>
          <button type="button" ref={closeButton} className="guide__close" onClick={onClose} aria-label="Close the guide">
            Close <span aria-hidden="true">(Esc)</span>
          </button>
        </header>
        <div className="guide__tabs" role="tablist" aria-label="Guide sections" onKeyDown={onKeyDown}>
          {GUIDE_TABS.map((t) => (
            <button
              type="button"
              key={t.id}
              role="tab"
              id={`guide-tab-${t.id}`}
              data-tab={t.id}
              aria-selected={t.id === tab}
              aria-controls="guide-panel"
              tabIndex={t.id === tab ? 0 : -1}
              className={t.id === tab ? "is-current" : undefined}
              onClick={() => onTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* key: a new element per tab, so the fade-in runs again on every switch. */}
        <div key={tab} id="guide-panel" className={`guide__panel guide__panel--${tab}`} role="tabpanel" aria-labelledby={`guide-tab-${tab}`}>
          {tab === "start" && <GetStartedPanel onAction={onAction} onScience={onScience} />}
          {tab === "screen" && <ReadScreenPanel onStartTour={onStartTour} />}
          {tab === "colours" && <ColoursPanel sample={sample} />}
          {tab === "words" && <WordsPanel />}
        </div>
      </div>
    </div>
  );
}

/** The guide. Renders nothing while closed. `site` and `demoStops` feed the sample oxygen bar. */
export function UserGuide({ open, site, demoStops, ...handlers }: GuideHandlers & { open: boolean; site: Site | null; demoStops: Stop[] }) {
  const [tab, setTab] = useState<GuideTab>("start");
  const closeButton = useRef<HTMLButtonElement>(null);
  // Opening moves the keyboard to the close button, so Tab continues inside the guide.
  useEffect(() => {
    if (open) closeButton.current?.focus();
    else setTab("start"); // the next time it opens, it starts at the beginning again
  }, [open]);
  // The demo plan is only worked out when the colours tab is first shown.
  const wantSample = open && tab === "colours";
  const sample = useMemo(() => (wantSample ? demoOxygenSample(site, demoStops) : null), [wantSample, site, demoStops]);
  if (!open) return null;
  return <UserGuideView tab={tab} onTab={setTab} sample={sample} closeButton={closeButton} {...handlers} />;
}
