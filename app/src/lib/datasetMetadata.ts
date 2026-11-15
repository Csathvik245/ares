// Metadata for every dataset ARES uses: what the instrument resolved, what our 25 m grid
// holds, when it was taken, and how the pipeline resampled it.
//
// Every value is copied from docs/sources.md, docs/validation.md, pipeline/build_site.py,
// pipeline/build_basemap.py or app/public/data/basemap.json. Nothing is guessed: a value
// those files do not hold says "not recorded". The same table is in README.md; a test
// (components/science-page.test.tsx) keeps the two equal.

export type DatasetRow = {
  id: string;
  /** Short name, the product's full title, the instrument and mission, and what ARES uses it for. */
  name: string;
  product: string;
  mission: string;
  use: string;
  native: string;
  grid: string;
  date: string;
  resample: string;
  /** DOI or credit, and the link it opens. */
  source: string;
  link: string;
};

export const NOT_RECORDED = "not recorded";
export const DATASET_COLUMNS = ["Dataset", "Native resolution", "On our grid (25 m)", "Acquisition date / sols", "Resampling method", "DOI / source link"] as const;
export const COARSE_LAYER_NOTE = "Layers coarser than 25 m are resampled, so neighbouring cells can share one measurement; they don't add detail the instrument didn't see.";

export const DATASETS: DatasetRow[] = [
  {
    id: "hirise-dtm",
    name: "HiRISE terrain model",
    product: "Mars 2020 Terrain Relative Navigation HiRISE DTM Mosaic (Fergason et al. 2020)",
    mission: "HiRISE, Mars Reconnaissance Orbiter",
    use: "Elevation, slope and ground roughness",
    native: "1 m per pixel",
    grid: "Three values per 25 m cell: elevation, slope and roughness",
    date: "not recorded (a mosaic of several images; our sources give no dates)",
    resample: "The 1 m pixels are averaged to 5 m. Elevation is the mean of the cell's 25 five-metre values. Slope is the 90th percentile of its 25 five-metre slopes, so a small cliff is not averaged away. Roughness is the spread of its 625 one-metre heights after the cell's own tilt is removed.",
    source: "doi:10.5066/P9REJ9JN",
    link: "https://doi.org/10.5066/P9REJ9JN",
  },
  {
    id: "hirise-image",
    name: "HiRISE image",
    product: "Mars 2020 Terrain Relative Navigation HiRISE Orthorectified Image Mosaic (Fergason et al. 2020)",
    mission: "HiRISE, Mars Reconnaissance Orbiter",
    use: "The picture under the map",
    native: "25 cm per pixel",
    grid: "Not put on the grid. Shown as a picture at about 3.5 m per pixel",
    date: "not recorded (a mosaic of several images; our sources give no dates)",
    resample: "Cropped to the site and averaged down: for each row of our picture two full-resolution rows are read and averaged, then averaged along the row. No other changes.",
    source: "doi:10.5066/P9QJDP48",
    link: "https://doi.org/10.5066/P9QJDP48",
  },
  {
    id: "themis",
    name: "THEMIS thermal inertia",
    product: "THEMIS-derived Thermal Inertia of Jezero Crater, Mars (Edwards & Buz 2021)",
    mission: "THEMIS, Mars Odyssey",
    use: "Soft sand: low thermal inertia means loose ground",
    native: "100 m per pixel",
    grid: "One value per 25 m cell, read from 100 m pixels: neighbouring cells share one measurement",
    date: "not recorded",
    resample: "Bilinear interpolation: each cell takes a distance-weighted blend of the nearest 100 m pixels.",
    source: "doi:10.5281/zenodo.4931348",
    link: "https://doi.org/10.5281/zenodo.4931348",
  },
  {
    id: "crism",
    name: "CRISM minerals",
    product: "CRISM MTRDR observation HRL000040FF, summary parameters D2300, MIN2295_2480 and MIN2345_2537 (defined in Viviano-Beck et al. 2014, doi:10.1002/2014JE004627)",
    mission: "CRISM, Mars Reconnaissance Orbiter",
    use: "Science value: a relative clay and carbonate signal",
    native: "36 m per pixel",
    grid: "One 0 to 1 science value per 25 m cell, read from 36 m pixels",
    date: "29 January 2007 (day 029 of 2007, from the PDS folder name)",
    resample: "Bilinear interpolation of each of the three parameters. Each is then scaled from 0 (absorption not seen) to 1 (the 99.5th percentile of the scene), and the cell keeps the highest of the three.",
    source: "PDS Geosciences Node",
    link: "https://pds-geosciences.wustl.edu/mro/mro-m-crism-5-rdr-mptargeted-v1/mrocr_4001/mtrdr/2007/2007_029/hrl000040ff/",
  },
  {
    id: "meda",
    name: "MEDA air temperature",
    product: "Air temperature at 1.45 m: daily minimum and maximum (Munguira et al. 2023, Table 1)",
    mission: "MEDA, Perseverance",
    use: "Temperature along the walk",
    native: "Point measurement, not a map; applied over time",
    grid: "Point measurement, not a map; applied over time",
    date: "Sols 34 to 40 (Ls 25°)",
    resample: "None. The measured daily low (191 K at 05:00) and high (243 K at 15:00) are joined by our own smooth curve.",
    source: "doi:10.1029/2022JE007559",
    link: "https://doi.org/10.1029/2022JE007559",
  },
  {
    id: "rad",
    name: "RAD radiation",
    product: "Surface dose equivalent rate (Hassler et al. 2014, Table 1)",
    mission: "RAD, Curiosity, at Gale Crater",
    use: "Radiation dose during the walk, used at Jezero as an estimate",
    native: "Point measurement, not a map; applied over time",
    grid: "Point measurement, not a map; applied over time",
    date: "7 Aug 2012 to 1 Jun 2013 (about 300 sols)",
    resample: "None. One average rate, 0.64 ± 0.12 mSv per day, is applied to the whole walk.",
    source: "doi:10.1126/science.1244797",
    link: "https://doi.org/10.1126/science.1244797",
  },
  {
    id: "traverse",
    name: "Perseverance traverse",
    product: "NASA \"Where is Perseverance\" traverse and waypoints files",
    mission: "Perseverance",
    use: "Validation only. Never used to build a layer",
    native: "Not pixels: one line per drive, and one point per end-of-drive stop",
    grid: "Not put on the grid. Each point on the path looks up the 25 m cell under it",
    date: "Sols 14 to 896 inside our site (file downloaded 14 November 2026)",
    resample: "The path is sampled every 10 m or closer. No values are interpolated.",
    source: "NASA/JPL-Caltech",
    link: "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json",
  },
  {
    id: "photos",
    name: "Perseverance photos",
    product: "Raw images from the front Hazcam and Navcam, one per rover sampling stop",
    mission: "Perseverance",
    use: "A ground view at each stop the rover visited",
    native: "not recorded (ground photos, not a map)",
    grid: "Not put on the grid. One photo per stop",
    date: "Sols 190 to 623",
    resample: "None. The only change is saving the PNG as a JPEG.",
    source: "NASA/JPL-Caltech",
    link: "https://mars.nasa.gov/mars2020/multimedia/raw-images/",
  },
];
