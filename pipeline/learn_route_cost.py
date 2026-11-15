"""
learn_route_cost.py — can machine learning beat the ARES route planner at
picking routes the way expert drivers do? (A validation of the planner.)

Question: Perseverance's human drivers at JPL chose every route the rover took.
Can a machine learn, from those real routes, which ground experts avoid, and
does a planner using what it learned pick routes closer to the experts' than
our physics-only walking model does? If it cannot, that is independent evidence
that the physics model already routes like the experts.

The method is "learning a cost function from demonstrations", also called
inverse optimal control. We use maximum margin planning (Ratliff, Bagnell &
Zinkevich 2006, "Maximum Margin Planning", ICML, doi:10.1145/1143844.1143936):

  1. Each grid cell gets a few terrain features (walking time from the
     Contract 2 model, steep slope, roughness, soft sand, loose ground, being
     next to a cliff). A cell's cost per meter is
         cost = e^b x walk_time^a x e^(v1 f1 + v2 f2 + ...)
     ("log-linear", so it is always positive and a weight can push either way:
     e^v is how many times dearer the experts treat that kind of ground).
     A route's cost is the sum over the cells it crosses, like the planner's.
  2. For every real rover route, run the planner (Dijkstra, the same 8-neighbour
     grid rules as app/src/planner/search.ts) between its two ends with the
     current weights.
  3. If the planner's route is "cheaper" than the expert's, the weights are
     wrong. Nudge them so the expert's route gets cheaper and the planner's
     gets dearer (a subgradient step). Repeat.
  The planner is made to work a little harder than the expert ("loss
  augmentation"): cells far from the expert's route are slightly cheaper while
  learning, so the weights must beat the expert by a margin, not just tie.
  The weights are pulled towards the physics model (a = 1, every v = 0, which
  is walking time only), so they only move away from it when the rover's
  routes clearly say so. This exponentiated form of maximum margin planning is
  the one in Ratliff, Silver & Bagnell 2009, "Learning to search: Functional
  gradient techniques for imitation learning", Autonomous Robots 27, 25-53,
  doi:10.1007/s10514-009-9121-3.

Safety rule. A rover is not an astronaut, so the learner is trained twice:
  - learned_safe: it may only make routes MORE careful than physics (hazard
    weights >= 0, power on walking time >= 1). This is the only kind of change
    we would ever let into an astronaut's planner.
  - learned_no_rule: no limits, to show what the rover data alone says.
The shipped model (route-model.json) is the learned_safe one. The app does not
use it by default: planRoute only uses it if a caller passes it as `routeGrid`
(app/src/planner/learned.ts). Results: docs/route-learning.md.

Data: NASA's Mars 2020 "Where is Perseverance" traverse file (NASA/JPL-Caltech),
the same file validate_traverse.py uses:
    https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json
None of it was used to build the terrain layers.

Honesty checks
  - Blocked 5-fold cross-validation: the rover's path, in driving order, is cut
    into five blocks; each block is predicted by a model trained on the other
    four, so a model is never scored on ground it learned from.
  - Model selection (which training checkpoint to keep) uses the TRAINING routes
    only; checkpoint 0 is the physics model itself.
  - Every number in the output is printed by this script. Nothing is tuned by hand
    after looking at the test scores.

Writes
  pipeline/data/route_learning.json    every score and weight, for docs/route-learning.md
  docs/images/route_learning.png       every rover route vs physics vs learned, plus the scores
  app/public/data/route-model.json     the learned_safe model + cross-check values for learned.ts

  python pipeline/learn_route_cost.py --export-model   rewrites only route-model.json
                                                        from route_learning.json (no training)

Run from the repo root (after build_site.py, build_basemap.py):
    pip install numpy scipy matplotlib pillow
    python pipeline/learn_route_cost.py
"""

import json
import math
import os
import sys
import time
import urllib.request

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from scipy import ndimage  # noqa: E402
from scipy.sparse import csr_matrix  # noqa: E402
from scipy.sparse.csgraph import dijkstra  # noqa: E402

TRAVERSE_URL = "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json"
RAW_DIR = os.path.join("data", "raw")
SITE_PATH = os.path.join("app", "public", "data", "site.json")
BASEMAP_PATH = os.path.join("app", "public", "data", "basemap.png")
OUT_SCORES = os.path.join("pipeline", "data", "route_learning.json")
OUT_MODEL = os.path.join("app", "public", "data", "route-model.json")
OUT_PNG = os.path.join("docs", "images", "route_learning.png")

# Contract 2 constants (keep in sync with app/src/planner/constants.ts)
BASE_SPEED_KMH = 3.0
MAX_SLOPE_DEG = 25
ROCK_NO_GO = 0.75
SAND_TI_THRESHOLD = 175
SAND_SPEED_FACTOR = 0.55
MARS_RADIUS_M = 3396190

# Feature settings (keep in sync with app/src/planner/learned.ts)
NEAR_NO_GO_RADIUS_CELLS = 2      # "next to a cliff" = a no-go cell within 2 cells (~50 m)
LOOSE_TI_HIGH = 250              # thermal inertia: 175..250 counts as partly loose ground

