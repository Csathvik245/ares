import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "../lib/useReducedMotion";

gsap.registerPlugin(ScrollTrigger);

const TEXT =
  "We build the tools that bring people home. Eight hours of oxygen, four kilometres of unknown terrain, and a plan that has to end at the airlock door.";

/** Words light up one by one as you scroll through a pinned paragraph. */
export function Manifesto() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const words = TEXT.split(" ");

  useEffect(() => {
    if (reduced) return;
    const section = sectionRef.current;
    if (!section) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".manifesto__word",
        { opacity: 0.16 },
        {
          opacity: 1,
          ease: "none",
          stagger: 0.12,
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.3,
          },
        },
      );
    }, section);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <section ref={sectionRef} className="manifesto" id="studio" aria-label="Studio manifesto">
      <div className="manifesto__sticky">
        <p className="eyebrow">The studio</p>
        <p className="manifesto__text">
          {words.map((w, i) => (
            <span key={i} className="manifesto__word">
              {w}{" "}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
