"""Draw the three machine-learning charts shown on the Science page (section 5).

    python pipeline/make_ml_charts.py

Every value drawn is read straight from pipeline/data/route_learning.json, the output of
pipeline/learn_route_cost.py. Nothing is typed in here.

1. app/public/images/ml_routes_dumbbell.png
   One row per held-out rover route (31 rows, sorted): the mean distance from the drivers'
   real route for a straight line, the ARES physics model and the learned model, joined
   by a line.

2. app/public/images/ml_win_tie_loss.png
   How many routes came out closer / the same / further: physics against a straight
   line, and the learned model against physics.

3. app/public/images/ml_dislike_factors.png
   The learned "dislike" factor (e^v) of each kind of ground at the end of training, for
   the safety-rule model and the no-rule model, with the physics model (1.0) marked.

Colours are the app's Mono theme, the same style as make_validation_charts.py.
Data credit: NASA/JPL-Caltech (Mars 2020 traverse).
"""
import json
import os
import sys
from decimal import ROUND_HALF_UP, Decimal

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESULTS_PATH = os.path.join(ROOT, "pipeline", "data", "route_learning.json")
OUT_DIR = os.path.join(ROOT, "app", "public", "images")
OUT_DUMBBELL = os.path.join(OUT_DIR, "ml_routes_dumbbell.png")
OUT_WINS = os.path.join(OUT_DIR, "ml_win_tie_loss.png")
OUT_FACTORS = os.path.join(OUT_DIR, "ml_dislike_factors.png")
MAX_BYTES = 300_000

# Mono theme (app/src/styles/theme-mono.css, tokens.css)
VOID, TEXT, MUTED, LINE = "#0a0a0a", "#ededed", "#a3a3a3", "#3a3a3a"
SAFE, PLAN, GREY = "#3d7bff", "#ffffff", "#7a7a7a"
CREDIT = "Rover routes: NASA/JPL-Caltech (Mars 2020 traverse). Scores: pipeline/data/route_learning.json."

# Plain names for the hazard features (ids from route_learning.json "features").
FEATURE_NAMES = {
    "slope_over_8": "Slope above 8°",
    "slope_over_15": "Slope above 15°",
    "roughness": "Roughness",
    "soft_sand": "Soft sand",
    "loose_ground": "Loose ground",
    "near_no_go": "Near no-go ground",
}


def rounded(value, places):
    """Round half up, like the app and the docs."""
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


def draw_dumbbell(results):
    """One row per route: straight line, physics and learned, joined by a line."""
    routes = sorted(results["routes"], key=lambda r: r["physics"]["mean_dev_m"])
    if len(routes) != results["evaluation"]["routes"]:
        sys.exit("route count does not match the evaluation")
    fig, ax = plt.subplots(figsize=(10.4, 9.2), facecolor=VOID)
    style(ax)
    for row, route in enumerate(routes):
        straight = route["straight_line"]["mean_dev_m"]
        physics = route["physics"]["mean_dev_m"]
        learned = route["learned_safe"]["mean_dev_m"]
        ax.plot([min(straight, physics, learned), max(straight, physics, learned)], [row, row], color=LINE, linewidth=2, zorder=1)
        ax.scatter([straight], [row], s=46, color=GREY, zorder=2, label="Straight line (ignores terrain)" if row == 0 else None)
        # The learned model is drawn as a blue ring round the physics dot: where they are
        # the same route, the ring sits exactly on the dot.
        ax.scatter([learned], [row], s=150, facecolors="none", edgecolors=SAFE, linewidths=1.8, zorder=3, label="Learned model (with safety rule)" if row == 0 else None)
        ax.scatter([physics], [row], s=46, color=PLAN, zorder=4, label="ARES physics model" if row == 0 else None)
    ax.set_yticks(range(len(routes)))
    ax.set_yticklabels([f"Route {r['order']:02d} · sols {r['sols'][0]} to {r['sols'][1]}" for r in routes], fontsize=8.5)
    ax.set_ylim(-0.8, len(routes) - 0.2)
    ax.set_xlim(left=0)
    ax.grid(axis="x", color=LINE, linewidth=0.6, alpha=0.6)
    ax.set_axisbelow(True)
    ax.set_xlabel("Mean distance from the drivers' real route (m). Lower is closer to the experts.", fontsize=11)
    ax.set_title(f"All {len(routes)} held-out routes: the learned model lands on the physics route every time",
                 fontsize=13, loc="left", pad=12, color=TEXT)
    legend = ax.legend(loc="lower right", frameon=False, fontsize=10)
    for label in legend.get_texts():
        label.set_color(TEXT)
    fig.text(0.012, 0.010, CREDIT + " Sorted by the physics model's distance.", color=MUTED, fontsize=7.5)
    fig.tight_layout(rect=(0, 0.025, 1, 1))
    save(fig, OUT_DUMBBELL)


