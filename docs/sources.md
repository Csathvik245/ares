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
| Topographic | Mars 2020 Terrain Relative Navigation HiRISE DTM Mosaic. Fergason, R.L., Galuszka, D.M., Hare, T.M., Mayer, D.P., Redding, B.L. (2020), USGS Astrogeology. doi:10.5066/P9REJ9JN | MRO HiRISE | https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-hirise-dtm-mosaic | ✅ | Elevation layer; slope and boulder roughness are derived from it | Planned (pipeline step 2) |
| Optical | Mars 2020 TRN HiRISE Orthorectified Image Mosaic, USGS. doi:10.5066/P9QJDP48 | MRO HiRISE | https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-hirise-orthorectified-image-mosaic | 🔎 | Basemap and visual checks of boulders and cliffs | Planned |
| Topographic (backup) | Mars 2020 TRN CTX DTM Mosaic, USGS | MRO CTX | https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-ctx-dtm-mosaic | 🔎 | Backup elevation if the HiRISE DTM is too large or has gaps | Backup |
| Topographic (backup) | Mars MGS MOLA DEM 463 m, USGS Astrogeology | Mars Global Surveyor MOLA | https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m | 🔎 (page returned 403 to us) | Last-resort elevation; regional context | Backup |
| Thermal | THEMIS thermal inertia (100 m/pixel), method in Fergason et al. 2006 (JGR) | Mars Odyssey THEMIS | ⬜ (JMARS or PDS) | ⬜ | Soft-sand layer (low thermal inertia = loose sand) | Planned (pipeline step 4) |
| Spectral | CRISM mineral maps, via PDS Geosciences Node / Mars Orbital Data Explorer | MRO CRISM | ODE: https://ode.rsl.wustl.edu/mars/pagehelp/Content/Frequently_Asked_Questions/Coordinate_System.htm (help page) | ✅ ODE help page; CRISM product links ⬜ | Science-value layer: carbonate and clay detections | Planned (pipeline step 5; decide by hour 8) |
| Atmospheric | MEDA weather data | Perseverance MEDA | ⬜ (PDS Atmospheres Node) | ⬜ | Will replace the placeholder temperature curve | Planned |
| Radiation | RAD surface dose | Curiosity RAD (Gale Crater) | See Hassler et al. 2014 below | ✅ (record) | Baseline dose rate, applied to Jezero | Used (`DOSE_MSV_PER_SOL`) |
| Basemap tiles | NASA Mars Trek (JPL) | Several | https://trek.nasa.gov/mars/ | ✅ | Equirectangular basemap tiles in Leaflet | Used / testing |
| Rover photos | Perseverance raw images (Mastcam-Z, Navcam) | Perseverance | ⬜ | ⬜ | Ground-view photo at each stop. Raw images are tagged by site/drive, not coordinates, so we place them by hand. | Planned |
| Rover traverse | Perseverance traverse map | Perseverance | ⬜ | ⬜ | Matching photos to locations | Planned |
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
| Fergason et al. (2006). High-resolution thermal inertia derived from the Thermal Emission Imaging System (THEMIS). *JGR* — full author list to check | ⬜ | 🔎 | THEMIS thermal inertia method |
| Horgan, Anderson, Dromart, Amador and Rice (2020). The mineral diversity of Jezero crater: Evidence for possible lacustrine carbonates on Mars. *Icarus* 339, 113526. doi:10.1016/j.icarus.2019.113526 | https://pubs.usgs.gov/publication/70211826 | 🔎 (page returned 403 to us) | Carbonate locations at Jezero; fallback for the science layer if CRISM processing is too slow |
| Rodriguez-Manfredi, J.A., et al. (2023). The diverse meteorology of Jezero crater over the first 250 sols of Perseverance on Mars. *Nature Geoscience* 16, 19–28. doi:10.1038/s41561-022-01084-0 | Summary: https://phys.org/news/2023-01-rich-meteorology-mars-perseverance-rover.html | ✅ summary only (paper behind login) | Jezero temperatures (average ~−55 °C, 50–60 °C day/night swing). Context for the placeholder curve. |
| NASA Human Integration Design Handbook (NASA/SP-2010-3407, Rev. 1, 2014) | https://www.nasa.gov/sites/default/files/atoms/files/human_integration_design_handbook_revision_1.pdf | 🔎 | Planned source for suited metabolic rates to replace `WALK_BURN` / `WORK_BURN` |

## To do

- Confirm the Hassler et al. 2014 dose value and its unit (per day or per sol) from the full paper.
- Find and check links for every ⬜ row before the final slides.
- Pull EVA metabolic rates from the Human Integration Design Handbook.
