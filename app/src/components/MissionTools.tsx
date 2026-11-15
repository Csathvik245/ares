// "Mission tools": a small floating toolbar at the top centre of the map with the three
// things a visitor should not have to hunt for: What if? (the assumption sliders, in a
// popover under the toolbar), Briefing (the printable one-page plan) and Share (a link to
// this exact mission). It only shows buttons; the app owns what each one does.
import { useEffect, useRef, useState, type ReactNode } from "react";
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
      <circle cx="10" cy="4.5" r="1.8" fill="var(--void)" />
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
  /** The What if? sliders, shown in the popover when open. */
  children?: ReactNode;
};
/** The gap between the storm banner and the toolbar under it, px. */
export const BANNER_GAP_PX = 8;

/**
 * The toolbar as it appears on the map. It adds what needs the browser: the first-visit
 * pulse on What if?, closing the popover on Esc or a click outside, and, during an
 * emergency, sitting just under the storm banner instead of over it.
 */
export function MissionTools({ onCloseWhatIf, underBanner = false, ...props }: Props & { onCloseWhatIf: () => void; underBanner?: boolean }) {
  // The first time a plan exists in this browser, pulse the What if? button once.
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (!whatIfPulseNeeded()) return;
    rememberWhatIfPulse();
    setPulse(true);
    const timer = window.setTimeout(() => setPulse(false), WHAT_IF_PULSE_MS);
    return () => window.clearTimeout(timer);
  }, []);
  // The popover closes on Esc or a click anywhere outside the toolbar.
  const root = useRef<HTMLDivElement>(null);
  const open = props.whatIfOpen;
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseWhatIf();
    };
    const onDown = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) onCloseWhatIf();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, onCloseWhatIf]);
  // During an emergency the storm banner lies across the top of the map: sit just under it.
  const [top, setTop] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!underBanner) {
      setTop(undefined);
      return;
    }
    const banner = root.current?.parentElement?.querySelector<HTMLElement>(".storm-alert");
    if (!banner) return;
    const place = () => setTop(banner.offsetTop + banner.offsetHeight + BANNER_GAP_PX);
    place();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(place);
    observer.observe(banner);
    return () => observer.disconnect();
  }, [underBanner]);
  return <MissionToolsRow {...props} pulse={pulse} top={top} rootRef={root} />;
}

/** The toolbar itself. No state of its own. */
export function MissionToolsRow({
  whatIfOpen,
  copied,
  canWhatIf,
  canBrief,
  canShare,
  onWhatIf,
  onBriefing,
  onShare,
  children,
  pulse = false,
  top,
  rootRef,
}: Props & { pulse?: boolean; top?: number; rootRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div className="mission-tools" data-tour="tools" ref={rootRef} style={top === undefined ? undefined : { top }}>
      <div className="mission-tools__row" role="toolbar" aria-label={MISSION_TOOLS_TITLE}>
        <button
          type="button"
          className={`mission-tools__button${whatIfOpen ? " is-open" : ""}${pulse ? " is-pulse" : ""}`}
          aria-expanded={whatIfOpen}
          aria-controls="mission-tools-whatif"
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
      {whatIfOpen && children && (
        <div className="mission-tools__popover" id="mission-tools-whatif" role="dialog" aria-label="What if?">
          {children}
        </div>
      )}
    </div>
  );
}
