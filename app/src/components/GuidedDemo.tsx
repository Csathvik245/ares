// Guided demo: a small caption card over the map that walks through the demo story in
// four steps (plan, reliability, dust storm, walk home), driving the real app.
// Mount it once inside the map area; start it with startGuidedDemo().
// Keys while it is open: → next, ← back, Esc exit.
import { useEffect, useRef, useState } from "react";
import { useMission } from "../lib/MissionContext";
import {
  GUIDED_STEP_COUNT,
  GUIDED_STEP_NOTES,
  guidedCaption,
  newDemoMemo,
  onGuidedDemoStart,
  settleStep,
  startGuidedDemo,
  type DemoMission,
} from "../lib/guided-demo";
import "./guided-demo.css";

export { startGuidedDemo };

/** The card itself, with no app state: what GuidedDemo shows for one step. */
export function GuidedDemoCard({
  step,
  caption,
  note,
  onBack,
  onNext,
  onExit,
}: {
  step: number;
  caption: string;
  note?: string;
  onBack: () => void;
  onNext: () => void;
  onExit: () => void;
}) {
  const last = step === GUIDED_STEP_COUNT;
  return (
    <aside className="guided-demo" role="region" aria-label="Guided demo">
      <p className="guided-demo__step">
        Step {step} of {GUIDED_STEP_COUNT}
      </p>
      <p className="guided-demo__caption" aria-live="polite">
        {caption}
      </p>
      {note && <p className="guided-demo__note">{note}</p>}
      <div className="guided-demo__actions">
        <button type="button" onClick={onBack} disabled={step === 1}>
          Back
        </button>
        <button type="button" className="guided-demo__next" onClick={last ? onExit : onNext}>
          {last ? "Explore on your own" : "Next"}
        </button>
        {!last && (
          <button type="button" onClick={onExit}>
            Exit
          </button>
        )}
      </div>
    </aside>
  );
}

export function GuidedDemo() {
  const m = useMission();
  // 0 = closed; 1 to 4 = the step on screen.
  const [step, setStep] = useState(0);
  const memo = useRef(newDemoMemo());

  // startGuidedDemo() opens the card at step 1 with a fresh run.
  useEffect(
    () =>
      onGuidedDemoStart(() => {
        memo.current = newDemoMemo();
        setStep(1);
      }),
    [],
  );

  // After every change, move the app one action closer to what the step needs.
  const mission: DemoMission = m;
  useEffect(() => {
    if (step > 0) settleStep(step, mission, memo.current);
  });

  useEffect(() => {
    if (step === 0) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === "ArrowRight") setStep((s) => Math.min(GUIDED_STEP_COUNT, s + 1));
      else if (event.key === "ArrowLeft") setStep((s) => Math.max(1, s - 1));
      else if (event.key === "Escape") setStep(0);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  if (step === 0) return null;
  return (
    <GuidedDemoCard
      step={step}
      caption={guidedCaption(step, mission)}
      note={GUIDED_STEP_NOTES[step]}
      onBack={() => setStep((s) => Math.max(1, s - 1))}
      onNext={() => setStep((s) => Math.min(GUIDED_STEP_COUNT, s + 1))}
      onExit={() => setStep(0)}
    />
  );
}