# Demonstrations
CHUNK_M = 500                    # the rover path is cut into routes about this long
MIN_STRAIGHTNESS = 0.6           # keep routes that head somewhere: straight distance / path length
MAX_GAP_M = 30                   # a jump bigger than this between drives starts a new route
SAMPLE_M = 4.0                   # sampling step along the rover path (meters)

# Learning settings (chosen before looking at test scores; see docs/route-learning.md)
FOLDS = 5
ITERATIONS = 150
STEP0 = 0.1                      # step size (log units), shrinks as 1/sqrt(iteration)
MAX_STEP = 0.2                   # no weight moves more than this in one step
REG = 0.1                        # pull towards the physics model
MARGIN = 0.1                     # loss augmentation, in "flat ground" cost units per meter
LOSS_RADIUS_M = 37.5             # cells further than this from the expert route count as "wrong"
MIN_COST = 0.02                  # floor for the loss-augmented cost while learning
EVAL_EVERY = 10                  # check the real goal (distance from the experts' routes) this often
# Safety rule for the learner: it may make routes MORE careful than the physics
# model, never less. Hazard weights stay >= 0 and the power on walking time >= 1.
# The script also trains WITHOUT the rule, to show what the rover data alone says.
SEED = 20260514

# Feature 0 is the bias b (its value is 1 everywhere); it only sets the overall
# scale, which never changes a route, so it is dropped from the shipped model.
FEATURES = [
    ("bias", "Constant 1 (overall scale only; not used for routing)"),
    ("log_walk_time", "log of walking time per meter from the Contract 2 model divided by the time on flat firm ground; its weight a is a power: walk_time^a"),
    ("slope_over_8", "Slope above 8 degrees: max(0, slope - 8) / 10"),
    ("slope_over_15", "Slope above 15 degrees: max(0, slope - 15) / 10"),
    ("roughness", "Ground roughness (rock layer) / 0.2"),
    ("soft_sand", "1 if thermal inertia is under 175 (soft sand), else 0"),
    ("loose_ground", "How loose the ground is: (250 - thermal inertia) / 75, clipped to 0..1"),
    ("near_no_go", "1 if a no-go cell is within 2 cells (about 50 m), else 0"),
]
NF = len(FEATURES)


# ---------------------------------------------------------------- terrain

def load_site():
    with open(SITE_PATH, encoding="utf-8") as f:
        site = json.load(f)
    W, H = site["width"], site["height"]
    grid = {k: np.array([np.nan if v is None else v for v in site["layers"][k]], dtype=float).reshape(H, W)
            for k in ("slope", "rock", "thermalInertia")}
    return site, grid


def walking_sec_per_m(slope, rock, ti):
    """Contract 2 walking model (calm weather), same as walkingSpeedMps in cost.ts."""
    with np.errstate(invalid="ignore"):
        nogo = np.isnan(slope) | np.isnan(rock) | (slope > MAX_SLOPE_DEG) | (rock > ROCK_NO_GO)
        speed = (BASE_SPEED_KMH / 3.6) * np.exp(-3.0 * np.tan(np.radians(np.nan_to_num(slope))))
        speed = np.where(ti < SAND_TI_THRESHOLD, speed * SAND_SPEED_FACTOR, speed)   # NaN ti -> firm
        speed = speed * (1 - 0.6 * np.nan_to_num(rock))
    sec = np.where(nogo, np.inf, 1.0 / speed)
    return sec, nogo


def cell_features(grid):
    """Feature stack (NF, H, W). Values on no-go cells are set to 0 and never used."""
    slope, rock, ti = grid["slope"], grid["rock"], grid["thermalInertia"]
    sec, nogo = walking_sec_per_m(slope, rock, ti)
    flat = 3.6 / BASE_SPEED_KMH
    s = np.nan_to_num(slope)
    with np.errstate(invalid="ignore"):
        sand = (ti < SAND_TI_THRESHOLD).astype(float)                  # NaN ti -> 0
        loose = np.where(np.isnan(ti), 0.0, np.clip((LOOSE_TI_HIGH - ti) / (LOOSE_TI_HIGH - SAND_TI_THRESHOLD), 0, 1))
    r = NEAR_NO_GO_RADIUS_CELLS
    near = ndimage.binary_dilation(nogo, structure=np.ones((2 * r + 1, 2 * r + 1), bool)).astype(float)
    f = np.stack([
        np.ones_like(s),
        np.where(nogo, 0, np.log(np.where(nogo, 1, sec / flat))),
        np.maximum(0, s - 8) / 10,
        np.maximum(0, s - 15) / 10,
        np.nan_to_num(rock) / 0.2,
        sand,
        loose,
        near,
    ])
    f[:, nogo] = 0
    return f, nogo, sec


# ---------------------------------------------------------------- graph (same rules as search.ts)

