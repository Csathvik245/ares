/**
 * Procedural stand-in for the generated descent film.
 * Draws one frame of "stars streak past, then terrain ridges rise" for scroll progress p (0..1).
 * It is an illustration, not NASA imagery. When real frames exist (VITE_FRAME_COUNT > 0)
 * HeroScrub draws those instead.
 */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Star = { x: number; y: number; z: number };
const rand = rng(7);
const STARS: Star[] = Array.from({ length: 420 }, () => ({
  x: rand() * 2 - 1,
  y: rand() * 2 - 1,
  z: rand(),
}));

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function ridge(x: number, i: number, phase: number) {
  return (
    Math.sin(x * 0.006 + i * 1.7 + phase) * 0.6 +
    Math.sin(x * 0.013 + i * 0.9 - phase * 1.3) * 0.3 +
    Math.sin(x * 0.027 + i * 2.3) * 0.1
  );
}

export function drawDescent(c: CanvasRenderingContext2D, W: number, H: number, p: number) {
  c.fillStyle = "#08090b";
  c.fillRect(0, 0, W, H);

  // 1. Stars streak outward from the centre while we "fall" toward the planet.
  const warp = clamp01(p / 0.6);
  const starAlpha = 1 - smooth(0.45, 0.85, p);
  if (starAlpha > 0.01) {
    const cx = W / 2;
    const cy = H / 2;
    c.lineCap = "round";
    for (const s of STARS) {
      const k = 1.5 + 3 * s.z;
      const x1 = cx + s.x * cx * (1 + warp * k);
      const y1 = cy + s.y * cy * (1 + warp * k);
      const x0 = cx + s.x * cx * (1 + Math.max(0, warp - 0.07) * k);
      const y0 = cy + s.y * cy * (1 + Math.max(0, warp - 0.07) * k);
      if (x1 < 0 || x1 > W || y1 < 0 || y1 > H) continue;
      c.strokeStyle = `rgba(236,234,230,${(starAlpha * (0.22 + 0.6 * s.z)).toFixed(3)})`;
      c.lineWidth = 0.6 + s.z * 1.1;
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x1, y1);
      c.stroke();
    }
  }

  // 2. Ridges rise from below: painter's algorithm, far to near.
  const t = smooth(0.25, 0.95, p);
  if (t > 0.001) {
    const horizon = H * (0.8 - 0.3 * t);
    const lines = 26;
    for (let i = 0; i < lines; i++) {
      const d = i / (lines - 1);
      const y = horizon + (H - horizon) * Math.pow(d, 2.2);
      const amp = (6 + 64 * d * d) * t;
      const alpha = (0.1 + 0.55 * d) * t;
      c.beginPath();
      c.moveTo(0, H);
      for (let x = 0; x <= W; x += 16) {
        c.lineTo(x, y + amp * ridge(x, i, t * 3));
      }
      c.lineTo(W, H);
      c.closePath();
      c.fillStyle = "#08090b";
      c.fill();
      c.beginPath();
      for (let x = 0; x <= W; x += 16) {
        const yy = y + amp * ridge(x, i, t * 3);
        if (x === 0) c.moveTo(x, yy);
        else c.lineTo(x, yy);
      }
      c.strokeStyle = `rgba(255,107,53,${alpha.toFixed(3)})`;
      c.lineWidth = 0.8 + d * 1.2;
      c.stroke();
    }

    // 3. HAB-1 marker appears at the very end (cyan square = habitat, per design tokens).
    const m = smooth(0.88, 0.98, p);
    if (m > 0.01) {
      const hx = W * 0.62;
      const hy = horizon + (H - horizon) * 0.38;
      c.globalAlpha = m;
      c.strokeStyle = "#4fd1ff";
      c.lineWidth = 2;
      c.strokeRect(hx - 9, hy - 9, 18, 18);
      c.fillStyle = "rgba(79,209,255,0.18)";
      c.fillRect(hx - 9, hy - 9, 18, 18);
      c.font = "500 15px 'JetBrains Mono', monospace";
      c.fillStyle = "#4fd1ff";
      c.fillText("HAB-1", hx + 18, hy + 5);
      c.globalAlpha = 1;
    }
  }
}
