// React hook around the assistant tool loop (assistantLoop.ts).
//
// It keeps the conversation, runs each question through runTurn with a ToolSession
// on the local planner, and exposes what the chat panel draws. It never touches the
// mission state itself: a proposed change to the stops is only handed back as
// `proposal`, for the astronaut to apply or ignore.
//
// Offline rule: with no assistant URL configured, or when the server reports no API
// key, status is "offline", nothing is requested, and the rest of the app is unaffected.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Conditions, Site, Stop } from "../planner";
import { checkOnline, httpTransport, runTurn } from "./assistantLoop";
import type { ChatMessage, Transport } from "./assistantLoop";
import { createToolSession } from "./tools";
import type { PlanSummary } from "./tools";

/** URL of the assistant function. A public address, not a secret. Empty = assistant offline. */
export const ASSISTANT_URL: string = (import.meta.env.VITE_ASSISTANT_URL as string | undefined)?.trim() ?? "";

export type AssistantStatus = "offline" | "checking" | "ready" | "busy";

export type ChatEntry =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "tool"; name: string; ok: boolean }
  | { kind: "error"; text: string };

/** A change to the stops the assistant drafted with its tools. Nothing is applied until the astronaut says so. */
export type Proposal = { stops: Stop[]; summary: PlanSummary };

export type UseAssistantOptions = {
  site: Site;
  /** The stops of the astronaut's current plan. */
  stops: Stop[];
  conditions: Pick<Conditions, "startLmst">;
  /** Override the server URL (default: VITE_ASSISTANT_URL). */
  url?: string;
  /** Override how rounds are sent (tests). When given, the assistant counts as online. */
  transport?: Transport;
};

export function useAssistant({ site, stops, conditions, url = ASSISTANT_URL, transport }: UseAssistantOptions) {
  const [status, setStatus] = useState<AssistantStatus>(transport ? "ready" : url ? "checking" : "offline");
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const history = useRef<ChatMessage[]>([]);
  const send = useMemo(() => transport ?? (url ? httpTransport(url) : null), [transport, url]);

  // One tool session per applied plan: when the astronaut's stops change, the draft starts again from them.
  const { startLmst } = conditions;
  const session = useMemo(() => createToolSession({ site, stops, conditions: { startLmst } }), [site, stops, startLmst]);
  useEffect(() => setProposal(null), [session]);

  // Ask the server once whether it has an API key.
  useEffect(() => {
    if (transport || !url) return;
    const control = new AbortController();
    checkOnline(url, control.signal).then((online) => {
      if (!control.signal.aborted) setStatus(online ? "ready" : "offline");
    });
    return () => control.abort();
  }, [transport, url]);

  const ask = useCallback(
    async (question: string) => {
      const userText = question.trim();
      if (!userText || !send || status !== "ready") return;
      setStatus("busy");
      setEntries((list) => [...list, { kind: "user", text: userText }]);
      const result = await runTurn({
        transport: send,
        session,
        history: history.current,
        userText,
        onToolCall: (call) => setEntries((list) => [...list, { kind: "tool", name: call.name, ok: call.ok }]),
      });
      history.current = result.messages;
      if (result.error) setEntries((list) => [...list, { kind: "error", text: result.error! }]);
      if (result.text) setEntries((list) => [...list, { kind: "assistant", text: result.text }]);
      if (session.changed()) setProposal({ stops: session.stops(), summary: session.summary() });
      setStatus(result.offline ? "offline" : "ready");
    },
    [send, session, status],
  );

  const reset = useCallback(() => {
    history.current = [];
    setEntries([]);
    setProposal(null);
  }, []);

  return { status, entries, proposal, ask, reset, dismissProposal: () => setProposal(null) };
}