def build_edges(nogo, cx, cy):
    """Directed 8-neighbour edges between passable cells, no corner-cutting."""
    H, W = nogo.shape
    idx = np.arange(H * W).reshape(H, W)
    diag = math.hypot(cx, cy)
    us, vs, ls = [], [], []
    for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
        r0, r1 = max(0, -dr), H - max(0, dr)
        c0, c1 = max(0, -dc), W - max(0, dc)
        u = idx[r0:r1, c0:c1]
        v = idx[r0 + dr:r1 + dr, c0 + dc:c1 + dc]
        ok = ~nogo[r0:r1, c0:c1] & ~nogo[r0 + dr:r1 + dr, c0 + dc:c1 + dc]
        if dr and dc:
            ok &= ~nogo[r0:r1, c0 + dc:c1 + dc] & ~nogo[r0 + dr:r1 + dr, c0:c1]
            length = diag
        else:
            length = cy if dr else cx
        us.append(u[ok]); vs.append(v[ok]); ls.append(np.full(ok.sum(), length))
    u, v, length = np.concatenate(us), np.concatenate(vs), np.concatenate(ls)
    # CSR keeps its own order; remember where each edge went so weights can be refreshed fast.
    order = csr_matrix((np.arange(1, len(u) + 1, dtype=float), (u, v)), shape=(H * W, H * W))
    perm = order.data.astype(np.int64) - 1
    return u, v, length, order, perm


class Graph:
    def __init__(self, nogo, cx, cy):
        self.u, self.v, self.len, self.csr, self.perm = build_edges(nogo, cx, cy)
        self.n = nogo.size

    def solve(self, cell_cost, starts):
        """Dijkstra from each start. cell_cost: (n,) cost per meter, > 0 on passable cells."""
        w = self.len * 0.5 * (cell_cost[self.u] + cell_cost[self.v])
        self.csr.data = w[self.perm]
        dist, pred = dijkstra(self.csr, directed=True, indices=starts, return_predecessors=True)
        return dist, pred


def path_from(pred_row, start, goal):
    if goal == start:
        return [start]
    out = [goal]
    while out[-1] != start:
        p = pred_row[out[-1]]
        if p < 0:
            return []
        out.append(int(p))
    return out[::-1]


def path_features(feat_flat, path, W, cx, cy):
    """F(path) = sum over steps of step length x mean of the two cells' features, per meter of path."""
    p = np.asarray(path)
    if len(p) < 2:
        return np.zeros(NF), 0.0
    r, c = p // W, p % W
    dr, dc = np.abs(np.diff(r)), np.abs(np.diff(c))
    length = np.where((dr > 0) & (dc > 0), math.hypot(cx, cy), np.where(dr > 0, cy, cx))
    mean_f = 0.5 * (feat_flat[:, p[:-1]] + feat_flat[:, p[1:]])
    total = (mean_f * length).sum(axis=1)
    L = float(length.sum())
    return total / L, L


# ---------------------------------------------------------------- demonstrations

def fetch_traverse():
    path = os.path.join(RAW_DIR, "M20_traverse.json")
    if not os.path.exists(path):
        os.makedirs(RAW_DIR, exist_ok=True)
        print(f"Downloading {TRAVERSE_URL}")
        with open(path, "wb") as f:
            f.write(urllib.request.urlopen(TRAVERSE_URL, timeout=300).read())
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def ground_m(a, b):
    lat = math.radians((a[1] + b[1]) / 2)
    return MARS_RADIUS_M * math.hypot(math.radians(b[0] - a[0]) * math.cos(lat), math.radians(b[1] - a[1]))


def rover_chains(traverse, bounds):
    """Continuous stretches of rover path inside the site, in driving order: [(lng, lat, sol), ...]."""
    S, N, Wb, E = bounds["south"], bounds["north"], bounds["west"], bounds["east"]
    feats = sorted(traverse["features"], key=lambda f: f["properties"]["sol"])
    chains, cur = [], []
    for f in feats:
        sol = f["properties"]["sol"]
        for p in f["geometry"]["coordinates"]:
            inside = S <= p[1] <= N and Wb <= p[0] <= E
            if not inside:
                if len(cur) > 1:
                    chains.append(cur)
                cur = []
                continue
            q = (p[0], p[1], sol)
            if cur and ground_m(cur[-1], q) > MAX_GAP_M:
                if len(cur) > 1:
                    chains.append(cur)
                cur = []
            if not cur or ground_m(cur[-1], q) > 0.01:
                cur.append(q)
    if len(cur) > 1:
        chains.append(cur)
    return chains


def to_cell(site, lng, lat):
    b, W, H = site["bounds"], site["width"], site["height"]
    col = math.floor((lng - b["west"]) / (b["east"] - b["west"]) * W)
    row = math.floor((b["north"] - lat) / (b["north"] - b["south"]) * H)
    return min(max(row, 0), H - 1), min(max(col, 0), W - 1)


def taut(cells, nogo):
    """Drop staircase corners: if the cells either side of a cell are neighbours, step
    straight between them (a planner never takes a pointless L-shaped step). A diagonal
    shortcut is only taken if it does not cut a no-go corner (same rule as the search)."""
    out = list(cells)
    changed = True
    while changed:
        changed = False
        keep = [out[0]]
        i = 1
        while i < len(out) - 1:
            (r0, c0), (r2, c2) = keep[-1], out[i + 1]
            if max(abs(r2 - r0), abs(c2 - c0)) <= 1 and not (nogo[r0, c2] or nogo[r2, c0]):
                changed = True                      # skip out[i]
            else:
                keep.append(out[i])
            i += 1
        keep.append(out[-1])
        out = keep
    return out


