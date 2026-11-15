import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { setLenis } from "./lib/scroll";
import { useReducedMotion } from "./lib/useReducedMotion";
import { Starfield } from "./components/Starfield";
import { Nav } from "./components/Nav";
import { HeroScrub } from "./components/HeroScrub";
import { Manifesto } from "./components/Manifesto";
import { Capabilities } from "./components/Capabilities";
import { CaseStudy } from "./components/CaseStudy";
import { Sources } from "./components/Sources";
import { Cta } from "./components/Cta";

gsap.registerPlugin(ScrollTrigger);

export default function App() {
  const reduced = useReducedMotion();

  useEffect(() => {
    // Top progress line: always on, even with reduced motion (it's information, not decoration).
    const bar = document.getElementById("scroll-progress");
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      if (bar) bar.style.transform = `scaleX(${p})`;
    };
    window.addEventListener("scroll", update, { passive: true });
    update();

    let lenis: Lenis | null = null;
    let tick: ((t: number) => void) | null = null;
    if (!reduced) {
      lenis = new Lenis({ lerp: 0.1 });
      setLenis(lenis);
      lenis.on("scroll", ScrollTrigger.update);
      tick = (t: number) => lenis!.raf(t * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    }

    return () => {
      window.removeEventListener("scroll", update);
      if (tick) gsap.ticker.remove(tick);
      lenis?.destroy();
      setLenis(null);
    };
  }, [reduced]);

  return (
    <>
      <Starfield />
      <Nav />
      <main id="top">
        <HeroScrub />
        <Manifesto />
        <Capabilities />
        <CaseStudy />
        <Sources />
        <Cta />
      </main>
    </>
  );
}
