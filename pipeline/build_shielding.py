"""
build_shielding.py — adds the "skyView" layer to app/public/data/site.json:
for every 25 m cell, the fraction of the sky an astronaut standing there can see.
Cliffs and crater walls hide part of the sky, and with it part of the radiation
arriving from that part of the sky. The planner's shelter routing
(app/src/planner/shelter.ts) uses this layer during a solar particle event.

Run from the repo root, AFTER build_site.py (which writes site.json without this layer):
    pip install rasterio numpy matplotlib
    python pipeline/build_site.py          # only if site.json needs rebuilding
    python pipeline/build_shielding.py
    python pipeline/check_site.py

Source
------
The same elevation data as every other terrain layer: USGS Astrogeology "Mars 2020
Terrain Relative Navigation HiRISE DTM Mosaic", 1 m/pixel (Fergason et al. 2020,
doi:10.5066/P9REJ9JN). It is read through build_site.py's own functions, so the
cached window in data/raw/, the map projection handling and the grid alignment
are exactly the ones the other layers use. Nothing else is downloaded.

Method
------
1. WORKING GRID: the DTM resampled to about 5 m (each 25 m cell split 5 x 5,
   every value the average of the 1 m pixels inside it). CHOICE: 5 m instead of
   1 m keeps the run to seconds and still resolves the scarps and crater walls
   that matter at the 25 m scale. Cost: ledges and boulders smaller than about
   5 m are smoothed away, so real shielding right against a rock face can be
   better than this layer says.
2. OBSERVER: the centre of each 25 m cell, HELMET_HEIGHT_M above the ground there.
3. HORIZON: in N_AZIMUTHS compass directions, step outward every 5 m to
   SEARCH_RADIUS_M and keep the steepest upward angle to the terrain. That is the
   horizon angle h for that direction (0 if nothing rises above eye level).
4. SKY VIEW: the fraction of the sky hemisphere's solid angle left open,
       skyView = mean over directions of (1 - sin h).
   1.0 = open sky all round; 0.5 = half the sky hidden.
   This is a solid-angle fraction, which is what matters for particles arriving
   from all directions. It is NOT the cosine-weighted "sky-view factor" used for
   heat on a flat surface (mean of cos^2 h), which gives slightly higher numbers.

Limits (also in docs/assumptions.md)
------
- Terrain further than SEARCH_RADIUS_M is ignored, so the far crater rim (which
  is low on the horizon anyway) is not counted.
- The cached DTM window stops about 60 m outside the site. Cells within
  SEARCH_RADIUS_M of the site edge see no terrain beyond it, so their sky view
  can be too high.
- N_AZIMUTHS directions sample the horizon; a very narrow obstacle can be missed.
"""

import json
import math
import os
import sys

import numpy as np
from rasterio.warp import Resampling

import build_site as bs  # same DTM cache, projection handling and grid as the other layers

# ---- Method constants (ASSUMPTIONS — see docs/assumptions.md) -----------------
N_AZIMUTHS = 32            # compass directions sampled
SEARCH_RADIUS_M = 500.0    # how far out the horizon is searched
HELMET_HEIGHT_M = 1.5      # eye / helmet height above the ground
SUB = bs.SUB_5M            # 5 x 5 sub-cells per 25 m cell (~5 m working grid)
DECIMALS = 3

SITE_PATH = bs.OUT_PATH
STATS_PATH = os.path.join("pipeline", "data", "skyview_stats.json")
PREVIEW_PATH = os.path.join("docs", "images", "skyview.png")
SOURCE_TEXT = (
    "Derived from the Mars 2020 HiRISE DTM mosaic, doi:10.5066/P9REJ9JN: sky-view factor "
    f"(open fraction of the sky hemisphere), {N_AZIMUTHS} azimuths, {SEARCH_RADIUS_M:g} m radius, "
    f"observer {HELMET_HEIGHT_M:g} m above ground, computed on a 5 m grid"
)
PREVIEW_CREDIT = (
    "Elevation: HiRISE DTM mosaic, NASA/JPL-Caltech/University of Arizona/USGS. "
    "Sky view computed by The Ares Initiative."
)