def cells_along(site, pts, nogo=None):
    """8-connected cell path under a polyline, with loops removed (and staircase corners if nogo is given)."""
    cells = []
    for a, b in zip(pts[:-1], pts[1:]):
        n = max(1, int(math.ceil(ground_m(a, b) / SAMPLE_M)))
        for k in range(n + 1):
            t = k / n
            cells.append(to_cell(site, a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])))
    # fill gaps so every step is to a neighbour
    filled = [cells[0]]
    for rc in cells[1:]:
        r0, c0 = filled[-1]
        while max(abs(rc[0] - r0), abs(rc[1] - c0)) > 1:
            r0 += int(np.sign(rc[0] - r0)); c0 += int(np.sign(rc[1] - c0))
            filled.append((r0, c0))
        if rc != filled[-1]:
            filled.append(rc)
    # remove loops: if the path comes back to a cell, cut out the loop
    out, seen = [], {}
    for rc in filled:
        if rc in seen:
            k = seen[rc]
            for dropped in out[k + 1:]:
                seen.pop(dropped, None)
            out = out[:k + 1]
        else:
            seen[rc] = len(out)
            out.append(rc)
    return taut(out, nogo) if nogo is not None and len(out) > 2 else out


def make_demos(site, chains, nogo):
    W = site["width"]
    demos = []
    order = 0
    for chain in chains:
        # cut the chain into pieces of about CHUNK_M of path
        piece, length = [chain[0]], 0.0
        for q in chain[1:]:
            length += ground_m(piece[-1], q)
            piece.append(q)
            if length >= CHUNK_M:
                demos.append({"pts": piece, "length_m": length, "order": order}); order += 1
                piece, length = [q], 0.0
        if length >= CHUNK_M * 0.6:
            demos.append({"pts": piece, "length_m": length, "order": order}); order += 1
    kept, dropped = [], {"wandering": 0, "no_go": 0, "short": 0}
    for d in demos:
        pts = d["pts"]
        straight = ground_m(pts[0], pts[-1]) / max(d["length_m"], 1e-9)
        cells = cells_along(site, pts, nogo)
        idx = [r * W + c for r, c in cells]
        if straight < MIN_STRAIGHTNESS:
            dropped["wandering"] += 1; continue
        if len(idx) < 8:
            dropped["short"] += 1; continue
        if any(nogo.flat[i] for i in idx):
            dropped["no_go"] += 1; continue
        d.update(cells=idx, straightness=straight, sols=[pts[0][2], pts[-1][2]])
        kept.append(d)
    return kept, dropped, len(demos)


# ---------------------------------------------------------------- learning

def cost_of(weights, feat_flat, passable):
    """Cost per meter of each cell: exp(weights . features). Infinity on no-go cells."""
    with np.errstate(over="ignore"):
        c = np.exp(np.tensordot(weights, feat_flat, axes=1))
    return np.where(passable, c, np.inf)


def cost_gradient(cell_cost, feat_flat, path, W, cx, cy):
    """d(route cost)/d(weights) for a route: sum over steps of length x mean of the two cells' cost x features."""
    p = np.asarray(path)
    if len(p) < 2:
        return np.zeros(NF)
    r, c = p // W, p % W
    dr, dc = np.abs(np.diff(r)), np.abs(np.diff(c))
    length = np.where((dr > 0) & (dc > 0), math.hypot(cx, cy), np.where(dr > 0, cy, cx))
    cf = feat_flat[:, p] * cell_cost[p]
    return (0.5 * (cf[:, :-1] + cf[:, 1:]) * length).sum(axis=1)


def loss_map(demo_cells, H, W, cx, cy):
    mask = np.ones((H, W), bool)
    for i in demo_cells:
        mask.flat[i] = False
    dist = ndimage.distance_transform_edt(mask, sampling=(cy, cx))
    return (dist > LOSS_RADIUS_M).astype(float).ravel(), dist.ravel()


def train(demos, ctx, iterations=None, log=False, safe=True):
    iterations = ITERATIONS if iterations is None else iterations
    feat_flat, passable, graph, W = ctx["feat"], ctx["passable"], ctx["graph"], ctx["W"]
    cx, cy = ctx["cx"], ctx["cy"]
    prior = np.zeros(NF); prior[1] = 1.0                         # walking time only
    w = prior.copy()
    avg = np.zeros(NF)
    lower = np.full(NF, -np.inf)
    if safe:
        lower[1] = 1.0                                           # walking time power >= 1
        lower[2:] = 0.0                                          # hazards can only add cost
    # Model selection on the TRAINING routes only: keep the averaged weights that put
    # planned routes closest to the experts'. Checkpoint 0 is the physics model itself.
    best_w, best_dev = prior.copy(), train_deviation(prior, demos, ctx)
    if log:
        print(f"    iter   0: training deviation {best_dev:.2f} m (physics)", flush=True)
    starts = [d["cells"][0] for d in demos]
    goals = [d["cells"][-1] for d in demos]
    for t in range(1, iterations + 1):
        base = cost_of(w, feat_flat, passable)
        grad = np.zeros(NF)
        hinge = 0.0
        for k, d in enumerate(demos):
            aug = np.where(passable, np.maximum(base - MARGIN * d["loss"], MIN_COST), np.inf)
            dist, pred = graph.solve(aug, [starts[k]])
            p = path_from(pred[0], starts[k], goals[k])
            L = d["length_grid"]
            g_demo = cost_gradient(base, feat_flat, d["cells"], W, cx, cy)
            g_plan = cost_gradient(base, feat_flat, p, W, cx, cy)
            grad += (g_demo - g_plan) / L
            hinge += (route_cost(base, d["cells"], W, cx, cy) - dist[0, goals[k]]) / L
        grad = grad / len(demos) + REG * (w - prior)
        w = np.maximum(w - np.clip(STEP0 / math.sqrt(t) * grad, -MAX_STEP, MAX_STEP), lower)
        avg += (w - avg) / t                                     # running average of the weights
        if t % EVAL_EVERY == 0:
            dev = train_deviation(avg, demos, ctx)
            if dev < best_dev - 1e-9:
                best_w, best_dev = avg.copy(), dev
            if log:
                print(f"    iter {t:3d}: margin loss {hinge / len(demos):.4f}  training deviation {dev:.2f} m  "
                      f"weights {np.round(avg[1:], 3)}", flush=True)
    train.last = {"weights": avg.copy(), "deviation_m": train_deviation(avg, demos, ctx), "physics_deviation_m": train_deviation(prior, demos, ctx)}
    return best_w


