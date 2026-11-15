# ARES — data sources and references

Every NASA dataset and paper ARES uses or plans to use, with a link and how we use it.
Credit images "NASA/JPL-Caltech" (+ instrument team). Model assumptions are in [`assumptions.md`](assumptions.md).

**Checked** column:

- ✅ we opened the link and confirmed what it is.
- 🔎 the link came from a search result but we did not open it.
- ⬜ no link checked yet. Find and verify one before citing.

## Datasets

| Data type | Dataset | Mission / instrument | Link | Checked | How ARES uses it | Status |
|---|---|---|---|---|---|---|
| Topographic | Mars 2020 Terrain Relative Navigation HiRISE DTM Mosaic, 1 m/pixel. Fergason, R.L., Galuszka, D.M., Hare, T.M., Mayer, D.P., Redding, B.L. (2020), U.S. Geological Survey. doi:10.5066/P9REJ9JN | MRO HiRISE | https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-hirise-dtm-mosaic · file: https://planetarymaps.usgs.gov/mosaic/mars2020_trn/HiRISE/JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif | ✅ (file opened and read) | Elevation layer; slope and the rock/roughness layer are derived from it (`pipeline/build_site.py`) | **Used** |
| Optical | Mars 2020 Terrain Relative Navigation HiRISE Orthorectified Image Mosaic, 25 cm/pixel. Fergason, R.L., Galuszka, D.M., Hare, T.M., Mayer, D.P., Redding, B.L. (2020), U.S. Geological Survey. doi:10.5066/P9QJDP48 | MRO HiRISE | https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-hirise-orthorectified-image-mosaic · file: https://planetarymaps.usgs.gov/mosaic/mars2020_trn/HiRISE/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first.tif | ✅ (file opened and read) | Map background `app/public/data/basemap.png`, shrunk to ~3.5 m/pixel (`pipeline/build_basemap.py`). Credit: NASA/JPL-Caltech/University of Arizona/USGS | **Used** |
| Topographic (backup) | Mars 2020 Terrain Relative Navigation CTX DTM Mosaic, 20 m/pixel. Fergason et al. (2020), U.S. Geological Survey. doi:10.5066/P906QQT8 | MRO CTX | https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-ctx-dtm-mosaic | 🔎 | Not needed: the HiRISE DTM covers our whole window with no gaps | Backup, unused |
| Topographic (backup) | Mars MGS MOLA DEM 463 m, USGS Astrogeology | Mars Global Surveyor MOLA | https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m | 🔎 (page returned 403 to us) | Last-resort elevation; regional context | Backup |
| Thermal | THEMIS-derived Thermal Inertia of Jezero Crater, Mars (quantitative, 100 m/pixel). Edwards, C.S. & Buz, J. (2021), Zenodo, version 1, CC BY 4.0. doi:10.5281/zenodo.4931348 | Mars Odyssey THEMIS | https://zenodo.org/records/4931348 | ✅ (file downloaded, md5 checked) | Thermal-inertia layer: values under 175 are treated as soft sand | **Used** |
| Thermal (not used) | THEMIS Thermal Inertia Mosaic Quantitative 00N060E 100mpp, USGS Astrogeology (2014); method Fergason, Christensen & Kieffer 2006 | Mars Odyssey THEMIS | https://astrogeology.usgs.gov/search/map/themis_thermal_inertia_mosaic_quantitative_00n060e_100mpp | ✅ (page opened; a few pixels read) | Cross-check only. Reads about 100 units higher than the Jezero-specific product over our window (mean ~314 vs ~215) | Not used |
| Spectral | CRISM MTRDR observation HRL000040FF (36 m/pixel), refined summary parameters `hrl000040ff_07_sr183j_mtr3`: D2300, MIN2295_2480, MIN2345_2537. PDS Geosciences Node dataset MRO-M-CRISM-5-RDR-MPTARGETED-V1.0 | MRO CRISM | https://pds-geosciences.wustl.edu/mro/mro-m-crism-5-rdr-mptargeted-v1/mrocr_4001/mtrdr/2007/2007_029/hrl000040ff/ | ✅ (file opened and read) | Science-value layer: relative 0–1 clay/carbonate index | **Used** |
| Atmospheric | MEDA weather data | Perseverance MEDA | ⬜ (PDS Atmospheres Node) | ⬜ | Will replace the placeholder temperature curve | Planned |
| Radiation | RAD surface dose | Curiosity RAD (Gale Crater) | See Hassler et al. 2014 below | ✅ (record) | Baseline dose rate, applied to Jezero | Used (`DOSE_MSV_PER_SOL`) |
| Basemap tiles | NASA Mars Trek (JPL) | Several | https://trek.nasa.gov/mars/ | ✅ | Equirectangular basemap tiles in Leaflet | Used / testing |
| Rover photos | Perseverance raw images (front Hazcam, Navcam), NASA Mars 2020 raw image gallery | Perseverance | https://mars.nasa.gov/mars2020/multimedia/raw-images/ | ✅ (seven images downloaded; see "Rover photos" below) | Ground-view photo at each rover sampling stop, `app/public/photos/`. Credit: NASA/JPL-Caltech | **Used** |
| Rover traverse | NASA "Where is Perseverance" waypoints file | Perseverance | https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json | ✅ | Landing-site coordinates for HAB-1 (first waypoint: 18.44462715 N, 77.45088572 E) | **Used** |
| Rover samples | Mars 2020 Initial Reports, Volume 1 (Crater Floor Campaign), Farley, K. & Stack, K. (2022), doi:10.17189/68tf-re13; Volume 2 (Delta Front Campaign), Farley, K. & Stack, K. (2023), doi:10.17189/49zd-2k55. NASA PDS Sample Dossier | Perseverance | https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_sample_dossier/initial_reports/ | ✅ (both PDFs opened; coordinates and rock descriptions extracted) | Coordinates and descriptions of the seven rover sampling sites used as POIs | **Used** |
| Space weather | NASA DONKI space weather database | Several | ⬜ | ⬜ | Real solar particle event examples for the story | Planned |
| Climate | Mars Climate Database | Model | ⬜ | ⬜ | Seasonal temperature and dust context | Planned |
| Terrain labels | AI4Mars dataset | Curiosity/Opportunity/Spirit imagery | ⬜ | ⬜ | Training data for ML boulder detection (stretch) | Stretch |
| Apollo maps | Apollo traverse maps, Lunar and Planetary Institute | Apollo | ⬜ | ⬜ | Design inspiration for stop cards and the walkback idea | Inspiration |

