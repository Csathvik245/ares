import { useState } from "react";

const items = [
  {
    n: "01",
    title: "Mission-first positioning",
    body: "We start with the science objective, then the place, then the person. Every message and every feature has to answer one question: what must the explorer accomplish, and what could stop them?",
    tag: "Strategy",
  },
  {
    n: "02",
    title: "Data storytelling",
    body: "Six NASA datasets become three answers: where it is safe to walk, where the best science is, and when it is safe to be outside. We show the source of every layer and every number.",
    tag: "Story",
  },
  {
    n: "03",
    title: "Flight-grade interfaces",
    body: "Dark consoles, monospaced telemetry, one status light. Calm when everything is fine, loud only when it is not. Built for a habitat screen first, then a helmet display.",
    tag: "Interface",
  },
];

/** Cuff-checklist style rows. One open at a time; fully keyboard accessible. */
export function Capabilities() {
  const [open, setOpen] = useState(0);

  return (
    <section className="section" aria-labelledby="cap-title">
      <div className="wrap">
        <p className="eyebrow">What we do</p>
        <h2 id="cap-title" className="h2">
          Launch a product for someone who can&apos;t afford a bad day.
        </h2>

        <ol className="cap">
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <li key={it.n} className={`cap__row${isOpen ? " is-open" : ""}`}>
                <button
                  type="button"
                  className="cap__head"
                  aria-expanded={isOpen}
                  aria-controls={`cap-panel-${i}`}
                  onClick={() => setOpen(i)}
                  onMouseEnter={() => setOpen(i)}
                >
                  <span className="cap__n">{it.n}</span>
                  <span className="cap__title">{it.title}</span>
                  <span className="cap__tag">{it.tag}</span>
                </button>
                <div id={`cap-panel-${i}`} className="cap__panel" role="region" hidden={!isOpen}>
                  <p>{it.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
