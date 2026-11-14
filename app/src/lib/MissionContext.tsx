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
import { optionalJson, readDemoStops, type DemoStop } from "./data";
import { publicAssetUrl } from "./assets";
export type { DemoStop } from "./data";

function useMissionState() {
  const [site, setSite] = useState<Site | null>(null),
    [fake, setFake] = useState(false),
    [error, setError] = useState("");
  const [stops, setStops] = useState<DemoStop[]>([]),
    [demo, setDemo] = useState<DemoStop[]>([]),
    [selected, setSelected] = useState("");
  const [conditions, setConditions] = useState<Conditions>({
    storm: false,
    spe: false,
    startLmst: 13,
  });
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
    fetch(`${import.meta.env.BASE_URL}data/site.json`, {
      signal: control.signal,
    })
      .then((r) => {
        if (!r.ok) throw Error(`Terrain HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        const s = loadSite(json);
        setSite(s);
        setFake(json.fake === true);
        setDemo(
          s.pois
            .filter((p) => p.kind === "science")
            .slice(0, 3)
            .map((p) => ({ ...p, label: p.name, dwellMin: 30, why: p.note })),
        );
        const stopsUrl = publicAssetUrl("data/stops.json");
        return stopsUrl
          ? fetch(stopsUrl, { signal: control.signal }).catch(() => null)
          : null;
      })
      .then(async (r) => {
        const d = await optionalJson(r);
        const stops = readDemoStops(d);
        if (!control.signal.aborted && stops) setDemo(stops);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(String(e));
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
  const position = useMemo(() => {
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
  const env = envAt(
    conditions.startLmst + ((elapsed / 3600) * 24) / SOL_HOURS,
    conditions.spe,
  );
  const dose =
    (envAt(0, false).doseRateMsvPerHr * (emergency ? emergency.at : elapsed)) /
      3600 +
    (emergency ? (env.doseRateMsvPerHr * (elapsed - emergency.at)) / 3600 : 0);
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
  const reset = () => {
    setElapsed(0);
    setPlaying(false);
    setEmergency(null);
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
    const snapshot = plan?.legs.length ? positionAt(plan, at) : position;
    setElapsed(at);
    setPlaying(false);
    setEmergency({
      kind,
      from: snapshot,
      used: snapshot.oxygenUsedSec,
      at,
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
    setElapsed,
    playing,
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