## Papers and references

| Reference | Link | Checked | How ARES uses it |
|---|---|---|---|
| Hassler, D.M., Zeitlin, C., et al. (2014). Mars' Surface Radiation Environment Measured with the Mars Science Laboratory's Curiosity Rover. *Science* 343(6169). doi:10.1126/science.1244797 | https://ntrs.nasa.gov/citations/20180007641 | ✅ record and abstract only; full text not reachable | Source of the surface dose baseline. **0.64 mSv value not yet confirmed from the paper** (see assumptions note 1). |
| SwRI press release, 9 Dec 2013: "an average GCR dose equivalent rate of 0.67 millisieverts per day from August 2012 to June 2013" | https://swri.org/node/9079 (also reprinted at https://phys.org/news/2013-12-scientists-publish-surface-mars.html) | ✅ | The only surface dose number we could read; used to cross-check `DOSE_MSV_PER_SOL` |
| Zeitlin, C., Hassler, D.M., Guo, J., et al. (2018). Analysis of the Radiation Hazard Observed by RAD on the Surface of Mars During the September 2017 Solar Particle Event. *Geophysical Research Letters* 45(12), 5845–5851. doi:10.1029/2018GL077760 | https://elib.dlr.de/120101/ | ✅ | Real SPE size at the surface (2–3× background). Shows our ×30 is illustrative. |
| Allison, M., and McEwen, M. (2000). A post-Pathfinder evaluation of areocentric solar coordinates with improved timing recipes for Mars seasonal/diurnal climate studies. *Planet. Space Sci.* 48, 215–235 | Preprint: https://ntrs.nasa.gov/citations/20000097895 | 🔎 (cited on the Mars24 page ✅) | Sun position algorithm |
| NASA GISS, Mars24 Sunclock — Algorithm and Worked Examples | https://www.giss.nasa.gov/tools/mars24/help/algorithm.html | ✅ | Equations implemented in `env.ts` |
| NASA NSSDC Mars Fact Sheet | https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html | ✅ | Sol length 24.6597 h; radii |
| PDS Mars Orbital Data Explorer — "Coordinate System?" | https://ode.rsl.wustl.edu/mars/pagehelp/Content/Frequently_Asked_Questions/Coordinate_System.htm | ✅ | IAU2000 equatorial radius 3396.19 km; planetocentric, east-positive coordinates (Contract 1) |
| Tobler, W. (1993). Three Presentations on Geographical Analysis and Modeling. NCGIA Technical Report 93-1 | https://escholarship.org/uc/item/05r820mz | 🔎 (page returned no content to us) | Origin of the hiking function |
| Wikipedia, "Tobler's hiking function" | https://en.wikipedia.org/wiki/Tobler%27s_hiking_function | ✅ | Formula `6 exp(−3.5 |dh/dx + 0.05|)`, 5 km/h on flat ground, 3/5 off-path factor |
| Gernhardt, M.L., Norcross, J., Vos, J.R. (2008). Integrated Suit Test 1 — A Study to Evaluate Effects of Suit Weight, Pressure, and Kinematics on Human Performance During Lunar Ambulation. SAE International | https://ntrs.nasa.gov/api/citations/20080013604/downloads/20080013604.pdf | ✅ | Suited metabolic rate rises with speed and suit weight; nominal suited speeds < 5 km/h; describes the EVA Walkback Test's 10 km walkback scenario |
| Chullen, C., Pena, I., Chen, H. (2023). Technology Infusion in U.S. Spacesuits — A Comparative System Analysis. Conference on Systems Engineering Research | https://ntrs.nasa.gov/api/citations/20230001969/downloads/CSER_2023_paper_6287%20Final.pdf | ✅ | EMU 8 h nominal life support, 30 min emergency oxygen; Apollo 15–17 PLSS 7 h certified |
| NASA, Apollo 17: Mission Details | https://www.nasa.gov/missions/apollo/apollo-17-mission-details/ | ✅ | Three EVAs, 22 h 4 min total, longest 7 h 37 min: real-world scale for an 8 h EVA |
| Hille, K.B. (2015). The Fact and Fiction of Martian Dust Storms. NASA | https://www.nasa.gov/content/the-fact-and-fiction-of-martian-dust-storms | ✅ | Mars air ~1% of Earth's density; wind can't knock people over. Justifies "visibility, not wind". |
| Edwards, C.S., Bandfield, J.L., Christensen, P.R., Fergason, R.L. (2009). Global distribution of bedrock exposures on Mars using THEMIS high-resolution thermal inertia. *JGR Planets*. doi:10.1029/2009JE003363 | https://www.usgs.gov/publications/global-distribution-bedrock-exposures-mars-using-themis-high-resolution-thermal | ✅ | Bedrock = thermal inertia above 1200; context for our sand threshold |
| Fergason, R.L., Christensen, P.R., Kieffer, H.H. (2006). High-resolution thermal inertia derived from the Thermal Emission Imaging System (THEMIS): Thermal model and applications. *JGR* 111, E12004. doi:10.1029/2006JE002735 | https://doi.org/10.1029/2006JE002735 | 🔎 (cited on the USGS product page ✅; paper not opened) | THEMIS thermal inertia method |
| Viviano-Beck, C. E., et al. (2014). Revised CRISM spectral parameters and summary products based on the currently detected mineral diversity on Mars. *J. Geophys. Res. Planets* 119, 1403–1431. doi:10.1002/2014JE004627 | https://doi.org/10.1002/2014JE004627 | ✅ (citation verified by the team) | Defines the CRISM summary parameters we use (D2300, MIN2295_2480, MIN2345_2537) |
| Mangold, N., Gupta, S., Gasnault, O., Dromart, G., et al. (2021). Perseverance rover reveals an ancient delta-lake system and flood deposits at Jezero crater, Mars. *Science* 374. doi:10.1126/science.abl4051 | https://hal.archives-ouvertes.fr/hal-03375854/file/Mangold_Science_withFiguresHAL.pdf | 🔎 (search result and press summaries; PDF not opened) | Rover confirmation of the lake and delta, and flood boulders. Used in [`science-case.md`](science-case.md) |
| Goudge, T.A., et al. (2015). Assessing the mineralogy of the watershed and fan deposits of the Jezero crater paleolake system, Mars. *JGR Planets* 120, 775–808. doi:10.1002/2014JE004782 | https://ui.adsabs.harvard.edu/abs/2015JGRE..120..775G | 🔎 (ADS abstract via search; author order to confirm on the DOI page) | Clay, carbonate and olivine in the delta, mostly carried in from the watershed. Used in [`science-case.md`](science-case.md) |
| Horgan, Anderson, Dromart, Amador and Rice (2020). The mineral diversity of Jezero crater: Evidence for possible lacustrine carbonates on Mars. *Icarus* 339, 113526. doi:10.1016/j.icarus.2019.113526 | https://pubs.usgs.gov/publication/70211826 | 🔎 (page returned 403 to us) | Carbonate locations at Jezero; fallback for the science layer if CRISM processing is too slow |
| Rodriguez-Manfredi, J.A., et al. (2023). The diverse meteorology of Jezero crater over the first 250 sols of Perseverance on Mars. *Nature Geoscience* 16, 19–28. doi:10.1038/s41561-022-01084-0 | Summary: https://phys.org/news/2023-01-rich-meteorology-mars-perseverance-rover.html | ✅ summary only (paper behind login) | Jezero temperatures (average ~−55 °C, 50–60 °C day/night swing). Context for the placeholder curve. |
| NASA Human Integration Design Handbook (NASA/SP-2010-3407, Rev. 1, 2014) | https://www.nasa.gov/sites/default/files/atoms/files/human_integration_design_handbook_revision_1.pdf | 🔎 | Planned source for suited metabolic rates to replace `WALK_BURN` / `WORK_BURN` |

