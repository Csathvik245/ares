"""
check_site.py — verifies app/public/data/site.json against Contract 1 and
checks that the terrain is actually walkable for the planner.

Works on both the real file (built by build_site.py) and the fake test fixture
(app/src/planner/__fixtures__/fake-site.json, marked "fake": true).

Checks on every file:
  1. Contract 1 shape: all keys, width/height, cellSizeM, layer lengths = 76800,
     no NaN/Infinity, value ranges, 2-decimal rounding, file size < 5 MB.
     A layer may be entirely null only if its "sources" entry starts with PENDING.
  3. Habitat sits on flat, firm ground: slope < 5 deg, rock < 0.2, and
     thermalInertia >= 175 (skipped while thermal inertia is pending).
  4. Every POI is reachable from the habitat walking only through cells with
     slope <= 25 deg and rock <= 0.75 (8-neighbor flood fill, no corner-cutting,
     same rule as the planner in CLAUDE.md section 6).

Real file only:
  2. Orientation and georeferencing: cell elevations are compared with the
     source DTM (data/raw/jezero_hirise_dtm_1m_window.tif) sampled at the cell's
     lat/lng. If rows or columns were flipped or shifted this fails badly.
     Skipped with a warning if the DTM cache is not on this machine.
     Also: the slope layer (90th percentile of 5 m slopes) must be at least as
     steep as the slope of the 25 m elevation grid, and follow it.

Fake fixture only (these test features that were built into the fake terrain):
  2. Orientation from the fake scarp, slope recomputed from elevation, science
     hotspots at the POIs.
  5. Delta scarp ramps (~18.435 N and ~18.472 N) are gentle walkable crossings.
  6. The crater-floor boulder field blocks the straight line HAB-1 -> clay-1.

Run from the repo root:
    python pipeline/check_site.py [path/to/site.json]
Exit code 0 = all checks pass, 1 = at least one failure.
"""

import json
import math
import os
import sys
from collections import deque

import numpy as np

# Contract 2 constants (keep in sync with app/src/planner/constants.ts)
MAX_SLOPE_DEG = 25
ROCK_NO_GO = 0.75
SAND_TI_THRESHOLD = 175

# Habitat "flat, firm ground" rule (team requirement for this check)
HAB_MAX_SLOPE = 5
HAB_MAX_ROCK = 0.2

# Ramp check: a slope an astronaut can comfortably climb with a sample kit
RAMP_MAX_SLOPE = 15
RAMP_LATS = (18.435, 18.472)
RAMP_HALF_BAND_DEG = 0.006  # look for the crossing within +/- this many degrees

EXPECTED_KEYS = {"name", "bounds", "width", "height", "cellSizeM", "layers",
                 "habitat", "pois", "sources"}
OPTIONAL_KEYS = {"fake"}
LAYER_KEYS = {"elevation", "slope", "rock", "thermalInertia", "science"}
# Extra layer added by pipeline/build_shielding.py. The real file must have it; the
# fake test fixture does not.
SKY_VIEW = "skyView"
# (min, max) allowed per layer. Missing values (null) are allowed by the contract.
LAYER_RANGES = {
    "elevation": (-9000, 0),        # Jezero is ~ -2500 m; anything above 0 is suspicious
    "slope": (0, 90),
    "rock": (0, 1),
    "thermalInertia": (0, 3000),
    "science": (0, 1),
}

results = []  # (ok, message)


def check(ok, msg):
    results.append((bool(ok), msg))
    print(f"  [{'PASS' if ok else 'FAIL'}] {msg}")
    return ok


def latlng_to_cell(site, lat, lng):
    """Contract 1 click -> cell formula."""
    b = site["bounds"]
    col = math.floor((lng - b["west"]) / (b["east"] - b["west"]) * site["width"])
    row = math.floor((b["north"] - lat) / (b["north"] - b["south"]) * site["height"])
    return row, col


