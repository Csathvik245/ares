// Numbers and shapes for the story chapters, worked out ONCE from the real site.json with
// the real planner. No React here, so tests can run it directly.
//
// Nothing in the chapters is typed in by hand: the demo plan, the storm, and the
// Monte Carlo run all come from the functions the app itself uses.
import {
  buildCostGrid,
  loadSite,
  planRoute,
  stormAt,
  type LatLng,
  type Plan,
  type Site,
  type Status,
  type Stop,
} from "../planner";
import { simulateMission, type ReliabilityResult } from "../planner/montecarlo";

/** EVA start of the demo mission, LMST hours (the app's default). */
export const STORY_START_LMST = 13;
/** Science time at each demo stop, minutes. */
export const STORY_DWELL_MIN = 30;
/** The demo emergency moment: T+1:16. */
export const STORY_INCIDENT_SEC = 76 * 60;
/**
 * The stretch mission, built exactly as in planner/demo-numbers.test.ts (section 7 of
 * docs/demo-numbers.md): the demo route plus Wildcat Ridge after the first stop, with a
 * long sampling session there, starting at 10:00 so the sun is never the issue.
 */
export const STRETCH_EXTRA_STOP_ID = "delta-wildcat-ridge";
export const STRETCH_DWELL_MIN = 120;
export const STRETCH_START_LMST = 10;
export const STORY_SEED = 42;

/** Size of the basemap picture the route is drawn on (any size with the right shape works). */
export type ImageSize = { width: number; height: number };
/** The map corners of a picture: where its edges are on Mars. */
export type MapBounds = { south: number; north: number; west: number; east: number };

export type StoryPoint = { x: number; y: number };

export type StoryStopMark = StoryPoint & { number: string; name: string };

export type TimelineSegment = { kind: "walk" | "science"; fromSec: number; toSec: number };

export type StoryData = {
  site: Site;
  /** The demo mission. */
  plan: Plan;
  stops: Stop[];
  /** The route as points on the basemap picture, one list per leg. */
  routeLegs: StoryPoint[][];
  habitatMark: StoryPoint;
  stopMarks: StoryStopMark[];
  /** The part of the picture that frames the route: x, y, width, height. */
  routeView: { x: number; y: number; width: number; height: number };
  image: ImageSize;
  /** Walking and science stretches of the demo EVA, in order. */
  timeline: TimelineSegment[];
  /** The dust storm at T+1:16: where the EVA stops and how the walk home goes. */
  storm: {
    atSec: number;
    evaStatus: Status;
    returnStatus: Status;
    walkHomeSec: number;
    arriveSec: number;
    marginSec: number;
    oxygenNowPct: number;
    oxygenOnArrivalPct: number;
  };
  /** The stretch mission and its Monte Carlo run. */
  stretch: { plan: Plan; stops: Stop[]; sim: ReliabilityResult };
};

/** A lat/lng as a point on a plain lat/lng picture (north up) with the given map corners. */
export function projectToImage(bounds: MapBounds, image: ImageSize, p: LatLng): StoryPoint {
  const { south, north, west, east } = bounds;
  return {
    x: ((p.lng - west) / (east - west)) * image.width,
    y: ((north - p.lat) / (north - south)) * image.height,
  };
}

/** The box around some points, padded and widened to a 3:2 frame, kept inside the picture. */
function frame(points: StoryPoint[], image: ImageSize): StoryData["routeView"] {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const pad = 0.16;
  let w = (Math.max(...xs) - Math.min(...xs)) * (1 + 2 * pad);
  let h = (Math.max(...ys) - Math.min(...ys)) * (1 + 2 * pad);
  const aspect = 3 / 2;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  w = Math.min(w, image.width);
  h = Math.min(h, image.height);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const x = Math.min(Math.max(0, cx - w / 2), image.width - w);
  const y = Math.min(Math.max(0, cy - h / 2), image.height - h);
  return { x, y, width: w, height: h };
}

/** Walking and science stretches of a plan, read from its own timeline. */
export function timelineOf(plan: Plan): TimelineSegment[] {
  const segments: TimelineSegment[] = [];
  plan.legs.forEach((leg, i) => {
    segments.push({ kind: "walk", fromSec: leg.arriveSec - leg.walkSec, toSec: leg.arriveSec });
    const next = plan.legs[i + 1];
    if (next) segments.push({ kind: "science", fromSec: leg.arriveSec, toSec: next.arriveSec - next.walkSec });
  });
  return segments;
}

/**
 * Everything the story chapters show, from the parsed site.json.
 * `image` is the basemap picture's size and `imageBounds` its map corners (from
 * basemap.json); without `imageBounds` the site's own bounds are used.
 * Takes a few tenths of a second; call it once, after the page is on screen.
 */
export function computeStory(rawSite: unknown, image: ImageSize, imageBounds?: MapBounds): StoryData {
  const site = loadSite(rawSite);
  const bounds = imageBounds ?? site.bounds;
  const calm = buildCostGrid(site, { storm: false, spe: false, startLmst: STORY_START_LMST });
  const toStop = (p: (typeof site.pois)[number], dwellMin: number): Stop => ({ id: p.id, label: p.name, lat: p.lat, lng: p.lng, dwellMin });

  // The demo mission: the first three science POIs (Contract 1), 30 min each.
  const demoPois = site.pois.filter((p) => p.kind === "science").slice(0, 3);
  const stops = demoPois.map((p) => toStop(p, STORY_DWELL_MIN));
  const plan = planRoute(site, calm, site.habitat, stops);

  const project = (p: LatLng) => projectToImage(bounds, image, p);
  const routeLegs = plan.legs.map((leg) => leg.path.map(project));
  const habitatMark = project(site.habitat);
  const stopMarks = stops.map((s, i) => ({ ...project(s), number: String(i + 1).padStart(2, "0"), name: s.label }));

  const o = stormAt(site, plan, STORY_INCIDENT_SEC, "dust", STORY_START_LMST);

  const extra = site.pois.find((p) => p.id === STRETCH_EXTRA_STOP_ID);
  const stretchStops = extra
    ? [toStop(demoPois[0], STORY_DWELL_MIN), toStop(extra, STRETCH_DWELL_MIN), ...demoPois.slice(1).map((p) => toStop(p, STORY_DWELL_MIN))]
    : stops;
  const stretchPlan = planRoute(site, buildCostGrid(site, { storm: false, spe: false, startLmst: STRETCH_START_LMST }), site.habitat, stretchStops);
  const sim = simulateMission(site, stretchPlan, { seed: STORY_SEED, startLmst: STRETCH_START_LMST });

  return {
    site,
    plan,
    stops,
    routeLegs,
    habitatMark,
    stopMarks,
    routeView: frame([habitatMark, ...routeLegs.flat()], image),
    image,
    timeline: timelineOf(plan),
    storm: {
      atSec: STORY_INCIDENT_SEC,
      evaStatus: o.evaStatus,
      returnStatus: o.abort.status,
      walkHomeSec: o.abort.sec,
      arriveSec: o.arriveSec,
      marginSec: o.abort.marginSec,
      oxygenNowPct: o.oxygenNowPct,
      oxygenOnArrivalPct: o.oxygenOnArrivalPct,
    },
    stretch: { plan: stretchPlan, stops: stretchStops, sim },
  };
}
