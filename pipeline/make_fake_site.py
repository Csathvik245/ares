"""
make_fake_site.py — generates a FAKE site.json that matches Contract 1 exactly.

Purpose: unblock the Planner and Frontend work before real NASA data is ready.
The terrain is synthetic but plausible for the Jezero delta front:
  - elevation around -2,500 m with a curved delta scarp (cliff) and rolling hills
  - slope derived from elevation using real cell sizes in meters
  - boulder density from terrain roughness (more boulders below the scarp)
  - thermal inertia: low in sandy dune patches, high on bedrock
  - science value: high along the delta front (stand-in for carbonates and clays)

Run from the repo root:
    python pipeline/make_fake_site.py
Output:
    app/public/data/site.json
"""

import json
import math
import os

import numpy as np

# ---- Grid and site settings (Contract 1) ------------------------------------
SOUTH, NORTH, WEST, EAST = 18.40, 18.50, 77.36, 77.50
WIDTH, HEIGHT = 320, 240

# Mars sphere radius used for cell sizes. 3396190 m is the IAU sphere used by
# most Mars map products (and gives the 24.6 x 24.7 m cells in Contract 1).
# The team must use the SAME radius in planner/constants.ts.
MARS_RADIUS_M = 3396190

HABITAT = {"name": "HAB-1", "lat": 18.444, "lng": 77.472}
OUT_PATH = os.path.join("app", "public", "data", "site.json")

rng = np.random.default_rng(42)  # fixed seed so everyone gets the same fake file


# ---- Helpers -----------------------------------------------------------------
def smooth(a, passes):
    """Cheap blur: repeated 3x3 box averaging (numpy only, no scipy needed)."""
    for _ in range(passes):
        p = np.pad(a, 1, mode="edge")
        a = (
            p[:-2, :-2] + p[:-2, 1:-1] + p[:-2, 2:]
            + p[1:-1, :-2] + p[1:-1, 1:-1] + p[1:-1, 2:]
            + p[2:, :-2] + p[2:, 1:-1] + p[2:, 2:]
        ) / 9.0
    return a


def normalize(a):
    lo, hi = a.min(), a.max()
    return (a - lo) / (hi - lo + 1e-9)


def r2(a):
    """Flatten row-major and round to 2 decimals (Contract 1 grid rules)."""
    return [round(float(v), 2) for v in a.ravel(order="C")]


# ---- Cell sizes in meters -----------------------------------------------------
mid_lat = math.radians((SOUTH + NORTH) / 2)
cell_y = math.radians(NORTH - SOUTH) * MARS_RADIUS_M / HEIGHT
cell_x = math.radians(EAST - WEST) * MARS_RADIUS_M * math.cos(mid_lat) / WIDTH

# Coordinate grids. Row 0 = north edge, column 0 = west edge.
rows, cols = np.mgrid[0:HEIGHT, 0:WIDTH]
lat = NORTH - (rows + 0.5) / HEIGHT * (NORTH - SOUTH)
lng = WEST + (cols + 0.5) / WIDTH * (EAST - WEST)
x_m = cols * cell_x
y_m = rows * cell_y

# ---- Elevation ----------------------------------------------------------------
# Delta scarp: a curved line west of the habitat. West of it is the raised delta
# top; east of it is the lower crater floor. The cliff is ~90 m high and is a
# no-go wall except at two gentle ramps (gaps), so the planner must find a way
# through. Good for testing detours.
scarp_lng = 77.415 + 0.012 * np.sin((lat - SOUTH) / (NORTH - SOUTH) * math.pi * 1.5)
dist_to_scarp_m = (lng - scarp_lng) * (cell_x * WIDTH / (EAST - WEST))
ramp = np.zeros_like(lat)
for ramp_lat in (18.435, 18.472):  # two walkable gaps in the cliff
    ramp = np.maximum(ramp, np.exp(-((lat - ramp_lat) / 0.004) ** 2))
scarp_width_m = 15.0 + 400.0 * ramp  # steep wall; wide, gentle ramp at the gaps
scarp = 90.0 / (1.0 + np.exp(dist_to_scarp_m / scarp_width_m))

hills = smooth(rng.normal(0, 1, (HEIGHT, WIDTH)), 12)
hills = normalize(hills) * 30.0  # gentle rolling terrain

ripples = smooth(rng.normal(0, 1, (HEIGHT, WIDTH)), 2) * 1.5  # small-scale bumps

# Regional tilt: crater floor dips slightly to the east
tilt = -0.002 * x_m

elevation = -2520.0 + scarp + hills + ripples + tilt

# ---- Slope (degrees) from elevation, using real meters -------------------------
dz_dy, dz_dx = np.gradient(elevation, cell_y, cell_x)
slope = np.degrees(np.arctan(np.hypot(dz_dx, dz_dy)))

# ---- Boulder density 0..1 from roughness ---------------------------------------
roughness = np.abs(elevation - smooth(elevation, 1))
boulder_noise = normalize(smooth(rng.normal(0, 1, (HEIGHT, WIDTH)), 4))
below_scarp = np.exp(-np.maximum(dist_to_scarp_m, 0) / 300.0) * (dist_to_scarp_m > 0)
# Small boulder field on the crater floor, on the straight line between the
# habitat and clay-1, so the planner has to route around boulders (not just the
# cliff). Deterministic blob: uses no random numbers, so the seed's sequence and
# every other layer stay the same.
BOULDER_FIELD = (18.461, 77.4485, 220.0)  # lat, lng, radius in meters
bf_lat, bf_lng, bf_rad_m = BOULDER_FIELD
bf_d = np.hypot((lat - bf_lat) * cell_y * HEIGHT / (NORTH - SOUTH),
                (lng - bf_lng) * cell_x * WIDTH / (EAST - WEST))
