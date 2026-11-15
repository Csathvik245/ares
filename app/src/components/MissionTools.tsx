// "Mission tools": one always-visible row under the oxygen tiles with the three things a
// visitor should not have to hunt for: What if? (the assumption sliders), Briefing (the
// printable one-page plan) and Share (a link to this exact mission).
// It only shows buttons; the app owns what each one does.
import { useEffect, useState, type ReactNode } from "react";
import { rememberWhatIfPulse, whatIfPulseNeeded } from "../lib/missionTools";

export const MISSION_TOOLS_TITLE = "Mission tools";
/** How long the first-visit pulse on What if? lasts. The CSS animation runs for the same time. */
export const WHAT_IF_PULSE_MS = 2000;

const ToolIcon = ({ children }: { children: ReactNode }) => (
  <svg className="mission-tools__icon" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
/** Small inline icons: sliders, a page, a link. */
export const TOOL_ICONS = {
  whatif: (
    <ToolIcon>
      <path d="M2 4.5 H14 M2 11.5 H14" />
      <circle cx="10" cy="4.5" r="1.8" fill="var(--console)" />
      <circle cx="5.5" cy="11.5" r="1.8" fill="var(--console)" />
    </ToolIcon>
  ),
  briefing: (
    <ToolIcon>
      <path d="M4 1.5 H9.5 L12.5 4.5 V14.5 H4 Z" />
      <path d="M6 7.5 H10.5 M6 10.5 H10.5" />
    </ToolIcon>
  ),
  share: (
    <ToolIcon>
      <path d="M6.8 9.2 L9.2 6.8" />
      <path d="M7.6 4.6 L9 3.2 A2.7 2.7 0 0 1 12.8 7 L11.4 8.4" />
      <path d="M8.4 11.4 L7 12.8 A2.7 2.7 0 0 1 3.2 9 L4.6 7.6" />
    </ToolIcon>
  ),
} as const;

type Props = {
  /** The sliders panel is open below the row. */
  whatIfOpen: boolean;
  /** The link was just copied: Share says "Copied" for a moment. */
  copied: boolean;
  /** False during an emergency: there is nothing to re-plan. */
  canWhatIf: boolean;
  canBrief: boolean;
  canShare: boolean;
  onWhatIf: () => void;
  onBriefing: () => void;
  onShare: () => void;
  /** The What if? sliders, when open. */
  children?: ReactNode;
};

/** The row as it appears in the app: it adds the first-visit pulse on What if?. */
export function MissionTools(props: Props) {
  // The first time a plan exists in this browser, pulse the What if? button once.
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (!whatIfPulseNeeded()) return;
    rememberWhatIfPulse();
    setPulse(true);
    const timer = window.setTimeout(() => setPulse(false), WHAT_IF_PULSE_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return <MissionToolsRow {...props} pulse={pulse} />;
}

/** The row itself. No state of its own. */
export function MissionToolsRow({ whatIfOpen, copied, canWhatIf, canBrief, canShare, onWhatIf, onBriefing, onShare, children, pulse = false }: Props & { pulse?: boolean }) {
  return (
    <section className="mission-tools" data-tour="tools" aria-label={MISSION_TOOLS_TITLE}>
      <div className="mission-tools__row">
        <button
          type="button"
          className={`mission-tools__button${whatIfOpen ? " is-open" : ""}${pulse ? " is-pulse" : ""}`}
          aria-expanded={whatIfOpen}
          onClick={onWhatIf}
          disabled={!canWhatIf}
          title={canWhatIf ? "Re-plan with a different suit oxygen supply, walking speed or reserve." : "Reset the emergency to try different assumptions."}
        >
          {TOOL_ICONS.whatif}
          What if?
        </button>
        <button
          type="button"
          className="mission-tools__button"
          onClick={onBriefing}
          disabled={!canBrief}
          title={canBrief ? "Open a one-page briefing of this plan, ready to print or save as PDF." : "Reset the emergency to make a briefing."}
        >
          {TOOL_ICONS.briefing}
          Briefing
        </button>
        <button
          type="button"
          className="mission-tools__button"
          onClick={onShare}
          disabled={!canShare}
          aria-live="polite"
          title="Copy a link that opens this plan: the stops, their science time and the start time."
        >
          {TOOL_ICONS.share}
          {copied ? "Copied" : "Share"}
        </button>
      </div>
      {children}
    </section>
  );
}
