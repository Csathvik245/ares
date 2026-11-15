import { useEffect, useState } from "react";
import type { Bounds, Poi, Stop } from "../planner";
import { formatKm, formatMet, formatMinutes, roundHalfUp } from "../planner";
import { orbitalCrop } from "../lib/orbitalCrop";
import { photoCreditFor } from "../lib/photoCredits";
import "./plugins.css";

/** The part of the basemap the orbital view needs. MissionContext's `basemap` fits as is. */
export type StopCardBasemap = { url: string; bounds: Bounds; credit?: string };

export type StopCardProps = {
  stop: Stop;
  /** 0-based position in the plan (stop 01 = index 0). */
  index: number;
  /** The site.json POI this stop came from, if any. Supplies the note, photo and credit. */
  poi?: Poi;
  /** Seconds into the EVA when the astronaut arrives (plan.legs[index].arriveSec). */
  arriveSec: number;
  onClose?: () => void;
  /** Optional. If left out, the card reads /data/basemap.json itself when it needs the orbital view. */
  basemap?: StopCardBasemap | null;
  scienceScore?: { science: number; extraO2Min: number; score: number };
};

const BASE = import.meta.env.BASE_URL;
const ROVER_CREDIT = "NASA/JPL-Caltech";
const HIRISE_CREDIT = "NASA/JPL-Caltech/University of Arizona/USGS";

/** "T+1:42" from seconds. */
export function tPlus(sec: number): string {
  return formatMet(Math.max(0, sec));
}

/** Reads the basemap's file name, bounds and credit from /data/basemap.json. */
function useBasemap(given: StopCardBasemap | null | undefined, needed: boolean): StopCardBasemap | null {
  const [loaded, setLoaded] = useState<StopCardBasemap | null>(null);
  useEffect(() => {
    if (given || !needed) return;
    const control = new AbortController();
    fetch(`${BASE}data/basemap.json`, { signal: control.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const b = j?.bounds;
        if (typeof j?.file !== "string" || !b || !(b.north > b.south) || !(b.east > b.west)) return;
        setLoaded({
          url: `${BASE}data/${j.file}`,
          bounds: b,
          credit: typeof j.credit === "string" ? j.credit : undefined,
        });
      })
      .catch(() => undefined); // no basemap: the card says so instead of showing a picture
    return () => control.abort();
  }, [given, needed]);
  return given ?? loaded;
}

/**
 * Detail card for one science stop: number, name, why it matters, dwell and arrival
 * time, and the ground view. Stops Perseverance sampled show its photo. A stop no
 * rover has visited (the delta front toe) shows a HiRISE crop of the spot instead.
 */
export function StopCard({ stop, index, poi, arriveSec, onClose, basemap, scienceScore }: StopCardProps) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const photoUrl = poi?.photo && !photoFailed ? `${BASE}${poi.photo.replace(/^\//, "")}` : undefined;
  const credit = photoCreditFor(poi?.photo);
  const map = useBasemap(basemap, !photoUrl);
  const crop = map ? orbitalCrop(stop, map.bounds) : null;
  const number = String(index + 1).padStart(2, "0");
  const name = stop.label || poi?.name || `Stop ${number}`;
  const titleId = `stop-card-title-${stop.id}`;

  return (
    <article className="stop-card-plugin" aria-labelledby={titleId}>
      <header className="stop-card-plugin__header">
        <span className="stop-card-plugin__number" aria-hidden="true">
          {number}
        </span>
        <h2 id={titleId}>
          <span className="stop-card-plugin__sr">Stop {index + 1}: </span>
          {name}
        </h2>
        {onClose && (
          <button type="button" className="stop-card-plugin__close" onClick={onClose} aria-label={`Close ${name}`}>
            Close
          </button>
        )}
      </header>

      {photoUrl ? (
        <figure className="stop-card-plugin__view">
          <img
            src={photoUrl}
            alt="Perseverance at this sampling site"
            onError={() => setPhotoFailed(true)}
          />
          <figcaption>
            <span>Perseverance at this sampling site</span>
            <span>
              {poi?.photoCredit ?? ROVER_CREDIT}
              {credit && (
                <>
                  {" · "}
                  {credit.camera} · sol <span className="stop-card-plugin__num">{credit.sol}</span>
                </>
              )}
            </span>
          </figcaption>
        </figure>
      ) : (
        <figure className="stop-card-plugin__view">
          {crop && map ? (
            <div
              className="stop-card-plugin__orbital"
              role="img"
              aria-label={`HiRISE orbital image of the ground around ${name}, about ${formatKm(crop.widthM)} across. No rover has photographed this spot.`}
              style={{
                backgroundImage: `url("${map.url}")`,
                backgroundSize: crop.backgroundSize,
                backgroundPosition: crop.backgroundPosition,
              }}
            >
              <i
                className="stop-card-plugin__spot"
                aria-hidden="true"
                style={{ left: `${(crop.marker.x * 100).toFixed(2)}%`, top: `${(crop.marker.y * 100).toFixed(2)}%` }}
              />
            </div>
          ) : (
            <div className="stop-card-plugin__orbital stop-card-plugin__orbital--missing">Orbital image unavailable</div>
          )}
          <figcaption>
            <span>{poi?.photo ? "Rover photo unavailable · orbital view" : "No rover visit · orbital view"}</span>
            <span>
              HiRISE · {map?.credit ?? HIRISE_CREDIT}
              {crop && (
                <>
                  {" · about "}
                  <span className="stop-card-plugin__num">{formatKm(crop.widthM)}</span> across
                </>
              )}
            </span>
          </figcaption>
        </figure>
      )}

      <section className="stop-card-plugin__why">
        <h3>Why it matters</h3>
        <p>{poi?.note ?? "A stop chosen on the map. No science note is recorded for it."}</p>
      </section>

      <dl className="stop-card-plugin__facts">
        <div>
          <dt>Arrive</dt>
          <dd>{tPlus(arriveSec)}</dd>
        </div>
        <div>
          <dt>Science time</dt>
          <dd>{stop.dwellMin} min</dd>
        </div>
        {scienceScore && (
          <div>
            <dt>Science per oxygen-minute</dt>
            <dd>{roundHalfUp(scienceScore.score, 3).toFixed(3)} · value {roundHalfUp(scienceScore.science, 2)} · {formatMinutes(scienceScore.extraO2Min * 60)} O₂</dd>
          </div>
        )}
      </dl>
    </article>
  );
}

export default StopCard;
