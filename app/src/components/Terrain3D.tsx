import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { CostGrid, LatLng, Plan, Site, Stop } from "../lib/planner";
import { raster, type OverlayName } from "../lib/layers";
import { removeSmallIslands } from "../lib/zoneCleanup";

/**
 * 3D terrain view (stretch feature): the HiRISE mosaic draped over the real elevation grid, with the route,
 * stops, habitat and astronaut standing on it. Loaded lazily (see App.tsx) so three.js never touches the
 * default bundle. The 2D Leaflet map stays the planning surface; this is a view of the same plan.
 *
 * World units are 100 m. The terrain is centred on the origin, +x east, +z south, +y up.
 */
const UNIT_M = 100;
const DEFAULT_EXAGGERATION = 3;

type Props = {
  site: Site;
  cost: CostGrid;
  zone: Uint8Array;
  active: OverlayName[];
  basemapUrl?: string;
  plan: Plan;
  stops: Stop[];
  position: LatLng;
  abort: LatLng[];
  emergency: boolean;
  /** Seconds since the EVA started (normal mode). */
  elapsedSec: number;
  /** Seconds since the abort started (emergency mode). */
  returnElapsedSec: number;
  /** When the emergency began, seconds into the EVA. */
  incidentAt?: number;
  /** Duration of the abort walk, seconds. */
  abortSec?: number;
};

type RouteState = {
  total: number;
  legs: { startS: number; endS: number; start: number; arrive: number; walk: number }[];
  uniforms: { uProgress: { value: number } };
};

type Scene3D = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  terrain: THREE.Mesh | null;
  skirt: THREE.Mesh | null;
  overlay: THREE.Group;
  walker: THREE.Group;
  texture: THREE.Texture | null;
  detail: THREE.Texture;
  route: RouteState | null;
  abortRoute: { total: number; uniforms: { uProgress: { value: number } } } | null;
  uWidth: { value: number };
  render: () => void;
};

const cssColor = (name: string, fallback: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
// The CSS filter formulas, applied per pixel so the result does not depend on canvas filter support.
const contrast = (v: number, k: number) => (v - 127.5) * k + 127.5;
/** grayscale(1) then contrast(1.05): what the mono theme applies to every image layer. */
function gradeMono(d: Uint8ClampedArray) {
  for (let i = 0; i < d.length; i += 4) {
    const y = contrast(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2], 1.05);
    d[i] = d[i + 1] = d[i + 2] = clamp255(y);
  }
}
/** The base-imagery dimming the theme CSS applies to its pane: brightness(dim) contrast(1.05), after mono if set. */
function gradeBase(d: Uint8ClampedArray, mono: boolean, dim: number) {
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    if (mono) {
      const y = contrast(0.2126 * r + 0.7152 * g + 0.0722 * b, 1.05);
      r = g = b = y;
    }
    if (dim !== 1) {
      r = contrast(r * dim, 1.05);
      g = contrast(g * dim, 1.05);
      b = contrast(b * dim, 1.05);
    }
    d[i] = clamp255(r);
    d[i + 1] = clamp255(g);
    d[i + 2] = clamp255(b);
  }
}
/** Same matrix as the #ds-zone-blue SVG filter (Map3DToggle.tsx): light blues become electric blue. */
function gradeZoneBlue(d: Uint8ClampedArray) {
  for (let i = 0; i < d.length; i += 4) {
    const b = d[i + 2];
    d[i] = clamp255(0.239 * b);
    d[i + 1] = clamp255(0.482 * b);
  }
}

async function drawRaster(
  g: CanvasRenderingContext2D,
  W: number,
  H: number,
  dataUrl: string,
  alpha: number,
  grade?: (d: Uint8ClampedArray) => void,
) {
  const img = await loadImage(dataUrl);
  const tmp = document.createElement("canvas");
  tmp.width = img.naturalWidth;
  tmp.height = img.naturalHeight;
  const t = tmp.getContext("2d")!;
  t.drawImage(img, 0, 0);
  if (grade) {
    const id = t.getImageData(0, 0, tmp.width, tmp.height);
    grade(id.data);
    t.putImageData(id, 0, 0);
  }
  g.globalAlpha = alpha;
  g.imageSmoothingEnabled = false; // the 2D overlays are crisp cell rasters
  g.drawImage(tmp, 0, 0, W, H);
  g.globalAlpha = 1;
}

/**
 * Paints the same picture the 2D Leaflet map shows, in the same order and with the same per-theme grading
 * (see MissionMap.tsx and the theme CSS): dimmed HiRISE base, any toggled layers at 80%, the dark outside-the-zone
 * shading with the safe-return edge, then the faint lat/lng grid. Using the same raster() and zone cleanup keeps
 * the two views from drifting apart.
 */
