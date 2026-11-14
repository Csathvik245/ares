import { lazy, Suspense, useRef, type ComponentType } from "react";
import { useMission } from "../lib/MissionContext";
import {
  runAssistantTool,
  type ToolArguments,
  type AssistantState,
} from "../lib/assistant-tools";
import type { Plan } from "../lib/planner";
import { Dialog } from "./Dialog";
type ChatProps = {
  plan: Plan;
  onToolCall: (name: string, args?: ToolArguments) => Promise<unknown>;
};
const modules = import.meta.glob("../ai/ChatPanel.tsx");
const load = modules["../ai/ChatPanel.tsx"];
export const assistantAvailable = !!load;
const Chat = load
  ? lazy(async () => {
      const m = (await load()) as Record<string, ComponentType<ChatProps>>;
      const component = m.ChatPanel ?? m.default;
      if (!component) throw Error("ChatPanel must export ChatPanel or default");
      return { default: component };
    })
  : null;
export function AssistantIntegration({ onClose }: { onClose: () => void }) {
  const m = useMission();
  const toolState = useRef<AssistantState | null>(null);
  toolState.current =
    m.site && m.cost && m.plan
      ? {
          site: m.site,
          cost: m.cost,
          plan: m.plan,
          stops: m.stops,
          emergency: !!m.emergency,
          edit: m.edit,
          stormAt: (t) => m.trigger("storm", t),
        }
      : null;
  if (!Chat || !m.site || !m.cost || !m.plan) return null;
  return (
    <Dialog title="ARES assistant" onClose={onClose}>
      <Suspense fallback={<p role="status">Loading assistant…</p>}>
        <Chat
          plan={m.plan}
          onToolCall={async (name, args = {}) =>
            runAssistantTool(toolState.current!, name, args)
          }
        />
      </Suspense>
    </Dialog>
  );
}
