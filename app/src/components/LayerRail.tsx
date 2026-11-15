import { useMission } from "../lib/MissionContext";
import { layers, type OverlayName } from "../lib/layers";
import { SAND_TI_THRESHOLD, cellIndexOf } from "../lib/planner";
import { clock } from "../lib/presentation";

/** "all" is the classic left rail. "layers" and "probe" let the consolidated desktop panel interleave sections. */
export type LayerPart = "all" | "layers" | "probe";

export function LayerRail({
  active,
  onChange,
  probe,
  onSources,
  part = "all",
}: {
  active: OverlayName[];
  onChange: (next: OverlayName[]) => void;
  probe: number;
  onSources: () => void;
  part?: LayerPart;
}) {
  const m = useMission(),
    site = m.site!;
  const cell = probe >= 0 ? probe : cellIndexOf(site, m.position);

  const stitchNames: Record<string, string> = {
    slope: "Slope gradient",
    science: "Science value priority",
  };
  const layerRows = layers.map((l) => (
    <label
      className={`layer-row ${active.includes(l.id) ? "is-active" : ""}`}
      key={l.id}
    >
      <span>
        <input
          type="checkbox"
          checked={active.includes(l.id)}
          onChange={() =>
            onChange(
              active.includes(l.id)
                ? active.filter((k) => k !== l.id)
                : [...active, l.id],
            )
          }
        />
        {part === "layers" ? (stitchNames[l.id] ?? l.name) : l.name}
      </span>
      <small>
        {l.type} ·{" "}
        {l.id === "sand"
          ? "THEMIS / Mars Odyssey"
          : l.id === "science"
            ? "CRISM / MRO"
            : "HiRISE / MRO"}
      </small>
      {active.includes(l.id) && <em>{l.legend}</em>}
      <span className="source-detail" title={site.sources[l.source]}>
        {site.sources[l.source]}
      </span>
    </label>
  ));

  const startLmst = (
    <label className="start-lmst">
      Start LMST
      <input
        type="number"
        aria-label="Start LMST"
        min="0"
        max="23.99"
        step="0.25"
        value={m.conditions.startLmst}
        disabled={!!m.emergency}
        onChange={(e) => {
          m.setConditions((c) => ({
            ...c,
            startLmst: Math.max(0, Math.min(23.99, Number(e.target.value))),
          }));
          m.reset();
        }}
      />
    </label>
  );

  const probeBlock = (
    <section className="cursor-probe">
      <h3>CURSOR PROBE</h3>
      {probe < 0 && (
        <p className="probe-hint">Current position · point to inspect</p>
      )}
      {cell >= 0 ? (
        <dl>
          <dt>Elevation</dt>
          <dd>{site.layers.elevation[cell].toFixed(0)} m</dd>
          <dt>Slope</dt>
          <dd>{site.layers.slope[cell].toFixed(1)}°</dd>
          <dt>Ground</dt>
          <dd>
            {site.layers.thermalInertia[cell] < SAND_TI_THRESHOLD
              ? "Soft sand risk"
              : "Firm ground proxy"}
          </dd>
          <dt>Science signal</dt>
          <dd>{site.layers.science[cell].toFixed(2)}</dd>
          <dt>Walk home</dt>
          <dd>{clock(m.home?.cost[cell] ?? Infinity)}</dd>
        </dl>
      ) : (
        <p>Point to terrain to inspect.</p>
      )}
    </section>
  );

  if (part === "layers")
    return (
      <section className="layers-section" aria-label="Terrain layers">
        <div className="panel-heading">
          <span>SURFACE ANALYSIS LAYERS</span>
          <small>measured + derived</small>
        </div>
        {layerRows}
        {startLmst}
      </section>
    );

  if (part === "probe")
    return (
      <div className="probe-section">
        {probeBlock}
        <div className="model-note">
          <span>DATA AND MODEL</span>
          <p>
            HiRISE · MRO local orthomosaic ·{" "}
            {m.basemap
              ? `${m.basemap.metersPerPixel.toFixed(1)} m / pixel`
              : "elevation fallback"}
          </p>
          <small>Tobler variant · 25 m grid · speed and burn rates assumed</small>
        </div>
        <button className="source-link" onClick={onSources}>
          Data sources & assumptions
        </button>
      </div>
    );

  return (
    <aside className="layer-rail" aria-label="Terrain layers">
      <div className="panel-heading">
        <span>SURFACE DATA</span>
        <small>measured + derived</small>
      </div>
      <h2>Jezero delta front</h2>
      <p className="rail-intro">Carbonate and clay sampling</p>
      <div className="basemap-source">
        <b>HiRISE</b>
        <span>MRO · local orthomosaic</span>
        <small>
          {m.basemap
            ? `${m.basemap.metersPerPixel.toFixed(1)} m / pixel`
            : "Elevation fallback"}{" "}
          · measured
        </small>
      </div>
      <h3>ANALYSIS LAYERS</h3>
      {layerRows}
      {startLmst}
      <div className="model-note">
        <span>ROUTING MODEL</span>
        <p>Tobler variant · 25 m grid</p>
        <small>Suited speed and burn rates assumed</small>
      </div>
      {probeBlock}
      <button className="source-link" onClick={onSources}>
        Data sources & assumptions
      </button>
    </aside>
  );
}
