"""
validate_traverse.py — an independent check of the ARES terrain model.

Question: Perseverance really drove across this ground. Does our terrain model
agree that the ground it drove on can be crossed?

Data: NASA's official Mars 2020 "Where is Perseverance" map layers
    https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json   (the drive path, as lines)
    https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json  (end-of-drive stops, with rover tilt)
None of this was used to build the terrain layers. (The first waypoint, the
landing point, was used only to place the habitat.)

What it does
  a. For every rover waypoint, and for points sampled every 10 m (or closer) along
     the drive path between them, looks up our cell: slope, rock (roughness),
     thermal inertia, and whether the planner calls it passable (same rule as buildCostGrid: slope > 25 deg or rock > 0.75 = no-go).
  b. Reports the share of the rover's real path that ARES rates passable, and
     compares slope and roughness along the path with the whole site.
  c. Sensitivity: repeats (b) with the slope limit at 20 and 30 deg and the rock
     limit at 0.65 and 0.85.
  d. Saves docs/images/validation_traverse.png: the HiRISE basemap with the
     rover path coloured by our walking difficulty, and no-go cells marked.
Also writes
  pipeline/data/traverse_validation.json                     every number, for docs/validation.md
  app/src/planner/__fixtures__/rover-waypoints-sample.json   waypoints inside our bounds, for a unit test

Run from the repo root (after build_site.py and build_basemap.py):
    python pipeline/validate_traverse.py
"""

import json
import math
import os
import sys
import urllib.request

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from matplotlib.collections import LineCollection  # noqa: E402

BASE_URL = "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/"
TRAVERSE_FILE, WAYPOINTS_FILE = "M20_traverse.json", "M20_waypoints.json"
RAW_DIR = os.path.join("data", "raw")
SITE_PATH = os.path.join("app", "public", "data", "site.json")
BASEMAP_PATH = os.path.join("app", "public", "data", "basemap.png")
OUT_PNG = os.path.join("docs", "images", "validation_traverse.png")
OUT_JSON = os.path.join("pipeline", "data", "traverse_validation.json")
OUT_SAMPLE = os.path.join("app", "src", "planner", "__fixtures__", "rover-waypoints-sample.json")

# Contract 2 constants (keep in sync with app/src/planner/constants.ts)
MAX_SLOPE_DEG = 25
ROCK_NO_GO = 0.75
SAND_TI_THRESHOLD = 175
SAND_SPEED_FACTOR = 0.55
MARS_RADIUS_M = 3396190
STEP_M = 10.0  # the path between waypoints is sampled at least this often (meters)

SLOPE_LIMITS = (20, 25, 30)
ROCK_LIMITS = (0.65, 0.75, 0.85)


