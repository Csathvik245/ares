// The Science page: a calm, readable explainer for judges. Eight short sections, each
// with a few plain sentences and one table or picture.
//
// Standalone: it takes no props and reads no app state, so it can be mounted in any tab.
// Numbers: suit and mission constants are imported from the planner; result numbers are
// copied from docs/demo-numbers.md through lib/scienceNumbers.ts (a test keeps them equal).
import type { ReactNode } from "react";
import {
  BASE_SPEED_KMH,
  CONSUMABLE_HOURS,
  DEFAULT_BLOCK_RADIUS_M,
  DEFAULT_OXYGEN_LOSS_FRACTION,
  DEFAULT_SLOW_WALK_FACTOR,
  DOSE_MSV_PER_SOL,
  MAX_SLOPE_DEG,
  RESERVE_MIN,
  ROCK_NO_GO,
  SAND_SPEED_FACTOR,
  SAND_TI_THRESHOLD,
  SCIENCE_EVIDENCE,
  SPE_MEASURED_2017_PEAK_MULTIPLIER,
  SPE_MULTIPLIER,
  STORM_EXTRA_RESERVE_MIN,
  STORM_SPEED_FACTOR,
  WALK_BURN,
  WORK_BURN,
  formatMinutes,
  formatPct,
  type Evidence,
} from "../planner";
import { DEFAULT_TRIALS, MONTE_CARLO_DISCLAIMER, PARAMS } from "../planner/montecarlo";
import { SCIENCE_NUMBERS as N } from "../lib/scienceNumbers";
import { EvidenceTag } from "./EvidenceTag";
import "./science-page.css";

/** A number or code-like value, set in the mono font. */
const Num = ({ children }: { children: ReactNode }) => <span className="science-page__num">{children}</span>;

export const SCIENCE_SECTIONS = [
  { id: "science-why-jezero", title: "Why Jezero" },
  { id: "science-data", title: "The data" },
  { id: "science-route", title: "How ARES picks a route" },
  { id: "science-reality", title: "Does it match reality?" },
  { id: "science-uncertainty", title: "Uncertainty" },
  { id: "science-emergencies", title: "Emergencies" },
  { id: "science-evidence", title: "How sure are we" },
  { id: "science-related", title: "Builds on" },
] as const;

const reserve = formatMinutes(RESERVE_MIN * 60);
const pct = (fraction: number) => formatPct(fraction * 100);
const param = (name: (typeof PARAMS)[number]["name"]) => PARAMS.find((p) => p.name === name)!;
/** "±15%" from a PARAMS range around its planned value. */
const spread = (name: (typeof PARAMS)[number]["name"]) => {
  const p = param(name);
  return `±${formatPct(((p.high - p.nominal) / p.nominal) * 100)}`;
};

const EVIDENCE_EXAMPLES: { level: Evidence; meaning: string; example: ReactNode }[] = [
  {
    level: "OBSERVED",
    meaning: "Measured by an instrument.",
    example: (
      <>
        Background radiation, <Num>{DOSE_MSV_PER_SOL} mSv</Num> per day, measured by Curiosity's RAD at Gale Crater and
        used at Jezero as an estimate.
      </>
    ),
  },
  {
    level: "CALCULATED",
    meaning: "Worked out by the planner from observed data and stated rules.",
    example: <>Route distance, walking time and the oxygen margin of a plan.</>,
  },
  {
    level: SCIENCE_EVIDENCE,
    meaning: "A reading of measured data that depends on a judgement about what it means.",
    example: <>The science value of a stop: we read a CRISM spectral signal as clay or carbonate.</>,
  },
  {
    level: "ASSUMED",
    meaning: "Rests on an assumption we chose.",
    example: (
      <>
        Suited walking speed (<Num>{BASE_SPEED_KMH} km/h</Num> on flat firm ground) and oxygen use (<Num>×{WALK_BURN}</Num>{" "}
        walking, <Num>×{WORK_BURN}</Num> working).
      </>
    ),
  },
];

