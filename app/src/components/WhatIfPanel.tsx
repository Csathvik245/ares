// "What if?": three sliders that re-plan the walk with a different suit oxygen supply,
// walking speed or reserve, to show how much our assumptions change the answer.
// It only sets the values; the planner (planRoute's `whatIf` option) does the working out.
import { WHAT_IF_DEFAULTS, formatMinutes, roundHalfUp, type WhatIf } from "../planner";

type Values = Required<WhatIf>;

/** The three sliders: range, step, and how a value is written. Walking speed is shown as a percentage change. */
export const WHAT_IF_SLIDERS = [
  {
    key: "consumableHours",
    label: "Suit oxygen",
    min: 6,
    max: 10,
    step: 0.5,
    toSlider: (v: number) => v,
    fromSlider: (s: number) => s,
    show: (v: number) => `${roundHalfUp(v, 1)} h`,
  },
  {
    key: "speedFactor",
    label: "Walking speed",
    min: -30,
    max: 30,
    step: 5,
    toSlider: (v: number) => roundHalfUp((v - 1) * 100),
    fromSlider: (s: number) => 1 + s / 100,
    show: (v: number) => {
      const pct = roundHalfUp((v - 1) * 100);
      return pct === 0 ? "normal" : `${pct > 0 ? "+" : "−"}${Math.abs(pct)}%`;
    },
  },
  {
    key: "reserveMin",
    label: "Reserve",
    min: 30,
    max: 60,
    step: 5,
    toSlider: (v: number) => v,
    fromSlider: (s: number) => s,
    show: (v: number) => formatMinutes(v * 60),
  },
] as const;

export const WHAT_IF_TAG = "What-if values";
export const WHAT_IF_INVITE = "Try the What if? sliders to see how our assumptions change the answer.";

/** The small amber tag shown beside the status while any slider is off its default. */
export function WhatIfTag() {
  return (
    <span className="whatif-tag" title="This plan uses the What if? slider values, not the planner's own assumptions.">
      {WHAT_IF_TAG}
    </span>
  );
}

export function WhatIfPanel({
  values,
  active,
  disabled = false,
  onChange,
  onReset,
}: {
  /** What the sliders show now (it follows the hand at once; the plan follows a moment later). */
  values: Values;
  /** True when any value is off its default. */
  active: boolean;
  /** No plan, or an emergency is running: nothing to re-plan. */
  disabled?: boolean;
  onChange: (patch: WhatIf) => void;
  onReset: () => void;
}) {
  return (
    <section className={`whatif${active ? " is-active" : ""}`} aria-label="What if?">
      <div className="whatif__head">
        <span>What if?</span>
        <button type="button" className="text-button whatif__reset" onClick={onReset} disabled={!active}>
          Reset to defaults
        </button>
      </div>
      {WHAT_IF_SLIDERS.map((s) => {
        const value = values[s.key];
        const standard = WHAT_IF_DEFAULTS[s.key];
        const changed = value !== standard;
        return (
          <label key={s.key} className={`whatif__row${changed ? " is-changed" : ""}`}>
            <span className="whatif__label">{s.label}</span>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={s.toSlider(value)}
              disabled={disabled}
              aria-valuetext={s.show(value)}
              onChange={(event) => onChange({ [s.key]: s.fromSlider(Number(event.target.value)) })}
            />
            <output className="whatif__value">{s.show(value)}</output>
            <small className="whatif__default">default {s.show(standard)}</small>
          </label>
        );
      })}
      <p className="whatif__note">
        {disabled
          ? "Add a route, and reset any emergency, to try these."
          : active
            ? "These are not our planning values. Emergencies, suggestions and Mission reliability are off until you reset."
            : "Move a slider to re-plan with a different assumption."}
      </p>
    </section>
  );
}
