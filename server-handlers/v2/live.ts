/* V2 live-serving runner (2026-06-09).
 *
 * Companion to shadow.ts. Where shadow runs v2 fire-and-forget for
 * telemetry, this module runs v2 to produce a response that's actually
 * served to the user. The caller (_response-pipeline.ts) gates on
 * shouldRouteV2() and only invokes us for sessions in the ramp cohort.
 *
 * Contract: tryRunV2Live RESOLVES with either a valid v2 result OR
 * null (never throws). null means "fall back to v1" — the caller does
 * not need to wrap us in try/catch; we own all error swallowing so the
 * call site stays a one-liner. The trade is that we lose stack traces
 * unless the caller checks the telemetry event we fire on failure. */

import { captureServerEvent } from "../_posthog";
import type { GenerateAiTextFn } from "../_response-pipeline";
import type { NegotiationState } from "../_negotiation-kernel";
import { computeBand, type ConversationTurn, type DerivedState } from "./kernel";
import { generateTurn, type LlmAdapter, type LlmInput } from "./orchestrator";
import { assertHonestMove } from "./rail";
import type { ToolCall } from "./tools";

function adaptLog(state: NegotiationState): ConversationTurn[] {
  return state.conversationLog.map((t) => ({
    role: t.speaker === "ai" ? "ai" : "candidate",
    text: t.text,
  }));
}

function buildAdapter(generateAiText: GenerateAiTextFn, userId: string): LlmAdapter {
  return async (input: LlmInput): Promise<ToolCall> => {
    const userPrompt = buildUserPrompt(input);
    const raw = await generateAiText(input.systemPrompt, userPrompt, {
      temperature: 0.2,
      userId,
    });
    return parseToolCall(raw);
  };
}

function buildUserPrompt(input: LlmInput): string {
  const log = input.conversationLog
    .map((t) => `${t.role === "ai" ? "Recruiter" : "Candidate"}: ${t.text}`)
    .join("\n");
  const rejection = input.lastRejection
    ? `\n\nYour previous pick was REJECTED: tool=${input.lastRejection.tool} reason=${input.lastRejection.reason}. Pick differently.`
    : "";
  return `Conversation so far:\n${log}\n\nState scalars:
  turn_index: ${input.state.turnIndex}
  offer_ask_count: ${input.state.offerAskCount}
  has_anchored: ${input.state.hasAnchored}
  last_anchor_lpa: ${input.state.lastAnchorLpa ?? "null"}
  candidate_target: ${input.state.candidateTarget ?? "null"}
  verbal_acceptance_turn: ${input.state.verbalAcceptanceTurn ?? "null"}

Band: walk-away ${input.band.walkAway} LPA, initial ${input.band.initialOffer} LPA, stretch ${input.band.maxStretch} LPA.

Legal tools for this turn (you MUST pick exactly one): ${input.legalTools.join(", ")}${rejection}

Respond with ONLY a JSON object, no prose:
  { "name": "<tool_name>", "args": { ... } }`;
}

function parseToolCall(raw: string): ToolCall {
  const trimmed = raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const m = trimmed.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`no JSON object in LLM response: ${raw.slice(0, 200)}`);
  const obj = JSON.parse(m[0]) as { name?: unknown; args?: unknown };
  if (typeof obj.name !== "string") throw new Error("missing 'name'");
  if (!obj.args || typeof obj.args !== "object") throw new Error("missing 'args'");
  return { name: obj.name, args: obj.args } as ToolCall;
}

function countOfferAsks(state: NegotiationState): number {
  return state.conversationLog.filter((t) => t.speaker !== "ai" && /\b(give|share|tell)\s+(me\s+)?(your\s+)?(initial\s+)?offer\b/i.test(t.text)).length;
}

/** v2 live result, narrowed to what the response pipeline needs. */
export interface V2LiveResult {
  text: string;
  lpa?: number;
  tool: string;
  railPassed: boolean;
  railReason?: string;
}

/** Run v2 for live serving. Returns null on any failure — caller falls
 *  back to v1. Telemetry fires on both success and failure so the
 *  rollout owner can see ramp health on the PostHog dashboard. */
export async function tryRunV2Live(
  state: NegotiationState,
  generateAiText: GenerateAiTextFn,
  distinctId: string,
): Promise<V2LiveResult | null> {
  try {
    const band = computeBand(
      state.role ?? "",
      state.company ?? "",
      undefined,
      state.candidateApplicableYoe ?? null,
    );
    const log = adaptLog(state);
    const adapter = buildAdapter(generateAiText, distinctId);
    const result = await generateTurn(log, band, adapter);
    const railState: DerivedState = {
      turnIndex: state.turnIndex,
      offerAskCount: countOfferAsks(state),
      hasAnchored: state.highestOfferMade > 0,
      lastAnchorLpa: state.highestOfferMade || null,
      candidateTarget: state.candidateTarget ?? null,
      verbalAcceptanceTurn: state.verbalAcceptanceTurn ?? null,
      mentionedNumbers: [],
      surfacedTopics: [],
      closedTopics: [],
    };
    const verdict = assertHonestMove(result, railState);

    void captureServerEvent("negotiation_v2_live_turn", distinctId, {
      session_id: state.sessionId ?? "unknown",
      turn_index: state.turnIndex,
      v2_tool: result.tool,
      v2_lpa: result.lpa ?? null,
      rail_pass: verdict.pass,
      rail_reason: verdict.pass ? null : verdict.reason,
      first_pick_accepted: result.firstPickAccepted,
      llm_calls: result.llmCalls,
    });

    /* If the rail rejected the v2 move, do NOT serve it. The whole
     * point of the rail is to be the last line of defense; bypassing
     * it for the sake of "ramping" defeats the architecture. */
    if (!verdict.pass) return null;

    return {
      text: result.canonical,
      lpa: result.lpa,
      tool: result.tool,
      railPassed: true,
    };
  } catch (err) {
    void captureServerEvent("negotiation_v2_live_error", distinctId, {
      session_id: state.sessionId ?? "unknown",
      turn_index: state.turnIndex,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