## Notes on the terrain data

- **Landing-site coordinates.** The often-quoted 18.4447 N, 77.4508 E appeared only on Wikipedia in our searches. NASA's own waypoints file gives 18.44462715 N, 77.45088572 E, so HAB-1 uses 18.4446 N, 77.4509 E (about 6 m different).
- **"Octavia E. Butler Landing"** is an informal NASA name; it is not in the IAU/USGS Gazetteer of Planetary Nomenclature.
- **Zenodo downloads.** The thermal inertia file downloads with a normal request; no account is needed.

## Rover photos

One real Perseverance raw image per rover sampling stop, in `app/public/photos/`. All are credited **NASA/JPL-Caltech** by NASA's raw image gallery. The only change we made is saving the PNG as a JPEG. The app reads the camera and sol from `app/src/lib/photoCredits.ts`, which holds the same facts as this table.

**How each photo was checked.** Raw images carry a site/drive tag, not coordinates. Three things were checked for every photo:

1. **Place.** NASA's waypoints file gives the lat/lng of each site/drive. The waypoint with the photo's site/drive tag is 0.2 to 2.6 m from the stop's coordinates ("Waypoint to stop" below).
2. **Date.** The photo's sol is inside the sampling sols listed for that stop in `pipeline/data/site_meta.json` (from the Mars 2020 Initial Reports).
3. **Content.** We looked at each image. "What the image shows" is our own description, not NASA's.

