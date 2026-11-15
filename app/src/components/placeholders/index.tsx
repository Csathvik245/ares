// Integration I3: replace these exports with app/src/design components when they land.
export { HelmetHud as Hud } from "../HelmetHud";
export { MissionBriefing as OpeningScreen } from "../MissionBriefing";
import { useState } from "react";
import { publicAssetUrl } from "../../lib/assets";
import { Dialog } from "../Dialog";
import { formatMinutes, WORK_BURN } from "../../lib/planner";
import { useMission } from "../../lib/MissionContext";
import { photoCreditFor } from "../../lib/photoCredits";
import { clock } from "../../lib/presentation";
import type { DemoStop } from "../../lib/MissionContext";
export function StopCard({
  stop,
  onClose,
}: {
  stop: DemoStop;
  onClose: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const m = useMission(),
    b = m.site?.bounds;
  const arrival =
    m.plan?.legs[m.stops.findIndex((s) => s.id === stop.id)]?.arriveSec;
  const metadata = photoCreditFor(stop.photo);
  const photoUrl = publicAssetUrl(stop.photo);
  return (
    <Dialog title={stop.label} onClose={onClose}>
      <h2>{stop.label}</h2>
      {photoUrl && !failed ? (
        <figure>
          <img
            src={photoUrl}
            alt="Perseverance at this sampling site"
            onError={() => setFailed(true)}
          />
          <figcaption>
            {metadata ? "NASA/JPL-Caltech" : stop.photoCredit ?? "NASA/JPL-Caltech"}
            {metadata && (
              <>
                {" "}
                · {metadata.camera} · sol {metadata.sol}
                <br />
                <a
                  href={metadata.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  NASA original image
                </a>
              </>
            )}
          </figcaption>
        </figure>
      ) : (
        <figure>
          {m.basemap && b && (
            <div
              role="img"
              aria-label={`HiRISE orbital context at ${stop.label}`}
              className="orbital-crop"
              style={{
                backgroundImage: `url("${m.basemap.url}")`,
                backgroundPosition: `${(100 * (stop.lng - b.west)) / (b.east - b.west)}% ${(100 * (b.north - stop.lat)) / (b.north - b.south)}%`,
              }}
            />
          )}
          <figcaption>
            {stop.id === "delta-toe"
              ? "Orbital view, no rover visit"
              : "Orbital context · rover photo pending"}{" "}
            · {m.basemap?.credit ?? "Imagery pending"}
          </figcaption>
        </figure>
      )}
      <p>
        Arrival T+{arrival === undefined ? "—" : clock(arrival)} · calculated
      </p>
      <p>{stop.why ?? "Science description pending."}</p>
      <p>
        Science time: {stop.dwellMin} min · Oxygen cost:{" "}
        {formatMinutes(stop.dwellMin * 60 * WORK_BURN)} nominal (work-burn model)
      </p>
      <p>Tools: {stop.tools?.join(", ") ?? "Awaiting science checklist"}</p>
    </Dialog>
  );
}
