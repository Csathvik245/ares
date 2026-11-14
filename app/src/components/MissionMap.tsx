import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  cellIndexOf,
  type LatLng,
  type Site,
  type Stop,
  type Plan,
  type CostGrid,
} from "../lib/planner";
import type { Basemap } from "../lib/basemap";
import { raster, type OverlayName } from "../lib/layers";
export const TREK_LAYER = "Mars_Viking_MDIM21_ClrMosaic_global_232m";
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
  onAdd,
  onMove,
  onSelect,
  onProbe,
}: {
  site: Site;
  basemap: Basemap | null;
  cost: CostGrid;
  plan: Plan;
  stops: Stop[];
  zone: Uint8Array;
  active: OverlayName[];
  position: LatLng;
  abort: LatLng[];
  onAdd: (p: LatLng) => void;
  onMove: (id: string, p: LatLng) => void;
  onSelect: (id: string) => void;
  onProbe: (i: number) => void;
}) {
  const root = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    callbacks = useRef({ onAdd, onMove, onSelect, onProbe });
  callbacks.current = { onAdd, onMove, onSelect, onProbe };
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
    });
    map.current = m;
    const b = L.latLngBounds(
      [site.bounds.south, site.bounds.west],
      [site.bounds.north, site.bounds.east],
    );
    m.fitBounds(b);
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
        attribution: basemap.credit,
        interactive: false,
      });
      image.on("load", () => {
        if (!disposed)
          setBaseLabel(
            `HiRISE local mosaic · ${basemap.metersPerPixel.toFixed(1)} m/pixel`,
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
    m.on("mousemove", (e: L.LeafletMouseEvent) =>
      callbacks.current.onProbe(cellIndexOf(site, e.latlng)),
    );
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(root.current!);
    return () => {
      disposed = true;
      resize.disconnect();
      m.remove();
      map.current = null;
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
    L.imageOverlay(raster(site, cost, "zone", zone), bounds, {
      className: "safe-zone",
    }).addTo(group);
    return () => {
      group.remove();
    };
  }, [site, basemap, cost, active, zone]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const g = L.layerGroup().addTo(m);
    const marker = (p: LatLng, text: string, cls: string) =>
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: `map-marker ${cls}`,
          html: text,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
        keyboard: true,
      });
    marker(site.habitat, "H", "habitat")
      .bindTooltip(site.habitat.name)
      .addTo(g);
    site.pois.forEach((p) => {
      const mk = marker(p, "+", "poi").bindTooltip(p.name).addTo(g);
      mk.on("click", () => callbacks.current.onAdd(p));
    });
    stops.forEach((s, i) => {
      const mk = marker(s, String(i + 1), "stop").addTo(g);
      mk.dragging?.enable();
      mk.on("dragend", () => {
        const point = mk.getLatLng();
        if (cellIndexOf(site, point) < 0) mk.setLatLng([s.lat, s.lng]);
        else callbacks.current.onMove(s.id, point);
      });
      mk.on("click", () => callbacks.current.onSelect(s.id));
    });
    plan.legs.forEach((leg) => {
      if (leg.path.length) {
        const line = L.polyline(
          leg.path.map((p) => [p.lat, p.lng] as [number, number]),
          { color: "#ff6b35", weight: 3, className: "route-line" },
        ).addTo(g);
        line.getElement()?.setAttribute("pathLength", "1");
      }
    });
    return () => {
      g.remove();
    };
  }, [site, basemap, stops, plan]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const g = L.layerGroup().addTo(m);
    L.circleMarker([position.lat, position.lng], {
      color: "#4fd1ff",
      fillOpacity: 1,
      radius: 7,
    }).addTo(g);
    if (abort.length)
      L.polyline(
        abort.map((p) => [p.lat, p.lng] as [number, number]),
        { color: "#ff4d5a", weight: 5 },
      ).addTo(g);
    return () => {
      g.remove();
    };
  }, [basemap, position, abort]);
  return (
    <div className="map-shell">
      <div
        ref={root}
        className="mission-map"
        aria-label="Jezero map. Click to add stops."
      />
      <span className="map-caption">{baseLabel} · Click map to add a stop</span>
    </div>
  );
}