export function SciencePage() {
  const [why, data, route, reality, uncertainty, emergencies, evidence, related] = SCIENCE_SECTIONS;
  return (
    <div className="science-page">
      <nav className="science-page__toc" aria-label="On this page">
        <p>On this page</p>
        <ol>
          {SCIENCE_SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="science-page__text">
        <header>
          <p className="science-page__kicker">ARES · the science behind the map</p>
          <h1>Can the astronaut get there and back?</h1>
          <p>
            ARES plans one spacewalk on Mars from real NASA data. This page explains, in plain words, what the data is,
            how the route is chosen, how we checked it, and how sure we are of each part.
          </p>
        </header>

        <section id={why.id}>
          <h2>1. {why.title}</h2>
          <p>
            About 3.5 billion years ago a river flowed into a lake in Jezero Crater and built a delta. Deltas bury mud
            quickly, and the clays and carbonates found here are the kinds of minerals that can preserve signs of
            ancient life. That is why NASA's Perseverance rover is exploring this place.
          </p>
          <p>
            An astronaut on foot has one supply of oxygen. So the question ARES answers is simple:{" "}
            <strong>can the astronaut get to the science and back?</strong>
          </p>
          <table>
            <tbody>
              <tr>
                <th scope="row">Site</th>
                <td>Jezero Crater delta front, about 6 × 8 km</td>
              </tr>
              <tr>
                <th scope="row">Science goal</th>
                <td>Sample clay and carbonate layers at the ancient delta</td>
              </tr>
              <tr>
                <th scope="row">Habitat</th>
                <td>HAB-1, placed at the Perseverance landing site</td>
              </tr>
              <tr>
                <th scope="row">Oxygen</th>
                <td>
                  <Num>{CONSUMABLE_HOURS} h</Num> of life support, with <Num>{reserve}</Num> kept in reserve
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section id={data.id}>
          <h2>2. {data.title}</h2>
          <p>
            ARES combines six kinds of NASA data, plus rover photos, on one grid of 25 m cells. Each layer answers one
            practical question for a person on foot.
          </p>
          <table className="science-page__wide">
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">What it gives ARES</th>
                <th scope="col">Credit and source</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">HiRISE terrain (Mars Reconnaissance Orbiter)</th>
                <td>Elevation at 1 m detail, and from it slope and ground roughness. Also the image under the map.</td>
                <td>
                  NASA/JPL-Caltech/University of Arizona/USGS. Fergason et al. 2020, doi:10.5066/P9REJ9JN (terrain) and
                  doi:10.5066/P9QJDP48 (image)
                </td>
              </tr>
              <tr>
                <th scope="row">THEMIS thermal inertia (Mars Odyssey)</th>
                <td>How fast the ground heats and cools. Low values mean loose, soft sand.</td>
                <td>NASA/JPL-Caltech/ASU. Edwards &amp; Buz 2021, doi:10.5281/zenodo.4931348</td>
              </tr>
              <tr>
                <th scope="row">CRISM minerals (Mars Reconnaissance Orbiter)</th>
                <td>Spectral signs of clay and carbonate: where the best science is.</td>
                <td>
                  NASA/JPL-Caltech/JHUAPL. Observation HRL000040FF, PDS Geosciences Node; Viviano-Beck et al. 2014,
                  doi:10.1002/2014JE004627
                </td>
              </tr>
              <tr>
                <th scope="row">MEDA weather (Perseverance)</th>
                <td>The coldest and warmest air temperature of the day at Jezero, and when they happen.</td>
                <td>NASA/JPL-Caltech. Munguira et al. 2023, doi:10.1029/2022JE007559</td>
              </tr>
              <tr>
                <th scope="row">RAD radiation (Curiosity, at Gale Crater)</th>
                <td>The everyday radiation dose on the surface of Mars, used at Jezero as an estimate.</td>
                <td>NASA/JPL-Caltech. Hassler et al. 2014, doi:10.1126/science.1244797</td>
              </tr>
              <tr>
                <th scope="row">Perseverance photos</th>
                <td>A real ground-level view at each stop the rover has visited.</td>
                <td>NASA/JPL-Caltech. Mars 2020 raw image gallery</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section id={route.id}>
          <h2>3. {route.title}</h2>
          <p>
            Every 25 m cell gets a walking speed. Steeper, sandier and rougher ground is slower, and some ground is
            off limits. ARES then finds the fastest safe path between the stops with a standard shortest-path method
            (Dijkstra and A*). There is no machine learning in it: the same stops always give the same route.
            We did test a machine-learning alternative (section 4); it didn't beat the physics model.
          </p>
          <p>
            Walking time becomes oxygen. The plan is GO only if the astronaut is home with the reserve untouched. The
            safe-return zone on the map is every place she could still walk to after her last stop and get home from
            with that reserve.
          </p>
          <table>
            <thead>
              <tr>
                <th scope="col">Rule</th>
                <th scope="col">Value in the planner</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Speed on flat, firm ground</th>
                <td>
                  <Num>{BASE_SPEED_KMH} km/h</Num>, slower uphill and downhill (a version of Tobler's hiking function)
                </td>
              </tr>
              <tr>
                <th scope="row">Too steep to walk</th>
                <td>
                  slope over <Num>{MAX_SLOPE_DEG}°</Num>
                </td>
              </tr>
              <tr>
                <th scope="row">Soft sand</th>
                <td>
                  thermal inertia under <Num>{SAND_TI_THRESHOLD}</Num>: speed × <Num>{SAND_SPEED_FACTOR}</Num>
                </td>
              </tr>
              <tr>
                <th scope="row">Too rough to cross</th>
                <td>
                  roughness over <Num>{ROCK_NO_GO}</Num> (on a 0 to 1 scale)
                </td>
              </tr>
              <tr>
                <th scope="row">Oxygen use</th>
                <td>
                  × <Num>{WALK_BURN}</Num> while walking, × <Num>{WORK_BURN}</Num> during science
                </td>
              </tr>
              <tr>
                <th scope="row">Oxygen budget</th>
                <td>
                  <Num>{CONSUMABLE_HOURS} h</Num>, of which <Num>{reserve}</Num> must be left on return
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section id={reality.id}>
          <h2>4. {reality.title}</h2>
          <p>
            Perseverance really drove across this ground, so we compared ARES with <Num>{N.roverPath.value}</Num> of
            the rover's real path. None of that path was used to build the terrain layers. ARES rates{" "}
            <Num>{N.roverPassable.value}</Num> of it as passable, and our slope layer agrees with the tilt the rover
            itself measured (<Num>{N.tiltCorrelation.value}</Num>, {N.waypoints.value}).
          </p>
          <p>
            Read this with care: <Num>{N.sitePassable.value}</Num> of the whole site is passable anyway, so the check
            mostly shows we have not marked real, drivable ground as blocked.
          </p>
          <figure>
            <img
              src={`${import.meta.env.BASE_URL}images/validation_traverse.jpg`}
              alt="Map of the Jezero site with Perseverance's real drive path drawn over the HiRISE image, coloured by ARES walking difficulty; ARES no-go cells are shaded red and one red cross marks the single place the path crosses a no-go cell."
              loading="lazy"
            />
            <figcaption>
              Perseverance's path over the ARES terrain model. Image: NASA/JPL-Caltech/University of Arizona/USGS
              (HiRISE). Path: NASA/JPL-Caltech (Mars 2020 traverse).
            </figcaption>
          </figure>
          <table>
            <tbody>
              <tr>
                <th scope="row">Rover path rated passable</th>
                <td>
                  <Num>{N.roverPassable.value}</Num>
                </td>
              </tr>
              <tr>
                <th scope="row">Our slope vs the rover's tilt</th>
                <td>
                  <Num>{N.tiltCorrelation.value}</Num>
                </td>
              </tr>
              <tr>
                <th scope="row">The one no-go point the rover crossed</th>
                <td>
                  Skinner Ridge, <Num>{N.noGoPlace.value}</Num>: <Num>{N.noGoLength.value}</Num> of path where our slope
                  is <Num>{N.noGoSlope.value}</Num>, just over the <Num>{MAX_SLOPE_DEG}°</Num> limit. ARES would send
                  an astronaut around it.
                </td>
              </tr>
            </tbody>
          </table>

          <h3>A second check: machine learning</h3>
          <p>
            We trained a model on 31 of Perseverance's real drives (<Num>{N.learnRouteLength.value}</Num>) to learn how
            NASA's drivers choose routes, then tested it on routes it had not seen (<Num>{N.learnRoutes.value}</Num>,
            each held out in turn). It could not beat the ARES physics planner, whose routes are on average{" "}
            <Num>{N.learnPhysics.value}</Num> from the drivers' routes, against <Num>{N.learnStraightLine.value}</Num>{" "}
            for a straight line. The learned model chose the same route as the physics planner on{" "}
            <Num>{N.learnSameRoute.value}</Num>.
          </p>
          <p>
            So the planner stays deterministic, and the learning serves as an independent check on it: a method that
            only sees what expert drivers did ends up agreeing with the terrain rules.
          </p>
          <figure>
            <img
              src={`${import.meta.env.BASE_URL}images/route_learning.jpg`}
              alt="Left: the Jezero site with Perseverance's real routes in white and the ARES physics routes in orange, lying almost on top of each other. Right: a bar chart of the mean distance from the rover's real route, with the straight line highest and the ARES physics and learned models equal."
              loading="lazy"
            />
            <figcaption>
              Perseverance's real routes and the ARES routes between the same end points, and how close each planner
              gets. Routes: NASA/JPL-Caltech (Mars 2020 traverse). Basemap: NASA/JPL-Caltech/University of Arizona/USGS
              (HiRISE).
            </figcaption>
          </figure>
        </section>

        <section id={uncertainty.id}>
          <h2>5. {uncertainty.title}</h2>
          <p>
            Several inputs are our own estimates, so ARES also asks: what if they are a bit off? It replays a plan{" "}
            {DEFAULT_TRIALS.toLocaleString("en-US")} times with the walking speed ({spread("walkSpeed")}), the terrain ({spread("terrainSpeed")} per leg),
            the oxygen use ({spread("walkBurn")}) and the time at each stop (±{param("dwell").high} min) drawn at
            random, and counts how often the astronaut is home with the reserve. This is called a Monte Carlo
            simulation.
          </p>
          <table>
            <thead>
              <tr>
                <th scope="col">Plan</th>
                <th scope="col">On paper</th>
                <th scope="col">Home with the reserve</th>
                <th scope="col">Home at all</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Demo mission ({N.demoDistance.value})</th>
                <td>
                  GO, <Num>{N.demoMargin.value}</Num> margin
                </td>
                <td>
                  <Num>{N.demoTrials.value}</Num> (failure rate likely below <Num>{N.demoFailureBound.value}</Num>)
                </td>
                <td>
                  <Num>{N.demoTrials.value}</Num>
                </td>
              </tr>
              <tr>
                <th scope="row">
                  Stretch mission: one more stop ({N.stretchDistance.value}, {N.stretchTime.value})
                </th>
                <td>
                  CAUTION, <Num>{N.stretchMargin.value}</Num> margin
                </td>
                <td>
                  <Num>{N.stretchWithReserve.value}</Num>
                </td>
                <td>
                  <Num>{N.stretchHomeAtAll.value}</Num>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="science-page__small">{MONTE_CARLO_DISCLAIMER}</p>
        </section>

        <section id={emergencies.id}>
          <h2>6. {emergencies.title}</h2>
          <p>
            When something goes wrong, ARES does not just raise an alarm. It works out a new plan from where the
            astronaut is standing, and shows two statuses: one for the mission and one for the way home. The sizes of
            these events are illustrative demo values. All results below are for the demo mission at{" "}
            <Num>{N.stormAt.value}</Num>.
          </p>
          <table className="science-page__wide">
            <thead>
              <tr>
                <th scope="col">Emergency</th>
                <th scope="col">What changes</th>
                <th scope="col">What ARES does</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Dust storm</th>
                <td>
                  Low visibility slows walking to <Num>{pct(STORM_SPEED_FACTOR)}</Num>; the reserve grows by{" "}
                  <Num>{formatMinutes(STORM_EXTRA_RESERVE_MIN * 60)}</Num>.
                </td>
                <td>
                  Aborts the walk and routes home: <Num>{N.stormWalkHome.value}</Num> walk,{" "}
                  <Num>{N.stormMargin.value}</Num> margin.
                </td>
              </tr>
              <tr>
                <th scope="row">Solar particle event</th>
                <td>
                  Radiation dose rate × <Num>{SPE_MULTIPLIER}</Num> (illustrative; the largest event measured on the
                  surface was about × <Num>{SPE_MEASURED_2017_PEAK_MULTIPLIER}</Num>).
                </td>
                <td>
                  Routes home, and checks whether a nearby cliff gives shelter. Far from home, at Wildcat Ridge, a
                  shelter <Num>{N.shelterDistance.value}</Num> away cuts the dose by <Num>{N.shelterDoseCut.value}</Num>{" "}
                  in our simplified model.
                </td>
              </tr>
              <tr>
                <th scope="row">Oxygen loss</th>
                <td>
                  <Num>{pct(DEFAULT_OXYGEN_LOSS_FRACTION)}</Num> of the oxygen left is lost.
                </td>
                <td>
                  Re-plans the remaining stops; margin <Num>{N.oxygenLossMargin.value}</Num>. With a bigger loss it
                  compares carrying on (<Num>{N.bigLossContinueMargin.value}</Num>) with going home (
                  <Num>{N.bigLossHomeMargin.value}</Num>) and recommends home.
                </td>
              </tr>
              <tr>
                <th scope="row">Slower walking</th>
                <td>
                  Speed drops to <Num>{pct(DEFAULT_SLOW_WALK_FACTOR)}</Num> (fatigue or a suit problem).
                </td>
                <td>
                  Re-times the rest of the walk; margin <Num>{N.slowWalkMargin.value}</Num>.
                </td>
              </tr>
              <tr>
                <th scope="row">Path blocked</th>
                <td>
                  Ground within <Num>{DEFAULT_BLOCK_RADIUS_M} m</Num> of a point ahead becomes impassable.
                </td>
                <td>
                  Finds a way around; margin <Num>{N.blockedMargin.value}</Num>.
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section id={evidence.id}>
          <h2>7. {evidence.title}</h2>
          <p>
            Not every number in ARES deserves the same trust, so each one carries one of four labels. The numbers
            about the human body and the suit, such as walking speed, oxygen use and the reserve, are{" "}
            <strong>ASSUMED</strong>: they are our reasoned estimates, not measurements from astronauts or suit tests.
          </p>
          <table className="science-page__wide">
            <thead>
              <tr>
                <th scope="col">Label</th>
                <th scope="col">Meaning</th>
                <th scope="col">Example</th>
              </tr>
            </thead>
            <tbody>
              {EVIDENCE_EXAMPLES.map((row) => (
                <tr key={row.level}>
                  <th scope="row">
                    <EvidenceTag level={row.level} />
                  </th>
                  <td>{row.meaning}</td>
                  <td>{row.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>The three biggest limits</h3>
          <ol>
            <li>
              <strong>Rocks are a roughness proxy, not a boulder count.</strong> The terrain data cannot see boulders
              smaller than a few meters.
            </li>
            <li>
              <strong>25 m grid cells, and one site.</strong> Anything smaller than a cell is averaged into it, and
              everything is built for the Jezero delta front only.
            </li>
            <li>
              <strong>Walking and oxygen are estimates, not spacesuit data.</strong> The speeds, burn rates and reserve
              are our assumptions.
            </li>
          </ol>
        </section>

        <section id={related.id}>
          <h2>8. {related.title}</h2>
          <p>
            ARES follows a line of traverse planners made for real exploration. We did not invent route planning for
            astronauts; we applied these ideas to one Mars site with oxygen as the limit.
          </p>
          <table className="science-page__wide">
            <thead>
              <tr>
                <th scope="col">Earlier work</th>
                <th scope="col">What it does</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">SEXTANT (MIT and NASA Ames)</th>
                <td>Plans walking routes for astronauts over rough terrain; field-tested in NASA's BASALT campaign.</td>
                <td>Norheim 2018, MIT thesis</td>
              </tr>
              <tr>
                <th scope="row">xGDS traverse planner (NASA Ames)</th>
                <td>Reachability: where a vehicle can still get to, and by when.</td>
                <td>Bresina et al. 2017</td>
              </tr>
              <tr>
                <th scope="row">MoonPath</th>
                <td>Astronaut traverses near the lunar south pole that keep the physical workload low.</td>
                <td>Peña-Asensio et al. 2024, doi:10.1016/j.actaastro.2023.10.010</td>
              </tr>
            </tbody>
          </table>
          <p>
            What ARES adds, in emphasis: Mars thermal and mineral layers, an oxygen-aware safe-return zone, and
            emergency re-planning with two statuses.
          </p>
        </section>
      </article>
    </div>
  );
}
