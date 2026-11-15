# pipeline/

Python scripts that build and check the terrain file `app/public/data/site.json`
(Contract 1 in `CLAUDE.md`) and the map background `app/public/data/basemap.png`.
The planner and the frontend both read `site.json`.

**The app uses only real NASA data.** Every layer in `site.json` names the real
dataset it came from in its `sources` entry. The old synthetic terrain still
exists, but only as a test fixture for the planner's unit tests
(`app/src/planner/__fixtures__/fake-site.json`); the app never loads it.

## Setup (once)

Run everything from the **repo root**. Python 3.10+.

```bash
python -m venv .venv
# Windows:      .venv\Scripts\activate
# macOS/Linux:  source .venv/bin/activate
pip install rasterio numpy matplotlib pillow scipy
```

`rasterio` includes GDAL, which reads the NASA file formats. `scipy` is only
needed by `learn_route_cost.py` (fast Dijkstra). `.venv/` and
`data/raw/` (downloaded source data) are in `.gitignore`.

## Rebuild everything from scratch

```bash
python pipeline/build_site.py        # site.json   (first run: ~15 min, mostly the DTM read)
python pipeline/build_shielding.py   # adds the skyView layer to site.json (about 20 s once the DTM is cached)
python pipeline/check_site.py        # must print "0 failed"
python pipeline/build_basemap.py     # basemap.png (first run: ~15 min)
python pipeline/preview_site.py app/public/data/site.json docs/images
python pipeline/validate_traverse.py # terrain vs Perseverance's real drive (docs/validation.md)
python pipeline/learn_route_cost.py  # can ML beat the planner? (docs/route-learning.md, ~35 min)
cd app && npm test                   # includes real-site.test.ts (demo mission stays 4-5 km and GO)
```

Later runs take seconds, because the source data is cached in `data/raw/`.
Delete a file in `data/raw/` to fetch it again.

## Scripts

| Script | What it does | Output |
|---|---|---|
| `build_site.py` | Builds the real terrain from NASA/USGS data | `app/public/data/site.json` (~2.4 MB) |
| `build_shielding.py` | Adds the sky-view layer (how much of the sky each cell can see) from the same HiRISE DTM. **Run it after `build_site.py`**, which writes `site.json` without it | `layers.skyView` and `sources.skyView` in `site.json`, `docs/images/skyview.png`, `pipeline/data/skyview_stats.json` |
| `build_basemap.py` | Crops and shrinks the HiRISE orthomosaic to our bounds | `app/public/data/basemap.png` + `basemap.json` |
| `validate_traverse.py` | Independent check: compares the terrain with Perseverance's real drive path (NASA traverse and waypoints files) | `docs/images/validation_traverse.png`, `pipeline/data/traverse_validation.json`, test sample. Results in `docs/validation.md` |
| `learn_route_cost.py` | Validation with machine learning: learns a terrain cost from the routes Perseverance's drivers chose (maximum margin planning) and tests, on held-out routes, whether it picks routes closer to the experts' than the ARES physics model. The app does not use it | `pipeline/data/route_learning.json`, `docs/images/route_learning.png`. Results in `docs/route-learning.md` |
| `make_validation_charts.py` | Draws the two validation charts on the Science page from real data: our slope against the rover's measured tilt at each waypoint, and the ground under the rover's path against the whole site | `app/public/images/validation_slope_vs_tilt.png`, `validation_path_vs_site.png` |
| `check_site.py` | Checks a site file against Contract 1 and checks the terrain is walkable | Pass/fail list; exit code 0 = all pass |
| `preview_site.py` | Draws each layer as a PNG with HAB-1 and the POIs marked, plus a no-go map | `pipeline/previews/*.png` or a folder you name |
| `data/site_meta.json` | Habitat and POIs, each with the source of its coordinates (hand-edited) | read by `build_site.py` |
| `fixtures/make_fake_site.py` | Regenerates the fake **test fixture** (seed 42) | `app/src/planner/__fixtures__/fake-site.json` |
| `make_favicon.py` | Draws the browser tab icon: a white letter A on the dark background, from plain shapes (not AI-generated, not the mission patch) | `app/public/favicon.svg`, `.png`, `.ico` (and the same in `site/public/`) |

