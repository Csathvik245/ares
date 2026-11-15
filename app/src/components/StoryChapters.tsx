// The second half of the Story page: four chapters that show the plan, the check against
// reality, the storm and the simulation, then the closing line with the two buttons.
// MissionBriefing renders it once, after its own story.
//
// Every number comes from the planner at run time (lib/story.ts), except the two
// validation figures, which are copied from docs/demo-numbers.md through
// lib/scienceNumbers.ts (tests keep them equal to the documents).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatDuration, formatKm, formatMet, formatMinutes, formatPct, roundHalfUp } from "../planner";
import { SCIENCE_NUMBERS as N } from "../lib/scienceNumbers";
import { STORY_INCIDENT_SEC, computeStory, type StoryData } from "../lib/story";
import "../styles/story-chapters.css";

export type StoryChaptersProps = {
  /** "Run the demo". The button is left out when no handler is given. */
  onRunDemo?: () => void;
  /** "Open the planner". */
  onOpenPlanner?: () => void;
};

/** The existing story has beats 01 to 04, so these carry on from 05. */
export const STORY_CHAPTERS = [
  { n: "05", kicker: "THE PLAN", title: "A science walk, planned around the terrain." },
  { n: "06", kicker: "CHECKED AGAINST REALITY", title: "Perseverance drove it. Our map agreed." },
  { n: "07", kicker: "WHEN THINGS GO WRONG", title: `A dust storm at ${formatMet(STORY_INCIDENT_SEC)}.` },
  { n: "08", kicker: "A THOUSAND FUTURES", title: "The simulation shows why." },
] as const;
export const STORY_CLOSING = "ARES doesn't just tell astronauts where to walk. It tells them whether they'll make it back.";
export const SIMULATION_SMALL_PRINT = "Model-based simulation of our assumptions, not an empirical probability.";
const HIRISE_CREDIT = "NASA/JPL-Caltech/University of Arizona/USGS";
const WAITING = "Working it out on the real terrain…";

/** One decimal, half up, so a share just under 100% is not shown as 100%. */
const pct1 = (fraction: number) => `${roundHalfUp(fraction * 100, 1).toFixed(1)}%`;
const points = (list: { x: number; y: number }[]) => list.map((p) => `${roundHalfUp(p.x, 1)},${roundHalfUp(p.y, 1)}`).join(" ");

function Chapter({ index, title, children, visual }: { index: number; title?: string; children: ReactNode; visual: ReactNode }) {
  const c = STORY_CHAPTERS[index];
  return (
    <section className="story-chapter" id={`story-chapter-${c.n}`} aria-labelledby={`story-chapter-${c.n}-title`} data-reveal>
      <div className="story-chapter__text">
        <p className="story-kicker">
          {c.n} / {c.kicker}
        </p>
        <h2 id={`story-chapter-${c.n}-title`}>{title ?? c.title}</h2>
        {children}
      </div>
      <div className="story-chapter__visual">{visual}</div>
    </section>
  );
}

const Pending = () => (
  <div className="story-pending" role="status">
    {WAITING}
  </div>
);

