"""Draw the two validation charts shown on the Science page (section 4).

    python pipeline/make_validation_charts.py

Both charts are drawn from real data only:

1. app/public/images/validation_slope_vs_tilt.png
   Scatter plot: the tilt the rover measured at each end-of-drive waypoint, against the
   ARES slope of the 25 m cell under that waypoint.
   pipeline/data/traverse_validation.json stores only the summary (the correlation), not
   the value at each waypoint. So the points are computed here the SAME way
   pipeline/validate_traverse.py does it: the waypoints come from
   app/src/planner/__fixtures__/rover-waypoints-sample.json (written by
   validate_traverse.py from NASA's waypoints file: sol, lat, lng, tilt), and the slope
   is looked up in app/public/data/site.json with the Contract 1 "click to cell" rule.
   The script stops if its correlation is not the one in traverse_validation.json.

2. app/public/images/validation_path_vs_site.png
   Bars: the ground under the rover's path against the whole site, for four measures,
   every value read straight from traverse_validation.json.

Colours are the app's Mono theme. Data credit: NASA/JPL-Caltech (Mars 2020 traverse and
waypoints); terrain from NASA/JPL-Caltech/University of Arizona/USGS (HiRISE).
"""
import json
import math
import os
import sys
from decimal import ROUND_HALF_UP, Decimal

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_PATH = os.path.join(ROOT, "app", "public", "data", "site.json")
WAYPOINTS_PATH = os.path.join(ROOT, "app", "src", "planner", "__fixtures__", "rover-waypoints-sample.json")
RESULTS_PATH = os.path.join(ROOT, "pipeline", "data", "traverse_validation.json")
OUT_DIR = os.path.join(ROOT, "app", "public", "images")
OUT_SCATTER = os.path.join(OUT_DIR, "validation_slope_vs_tilt.png")
OUT_BARS = os.path.join(OUT_DIR, "validation_path_vs_site.png")
MAX_BYTES = 300_000

# Mono theme (app/src/styles/theme-mono.css, tokens.css)
VOID, TEXT, MUTED, LINE = "#0a0a0a", "#ededed", "#a3a3a3", "#3a3a3a"
SAFE, PLAN, CAUTION, NOGO = "#3d7bff", "#ffffff", "#ffb020", "#ff4d5a"
MAX_SLOPE_DEG = 25  # the planner's slope limit (Contract 2), drawn as a guide line


def rounded(value, places):
    """Round half up, like the app and the docs (3.55 is shown as 3.6, not 3.5)."""
    return str(Decimal(str(value)).quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP))


def style(ax):
    ax.set_facecolor(VOID)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color(LINE)
    ax.tick_params(colors=MUTED, labelsize=10)
    ax.xaxis.label.set_color(TEXT)
    ax.yaxis.label.set_color(TEXT)
    ax.title.set_color(TEXT)


def save(fig, path):
    fig.savefig(path, dpi=110, facecolor=VOID)
    plt.close(fig)
    size = os.path.getsize(path)
    print(f"wrote {os.path.relpath(path, ROOT)}  {size / 1000:.0f} KB")
    if size > MAX_BYTES:
        sys.exit(f"{path} is over {MAX_BYTES} bytes")


def slope_at_waypoints():
    """(tilt, our slope) at every waypoint inside the site, as validate_traverse.py computes them."""
    with open(SITE_PATH, encoding="utf-8") as f:
        site = json.load(f)
    with open(WAYPOINTS_PATH, encoding="utf-8") as f:
        waypoints = json.load(f)["waypoints"]
    W, H, b = site["width"], site["height"], site["bounds"]
    slope = np.array([np.nan if v is None else v for v in site["layers"]["slope"]], dtype=float).reshape(H, W)

    def cell_of(lat, lng):  # Contract 1 click -> cell, as in validate_traverse.py
        col = min(W - 1, math.floor((lng - b["west"]) / (b["east"] - b["west"]) * W))
        row = min(H - 1, math.floor((b["north"] - lat) / (b["north"] - b["south"]) * H))
        return row, col

    tilt = np.array([w["tiltDeg"] for w in waypoints], dtype=float)
    ours = np.array([slope[cell_of(w["lat"], w["lng"])] for w in waypoints], dtype=float)
    return tilt, ours