async function composeTexture(o: {
  site: Site;
  cost: CostGrid;
  basemapUrl?: string;
  active: OverlayName[];
  zone?: Uint8Array;
  emergency: boolean;
  monoFont: string;
}): Promise<THREE.CanvasTexture> {
  const theme = document.documentElement.dataset.theme ?? "mono";
  const mono = theme === "mono";
  // Same dimming the CSS applies to the base imagery pane.
  const dim = theme === "classic" ? (o.emergency ? 0.5 : 1) : o.emergency ? 0.42 : 0.6;
  let base: HTMLImageElement | null = null;
  if (o.basemapUrl) {
    try {
      base = await loadImage(o.basemapUrl);
    } catch {
      base = null;
    }
  }
  const src = base ?? (await loadImage(raster(o.site, o.cost, "hillshade")));
  const W = Math.min(2400, base?.naturalWidth ?? 2048);
  const H = Math.round(W * (base ? base.naturalHeight / base.naturalWidth : 0.75));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d", { willReadFrequently: true })!;

  g.drawImage(src, 0, 0, W, H);
  if (mono || dim !== 1) {
    const id = g.getImageData(0, 0, W, H);
    gradeBase(id.data, mono, dim);
    g.putImageData(id, 0, 0);
  }
  for (const kind of o.active) await drawRaster(g, W, H, raster(o.site, o.cost, kind), 0.8, mono ? gradeMono : undefined);
  if (!o.emergency && o.zone)
    await drawRaster(g, W, H, raster(o.site, o.cost, "zone", o.zone), 1, mono ? gradeZoneBlue : undefined);

  // Graticule: every 0.01 degrees, faint, drawn over everything, like the 2D map.
  const { north, south, west, east } = o.site.bounds;
  g.strokeStyle = "rgba(236,234,230,0.28)";
  g.lineWidth = Math.max(1, W / 1200);
  g.fillStyle = "rgba(236,234,230,0.32)";
  g.font = `${Math.round(W / 90)}px ${o.monoFont}`;
  for (let lat = Math.ceil(south * 100) / 100; lat < north; lat += 0.01) {
    const y = ((north - lat) / (north - south)) * H;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
    g.textAlign = "right";
    g.fillText(`${lat.toFixed(2)}°N`, W - W * 0.012, y - 5);
  }
  for (let lng = Math.ceil(west * 100) / 100; lng < east; lng += 0.01) {
    const x = ((lng - west) / (east - west)) * W;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, H);
    g.stroke();
    g.textAlign = "center";
    g.fillText(`${lng.toFixed(2)}°E`, x, H - H * 0.04);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function disposeObject(o: THREE.Object3D) {
  o.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose?.();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose?.();
    const map = (mat as THREE.SpriteMaterial | undefined)?.map;
    map?.dispose?.();
  });
}


const BASE_Y = -2.2; // the underside of the terrain block, in world units
const FOLLOW_EASE = 0.09;

