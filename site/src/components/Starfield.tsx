import { useEffect, useRef } from "react";

/** Fixed, quiet background: sparse static stars with a slight scroll parallax. */
export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const c = canvas.getContext("2d");
    if (!c) return;

    let s = 11;
    const rand = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    const stars = Array.from({ length: 180 }, () => ({ x: rand(), y: rand(), z: rand() }));

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      draw();
    };

    function draw() {
      if (!c) return;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      const sy = window.scrollY;
      for (const st of stars) {
        const y = (((st.y * h - sy * (0.02 + st.z * 0.06)) % h) + h) % h;
        c.fillStyle = `rgba(236,234,230,${(0.12 + st.z * 0.45).toFixed(3)})`;
        const r = 0.4 + st.z * 0.9;
        c.fillRect(st.x * w, y, r, r);
      }
    }

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return <canvas ref={ref} className="starfield" aria-hidden="true" />;
}