boulder_field = np.exp(-(bf_d / bf_rad_m) ** 2)
rock = np.clip(
    0.45 * normalize(roughness) + 0.35 * boulder_noise ** 3 + 0.5 * below_scarp
    + 0.9 * boulder_field,
    0,
    1,
)

# ---- Thermal inertia (J m^-2 K^-1 s^-1/2) --------------------------------------
# Bedrock ~300-450, sand/dust ~100-170. Sand collects in low spots and patches.
dune_field = normalize(smooth(rng.normal(0, 1, (HEIGHT, WIDTH)), 8))
low_spots = 1 - normalize(smooth(elevation, 6))
sand_mix = 0.7 * dune_field + 0.3 * low_spots
# Top ~10% of the mix becomes soft sand (TI < 175); the rest grades to bedrock
lo_q, hi_q = np.quantile(sand_mix, [0.55, 0.92])
sandiness = np.clip((sand_mix - lo_q) / (hi_q - lo_q), 0, 1)
thermal_inertia = 420.0 - 300.0 * sandiness + rng.normal(0, 8, (HEIGHT, WIDTH))
thermal_inertia = np.clip(thermal_inertia, 90, 480)

# ---- Science value 0..1 --------------------------------------------------------
# Highest along the delta front (carbonate/clay stand-in), plus a few hotspots.
front = np.exp(-(dist_to_scarp_m / 350.0) ** 2)
hotspots = np.zeros_like(elevation)
for hlat, hlng, rad_m in [(18.462, 77.402, 300), (18.478, 77.425, 250), (18.425, 77.418, 220)]:
    d = np.hypot((lat - hlat) * cell_y * HEIGHT / (NORTH - SOUTH),
                 (lng - hlng) * cell_x * WIDTH / (EAST - WEST))
    hotspots = np.maximum(hotspots, np.exp(-(d / rad_m) ** 2))
science = np.clip(0.55 * front + 0.6 * hotspots + 0.05 * boulder_noise, 0, 1)

# ---- Points of interest ---------------------------------------------------------
pois = [
    {
        "id": "carb-1", "name": "Delta front carbonates", "lat": 18.462, "lng": 77.402,
        "kind": "science", "note": "Carbonate layers record ancient lake chemistry",
        "photo": "photos/carb-1.jpg", "photoCredit": "NASA/JPL-Caltech, Perseverance Mastcam-Z",
    },
    {
        "id": "clay-1", "name": "Upper delta clay beds", "lat": 18.478, "lng": 77.425,
        "kind": "science", "note": "Clay minerals can trap and preserve organic molecules",
        "photo": "photos/clay-1.jpg", "photoCredit": "NASA/JPL-Caltech, Perseverance Mastcam-Z",
    },
    {
        "id": "scarp-1", "name": "Delta scarp outcrop", "lat": 18.425, "lng": 77.418,
        "kind": "science", "note": "Exposed layers show how the delta was built over time",
        "photo": "photos/scarp-1.jpg", "photoCredit": "NASA/JPL-Caltech, Perseverance Mastcam-Z",
    },
    {
        "id": "haz-1", "name": "Boulder apron below scarp", "lat": 18.450, "lng": 77.425,
        "kind": "hazard", "note": "FAKE DATA: dense boulders at the cliff base",
    },
]

# ---- Assemble Contract 1 ----------------------------------------------------------
site = {
    "name": "Jezero Crater delta front",
    "fake": True,  # extra flag so nobody mistakes this for real data
    "bounds": {"south": SOUTH, "north": NORTH, "west": WEST, "east": EAST},
    "width": WIDTH,
    "height": HEIGHT,
    "cellSizeM": {"x": round(cell_x, 1), "y": round(cell_y, 1)},
    "layers": {
        "elevation": r2(elevation),
        "slope": r2(slope),
        "rock": r2(rock),
        "thermalInertia": r2(thermal_inertia),
        "science": r2(science),
    },
    "habitat": HABITAT,
    "pois": pois,
    "sources": {
        "elevation": "FAKE: synthetic terrain (replace with Mars 2020 HiRISE DTM mosaic, USGS Astrogeology)",
        "slope": "Derived from elevation",
        "rock": "FAKE: derived from synthetic roughness",
        "thermalInertia": "FAKE: synthetic (replace with THEMIS thermal inertia)",
        "science": "FAKE: synthetic (replace with CRISM mineral maps)",
    },
}

os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
with open(OUT_PATH, "w") as f:
    json.dump(site, f, separators=(",", ":"))

size_mb = os.path.getsize(OUT_PATH) / 1e6
print(f"Wrote {OUT_PATH}  ({size_mb:.2f} MB)")
print(f"Grid {WIDTH} x {HEIGHT}, cells {cell_x:.1f} m x {cell_y:.1f} m")
print(f"Elevation {elevation.min():.0f} to {elevation.max():.0f} m")
print(f"Slope max {slope.max():.1f} deg, cells over 25 deg: {(slope > 25).sum()}")
print(f"Rock > 0.75 (no-go): {(rock > 0.75).sum()} cells")
print(f"Soft sand (TI < 175): {(thermal_inertia < 175).sum()} cells")
