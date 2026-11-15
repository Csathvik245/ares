import { useEffect } from "react";
import { useMission } from "../lib/MissionContext";
import { layers, type OverlayName } from "../lib/layers";
import { SAND_TI_THRESHOLD, cellIndexOf, formatLmst, roundHalfUp } from "../lib/planner";
import { clock } from "../lib/presentation";

/**
 * "all" is the classic left rail (tablet, classic theme). "layers" and "start" are the
 * two collapsible sections of the consolidated desktop column.
 */
export type LayerPart = "all" | "layers" | "start";

/** The layer the demo mission switches on, so the route is seen to follow the terrain. */
export const DEMO_LAYER: OverlayName = "difficulty";
/** The layer list after the demo mission loads: the demo layer added once, nothing else changed. */
export const withDemoLayer = (active: OverlayName[]): OverlayName[] =>
  active.includes(DEMO_LAYER) ? active : [...active, DEMO_LAYER];

/** Which instrument and spacecraft a layer comes from. Shown as the row's tooltip. */
const instrumentOf = (id: string) =>
  id === "sand" ? "THEMIS / Mars Odyssey" : id === "science" ? "CRISM / MRO" : "HiRISE / MRO";

/** Limits of the EVA start time (LMST hours); the same ones the old number field had. */
const START_MIN = 0;
const START_MAX = 23.99;

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

  // Loading the demo mission switches "Walking difficulty" on. It happens once per load:
  // the checkbox still turns it off, and stops added by hand never switch it on.
  useEffect(() => {
    if (part === "start" || !m.terrainHint) return;
    if (!active.includes(DEMO_LAYER)) onChange(withDemoLayer(active));
    m.clearTerrainHint();
  }, [m.terrainHint]);

  // One compact row per layer: the toggle and the name. Source, type and legend are in the tooltip.
  const layerRows = layers.map((l) => (
    <label
      className={`layer-row ${active.includes(l.id) ? "is-active" : ""}`}
      key={l.id}
      title={`${instrumentOf(l.id)} · ${l.type} · ${l.legend}. Source: ${site.sources[l.source]}`}
    >
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
      <span>{l.name}</span>
    </label>
  ));

  const start = m.conditions.startLmst;
  const setStart = (next: number) => {
    m.setConditions((c) => ({
      ...c,
      startLmst: Math.max(START_MIN, Math.min(START_MAX, next)),
    }));
    m.reset();
  };
  const startStepper = (
    <div className="start-stepper" role="group" aria-label="EVA start time">
      <button
        type="button"
        aria-label="Start one hour earlier"
        disabled={!!m.emergency || start - 1 < START_MIN}
        onClick={() => setStart(start - 1)}
      >
        −
      </button>
      <output aria-live="polite">{formatLmst(start)} LMST</output>
      <button
        type="button"
        aria-label="Start one hour later"
        disabled={!!m.emergency || start + 1 > START_MAX}
        onClick={() => setStart(start + 1)}
      >
        +
      </button>
    </div>
  );

  if (part === "layers")
    return (
      <details className="collapsible layers-section">
        <summary>
          <span>Map layers</span>
          <small>{active.length ? `${active.length} on` : "none on"}</small>
        </summary>
        <div className="collapsible-body" aria-label="Terrain layers">
          {layerRows}
        </div>
      </details>
    );

  if (part === "start")
    return (
      <details className="collapsible start-section">
        <summary>
          <span>Start time</span>
          <small>{formatLmst(start)} LMST</small>
        </summary>
        <div className="collapsible-body">{startStepper}</div>
      </details>
    );

  // Classic rail: tablet (where there is no cursor to hover with, so the probe stays here) and ?theme=classic.
  return (
    <aside className="layer-rail" aria-label="Terrain layers">
      <div className="panel-heading">
        <span>Surface data</span>
        <small>measured + derived</small>
      </div>
      <h2>Jezero delta front</h2>
      <p className="rail-intro">Carbonate and clay sampling</p>
      <h3>Map layers</h3>
      {layerRows}
      <h3>Start time</h3>
      {startStepper}
      <section className="cursor-probe">
        <h3>Terrain at {probe < 0 ? "the astronaut" : "the pointer"}</h3>
        {cell >= 0 ? (
          <dl>
            <dt>Elevation</dt>
            <dd>{roundHalfUp(site.layers.elevation[cell])} m</dd>
            <dt>Slope</dt>
            <dd>{roundHalfUp(site.layers.slope[cell], 1)}°</dd>
            <dt>Ground</dt>
            <dd>
              {site.layers.thermalInertia[cell] < SAND_TI_THRESHOLD
                ? "Soft sand risk"
                : "Firm ground proxy"}
            </dd>
            <dt>Science signal</dt>
            <dd>{roundHalfUp(site.layers.science[cell], 2)}</dd>
            <dt>Walk home</dt>
            <dd>{clock(m.home?.cost[cell] ?? Infinity)}</dd>
          </dl>
        ) : (
          <p>Point to terrain to inspect.</p>
        )}
      </section>
      <button className="source-link" onClick={onSources}>
        Data sources and assumptions
      </button>
    </aside>
  );
}
