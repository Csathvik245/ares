// The assistant's tool loop, with no React and no fetch built in, so the chat
// panel, the tests and backend/try.ts all run the same code.
//
//   1. Send the conversation and a plan summary to the server.
//   2. If the model asked for tools, run them HERE on the local planner
//      (ToolSession) and send the results back.
//   3. Repeat until the model answers in words.
//
// The model never calculates. This loop never changes the model's turns: each
// assistant turn is stored and sent back exactly as it came, which the API needs.

import type { ToolSession } from "./tools";

/** One content block of a message. Only the fields this loop reads are named. */
export type Block = { type: string; text?: string; id?: string; name?: string; input?: unknown; [key: string]: unknown };
export type ChatMessage = { role: "user" | "assistant"; content: string | Block[] };

/** What the server answers (backend/lib/assistant-core.ts: AssistantReply). */
export type ServerReply =
  | { ok: true; content: Block[]; stopReason: string | null; model?: string }
  | { ok: false; status: number; error: string; offline?: boolean };

export type Transport = (body: { messages: ChatMessage[]; planSummary: unknown }) => Promise<ServerReply>;

export type ToolCall = { name: string; input: unknown; ok: boolean; result: unknown };

export type TurnResult = {
  /** The conversation to keep. On an error it is the history from BEFORE this turn, so a retry is clean. */
  messages: ChatMessage[];
  /** The assistant's answer in words. Empty when there was an error. */
  text: string;
  toolCalls: ToolCall[];
  error?: string;
  /** True when the server says no API key is set (or the key was rejected). */
  offline?: boolean;
};

/** The model may chain tools; this stops a runaway loop. A normal answer needs 1 to 4 rounds. */
export const MAX_ROUNDS = 8;

export async function runTurn(options: {
  transport: Transport;
  session: ToolSession;
  /** The conversation so far (from earlier TurnResult.messages). Not changed. */
  history: ChatMessage[];
  userText: string;
  /** Called as each tool finishes, so the panel can show progress. */
  onToolCall?: (call: ToolCall) => void;
  maxRounds?: number;
}): Promise<TurnResult> {
  const { transport, session, history, userText, onToolCall, maxRounds = MAX_ROUNDS } = options;
  const messages: ChatMessage[] = [...history, { role: "user", content: userText }];
  const toolCalls: ToolCall[] = [];
  const fail = (error: string, offline?: boolean): TurnResult => ({ messages: history, text: "", toolCalls, error, offline });

  for (let round = 0; round < maxRounds; round++) {
    let reply: ServerReply;
    try {
      reply = await transport({ messages, planSummary: session.summary() });
    } catch {
      return fail("The assistant could not be reached.");
    }
    if (!reply.ok) return fail(reply.error, reply.offline);

    messages.push({ role: "assistant", content: reply.content });
    const requested = reply.content.filter((b) => b.type === "tool_use");

    if (reply.stopReason !== "tool_use" || requested.length === 0) {
      const text = reply.content
        .filter((b) => b.type === "text" && typeof b.text === "string")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (reply.stopReason === "max_tokens") {
        return { messages, text: text ? `${text}\n\n(The answer was cut off.)` : "", toolCalls, error: text ? undefined : "The answer was cut off before it started. Ask again." };
      }
      if (!text) return fail("The assistant gave no answer.");
      return { messages, text, toolCalls };
    }

    // Run every requested tool on the local planner and return ALL results in one
    // message. A tool that fails still gets a result, marked as an error, so the
    // model can say "I don't know" instead of guessing.
    const results: Block[] = requested.map((block) => {
      const call: ToolCall = { name: String(block.name), input: block.input, ok: true, result: null };
      try {
        call.result = session.run(call.name, block.input);
      } catch (error) {
        call.ok = false;
        call.result = error instanceof Error ? error.message : "The tool failed.";
      }
      toolCalls.push(call);
      onToolCall?.(call);
      return {
        type: "tool_result",
        tool_use_id: block.id,
        content: call.ok ? JSON.stringify(call.result) : String(call.result),
        ...(call.ok ? {} : { is_error: true }),
      };
    });
    messages.push({ role: "user", content: results });
  }
  return fail("The assistant asked for too many tool calls without answering. Ask a narrower question.");
}

/** Sends each round to the assistant server with fetch. */
export function httpTransport(url: string): Transport {
  return async (body) => {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      return { ok: false, status: 0, error: "The assistant could not be reached.", offline: true };
    }
    try {
      const reply = (await response.json()) as ServerReply;
      if (reply && typeof reply === "object" && typeof reply.ok === "boolean") return reply;
    } catch {
      // fall through: not JSON
    }
    return { ok: false, status: response.status, error: `The assistant server answered with HTTP ${response.status}.` };
  };
}

/** Asks the server whether an API key is configured. Any failure counts as offline. */
export async function checkOnline(url: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "GET", signal });
    if (!response.ok) return false;
    const body = (await response.json()) as { online?: unknown };
    return body.online === true;
  } catch {
    return false;
  }
}