def flood_fill(passable, start):
    """8-neighbor flood fill. Diagonal steps are forbidden if either orthogonal
    cell they squeeze between is impassable (no corner-cutting)."""
    h, w = passable.shape
    seen = np.zeros_like(passable, dtype=bool)
    if not passable[start]:
        return seen
    seen[start] = True
    q = deque([start])
    while q:
        r, c = q.popleft()
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                if dr == 0 and dc == 0:
                    continue
                nr, nc = r + dr, c + dc
                if not (0 <= nr < h and 0 <= nc < w) or seen[nr, nc] or not passable[nr, nc]:
                    continue
                if dr and dc and not (passable[r + dr, c] and passable[r, c + dc]):
                    continue
                seen[nr, nc] = True
                q.append((nr, nc))
    return seen


DTM_CACHE = os.path.join("data", "raw", "jezero_hirise_dtm_1m_window.tif")


def check_against_dtm(site, elev, samples=400, tolerance_m=3.0):
    """Real file only: compare cell elevations with the source DTM at the same lat/lng."""
    if not os.path.exists(DTM_CACHE):
        print(f"  [WARN] {DTM_CACHE} not found; run pipeline/build_site.py to enable the DTM cross-check")
        return
    try:
        import rasterio
        from rasterio.crs import CRS
        from rasterio.warp import transform as warp_transform
        from rasterio.windows import Window
    except ImportError:
        print("  [WARN] rasterio not installed; skipping the DTM cross-check")
        return
    b, W, H = site["bounds"], site["width"], site["height"]
    rng = np.random.default_rng(0)
    rows, cols = rng.integers(0, H, samples), rng.integers(0, W, samples)
    lats = b["north"] - (rows + 0.5) / H * (b["north"] - b["south"])
    lngs = b["west"] + (cols + 0.5) / W * (b["east"] - b["west"])
    diffs = []
    with rasterio.open(DTM_CACHE) as src:
        site_crs = CRS.from_proj4("+proj=longlat +R=3396190 +no_defs")
        xs, ys = warp_transform(site_crs, src.crs, lngs.tolist(), lats.tolist())
        for r, c, x, y in zip(rows, cols, xs, ys):
            if np.isnan(elev[r, c]):
                continue
            pr, pc = src.index(x, y)
            patch = src.read(1, window=Window(pc - 12, pr - 12, 25, 25), boundless=True, fill_value=np.nan).astype(float)
            patch[patch < -1e30] = np.nan
            if np.isfinite(patch).mean() > 0.9:
                diffs.append(abs(elev[r, c] - np.nanmean(patch)))
    diffs = np.array(diffs)
    check(len(diffs) > samples * 0.5 and np.percentile(diffs, 99) < tolerance_m,
          f"cell elevations match the source DTM at the same lat/lng "
          f"({len(diffs)} cells, median diff {np.median(diffs):.2f} m, 99th pct {np.percentile(diffs, 99):.2f} m)")