/** Big mono figures with a short label under each. */
function Figures({ items }: { items: { value: string; label: string; tone?: string }[] }) {
  return (
    <dl className="story-figures">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd className={item.tone ? `story-ink-${item.tone}` : undefined}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A: the real route on the HiRISE picture. The line draws itself when the chapter scrolls into view. */
function RouteMap({ data }: { data: StoryData }) {
  const v = data.routeView;
  // The picture is shown through a window (the frame around the route). Sizes in % of that window.
  const scale = v.width / 100;
  const mark = v.width * 0.021; // marker radius: about 13 px when the map is 620 px wide
  return (
    <figure className="story-map">
      <div className="story-map__frame" style={{ aspectRatio: `${roundHalfUp(v.width, 1)} / ${roundHalfUp(v.height, 1)}` }}>
        <img
          src={`${import.meta.env.BASE_URL}data/basemap.png`}
          alt="HiRISE image of the Jezero delta front, seen from orbit, around the habitat and the three science stops."
          loading="lazy"
          decoding="async"
          style={{
            width: `${(data.image.width / v.width) * 100}%`,
            left: `${-(v.x / scale)}%`,
            top: `${-(v.y / v.height) * 100}%`,
          }}
        />
        <svg viewBox={`${roundHalfUp(v.x, 1)} ${roundHalfUp(v.y, 1)} ${roundHalfUp(v.width, 1)} ${roundHalfUp(v.height, 1)}`} role="img" aria-label="The planned route: habitat, stops 01, 02 and 03, and back.">
          {data.routeLegs.map((leg, i) => (
            <g key={i}>
              <polyline className="story-map__route-edge" points={points(leg)} pathLength={1} style={{ transitionDelay: `${i * 450}ms`, strokeWidth: mark * 0.5 }} />
              <polyline className="story-map__route" points={points(leg)} pathLength={1} style={{ transitionDelay: `${i * 450}ms`, strokeWidth: mark * 0.24 }} />
            </g>
          ))}
          <g className="story-map__habitat">
            <rect x={data.habitatMark.x - mark} y={data.habitatMark.y - mark} width={mark * 2} height={mark * 2} style={{ strokeWidth: mark * 0.16 }} />
            <text x={data.habitatMark.x - mark * 1.9} y={data.habitatMark.y + mark * 0.36} fontSize={mark * 0.95} textAnchor="end">
              HAB-1
            </text>
          </g>
          {data.stopMarks.map((s) => (
            <g key={s.number} className="story-map__stop">
              <circle cx={s.x} cy={s.y} r={mark} style={{ strokeWidth: mark * 0.16 }} />
              <text className="story-map__number" x={s.x} y={s.y + mark * 0.36} fontSize={mark * 0.95} textAnchor="middle">
                {s.number}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <figcaption className="story-credit">
        Route from the ARES planner, drawn on the HiRISE image. Image: {HIRISE_CREDIT}
      </figcaption>
    </figure>
  );
}

/** C: the planned EVA in grey, the storm in red, the walk home in the accent colour. */
function StormTimeline({ data }: { data: StoryData }) {
  const total = data.plan.totalSec;
  const at = data.storm.atSec;
  const x = (sec: number) => roundHalfUp((sec / total) * 1000, 1);
  const pctOf = (sec: number) => `${roundHalfUp((sec / total) * 100, 2)}%`;
  // A stretch the storm cuts in two is drawn as its done part and its cancelled part.
  const pieces = data.timeline.flatMap((s) =>
    s.fromSec < at && s.toSec > at
      ? [
          { ...s, toSec: at, cancelled: false },
          { ...s, fromSec: at, cancelled: true },
        ]
      : [{ ...s, cancelled: s.fromSec >= at }],
  );
  return (
    <figure className="story-timeline">
      <div className="story-timeline__labels" aria-hidden="true">
        <span className="story-ink-nogo" style={{ left: pctOf(at) }}>
          STORM {formatMet(at)}
        </span>
      </div>
      <svg viewBox="0 0 1000 64" preserveAspectRatio="none" role="img" aria-label={`Timeline of the walk. Dust storm at ${formatMet(at)}; the walk home ends at ${formatMet(data.storm.arriveSec)}.`}>
        {pieces.map((s, i) => (
          <rect
            key={i}
            className={`story-timeline__${s.kind}${s.cancelled ? " is-cancelled" : ""}`}
            x={x(s.fromSec)}
            y={8}
            width={Math.max(0, x(s.toSec) - x(s.fromSec) - 2)}
            height={16}
          />
        ))}
        <rect className="story-timeline__return" x={x(at)} y={38} width={x(data.storm.arriveSec) - x(at)} height={16} />
        <line className="story-timeline__storm" x1={x(at)} x2={x(at)} y1={0} y2={64} />
      </svg>
      <div className="story-timeline__labels story-timeline__labels--below" aria-hidden="true">
        <span className="story-ink-safe" style={{ left: pctOf(at) }}>
          WALK HOME {formatMinutes(data.storm.walkHomeSec)}
        </span>
      </div>
      <p className="story-timeline__end">
        Home: <b>{formatPct(data.storm.oxygenOnArrivalPct)} oxygen</b> at {formatMet(data.storm.arriveSec)}
      </p>
      <ul className="story-legend">
        <li>
          <i className="story-swatch story-swatch--walk" /> Planned walking
        </li>
        <li>
          <i className="story-swatch story-swatch--science" /> Planned science
        </li>
        <li>
          <i className="story-swatch story-swatch--cancelled" /> Cancelled
        </li>
        <li>
          <i className="story-swatch story-swatch--return" /> Re-planned walk home
        </li>
      </ul>
    </figure>
  );
}

/** D: how the oxygen margin came out across the simulated versions of the stretch mission. */
function MarginHistogram({ data }: { data: StoryData }) {
  const sim = data.stretch.sim;
  const { binStart, binWidth, counts } = sim.histogramMarginMin;
  const tallest = Math.max(1, ...counts);
  const W = 1000,
    H = 280,
    bar = W / counts.length;
  const end = binStart + binWidth * counts.length;
  // The reserve line is at a margin of zero: left of it, the walk ate into the reserve.
  const reserveX = ((0 - binStart) / (end - binStart)) * W;
  const reservePct = Math.min(100, Math.max(0, (reserveX / W) * 100));
  return (
    <figure className="story-histogram">
      <div className="story-histogram__plot">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Histogram of the oxygen margin in ${sim.trials.toLocaleString("en-US")} simulated walks. ${sim.failCount.toLocaleString("en-US")} of them end below the reserve.`}>
          {counts.map((count, k) => {
            const h = (count / tallest) * (H - 8);
            const below = binStart + (k + 1) * binWidth <= 0;
            return <rect key={k} className={`story-histogram__bar${below ? " is-below" : ""}`} x={k * bar + 1} y={H - h} width={Math.max(1, bar - 2)} height={h} />;
          })}
          {reserveX >= 0 && reserveX <= W && <line className="story-histogram__reserve" x1={reserveX} x2={reserveX} y1={0} y2={H} />}
        </svg>
        <span className="story-histogram__reserve-label" style={{ left: `${reservePct}%` }}>
          RESERVE
        </span>
      </div>
      <div className="story-histogram__axis" aria-hidden="true">
        <span>{formatMinutes(binStart * 60)}</span>
        <span>Oxygen margin at return</span>
        <span>{formatMinutes(end * 60)}</span>
      </div>
      <ul className="story-legend">
        <li>
          <i className="story-swatch story-swatch--below" /> Into the reserve: {sim.failCount.toLocaleString("en-US")} of {sim.trials.toLocaleString("en-US")}
        </li>
        <li>
          <i className="story-swatch story-swatch--bar" /> Home with the reserve intact
        </li>
      </ul>
    </figure>
  );
}

/** E: the closing line and the two buttons. */
export function StoryClosing({ onRunDemo, onOpenPlanner }: StoryChaptersProps) {
  return (
    <section className="story-closing" aria-labelledby="story-closing-title" data-reveal>
      <h2 id="story-closing-title">{STORY_CLOSING}</h2>
      <div className="story-closing__actions">
        {onRunDemo && (
          <button type="button" className="story-button story-button--primary" onClick={onRunDemo}>
            Run the demo
          </button>
        )}
        {onOpenPlanner && (
          <button type="button" className="story-button" onClick={onOpenPlanner}>
            Open the planner
          </button>
        )}
      </div>
    </section>
  );
}

/** The chapters for a given story. `data` is null until the planner has run; headlines show at once. */
export function StoryChaptersView({ data, onRunDemo, onOpenPlanner }: StoryChaptersProps & { data: StoryData | null }) {
  const stretch = data?.stretch;
  return (
    <div className="story-chapters">
      <Chapter index={0} visual={data ? <RouteMap data={data} /> : <Pending />}>
        <p className="story-body">
          Three science stops and the way back, routed around steep slopes, soft sand and rough ground on the real terrain.
        </p>
        {data && (
          <Figures
            items={[
              { label: "Distance", value: formatKm(data.plan.distM) },
              { label: "Duration", value: formatDuration(data.plan.totalSec) },
              { label: `Status · ${formatMinutes(data.plan.marginSec)} of oxygen margin`, value: data.plan.status, tone: data.plan.status },
            ]}
          />
        )}
      </Chapter>

      <Chapter
        index={1}
        visual={
          <figure className="story-photo">
            <img
              src={`${import.meta.env.BASE_URL}images/validation_traverse.jpg`}
              alt="Map of the Jezero site with Perseverance's real drive path drawn over the HiRISE image; the cells ARES rates as no-go are shaded."
              loading="lazy"
              decoding="async"
            />
            <figcaption className="story-credit">
              Perseverance's path over the ARES terrain model. Image: {HIRISE_CREDIT} (HiRISE). Path: NASA/JPL-Caltech (Mars 2020 traverse).
            </figcaption>
          </figure>
        }
      >
        <p className="story-body">
          We laid the rover's real {N.roverPath.value} drive over our terrain model. A rover is not a person on foot, so this checks the map, not the walking speeds.
        </p>
        <Figures
          items={[
            { label: "of the rover's path is ground ARES rates passable", value: N.roverPassable.value },
            { label: `rover tilt against our slope layer, ${N.waypoints.value}`, value: N.tiltCorrelation.value },
          ]}
        />
        <p className="story-small">For comparison, {N.sitePassable.value} of the whole site is passable, so the first figure alone would not prove much. The tilt match is the stronger check.</p>
      </Chapter>

      <Chapter index={2} visual={data ? <StormTimeline data={data} /> : <Pending />}>
        <p className="story-body">
          The EVA is aborted at once. ARES re-plans the walk home from where she stands, through the storm, and says whether the oxygen lasts.
        </p>
        {data && (
          <Figures
            items={[
              { label: "EVA", value: data.storm.evaStatus, tone: data.storm.evaStatus },
              { label: `Return home · ${formatMinutes(data.storm.marginSec)} above the reserve`, value: data.storm.returnStatus, tone: data.storm.returnStatus },
            ]}
          />
        )}
      </Chapter>

      <Chapter
        index={3}
        title={stretch ? `The plan says ${stretch.plan.status}. ${STORY_CHAPTERS[3].title}` : STORY_CHAPTERS[3].title}
        visual={data ? <MarginHistogram data={data} /> : <Pending />}
      >
        <p className="story-body">
          A longer mission, with a fourth stop and a long sampling session. ARES walks it {stretch ? stretch.sim.trials.toLocaleString("en-US") : "many"} times, each with slightly different speeds and oxygen use.
        </p>
        {stretch && (
          <Figures
            items={[
              { label: "home with the reserve intact", value: pct1(stretch.sim.pReturnWithReserve) },
              { label: "home at all", value: pct1(stretch.sim.pReturnAtAll) },
            ]}
          />
        )}
        {stretch && (
          <p className="story-small">
            The plan itself has {formatMinutes(stretch.plan.marginSec)} of margin. {SIMULATION_SMALL_PRINT}
          </p>
        )}
        {!stretch && <p className="story-small">{SIMULATION_SMALL_PRINT}</p>}
      </Chapter>

      <StoryClosing onRunDemo={onRunDemo} onOpenPlanner={onOpenPlanner} />
    </div>
  );
}

// The planner runs once per visit, however often the Story tab is opened.
let storyOnce: Promise<StoryData> | null = null;
function loadStory(): Promise<StoryData> {
  storyOnce ??= (async () => {
    const base = import.meta.env.BASE_URL;
    const [site, basemap] = await Promise.all([
      fetch(`${base}data/site.json`).then((r) => r.json()),
      fetch(`${base}data/basemap.json`).then((r) => r.json()),
    ]);
    // Let the page paint before the heavy work starts.
    await new Promise((done) => setTimeout(done, 60));
    return computeStory(site, { width: basemap.width, height: basemap.height }, basemap.bounds);
  })();
  storyOnce.catch(() => (storyOnce = null));
  return storyOnce;
}

export function StoryChapters(props: StoryChaptersProps) {
  const [data, setData] = useState<StoryData | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    loadStory().then(
      (story) => live && setData(story),
      () => {}, // the headlines and the text stay; only the computed visuals are missing
    );
    return () => {
      live = false;
    };
  }, []);

  // Chapters fade in as they scroll into view. Without IntersectionObserver, or when the
  // reader asked for less motion, everything is simply shown.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const targets = [...el.querySelectorAll<HTMLElement>("[data-reveal]")];
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (still || typeof IntersectionObserver === "undefined") {
      targets.forEach((t) => t.classList.add("is-in"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }),
      { threshold: 0.2 },
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={root} className="story-chapters-root">
      <StoryChaptersView data={data} {...props} />
    </div>
  );
}
export default StoryChapters;
