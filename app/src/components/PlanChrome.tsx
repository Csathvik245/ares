// Small pieces of the Plan view that keep the first screen calm:
//   Jargon        an official term with a (?) that explains it in plain words
//   ViewMenu      one "View" menu in the header for the less-used views
//   EmptyPlanCard the card over the map when there is no plan yet
//   MapLegend     a "Legend" chip that lists only what is on the map now
//   InfoTip       an (i) with details shown on hover or keyboard focus
// No planner logic here. Styles: styles/plan-view.css.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** Plain-language meanings of the terms the console keeps using. */
export const PLAIN_WORDS = {
  EVA: "the astronaut's walk outside",
  LMST: "local Mars time",
  SPE: "solar particle event: a burst of radiation",
  status: "GO / CAUTION / NO-GO: safe / safe but tight / not safe",
  "T+": "time since leaving the habitat",
  reserve: "oxygen kept back for emergencies",
} as const;
export type PlainWord = keyof typeof PLAIN_WORDS;

/**
 * A (?) next to a piece of jargon. The official term stays visible beside it; the plain
 * meaning shows on hover and on keyboard focus, and is the button's accessible name.
 */
export function Jargon({ term, label }: { term: PlainWord; label?: string }) {
  const id = useId();
  const name = label ?? (term === "status" ? "GO, CAUTION, NO-GO" : term);
  return (
    <span className="jargon">
      <button type="button" className="jargon__button" aria-label={`${name}: ${PLAIN_WORDS[term]}`} aria-describedby={id}>
        ?
      </button>
      <span className="jargon__tip" role="tooltip" id={id}>
        {PLAIN_WORDS[term]}
      </span>
    </span>
  );
}

/** An (i) button whose details appear on hover and on keyboard focus. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <span className="info-tip">
      <button type="button" className="info-tip__button" aria-label={label} aria-describedby={id}>
        i
      </button>
      <span className="info-tip__body" role="tooltip" id={id}>
        {children}
      </span>
    </span>
  );
}

export type ViewMenuItem = {
  id: string;
  label: string;
  /** Shown at the right of the row, for example a keyboard shortcut. */
  hint?: string;
  /** For an on/off item: whether it is on now. */
  checked?: boolean;
  onSelect: () => void;
};

/**
 * The header's "View" menu. Keyboard: Enter or Space opens it, the arrow keys move,
 * Home and End jump, Escape closes it and puts the focus back on the button.
 * `defaultOpen` is for tests and screenshots.
 */
export function ViewMenu({ items, defaultOpen = false }: { items: ViewMenuItem[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const rows = () => [...(root.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]') ?? [])];

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      close(true);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (!open) {
      setOpen(true);
      // Focus the first row once it is on screen.
      requestAnimationFrame(() => rows()[0]?.focus());
      return;
    }
    const all = rows();
    const at = all.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home" ? 0 : event.key === "End" ? all.length - 1 : (at + (event.key === "ArrowDown" ? 1 : -1) + all.length) % all.length;
    all[next]?.focus();
  };

  return (
    <div className="view-menu" ref={root} onKeyDown={onKeyDown}>
      <button
        type="button"
        ref={button}
        className="view-menu__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
      >
        View <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="view-menu__list" role="menu" id={menuId} aria-label="View">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
              aria-checked={item.checked}
              onClick={() => {
                item.onSelect();
                close(true);
              }}
            >
              <span>{item.label}</span>
              {(item.checked !== undefined || item.hint) && (
                <small>{item.checked !== undefined ? (item.checked ? "on" : "off") : item.hint}</small>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The card over the map while there is no plan: what this page is for, and the next click. */
export function EmptyPlanCard({
  onRunDemo,
  onLoadDemo,
  canLoadDemo = true,
}: {
  onRunDemo: () => void;
  onLoadDemo: () => void;
  canLoadDemo?: boolean;
}) {
  return (
    <section className="empty-plan-card" aria-label="Start here">
      <h2>Plan a walk on Mars</h2>
      <p>ARES checks that the astronaut can get there and back.</p>
      <div className="empty-plan-card__actions">
        <button type="button" className="plan-primary" onClick={onRunDemo}>
          Run the guided demo
        </button>
        <button type="button" onClick={onLoadDemo} disabled={!canLoadDemo}>
          Load demo mission
        </button>
      </div>
      <p className="empty-plan-card__hint">or click the map to add your own stops</p>
    </section>
  );
}

export type LegendItem = { id: string; label: string; glyph: "line" | "dash" | "dot"; tone: "plan" | "safe" | "site" | "danger" | "muted" | "shelter" };

/** What the legend lists for the things drawn on the map right now. */
export function legendItems(on: {
  route: boolean;
  safeZone: boolean;
  sampleSites: boolean;
  emergency: boolean;
  shelter: boolean;
  blocked: boolean;
}): LegendItem[] {
  const items: LegendItem[] = [];
  if (on.route && !on.emergency) items.push({ id: "route", label: "Planned route", glyph: "line", tone: "plan" });
  if (on.safeZone && !on.emergency) items.push({ id: "zone", label: "Edge of safe return", glyph: "line", tone: "safe" });
  if (on.emergency) {
    items.push({ id: "return", label: "Route to follow now", glyph: "line", tone: "danger" });
    items.push({ id: "cancelled", label: "Cancelled part of the plan", glyph: "dash", tone: "muted" });
  }
  if (on.shelter) items.push({ id: "shelter", label: "Shelter option", glyph: "dash", tone: "shelter" });
  if (on.blocked) items.push({ id: "blocked", label: "Blocked area", glyph: "dash", tone: "danger" });
  if (on.sampleSites) items.push({ id: "sites", label: "Rover sample site", glyph: "dot", tone: "site" });
  return items;
}

const GLYPH = { line: "―", dash: "┄", dot: "●" } as const;

/** A small "Legend" chip. It opens on click (and on hover with a mouse) and lists only what is on the map. */
export function MapLegend({ items, defaultOpen = false }: { items: LegendItem[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  if (items.length === 0) return null;
  return (
    <div className={`map-legend-chip${open ? " is-open" : ""}`}>
      <button type="button" className="map-legend-chip__button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        Legend
      </button>
      {/* Always in the page, so hovering the chip can show it; hidden by CSS until hover, focus or a click. */}
      <ul id={id}>
        {items.map((item) => (
          <li key={item.id}>
            <em className={`legend-glyph legend-glyph--${item.tone}`} aria-hidden="true">
              {GLYPH[item.glyph]}
            </em>
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