def check_sky_view(site, layers, grids, n, is_fake):
    """skyView (pipeline/build_shielding.py): the open fraction of the sky per cell, 0 to 1."""
    print("\nSky view layer")
    if SKY_VIEW not in layers:
        if is_fake:
            print("  [SKIP] the fake fixture has no skyView layer")
        else:
            check(False, "skyView layer exists (run python pipeline/build_shielding.py)")
        return
    arr = layers[SKY_VIEW]
    if not check(len(arr) == n, f"skyView: length {len(arr)} (expected {n})"):
        return
    a = np.array([np.nan if v is None else v for v in arr], dtype=float)
    vals = a[~np.isnan(a)]
    check(vals.size > 0 and vals.min() >= 0 and vals.max() <= 1,
          f"skyView: range {vals.min():.3f} .. {vals.max():.3f} within [0, 1]")
    check(np.all(np.abs(vals * 1000 - np.round(vals * 1000)) < 1e-6), "skyView: rounded to 3 decimals")
    if "elevation" in grids:
        missing = int((np.isnan(a) & ~np.isnan(grids["elevation"].ravel())).sum())
        check(missing == 0, f"skyView: no nulls where elevation exists ({missing} missing)")
    src = str(site.get("sources", {}).get(SKY_VIEW, ""))
    check("10.5066/P9REJ9JN" in src and "sky-view" in src, "skyView: source names the HiRISE DTM mosaic and the method")
    # Open ground must see nearly the whole sky; a layer that is low everywhere is broken.
    check(float(np.median(vals)) > 0.9, f"skyView: median {np.median(vals):.3f} > 0.9 (most of the site is open ground)")


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join("app", "public", "data", "site.json")
    print(f"Checking {path}\n")

    size_mb = os.path.getsize(path) / 1e6
    with open(path) as f:
        raw = f.read()
    site = json.loads(raw)
    is_fake = site.get("fake") is True
    print("File type: FAKE test fixture\n" if is_fake else "File type: real terrain\n")

    # ---- 1. Contract 1 shape ------------------------------------------------
    print("Contract 1 shape")
    keys = set(site)
    check(EXPECTED_KEYS <= keys, f"top-level keys present (missing: {sorted(EXPECTED_KEYS - keys) or 'none'})")
    check(keys <= EXPECTED_KEYS | OPTIONAL_KEYS, f"no unexpected keys (extra: {sorted(keys - EXPECTED_KEYS - OPTIONAL_KEYS) or 'none'})")
    check(size_mb < 5, f"file size {size_mb:.2f} MB < 5 MB")
    check("NaN" not in raw and "Infinity" not in raw, "no NaN/Infinity in JSON")

    W, H = site.get("width"), site.get("height")
    check(W == 320 and H == 240, f"grid is {W} x {H} (expected 320 x 240)")
    n = 320 * 240
    check(site.get("cellSizeM") == {"x": 24.6, "y": 24.7}, f"cellSizeM = {site.get('cellSizeM')}")
    b = site.get("bounds", {})
    check(b == {"south": 18.40, "north": 18.50, "west": 77.36, "east": 77.50}, f"bounds = {b}")

    layers = site.get("layers", {})
    check(LAYER_KEYS <= set(layers) <= LAYER_KEYS | {SKY_VIEW}, f"layer keys = {sorted(layers)}")
    grids = {}
    for name in sorted(LAYER_KEYS & set(layers)):
        arr = layers[name]
        if not check(len(arr) == n, f"{name}: length {len(arr)} (expected {n})"):
            continue
        a = np.array([np.nan if v is None else v for v in arr], dtype=float)
        nulls = int(np.isnan(a).sum())
        if nulls == n:
            src = str(site.get("sources", {}).get(name, ""))
            check(src.startswith("PENDING"),
                  f"{name}: no data yet (all null) and its source is marked PENDING")
            grids[name] = a.reshape(H, W)
            continue
        lo, hi = LAYER_RANGES[name]
        amin, amax = np.nanmin(a), np.nanmax(a)
        check(lo <= amin and amax <= hi,
              f"{name}: range {amin:.2f} .. {amax:.2f} within [{lo}, {hi}] ({nulls} nulls)")
        vals = a[~np.isnan(a)]
        check(np.all(np.abs(vals * 100 - np.round(vals * 100)) < 1e-6), f"{name}: rounded to 2 decimals")
        grids[name] = a.reshape(H, W)  # row-major: index = row * width + col

    hab = site.get("habitat", {})
    check({"name", "lat", "lng"} <= set(hab), f"habitat has name/lat/lng ({hab.get('name')})")
    pois = site.get("pois", [])
    if is_fake:
        check(len(pois) > 0, f"{len(pois)} POIs")
    elif not pois:
        print("  [WARN] no POIs yet")
    for p in pois:
        # A photo is optional (some real stops were never visited by a rover), but a
        # photo must always come with a credit. The fake fixture keeps the old rule.
        need = {"id", "name", "lat", "lng", "kind", "note"}
        if (is_fake and p.get("kind") == "science") or "photo" in p:
            need |= {"photo", "photoCredit"}
        check(need <= set(p), f"POI {p.get('id')}: required fields present (missing: {sorted(need - set(p)) or 'none'})")
    for p in [hab] + pois:
        inside = b["south"] <= p["lat"] <= b["north"] and b["west"] <= p["lng"] <= b["east"]
        check(inside, f"{p.get('id', p.get('name'))} inside bounds")
    check(set(site.get("sources", {})) == set(layers), "sources has one entry per layer")
    check_sky_view(site, layers, grids, n, is_fake)

    if set(grids) != LAYER_KEYS:
        print("\nLayers malformed; skipping terrain checks.")
        return finish()

    elev, slope, rock, ti = grids["elevation"], grids["slope"], grids["rock"], grids["thermalInertia"]

    # ---- 2. Orientation -----------------------------------------------------
    print("\nOrientation (row 0 = north, col 0 = west)")
    if is_fake:
        # The delta top (west) is higher than the crater floor (east). If columns
        # were flipped, the west would be lower.
        west_mean, east_mean = np.nanmean(elev[:, :40]), np.nanmean(elev[:, -40:])
        check(west_mean > east_mean + 30, f"west edge higher than east edge ({west_mean:.0f} vs {east_mean:.0f} m)")
        # Row order: the slope layer must agree with an independently recomputed
        # slope only if rows run north->south with the stated cell size. Also the
        # scarp hotspot clay-1 (north) must map to a low row number.
        dz_dy, dz_dx = np.gradient(elev, site["cellSizeM"]["y"], site["cellSizeM"]["x"])
        recomputed = np.degrees(np.arctan(np.hypot(dz_dx, dz_dy)))
        diff = np.nanmax(np.abs(recomputed - slope))
        check(diff < 0.5, f"slope layer matches slope recomputed from elevation (max diff {diff:.2f} deg)")
        # Science hotspots sit on POIs; if rows were flipped they'd be in the wrong place.
        sci_ok = True
        for p in pois:
            if p["kind"] != "science":
                continue
            r, c = latlng_to_cell(site, p["lat"], p["lng"])
            rf = H - 1 - r  # where it would be if north/south were flipped
            sci_ok &= grids["science"][r, c] > grids["science"][rf, c]
        check(sci_ok, "science hotspots line up with POIs (row 0 = north)")
    else:
        check_against_dtm(site, elev)
        # The slope layer is the 90th percentile of 5 m slopes inside each cell, so
        # it should be at least as steep as the slope of the 25 m elevation grid.
        dz_dy, dz_dx = np.gradient(elev, site["cellSizeM"]["y"], site["cellSizeM"]["x"])
        coarse = np.degrees(np.arctan(np.hypot(dz_dx, dz_dy)))
        both = np.isfinite(coarse) & np.isfinite(slope)
        steeper = float(np.mean(slope[both] >= coarse[both] - 1.0))
        corr = float(np.corrcoef(slope[both], coarse[both])[0, 1])
        check(steeper > 0.95, f"slope layer is at least as steep as the 25 m slope in {steeper * 100:.1f}% of cells")
        check(corr > 0.6, f"slope layer follows the 25 m slope (correlation {corr:.2f})")

    # ---- 3. Habitat ground --------------------------------------------------
    print("\nHabitat ground")
    hr, hc = latlng_to_cell(site, hab["lat"], hab["lng"])
    print(f"  HAB-1 -> row {hr}, col {hc}: slope {slope[hr, hc]:.2f} deg, "
          f"TI {ti[hr, hc]:.0f}, rock {rock[hr, hc]:.2f}, elev {elev[hr, hc]:.0f} m")
    check(slope[hr, hc] < HAB_MAX_SLOPE, f"habitat slope {slope[hr, hc]:.2f} < {HAB_MAX_SLOPE} deg")
    if np.isnan(ti[hr, hc]):
        print("  [SKIP] habitat thermal inertia: no data yet")
    else:
        check(ti[hr, hc] >= SAND_TI_THRESHOLD, f"habitat thermalInertia {ti[hr, hc]:.0f} >= {SAND_TI_THRESHOLD} (firm, not sand)")
    check(rock[hr, hc] < HAB_MAX_ROCK, f"habitat rock {rock[hr, hc]:.2f} < {HAB_MAX_ROCK}")

    # ---- 4. POI reachability ------------------------------------------------
    print(f"\nPOI reachability (slope <= {MAX_SLOPE_DEG} deg, rock <= {ROCK_NO_GO}, 8-neighbor)")
    passable = (slope <= MAX_SLOPE_DEG) & (rock <= ROCK_NO_GO)  # NaN compares False -> impassable
    reach = flood_fill(passable, (hr, hc))
    print(f"  {reach.sum()} of {passable.sum()} passable cells reachable from HAB-1")
    for p in pois:
        r, c = latlng_to_cell(site, p["lat"], p["lng"])
        note = ""
        if not passable[r, c]:
            note = f" (POI cell itself is no-go: slope {slope[r, c]:.1f}, rock {rock[r, c]:.2f})"
        check(reach[r, c], f"{p['id']} ({p['kind']}) at row {r}, col {c} reachable{note}")

    # ---- 5. Gentle ramps onto the delta -------------------------------------
    if is_fake:
        print(f"\nDelta scarp ramps (gentle = slope < {RAMP_MAX_SLOPE} deg and rock <= {ROCK_NO_GO})")
        gentle = (slope < RAMP_MAX_SLOPE) & (rock <= ROCK_NO_GO)
        # The scarp is the band of cells steeper than 25 deg; a crossing must get
        # from east of the scarp to west of it.
        steep_cols = np.where((slope > MAX_SLOPE_DEG).any(axis=0))[0]
        scarp_w, scarp_e = int(steep_cols.min()), int(steep_cols.max())
        for ramp_lat in RAMP_LATS:
            r0, _ = latlng_to_cell(site, ramp_lat + RAMP_HALF_BAND_DEG, b["west"])
            r1, _ = latlng_to_cell(site, ramp_lat - RAMP_HALF_BAND_DEG, b["west"])
            band = np.zeros_like(gentle)
            band[r0:r1 + 1, :] = True
            # Start on gentle cells east of the scarp, try to reach cells west of it.
            mask = gentle & band
            seeds = [(r, scarp_e + 1) for r in range(r0, r1 + 1) if mask[r, scarp_e + 1]]
            crossed = False
            for s in seeds:
                fill = flood_fill(mask, s)
                if fill[:, :scarp_w].any():
                    crossed = True
                    break
            steepest = np.nanmin(np.nanmax(np.where(band, slope, np.nan)[r0:r1 + 1, scarp_w:scarp_e + 1], axis=1))
            check(crossed, f"ramp near {ramp_lat} N: gentle crossing onto delta "
                           f"(gentlest row's max slope across scarp {steepest:.1f} deg)")
        # And the delta top is reachable from the habitat by gentle cells only.
        gentle_reach = flood_fill(gentle, (hr, hc))
        carb = next((p for p in pois if p["id"] == "carb-1"), None)
        if carb:
            r, c = latlng_to_cell(site, carb["lat"], carb["lng"])
            check(gentle_reach[r, c], "carb-1 (delta top) reachable from HAB-1 on slopes < 15 deg only")
            # The scarp must be a real wall elsewhere: block the ramp bands and
            # carb-1 should become unreachable (the planner's detour test relies on it).
            walled = passable.copy()
            for ramp_lat in RAMP_LATS:
                r0, _ = latlng_to_cell(site, ramp_lat + 2 * RAMP_HALF_BAND_DEG, b["west"])
                r1, _ = latlng_to_cell(site, ramp_lat - 2 * RAMP_HALF_BAND_DEG, b["west"])
                walled[r0:r1 + 1, scarp_w:scarp_e + 1] = False
            check(not flood_fill(walled, (hr, hc))[r, c],
                  "scarp is a no-go wall outside the ramps (carb-1 unreachable when ramps are blocked)")

    # ---- 6. Boulder field (fake file only) ----------------------------------
    clay = next((p for p in pois if p["id"] == "clay-1"), None)
    if site.get("fake") and clay:
        print("\nBoulder field on the crater floor (fake file only)")
        cr, cc = latlng_to_cell(site, clay["lat"], clay["lng"])
        line = {(round(hr + (cr - hr) * t), round(hc + (cc - hc) * t)) for t in np.linspace(0, 1, 400)}
        boulder_hits = sum(1 for p in line if rock[p] > ROCK_NO_GO and slope[p] <= MAX_SLOPE_DEG)
        check(boulder_hits > 0, f"straight line HAB-1 -> clay-1 is blocked by boulders "
                                f"({boulder_hits} rock no-go cells), so the planner must detour")

    return finish()


def finish():
    fails = [m for ok, m in results if not ok]
    print(f"\n{len(results) - len(fails)} passed, {len(fails)} failed")
    for m in fails:
        print(f"  FAIL: {m}")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