def scatter(results):
    tilt, ours = slope_at_waypoints()
    recorded = results["waypoints"]
    if len(tilt) != recorded["count_inside_bounds"]:
        sys.exit(f"{len(tilt)} waypoints here, {recorded['count_inside_bounds']} in traverse_validation.json")
    r = float(np.corrcoef(tilt, ours)[0, 1])
    if round(r, 2) != recorded["tilt_vs_our_slope_correlation"]:
        sys.exit(f"correlation here is {r:.3f}, traverse_validation.json says {recorded['tilt_vs_our_slope_correlation']}")
    gradient, intercept = np.polyfit(tilt, ours, 1)

    fig, ax = plt.subplots(figsize=(7.6, 5.6), facecolor=VOID)
    style(ax)
    top = max(float(tilt.max()), float(ours.max())) * 1.06
    ax.plot([0, top], [0, top], color=LINE, linewidth=1, linestyle=(0, (4, 4)), label="Equal values")
    ax.axhline(MAX_SLOPE_DEG, color=NOGO, linewidth=1, linestyle=(0, (2, 3)), label=f"ARES no-go limit ({MAX_SLOPE_DEG}°)")
    ax.scatter(tilt, ours, s=16, color=SAFE, alpha=0.75, linewidths=0, label=f"One rover waypoint ({len(tilt)} in all)")
    xs = np.array([0, float(tilt.max())])
    ax.plot(xs, gradient * xs + intercept, color=PLAN, linewidth=2, label="Best-fit line")
    ax.set_xlim(0, top)
    ax.set_ylim(0, top)
    ax.set_xlabel("Tilt measured by the rover at the waypoint (degrees)", fontsize=11)
    ax.set_ylabel("ARES slope of the 25 m cell under it (degrees)", fontsize=11)
    ax.set_title(f"Our slope layer against the rover's own tilt:  r = {recorded['tilt_vs_our_slope_correlation']:.2f}",
                 fontsize=13, loc="left", pad=12, color=TEXT)
    legend = ax.legend(loc="lower right", frameon=False, fontsize=9.5)
    for label in legend.get_texts():
        label.set_color(TEXT)
    fig.text(0.012, 0.012, "Waypoints and tilt: NASA/JPL-Caltech (Mars 2020). Slope: ARES, from HiRISE elevation (NASA/JPL-Caltech/University of Arizona/USGS).",
             color=MUTED, fontsize=7.5)
    fig.tight_layout(rect=(0, 0.03, 1, 1))
    save(fig, OUT_SCATTER)
    return r, gradient, intercept


def bars(results):
    compare, sand, diff, passable = results["compare"], results["soft_sand_pct"], results["walking_difficulty_x_flat"], results["passable"]
    panels = [
        ("Slope, middle value", "degrees", compare["slope_deg"]["path"]["p50"], compare["slope_deg"]["site"]["p50"], (1, "°")),
        ("Roughness, middle value", "0 to 1", compare["rock"]["path"]["p50"], compare["rock"]["site"]["p50"], (2, "")),
        ("Soft sand", "% of ground", sand["path"], sand["site"], (1, "%")),
        ("Walking difficulty", "× flat firm ground", diff["path_mean"], diff["site_mean"], (2, "×")),
    ]
    fig, axes = plt.subplots(1, 4, figsize=(10.4, 4.4), facecolor=VOID)
    for ax, (title, unit, path_value, site_value, (places, suffix)) in zip(axes, panels):
        style(ax)
        rects = ax.bar(["Rover path", "Whole site"], [path_value, site_value], color=[SAFE, MUTED], width=0.62)
        ax.set_ylim(0, max(path_value, site_value) * 1.28)
        ax.set_title(title, fontsize=11.5, loc="left", pad=10, color=TEXT)
        ax.set_ylabel(unit, fontsize=9.5, color=MUTED)
        ax.yaxis.label.set_color(MUTED)
        ax.tick_params(axis="x", colors=TEXT, labelsize=10, length=0)
        for rect, value in zip(rects, (path_value, site_value)):
            ax.text(rect.get_x() + rect.get_width() / 2, rect.get_height(), rounded(value, places) + suffix, ha="center", va="bottom",
                    color=TEXT, fontsize=11, fontweight="bold")
    fig.suptitle("The rover stayed on gentler, smoother, firmer ground than the site as a whole", color=TEXT, fontsize=13, x=0.012, ha="left")
    fig.text(0.012, 0.012,
             f"Rover path: {results['rover_path']['km_inside_bounds']} km inside the site. Rated passable: path {passable['path_length_pct']:.2f}%, site {passable['whole_site_cells_pct']:.2f}%. "
             "Path: NASA/JPL-Caltech (Mars 2020). Terrain: ARES, from NASA orbital data.",
             color=MUTED, fontsize=7.5)
    fig.tight_layout(rect=(0, 0.04, 1, 0.93))
    save(fig, OUT_BARS)


def main():
    with open(RESULTS_PATH, encoding="utf-8") as f:
        results = json.load(f)
    os.makedirs(OUT_DIR, exist_ok=True)
    r, gradient, intercept = scatter(results)
    print(f"  {results['waypoints']['count_inside_bounds']} waypoints, r = {r:.3f}, fit: slope = {gradient:.2f} x tilt + {intercept:.2f}")
    bars(results)


if __name__ == "__main__":
    main()