const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Tileable value noise around mid-grey: fine regolith grain that adds local detail up close and averages out far away. */
function makeDetailTexture(size = 256) {
  const rand = mulberry32(1337);
  const octaves = [
    { cells: 8, amp: 0.5 },
    { cells: 16, amp: 0.3 },
    { cells: 32, amp: 0.2 },
    { cells: 64, amp: 0.14 },
  ].map((o) => ({ ...o, grid: Float32Array.from({ length: o.cells * o.cells }, rand) }));
  const total = octaves.reduce((a, o) => a + o.amp, 0);
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const g = cv.getContext("2d")!;
  const img = g.createImageData(size, size);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      for (const o of octaves) {
        const fx = (x / size) * o.cells,
          fy = (y / size) * o.cells;
        const x0 = Math.floor(fx),
          y0 = Math.floor(fy);
        const tx = smooth(fx - x0),
          ty = smooth(fy - y0);
        const at = (cx: number, cy: number) => o.grid[(cy % o.cells) * o.cells + (cx % o.cells)];
        const a = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
        const b = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
        v += (a * (1 - ty) + b * ty) * o.amp;
      }
      const n = Math.max(0, Math.min(1, 0.5 + ((v / total - 0.5) * 2.4)));
      const c = Math.round(n * 255);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = c;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Horizontal strata for the sliced edge of the terrain block. v runs from the underside (0) to the highest point (1). */
function makeStrataTexture() {
  const cv = document.createElement("canvas");
  cv.width = 8;
  cv.height = 512;
  const g = cv.getContext("2d")!;
  const rand = mulberry32(7);
  const bands = 16;
  for (let y = 0; y < 512; y++) {
    const band = Math.floor((y / 512) * bands);
    const tone = 70 + (band % 2) * 26 + ((band * 37) % 5) * 5 + rand() * 6;
    g.fillStyle = `rgb(${tone},${tone},${tone})`;
    g.fillRect(0, 511 - y, 8, 1);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A ground plane that fades out, with a faint grid and a contact shadow under the block. */
function makeGroundTexture(blockFrac: number) {
  const size = 1024;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const g = cv.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(34,34,34,1)");
  grad.addColorStop(0.55, "rgba(22,22,22,0.9)");
  grad.addColorStop(1, "rgba(10,10,10,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  g.strokeStyle = "rgba(255,255,255,0.07)";
  g.lineWidth = 1.5;
  const step = size / 24;
  for (let i = 0; i <= 24; i++) {
    g.beginPath();
    g.moveTo(i * step, 0);
    g.lineTo(i * step, size);
    g.moveTo(0, i * step);
    g.lineTo(size, i * step);
    g.stroke();
  }
  // contact shadow under the block
  const half = (size * blockFrac) / 2;
  g.save();
  g.shadowColor = "rgba(0,0,0,0.9)";
  g.shadowBlur = size * 0.04;
  g.fillStyle = "rgba(0,0,0,0.85)";
  g.fillRect(size / 2 - half * 1.04, size / 2 - half * 0.78, half * 2.08, half * 1.56);
  g.restore();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const RIBBON_VERT = `
  attribute vec3 aDir;
  attribute float aSide;
  attribute float aS;
  uniform float uHalfWidth;
  uniform float uScale;
  varying float vS;
  varying float vSide;
  void main() {
    vS = aS;
    vSide = aSide;
    vec3 p = position + aDir * aSide * uHalfWidth * uScale;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
// uProgress = distance walked along the route (world units). Behind it: a solid trail that is brightest at the walker
// and settles over uTail; ahead of it: dashes that flow forward. uCasing draws the dark outline underneath.
const RIBBON_FRAG = `
  uniform vec3 uColor;
  uniform float uProgress, uTail, uTime, uOpacity, uCasing;
  varying float vS;
  varying float vSide;
  void main() {
    float a = abs(vSide);
    float edge = 1.0 - smoothstep(0.62, 1.0, a);
    if (uCasing > 0.5) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, edge * 0.6 * uOpacity);
      #include <colorspace_fragment>
      return;
    }
    float core = 1.0 - smoothstep(0.0, 0.42, a);
    float done = 1.0 - smoothstep(uProgress - 0.12, uProgress + 0.12, vS);
    float behind = clamp((uProgress - vS) / uTail, 0.0, 1.0);
    float aDone = mix(1.0, 0.64, behind);
    // Crisp dashes with real gaps, narrower than the walked trail, flowing forward along the route.
    float ph = fract((vS - uTime * 2.4) / 1.5);
    float dash = smoothstep(0.0, 0.06, ph) * (1.0 - smoothstep(0.46, 0.52, ph));
    float thin = 1.0 - smoothstep(0.28, 0.5, a);
    float aTodo = (0.07 + 0.85 * dash) * thin / max(edge, 0.0001);
    float alpha = mix(aTodo, aDone, done) * edge * uOpacity;
    vec3 col = uColor * mix(0.8, 1.0, core);
    float head = exp(-abs(vS - uProgress) * 2.2) * step(0.001, uProgress);
    col += uColor * head * 0.4;
    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
  }
`;

function buildRibbon(points: THREE.Vector3[], color: string, opacity: number, uWidth: { value: number }, halfWidth: number) {
  const n = points.length;
  const pos = new Float32Array(n * 2 * 3),
    dir = new Float32Array(n * 2 * 3),
    side = new Float32Array(n * 2),
    along = new Float32Array(n * 2);
  let s = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) s += points[i].distanceTo(points[i - 1]);
    const a = points[Math.max(0, i - 1)],
      b = points[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x,
      tz = b.z - a.z;
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;
    for (let k = 0; k < 2; k++) {
      const v = i * 2 + k;
      pos[v * 3] = points[i].x;
      pos[v * 3 + 1] = points[i].y;
      pos[v * 3 + 2] = points[i].z;
      dir[v * 3] = -tz;
      dir[v * 3 + 1] = 0;
      dir[v * 3 + 2] = tx;
      side[v] = k === 0 ? -1 : 1;
      along[v] = s;
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const v = i * 2;
    idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aDir", new THREE.BufferAttribute(dir, 3));
  geo.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
  geo.setAttribute("aS", new THREE.BufferAttribute(along, 1));
  geo.setIndex(idx);
  const mk = (casing: boolean) =>
    new THREE.ShaderMaterial({
      vertexShader: RIBBON_VERT,
      fragmentShader: RIBBON_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: casing ? -1 : -3,
      polygonOffsetUnits: casing ? -1 : -3,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uProgress: { value: 0 },
        uTail: { value: 22 },
        uTime: shared.uTime,
        uOpacity: { value: opacity },
        uCasing: { value: casing ? 1 : 0 },
        uHalfWidth: { value: halfWidth * (casing ? 1.55 : 1) },
        uScale: uWidth, // shared: the render loop sets it from the camera distance
      },
    });
  const casing = new THREE.Mesh(geo, mk(true)),
    line = new THREE.Mesh(geo, mk(false));
  casing.renderOrder = 4;
  line.renderOrder = 5;
  return { meshes: [casing, line], total: s, progress: (line.material as THREE.ShaderMaterial).uniforms.uProgress as { value: number } };
}
const shared = { uTime: { value: 0 } };

export default function Terrain3D({
  site, cost, zone, active, basemapUrl, plan, stops, position, abort, emergency,
  elapsedSec, returnElapsedSec, incidentAt, abortSec,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const three = useRef<Scene3D | null>(null);
  const [exaggeration, setExaggeration] = useState(DEFAULT_EXAGGERATION);
  const [webglOk, setWebglOk] = useState(true);
  const [follow, setFollow] = useState(false);
  const followRef = useRef(false);
  followRef.current = follow;
  const reduced = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const latest = useRef({ site, stops });
  latest.current = { site, stops };

  // Grid geometry shared by every effect.
  const grid = useMemo(() => {
    const { width, height, bounds } = site;
    const dx = site.cellSizeM.x / UNIT_M,
      dz = site.cellSizeM.y / UNIT_M;
    const W = (width - 1) * dx,
      H = (height - 1) * dz;
    const elev = site.layers.elevation;
    let min = Infinity,
      max = -Infinity;
    for (let i = 0; i < elev.length; i++) {
      if (elev[i] < min) min = elev[i];
      if (elev[i] > max) max = elev[i];
    }
    // Box-blurred elevation (about 150 m): where the ground sits below its surroundings we darken it a little.
    const blur = (() => {
      const R = 6;
      const tmp = new Float32Array(elev.length),
        out = new Float32Array(elev.length);
      for (let r = 0; r < height; r++)
        for (let c = 0; c < width; c++) {
          let s = 0, n = 0;
          for (let k = -R; k <= R; k++) {
            const cc = c + k;
            if (cc >= 0 && cc < width) { s += elev[r * width + cc]; n++; }
          }
          tmp[r * width + c] = s / n;
        }
      for (let r = 0; r < height; r++)
        for (let c = 0; c < width; c++) {
          let s = 0, n = 0;
          for (let k = -R; k <= R; k++) {
            const rr = r + k;
            if (rr >= 0 && rr < height) { s += tmp[rr * width + c]; n++; }
          }
          out[r * width + c] = s / n;
        }
      return out;
    })();
    const heightAt = (x: number, z: number, exag: number) => {
      const col = Math.min(width - 1.001, Math.max(0, (x + W / 2) / dx));
      const row = Math.min(height - 1.001, Math.max(0, (z + H / 2) / dz));
      const c0 = Math.floor(col),
        r0 = Math.floor(row),
        fc = col - c0,
        fr = row - r0;
      const e = (r: number, c: number) => elev[r * width + c] - min;
      const top = e(r0, c0) * (1 - fc) + e(r0, c0 + 1) * fc;
      const bot = e(r0 + 1, c0) * (1 - fc) + e(r0 + 1, c0 + 1) * fc;
      return ((top * (1 - fr) + bot * fr) * exag) / UNIT_M;
    };
    const toXZ = (p: LatLng) => ({
      x: ((p.lng - bounds.west) / (bounds.east - bounds.west)) * W - W / 2,
      z: ((bounds.north - p.lat) / (bounds.north - bounds.south)) * H - H / 2,
    });
    return { width, height, dx, dz, W, H, min, max, elev, blur, heightAt, toXZ };
  }, [site]);

  // 1. Renderer, camera, controls, ground, walker and the animation loop (once).
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setWebglOk(false);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    renderer.domElement.className = "terrain-3d__canvas";

    const scene = new THREE.Scene();
    // Distance haze toward the panel background, so far terrain recedes instead of ending abruptly.
    scene.fog = new THREE.Fog(cssColor("--void-deep", cssColor("--void", "#050505")), 150, 400);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 700);
    const controls = new OrbitControls(camera, renderer.domElement);
    const frame = () => {
      const { site: s0, stops: st } = latest.current;
      const pts = [s0.habitat, ...st].map((p) => grid.toXZ(p));
      const xs = pts.map((p) => p.x),
        zs = pts.map((p) => p.z);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2,
        cz = (Math.min(...zs) + Math.max(...zs)) / 2;
      const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
      const dist = Math.min(130, Math.max(52, extent * 1.3 + 34));
      const cy = grid.heightAt(cx, cz, DEFAULT_EXAGGERATION);
      controls.target.set(cx, cy, cz);
      camera.position.set(cx, cy + dist * 0.56, cz + dist * 0.83);
      controls.update();
    };
    frame();
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 8;
    controls.maxDistance = 190;
    controls.enableDamping = false;

    // Ground: a plane that fades out under and around the terrain block.
    const groundSize = 380;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(groundSize, groundSize),
      new THREE.MeshBasicMaterial({
        map: makeGroundTexture((grid.W * 1.0) / groundSize),
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = BASE_Y - 0.03;
    ground.renderOrder = -1;
    scene.add(ground);

    const overlay = new THREE.Group();
    scene.add(overlay);

    // The walker: a beacon that stays visible from any distance, with a pulse ring.
    const safe = cssColor("--safe", "#4fd1ff");
    const walker = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), new THREE.MeshBasicMaterial({ color: safe, fog: false }));
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.1, 48),
      new THREE.MeshBasicMaterial({ color: safe, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, fog: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.25;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 11, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: safe, transparent: true, opacity: 0.4, depthWrite: false, fog: false }),
    );
    beam.position.y = 5.4;
    walker.add(core, ring, beam);
    walker.renderOrder = 8;
    scene.add(walker);

    const uWidth = { value: 1 };
    const detail = makeDetailTexture();
    const widthFor = () => Math.min(2.4, Math.max(0.45, camera.position.distanceTo(controls.target) / 68));
    const render = () => {
      uWidth.value = widthFor();
      walker.scale.setScalar(Math.max(0.5, uWidth.value));
      renderer.render(scene, camera);
    };
    controls.addEventListener("change", render);
    const state: Scene3D = {
      renderer, scene, camera, controls, terrain: null, skirt: null, overlay, walker,
      texture: null, detail, route: null, abortRoute: null, uWidth, render,
    };
    three.current = state;

    const resize = () => {
      const w = el.clientWidth || 1,
        h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    (el as HTMLDivElement & { __reset?: () => void }).__reset = () => {
      frame();
      render();
    };

    // Animation: flowing dashes, the pulse ring and the follow camera. Skipped for reduced-motion users.
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden || now - last < 32) return;
      last = now;
      shared.uTime.value = now / 1000;
      const k = ((now / 1000) % 1.6) / 1.6;
      ring.scale.setScalar(1 + k * 2.2);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.65 * (1 - k);
      if (followRef.current) {
        const d = walker.position.clone().sub(controls.target).multiplyScalar(FOLLOW_EASE);
        controls.target.add(d);
        camera.position.add(d);
        controls.update();
      }
      render();
    };
    if (!reduced) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.removeEventListener("change", render);
      controls.dispose();
      for (const m of [state.terrain, state.skirt]) if (m) { scene.remove(m); disposeObject(m); }
      disposeObject(overlay);
      disposeObject(walker);
      disposeObject(ground);
      (ground.material as THREE.MeshBasicMaterial).map?.dispose();
      state.texture?.dispose();
      detail.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      three.current = null;
    };
  }, []);

  // 2. The same picture the 2D map shows, composed on a canvas and draped on the terrain.
  const drawnZone = useMemo(() => removeSmallIslands(zone, site.width, site.height), [zone, site.width, site.height]);
  useEffect(() => {
    const t3 = three.current;
    if (!t3) return;
    let cancelled = false;
    composeTexture({
      site, cost, basemapUrl, active, zone: drawnZone, emergency,
      monoFont: cssColor("--font-mono", "monospace"),
    }).then((tex) => {
      if (cancelled || three.current !== t3) return tex.dispose();
      tex.anisotropy = t3.renderer.capabilities.getMaxAnisotropy();
      const old = t3.texture;
      t3.texture = tex;
      const mat = t3.terrain?.material as THREE.MeshBasicMaterial | undefined;
      if (mat) {
        mat.map = tex;
        mat.needsUpdate = true;
      }
      old?.dispose();
      t3.render();
    });
    return () => {
      cancelled = true;
    };
  }, [site, cost, basemapUrl, active, drawnZone, emergency, webglOk]);

  // 3. Terrain from the elevation grid: relief shading + cavity shading + fine detail, with a sliced-block edge.
  useEffect(() => {
    const t3 = three.current;
    if (!t3) return;
    const { width, height, dx, dz, W, H, elev, blur, min } = grid;
    const positions = new Float32Array(width * height * 3);
    const uvs = new Float32Array(width * height * 2);
    let maxY = 0;
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const i = r * width + c;
        const y = ((elev[i] - min) * exaggeration) / UNIT_M;
        positions[i * 3] = c * dx - W / 2;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = r * dz - H / 2;
        uvs[i * 2] = c / (width - 1);
        uvs[i * 2 + 1] = 1 - r / (height - 1);
        if (y > maxY) maxY = y;
      }
    }
    const indices = new Uint32Array((width - 1) * (height - 1) * 6);
    let k = 0;
    for (let r = 0; r < height - 1; r++) {
      for (let c = 0; c < width - 1; c++) {
        const a = r * width + c, b = a + 1, d = a + width, e = d + 1;
        indices[k++] = a; indices[k++] = d; indices[k++] = b;
        indices[k++] = b; indices[k++] = d; indices[k++] = e;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();
    // The imagery already carries the real sun shading, so the material is unlit (same brightness as the 2D map).
    // Vertex colours add: a mild slope cue, and cavity shading (ground below its surroundings is darker, ridges a touch lighter).
    const nrm = geo.getAttribute("normal");
    const colors = new Float32Array(width * height * 3);
    const toward = new THREE.Vector3(-0.5, 0.8, 0.35).normalize();
    const cavityScale = 16 / (exaggeration / DEFAULT_EXAGGERATION);
    for (let i = 0; i < width * height; i++) {
      const lit = nrm.getX(i) * toward.x + nrm.getY(i) * toward.y + nrm.getZ(i) * toward.z;
      const slope = Math.min(1.22, Math.max(0.74, 1 + 0.9 * (lit - toward.y)));
      const cav = Math.max(-1, Math.min(1, (blur[i] - elev[i]) / cavityScale)); // > 0 in pits, < 0 on ridges
      const ao = cav > 0 ? 1 - 0.42 * cav : 1 - 0.14 * cav;
      const shade = Math.min(1.3, Math.max(0.5, slope * ao));
      colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = shade;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const old = t3.terrain;
    let mat = old?.material as THREE.MeshBasicMaterial | undefined;
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, map: t3.texture ?? null });
      // Fine regolith grain, tiled across the surface. It is mid-grey noise, so mipmapping averages it away at a
      // distance and it only shows up close. Reads the same UVs as the imagery.
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uDetail = { value: t3.detail };
        shader.uniforms.uDetailRep = { value: new THREE.Vector2((W * UNIT_M) / 40, (H * UNIT_M) / 40) };
        shader.uniforms.uDetailAmt = { value: 0.55 };
        shader.fragmentShader =
          "uniform sampler2D uDetail;\nuniform vec2 uDetailRep;\nuniform float uDetailAmt;\n" +
          shader.fragmentShader.replace(
            "#include <map_fragment>",
            `#include <map_fragment>
             #ifdef USE_MAP
               diffuseColor.rgb *= 1.0 + (texture2D(uDetail, vMapUv * uDetailRep).r - 0.5) * uDetailAmt;
             #endif`,
          );
      };
    }
    const mesh = new THREE.Mesh(geo, mat);
    t3.scene.add(mesh);
    t3.terrain = mesh;
    if (old) {
      t3.scene.remove(old);
      old.geometry.dispose();
    }

    // The block's edge: strata bands from the underside up to the terrain surface.
    const edge: number[] = [],
      eUv: number[] = [];
    const wall = (pts: [number, number, number][]) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [a, b] = [pts[i], pts[i + 1]];
        const va = (a[1] - BASE_Y) / (maxY - BASE_Y || 1),
          vb = (b[1] - BASE_Y) / (maxY - BASE_Y || 1);
        const quad = [
          [a[0], a[1], a[2], 0, va], [b[0], b[1], b[2], 0, vb], [a[0], BASE_Y, a[2], 0, 0],
          [b[0], b[1], b[2], 0, vb], [b[0], BASE_Y, b[2], 0, 0], [a[0], BASE_Y, a[2], 0, 0],
        ];
        for (const q of quad) { edge.push(q[0], q[1], q[2]); eUv.push(q[3], q[4]); }
      }
    };
    const P = (r: number, c: number): [number, number, number] => {
      const i = r * width + c;
      return [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
    };
    wall(Array.from({ length: width }, (_, c) => P(0, c)));
    wall(Array.from({ length: width }, (_, c) => P(height - 1, c)));
    wall(Array.from({ length: height }, (_, r) => P(r, 0)));
    wall(Array.from({ length: height }, (_, r) => P(r, width - 1)));
    const sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(edge), 3));
    sgeo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(eUv), 2));
    const oldSkirt = t3.skirt;
    const strata = (oldSkirt?.material as THREE.MeshBasicMaterial | undefined)?.map ?? makeStrataTexture();
    const skirt = new THREE.Mesh(sgeo, new THREE.MeshBasicMaterial({ map: strata, side: THREE.DoubleSide }));
    t3.scene.add(skirt);
    t3.skirt = skirt;
    if (oldSkirt) {
      t3.scene.remove(oldSkirt);
      oldSkirt.geometry.dispose();
      (oldSkirt.material as THREE.Material).dispose();
    }
    t3.render();
  }, [grid, exaggeration, webglOk]);

  // How many stops the astronaut has reached (drives the visited look of the markers).
  const clockNow = emergency ? (incidentAt ?? 0) : elapsedSec;
  const visited = useMemo(
    () => plan.legs.slice(0, stops.length).filter((l) => l.arriveSec <= clockNow + 0.5).length,
    [plan, stops.length, clockNow],
  );

  // 4. Trail ribbons and markers (rebuilt when the plan changes, not on every playback tick).
  const legPaths = useMemo(() => plan.legs.map((l) => l.path), [plan]);
  useEffect(() => {
    const t3 = three.current;
    if (!t3) return;
    const { overlay } = t3;
    while (overlay.children.length) {
      const child = overlay.children[0];
      overlay.remove(child);
      disposeObject(child);
    }
    const mars = cssColor("--mars", "#ff6b35"),
      safe = cssColor("--safe", "#4fd1ff"),
      text = cssColor("--text", "#eceae6"),
      bg = cssColor("--void-deep", cssColor("--void", "#08090b")),
      mono = cssColor("--font-mono", "monospace");
    const lift = 0.18;
    const drapeLeg = (path: LatLng[]) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < path.length; i++) {
        const a = grid.toXZ(path[i]);
        const b = i + 1 < path.length ? grid.toXZ(path[i + 1]) : a;
        const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.3));
        for (let s = 0; s < (i + 1 < path.length ? steps : 1); s++) {
          const f = s / steps;
          const x = a.x + (b.x - a.x) * f,
            z = a.z + (b.z - a.z) * f;
          pts.push(new THREE.Vector3(x, grid.heightAt(x, z, exaggeration) + lift, z));
        }
      }
      return pts;
    };

    // Planned route: one ribbon over every leg. Remember where each leg starts and ends along it.
    const all: THREE.Vector3[] = [];
    const legMarks: { startIdx: number; endIdx: number }[] = [];
    plan.legs.forEach((leg) => {
      const pts = drapeLeg(leg.path);
      if (!pts.length) {
        legMarks.push({ startIdx: all.length, endIdx: all.length });
        return;
      }
      const startIdx = Math.max(0, all.length - (all.length && pts.length ? 1 : 0));
      if (all.length) pts.shift();
      all.push(...pts);
      legMarks.push({ startIdx, endIdx: all.length - 1 });
    });
    t3.route = null;
    if (all.length > 1) {
      const ribbon = buildRibbon(all, mars, emergency ? 0.55 : 1, t3.uWidth, 0.42);
      overlay.add(...ribbon.meshes);
      const cum = [0];
      for (let i = 1; i < all.length; i++) cum.push(cum[i - 1] + all[i].distanceTo(all[i - 1]));
      t3.route = {
        total: ribbon.total,
        uniforms: { uProgress: ribbon.progress },
        legs: plan.legs.map((l, i) => ({
          startS: cum[legMarks[i].startIdx], endS: cum[legMarks[i].endIdx],
          start: l.arriveSec - l.walkSec, arrive: l.arriveSec, walk: Math.max(1e-6, l.walkSec),
        })),
      };
    }
    // Emergency: the abort walk home, in red.
    t3.abortRoute = null;
    if (emergency && abort.length > 1) {
      const pts = drapeLeg(abort);
      if (pts.length > 1) {
        const ribbon = buildRibbon(pts, "#ff4d5a", 1, t3.uWidth, 0.48);
        overlay.add(...ribbon.meshes);
        t3.abortRoute = { total: ribbon.total, uniforms: { uProgress: ribbon.progress } };
      }
    }

    const label = (txt: string, border: string, fg: string, shape: "circle" | "square", filled: boolean) => {
      const size = 128, cv = document.createElement("canvas");
      cv.width = cv.height = size;
      const g = cv.getContext("2d")!;
      g.fillStyle = filled ? border : bg;
      g.strokeStyle = border;
      g.lineWidth = 9;
      if (shape === "circle") {
        g.beginPath();
        g.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      } else {
        g.fillRect(10, 10, size - 20, size - 20);
        g.strokeRect(10, 10, size - 20, size - 20);
      }
      g.fillStyle = filled ? bg : fg;
      g.font = `700 ${txt.length > 2 ? 34 : 50}px ${mono}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(txt, size / 2, size / 2 + 3);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }),
      );
      sprite.scale.set(0.05, 0.05, 1); // fraction of the viewport height: constant on-screen size at any zoom
      sprite.renderOrder = 10;
      return sprite;
    };
    const pin = (p: LatLng, txt: string, border: string, fg: string, shape: "circle" | "square", filled: boolean, height = 4.2) => {
      const { x, z } = grid.toXZ(p);
      const y = grid.heightAt(x, z, exaggeration);
      overlay.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y, z), new THREE.Vector3(x, y + height, z)]),
          new THREE.LineBasicMaterial({ color: border }),
        ),
      );
      const s = label(txt, border, fg, shape, filled);
      s.position.set(x, y + height + 0.4, z);
      overlay.add(s);
    };
    pin(site.habitat, "H", safe, safe, "square", false, 8.5);
    stops.forEach((s, i) => pin(s, String(i + 1).padStart(2, "0"), mars, text, "circle", i < visited));
    t3.render();
  }, [grid, exaggeration, plan, legPaths, stops, abort, emergency, site, visited, webglOk]);

  // 5. Walker and trail progress (cheap: only sets uniforms and a position).
  useEffect(() => {
    const t3 = three.current;
    if (!t3) return;
    const sFor = (t: number) => {
      const r = t3.route;
      if (!r) return 0;
      let s = 0;
      for (const L of r.legs) {
        if (t >= L.arrive) s = L.endS;
        else if (t > L.start) {
          s = L.startS + ((t - L.start) / L.walk) * (L.endS - L.startS);
          break;
        } else break;
      }
      return s;
    };
    if (t3.route) t3.route.uniforms.uProgress.value = sFor(clockNow);
    if (t3.abortRoute) {
      const f = abortSec && abortSec > 0 ? Math.min(1, returnElapsedSec / abortSec) : 0;
      t3.abortRoute.uniforms.uProgress.value = t3.abortRoute.total * f;
    }
    if (Number.isFinite(position.lat)) {
      const { x, z } = grid.toXZ(position);
      t3.walker.position.set(x, grid.heightAt(x, z, exaggeration) + 0.6, z);
      if (followRef.current && reduced) {
        const d = t3.walker.position.clone().sub(t3.controls.target);
        t3.controls.target.add(d);
        t3.camera.position.add(d);
        t3.controls.update();
      }
    }
    t3.render();
  }, [grid, exaggeration, position, clockNow, returnElapsedSec, abortSec, emergency, plan, abort, reduced, webglOk]);

  if (!webglOk)
    return (
      <div className="terrain-3d terrain-3d--empty" role="status">
        3D view needs WebGL, which this browser or device does not provide. The 2D map is unaffected.
      </div>
    );

  return (
    <div className="terrain-3d">
      <div
        ref={host}
        className="terrain-3d__host"
        role="img"
        aria-label="3D terrain view of the planned route and the walk so far. The 2D map is the planning surface."
      />
      <div className="terrain-3d__hud">
        <label className="terrain-3d__exag">
          <span>Vertical exaggeration</span>
          <input
            type="range"
            min={1}
            max={8}
            step={0.5}
            value={exaggeration}
            aria-label="Vertical exaggeration"
            aria-valuetext={`${exaggeration} times`}
            onChange={(e) => setExaggeration(Number(e.target.value))}
          />
          <b>×{exaggeration}</b>
        </label>
        <button type="button" aria-pressed={follow} onClick={() => setFollow((f) => !f)}>
          Follow
        </button>
        <button
          type="button"
          onClick={() => (host.current as (HTMLDivElement & { __reset?: () => void }) | null)?.__reset?.()}
        >
          Reset view
        </button>
        <small>Drag to orbit · scroll to zoom · right-drag to pan</small>
      </div>
      <div className="terrain-3d__note">
        3D VIEW · HiRISE image over the derived 25 m elevation grid · relief ×{exaggeration} · solid trail = walked, dashes = ahead
      </div>
    </div>
  );
}
