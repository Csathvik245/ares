// The Science page: a calm, readable explainer for judges. Eight short sections, each
// with a few plain sentences and one table or picture.
//
// Standalone: it takes no props and reads no app state, so it can be mounted in any tab.
// Numbers: suit and mission constants are imported from the planner; result numbers are
// copied from docs/demo-numbers.md through lib/scienceNumbers.ts (a test keeps them equal).
import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { VALIDATION_NUMBERS as V } from "../lib/validationNumbers";
import { ML_NUMBERS as M } from "../lib/mlNumbers";
import { COARSE_LAYER_NOTE, DATASETS, DATASET_COLUMNS, NOT_RECORDED } from "../lib/datasetMetadata";
import { EvidenceTag } from "./EvidenceTag";
import { WHAT_IF_INVITE } from "./WhatIfPanel";
import "./science-page.css";

/** A number or code-like value, set in the mono font. */
const Num = ({ children }: { children: ReactNode }) => <span className="science-page__num">{children}</span>;

export const SCIENCE_SECTIONS = [
  { id: "science-why-jezero", title: "Why Jezero" },
  { id: "science-data", title: "The data" },
  { id: "science-route", title: "How ARES picks a route" },
  // The validation report. `key` marks it in the contents list: it is the section judges should not miss.
  { id: "science-reality", title: "How we validated ARES", key: true },
  { id: "science-ml", title: "Can machine learning do better?" },
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

/** What a contents link needs from the page; the browser's own objects fit it, and so do a test's stand-ins. */
type SectionPage = {
  getElementById: (id: string) => {
    scrollIntoView: (options?: ScrollIntoViewOptions) => void;
    querySelector: (selector: string) => { focus: (options?: FocusOptions) => void } | null;
  } | null;
};

/**
 * A click (or Enter) on a contents link: scroll the section into view INSIDE the Science
 * page, and move the keyboard focus to its heading.
 *
 * It never touches the URL. The app's tabs are driven by the hash (#story, #plan,
 * #science), so letting the browser follow "#science-data" would be read as an unknown
 * tab and throw the visitor back to the Story screen.
 */
export function goToScienceSection(
  id: string,
  event: { preventDefault: () => void },
  page: SectionPage | undefined = typeof document === "undefined" ? undefined : document,
  reducedMotion: boolean = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
): boolean {
  event.preventDefault();
  const section = page?.getElementById(id);
  if (!section) return false;
  section.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  // preventScroll: the smooth scroll above decides where the page goes, not the focus.
  section.querySelector("h2")?.focus({ preventScroll: true });
  return true;
}

export function SciencePage() {
  const [why, data, route, reality, ml, uncertainty, emergencies, evidence, related] = SCIENCE_SECTIONS;
  const scroller = useRef<HTMLDivElement>(null);
  // The section being read, for the highlight in the contents list.
  const [current, setCurrent] = useState<string>(SCIENCE_SECTIONS[0].id);
  useEffect(() => {
    const root = scroller.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    // A section counts as "current" while it crosses a band near the top of the page.
    const observer = new IntersectionObserver(
      (entries) => {
        const showing = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target.id);
        if (showing.length === 0) return;
        const first = SCIENCE_SECTIONS.find((s) => showing.includes(s.id));
        if (first) setCurrent(first.id);
      },
      { root, rootMargin: "-10% 0px -70% 0px" },
    );
    for (const s of SCIENCE_SECTIONS) {
      const el = root.querySelector(`#${s.id}`);
      if (el) observer.observe(el);
    }
    // The last section is short and can never reach the top band, so the end of the page counts as it.
    const last = SCIENCE_SECTIONS[SCIENCE_SECTIONS.length - 1].id;
    const onScroll = () => {
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 2) setCurrent(last);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      root.removeEventListener("scroll", onScroll);
    };
  }, []);
  return (
    <div className="science-page" ref={scroller}>
      <nav className="science-page__toc" aria-label="On this page">
        <p>On this page</p>
        <ol>
          {SCIENCE_SECTIONS.map((s) => (
            <li key={s.id}>
              {/* href stays "#science": the URL never changes, so the app's hash router keeps this tab open. */}
              <a
                href="#science"
                data-section={s.id}
                className={[s.id === current ? "is-current" : "", "key" in s && s.key ? "is-key" : ""].filter(Boolean).join(" ") || undefined}
                aria-current={s.id === current ? "true" : undefined}
                onClick={(event) => {
                  if (goToScienceSection(s.id, event)) setCurrent(s.id);
                }}
              >
                {s.title}
              </a>
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
          <h2 tabIndex={-1}>1. {why.title}</h2>
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
          <h2 tabIndex={-1}>2. {data.title}</h2>
          <p>
            ARES combines six kinds of NASA data, plus rover photos, on one grid of 25 m cells. Each layer answers one
            practical question for a person on foot.
          </p>
          {/* Wide table: it scrolls sideways inside this box on narrow screens. */}
          <div className="science-page__scroll" role="region" aria-label="Dataset metadata" tabIndex={0}>
            <table className="science-page__wide science-page__meta">
              <thead>
                <tr>
                  {DATASET_COLUMNS.map((c) => (
                    <th scope="col" key={c}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DATASETS.map((d) => (
                  <tr key={d.id}>
                    <th scope="row">
                      {d.name}
                      <small>
                        {d.mission}. {d.product}. Used for: {d.use.charAt(0).toLowerCase() + d.use.slice(1)}
                      </small>
                    </th>
                    <td>{d.native}</td>
                    <td>{d.grid}</td>
                    <td>{d.date}</td>
                    <td>{d.resample}</td>
                    <td>
                      <a href={d.link} target="_blank" rel="noopener noreferrer">
                        {d.source}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>{COARSE_LAYER_NOTE}</p>
          <p className="science-page__small">
            "{NOT_RECORDED}" means the value is not in our sources, so we do not state one. Image and data credits:
            NASA/JPL-Caltech/University of Arizona/USGS (HiRISE), NASA/JPL-Caltech/ASU (THEMIS), NASA/JPL-Caltech/JHUAPL
            (CRISM), NASA/JPL-Caltech (Perseverance and Curiosity).
          </p>
        </section>

        <section id={route.id}>
          <h2 tabIndex={-1}>3. {route.title}</h2>
          <p>
            Every 25 m cell gets a walking speed. Steeper, sandier and rougher ground is slower, and some ground is
            off limits. ARES then finds the fastest safe path between the stops with a standard shortest-path method
            (Dijkstra and A*). There is no machine learning in it: the same stops always give the same route.
            We did test a machine-learning alternative (section 5); it didn't beat the physics model.
          </p>
          <p>
            Fastest is not the same as shortest. On the demo mission we also planned a terrain-blind route, chosen
            by distance alone, and timed it with the same walking model. It is the same length as the ARES route, but
            it ignores slope and sand, so it costs <Num>{N.terrainBlindSlower.value}</Num> and leaves{" "}
            <Num>{N.terrainBlindLessSpare.value}</Num>. In the Plan tab, "Compare: terrain-blind route" (under More
            details) draws both.
          </p>
          <p>
            Walking time becomes oxygen. The plan is GO only if the astronaut is home with the reserve untouched. The
            safe-return zone on the map is every place she could still detour to after her last stop and get home from
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
          <h2 tabIndex={-1}>4. {reality.title}</h2>
          <p>
            A plan is only as good as the map under it, so we checked ARES against data it was not built from. Each
            answer below is short; the full write-up is in the repository (<Num>docs/validation.md</Num>). A second
            check, with machine learning, is section 5.
          </p>

          <h3>a. What did we compare against?</h3>
          <p>
            Perseverance's real drive. <Num>{N.roverPath.value}</Num> of its path lies inside our site (sols{" "}
            <Num>{V.firstSol.value}</Num> to <Num>{V.lastSol.value}</Num>), crossing <Num>{V.cellsTouched.value}</Num>{" "}
            of our cells, with <Num>{N.waypoints.value}</Num> where the rover stopped at the end of a drive. The source
            is NASA's "Where is Perseverance" traverse and waypoints files, downloaded on {V.downloaded.value}.
          </p>
          <p>
            It is independent because none of it was used to build the terrain layers, which come from orbital data
            only (HiRISE, THEMIS, CRISM). The one overlap: the landing point, where the traverse begins, was used to place the habitat.
          </p>
          <figure>
            <img
              src={`${import.meta.env.BASE_URL}images/validation_traverse.jpg`}
              width={1400}
              height={1000}
              alt="Map of the Jezero site with Perseverance's real drive path drawn over the HiRISE image, coloured by ARES walking difficulty; ARES no-go cells are shaded red and one red cross marks the single place the path crosses a no-go cell."
              loading="lazy"
            />
            <figcaption>
              Perseverance's path over the ARES terrain model. Image: NASA/JPL-Caltech/University of Arizona/USGS
              (HiRISE). Path: NASA/JPL-Caltech (Mars 2020 traverse).
            </figcaption>
          </figure>

          <h3>b. What does {N.roverPassable.value} passable mean?</h3>
          <p>
            It is the share of the rover's path length that lies on cells ARES rates walkable: slope no more than{" "}
            <Num>{MAX_SLOPE_DEG}°</Num> and roughness no more than <Num>{ROCK_NO_GO}</Num>. Only{" "}
            <Num>{N.noGoLength.value}</Num> of <Num>{V.pathMetres.value}</Num> falls on a no-go cell, and{" "}
            <Num>{V.waypointsPassable.value}</Num> waypoints are on walkable cells.
          </p>
          <p>
            The honest caveat: <Num>{N.sitePassable.value}</Num> of the whole site is passable anyway, so even a random
            path would score in the high nineties. This number mainly shows that we do not wrongly block ground that
            is known to be drivable. It does not show that everything we call passable really is.
          </p>
          <figure>
            <img
              src={`${import.meta.env.BASE_URL}images/validation_path_vs_site.png`}
              width={1144}
              height={484}
              alt={`Four pairs of bars comparing the ground under the rover's path with the whole site. Median slope ${V.slopeMedianPath.value} against ${V.slopeMedianSite.value}; soft sand ${V.sandPath.value} against ${V.sandSite.value}; walking difficulty ${V.difficultyPath.value} against ${V.difficultySite.value} times flat firm ground; median roughness is also lower on the path.`}
              loading="lazy"
            />
            <figcaption>
              The more telling comparison: the rover stayed on gentler, smoother and firmer ground than the site as a
              whole (median slope <Num>{V.slopeMedianPath.value}</Num> against <Num>{V.slopeMedianSite.value}</Num>,
              soft sand <Num>{V.sandPath.value}</Num> against <Num>{V.sandSite.value}</Num>, walking difficulty{" "}
              <Num>{V.difficultyPath.value}</Num> against <Num>{V.difficultySite.value}</Num> times flat firm ground).
              Path: NASA/JPL-Caltech (Mars 2020 traverse). Terrain: ARES, from NASA orbital data.
            </figcaption>
          </figure>

          <h3>c. What does {N.tiltCorrelation.value} measure?</h3>
          <p>
            At the end of each drive the rover reports its own tilt, measured on the ground by a different instrument
            from anything we used. <Num>{N.tiltCorrelation.value}</Num> is the correlation between that tilt and our
            slope layer over the <Num>{N.waypoints.value}</Num>. A value near 1 means the two rise and fall together:
            where the rover found steeper ground, our map is steeper too.
          </p>
          <p>
            Correlation does not mean the two values are equal. Ours runs higher (middle value{" "}
            <Num>{V.ourSlopeMedian.value}</Num> against the rover's <Num>{V.tiltMedian.value}</Num>, and at least as
            high at <Num>{V.slopeAtLeastTilt.value}</Num> of waypoints), as it should: it describes the steepest part
            of a 25 m cell, while the tilt is measured over the rover's own length. It also says nothing about ground
            the rover never visited.
          </p>
          <figure>
            <img
              src={`${import.meta.env.BASE_URL}images/validation_slope_vs_tilt.png`}
              width={836}
              height={616}
              alt={`Scatter plot of ${N.waypoints.value}: the tilt the rover measured on the horizontal axis and the ARES slope of the cell under it on the vertical axis. The points follow a rising best-fit line, with most of them on or above the line of equal values; ${N.tiltCorrelation.value}.`}
              loading="lazy"
            />
            <figcaption>
              One dot for each waypoint. The summary file stores only the correlation, so the dots are computed the
              same way the validation script does it: NASA's waypoint positions and tilts, and our slope in the cell
              under each. Waypoints and tilt: NASA/JPL-Caltech (Mars 2020). Slope: ARES, from HiRISE elevation
              (NASA/JPL-Caltech/University of Arizona/USGS).
            </figcaption>
          </figure>

          <h3>d. The one failure</h3>
          <p>
            The rover crossed one cell that ARES marks no-go: Skinner Ridge on the delta front,{" "}
            <Num>{N.noGoPlace.value}</Num>. There, <Num>{N.noGoLength.value}</Num> of path lies where our slope is{" "}
            <Num>{N.noGoSlope.value}</Num>, over the <Num>{MAX_SLOPE_DEG}°</Num> limit by{" "}
            <Num>{V.overLimitBy.value}</Num> (roughness <Num>{V.noGoRock.value}</Num>, well inside its limit).
          </p>
          <p>
            Our slope for a cell is the 90th percentile of the slopes inside it, so one steep ledge can push a whole 25
            m cell just over the limit while the rover works on the gentler part. This is the careful side to be wrong
            on: ARES would send an astronaut around it.
          </p>

          <h3>e. Sensitivity: does the answer depend on our limits?</h3>
          <p>
            We moved the two limits and repeated the check. The slope limit changes the result by about half a
            percentage point. The roughness limit changes nothing between <Num>{V.rockLimitLow.value}</Num> and{" "}
            <Num>{V.rockLimitHigh.value}</Num>, because the rover never crossed a cell rougher than{" "}
            <Num>{V.roughestCrossed.value}</Num>. So this check supports our slope limit, and cannot tell us whether
            our roughness limit is right.
          </p>
          <table>
            <thead>
              <tr>
                <th scope="col">Slope limit</th>
                <th scope="col">Rover path passable</th>
                <th scope="col">Whole site passable</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">20°</th>
                <td>
                  <Num>{V.slope20Path.value}</Num>
                </td>
                <td>
                  <Num>{V.slope20Site.value}</Num>
                </td>
              </tr>
              <tr>
                <th scope="row">{MAX_SLOPE_DEG}° (ours)</th>
                <td>
                  <Num>{V.slope25Path.value}</Num>
                </td>
                <td>
                  <Num>{V.slope25Site.value}</Num>
                </td>
              </tr>
              <tr>
                <th scope="row">30°</th>
                <td>
                  <Num>{V.slope30Path.value}</Num>
                </td>
                <td>
                  <Num>{V.slope30Site.value}</Num>
                </td>
              </tr>
            </tbody>
          </table>

          <h3>f. Limits of this validation</h3>
          <ul>
            <li>
              <strong>A rover is not an astronaut.</strong> Wheels and legs fail on different ground, and a rover does
              not tire or run out of oxygen. This checks the map, not walking speeds or oxygen use.
            </li>
            <li>
              <strong>The path is biased toward safe ground.</strong> Rover drivers pick gentle routes on purpose,
              using the same orbital imagery, so a hazard check is one they are likely to pass.
            </li>
            <li>
              <strong>It tests one direction only.</strong> It shows we do not block good ground. It cannot show that
              all the ground we call passable really is.
            </li>
            <li>
              <strong>It covers only where the rover went:</strong> the crater floor near the landing site, the delta
              front and one route up the delta. The south and east of the site are untested.
            </li>
            <li>
              <strong>It says nothing about</strong> our roughness limit, our soft-sand threshold, walking speeds or
              oxygen use. Those remain assumptions.
            </li>
            <li>
              <strong>One site, on a 25 m grid.</strong> Anything smaller than a cell is averaged into it, and no other
              site has been checked.
            </li>
          </ul>
        </section>

        <section id={ml.id}>
          <h2 tabIndex={-1}>5. {ml.title}</h2>
          <p>
            Short answer: no. We tried, tested it fairly, and the plain physics model was already as close to expert
            routes as the learned one. The full write-up is in the repository (<Num>docs/route-learning.md</Num>).
          </p>

          <h3>a. The question</h3>
          <p>
            NASA's rover drivers chose every route Perseverance drove. Can a model that learns from those routes pick
            routes closer to theirs than our physics model, which only knows how slow each kind of ground is to walk
            on?
          </p>

          <h3>b. What it learned from</h3>
          <p>
            <Num>{M.routes.value} routes</Num>, <Num>{M.km.value}</Num> in all, cut from the rover's real path inside
            our site (sols <Num>{M.firstSol.value}</Num> to <Num>{M.lastSol.value}</Num>), each about{" "}
            <Num>{M.routeLength.value}</Num> long. We dropped <Num>{M.dropped.value}</Num> more routes that wander:
            their straight-line length is under <Num>{M.straightness.value}</Num> of the path driven. Those are
            usually science work around an outcrop, not travel, so they teach nothing about choosing a route.
          </p>

          <h3>c. How it learns</h3>
          <p>
            It starts as our physics model. For each rover route it plans its own route between the same two ends and
            compares the two. Where they differ, it nudges how much it dislikes each kind of ground (steeper slopes,
            roughness, soft sand, loose ground, ground next to no-go areas: <Num>{M.features.value}</Num> measures in
            all) so the drivers' route looks a little better and its own a little worse. It repeats this{" "}
            <Num>{M.steps.value}</Num> times. The method is called maximum margin planning (Ratliff, Bagnell and
            Zinkevich 2006,{" "}
            <a href="https://doi.org/10.1145/1143844.1143936" target="_blank" rel="noreferrer">
              doi:10.1145/1143844.1143936
            </a>
            ).
          </p>

          <h3>d. How we tested it fairly</h3>
          <p>
            A model can look good by memorising its examples, so it is only scored on routes it never saw
            (<Num>{N.learnRoutes.value}</Num>). We split the
            routes into five blocks in driving order and scored each block with a model trained on the other four
            (blocked {M.folds.value} cross-validation). The score is the mean distance between the planned route and
            the drivers' route, in meters: lower is closer.
          </p>

          <h3>e. The result</h3>
          <p>
            Physics against a straight line: the physics routes are on average <Num>{M.physicsMean.value}</Num> from
            the drivers' routes, against <Num>{M.straightMean.value}</Num> for a straight line. That is{" "}
            <Num>{M.gain.value}</Num> closer (95% interval <Num>{M.gainLow.value}</Num> to{" "}
            <Num>{M.gainHigh.value}</Num>): closer on <Num>{M.closer.value}</Num> routes, further on{" "}
            <Num>{M.further.value}</Num>, the same on <Num>{M.same.value}</Num> (within{" "}
            <Num>{M.sameThreshold.value}</Num>).
          </p>
          <p>
            Learned against physics: the learned model chose the same route as the physics model on{" "}
            <Num>{N.learnSameRoute.value}</Num>, a gain of <Num>{M.learnedGain.value}</Num>.
          </p>
          <figure>
            <img
              src={`${import.meta.env.BASE_URL}images/ml_routes_dumbbell.png`}
              width={1144}
              height={1011}
              alt="One row for each of the 31 held-out rover routes, sorted. Each row has a grey dot for the straight line, a white dot for the ARES physics model and a blue ring for the learned model, joined by a line. On every row the blue ring sits exactly on the white dot. On most rows the grey dot is further to the right, meaning further from the drivers' route."
              loading="lazy"
            />
            <figcaption>
              Every held-out route, one row each. The blue ring (learned) sits on the white dot (physics) every time.
              Rover routes: NASA/JPL-Caltech (Mars 2020 traverse).
            </figcaption>
          </figure>
          <figure>
            <img
              src={`${import.meta.env.BASE_URL}images/ml_win_tie_loss.png`}
              width={1144}
              height={429}
              alt={`Two stacked bars. ARES physics against a straight line: closer on ${M.closer.value} routes, the same on ${M.same.value}, further on ${M.further.value}. Learned model against ARES physics: the same on all ${M.learnedSame.value}.`}
              loading="lazy"
            />
            <figcaption>
              The same result as counts of routes. Rover routes: NASA/JPL-Caltech (Mars 2020 traverse).
            </figcaption>
          </figure>
          <figure>
            <img
              src={`${import.meta.env.BASE_URL}images/route_learning.jpg`}
              width={1400}
              height={720}
              alt="Left: the Jezero site with Perseverance's real routes in white and the ARES physics routes in orange, lying almost on top of each other. Right: a bar chart of the mean distance from the rover's real route, with the straight line highest and the ARES physics and learned models equal."
              loading="lazy"
            />
            <figcaption>
              Perseverance's real routes and the ARES routes between the same end points, and how close each planner
              gets. Routes: NASA/JPL-Caltech (Mars 2020 traverse). Basemap: NASA/JPL-Caltech/University of Arizona/USGS
              (HiRISE).
            </figcaption>
          </figure>

          <h3>f. What that means</h3>
          <p>
            In every one of the five test rounds, the best model was the physics model itself: nothing learned got
            closer to the drivers on the training routes, so nothing learned was kept. We also trained a version
            without our safety rule (the rule says a learned model may be more careful than physics, never less).
            Left to run to the end, it drifted towards less caution and its routes got worse:{" "}
            <Num>{M.noRuleEnd.value}</Num> from the drivers' routes against <Num>{M.physicsTraining.value}</Num> for
            physics, on the routes it trained on.
          </p>
          <p>
            So the planner stays deterministic, and the machine learning serves as an independent check on it: a
            method that only sees what expert drivers did ends up agreeing with the terrain rules.
          </p>
          <figure>
            <img
              src={`${import.meta.env.BASE_URL}images/ml_dislike_factors.png`}
              width={1144}
              height={528}
              alt={`Pairs of bars for six kinds of ground: slope above 8 degrees, slope above 15 degrees, roughness, soft sand, loose ground and ground near no-go areas. Every bar of the model with the safety rule is at 1.00, the physics model. The bars of the model with no rule are at or below 1.00; the lowest is roughness at ${M.noRuleRoughness.value}.`}
              loading="lazy"
            />
            <figcaption>
              How much each model had learned to dislike each kind of ground when training ended (1.00 = the physics
              model). With the safety rule nothing moved. With no rule every factor slid to or below 1.00 (roughness to{" "}
              <Num>{M.noRuleRoughness.value}</Num>), which means less careful, and the match got worse. The model we
              kept fell back to physics, so the planner uses a factor of 1.00 everywhere. Rover routes:
              NASA/JPL-Caltech (Mars 2020 traverse).
            </figcaption>
          </figure>

          <h3>g. Limits</h3>
          <ul>
            <li>
              <strong>Rover drivers are not astronauts.</strong> They plan for a six-wheeled rover, with its own tilt
              limits, cameras and radio schedule. "Close to the rover's route" stands in for "a good walking route";
              it does not prove it.
            </li>
            <li>
              <strong>A 25 m grid.</strong> Two routes cannot differ by much less than one cell, and the physics model
              is already about one cell from the drivers. A better model might not be able to show it here.
            </li>
            <li>
              <strong>A small sample.</strong> <Num>{M.routes.value} routes</Num> from one rover's single path, and
              neighbouring routes are not independent, so the 95% interval is somewhat too narrow.
            </li>
            <li>
              <strong>It says nothing about oxygen or safety numbers.</strong> Those always come from the walking
              model, whichever route is chosen.
            </li>
          </ul>
        </section>

        <section id={uncertainty.id}>
          <h2 tabIndex={-1}>6. {uncertainty.title}</h2>
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
          <h2 tabIndex={-1}>7. {emergencies.title}</h2>
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
          <h2 tabIndex={-1}>8. {evidence.title}</h2>
          <p>
            Not every number in ARES deserves the same trust, so each one carries one of four labels. The numbers
            about the human body and the suit, such as walking speed, oxygen use and the reserve, are{" "}
            <strong>ASSUMED</strong>: they are our reasoned estimates, not measurements from astronauts or suit tests.
          </p>
          <p>In the Plan tab, in the Mission tools row: {WHAT_IF_INVITE}</p>
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
          <h2 tabIndex={-1}>9. {related.title}</h2>
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
