import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMission } from "../lib/MissionContext";
import type { Plan, Site, Stop } from "../planner";
import { useAssistant } from "./useAssistant";
import "./chat.css";

export type ChatPanelProps = {
  /** The astronaut's current plan. Its status is always shown above the chat: the planner decides. */
  plan: Plan;
  /**
   * Called with the proposed stops when the astronaut presses Apply.
   * Left out, the panel applies them through the mission state's own edit().
   */
  onApplyStops?: (stops: Stop[]) => void;
};

const STARTERS = ["Why this route?", "Can I add another clay stop?", "What if a dust storm hits at stop 2?"];

/** Tool names as short labels for the activity lines. */
const TOOL_LABEL: Record<string, string> = {
  get_plan_summary: "read the plan",
  add_stop: "drafted an added stop",
  remove_stop: "drafted a removed stop",
  reorder_stops: "drafted a new stop order",
  explain_route: "read a leg's terrain",
  simulate_storm: "ran a dust storm on the planner",
  explain_layer: "read a layer's source",
  score_stops: "scored the stops",
  suggest_stops: "asked the planner for stops",
};

/**
 * ARES assistant chat. It explains the plan using the local planner's tools and
 * never decides: it shows the planner's status, and any change it drafts waits for
 * the astronaut to press Apply.
 *
 * With no assistant server or no API key it shows "Assistant offline" and does nothing.
 */
export function ChatPanel(props: ChatPanelProps) {
  const m = useMission();
  if (!m.site) return null;
  return <Chat {...props} site={m.site} stops={m.stops} startLmst={m.conditions.startLmst} applyDefault={m.edit} />;
}

function Chat({
  plan,
  onApplyStops,
  site,
  stops,
  startLmst,
  applyDefault,
}: ChatPanelProps & { site: Site; stops: Stop[]; startLmst: number; applyDefault: (stops: Stop[]) => void }) {
  const assistant = useAssistant({ site, stops, conditions: { startLmst } });
  const { status, entries, proposal } = assistant;
  const [draft, setDraft] = useState("");
  const log = useRef<HTMLDivElement>(null);

  // Keep the newest line in view.
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, status]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const question = draft;
    setDraft("");
    void assistant.ask(question);
  };

  const offline = status === "offline";
  const busy = status === "busy";

  return (
    <section className="ares-chat" aria-label="ARES assistant">
      <header className="ares-chat__header">
        <span className="ares-chat__title">ARES ASSISTANT</span>
        <span className={`ares-chat__state ares-chat__state--${status}`}>
          {offline ? "OFFLINE" : status === "checking" ? "CHECKING" : busy ? "WORKING" : "ONLINE"}
        </span>
      </header>

      <p className="ares-chat__rule">Explains the plan. Never decides. Every number comes from the planner.</p>

      <div className="ares-chat__planner" aria-label="Planner status">
        <span>PLANNER STATUS</span>
        <strong className={`ares-chat__status ares-chat__status--${plan.status}`}>{plan.status}</strong>
        <span className="ares-chat__reason">{plan.reasons[0] ?? ""}</span>
      </div>

      {offline ? (
        <div className="ares-chat__offline" role="status">
          <strong>Assistant offline</strong>
          <p>No assistant server or API key is configured. Planning, the map, playback and emergencies all work as normal.</p>
        </div>
      ) : (
        <>
          <div className="ares-chat__log" ref={log} role="log" aria-live="polite" aria-busy={busy}>
            {entries.length === 0 && (
              <div className="ares-chat__starters">
                <span>Ask about the plan, for example:</span>
                {STARTERS.map((q) => (
                  <button key={q} type="button" disabled={status !== "ready"} onClick={() => void assistant.ask(q)}>
                    {q}
                  </button>
                ))}
              </div>
            )}
            {entries.map((entry, i) =>
              entry.kind === "tool" ? (
                <p key={i} className={`ares-chat__tool${entry.ok ? "" : " ares-chat__tool--failed"}`}>
                  planner · {TOOL_LABEL[entry.name] ?? entry.name}
                  {entry.ok ? "" : " · could not answer"}
                </p>
              ) : (
                <div key={i} className={`ares-chat__line ares-chat__line--${entry.kind}`}>
                  <span className="ares-chat__who">
                    {entry.kind === "user" ? "YOU" : entry.kind === "assistant" ? "ARES" : "ERROR"}
                  </span>
                  <p>{entry.text}</p>
                </div>
              ),
            )}
            {busy && <p className="ares-chat__tool">working…</p>}
          </div>

          {proposal && (
            <div className="ares-chat__proposal" role="group" aria-label="Proposed change to the stops">
              <div className="ares-chat__proposal-head">
                <span>PROPOSED STOPS · NOT APPLIED</span>
                <strong className={`ares-chat__status ares-chat__status--${proposal.summary.status}`}>
                  {proposal.summary.status}
                </strong>
              </div>
              <ol>
                {proposal.summary.stops.map((s) => (
                  <li key={s.id}>
                    <span className="ares-chat__num">{String(s.number).padStart(2, "0")}</span>
                    <span>{s.label}</span>
                    <span className="ares-chat__num">{s.arriveAt}</span>
                  </li>
                ))}
              </ol>
              <p className="ares-chat__proposal-facts">
                <span className="ares-chat__num">{proposal.summary.distance}</span> ·{" "}
                <span className="ares-chat__num">{proposal.summary.duration}</span> · margin{" "}
                <span className="ares-chat__num">{proposal.summary.oxygenMargin}</span>
              </p>
              <p className="ares-chat__reason">{proposal.summary.reasons[0] ?? ""}</p>
              <div className="ares-chat__proposal-actions">
                <button
                  type="button"
                  onClick={() => {
                    (onApplyStops ?? applyDefault)(proposal.stops);
                    assistant.dismissProposal();
                  }}
                >
                  Apply to plan
                </button>
                <button type="button" onClick={assistant.dismissProposal}>
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <form className="ares-chat__form" onSubmit={submit}>
            <label className="ares-chat__sr" htmlFor="ares-chat-input">
              Question for the ARES assistant
            </label>
            <input
              id="ares-chat-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={status === "checking" ? "Checking the assistant…" : "Ask about the plan"}
              disabled={status !== "ready"}
              maxLength={500}
              autoComplete="off"
            />
            <button type="submit" disabled={status !== "ready" || !draft.trim()}>
              Send
            </button>
            {entries.length > 0 && (
              <button type="button" disabled={busy} onClick={assistant.reset}>
                Clear
              </button>
            )}
          </form>
        </>
      )}
    </section>
  );
}

export default ChatPanel;
