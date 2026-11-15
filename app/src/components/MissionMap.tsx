import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { circleOutline } from "../lib/emergency-run";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  cellIndexOf,
  type LatLng,
  type Site,
  type Stop,
  type Plan,
  type CostGrid,
  type ShelterCheck,
  roundHalfUp,
  SAND_TI_THRESHOLD,
  formatDuration,
} from "../lib/planner";
import { removeSmallIslands } from "../lib/zoneCleanup";
import { distanceM } from "../geo";
import { routeParts, shortStop } from "../lib/presentation";
import type { Basemap } from "../lib/basemap";
import { raster, type OverlayName } from "../lib/layers";
export const TREK_LAYER = "Mars_Viking_MDIM21_ClrMosaic_global_232m";

function fitMissionView(map: L.Map, site: Site, stops: Stop[], shelterTarget?: LatLng) {
  const bounds = L.latLngBounds(
    [site.habitat, ...stops, ...(shelterTarget ? [shelterTarget] : [])]
      .map((p) => [p.lat, p.lng] as [number, number]),
  );
  const size = map.getSize();
  const padX = Math.max(48, size.x * 0.12);
  const padY = Math.max(48, size.y * 0.12);
  // Emergency guidance overlays the map. Keep fitted targets below its actual
  // bottom edge, including when its text wraps on a tablet.
  const container = map.getContainer();
  const alert = container.parentElement?.querySelector(".storm-alert");
  const alertBottom = alert
    ? alert.getBoundingClientRect().bottom - container.getBoundingClientRect().top + 24
    : 0;
  map.fitBounds(bounds, {
    animate: false,
    paddingTopLeft: [padX, Math.max(padY, alertBottom)],
    paddingBottomRight: [padX, padY],
    maxZoom: 14,
  });
}
export function MissionMap({
  site,
  basemap,
  cost,
  plan,
  stops,
  zone,
  active,
  position,
  abort,
  shelter,
  blocked,
  onAdd,
  onMove,
  onSelect,
  onProbe,
  emergency = false,
  incidentAt = 0,
  viewRequest = 0,
  walkHome,
  children,
}: {
  emergency?: boolean;
  incidentAt?: number;
  viewRequest?: number;
  children?: ReactNode;
  site: Site;
  basemap: Basemap | null;
  cost: CostGrid;
  plan: Plan;
  stops: Stop[];
  zone: Uint8Array;
  active: OverlayName[];
  position: LatLng;
  abort: LatLng[];
  shelter?: Extract<ShelterCheck, { checked: true }>;
  /** The impassable area of a "path blocked" emergency, drawn as a dashed outline. */
  blocked?: { at: LatLng; radiusM: number };
  onAdd: (p: LatLng) => void;
  onMove: (id: string, p: LatLng) => void;
  onSelect: (id: string) => void;
  onProbe: (i: number) => void;
  /** Walk-home time in seconds for every cell (the cached field from the habitat), for the cursor tooltip. */
  walkHome?: ArrayLike<number>;
}) {
  const root = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    callbacks = useRef({ onAdd, onMove, onSelect, onProbe });
  callbacks.current = { onAdd, onMove, onSelect, onProbe };
  // Cursor probe: the cell under the pointer and where the pointer is, for the tooltip that follows it.
  const [hover, setHover] = useState<{ cell: number; x: number; y: number; w: number; h: number } | null>(null);
  // Display-only cleanup; keep the original planner mask for all safety decisions.
  const drawnZone = useMemo(
    () => removeSmallIslands(zone, site.width, site.height),
    [zone, site.width, site.height],
  );
  const [scaleWidth, setScaleWidth] = useState(80);
  const [baseLabel, setBaseLabel] = useState("Elevation hillshade");
  const cache = useRef(new Map<string, string>());
  useEffect(() => {
    cache.current.clear();
  }, [site, cost]);
  useEffect(() => {
    const m = L.map(root.current!, {
      crs: L.CRS.EPSG4326,
      minZoom: 8,
      maxZoom: 17,
      zoomControl: true,
      zoomSnap: 0.1,
    });
    map.current = m;
    const b = L.latLngBounds(
      [site.bounds.south, site.bounds.west],
      [site.bounds.north, site.bounds.east],
    );
    fitMissionView(m, site, stops);
    m.attributionControl.setPrefix(false);
    for (const [name, z] of [
      ["routes", 450],
      ["pois", 600],
      ["stops", 620],
      ["astronaut", 640],
    ] as const)
      m.createPane(name).style.zIndex = String(z);
    const updateScale = () => {
      const h = m.getSize().y;
      const d = distanceM(
        m.containerPointToLatLng([0, h - 30]),
        m.containerPointToLatLng([100, h - 30]),
      );
      setScaleWidth((500 / d) * 100);
    };
    m.on("zoomend moveend resize", updateScale);
    updateScale();
    m.setMaxBounds(b.pad(0.3));
    m.createPane("fallback").style.zIndex = "150";
    m.createPane("localBasemap").style.zIndex = "250";
    L.imageOverlay(raster(site, cost, "hillshade"), b, {
      interactive: false,
      pane: "fallback",
    }).addTo(m);
    let disposed = false;
    let nasa: L.TileLayer | undefined;
    const startNasa = () => {
      if (disposed) return;
      setBaseLabel("Elevation hillshade · loading Viking imagery");
      nasa = L.tileLayer(
        `https://trek.nasa.gov/tiles/Mars/EQ/${TREK_LAYER}/1.0.0/default/default028mm/{z}/{y}/{x}.jpg`,
        {
          maxNativeZoom: 7,
          maxZoom: 17,
          attribution: "NASA/JPL-Caltech · Viking MDIM 2.1",
        },
      );
      nasa.on("load", () => {
        if (!disposed && nasa && m.hasLayer(nasa))
          setBaseLabel("Viking global imagery");
      });
      nasa.on("tileerror", () => {
        if (nasa) m.removeLayer(nasa);
        if (!disposed)
          setBaseLabel("Elevation hillshade · imagery unavailable");
      });
      nasa.addTo(m);
    };
    if (basemap) {
      const image = L.imageOverlay(basemap.url, b, {
        pane: "localBasemap",
        attribution: "NASA/JPL-Caltech/UArizona/USGS",
        interactive: false,
      });
      image.on("load", () => {
        if (!disposed)
          setBaseLabel(
            `HiRISE local mosaic · ${roundHalfUp(basemap.metersPerPixel, 1)} m/pixel`,
          );
      });
      image.on("error", () => {
        m.removeLayer(image);
        startNasa();
      });
      image.addTo(m);
    } else startNasa();
    m.on("click", (e: L.LeafletMouseEvent) => {
      if (cellIndexOf(site, e.latlng) >= 0) callbacks.current.onAdd(e.latlng);
    });
    m.on("mousemove", (e: L.LeafletMouseEvent) => {
      const cell = cellIndexOf(site, e.latlng);
      callbacks.current.onProbe(cell);
      const size = m.getSize();
      setHover(cell >= 0 ? { cell, x: e.containerPoint.x, y: e.containerPoint.y, w: size.x, h: size.y } : null);
    });
    m.on("mouseout", () => {
      callbacks.current.onProbe(-1);
      setHover(null);
    });
    return () => {
      disposed = true;
      m.remove();
      map.current = null;
    };
  }, [site, basemap]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const fit = () => {
      // Read the current panel width before fitting, and avoid Leaflet's default
      // resize pan moving the fitted shelter back under the banner or offscreen.
      m.invalidateSize({ pan: false });
      fitMissionView(m, site, stops, shelter?.target);
    };
    fit();
    const resize = new ResizeObserver(fit);
    resize.observe(root.current!);
    return () => resize.disconnect();
  }, [site, basemap, viewRequest, stops, emergency, shelter?.target]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const group = L.layerGroup().addTo(m);
    const update = () => {
      group.clearLayers();
      const b = m.getBounds(),
        size = m.getSize();
      const label = (point: L.LatLng, text: string) =>
        L.marker(point, {
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: "coordinate-tick",
            html: text,
            iconSize: [62, 12],
            iconAnchor: [31, 6],
          }),
        }).addTo(group);
      for (
        let lat = Math.ceil(b.getSouth() * 100) / 100;
        lat < b.getNorth();
        lat += 0.01
      ) {
        L.polyline(
          [
            [lat, b.getWest()],
            [lat, b.getEast()],
          ],
          { weight: 0.6, opacity: 0.28, color: "#eceae6", interactive: false },
        ).addTo(group);
        const y = m.latLngToContainerPoint([lat, b.getEast()]).y;
        if (y > 65 && y < size.y - 60)
          label(
            m.containerPointToLatLng([size.x - 28, y]),
            `${roundHalfUp(lat, 2)}°N`,
          );
      }
      for (
        let lng = Math.ceil(b.getWest() * 100) / 100;
        lng < b.getEast();
        lng += 0.01
      ) {
        L.polyline(
          [
            [b.getSouth(), lng],
            [b.getNorth(), lng],
          ],
          { weight: 0.6, opacity: 0.28, color: "#eceae6", interactive: false },
        ).addTo(group);
        const x = m.latLngToContainerPoint([b.getSouth(), lng]).x;
        if (
          x >
            Math.max(
              80,
              (500 /
                distanceM(
                  m.containerPointToLatLng([0, size.y - 30]),
                  m.containerPointToLatLng([100, size.y - 30]),
                )) *
                100 +
                45,
            ) &&
          x < size.x - 65
        )
          label(
            m.containerPointToLatLng([x, size.y - 48]),
            `${roundHalfUp(lng, 2)}°E`,
          );
      }
    };
    m.on("moveend resize", update);
    update();
    return () => {
      m.off("moveend resize", update);
      group.remove();
    };
  }, [site, basemap]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const group = L.layerGroup().addTo(m);
    const bounds: L.LatLngBoundsExpression = [
      [site.bounds.south, site.bounds.west],
      [site.bounds.north, site.bounds.east],
    ];
    active.forEach((kind) => {
      let url = cache.current.get(kind);
      if (!url) {
        url = raster(site, cost, kind);
        cache.current.set(kind, url);
      }
      L.imageOverlay(url, bounds, { opacity: 0.8 }).addTo(group);
    });
    if (!emergency)
      L.imageOverlay(raster(site, cost, "zone", drawnZone), bounds, {
        className: "safe-zone",
      }).addTo(group);
    return () => {
      group.remove();
    };
  }, [site, basemap, cost, active, drawnZone, emergency]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const g = L.layerGroup().addTo(m);
    const marker = (p: LatLng, text: string, cls: string, dx = 0, dy = 0) =>
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: `map-marker ${cls}`,
          html: text,
          iconSize: [34, 34],
          iconAnchor: [17 - dx, 17 - dy],
        }),
        pane: cls === "poi" ? "pois" : "stops",
        keyboard: true,
      });
    marker(site.habitat, "H", "habitat")
      .bindTooltip(
        Object.assign(document.createElement("span"), {
          textContent: site.habitat.name,
        }),
        {
          permanent: true,
          direction: "top",
          offset: [0, -24],
          className: "stop-label habitat-label",
        },
      )
      .addTo(g);
    site.pois.forEach((p) => {
      const mk = marker(p, "", "poi")
        .bindTooltip(
          Object.assign(document.createElement("span"), {
            textContent: p.name,
          }),
        )
        .addTo(g);
      mk.on("click", () => callbacks.current.onAdd(p));
    });
    stops.forEach((s, i) => {
      const closeToHabitat =
        m
          .latLngToContainerPoint([s.lat, s.lng])
          .distanceTo(
            m.latLngToContainerPoint([site.habitat.lat, site.habitat.lng]),
          ) < 60;
      const dx = closeToHabitat ? 34 : 0,
        dy = closeToHabitat ? 26 : 0;
      const mk = marker(
        s,
        String(i + 1).padStart(2, "0"),
        "stop",
        dx,
        dy,
      ).addTo(g);
      if (closeToHabitat) {
        const shifted = m.containerPointToLatLng(
          m.latLngToContainerPoint([s.lat, s.lng]).add([dx, dy]),
        );
        L.polyline([[s.lat, s.lng], shifted], {
          pane: "stops",
          color: "#ff6b35",
          weight: 1,
          interactive: false,
        }).addTo(g);
        L.circleMarker([s.lat, s.lng], {
          pane: "stops",
          radius: 2,
          color: "#ff6b35",
          interactive: false,
        }).addTo(g);
      }
      mk.bindTooltip(
        Object.assign(document.createElement("span"), {
          textContent:
            shortStop(s.id, s.label) +
            (s.id === "delta-toe" ? " · new clay target" : ""),
        }),
        {
          permanent: true,
          direction: closeToHabitat ? "bottom" : "right",
          offset: closeToHabitat ? [dx, dy + 22] : [18, 0],
          className: "stop-label",
        },
      );
      if (!emergency) mk.dragging?.enable();
      mk.on("dragend", () => {
        const point = mk.getLatLng();
        if (cellIndexOf(site, point) < 0) mk.setLatLng([s.lat, s.lng]);
        else callbacks.current.onMove(s.id, point);
      });
      mk.on("click", () => callbacks.current.onSelect(s.id));
    });
    const draw = (
      path: LatLng[],
      color: string,
      weight: number,
      opacity = 1,
      dashArray?: string,
    ) => {
      if (!path.length) return;
      const points = path.map((p) => [p.lat, p.lng] as [number, number]);
      L.polyline(points, {
        pane: "routes",
        color: "#08090b",
        weight: weight + 2,
        opacity,
        interactive: false,
      }).addTo(g);
      const line = L.polyline(points, {
        pane: "routes",
        color,
        weight,
        opacity,
        dashArray,
        interactive: false,
        className: dashArray ? "" : "route-line",
      }).addTo(g);
      if (!dashArray) line.getElement()?.setAttribute("pathLength", "1");
    };
    if (emergency) {
      const parts = routeParts(plan, incidentAt);
      parts.walked.forEach((p) => draw(p, "#ff6b35", 3, 0.35));
      parts.cancelled.forEach((p) => draw(p, "#8a919e", 2, 0.65, "6 6"));
      draw(abort, "#ff4d5a", shelter ? 3 : 5, shelter ? 0.4 : 1, shelter ? "6 6" : undefined);
      if (shelter?.path && shelter.target) {
        draw(shelter.path, "#4fd1ff", 4, 1, "6 4");
        L.circleMarker([shelter.target.lat, shelter.target.lng], {
          pane: "stops", radius: 5, color: "#4fd1ff", fillColor: "#4fd1ff",
          fillOpacity: 1, weight: 2,
        }).addTo(g).bindTooltip("SHELTER · simplified model", { direction: "bottom" });
      }
      if (blocked) {
        // Outline only, in the existing danger colour (--nogo).
        const nogo = getComputedStyle(document.documentElement).getPropertyValue("--nogo").trim() || "#ff4d5a";
        L.polygon(circleOutline(blocked.at, blocked.radiusM).map((p) => [p.lat, p.lng] as [number, number]), {
          pane: "routes", color: nogo, weight: 2, dashArray: "4 4", fill: false, interactive: false,
        }).addTo(g);
      }
    } else plan.legs.forEach((l) => draw(l.path, "#ff6b35", 3));
    return () => {
      g.remove();
    };
  }, [site, basemap, stops, plan, emergency, incidentAt, abort, shelter, blocked]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const g = L.layerGroup().addTo(m);
    L.circleMarker([position.lat, position.lng], {
      pane: "astronaut",
      color: "#08090b",
      fillColor: "#4fd1ff",
      weight: 2,
      fillOpacity: 1,
      radius: 7,
    }).addTo(g);
    return () => {
      g.remove();
    };
  }, [basemap, position, abort]);
  return (
    <div className={`map-shell ${emergency ? "is-emergency" : ""}`}>
      <div
        ref={root}
        className="mission-map"
        aria-label="Jezero map. Click to add stops."
      />
      <div className="map-legend">
        <span>
          <em className="legend-glyph">―</em> Planned route
        </span>
        <span>
          <em className="legend-glyph">―</em> Edge of safe return
        </span>
        <span>
          <em className="legend-glyph">●</em> Rover sample site
        </span>
        {shelter && (
          <span className="shelter-legend">
            <em className="legend-glyph">―</em> Shelter option
          </span>
        )}
      </div>
      <span className="map-north" aria-label="North">
        ↑<b>N</b>
      </span>
      <div className="map-corners" aria-hidden="true" />
      {hover && (
        // Flips to the other side of the pointer near the right and bottom edges so it stays on the map.
        <dl
          className="map-probe"
          aria-hidden="true"
          style={{
            left: hover.x > hover.w - 210 ? hover.x - 196 : hover.x + 16,
            top: hover.y > hover.h - 150 ? hover.y - 132 : hover.y + 16,
          }}
        >
          <dt>Elevation</dt>
          <dd>{roundHalfUp(site.layers.elevation[hover.cell])} m</dd>
          <dt>Slope</dt>
          <dd>{roundHalfUp(site.layers.slope[hover.cell], 1)}°</dd>
          <dt>Ground</dt>
          <dd>{site.layers.thermalInertia[hover.cell] < SAND_TI_THRESHOLD ? "Soft sand risk" : "Firm ground proxy"}</dd>
          <dt>Science signal</dt>
          <dd>{roundHalfUp(site.layers.science[hover.cell], 2)}</dd>
          <dt>Walk home</dt>
          <dd>{formatDuration(walkHome?.[hover.cell] ?? Infinity)}</dd>
        </dl>
      )}
      {children}
      <div className="mars-scale" style={{ width: scaleWidth }}>
        <span>500 m</span>
      </div>
      <span className="map-caption">{baseLabel}</span>
    </div>
  );
}
