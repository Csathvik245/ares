"""
preview_site.py — saves a PNG of each site.json layer with the habitat and POIs
marked, for quick visual checks (and slides). Also saves a "no-go" map showing
cells the planner treats as impassable (slope > 25 deg or rock > 0.75).

Run from the repo root:
    python pipeline/preview_site.py [path/to/site.json]
Output:
    pipeline/previews/<layer>.png
"""

import json
import os
import sys

import matplotlib

matplotlib.use("Agg")  # no window, just files
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

OUT_DIR = os.path.join("pipeline", "previews")

# (colormap, colorbar label, fixed range or None)
STYLE = {
    "elevation": ("terrain", "Elevation (m)", None),
    "slope": ("magma", "Slope (deg)", (0, 45)),
    "rock": ("bone_r", "Boulder density (0-1)", (0, 1)),
    "thermalInertia": ("YlOrBr_r", "Thermal inertia (J m-2 K-1 s-1/2)", None),
    "science": ("Purples", "Science value (0-1)", (0, 1)),
}


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join("app", "public", "data", "site.json")
    with open(path) as f:
        site = json.load(f)
    W, H, b = site["width"], site["height"], site["bounds"]
    # Row 0 = north, so imshow with origin="upper" and this extent puts north on top.
    extent = (b["west"], b["east"], b["south"], b["north"])
    grids = {k: np.array([np.nan if v is None else v for v in a], dtype=float).reshape(H, W)
             for k, a in site["layers"].items()}
    grids["nogo"] = ((grids["slope"] > 25) | (grids["rock"] > 0.75)).astype(float)
    STYLE["nogo"] = ("Reds", "No-go (slope > 25 deg or rock > 0.75)", (0, 1))

    os.makedirs(OUT_DIR, exist_ok=True)
    hab = site["habitat"]
    for name, grid in grids.items():
        cmap, label, rng = STYLE[name]
        fig, ax = plt.subplots(figsize=(9, 6.2), dpi=120)
        im = ax.imshow(grid, cmap=cmap, origin="upper", extent=extent, aspect="auto",
                       vmin=rng[0] if rng else None, vmax=rng[1] if rng else None,
                       interpolation="nearest")
        if name == "thermalInertia":
            ax.contour(grid, levels=[175], colors="#FFB020", linewidths=0.6,
                       origin="upper", extent=extent)
        fig.colorbar(im, ax=ax, label=label)
        ax.plot(hab["lng"], hab["lat"], marker="s", ms=10, mfc="#4FD1FF", mec="black")
        ax.annotate(hab["name"], (hab["lng"], hab["lat"]), xytext=(6, 6),
                    textcoords="offset points", fontsize=9, weight="bold",
                    bbox=dict(boxstyle="round,pad=0.2", fc="white", alpha=0.8))
        for p in site["pois"]:
            hazard = p.get("kind") == "hazard"
            ax.plot(p["lng"], p["lat"], marker="X" if hazard else "o", ms=9,
                    mfc="#FF4D5A" if hazard else "#FF6B35", mec="black")
            ax.annotate(p["id"], (p["lng"], p["lat"]), xytext=(6, -12),
                        textcoords="offset points", fontsize=9,
                        bbox=dict(boxstyle="round,pad=0.2", fc="white", alpha=0.8))
        title = f"{site['name']} - {name}"
        if site.get("fake"):
            title += "  (FAKE DATA)"
        ax.set_title(title)
        ax.set_xlabel("Longitude (deg E)")
        ax.set_ylabel("Latitude (deg N)")
        out = os.path.join(OUT_DIR, f"{name}.png")
        fig.tight_layout()
        fig.savefig(out)
        plt.close(fig)
        print(f"Saved {out}")


if __name__ == "__main__":
    main()