## The grid (Contract 1)

- Bounds 18.40–18.50 N, 77.36–77.50 E; 320 × 240 cells; row 0 = north, column 0 = west.
- Planetocentric latitude, east longitude, on the Mars sphere of radius 3,396,190 m
  (`+proj=longlat +R=3396190 +no_defs`). Each cell is about 24.6 m × 24.7 m.
- Every source file is in its own map projection. `build_site.py` reads the
  projection **from each file** and lets GDAL reproject onto our grid. Nothing is assumed.

## What `build_site.py` does, step by step

### 1. Elevation, slope and rock — HiRISE DTM

- **Source:** Mars 2020 Terrain Relative Navigation HiRISE DTM Mosaic, 1 m/pixel.
  Fergason, Galuszka, Hare, Mayer & Redding (2020), USGS Astrogeology,
  doi:10.5066/P9REJ9JN. Made from MRO HiRISE stereo images.
  <https://planetarymaps.usgs.gov/mosaic/mars2020_trn/HiRISE/JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif>
- **Reading it:** the file is 1.8 GB. We read only our window (8,420 × 6,048 pixels,
  about 200 MB) over HTTPS and cache it as `data/raw/jezero_hirise_dtm_1m_window.tif` (67 MB).
- **Elevation** = the mean of the DTM inside each cell, in meters.
- **Slope** = computed at about 5 m (each cell split 5 × 5), in degrees, using real
  meters. The cell gets the **90th percentile** of its 25 five-meter slopes. A plain
  average would hide a 10 m wide cliff inside a 25 m cell; the 90th percentile keeps
  it. Effect: 838 cells are steeper than 25°, where a plain mean would give 383.
- **Rock** = a **roughness proxy**, 0 to 1. In each cell we fit a tilted plane to the
  625 one-meter elevations, subtract it, and take the standard deviation of what is
  left. 1.0 m of leftover bumpiness = 1.0. A 1 m DTM cannot see single boulders
  smaller than a few meters, so this marks rugged, broken ground, not a boulder count.
- No missing data in our window: 0 null cells.

### 2. Thermal inertia (soft sand) — THEMIS

- **Source:** *THEMIS-derived Thermal Inertia of Jezero Crater, Mars*, Edwards & Buz
  (2021), Zenodo, doi:10.5281/zenodo.4931348, CC BY 4.0. Quantitative, 100 m/pixel,
  from Mars Odyssey THEMIS. <https://zenodo.org/records/4931348>
- The 1.7 MB file is downloaded whole to `data/raw/` and checked against its md5.
- Resampled (bilinear) to the grid. The layer looks smooth at 25 m but holds only
  100 m detail: a sand patch narrower than about 100 m is not resolved.
- Values in our window: 133 to 319. 7,081 cells (9%) are below the planner's
  soft-sand threshold of 175.
- **A second product disagrees.** The USGS global THEMIS thermal inertia mosaic
  (tile 00N060E) reads about 100 units higher over the same window (mean ~314 vs
  ~215). We use the Jezero-specific product because it was made for this crater and
  has a DOI. With the USGS values almost nothing would count as soft sand.

### 3. Science value (clays and carbonates) — CRISM

- **Source:** MRO CRISM map-projected targeted observation **HRL000040FF** (MTRDR,
  36 m/pixel), refined summary-parameter product `hrl000040ff_07_sr183j_mtr3`, PDS
  Geosciences Node dataset MRO-M-CRISM-5-RDR-MPTARGETED-V1.0.
  <https://pds-geosciences.wustl.edu/mro/mro-m-crism-5-rdr-mptargeted-v1/mrocr_4001/mtrdr/2007/2007_029/hrl000040ff/>
- It is the one CRISM scene that covers 100% of our window. Only the three bands we
  use are read over HTTPS (about 4 MB) and cached in `data/raw/`.
- **Parameters** (defined in Viviano-Beck et al. 2014, doi:10.1002/2014JE004627):
  `D2300` (Fe/Mg clay), `MIN2295_2480` (Mg carbonate), `MIN2345_2537` (Ca/Fe carbonate).
