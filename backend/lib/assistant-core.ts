// The assistant request handler, with no HTTP in it, so backend/try.ts and the
// Vercel function (api/assistant.ts) run exactly the same code.
//
// One call = one model turn. The model either answers, or asks for tools. Tool
// calls go back to the caller; the BROWSER runs them on the local planner and
// sends the results in the next request. This server never runs a planner tool
// and never calculates a number.
//
// The API key is read from the ANTHROPIC_API_KEY environment variable by the SDK.
// It is never in code, never sent to the browser, and never logged.

import Anthropic from "@anthropic-ai/sdk";
import { planContext, SYSTEM_PROMPT } from "./prompt";
import { TOOLS } from "./tools";

/** The model the assistant uses. Named in docs/ai-disclosure.md: keep the two in step. */
export const MODEL = "claude-opus-5-5";
/** Room for the model's reasoning plus a short answer. */
const MAX_TOKENS = 8000;
/** Limits on what one request may contain: this endpoint spends the team's API credit. */
const MAX_MESSAGES = 60;
const MAX_REQUEST_CHARS = 400_000;

type MessageParam = Anthropic.Beta.BetaMessageParam;

export type AssistantRequest = { messages: MessageParam[]; planSummary?: unknown };

export type AssistantReply =
  | {
      ok: true;
      /** The assistant turn, exactly as the model returned it. Send it back unchanged in the next request. */
      content: Anthropic.Beta.BetaContentBlock[];
      /** "tool_use" = run the tool calls in `content` and call again. "end_turn" = the answer is in `content`. */
      stopReason: Anthropic.Beta.BetaMessage["stop_reason"];
      model: string;
    }
  | { ok: false; status: number; error: string; offline?: boolean };

/** True when an API key is configured. The panel shows "Assistant offline" when this is false. */
export function assistantOnline(env: NodeJS.ProcessEnv = process.env): boolean {
  return typeof env.ANTHROPIC_API_KEY === "string" && env.ANTHROPIC_API_KEY.trim().length > 0;
}

function validate(body: unknown): AssistantRequest | string {
  if (!body || typeof body !== "object") return "Request body must be a JSON object.";
  const { messages, planSummary } = body as Record<string, unknown>;
  if (!Array.isArray(messages) || messages.length === 0) return "messages must be a non-empty array.";
  if (messages.length > MAX_MESSAGES) return `Conversation too long (over ${MAX_MESSAGES} messages). Start a new one.`;
  for (const m of messages) {
    if (!m || typeof m !== "object") return "Each message must be an object.";
    const { role, content } = m as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") return "Message roles must be user or assistant.";
    if (typeof content !== "string" && !Array.isArray(content)) return "Message content must be text or blocks.";
  }
  if ((messages[0] as { role: string }).role !== "user") return "The first message must be from the user.";
  if (JSON.stringify(body).length > MAX_REQUEST_CHARS) return "Request too large.";
  return { messages: messages as MessageParam[], planSummary };
}

let client: Anthropic | null = null;

/**
 * Run one model turn. Never throws: every failure comes back as { ok: false } with
 * an HTTP status and a message that is safe to show (no key, no stack trace).
 */
export async function handleAssistant(body: unknown, env: NodeJS.ProcessEnv = process.env): Promise<AssistantReply> {
  if (!assistantOnline(env)) {
    return { ok: false, status: 503, offline: true, error: "Assistant offline: no API key is configured on the server." };
  }
  const request = validate(body);
  if (typeof request === "string") return { ok: false, status: 400, error: request };

  client ??= new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // Thinking is always on for this model; effort sets how much. Explaining a plan
      // from tool results is light work, and a low setting keeps replies quick.
      output_config: { effort: "low" },
      // If the model's safety checks decline a request, let the API retry it on a
      // fallback model instead of failing the turn.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        { type: "text", text: SYSTEM_PROMPT },
        { type: "text", text: planContext(request.planSummary) },
      ],
      tools: TOOLS,
      messages: request.messages,
    });
    if (response.stop_reason === "refusal") {
      return { ok: false, status: 422, error: "The assistant declined to answer that." };
    }
    return { ok: true, content: response.content, stopReason: response.stop_reason, model: response.model };
  } catch (error) {
    // Most specific first. Messages here are shown in the panel, so they stay general.
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      return { ok: false, status: 503, offline: true, error: "Assistant offline: the server's API key was rejected." };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, status: 429, error: "The assistant is busy. Try again in a moment." };
    }
    if (error instanceof Anthropic.BadRequestError) {
      return { ok: false, status: 400, error: "The assistant could not read that conversation. Start a new one." };
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return { ok: false, status: 502, error: "The assistant could not be reached. Try again." };
    }
    if (error instanceof Anthropic.APIError) {
      return { ok: false, status: 502, error: "The assistant service returned an error. Try again." };
    }
    return { ok: false, status: 500, error: "The assistant failed unexpectedly." };
  }
}
