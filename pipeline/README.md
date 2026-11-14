# pipeline/

Python scripts that build and check the terrain file `app/public/data/site.json`
(Contract 1 in `CLAUDE.md`). The planner and the frontend both read that file.

Right now the file is **fake** (synthetic terrain, `"fake": true`). The real-data
pipeline (HiRISE DTM, THEMIS, CRISM) will replace it later and must produce
exactly the same shape, so the checks below apply to it too.

## Setup (once)

Run everything from the **repo root**. Python 3.10+.

```bash
python -m venv .venv
# Windows:      .venv\Scripts\activate
# macOS/Linux:  source .venv/bin/activate
pip install numpy matplotlib
```

(`.venv/` is in `.gitignore`.)

## Scripts

| Script | What it does | Output |
|---|---|---|
| `make_fake_site.py` | Generates the fake terrain (fixed seed 42, so everyone gets the same file) | `app/public/data/site.json` (~2.35 MB) |
| `check_site.py` | Checks the file against Contract 1 and checks that the terrain is walkable | Pass/fail list; exit code 0 = all pass, 1 = something failed |
| `preview_site.py` | Draws each layer as a PNG with HAB-1 and the POIs marked, plus a no-go map | `pipeline/previews/*.png` |

### 1. Generate

```bash
python pipeline/make_fake_site.py
```

Expected output:

```
Wrote app/public/data/site.json  (2.35 MB)
Grid 320 x 240, cells 24.6 m x 24.7 m
Elevation -2533 to -2403 m
Slope max 56.1 deg, cells over 25 deg: 609
Rock > 0.75 (no-go): 299 cells
Soft sand (TI < 175): 9893 cells
```

(The "299" counts unrounded values. After rounding to 2 decimals, 293 cells are
strictly above 0.75 in the file — that's expected. `TASK_fake_site.md` still says
211; that was before the crater-floor boulder field was added.)

What the fake terrain contains: a delta scarp cliff (no-go wall) with two gentle
ramps near 18.435 N and 18.472 N, a boulder apron at the cliff foot, soft-sand
patches, science hotspots at the POIs, and one **small boulder field on the crater
floor** (centered 18.4416 N, 77.4440 E, ~230 m across) sitting on the straight lines
from HAB-1 to `clay-1` and to `carb-1`, so the planner must route around boulders too. The boulder
field uses no random numbers, so all other layers are unchanged.

### 2. Check

```bash
python pipeline/check_site.py                     # checks app/public/data/site.json
python pipeline/check_site.py path/to/other.json  # or any other file
```

What it checks:

1. **Contract 1 shape** — all keys, 320 × 240 grid, `cellSizeM = {x: 24.6, y: 24.7}`,
   bounds, each layer has 76,800 values, values in range, rounded to 2 decimals,
   no NaN/Infinity, file < 5 MB, POI fields present and inside the bounds.
2. **Orientation** — row 0 = north, column 0 = west (delta top is higher in the west,
   the slope layer matches slope recomputed from elevation, science hotspots line
   up with the POIs).
3. **Habitat ground** — HAB-1's cell has slope < 5°, thermal inertia ≥ 175 (not sand),
   rock < 0.2.
4. **POI reachability** — every POI can be reached from HAB-1 walking only through
   cells with slope ≤ 25° and rock ≤ 0.75 (8 neighbors, no cutting corners past
   no-go cells — same rule as the planner).
5. **Delta scarp ramps** — each ramp (~18.435 N and ~18.472 N) has a crossing onto
   the delta using only slopes < 15°; `carb-1` (on the delta top) is reachable on
   slopes < 15° only; and the scarp is a real wall everywhere else (block the ramps
   and `carb-1` becomes unreachable). This is what the planner's detour test relies on.
6. **Boulder field** (fake file only) — the straight line HAB-1 → `clay-1` crosses
   rock no-go cells, so a route there must detour around boulders.

Run it after every change to `site.json`, and before opening a PR that touches it.

### 3. Preview

```bash
python pipeline/preview_site.py
```

Writes `elevation.png`, `slope.png`, `rock.png`, `thermalInertia.png` (orange line =
the 175 soft-sand threshold), `science.png` and `nogo.png` to `pipeline/previews/`.
North is up. Cyan square = HAB-1, orange dots = science POIs, red X = hazard.
Good for a quick look and for slides.