def train_deviation(weights, demos, ctx):
    """Mean distance (m) between planned and expert routes on the given (training) routes."""
    c = cost_of(weights, ctx["feat"], ctx["passable"])
    return float(np.mean([score(plan_path(c, ctx["graph"], d["cells"][0], d["cells"][-1]), d, ctx)["mean_dev_m"]
                          for d in demos]))


def route_cost(cell_cost, path, W, cx, cy):
    p = np.asarray(path)
    if len(p) < 2:
        return 0.0
    r, c = p // W, p % W
    dr, dc = np.abs(np.diff(r)), np.abs(np.diff(c))
    length = np.where((dr > 0) & (dc > 0), math.hypot(cx, cy), np.where(dr > 0, cy, cx))
    return float((0.5 * (cell_cost[p[:-1]] + cell_cost[p[1:]]) * length).sum())


# ---------------------------------------------------------------- scoring

def plan_path(cell_cost, graph, start, goal):
    dist, pred = graph.solve(cell_cost, [start])
    return path_from(pred[0], start, goal)


def score(path, demo, ctx):
    """Mean distance between the planned route and the expert's, both ways (m), and share of the plan within 50 m."""
    H, W, cx, cy = ctx["H"], ctx["W"], ctx["cx"], ctx["cy"]
    d_to_demo = demo["dist"][path]
    pm = np.ones((H, W), bool)
    for i in path:
        pm.flat[i] = False
    d_to_plan = ndimage.distance_transform_edt(pm, sampling=(cy, cx)).ravel()[demo["cells"]]
    return {
        "mean_dev_m": float(0.5 * (d_to_demo.mean() + d_to_plan.mean())),
        "within_50m_pct": float((d_to_demo <= 50).mean() * 100),
    }


def summarize(rows, key):
    a = np.array([r[key] for r in rows])
    return {"mean": round(float(a.mean()), 1), "median": round(float(np.median(a)), 1)}


def bootstrap_ci(diff, rng, n=5000):
    diff = np.asarray(diff)
    means = rng.choice(diff, size=(n, len(diff)), replace=True).mean(axis=1)
    return [round(float(np.percentile(means, 2.5)), 1), round(float(np.percentile(means, 97.5)), 1)]


# ---------------------------------------------------------------- main

def cross_validate(demos, ctx, fold_of, safe, label):
    """Blocked cross-validation: every route is planned by a model trained without its block."""
    feat_flat, passable, graph = ctx["feat"], ctx["passable"], ctx["graph"]
    rows, fold_weights = [], []
    for fold in range(FOLDS):
        tr = [d for d, f in zip(demos, fold_of) if f != fold]
        te = [d for d, f in zip(demos, fold_of) if f == fold]
        print(f"  [{label}] fold {fold + 1}/{FOLDS}: train on {len(tr)} routes, test on {len(te)}", flush=True)
        w = train(tr, ctx, safe=safe)
        fold_weights.append(w)
        c = cost_of(w, feat_flat, passable)
        for d in te:
            p = plan_path(c, graph, d["cells"][0], d["cells"][-1])
            rows.append({"order": d["order"], "score": score(p, d, ctx), "path": p})
    rows.sort(key=lambda r: r["order"])
    return rows, fold_weights


