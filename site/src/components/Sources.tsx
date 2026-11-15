import { useState } from "react";

const rows = [
  { type: "Optical", inst: "HiRISE", mission: "Mars Reconnaissance Orbiter", tells: "Ground appearance and boulders", feeds: "Walking difficulty · basemap" },
  { type: "Topographic", inst: "HiRISE DTM · MOLA", mission: "MRO · Mars Global Surveyor", tells: "Elevation, slope and cliffs", feeds: "Walking difficulty" },
  { type: "Thermal", inst: "THEMIS", mission: "Mars Odyssey", tells: "Thermal inertia: low is soft sand, high is bedrock", feeds: "Walking difficulty" },
  { type: "Spectral", inst: "CRISM", mission: "Mars Reconnaissance Orbiter", tells: "Carbonate and clay minerals", feeds: "Science value" },
  { type: "Atmospheric", inst: "MEDA", mission: "Perseverance", tells: "Temperature, dust and wind over the sol", feeds: "Conditions over the day" },
  { type: "Radiation", inst: "RAD", mission: "Curiosity (at Gale Crater)", tells: "Surface dose ≈ 0.64 mSv per sol", feeds: "Conditions over the day" },
];

export function Sources() {
  const [active, setActive] = useState<number | null>(null);

  return (
    <section className="section" id="data" aria-labelledby="data-title">
      <div className="wrap">
        <p className="eyebrow">Data</p>
        <h2 id="data-title" className="h2">Six datasets. Three answers.</h2>
        <p className="lede">
          Where it is safe to walk. Where the best science is. When it is safe to be outside. Every layer in ARES names its
          source.
        </p>

        <div className="src" role="table" aria-label="Data sources">
          <div className="src__head" role="row">
            <span role="columnheader">Type</span>
            <span role="columnheader">Instrument</span>
            <span role="columnheader">Tells us</span>
            <span role="columnheader">Feeds</span>
          </div>
          {rows.map((r, i) => (
            <div
              key={r.inst}
              role="row"
              tabIndex={0}
              className={`src__row${active === i ? " is-active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <span role="cell" className="src__type">{r.type}</span>
              <span role="cell" className="src__inst">
                {r.inst}
                <small>{r.mission}</small>
              </span>
              <span role="cell">{r.tells}</span>
              <span role="cell" className="src__feeds">{r.feeds}</span>
            </div>
          ))}
        </div>
        <p className="fine">
          RAD flies on Curiosity, not Perseverance: shown as a surface baseline measured at Gale Crater and applied to
          Jezero. Solar-particle-event multiplier is illustrative. Imagery and data: NASA/JPL-Caltech and instrument teams.
        </p>
      </div>
    </section>
  );
}