- **Index:** for each parameter, 0 or less scores 0 and the scene's 99.5th percentile
  scores 1. A cell's science value is the highest of its three scores.
- **Limits:** this is a relative index inside one scene, not a mineral abundance. The
  clay parameter dominates: the delta scores high and the crater floor low, which
  matches published maps of Jezero. Carbonate signals are weak at this scale.

### 4. Habitat and stops — `data/site_meta.json`

- **HAB-1** is at the Perseverance landing site, 18.4446 N, 77.4509 E, from the first
  waypoint of NASA's "Where is Perseverance" waypoints file (18.44462715, 77.45088572).
  The cell is flat and firm: slope 1.1°, thermal inertia 243, rock 0.05.
- **POIs:** seven Perseverance sampling sites, with coordinates and rock descriptions
  from the *Mars 2020 Initial Reports* (Farley & Stack 2022, doi:10.17189/68tf-re13;
  2023, doi:10.17189/49zd-2k55), plus one spot picked from the CRISM layer.
- **The first three POIs are the demo mission**, in walking order: Séítah outcrop
  (Brac) → delta front toe → Máaz lava rock (Sid). Measured with the real planner,
  30 min at each stop: **4.97 km, 3 h 35 min, 192 min oxygen margin, GO.**
- The delta front toe is a **new science target selected from the CRISM clay signal, not visited by Perseverance**. That is deliberate: the challenge asks for new science, and this is where the orbital clay signal is strongest within walking range.
- The rover's own delta-front sampling sites are 2.6–3.1 km from the landing site each way, so a loop through them is about 6.5 km (still GO, 134 min margin). They are in the file as extra POIs.

## `build_shielding.py`

```bash
python pipeline/build_site.py          # only if site.json needs rebuilding
python pipeline/build_shielding.py     # adds layers.skyView; changes nothing else in site.json
python pipeline/check_site.py
```

Adds `layers.skyView` to `site.json`: for every 25 m cell, the fraction of the sky an
astronaut standing there can see (1 = open sky all round). The planner's shelter
routing (`app/src/planner/shelter.ts`) uses it in a solar particle event.

- **Source:** the same HiRISE DTM mosaic as the elevation layer (doi:10.5066/P9REJ9JN),
  read through `build_site.py`'s own functions, so the cache in `data/raw/`, the
  projection handling and the grid are identical. Nothing else is downloaded.
- **Method:** the DTM averaged to about 5 m; from each cell centre, 1.5 m above the
  ground, the horizon angle is found in 32 compass directions out to 500 m;
  `skyView = mean of (1 - sin(horizon angle))`. That is the open share of the sky's
  solid angle. Rounded to 3 decimals; `site.json` grows to about 2.8 MB.
- **Why 5 m and not 1 m:** it runs in seconds and still resolves the scarps and crater
  walls that matter at 25 m. Ledges and boulders under about 5 m are smoothed away.
- **`build_site.py` does not know about this layer.** Rebuilding `site.json` drops it,
  so run `build_shielding.py` again afterwards. `check_site.py` fails on the real
  file if the layer is missing.
- **`preview_site.py` has no colour style for `skyView` yet** and stops with a
  `KeyError` when it reaches it. Use `docs/images/skyview.png`, which
  `build_shielding.py` writes itself, until a style line is added there.

What the layer looks like (numbers from `pipeline/data/skyview_stats.json`):

- Lowest 0.640, median 0.982, highest 1.000. Most of the site is open ground.
- 4.2% of cells are below 0.9; 0.04% are below 0.8, and **none of those can be walked on**.
- HAB-1, on the open crater floor: 0.988. The delta front toe stop: 0.939. The least
  open walkable cell within 300 m of the toe, at the foot of the scarp: 0.826.
- The lowest values are inside Belva crater, along the delta scarp and around Kodiak butte.
- **Limits:** terrain beyond 500 m is ignored, and the DTM cache stops about 60 m
  outside the site, so cells within 500 m of the site edge may read too open.

What the layer means for shelter routing (`app/src/planner/shelter.ts`, run with its defaults, 14 November 2026):

