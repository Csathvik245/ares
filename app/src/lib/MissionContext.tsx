import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  loadSite,
  buildCostGrid,
  planRoute,
  safeZone,
  positionAt,
  abortRoute,
  envAt,
  homeField,
  type Site,
  type Conditions,
  type LatLng,
  SOL_HOURS,
} from "./planner";
import {
  optionalJson,
  readDemoStops,
  demoStopsFromSite,
  type DemoStop,
} from "./data";
import { returnPlaybackPlan } from "./return-playback";
import { readBasemap, type Basemap } from "./basemap";
import { publicAssetUrl } from "./assets";
export type { DemoStop } from "./data";

function useMissionState() {
  const [site, setSite] = useState<Site | null>(null),
    [fake, setFake] = useState(false),
    [error, setError] = useState("");
  const [basemap, setBasemap] = useState<Basemap | null>(null);
  const [stops, setStops] = useState<DemoStop[]>([]),
    [demo, setDemo] = useState<DemoStop[]>([]),
    [selected, setSelected] = useState("");
  const [conditions, setConditions] = useState<Conditions>({
    storm: false,
    spe: false,
    startLmst: 13,
  });
  const [returnElapsed, setReturnElapsed] = useState(0),
    [returnPlaying, setReturnPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0),
    [playing, setPlaying] = useState(false),
    [emergency, setEmergency] = useState<{
      kind: "storm" | "spe";
      from: LatLng;
      used: number;
      at: number;
    } | null>(null);
  useEffect(() => {
    const control = new AbortController();
    setError("");
    const optionalAsset = async (name: string) => {
      const url = publicAssetUrl(name);
      if (!url) return null;
      try {
        return await optionalJson(await fetch(url, { signal: control.signal }));
      } catch {
        return null;
      }
    };
    const load = async () => {
      const response = await fetch(
        `${import.meta.env.BASE_URL}data/site.json`,
        { signal: control.signal },
      );
      if (!response.ok) throw Error(`Terrain HTTP ${response.status}`);
      const json = await response.json();
      const loadedSite = loadSite(json);
      const [stopData, mapData] = await Promise.all([
        optionalAsset("data/stops.json"),
        optionalAsset("data/basemap.json"),
      ]);
      if (control.signal.aborted) return;
      setSite(loadedSite);
      setFake(json.fake === true);
      setDemo(readDemoStops(stopData) ?? demoStopsFromSite(loadedSite));
      setBasemap(readBasemap(mapData, loadedSite.bounds));
    };
    load().catch((e: unknown) => {
      if (!control.signal.aborted)
        setError(e instanceof Error ? e.message : String(e));
    });
    return () => control.abort();
  }, []);
  const cost = useMemo(
    () => (site ? buildCostGrid(site, conditions) : null),
    [site, conditions],
  );
  // Preserve the original plan during an emergency; return guidance uses a new cost field.
  const normalCost = useMemo(
    () =>
      site
        ? buildCostGrid(site, { ...conditions, storm: false, spe: false })
        : null,
    [site, conditions.startLmst],
  );
  const plan = useMemo(
    () =>
      site && normalCost
        ? planRoute(site, normalCost, site.habitat, stops)
        : null,
    [site, normalCost, stops],
  );
  const plannedPosition = useMemo(() => {
    const p = plan?.legs.length ? positionAt(plan, elapsed) : null;
    return p && Number.isFinite(p.lat) && Number.isFinite(p.lng)
      ? p
      : {
          ...(site?.habitat ?? { lat: 0, lng: 0 }),
          phase: "walk" as const,
          legIndex: 0,
          oxygenUsedSec: 0,
        };
  }, [site, plan, elapsed]);
  const zone = useMemo(
    () =>
      site && cost && plan && !emergency
        ? safeZone(site, cost, plan)
        : new Uint8Array(0),
    [site, cost, plan, emergency],
  );
  const home = useMemo(
    () => (site && cost ? homeField(site, cost) : null),
    [site, cost],
  );
  const abort = useMemo(
    () =>
      site && cost && emergency
        ? abortRoute(site, cost, emergency.from, emergency.used)
        : null,
    [site, cost, emergency],
  );
  const returnPlan = useMemo(
    () =>
      abort && emergency
        ? returnPlaybackPlan(abort, emergency.used, conditions.storm)
        : null,
    [abort, emergency, conditions.storm],
  );
  const returning = useMemo(
    () => (returnPlan ? positionAt(returnPlan, returnElapsed) : null),
    [returnPlan, returnElapsed],
  );
  const position =
    emergency && returning
      ? {
          ...returning,
          legIndex: plannedPosition.legIndex,
          oxygenUsedSec: emergency.used + returning.oxygenUsedSec,
        }
      : plannedPosition;
  const clockElapsed = emergency ? emergency.at + returnElapsed : elapsed;
  useEffect(() => {
    if (!returnPlaying || !returnPlan) return;
    const timer = setInterval(
      () =>
        setReturnElapsed((t) => {
          const next = Math.min(returnPlan.totalSec, t + 60);
          if (next >= returnPlan.totalSec) setReturnPlaying(false);
          return next;
        }),
      250,
    );
    return () => clearInterval(timer);
  }, [returnPlaying, returnPlan]);
  const toggleReturnPlayback = () => {
    if (
      !returnPlan?.ok ||
      returnPlan.totalSec <= 0 ||
      returnElapsed >= returnPlan.totalSec
    )
      return;
    setReturnPlaying((p) => !p);
  };
  const env = envAt(
    conditions.startLmst + ((clockElapsed / 3600) * 24) / SOL_HOURS,
    conditions.spe,
  );
  const dose =
    (envAt(0, false).doseRateMsvPerHr * (emergency ? emergency.at : elapsed)) /
      3600 +
    (emergency ? (env.doseRateMsvPerHr * returnElapsed) / 3600 : 0);
  useEffect(() => {
    if (!playing || !plan) return;
    const id = setInterval(
      () =>
        setElapsed((t) => {
          const next = Math.min(plan.totalSec, t + 60);
          if (next >= plan.totalSec) setPlaying(false);
          return next;
        }),
      250,
    );
    return () => clearInterval(id);
  }, [playing, plan]);
  const togglePlayback = () => {
    if (emergency || !plan?.ok || !plan.legs.length || plan.totalSec <= 0)
      return;
    if (elapsed >= plan.totalSec) setElapsed(0);
    setPlaying((current) => !current);
  };
  const reset = () => {
    setElapsed(0);
    setPlaying(false);
    setEmergency(null);
    setReturnElapsed(0);
    setReturnPlaying(false);
    setConditions((c) => ({ ...c, storm: false, spe: false }));
  };
  const edit = (next: DemoStop[]) => {
    setStops(next);
    reset();
  };
  const add = (p: LatLng) => {
    if (emergency) return;
    const poi = site?.pois.find(
      (s) =>
        Math.abs(s.lat - p.lat) < 0.00001 && Math.abs(s.lng - p.lng) < 0.00001,
    );
    const id = crypto.randomUUID();
    edit([
      ...stops,
      {
        id,
        lat: p.lat,
        lng: p.lng,
        label: poi?.name ?? `Science stop ${stops.length + 1}`,
        dwellMin: 30,
        why: poi?.note,
        photo: poi?.photo,
        photoCredit: poi?.photoCredit,
      },
    ]);
    setSelected(id);
  };
  const trigger = (kind: "storm" | "spe", at = elapsed) => {
    const incidentAt = plan ? Math.max(0, Math.min(plan.totalSec, at)) : 0;
    const candidate = plan?.legs.length
      ? positionAt(plan, incidentAt)
      : position;
    const snapshot =
      Number.isFinite(candidate.lat) && Number.isFinite(candidate.lng)
        ? candidate
        : plannedPosition;
    setElapsed(incidentAt);
    setPlaying(false);
    setReturnElapsed(0);
    setReturnPlaying(false);
    setEmergency({
      kind,
      from: snapshot,
      used: snapshot.oxygenUsedSec,
      at: incidentAt,
    });
    const nextConditions = {
      ...conditions,
      storm: kind === "storm",
      spe: kind === "spe",
    };
    setConditions(nextConditions);
    return site
      ? abortRoute(
          site,
          buildCostGrid(site, nextConditions),
          snapshot,
          snapshot.oxygenUsedSec,
        )
      : null;
  };
  return {
    site,
    basemap,
    fake,
    error,
    stops,
    demo,
    selected,
    setSelected,
    edit,
    add,
    conditions,
    setConditions,
    elapsed,
    clockElapsed,
    returnPlan,
    returnElapsed,
    returnPlaying,
    toggleReturnPlayback,
    setElapsed,
    playing,
    togglePlayback,
    setPlaying,
    emergency,
    trigger,
    reset,
    cost,
    plan,
    position,
    zone,
    home,
    abort,
    env,
    dose,
  };
}
type MissionState = ReturnType<typeof useMissionState>;
const Context = createContext<MissionState | null>(null);
export function MissionProvider({ children }: { children: ReactNode }) {
  return (
    <Context.Provider value={useMissionState()}>{children}</Context.Provider>
  );
}
export function useMission() {
  const value = useContext(Context);
  if (!value) throw Error("MissionProvider required");
  return value;
}
