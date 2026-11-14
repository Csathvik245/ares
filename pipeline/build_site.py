"""
build_site.py — builds the REAL terrain file app/public/data/site.json (Contract 1)
from NASA / USGS data. No synthetic terrain.

Run from the repo root:
    pip install rasterio numpy
    python pipeline/build_site.py

What it does
------------
1. ELEVATION SOURCE
   USGS Astrogeology "Mars 2020 Terrain Relative Navigation HiRISE DTM Mosaic"
   (Fergason et al. 2020, doi:10.5066/P9REJ9JN), 1 m/pixel, made from MRO HiRISE
   stereo pairs and tied to MOLA. The file is ~1.8 GB, so we do NOT download it:
   rasterio reads only the rows and columns of our window over HTTPS. The window
   (about 200 MB) is cached in data/raw/ (gitignored) so later runs are offline.
   The map projection and pixel grid are read from the file, never assumed.

2. RESAMPLING
   Contract 1 grid: 320 x 240 cells over 18.40-18.50 N, 77.36-77.50 E
   (planetocentric latitude, east longitude, Mars sphere R = 3396190 m), which
   makes each cell about 24.6 m x 24.7 m.
   - "5 m grid": each cell split 5 x 5 (1600 x 1200, about 4.9 m). Every 5 m value
     is the average of the 1 m DTM pixels inside it.
   - "1 m grid": each cell split 25 x 25 (8000 x 6000, about 0.99 m), bilinear.

3. LAYERS (one number per 25 m cell)
   - elevation: mean of the 25 five-meter elevations in the cell (meters).
   - slope: slope is computed on the 5 m grid in degrees, using real meters
     (east-west spacing already includes cos(latitude)). The cell value is the
     90TH PERCENTILE of its 25 five-meter slopes. A plain average would hide a
     10 m wide cliff inside a 25 m cell; the 90th percentile keeps it while
     ignoring one or two noisy pixels.
   - rock: a ROUGHNESS proxy, 0 to 1. Within each cell we fit a flat tilted plane
     to the 625 one-meter elevations, subtract it (so a smooth hillside counts as
     smooth), and take the standard deviation of what is left, in meters. That is
     divided by ROUGHNESS_FULL_SCALE_M and clipped to 0..1.
     Honest limits: a 1 m DTM cannot see individual boulders smaller than a few
     meters, so this measures rugged, broken ground (boulder fields, ledges,
     scarps, dune crests), not a boulder count.
   - Cells with too little DTM coverage become null (Contract 1: missing = null).

4. THERMAL INERTIA (soft sand)
   "THEMIS-derived Thermal Inertia of Jezero Crater, Mars" (Edwards & Buz 2021,
   Zenodo, doi:10.5281/zenodo.4931348), quantitative, 100 m/pixel, from Mars
   Odyssey THEMIS. Resampled (bilinear) to the 25 m grid. See thermal_inertia_layer().

5. SCIENCE VALUE (clays and carbonates)
   MRO CRISM map-projected targeted observation HRL000040FF (MTRDR, 36 m/pixel),
   refined summary parameters D2300, MIN2295_2480 and MIN2345_2537
   (Viviano-Beck et al. 2014). Only those three bands are read over HTTPS.
   See science_layer() for how they become a 0-1 index.

Every layer's "sources" entry in site.json names the real dataset. Nothing is invented.
"""

import json
import math
import os
import sys
import time

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.transform import from_bounds
from rasterio.warp import Resampling, reproject, transform_bounds
from rasterio.windows import Window, from_bounds as window_from_bounds

# ---- Contract 1 grid ---------------------------------------------------------
SOUTH, NORTH, WEST, EAST = 18.40, 18.50, 77.36, 77.50
WIDTH, HEIGHT = 320, 240
MARS_RADIUS_M = 3396190  # same sphere as planner/constants.ts
# Planetocentric latitude / east longitude on the Mars sphere, in degrees.
SITE_CRS = CRS.from_proj4(f"+proj=longlat +R={MARS_RADIUS_M} +no_defs")

SUB_5M = 5    # 5 x 5 sub-cells per grid cell  (~5 m)
SUB_1M = 25   # 25 x 25 sub-cells per grid cell (~1 m)

# ---- Sources -----------------------------------------------------------------
DTM_URL = (
    "https://planetarymaps.usgs.gov/mosaic/mars2020_trn/HiRISE/"
    "JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif"
)
DTM_CITATION = (
    "Mars 2020 Terrain Relative Navigation HiRISE DTM Mosaic, 1 m/pixel "
    "(Fergason et al. 2020, USGS Astrogeology, doi:10.5066/P9REJ9JN); MRO HiRISE stereo"
)

