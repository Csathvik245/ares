import "./terrain3d.css";

/** Single toggle button in the console toolbar. Kept separate from Terrain3D so three.js stays out of the default bundle. */
export function Map3DToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <>
      {/* Shared colour matrix: recolours the 2D safe-return edge to electric blue in the mono theme.
          Terrain3D applies the same numbers per pixel so the 3D view matches. */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
        <filter id="ds-zone-blue" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0 0 0.239 0 0  0 0 0.482 0 0  0 0 1 0 0  0 0 0 1 0" />
        </filter>
      </svg>
      <button
        type="button"
        className={`map-3d-toggle${active ? " is-on" : ""}`}
        aria-pressed={active}
        aria-label="3D terrain"
        onClick={onToggle}
        title={active ? "Back to the 2D map" : "Show the terrain in 3D"}
      >
        3D
      </button>
    </>
  );
}