| SPE starts when the astronaut is at | Walk home | Shelter chosen | Dose with shelter | Dose walking home | Dose cut | `betterThanHome` |
|---|---|---|---|---|---|---|
| Farthest point of the demo route (T+1:42; this is the arrival at the delta front toe) | 48 min | none: walk home. Best shelter is 13 min away, sky view 0.83, and would give 0.653 mSv | 0.608 mSv | 0.608 mSv | 0% | false |
| Arrival at the delta front toe (T+1:42) | 48 min | none: walk home (same point as the row above) | 0.608 mSv | 0.608 mSv | 0% | false |
| Wildcat Ridge (Hawksbill Gap) | 73 min | 160 m away, 9 min walk, sky view 0.84 | 0.659 mSv | 0.750 mSv | 12% | true |
| Amalik (Cape Nukshak) | 76 min | 330 m away, 14 min walk, sky view 0.86 | 0.677 mSv | 0.758 mSv | 11% | true |
| Hidden Harbor (Yori Pass) | 79 min | 120 m away, 7 min walk, sky view 0.86 | 0.669 mSv | 0.751 mSv | 11% | true |

- Oxygen used so far: the demo mission's own value for the two demo-route rows (120 min of the 480). The three rover sites are not on the demo mission, so they use the same 120 min, as if the astronaut had walked on from the delta front toe.
- Doses are **illustrative** (the SPE rate is the ×30 demo multiplier) and cover an **assumed 60 minute event**. "Dose walking home" counts only the part of the walk inside those 60 minutes; the rest of the walk home is not counted for either option.
- **On this site, natural shelter beats going home only when HAB-1 is more than about 55 minutes away; the best walkable shelter hides about 17% of the sky.** Even then it is not always offered: in a scan of 958 start points with full oxygen, the nearest one where a shelter won was 55 min from home, and 547 of the 958 got an offer.
- The 55 minutes follows from the 60 minute assumption: inside it, the habitat (full shelter) is reached before the event ends. For a longer event, walking home wins from further away too.

## `build_basemap.py`

- **Source:** Mars 2020 Terrain Relative Navigation HiRISE Orthorectified Image
  Mosaic, 25 cm/pixel, Fergason et al. (2020), USGS Astrogeology, doi:10.5066/P9QJDP48.
- The mosaic is 7.4 GB with no small copies inside, so the script reads two
  full-resolution rows per output row over HTTPS and averages down to about
  3.5 m/pixel (2400 × 1714), keeping the PNG under 3 MB.
- `basemap.json` holds the bounds, size, source and credit. In Leaflet:
  `L.imageOverlay("data/basemap.png", [[18.40, 77.36], [18.50, 77.50]])`.

## `check_site.py`

```bash
python pipeline/check_site.py                                           # the real file
python pipeline/check_site.py app/src/planner/__fixtures__/fake-site.json   # the fixture
```

On every file: Contract 1 shape (keys, 320 × 240, cell size, bounds, layer lengths,
value ranges, 2-decimal rounding, under 5 MB, no NaN); habitat on flat firm ground;
every POI reachable from the habitat through passable cells.

Real file only: cell elevations are compared with the source DTM at the same
lat/lng (catches a flipped or shifted grid; needs `data/raw/`), and the slope layer
must follow the terrain.

Fake fixture only: the built-in fake features (scarp orientation, ramps, boulder
field, science hotspots). These used to run on every file and would fail on real terrain.

Run it after every change to `site.json`.

## What the real terrain looks like

Previews are in `docs/images/`. Things worth knowing:

- The delta is the high ground in the north-west (up to −2,393 m); the crater floor
  drops to −2,647 m in the south-east. The delta front is a real scarp with slopes
  over 40°, clearly visible in the slope and no-go maps.
- Belva crater (18.48 N, 77.38 E) and Kodiak butte (18.44 N, 77.41 E) show up as
  rings of steep slope.
- Only 6 passable cells in the whole window cannot be reached from the habitat.
- The crater-floor sampling sites score low on the CRISM science layer (0.1–0.3)
  even though the rover found carbonate there: the orbital signal is weak at 36 m.