def sky_view(z5, dx, dy):
    """
    Sky view (0..1) for every 25 m cell, from the ~5 m elevation grid z5
    (shape HEIGHT*SUB x WIDTH*SUB, row 0 = north, NaN = no data).
    dx, dy = spacing of the 5 m grid in meters (east-west, north-south).
    """
    h5, w5 = z5.shape
    centre = SUB // 2
    rows = np.arange(bs.HEIGHT) * SUB + centre          # the cell centres on the 5 m grid
    cols = np.arange(bs.WIDTH) * SUB + centre
    rr, cc = np.meshgrid(rows, cols, indexing="ij")
    eye = z5[rr, cc] + HELMET_HEIGHT_M                   # NaN where the DTM has no data

    step_m = min(dx, dy)
    distances = np.arange(step_m, SEARCH_RADIUS_M + 1e-6, step_m)
    open_sum = np.zeros((bs.HEIGHT, bs.WIDTH))
    for k in range(N_AZIMUTHS):
        az = 2 * math.pi * k / N_AZIMUTHS                # 0 = north, clockwise
        east, north = math.sin(az), math.cos(az)
        max_tan = np.zeros((bs.HEIGHT, bs.WIDTH))        # 0 = nothing above eye level
        for d in distances:
            r = np.rint(rr - north * d / dy).astype(np.int64)   # row 0 = north, so north is "up"
            c = np.rint(cc + east * d / dx).astype(np.int64)
            inside = (r >= 0) & (r < h5) & (c >= 0) & (c < w5)
            z = np.full((bs.HEIGHT, bs.WIDTH), np.nan)
            z[inside] = z5[r[inside], c[inside]]
            # fmax ignores NaN: missing terrain (or beyond the DTM) does not block the sky.
            max_tan = np.fmax(max_tan, (z - eye) / d)
        horizon = np.arctan(max_tan)                     # radians, >= 0
        open_sum += 1.0 - np.sin(horizon)
    sky = open_sum / N_AZIMUTHS
    sky[np.isnan(eye)] = np.nan
    return np.clip(sky, 0.0, 1.0)


def cell_of(site, lat, lng):
    """Contract 1 click -> cell formula."""
    b = site["bounds"]
    col = math.floor((lng - b["west"]) / (b["east"] - b["west"]) * site["width"])
    row = math.floor((b["north"] - lat) / (b["north"] - b["south"]) * site["height"])
    return min(max(row, 0), site["height"] - 1), min(max(col, 0), site["width"] - 1)


def statistics(site, sky):
    """The sanity numbers quoted in pipeline/README.md and docs/assumptions.md."""
    cell_x, cell_y = bs.cell_sizes_m()
    valid = sky[np.isfinite(sky)]
    slope = np.array([np.nan if v is None else v for v in site["layers"]["slope"]], dtype=float).reshape(sky.shape)
    rock = np.array([np.nan if v is None else v for v in site["layers"]["rock"]], dtype=float).reshape(sky.shape)
    passable = (slope <= 25) & (rock <= 0.75)            # the planner's no-go rule (Contract 2)

    def at(lat, lng):
        r, c = cell_of(site, lat, lng)
        return round(float(sky[r, c]), DECIMALS)

    def lowest_passable_near(lat, lng, radius_m):
        r0, c0 = cell_of(site, lat, lng)
        rr, cc = np.mgrid[0:sky.shape[0], 0:sky.shape[1]]
        near = np.hypot((rr - r0) * cell_y, (cc - c0) * cell_x) <= radius_m
        pick = np.where(near & passable & np.isfinite(sky), sky, np.inf)
        r, c = np.unravel_index(np.argmin(pick), pick.shape)
        b = site["bounds"]
        return {
            "skyView": round(float(sky[r, c]), DECIMALS),
            "lat": round(b["north"] - (r + 0.5) / sky.shape[0] * (b["north"] - b["south"]), 5),
            "lng": round(b["west"] + (c + 0.5) / sky.shape[1] * (b["east"] - b["west"]), 5),
            "distance_m": round(float(math.hypot((r - r0) * cell_y, (c - c0) * cell_x))),
        }

    hab = site["habitat"]
    toe = next((p for p in site["pois"] if p["id"] == "delta-toe"), None)
    stats = {
        "method": {
            "azimuths": N_AZIMUTHS, "search_radius_m": SEARCH_RADIUS_M, "helmet_height_m": HELMET_HEIGHT_M,
            "working_grid_m": round(min(cell_x, cell_y) / SUB, 2), "formula": "mean over azimuths of (1 - sin(horizon angle))",
        },
        "cells": int(valid.size),
        "null_cells": int(np.isnan(sky).sum()),
        "min": round(float(valid.min()), DECIMALS),
        "median": round(float(np.median(valid)), DECIMALS),
        "max": round(float(valid.max()), DECIMALS),
        "percentiles": {f"p{p}": round(float(np.percentile(valid, p)), DECIMALS) for p in (1, 5, 25, 75, 95, 99)},
        "share_below_0.9": round(float((valid < 0.9).mean()), 4),
        "share_below_0.8": round(float((valid < 0.8).mean()), 4),
        "share_below_0.7": round(float((valid < 0.7).mean()), 4),
        "passable_cells_below_0.8": int((passable & (sky < 0.8)).sum()),
        "passable_cells_below_0.7": int((passable & (sky < 0.7)).sum()),
        "open_crater_floor_HAB-1": at(hab["lat"], hab["lng"]),
    }
    if toe:
        stats["delta_scarp_foot_delta-toe_poi"] = at(toe["lat"], toe["lng"])
        stats["lowest_passable_within_300m_of_delta-toe"] = lowest_passable_near(toe["lat"], toe["lng"], 300)
    stats["lowest_passable_within_1500m_of_HAB-1"] = lowest_passable_near(hab["lat"], hab["lng"], 1500)
    return stats


