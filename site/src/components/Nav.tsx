import { scrollToId } from "../lib/scroll";

export const CONSOLE_URL = "https://ares-mars-alpha.vercel.app";

const links = [
  { id: "studio", label: "Studio" },
  { id: "ares", label: "ARES" },
  { id: "data", label: "Data" },
];

export function Nav() {
  return (
    <header className="nav">
      <div className="nav__bar" aria-hidden="true">
        <div className="nav__progress" id="scroll-progress" />
      </div>
      <div className="nav__inner">
        <a
          className="nav__brand"
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0 });
          }}
        >
          <img className="nav__mark" src="/brand/ares-patch.png" alt="" width="48" height="40" />
          The Ares Initiative
        </a>
        <nav className="nav__links" aria-label="Sections">
          {links.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              onClick={(e) => {
                e.preventDefault();
                scrollToId(l.id);
              }}
            >
              {l.label}
            </a>
          ))}
        </nav>
        <a className="btn btn--small" href={CONSOLE_URL} target="_blank" rel="noreferrer">
          Open console
        </a>
      </div>
    </header>
  );
}