def main():
    t0 = time.time()
    site, grid = load_site()
    H, W = site["height"], site["width"]
    cx, cy = site["cellSizeM"]["x"], site["cellSizeM"]["y"]
    feat, nogo, _ = cell_features(grid)
    feat_flat = feat.reshape(NF, -1)
    passable = ~nogo.ravel()
    graph = Graph(nogo, cx, cy)
    ctx = {"feat": feat_flat, "passable": passable, "graph": graph, "W": W, "H": H, "cx": cx, "cy": cy}
    print(f"Grid {W} x {H}, {passable.sum()} passable cells, {len(graph.u)} edges")

    traverse = fetch_traverse()
    chains = rover_chains(traverse, site["bounds"])
    demos, dropped, n_pieces = make_demos(site, chains, nogo)
    for d in demos:
        _, d["length_grid"] = path_features(feat_flat, d["cells"], W, cx, cy)
        d["loss"], d["dist"] = loss_map(d["cells"], H, W, cx, cy)
    total_km = sum(d["length_m"] for d in demos) / 1000
    print(f"Rover path cut into {n_pieces} routes of ~{CHUNK_M} m; kept {len(demos)} ({total_km:.2f} km), dropped {dropped}")
    if len(demos) < FOLDS * 2:
        print("Too few routes to learn from.")
        return 1

    # Fixed baselines (nothing to learn).
    physics_w = np.zeros(NF); physics_w[1] = 1.0
    baselines = {"straight_line": np.where(passable, 1.0, np.inf), "physics": cost_of(physics_w, feat_flat, passable)}
    rows = [{"order": d["order"], "sols": d["sols"], "length_m": round(d["length_m"])} for d in demos]
    paths = {}
    for name, c in baselines.items():
        paths[name] = []
        for r, d in zip(rows, demos):
            p = plan_path(c, graph, d["cells"][0], d["cells"][-1])
            r[name] = score(p, d, ctx)
            paths[name].append(p)

    # Learned models, scored on held-out blocks (driving order).
    fold_of = [min(FOLDS - 1, k * FOLDS // len(demos)) for k in range(len(demos))]
    weights_per_fold = {}
    for name, safe in (("learned_safe", True), ("learned_no_rule", False)):
        cv, fw = cross_validate(demos, ctx, fold_of, safe, name)
        weights_per_fold[name] = [[round(float(x), 3) for x in w[1:]] for w in fw]
        paths[name] = []
        for r, c in zip(rows, cv):
            r[name] = c["score"]
            r[name + "_fold"] = fold_of[demos.index(next(d for d in demos if d["order"] == c["order"]))]
            paths[name].append(c["path"])

    def summary(name):
        dev = [r[name]["mean_dev_m"] for r in rows]
        w50 = [r[name]["within_50m_pct"] for r in rows]
        return {"mean_dev_m": {"mean": round(float(np.mean(dev)), 1), "median": round(float(np.median(dev)), 1)},
                "within_50m_pct": {"mean": round(float(np.mean(w50)), 1), "median": round(float(np.median(w50)), 1)}}

    rng = np.random.default_rng(SEED)

    def versus(a, b):
        gain = [r[b]["mean_dev_m"] - r[a]["mean_dev_m"] for r in rows]   # > 0: a is closer
        return {"mean_gain_m": round(float(np.mean(gain)), 1), "gain_95ci_m": bootstrap_ci(gain, rng),
                "closer": sum(g > 0.5 for g in gain), "further": sum(g < -0.5 for g in gain),
                "same": sum(abs(g) <= 0.5 for g in gain)}

    names = ("straight_line", "physics", "learned_safe", "learned_no_rule")
    evaluation = {
        "method": f"Blocked {FOLDS}-fold cross-validation in driving order; learned models never see the block they are scored on",
        "routes": len(rows),
        "metric_mean_dev_m": "Mean distance between the planned route and the rover's real route, measured both ways, meters (lower = closer to the experts)",
        "metric_within_50m_pct": "Share of the planned route within 50 m of the rover's real route, % (higher = closer)",
        **{n: summary(n) for n in names},
        "physics_vs_straight_line": versus("physics", "straight_line"),
        "learned_safe_vs_physics": versus("learned_safe", "physics"),
        "learned_no_rule_vs_physics": versus("learned_no_rule", "physics"),
        "weights_per_fold": weights_per_fold,
    }
    print("\nHeld-out scores (mean distance from the rover's real route, m; lower is closer):")
    for n in names:
        e = evaluation[n]
        print(f"  {n:16s} mean {e['mean_dev_m']['mean']:5.1f}  median {e['mean_dev_m']['median']:5.1f}   "
              f"within 50 m: {e['within_50m_pct']['mean']:5.1f}%")
    for k in ("physics_vs_straight_line", "learned_safe_vs_physics", "learned_no_rule_vs_physics"):
        v = evaluation[k]
        print(f"  {k}: {v['mean_gain_m']} m closer on average (95% CI {v['gain_95ci_m']}); "
              f"closer on {v['closer']}, further on {v['further']}, same on {v['same']}")

    print("\nFinal models on all routes:")
    final = {}
    for name, safe in (("learned_safe", True), ("learned_no_rule", False)):
        print(f"  [{name}]")
        w = train(demos, ctx, log=True, safe=safe)
        last = train.last
        final[name] = {
            "selected": {fid: round(float(x), 4) for (fid, _), x in list(zip(FEATURES, w))[1:]},
            # Where the margin-planning steps were heading before selection (the direction the rover data pushes).
            "endOfTraining": {fid: round(float(x), 4) for (fid, _), x in list(zip(FEATURES, last["weights"]))[1:]},
            "endOfTrainingFactors": {fid: round(math.exp(float(x)), 3) for (fid, _), x in list(zip(FEATURES, last["weights"]))[2:]},
            "endOfTrainingDeviationM": round(last["deviation_m"], 2),
            "physicsDeviationM": round(last["physics_deviation_m"], 2),
        }
        print("   selected:", final[name]["selected"])
        print("   end of training:", final[name]["endOfTraining"],
              f"training deviation {last['deviation_m']:.2f} m vs physics {last['physics_deviation_m']:.2f} m")

    out = {
        "question": ("Can a model learned from the routes Perseverance's drivers chose pick routes closer to the "
                     "experts' than the ARES physics (walking-time) model?"),
        "answer": None,  # filled below from the numbers
        "source": {"traverse": TRAVERSE_URL, "credit": "NASA/JPL-Caltech",
                   "sols": [min(d["sols"][0] for d in demos), max(d["sols"][1] for d in demos)],
                   "routes": len(demos), "km": round(total_km, 2)},
        "features": [{"id": n, "about": a} for n, a in FEATURES[1:]],
        "costModel": "cost per meter = walk_time^a x exp(sum of v x feature); physics model = (a = 1, every v = 0)",
        "training": {
            "method": ("Exponentiated maximum margin planning (Ratliff, Bagnell & Zinkevich 2006; Ratliff, Silver & "
                       "Bagnell 2009): subgradient steps with loss-augmented Dijkstra, weights averaged over iterations"),
            "routeLengthM": CHUNK_M, "minStraightness": MIN_STRAIGHTNESS, "iterations": ITERATIONS,
            "step": STEP0, "maxStep": MAX_STEP, "regularization": REG, "margin": MARGIN, "lossRadiusM": LOSS_RADIUS_M,
            "prior": "walking time only (the physics model)", "dropped": dropped,
            "safetyRule": "learned_safe: hazard weights >= 0 and walking-time power >= 1 (never less careful than physics)",
            "modelSelection": (f"every {EVAL_EVERY} iterations, keep the averaged weights with the smallest mean distance "
                               "from the experts' routes on the TRAINING routes (iteration 0 = physics model)"),
            "demoCleanup": "rover path rasterized to the grid, loops removed, staircase corners removed (taut)",
        },
        "evaluation": evaluation,
        "finalWeights": final,
        "routes": [{k: v for k, v in r.items()} for r in rows],
    }
    ls = evaluation["learned_safe_vs_physics"]
    out["answer"] = (
        f"Physics routes are {evaluation['physics_vs_straight_line']['mean_gain_m']} m closer to the rover's real "
        f"routes than straight lines. The learned model with the safety rule is {ls['mean_gain_m']} m closer than physics "
        f"(95% CI {ls['gain_95ci_m'][0]} to {ls['gain_95ci_m'][1]}); without the rule, "
        f"{evaluation['learned_no_rule_vs_physics']['mean_gain_m']} m."
    )
    print("\n" + out["answer"])
    os.makedirs(os.path.dirname(OUT_SCORES), exist_ok=True)
    with open(OUT_SCORES, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1)

    draw(site, demos, paths, evaluation)
    export_model(out)
    print(f"\nWrote {OUT_SCORES}, {OUT_PNG} and {OUT_MODEL} in {time.time() - t0:.0f} s")
    return 0


def export_model(results):
    """Write app/public/data/route-model.json: the learned_safe weights, where they came
    from, the held-out scores, and cross-check values for app/src/planner/learned.ts."""
    _, grid = load_site()
    feat, nogo, _ = cell_features(grid)
    feat_flat = feat.reshape(NF, -1)
    passable = ~nogo.ravel()
    selected = results["finalWeights"]["learned_safe"]["selected"]
    w = np.zeros(NF)
    w[1:] = [selected[fid] for fid, _ in FEATURES[1:]]
    ratio = np.exp(np.tensordot(w, feat_flat, axes=1))
    pick = np.random.default_rng(SEED).choice(np.flatnonzero(passable), size=24, replace=False)
    pick = np.concatenate([pick, np.flatnonzero(~passable)[:4]])
    ev = results["evaluation"]
    model = {
        "name": "ARES learned route cost",
        "version": 1,
        "about": ("Terrain cost learned from the routes Perseverance's drivers chose (maximum margin planning, "
                  "Ratliff et al. 2006, 2009), with the safety rule: never less careful than the physics model. "
                  "Off by default; used only if passed to planRoute as routeGrid. Changes route shape only: no-go "
                  "cells stay no-go, and walking time, oxygen and status come from the Contract 2 model. "
                  "Made by pipeline/learn_route_cost.py; results in docs/route-learning.md."),
        "assumption": ("Rover drivers' choices stand in for expert route choice. A rover is not an astronaut: its "
                       "limits on slope, rocks and sand differ, so the learned preferences are a proxy."),
        "source": results["source"],
        "costRatio": "cost per meter / cost per meter on flat firm ground = walk_time^a x exp(sum of weight x feature), a = log_walk_time weight",
        "nearNoGoRadiusCells": NEAR_NO_GO_RADIUS_CELLS,
        "looseTiHigh": LOOSE_TI_HIGH,
        "features": [{"id": fid, "about": about, "weight": selected[fid]} for fid, about in FEATURES[1:]],
        "evaluation": {k: ev[k] for k in ("method", "routes", "metric_mean_dev_m", "straight_line", "physics",
                                          "learned_safe", "learned_no_rule", "learned_safe_vs_physics",
                                          "learned_no_rule_vs_physics")},
        "checks": [{"index": int(i), "ratio": (round(float(ratio[i]), 6) if passable[i] else None)} for i in pick],
    }
    os.makedirs(os.path.dirname(OUT_MODEL), exist_ok=True)
    with open(OUT_MODEL, "w", encoding="utf-8") as f:
        json.dump(model, f, indent=1)
        f.write("\n")


def draw(site, demos, paths, evaluation):
    from PIL import Image
    H, W = site["height"], site["width"]
    b = site["bounds"]
    fig = plt.figure(figsize=(14, 7.2), facecolor="#08090B")
    ax = fig.add_axes([0.01, 0.06, 0.62, 0.88])
    ax.set_facecolor("#08090B")
    extent = [b["west"], b["east"], b["south"], b["north"]]
    if os.path.exists(BASEMAP_PATH):
        ax.imshow(np.asarray(Image.open(BASEMAP_PATH).convert("L")), cmap="gray", extent=extent, alpha=0.8)

    def lonlat(cells):
        cells = np.asarray(cells)
        r, c = cells // W, cells % W
        return (b["west"] + (c + 0.5) / W * (b["east"] - b["west"]), b["north"] - (r + 0.5) / H * (b["north"] - b["south"]))

    for k, d in enumerate(demos):
        ax.plot(*lonlat(d["cells"]), color="#ECEAE6", lw=2.8, solid_capstyle="round")
        ax.plot(*lonlat(paths["straight_line"][k]), color="#8A93A3", lw=1.0, ls=(0, (1, 2)))
        ax.plot(*lonlat(paths["learned_no_rule"][k]), color="#A78BFA", lw=1.2, ls=(0, (4, 2)))
        ax.plot(*lonlat(paths["physics"][k]), color="#FF6B35", lw=1.5)
    pad = 0.004
    xs = np.concatenate([lonlat(d["cells"])[0] for d in demos])
    ys = np.concatenate([lonlat(d["cells"])[1] for d in demos])
    ax.set_xlim(xs.min() - pad, xs.max() + pad); ax.set_ylim(ys.min() - pad, ys.max() + pad)
    ax.set_aspect(1 / math.cos(math.radians(18.45)))
    ax.tick_params(colors="#8A93A3", labelsize=8)
    for sp in ax.spines.values():
        sp.set_color("#242833")
    ax.set_title(f"All {len(demos)} rover routes, each planned between the same two ends (none hand-picked)",
                 color="#ECEAE6", fontsize=11, loc="left")
    ax.plot([], [], color="#ECEAE6", lw=2.8, label="Perseverance's real route (chosen by JPL drivers)")
    ax.plot([], [], color="#FF6B35", lw=1.5, label="ARES physics route (walking time)")
    ax.plot([], [], color="#A78BFA", lw=1.2, ls=(0, (4, 2)), label="Learned without safety rule (held-out)")
    ax.plot([], [], color="#8A93A3", lw=1.0, ls=(0, (1, 2)), label="Straight line")
    ax.legend(loc="lower left", fontsize=8, facecolor="#111318", edgecolor="#242833", labelcolor="#ECEAE6")

    bx = fig.add_axes([0.69, 0.2, 0.29, 0.6])
    bx.set_facecolor("#111318")
    bars = [("straight_line", "Straight\nline", "#8A93A3"), ("physics", "ARES\nphysics", "#FF6B35"),
            ("learned_safe", "Learned,\nsafety rule", "#4FD1FF"), ("learned_no_rule", "Learned,\nno rule", "#A78BFA")]
    vals = [evaluation[n]["mean_dev_m"]["mean"] for n, _, _ in bars]
    rect = bx.bar([lbl for _, lbl, _ in bars], vals, color=[c for _, _, c in bars])
    for r, v in zip(rect, vals):
        bx.text(r.get_x() + r.get_width() / 2, v, f"{v:.1f} m", ha="center", va="bottom", color="#ECEAE6", fontsize=10)
    bx.set_ylabel("Mean distance from the rover's real route (m)", color="#8A93A3", fontsize=9)
    bx.tick_params(colors="#8A93A3", labelsize=8)
    for sp in bx.spines.values():
        sp.set_color("#242833")
    bx.set_title(f"Lower = closer to the experts. Learned models scored on\nheld-out routes ({FOLDS}-fold, blocked by driving order)",
                 color="#ECEAE6", fontsize=9, loc="left")
    fig.text(0.01, 0.012, "Routes: NASA/JPL-Caltech (Mars 2020 traverse). Basemap: NASA/JPL-Caltech/University of Arizona/USGS (HiRISE). "
             "Method: maximum margin planning (Ratliff et al. 2006, 2009). Made by pipeline/learn_route_cost.py.",
             color="#8A93A3", fontsize=7)
    os.makedirs(os.path.dirname(OUT_PNG), exist_ok=True)
    fig.savefig(OUT_PNG, dpi=110, facecolor=fig.get_facecolor())
    plt.close(fig)


if __name__ == "__main__":
    if "--export-model" in sys.argv[1:]:
        with open(OUT_SCORES, encoding="utf-8") as f:
            export_model(json.load(f))
        print(f"Wrote {OUT_MODEL}")
        sys.exit(0)
    sys.exit(main())
