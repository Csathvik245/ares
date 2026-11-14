import { SafeReturnDemo } from "./SafeReturnDemo";

const features = [
  { n: "01", t: "Layered map", d: "Real Mars imagery with toggleable analysis layers. Each one names its data type and source mission." },
  { n: "02", t: "Route planner", d: "Click to add stops, set dwell time. The fastest safe route runs habitat → stops → habitat around steep slopes, boulders and soft sand." },
  { n: "03", t: "Safe-return zone", d: "A cyan boundary of everywhere still reachable with a safe walk home. It shrinks as stops are added." },
  { n: "04", t: "Status light", d: "GO, CAUTION or NO-GO, always with the reason written out. Never colour alone." },
  { n: "05", t: "Emergencies", d: "Dust storm and solar particle event: the zone collapses and an abort route home appears from the current position." },
  { n: "06", t: "Helmet HUD", d: "A minimal full-screen view: heading arrow, distance to the next stop, oxygen, margin and dose." },
];

export function CaseStudy() {
  return (
    <section className="section" id="ares" aria-labelledby="ares-title">
      <div className="wrap">
        <p className="eyebrow">Case study 01 · Flagship</p>
        <h2 id="ares-title" className="h2">
          ARES: Google Maps for an astronaut walking on Mars.
        </h2>
        <p className="lede">
          It also tells you how much oxygen you will have left and when you must turn back. Built for NASA Space Apps
          Challenge 2026, at Jezero Crater&apos;s ancient river delta. Drag the sliders and watch the safe-return zone shrink.
        </p>

        <SafeReturnDemo />

        <ul className="feat">
          {features.map((f) => (
            <li key={f.n} className="feat__item">
              <span className="feat__n">{f.n}</span>
              <h3>{f.t}</h3>
              <p>{f.d}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