RAW_DIR = os.path.join("data", "raw")
DTM_CACHE = os.path.join(RAW_DIR, "jezero_hirise_dtm_1m_window.tif")
OUT_PATH = os.path.join("app", "public", "data", "site.json")
SITE_META_PATH = os.path.join("pipeline", "data", "site_meta.json")

# ---- Method constants (ASSUMPTIONS — see docs/assumptions.md) -----------------
SLOPE_PERCENTILE = 90
# Roughness (std of plane-detrended 1 m elevation in a cell) that maps to rock = 1.0.
# ASSUMPTION, not a measured boulder density.
ROUGHNESS_FULL_SCALE_M = 1.0
# A cell needs at least this fraction of valid DTM pixels, otherwise it is null.
MIN_VALID_FRACTION = 0.5


def log(msg):
    print(msg, flush=True)


# ---- Step A: fetch only our window of the DTM ---------------------------------
def fetch_dtm_window():
    """Reads our window of the remote 1 m DTM and caches it as a small GeoTIFF."""
    if os.path.exists(DTM_CACHE):
        log(f"Using cached DTM window {DTM_CACHE}")
        return
    os.makedirs(RAW_DIR, exist_ok=True)
    log(f"Reading DTM window over HTTPS (not downloading the whole file):\n  {DTM_URL}")
    gdal_env = dict(
        GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
        CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif",
        GDAL_HTTP_MAX_RETRY="5",
        GDAL_HTTP_RETRY_DELAY="2",
        GDAL_HTTP_MERGE_CONSECUTIVE_RANGES="YES",
        CPL_VSIL_CURL_CHUNK_SIZE="2097152",
        CPL_VSIL_CURL_CACHE_SIZE="268435456",
    )
    with rasterio.Env(**gdal_env), rasterio.open(DTM_URL) as src:
        log(f"  CRS from file: {src.crs.to_proj4()}")
        log(f"  size {src.width} x {src.height}, pixel {src.res}, nodata {src.nodata}")
        # Our lat/lng box in the file's own projection (read from the file).
        left, bottom, right, top = transform_bounds(SITE_CRS, src.crs, WEST, SOUTH, EAST, NORTH, densify_pts=21)
        # Pad by 60 m so resampling at the edges has real neighbours.
        pad = 60
        win = window_from_bounds(left - pad, bottom - pad, right + pad, top + pad, src.transform)
        c0, r0 = math.floor(win.col_off), math.floor(win.row_off)
        c1, r1 = math.ceil(win.col_off + win.width), math.ceil(win.row_off + win.height)
        c0, r0, c1, r1 = max(c0, 0), max(r0, 0), min(c1, src.width), min(r1, src.height)
        win = Window(c0, r0, c1 - c0, r1 - r0)
        log(f"  window: cols {int(win.col_off)}..{int(win.col_off + win.width)}, "
            f"rows {int(win.row_off)}..{int(win.row_off + win.height)} "
            f"({int(win.width)} x {int(win.height)} px, {win.width * win.height * 4 / 1e6:.0f} MB)")
        profile = dict(
            driver="GTiff", dtype="float32", count=1, nodata=src.nodata, crs=src.crs,
            width=int(win.width), height=int(win.height), transform=src.window_transform(win),
            compress="deflate", predictor=3, tiled=True, blockxsize=512, blockysize=512,
        )
        tmp = DTM_CACHE + ".part"
        t0 = time.time()
        with rasterio.open(tmp, "w", **profile) as dst:
            chunk = 256
            for r in range(0, int(win.height), chunk):
                h = min(chunk, int(win.height) - r)
                part = Window(win.col_off, win.row_off + r, win.width, h)
                dst.write(src.read(1, window=part), 1, window=Window(0, r, int(win.width), h))
                done = r + h
                if (r // chunk) % 4 == 0 or done == int(win.height):
                    log(f"    rows {done}/{int(win.height)}  ({time.time() - t0:.0f} s)")
            dst.update_tags(SOURCE_URL=DTM_URL, SOURCE_CITATION=DTM_CITATION)
    os.replace(tmp, DTM_CACHE)
    log(f"  cached {DTM_CACHE} ({os.path.getsize(DTM_CACHE) / 1e6:.0f} MB)")


# ---- Step B: resample onto grids aligned with the Contract 1 cells --------------
def resample_dtm(sub, resampling):
    """DTM resampled to (HEIGHT*sub, WIDTH*sub), exactly aligned with the cells. NaN = no data."""
    h, w = HEIGHT * sub, WIDTH * sub
    dst = np.full((h, w), np.nan, dtype=np.float32)
    with rasterio.open(DTM_CACHE) as src:
        reproject(
            source=rasterio.band(src, 1),
            destination=dst,
            src_transform=src.transform, src_crs=src.crs, src_nodata=src.nodata,
            dst_transform=from_bounds(WEST, SOUTH, EAST, NORTH, w, h),  # row 0 = north, col 0 = west
            dst_crs=SITE_CRS, dst_nodata=np.nan,
            resampling=resampling,
        )
    return dst


def blocks(a, sub):
    """(HEIGHT*sub, WIDTH*sub) -> (HEIGHT, WIDTH, sub*sub): the sub-pixels of every cell."""
    return a.reshape(HEIGHT, sub, WIDTH, sub).swapaxes(1, 2).reshape(HEIGHT, WIDTH, sub * sub)


def cell_sizes_m():
    """Cell size in meters (same formula as the planner and the fake generator)."""
    mid_lat = math.radians((SOUTH + NORTH) / 2)
    cell_y = math.radians(NORTH - SOUTH) * MARS_RADIUS_M / HEIGHT
    cell_x = math.radians(EAST - WEST) * MARS_RADIUS_M * math.cos(mid_lat) / WIDTH
    return cell_x, cell_y


def terrain_layers():
    """Returns elevation, slope, rock (HEIGHT x WIDTH float arrays, NaN = missing) and stats."""
    cell_x, cell_y = cell_sizes_m()
    stats = {}

    # ---- 5 m grid: elevation and slope ----
    log("Resampling to the 5 m grid (average of 1 m pixels) ...")
    z5 = resample_dtm(SUB_5M, Resampling.average).astype(np.float64)
    dy5, dx5 = cell_y / SUB_5M, cell_x / SUB_5M
    stats["grid5m"] = {"dx_m": round(dx5, 3), "dy_m": round(dy5, 3), "valid_fraction": float(np.isfinite(z5).mean())}
    log(f"  5 m grid spacing {dx5:.2f} m x {dy5:.2f} m; {np.isfinite(z5).mean() * 100:.2f}% valid")
    dz_dy, dz_dx = np.gradient(z5, dy5, dx5)  # NaN spreads to neighbours of gaps, which is what we want
    slope5 = np.degrees(np.arctan(np.hypot(dz_dx, dz_dy)))

    z_blocks = blocks(z5, SUB_5M)
    valid5 = np.isfinite(z_blocks).mean(axis=2)
    with np.errstate(all="ignore"), __import__("warnings").catch_warnings():
        __import__("warnings").simplefilter("ignore")
        elevation = np.nanmean(z_blocks, axis=2)
        slope = np.nanpercentile(blocks(slope5, SUB_5M), SLOPE_PERCENTILE, axis=2)
        slope_mean = np.nanmean(blocks(slope5, SUB_5M), axis=2)
    missing = valid5 < MIN_VALID_FRACTION
    elevation[missing] = np.nan
    slope[missing] = np.nan

    # ---- 1 m grid: roughness ----
    log("Resampling to the 1 m grid (bilinear) ...")
    z1 = resample_dtm(SUB_1M, Resampling.bilinear)
    zb = blocks(z1, SUB_1M).astype(np.float64)          # (H, W, 625)
    del z1
    ok = np.isfinite(zb)
    valid1 = ok.mean(axis=2)
    # Plane fit per cell: z = a + b*x + c*y, with x and y centered so the three
    # terms are independent (closed-form least squares, no matrix solve needed).
    idx = np.arange(SUB_1M) - (SUB_1M - 1) / 2
    yy, xx = np.meshgrid(idx, idx, indexing="ij")
    x, y = xx.ravel(), yy.ravel()
    full = valid1 == 1.0
    roughness = np.full((HEIGHT, WIDTH), np.nan)
    zf = zb[full]                                         # (n, 625) cells with no gaps
    a = zf.mean(axis=1, keepdims=True)
    b = (zf * x).sum(axis=1, keepdims=True) / (x * x).sum()
    c = (zf * y).sum(axis=1, keepdims=True) / (y * y).sum()
    roughness[full] = (zf - a - b * x - c * y).std(axis=1)
    # Cells with some gaps (rare): general least-squares on the valid pixels only.
    partial = (~full) & (valid1 >= MIN_VALID_FRACTION)
    for r, cidx in zip(*np.nonzero(partial)):
        m = ok[r, cidx]
        A = np.column_stack([np.ones(m.sum()), x[m], y[m]])
        coef, *_ = np.linalg.lstsq(A, zb[r, cidx, m], rcond=None)
        roughness[r, cidx] = (zb[r, cidx, m] - A @ coef).std()
    del zb
    rock = np.clip(roughness / ROUGHNESS_FULL_SCALE_M, 0, 1)
    rock[missing] = np.nan

    q = lambda arr, ps: {f"p{p}": round(float(np.nanpercentile(arr, p)), 3) for p in ps}
    stats["elevation_m"] = {"min": round(float(np.nanmin(elevation)), 1), "max": round(float(np.nanmax(elevation)), 1)}
    stats["slope_p90_deg"] = q(slope, [50, 90, 99, 100])
    stats["slope_mean_deg"] = q(slope_mean, [50, 90, 99, 100])
    stats["roughness_m"] = q(roughness, [5, 25, 50, 75, 90, 95, 99, 99.9, 100])
    stats["null_cells"] = int(np.isnan(elevation).sum())
    stats["partial_cells"] = int(partial.sum())
    return elevation, slope, rock, {"slope_mean": slope_mean, "roughness": roughness}, stats


# ---- Step C: thermal inertia (soft sand) ----------------------------------------
TI_URL = "https://zenodo.org/records/4931348/files/Jezero_Thermal_Inertia_v1.tiff?download=1"
TI_CACHE = os.path.join(RAW_DIR, "Jezero_Thermal_Inertia_v1.tiff")
TI_MD5 = "53fec7c990a90629e98c871a7a0da474"
TI_CITATION = (
    "THEMIS-derived Thermal Inertia of Jezero Crater, Mars, 100 m/pixel "
    "(Edwards & Buz 2021, Zenodo, doi:10.5281/zenodo.4931348); Mars Odyssey THEMIS; "
    "resampled from 100 m to the 25 m grid"
)


def to_site_grid(path, band, resampling, src_nodata):
    """Any georeferenced raster -> the 320 x 240 Contract 1 grid. NaN = no data."""
    dst = np.full((HEIGHT, WIDTH), np.nan, dtype=np.float32)
    with rasterio.open(path) as src:
        reproject(
            source=rasterio.band(src, band), destination=dst,
            src_transform=src.transform, src_crs=src.crs, src_nodata=src_nodata,
            dst_transform=from_bounds(WEST, SOUTH, EAST, NORTH, WIDTH, HEIGHT),
            dst_crs=SITE_CRS, dst_nodata=np.nan, resampling=resampling,
        )
    return dst.astype(np.float64)


def thermal_inertia_layer():
    """
    Quantitative thermal inertia (J m^-2 K^-1 s^-1/2) from the Edwards & Buz (2021)
    THEMIS mosaic of Jezero. The file is 1.7 MB, so it is downloaded whole.
    Native pixels are 100 m; bilinear resampling to our 25 m cells makes the layer
    look smooth but adds no detail: a sand patch narrower than ~100 m is not resolved.
    The file's null value is 0.
    """
    if not os.path.exists(TI_CACHE):
        import hashlib
        import urllib.request
        os.makedirs(RAW_DIR, exist_ok=True)
        log(f"Downloading thermal inertia (1.7 MB):\n  {TI_URL}")
        data = urllib.request.urlopen(TI_URL, timeout=120).read()
        if hashlib.md5(data).hexdigest() != TI_MD5:
            raise RuntimeError("thermal inertia file does not match the md5 published on Zenodo")
        with open(TI_CACHE, "wb") as f:
            f.write(data)
    else:
        log(f"Using cached thermal inertia {TI_CACHE}")
    with rasterio.open(TI_CACHE) as src:
        log(f"  CRS from file: {src.crs.to_proj4()}, pixel {src.res}")
    return to_site_grid(TI_CACHE, 1, Resampling.bilinear, 0.0)


# ---- Step D: science value (carbonates and clays) from CRISM ----------------------
CRISM_OBS = "HRL000040FF"
CRISM_URL = (
    "https://pds-geosciences.wustl.edu/mro/mro-m-crism-5-rdr-mptargeted-v1/mrocr_4001/"
    "mtrdr/2007/2007_029/hrl000040ff/hrl000040ff_07_sr183j_mtr3.lbl"
)
CRISM_CACHE = os.path.join(RAW_DIR, "crism_hrl000040ff_sr_science_bands.tif")
# Band numbers in the 60-band MTRDR "SR" (refined summary parameter) product.
# Names and meanings: Viviano-Beck et al. 2014, doi:10.1002/2014JE004627.
CRISM_BANDS = {
    "D2300": 40,          # 2.3 micron drop-off: Fe/Mg clay (phyllosilicate)
    "MIN2295_2480": 44,   # both 2.3 and 2.5 micron bands present: Mg carbonate
    "MIN2345_2537": 45,   # both 2.3 and 2.5 micron bands present: Ca/Fe carbonate
}
CRISM_NODATA = 65535.0
# A parameter value at this percentile of the whole CRISM scene maps to 1.0.
SCIENCE_FULL_SCALE_PERCENTILE = 99.5
CRISM_CITATION = (
    f"MRO CRISM MTRDR {CRISM_OBS} (36 m/pixel) refined summary parameters D2300 (Fe/Mg clay), "
    "MIN2295_2480 and MIN2345_2537 (carbonate), PDS Geosciences Node dataset "
    "MRO-M-CRISM-5-RDR-MPTARGETED-V1.0; parameters defined in Viviano-Beck et al. 2014 "
    "(doi:10.1002/2014JE004627). Relative 0-1 index, not a mineral abundance"
)


def fetch_crism():
    """Reads only the three summary-parameter bands we use (about 4 MB) over HTTPS."""
    if os.path.exists(CRISM_CACHE):
        log(f"Using cached CRISM bands {CRISM_CACHE}")
        return
    os.makedirs(RAW_DIR, exist_ok=True)
    log(f"Reading CRISM {CRISM_OBS} summary-parameter bands over HTTPS:\n  {CRISM_URL}")
    env = dict(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
               CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".img,.lbl,.hdr", GDAL_HTTP_MAX_RETRY="5")
    with rasterio.Env(**env), rasterio.open("/vsicurl/" + CRISM_URL) as src:
        log(f"  CRS from file: {src.crs.to_proj4()}, pixel {src.res}, {src.count} bands")
        profile = dict(driver="GTiff", dtype="float32", count=len(CRISM_BANDS), crs=src.crs,
                       transform=src.transform, width=src.width, height=src.height,
                       nodata=CRISM_NODATA, compress="deflate")
        with rasterio.open(CRISM_CACHE + ".part", "w", **profile) as dst:
            for i, (name, band) in enumerate(CRISM_BANDS.items(), 1):
                a = src.read(band).astype(np.float32)
                a[(a < -1e30) | (a >= CRISM_NODATA)] = CRISM_NODATA  # both null markers used in the product
                dst.write(a, i)
                dst.set_band_description(i, name)
            dst.update_tags(SOURCE_URL=CRISM_URL)
    os.replace(CRISM_CACHE + ".part", CRISM_CACHE)


def science_layer():
    """
    Science value 0-1 = how strongly CRISM sees clay or carbonate in each cell.

    For each of the three parameters: values at or below 0 mean "absorption not
    seen" and score 0; the scene's 99.5th percentile scores 1; linear in between.
    The cell's science value is the HIGHEST of the three scores (a strong clay
    OR a strong carbonate signature both make a good sampling target).

    Honest limits: this is a relative index inside one CRISM scene, not a mineral
    abundance. Summary parameters are noisy and can respond to other minerals
    (D2300 also responds to Mg carbonate; olivine-rich ground shifts the continuum).
    Returns (science, parts) where parts holds the three separate 0-1 scores.
    """
    fetch_crism()
    parts = {}
    with rasterio.open(CRISM_CACHE) as src:
        names = list(src.descriptions)
        scene = {n: src.read(names.index(n) + 1).astype(np.float64) for n in CRISM_BANDS}
    for name in CRISM_BANDS:
        valid = scene[name][scene[name] != CRISM_NODATA]
        full_scale = float(np.percentile(valid, SCIENCE_FULL_SCALE_PERCENTILE))
        gridded = to_site_grid(CRISM_CACHE, names.index(name) + 1, Resampling.bilinear, CRISM_NODATA)
        parts[name] = np.clip(gridded / full_scale, 0, 1)
        log(f"  {name}: full scale (p{SCIENCE_FULL_SCALE_PERCENTILE:g} of scene) = {full_scale:.4f}, "
            f"{np.isfinite(gridded).mean() * 100:.1f}% of cells covered")
    stack = np.stack([parts[n] for n in CRISM_BANDS])
    with np.errstate(all="ignore"):
        science = np.nanmax(stack, axis=0)
    science[np.isnan(stack).all(axis=0)] = np.nan
    return science, parts


# ---- Output -------------------------------------------------------------------
def to_list(a, decimals=2):
    """Row-major list rounded to 2 decimals; NaN -> None (JSON null). Contract 1 grid rules."""
    out = []
    for v in a.ravel(order="C"):
        out.append(None if not np.isfinite(v) else round(float(v), decimals))
    return out


def main():
    fetch_dtm_window()
    elevation, slope, rock, extra, stats = terrain_layers()
    thermal_inertia = thermal_inertia_layer()
    science, science_parts = science_layer()
    cell_x, cell_y = cell_sizes_m()

    with open(SITE_META_PATH, encoding="utf-8") as f:
        meta = json.load(f)  # habitat and POIs, with their sources

    site = {
        "name": "Jezero Crater delta front",
        "bounds": {"south": SOUTH, "north": NORTH, "west": WEST, "east": EAST},
        "width": WIDTH,
        "height": HEIGHT,
        "cellSizeM": {"x": round(cell_x, 1), "y": round(cell_y, 1)},
        "layers": {
            "elevation": to_list(elevation),
            "slope": to_list(slope),
            "rock": to_list(rock),
            "thermalInertia": to_list(thermal_inertia),
            "science": to_list(science),
        },
        # Keys starting with "_" in site_meta.json are notes for humans (sources); Contract 1
        # has no place for them, so they are left out of site.json.
        "habitat": {k: v for k, v in meta["habitat"].items() if not k.startswith("_")},
        "pois": [{k: v for k, v in p.items() if not k.startswith("_")} for p in meta["pois"]],
        "sources": {
            "elevation": DTM_CITATION,
            "slope": (f"Derived from elevation: {SLOPE_PERCENTILE}th percentile of 5 m slopes "
                      "in each 25 m cell (HiRISE DTM mosaic, doi:10.5066/P9REJ9JN)"),
            "rock": ("Roughness proxy, not a boulder count: standard deviation of plane-detrended 1 m "
                     f"elevation in each cell, {ROUGHNESS_FULL_SCALE_M:g} m = 1.0 "
                     "(HiRISE DTM mosaic, doi:10.5066/P9REJ9JN)"),
            "thermalInertia": TI_CITATION,
            "science": CRISM_CITATION,
        },
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(site, f, separators=(",", ":"))

    size_mb = os.path.getsize(OUT_PATH) / 1e6
    log(f"\nWrote {OUT_PATH}  ({size_mb:.2f} MB)")
    log(f"Grid {WIDTH} x {HEIGHT}, cells {cell_x:.1f} m x {cell_y:.1f} m")
    log(f"Elevation {stats['elevation_m']['min']} to {stats['elevation_m']['max']} m")
    log(f"Slope (p90 per cell) percentiles: {stats['slope_p90_deg']}")
    log(f"Slope (mean per cell) percentiles, for comparison: {stats['slope_mean_deg']}")
    log(f"Roughness (m) percentiles: {stats['roughness_m']}")
    log(f"Cells over 25 deg: {int(np.nansum(slope > 25))} with p90 "
        f"(a plain mean would give {int(np.nansum(extra['slope_mean'] > 25))})")
    log(f"Rock > 0.75 (no-go): {int(np.nansum(rock > 0.75))} cells")
    log(f"Null cells: {stats['null_cells']}; cells with partial DTM coverage: {stats['partial_cells']}")
    pct = lambda a, ps: [round(float(v), 2) for v in np.nanpercentile(a, ps)]
    log(f"Thermal inertia min/p5/p50/p95/max: {pct(thermal_inertia, [0, 5, 50, 95, 100])}; "
        f"soft sand (TI < 175): {int(np.nansum(thermal_inertia < 175))} cells; "
        f"null: {int(np.isnan(thermal_inertia).sum())}")
    log(f"Science p50/p90/p99/max: {pct(science, [50, 90, 99, 100])}; cells > 0.5: {int(np.nansum(science > 0.5))}; "
        f"null: {int(np.isnan(science).sum())}")
    for name, part in science_parts.items():
        log(f"  {name}: cells > 0.5: {int(np.nansum(part > 0.5))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