def draw_wins(results):
    """Closer / same / further counts for the two head-to-head comparisons."""
    evaluation = results["evaluation"]
    rows = [
        ("ARES physics\nvs straight line", evaluation["physics_vs_straight_line"]),
        ("Learned model\nvs ARES physics", evaluation["learned_safe_vs_physics"]),
    ]
    parts = [("closer", "Closer to the drivers", SAFE, PLAN), ("same", "Same (within 0.5 m)", GREY, PLAN), ("further", "Further away", "#2a2a2a", TEXT)]
    fig, ax = plt.subplots(figsize=(10.4, 3.9), facecolor=VOID)
    style(ax)
    for y, (name, counts) in enumerate(rows):
        if counts["closer"] + counts["same"] + counts["further"] != evaluation["routes"]:
            sys.exit(f"{name}: counts do not add up to {evaluation['routes']}")
        left = 0
        for key, label, colour, ink in parts:
            n = counts[key]
            ax.barh(y, n, left=left, height=0.56, color=colour, edgecolor=VOID, linewidth=2, label=label if y == 0 else None)
            if n > 0:
                ax.text(left + n / 2, y, str(n), ha="center", va="center", color=ink, fontsize=13, fontweight="bold")
            left += n
    ax.set_yticks(range(len(rows)))
    ax.set_yticklabels([name for name, _ in rows], fontsize=11, color=TEXT)
    ax.invert_yaxis()
    ax.set_xlim(0, evaluation["routes"])
    ax.set_xlabel(f"Number of held-out routes (of {evaluation['routes']})", fontsize=11)
    ax.set_title("Route by route: physics beats a straight line; the learned model ties with physics",
                 fontsize=13, loc="left", pad=12, color=TEXT)
    legend = ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.28), ncol=3, frameon=False, fontsize=10)
    for label in legend.get_texts():
        label.set_color(TEXT)
    fig.text(0.012, 0.014, CREDIT, color=MUTED, fontsize=7.5)
    fig.tight_layout(rect=(0, 0.04, 1, 1))
    save(fig, OUT_WINS)


def draw_factors(results):
    """e^v per kind of ground at the end of training, for both models. 1.0 = the physics model."""
    final = results["finalWeights"]
    safe = final["learned_safe"]["endOfTrainingFactors"]
    free = final["learned_no_rule"]["endOfTrainingFactors"]
    ids = [f["id"] for f in results["features"] if f["id"] in safe]
    if sorted(ids) != sorted(FEATURE_NAMES):
        sys.exit("the feature list has changed: update FEATURE_NAMES")
    fig, ax = plt.subplots(figsize=(10.4, 4.8), facecolor=VOID)
    style(ax)
    width = 0.44
    for i, fid in enumerate(ids):
        for offset, values, colour, label in ((-width / 2, safe, SAFE, "With the safety rule"), (width / 2, free, GREY, "No rule")):
            value = values[fid]
            ax.bar(i + offset, value, width=width - 0.04, color=colour, label=label if i == 0 else None)
            ax.text(i + offset, value - 0.03, "×" + rounded(value, 2), ha="center", va="top", color=PLAN, fontsize=9.5, fontweight="bold")
    ax.axhline(1.0, color=PLAN, linewidth=1.2, linestyle=(0, (4, 3)), zorder=5)
    ax.text(len(ids) - 0.38, 1.03, "physics model\n= ×1.00", color=PLAN, fontsize=9.5, ha="left", va="bottom")
    ax.set_xlim(-0.6, len(ids) + 0.45)
    ax.set_xticks(range(len(ids)))
    ax.set_xticklabels([FEATURE_NAMES[fid] for fid in ids], fontsize=10, color=TEXT)
    ax.set_ylim(0, 1.3)
    ax.set_ylabel("Dislike factor (×). Under 1 = less careful", fontsize=10.5)
    ax.set_title("What training learned to dislike, at the end of training", fontsize=13, loc="left", pad=12, color=TEXT)
    legend = ax.legend(loc="upper left", ncol=2, frameon=False, fontsize=10)
    for label in legend.get_texts():
        label.set_color(TEXT)
    fig.text(0.012, 0.014,
             f"End of training, all {results['evaluation']['routes']} routes. The model kept for use fell back to the physics model (every factor ×1.00).\n" + CREDIT,
             color=MUTED, fontsize=7.5)
    fig.tight_layout(rect=(0, 0.07, 1, 1))
    save(fig, OUT_FACTORS)


def main():
    with open(RESULTS_PATH, encoding="utf-8") as f:
        results = json.load(f)
    os.makedirs(OUT_DIR, exist_ok=True)
    draw_dumbbell(results)
    draw_wins(results)
    draw_factors(results)


if __name__ == "__main__":
    main()
