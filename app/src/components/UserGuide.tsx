// The user guide: a "? Guide" button for the header of every tab, and the panel it opens
// on the right. The panel lies over the page (it never resizes the map) and scrolls by
// itself. Words and numbers come from lib/guide.ts.
import { useEffect, useRef, type Ref } from "react";
import { GUIDE_HINT_TEXT, GUIDE_RESULTS, GUIDE_SECTIONS, GUIDE_START, GUIDE_TAGS, GUIDE_WORDS } from "../lib/guide";
import { EvidenceTag } from "./EvidenceTag";
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

/** The panel. Renders nothing while closed. */
export function UserGuide({ open, onClose, onRunDemo }: { open: boolean; onClose: () => void; onRunDemo: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  // Opening moves the keyboard to the close button, so Tab continues inside the guide.
  useEffect(() => {
    if (open) closeButton.current?.focus();
  }, [open]);
  if (!open) return null;
  return <UserGuideView onClose={onClose} onRunDemo={onRunDemo} closeButton={closeButton} />;
}

/** What the open panel shows. No state of its own. */
export function UserGuideView({ onClose, onRunDemo, closeButton }: { onClose: () => void; onRunDemo: () => void; closeButton?: Ref<HTMLButtonElement> }) {
  return (
    <aside id="user-guide" className="user-guide" role="dialog" aria-label="User guide">
      <header className="user-guide__head">
        <h2>User guide</h2>
        <button type="button" ref={closeButton} className="user-guide__close" onClick={onClose} aria-label="Close the guide">
          Close <span aria-hidden="true">(Esc)</span>
        </button>
      </header>

      <section aria-labelledby="guide-start">
        <h3 id="guide-start">{GUIDE_SECTIONS[0]}</h3>
        <ol className="user-guide__steps">
          {GUIDE_START.map((step, i) => (
            <li key={i}>
              {step}
              {i === 0 && (
                // Starting the tour closes the guide, so the guide never sits on top of the demo's card.
                <button type="button" className="user-guide__run" onClick={onRunDemo}>
                  Run the guided demo
                </button>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="guide-results">
        <h3 id="guide-results">{GUIDE_SECTIONS[1]}</h3>
        <dl className="user-guide__list">
          {GUIDE_RESULTS.map((r) => (
            <div key={r.term}>
              <dt className={r.tone ? `ink-${r.tone}` : undefined}>{r.term}</dt>
              <dd>{r.meaning}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="guide-tags">
        <h3 id="guide-tags">{GUIDE_SECTIONS[2]}</h3>
        <dl className="user-guide__list user-guide__list--tags">
          {GUIDE_TAGS.map((t) => (
            <div key={t.level}>
              <dt>
                <EvidenceTag level={t.level} />
              </dt>
              <dd>
                {t.meaning} <span className="user-guide__example">Example: {t.example}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="guide-words">
        <h3 id="guide-words">{GUIDE_SECTIONS[3]}</h3>
        <dl className="user-guide__list user-guide__list--words">
          {GUIDE_WORDS.map((w) => (
            <div key={w.word}>
              <dt>{w.word}</dt>
              <dd>{w.meaning}</dd>
            </div>
          ))}
        </dl>
      </section>
    </aside>
  );
}