def fetch(name):
    path = os.path.join(RAW_DIR, name)
    if not os.path.exists(path):
        os.makedirs(RAW_DIR, exist_ok=True)
        print(f"Downloading {BASE_URL + name}")
        with open(path, "wb") as f:
            f.write(urllib.request.urlopen(BASE_URL + name, timeout=120).read())
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    with open(SITE_PATH, encoding="utf-8") as f:
        site = json.load(f)
    W, H, b = site["width"], site["height"], site["bounds"]
    grid = lambda k: np.array([np.nan if v is None else v for v in site["layers"][k]], dtype=float).reshape(H, W)
    slope, rock, ti = grid("slope"), grid("rock"), grid("thermalInertia")

    def cell_of(lat, lng):
        """Contract 1 click -> cell. Returns (row, col) or None outside the bounds."""
        if not (b["south"] <= lat <= b["north"] and b["west"] <= lng <= b["east"]):
            return None
        col = min(W - 1, math.floor((lng - b["west"]) / (b["east"] - b["west"]) * W))
        row = min(H - 1, math.floor((b["north"] - lat) / (b["north"] - b["south"]) * H))
        return row, col

    m_per_deg_lat = math.radians(1) * MARS_RADIUS_M
    m_per_deg_lng = m_per_deg_lat * math.cos(math.radians((b["south"] + b["north"]) / 2))

    # ---- the rover's path, cut into short pieces -----------------------------------
    traverse = fetch(TRAVERSE_FILE)
    waypoints = fetch(WAYPOINTS_FILE)
    pieces = []  # (lat, lng, length_m, sol) at the middle of each short piece inside our bounds
    total_m_all = 0.0
    for feat in traverse["features"]:
        sol = feat["properties"].get("sol")
        coords = feat["geometry"]["coordinates"]
        for (x0, y0, *_), (x1, y1, *_) in zip(coords[:-1], coords[1:]):
            seg = math.hypot((x1 - x0) * m_per_deg_lng, (y1 - y0) * m_per_deg_lat)
            if seg == 0:
                continue
            total_m_all += seg
            n = max(1, math.ceil(seg / STEP_M))
            for k in range(n):
                t = (k + 0.5) / n
                lat, lng = y0 + (y1 - y0) * t, x0 + (x1 - x0) * t
                if cell_of(lat, lng) is not None:
                    pieces.append((lat, lng, seg / n, sol))
    lat = np.array([p[0] for p in pieces])
    lng = np.array([p[1] for p in pieces])
    length = np.array([p[2] for p in pieces])
    sols = np.array([p[3] for p in pieces])
    rc = np.array([cell_of(a, o) for a, o in zip(lat, lng)])
    rows, cols = rc[:, 0], rc[:, 1]
    p_slope, p_rock, p_ti = slope[rows, cols], rock[rows, cols], ti[rows, cols]
    path_m = float(length.sum())
    unique_cells = np.unique(rows * W + cols)
    u_rows, u_cols = unique_cells // W, unique_cells % W

    def passable_share(max_slope, max_rock):
        ok = (p_slope <= max_slope) & (p_rock <= max_rock)   # NaN compares False -> no-go, like the planner
        ok_cells = (slope[u_rows, u_cols] <= max_slope) & (rock[u_rows, u_cols] <= max_rock)
        site_ok = (slope <= max_slope) & (rock <= max_rock)
        return float(length[ok].sum() / path_m * 100), float(ok_cells.mean() * 100), float(site_ok.mean() * 100)

    base_len, base_cells, base_site = passable_share(MAX_SLOPE_DEG, ROCK_NO_GO)
    nogo = ~((p_slope <= MAX_SLOPE_DEG) & (p_rock <= ROCK_NO_GO))

    # ---- where the rover crossed cells we call no-go ---------------------------------
    nogo_cells = {}
    for r, c, ln, s, a, o in zip(rows[nogo], cols[nogo], length[nogo], sols[nogo], lat[nogo], lng[nogo]):
        e = nogo_cells.setdefault((int(r), int(c)), {"m": 0.0, "sols": set(), "lat": a, "lng": o})
        e["m"] += float(ln)
        e["sols"].add(int(s))
    nogo_list = [
        {"lat": round(v["lat"], 5), "lng": round(v["lng"], 5), "path_m": round(v["m"], 1),
         "sols": sorted(v["sols"]), "slope_deg": float(slope[k]), "rock": float(rock[k]),
         "why": " and ".join(w for w, hit in (("slope", slope[k] > MAX_SLOPE_DEG), ("rock", rock[k] > ROCK_NO_GO)) if hit)}
        for k, v in sorted(nogo_cells.items(), key=lambda kv: -kv[1]["m"])
    ]

    # ---- slope and roughness: along the path vs the whole site ------------------------
    def wq(values, weights, q):
        order = np.argsort(values)
        cum = np.cumsum(weights[order]) / weights.sum()
        return float(values[order][np.searchsorted(cum, q / 100)])

    def summary(path_vals, site_vals):
        qs = (50, 90, 99)
        return {
            "path": {f"p{q}": round(wq(path_vals, length, q), 2) for q in qs} | {"max": round(float(np.nanmax(path_vals)), 2)},
            "site": {f"p{q}": round(float(np.nanpercentile(site_vals, q)), 2) for q in qs} | {"max": round(float(np.nanmax(site_vals)), 2)},
        }

    compare = {"slope_deg": summary(p_slope, slope), "rock": summary(p_rock, rock)}
    sand_path = float(length[p_ti < SAND_TI_THRESHOLD].sum() / path_m * 100)
    sand_site = float(np.nanmean(ti < SAND_TI_THRESHOLD) * 100)

    # Walking difficulty = seconds per meter relative to flat firm ground (Contract 2 speed formula).
    def difficulty(s, r, t):
        speed = np.exp(-3.0 * np.tan(np.radians(s))) * np.where(t < SAND_TI_THRESHOLD, SAND_SPEED_FACTOR, 1.0) * (1 - 0.6 * r)
        d = 1 / speed
        d[(s > MAX_SLOPE_DEG) | (r > ROCK_NO_GO)] = np.nan
        return d

    p_diff = difficulty(p_slope, p_rock, p_ti)
    site_diff = difficulty(slope, rock, ti)
    diff_path = float(np.nansum(p_diff * length) / length[np.isfinite(p_diff)].sum())
    diff_site = float(np.nanmean(site_diff))

    # ---- waypoints: end-of-drive stops, with the rover's own measured tilt -----------------
    wp = []
    for feat in waypoints["features"]:
        p = feat["properties"]
        c = cell_of(p["lat"], p["lon"])
        if c is None:
            continue
        wp.append({"sol": int(p["sol"]), "lat": round(float(p["lat"]), 6), "lng": round(float(p["lon"]), 6),
                   "tiltDeg": round(float(p["tilt"]), 2), "elev": float(p["elev_geoid"]), "cell": c})
    wp_slope = np.array([slope[w["cell"]] for w in wp])
    wp_rock = np.array([rock[w["cell"]] for w in wp])
    wp_tilt = np.array([w["tiltDeg"] for w in wp])
    wp_ok = (wp_slope <= MAX_SLOPE_DEG) & (wp_rock <= ROCK_NO_GO)
    elev = grid("elevation")
    wp_elev_diff = np.abs(np.array([elev[w["cell"]] for w in wp]) - np.array([w["elev"] for w in wp]))

    # ---- sensitivity --------------------------------------------------------------------
    sensitivity = []
    for s_lim in SLOPE_LIMITS:
        for r_lim in ROCK_LIMITS:
            a, c, s = passable_share(s_lim, r_lim)
            sensitivity.append({"max_slope_deg": s_lim, "rock_no_go": r_lim, "path_passable_pct": round(a, 2),
                                "path_cells_passable_pct": round(c, 2), "site_passable_pct": round(s, 2)})

    results = {
        "source": {"traverse": BASE_URL + TRAVERSE_FILE, "waypoints": BASE_URL + WAYPOINTS_FILE,
                   "last_sol_in_file": int(max(f["properties"]["sol"] for f in traverse["features"]))},
        "rover_path": {"total_km_in_file": round(total_m_all / 1000, 2), "km_inside_bounds": round(path_m / 1000, 2),
                       "sols_inside_bounds": [int(sols.min()), int(sols.max())],
                       "cells_touched": int(unique_cells.size), "step_m": STEP_M},
        "passable": {"path_length_pct": round(base_len, 2), "path_cells_pct": round(base_cells, 2),
                     "whole_site_cells_pct": round(base_site, 2),
                     "no_go_path_m": round(float(length[nogo].sum()), 1), "no_go_cells_touched": len(nogo_list)},
        "no_go_cells_on_path": nogo_list,
        "compare": compare,
        "soft_sand_pct": {"path": round(sand_path, 1), "site": round(sand_site, 1)},
        "walking_difficulty_x_flat": {"path_mean": round(diff_path, 2), "site_mean": round(diff_site, 2)},
        "waypoints": {"count_inside_bounds": len(wp), "on_passable_cells": int(wp_ok.sum()),
                      "on_passable_pct": round(float(wp_ok.mean() * 100), 2),
                      "rover_tilt_deg": {"p50": round(float(np.percentile(wp_tilt, 50)), 2), "p90": round(float(np.percentile(wp_tilt, 90)), 2),
                                         "max": round(float(wp_tilt.max()), 2)},
                      "our_slope_deg_at_waypoints": {"p50": round(float(np.percentile(wp_slope, 50)), 2),
                                                     "p90": round(float(np.percentile(wp_slope, 90)), 2), "max": round(float(wp_slope.max()), 2)},
                      "our_slope_at_least_rover_tilt_pct": round(float(np.mean(wp_slope >= wp_tilt) * 100), 1),
                      "tilt_vs_our_slope_correlation": round(float(np.corrcoef(wp_tilt, wp_slope)[0, 1]), 2),
                      "elevation_abs_diff_m": {"p50": round(float(np.median(wp_elev_diff)), 2),
                                               "p99": round(float(np.percentile(wp_elev_diff, 99)), 2)}},
        "sensitivity": sensitivity,
    }
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    sample = {
        "_about": "Perseverance end-of-drive waypoints inside the ARES site bounds, from NASA's Mars 2020 waypoints file. "
                  "Written by pipeline/validate_traverse.py; used by rover-traverse.test.ts.",
        "source": BASE_URL + WAYPOINTS_FILE,
        "passablePctWhenWritten": results["waypoints"]["on_passable_pct"],
        "waypoints": [{"sol": w["sol"], "lat": w["lat"], "lng": w["lng"], "tiltDeg": w["tiltDeg"]} for w in wp],
    }
    with open(OUT_SAMPLE, "w", encoding="utf-8") as f:
        json.dump(sample, f, separators=(",", ":"))

    # ---- picture ---------------------------------------------------------------------------
    extent = (b["west"], b["east"], b["south"], b["north"])
    fig, ax = plt.subplots(figsize=(14, 10), dpi=130)
    if os.path.exists(BASEMAP_PATH):
        ax.imshow(plt.imread(BASEMAP_PATH), cmap="gray", extent=extent, aspect="auto", vmin=0, vmax=1)
    site_nogo = ~((slope <= MAX_SLOPE_DEG) & (rock <= ROCK_NO_GO))
    overlay = np.zeros((H, W, 4))
    overlay[site_nogo] = (1.0, 0.30, 0.35, 0.55)
    ax.imshow(overlay, extent=extent, aspect="auto", interpolation="nearest")
    # One line per traverse feature, coloured by our walking difficulty in the cell under it.
    segs, vals = [], []
    for feat in traverse["features"]:
        coords = feat["geometry"]["coordinates"]
        for (x0, y0, *_), (x1, y1, *_) in zip(coords[:-1], coords[1:]):
            c = cell_of((y0 + y1) / 2, (x0 + x1) / 2)
            if c is None or (x0 == x1 and y0 == y1):
                continue
            segs.append([(x0, y0), (x1, y1)])
            vals.append(site_diff[c])
    vals = np.array(vals)
    lc = LineCollection(segs, cmap="viridis", linewidths=2.2)
    lc.set_array(np.nan_to_num(vals, nan=np.nanmax(vals)))
    lc.set_clim(1.0, 3.0)
    ax.add_collection(lc)
    cb = fig.colorbar(lc, ax=ax, fraction=0.03, pad=0.01)
    cb.set_label("ARES walking difficulty along the rover path (time per meter, 1 = flat firm ground)")
    if nogo_list:
        ax.scatter([n["lng"] for n in nogo_list], [n["lat"] for n in nogo_list], marker="x", s=90, c="#FF4D5A",
                   linewidths=2.2, zorder=5, label=f"Rover path crosses an ARES no-go cell ({len(nogo_list)} cell{'' if len(nogo_list) == 1 else 's'})")
    hab = site["habitat"]
    ax.plot(hab["lng"], hab["lat"], marker="s", ms=10, mfc="#4FD1FF", mec="black", zorder=6, label="HAB-1 (landing site)")
    ax.plot([], [], color=(1.0, 0.30, 0.35), lw=6, alpha=0.55, label="ARES no-go cells (slope > 25° or rock > 0.75)")
    ax.set_xlim(b["west"], b["east"])
    ax.set_ylim(b["south"], b["north"])
    ax.legend(loc="lower right", framealpha=0.9)
    ax.set_title(f"Perseverance's real path vs the ARES terrain model: {base_len:.1f}% of {path_m / 1000:.1f} km rated passable\n"
                 "Image: NASA/JPL-Caltech/University of Arizona/USGS (HiRISE). Path: NASA/JPL-Caltech Mars 2020 traverse", fontsize=11)
    ax.set_xlabel("Longitude (deg E)")
    ax.set_ylabel("Latitude (deg N)")
    os.makedirs(os.path.dirname(OUT_PNG), exist_ok=True)
    fig.tight_layout()
    fig.savefig(OUT_PNG)
    plt.close(fig)

    # ---- report ------------------------------------------------------------------------------
    print(json.dumps({k: v for k, v in results.items() if k != "no_go_cells_on_path"}, indent=2))
    print(f"\nNo-go cells on the rover path ({len(nogo_list)}):")
    for n in nogo_list:
        print(f"  {n['lat']}, {n['lng']}  {n['path_m']:6.1f} m  slope {n['slope_deg']:.1f}  rock {n['rock']:.2f}  ({n['why']})  sols {n['sols']}")
    print(f"\nWrote {OUT_JSON}, {OUT_SAMPLE} ({os.path.getsize(OUT_SAMPLE) / 1024:.0f} KB) and {OUT_PNG}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
