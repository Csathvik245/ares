import { CONSOLE_URL } from "./Nav";

export function Cta() {
  return (
    <section className="cta" aria-labelledby="cta-title">
      <div className="wrap">
        <p className="eyebrow">Mission console</p>
        <h2 id="cta-title" className="cta__title">Plan the walk.<br />Know the way home.</h2>
        <div className="cta__actions">
          <a className="btn" href={CONSOLE_URL} target="_blank" rel="noreferrer">
            Open the mission console
          </a>
          <a className="btn btn--ghost" href="https://github.com/Csathvik245/ares" target="_blank" rel="noreferrer">
            View the code
          </a>
        </div>
      </div>

      <footer className="foot">
        <div className="wrap foot__inner">
          <p>
            <strong>The Ares Initiative</strong> — six high school students, one 48-hour build for NASA Space Apps
            Challenge 2026. Science first. Safety always.
          </p>
          <p className="foot__fine">
            Independent student project; not affiliated with or endorsed by NASA. Mars data credited NASA/JPL-Caltech and
            instrument teams. The hero animation is an illustration, not NASA imagery.
          </p>
        </div>
      </footer>
    </section>
  );
}