def preview(site, sky):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    b = site["bounds"]
    fig, ax = plt.subplots(figsize=(9, 6.4), dpi=120)
    im = ax.imshow(sky, cmap="viridis", vmin=0.6, vmax=1.0, origin="upper",
                   extent=(b["west"], b["east"], b["south"], b["north"]), aspect="auto", interpolation="nearest")
    fig.colorbar(im, ax=ax, label="Sky view (open fraction of the sky; colours start at 0.6)")
    hab = site["habitat"]
    ax.plot(hab["lng"], hab["lat"], marker="s", ms=9, mfc="#4FD1FF", mec="black")
    ax.annotate(hab["name"], (hab["lng"], hab["lat"]), xytext=(6, 6), textcoords="offset points", fontsize=9,
                weight="bold", bbox=dict(boxstyle="round,pad=0.2", fc="white", alpha=0.8))
    for p in site["pois"]:
        ax.plot(p["lng"], p["lat"], marker="o", ms=6, mfc="#FF6B35", mec="black")
    ax.set_title(f"{site['name']} - sky view ({N_AZIMUTHS} azimuths, {SEARCH_RADIUS_M:g} m, eye at {HELMET_HEIGHT_M:g} m)")
    ax.set_xlabel("Longitude (deg E)")
    ax.set_ylabel("Latitude (deg N)")
    fig.text(0.01, 0.01, PREVIEW_CREDIT, fontsize=7, color="#333333")
    fig.tight_layout(rect=(0, 0.03, 1, 1))
    os.makedirs(os.path.dirname(PREVIEW_PATH), exist_ok=True)
    fig.savefig(PREVIEW_PATH)
    plt.close(fig)


def main():
    with open(SITE_PATH, encoding="utf-8") as f:
        site = json.load(f)
    if (site["width"], site["height"]) != (bs.WIDTH, bs.HEIGHT):
        raise SystemExit("site.json grid does not match build_site.py")

    bs.fetch_dtm_window()                                 # uses data/raw/ if it is already there
    bs.log("Resampling the DTM to the 5 m working grid (average of 1 m pixels) ...")
    z5 = bs.resample_dtm(SUB, Resampling.average).astype(np.float64)
    cell_x, cell_y = bs.cell_sizes_m()
    dx, dy = cell_x / SUB, cell_y / SUB
    bs.log(f"Computing sky view: {N_AZIMUTHS} azimuths, {SEARCH_RADIUS_M:g} m radius, 5 m grid {dx:.2f} x {dy:.2f} m ...")
    sky = sky_view(z5, dx, dy)

    # The layer must sit on the same terrain as the elevation layer already in site.json.
    elev = np.array([np.nan if v is None else v for v in site["layers"]["elevation"]], dtype=float).reshape(sky.shape)
    sky[np.isnan(elev)] = np.nan
    if np.isnan(sky[np.isfinite(elev)]).any():
        raise SystemExit("sky view is missing where elevation exists")

    before = {k: json.dumps(v, sort_keys=True) for k, v in site.items() if k not in ("layers", "sources")}
    before_layers = {k: json.dumps(v) for k, v in site["layers"].items() if k != "skyView"}

    site["layers"]["skyView"] = bs.to_list(sky, DECIMALS)
    site["sources"]["skyView"] = SOURCE_TEXT

    # Nothing else in the file may change.
    assert before == {k: json.dumps(v, sort_keys=True) for k, v in site.items() if k not in ("layers", "sources")}
    assert before_layers == {k: json.dumps(v) for k, v in site["layers"].items() if k != "skyView"}

    with open(SITE_PATH, "w", encoding="utf-8") as f:
        json.dump(site, f, separators=(",", ":"))
    size_mb = os.path.getsize(SITE_PATH) / 1e6
    if size_mb >= 5:
        raise SystemExit(f"site.json is {size_mb:.2f} MB, over the 5 MB limit")

    stats = statistics(site, np.array([np.nan if v is None else v for v in site["layers"]["skyView"]]).reshape(sky.shape))
    with open(STATS_PATH, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2)
    preview(site, sky)

    bs.log(f"\nWrote layers.skyView to {SITE_PATH} ({size_mb:.2f} MB), {STATS_PATH} and {PREVIEW_PATH}")
    bs.log(json.dumps(stats, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