| File | Stop | Camera | Photo sol (Earth date) | Sampling sols | Site / drive | Waypoint to stop | What the image shows | NASA image ID (source URL) |
|---|---|---|---|---|---|---|---|---|
| `seitah-brac.jpg` | Séítah outcrop (Brac) | Front Left Hazcam | 262 (15 Nov 2021) | 262–271 | 8 / 0 | 0.6 m | Arm and turret on a rock outcrop | [FLF_0262_0690210688_738ECM_N0080000FHAZ00206_01_295J](https://mars.nasa.gov/mars2020/multimedia/raw-images/FLF_0262_0690210688_738ECM_N0080000FHAZ00206_01_295J) |
| `maaz-sid.jpg` | Máaz lava rock (Sid) | Front Left Hazcam | 371 (7 Mar 2022) | 371–377 | 11 / 108 | 2.6 m | Arm and turret on a single boulder | [FLF_0371_0699884867_862ECM_N0110108FHAZ00206_01_295J](https://mars.nasa.gov/mars2020/multimedia/raw-images/FLF_0371_0699884867_862ECM_N0110108FHAZ00206_01_295J) |
| `maaz-rochette.jpg` | Rochette (Artuby ridge) | Left Navcam | 190 (1 Sep 2021) | 190–196 | 7 / 0 | 0.2 m | Arm raised over a field of flat rocks; **the cored rock is not picked out in the frame** | [NLF_0190_0683808901_487ECM_N0070000NCAM00209_01_295J](https://mars.nasa.gov/mars2020/multimedia/raw-images/NLF_0190_0683808901_487ECM_N0070000NCAM00209_01_295J) |
| `seitah-issole.jpg` | Séítah outcrop (Issole) | Front Left Hazcam | 337 (31 Jan 2022) | 295–337 | 9 / 276 | 2.0 m | Arm and turret on a flat outcrop | [FLF_0337_0696864692_347ECM_N0090276FHAZ00206_01_295J](https://mars.nasa.gov/mars2020/multimedia/raw-images/FLF_0337_0696864692_347ECM_N0090276FHAZ00206_01_295J) |
| `delta-wildcat-ridge.jpg` | Wildcat Ridge (Hawksbill Gap) | Front Left Hazcam | 509 (26 Jul 2022) | 509–516 | 26 / 1222 | 2.0 m | Arm and turret on layered rock | [FLF_0509_0712138514_736ECM_N0261222FHAZ00206_01_295J](https://mars.nasa.gov/mars2020/multimedia/raw-images/FLF_0509_0712138514_736ECM_N0261222FHAZ00206_01_295J) |
| `delta-amalik.jpg` | Amalik (Cape Nukshak) | Front Left Hazcam | 575 (2 Oct 2022) | 575–579 | 29 / 0 | 2.2 m | Arm and turret on a fractured outcrop | [FLF_0575_0717995745_942ECM_N0290000FHAZ00206_01_295J](https://mars.nasa.gov/mars2020/multimedia/raw-images/FLF_0575_0717995745_942ECM_N0290000FHAZ00206_01_295J) |
| `delta-hidden-harbor.jpg` | Hidden Harbor (Yori Pass) | Front Left Hazcam | 623 (20 Nov 2022) | 623 | 30 / 1172 | 2.5 m | Arm and turret on a flat outcrop | [FLF_0623_0722254512_006ECM_N0301172FHAZ00216_01_295J](https://mars.nasa.gov/mars2020/multimedia/raw-images/FLF_0623_0722254512_006ECM_N0301172FHAZ00216_01_295J) |

**Confirmed for all seven:** the rover was parked at the stop (place) during its sampling work there (date).

**Not confirmed (flagged):**

- **Which rock is in the frame.** NASA's raw-image captions are generic ("acquired this image using its onboard Front Left Hazard Avoidance Camera") and do not name the rock. We have not matched any frame to a named, captioned NASA image of Brac, Sid, Rochette, Issole, Wildcat Ridge, Amalik or Hidden Harbor. So say "Perseverance at this sampling site", not "this is the Brac rock".
- **`maaz-rochette.jpg`** is the weakest: it is a wide Navcam view with the arm raised, and we cannot tell which rock was cored.
- **`seitah-issole.jpg`** was taken on sol 337, the last sampling sol at Issole, after the rover had left and come back (site 9 / drive 276; the first visit was site 9 / drive 0, 2.7 m from the stop).

The delta front toe has no photo: Perseverance never went there. The app shows a HiRISE crop of the spot instead, labelled "No rover visit · orbital view".

## To do

- Confirm the Hassler et al. 2014 dose value and its unit (per day or per sol) from the full paper.
- Find and check links for every ⬜ row before the final slides.
- Pull EVA metabolic rates from the Human Integration Design Handbook.
