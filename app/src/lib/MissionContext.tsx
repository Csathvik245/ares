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
  readSkyView,
  buildCostGrid,
  planRoute,
  safeZone,
  positionAt,
  envAt,
  homeField,
  type StormOutcome,
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
import { emergencyCourse, isReplanned, isScenario, runEmergency, type UiEmergencyKind } from "./emergency-run";
import { readBasemap, type Basemap } from "./basemap";
import { publicAssetUrl } from "./assets";
export type { DemoStop } from "./data";

function useMissionState() {
  const [site, setSite] = useState<Site | null>(null),
    [fake, setFake] = useState(false),
    [error, setError] = useState("");
  const [skyView, setSkyView] = useState<Float32Array | null>(null);
  const [basemap, setBasemap] = useState<Basemap | null>(null);
  const [viewRequest, setViewRequest] = useState(0);
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
      kind: UiEmergencyKind;
      at: number;
      outcome: StormOutcome;
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
      setSkyView(readSkyView(json));
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
  // The calm plan remains the immutable playback route; stormAt supplies all
  // emergency statuses, reasons, return geometry and oxygen guidance.
  const emergencyOutcome = emergency?.outcome ?? null;
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
  // The course to draw and play back: the walk home for a storm, SPE or aborted EVA;
  // the re-planned route for oxygen loss, slower walking or a blocked path.
  const course = useMemo(
    () => (emergencyOutcome ? emergencyCourse(emergencyOutcome, conditions.storm) : null),
    [emergencyOutcome, conditions.storm],
  );
  const abort = course?.abort ?? null;
  const returnPlan = course?.returnPlan ?? null;
  const returning = useMemo(
    () => (returnPlan ? positionAt(returnPlan, returnElapsed) : null),
    [returnPlan, returnElapsed],
  );
  const position =
    emergency && returning
      ? {
          ...returning,
          legIndex: plannedPosition.legIndex,
          oxygenUsedSec: emergencyOutcome!.position.oxygenUsedSec + returning.oxygenUsedSec,
        }
      : emergencyOutcome?.position ?? plannedPosition;
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
  const loadDemo = () => {
    edit(demo.map((stop) => ({ ...stop })));
    setSelected("");
    setViewRequest((n) => n + 1);
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
  const trigger = (kind: UiEmergencyKind, at = elapsed, incidentPlan = plan) => {
    const incidentAt = incidentPlan ? Math.max(0, Math.min(incidentPlan.totalSec, at)) : 0;
    if (!site || !incidentPlan) return null;
    const outcome = runEmergency(site, incidentPlan, incidentAt, kind, {
      startLmst: conditions.startLmst,
      skyView,
      stops: incidentPlan === plan ? stops : undefined,
    });
    setElapsed(incidentAt);
    setPlaying(false);
    setReturnElapsed(0);
    setReturnPlaying(false);
    setEmergency({
      kind,
      at: incidentAt,
      outcome,
    });
    const nextConditions = {
      ...conditions,
      storm: kind === "storm",
      spe: kind === "spe",
    };
    setConditions(nextConditions);
    return outcome.abort;
  };
  const wildcat = site?.pois.find((p) => p.id === "delta-wildcat-ridge");
  const loadWildcatSpe = () => {
    if (!site || !normalCost || !wildcat) return;
    const stop = { ...wildcat, label: wildcat.name, dwellMin: 0 };
    const demoPlan = planRoute(site, normalCost, site.habitat, [stop]);
    if (!demoPlan.ok) return;
    setStops([stop]);
    setSelected("");
    setViewRequest((n) => n + 1);
    trigger("spe", demoPlan.legs[0].arriveSec, demoPlan);
  };
  return {
    wildcat,
    loadWildcatSpe,
    site,
    basemap,
    fake,
    error,
    stops,
    demo,
    loadDemo,
    viewRequest,
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
    evaPlan: plan,
    evaStatus: emergencyOutcome?.evaStatus ?? plan?.status ?? "NO-GO",
    evaReasons: emergencyOutcome?.evaReasons ?? plan?.reasons ?? [],
    emergencyOutcome,
    scenario: isScenario(emergencyOutcome) ? emergencyOutcome : null,
    replanned: isReplanned(emergencyOutcome),
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
