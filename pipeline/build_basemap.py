"""
build_basemap.py — makes app/public/data/basemap.png: a real orbital image of
exactly the Contract 1 bounds (18.40-18.50 N, 77.36-77.50 E), for the map
background (Leaflet L.imageOverlay). Also writes basemap.json with the source.

Source: USGS Astrogeology "Mars 2020 Terrain Relative Navigation HiRISE
Orthorectified Image Mosaic" (Fergason et al. 2020, doi:10.5066/P9QJDP48),
25 cm/pixel, from MRO HiRISE images.

The mosaic is 7.4 GB, uncompressed, with no reduced-resolution copies inside.
We need about 3.5 m/pixel (to stay under 3 MB), so instead of downloading it we
read two full-resolution image rows for every output row over HTTPS, average
them, and average along each row. That is about 3,400 small requests (~115 MB)
and takes roughly 10 minutes. Rows are cached in data/raw/ so a broken run resumes.

Run from the repo root:
    pip install rasterio numpy pillow
    python pipeline/build_basemap.py
"""

import json
import os
import sys
import time

import numpy as np
import rasterio
from PIL import Image
from rasterio.crs import CRS
from rasterio.warp import transform_bounds
from rasterio.windows import Window, from_bounds as window_from_bounds

SOUTH, NORTH, WEST, EAST = 18.40, 18.50, 77.36, 77.50
SITE_CRS = CRS.from_proj4("+proj=longlat +R=3396190 +no_defs")
OUT_W, OUT_H = 2400, 1714          # same 1.4 : 1 shape as the bounds; about 3.5 m per pixel
ROWS_PER_OUT_ROW = 2
MAX_BYTES = 3_000_000

ORTHO_URL = (
    "https://planetarymaps.usgs.gov/mosaic/mars2020_trn/HiRISE/"
    "JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first.tif"
)
RAW_DIR = os.path.join("data", "raw")
CACHE = os.path.join(RAW_DIR, f"basemap_rows_{OUT_W}x{OUT_H}.npy")
OUT_PNG = os.path.join("app", "public", "data", "basemap.png")
OUT_JSON = os.path.join("app", "public", "data", "basemap.json")


def read_rows():
    os.makedirs(RAW_DIR, exist_ok=True)
    if os.path.exists(CACHE):
        img = np.load(CACHE)
    else:
        img = np.full((OUT_H, OUT_W), -1.0, dtype=np.float32)   # -1 = row not read yet
    todo = [j for j in range(OUT_H) if img[j, 0] == -1.0]
    if not todo:
        return img
    print(f"Reading {len(todo)} of {OUT_H} rows over HTTPS:\n  {ORTHO_URL}", flush=True)
    env = dict(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif",
               GDAL_HTTP_MAX_RETRY="5", GDAL_HTTP_RETRY_DELAY="2", CPL_VSIL_CURL_CHUNK_SIZE="65536")
    with rasterio.Env(**env), rasterio.open(ORTHO_URL) as src:
        print(f"  CRS from file: {src.crs.to_proj4()}, pixel {src.res}, nodata {src.nodata}", flush=True)
        left, bottom, right, top = transform_bounds(SITE_CRS, src.crs, WEST, SOUTH, EAST, NORTH, densify_pts=21)
        win = window_from_bounds(left, bottom, right, top, src.transform)
        col0, ncols = int(round(win.col_off)), int(round(win.width))
        fy = win.height / OUT_H
        # Column bins: source column -> output column.
        edges = np.linspace(0, ncols, OUT_W + 1).round().astype(int)
        t0 = time.time()
        for n, j in enumerate(todo):
            acc = np.zeros(OUT_W)
            cnt = np.zeros(OUT_W)
            for k in range(ROWS_PER_OUT_ROW):
                r = int(win.row_off + (j + (k + 0.5) / ROWS_PER_OUT_ROW) * fy)
                row = src.read(1, window=Window(col0, r, ncols, 1))[0].astype(np.float64)
                ok = row != (src.nodata if src.nodata is not None else 0)
                acc += np.add.reduceat(row * ok, edges[:-1])
                cnt += np.add.reduceat(ok.astype(np.float64), edges[:-1])
            img[j] = np.where(cnt > 0, acc / np.maximum(cnt, 1), 0)
            if n % 100 == 99 or n == len(todo) - 1:
                np.save(CACHE, img)
                print(f"    {n + 1}/{len(todo)} rows ({time.time() - t0:.0f} s)", flush=True)
    return img


def main():
    img = read_rows()
    out = np.clip(np.round(img), 0, 255).astype(np.uint8)
    os.makedirs(os.path.dirname(OUT_PNG), exist_ok=True)
    Image.fromarray(out, mode="L").save(OUT_PNG, optimize=True)
    size = os.path.getsize(OUT_PNG)
    if size > MAX_BYTES:
        # Too big: keep the picture, store fewer grey levels (compresses much better).
        for levels in (128, 64, 48, 32):
            step = 256 // levels
            Image.fromarray((out // step) * step + step // 2, mode="L").save(OUT_PNG, optimize=True)
            size = os.path.getsize(OUT_PNG)
            print(f"  reduced to {levels} grey levels: {size / 1e6:.2f} MB")
            if size <= MAX_BYTES:
                break
    meta = {
        "file": "basemap.png",
        "bounds": {"south": SOUTH, "north": NORTH, "west": WEST, "east": EAST},
        "width": OUT_W,
        "height": OUT_H,
        "projection": "Equirectangular (plain lat/lng), planetocentric latitude, east longitude, Mars sphere R = 3396190 m. Row 0 = north.",
        "metersPerPixel": round(float(np.radians(NORTH - SOUTH) * 3396190 / OUT_H), 2),
        "source": ("Mars 2020 Terrain Relative Navigation HiRISE Orthorectified Image Mosaic, 25 cm/pixel "
                   "(Fergason et al. 2020, USGS Astrogeology, doi:10.5066/P9QJDP48); MRO HiRISE"),
        "sourceUrl": ORTHO_URL,
        "credit": "NASA/JPL-Caltech/University of Arizona/USGS",
        "processing": "Cropped to the site bounds and averaged down from 25 cm to about 3.5 m per pixel. No other changes.",
    }
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"Wrote {OUT_PNG} ({size / 1e6:.2f} MB, {OUT_W} x {OUT_H}) and {OUT_JSON}")
    return 0 if size <= MAX_BYTES else 1


if __name__ == "__main__":
    sys.exit(main())
