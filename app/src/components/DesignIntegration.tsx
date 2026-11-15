import { lazy, Suspense, type ComponentType } from "react";
import {
  Hud as FallbackHud,
  OpeningScreen as FallbackOpening,
  StopCard as FallbackStop,
} from "./placeholders";
import type { HelmetHudProps } from "./HelmetHud";
import type { MissionBriefingProps } from "./MissionBriefing";
import type { DemoStop } from "../lib/MissionContext";
import { photoCreditFor } from "../lib/photoCredits";
import { WORK_BURN } from "../lib/planner";
import { publicAssetUrl } from "../lib/assets";
import { Dialog } from "./Dialog";

// I3: discover only actual design modules. No fabricated replacement assets.
const modules = import.meta.glob("../design/{Hud,OpeningScreen,StopCard}.tsx");
function design<P>(name: string) {
  const load = modules[`../design/${name}.tsx`];
  return load
    ? lazy(async () => {
        const exports = (await load()) as Record<string, ComponentType<P>>;
        const component = exports[name] ?? exports.default;
        if (!component)
          throw new Error(`Design ${name} must export ${name} or default`);
        return { default: component };
      })
    : null;
}
type HudDesignProps = {
  nextStop: string;
  distanceM: number;
  headingDeg: number;
  oxygenPct: number;
  marginMin: number;
  doseMsv: number;
  lmst: string;
  status: HelmetHudProps["status"];
  tempC: number;
};
const DesignHud = design<HudDesignProps>("Hud");
const DesignOpening = design<MissionBriefingProps>("OpeningScreen");
type StopDesignProps = {
  stop: DemoStop;
  photoUrl?: string;
  photoCredit?: string;
  why?: string;
  dwellMin: number;
  tools: string[];
  oxygenCostMin: number;
};
const DesignStop = design<StopDesignProps>("StopCard");
export const designAvailability = {
  hud: !!DesignHud,
  opening: !!DesignOpening,
  stop: !!DesignStop,
};
export function Hud(props: HelmetHudProps) {
  if (!DesignHud) return <FallbackHud {...props} />;
  return (
    <Suspense fallback={<FallbackHud {...props} />}>
      <DesignHud
        nextStop={props.nextStop}
        distanceM={props.distanceM}
        headingDeg={props.headingDeg}
        oxygenPct={Math.max(
          0,
          Math.min(
            100,
            (props.oxygenRemainingMin / (props.oxygenCapacityMin ?? 480)) * 100,
          ),
        )}
        marginMin={props.marginMin}
        doseMsv={props.doseMsv}
        lmst={props.localTime}
        status={props.status}
        tempC={props.temperatureC}
      />
      {props.onExitHud && (
        <button className="design-exit" onClick={props.onExitHud}>
          Exit HUD
        </button>
      )}
    </Suspense>
  );
}
export function OpeningScreen(props: MissionBriefingProps) {
  return DesignOpening ? (
    <Suspense fallback={<FallbackOpening {...props} />}>
      <DesignOpening {...props} />
    </Suspense>
  ) : (
    <FallbackOpening {...props} />
  );
}
export function StopCard({
  stop,
  onClose,
}: {
  stop: DemoStop;
  onClose: () => void;
}) {
  return DesignStop ? (
    <Suspense fallback={<FallbackStop stop={stop} onClose={onClose} />}>
      <Dialog title={stop.label} onClose={onClose}>
        <DesignStop
          stop={stop}
          photoUrl={publicAssetUrl(stop.photo)}
          photoCredit={photoCreditFor(stop.photo) ? `NASA/JPL-Caltech · ${photoCreditFor(stop.photo)!.camera} · sol ${photoCreditFor(stop.photo)!.sol}` : stop.photoCredit}
          why={stop.why}
          dwellMin={stop.dwellMin}
          tools={stop.tools ?? []}
          oxygenCostMin={stop.dwellMin * WORK_BURN}
        />
      </Dialog>
    </Suspense>
  ) : (
    <FallbackStop stop={stop} onClose={onClose} />
  );
}
