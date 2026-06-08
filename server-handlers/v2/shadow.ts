/* V2-SHADOW (2026-06-09) — non-blocking shadow run of v2 alongside v1.
 *
 * Wired into _response-pipeline.ts:generateBotReply as fire-and-forget.
 * v1's response ALWAYS ships to the user; v2's pick is computed in
 * the background and logged to PostHog so we can see — turn by turn,
 * session by session — what v2 would have done differently.
 *
 * Contract:
 *   1. ENV-GATED. Only runs when NEGOTIATION_V2_SHADOW_ENABLED=1.
 *      Default off. Zero cost when the flag is missing.
 *   2. NEVER THROWS. Every error path is swallowed and logged as a
 *      shadow_error event. The shadow path cannot affect user
 *      response under any circumstance.
 *   3. NO USER-VISIBLE SIDE EFFECT. v2's prose never reaches the
 *      candidate. PostHog telemetry is the only output.
 *
 * Event: `negotiation_v2_shadow_turn`
 *   {
 *     session_id, turn_index,
 *     v1_text_excerpt, v1_action_kind, v1_source,
 *     v2_tool, v2_canonical_excerpt, v2_lpa,
 *     v2_kernel_accepted, v2_llm_calls, v2_first_pick,
 *     v2_rail_pass, v2_rail_reason,
 *     diverged           // true when v1 and v2 picked materially different moves
 *   }
 */

import { captureServerEvent } from "../_posthog";
import type { GenerateAiTextFn, PipelineResult } from "../_response-pipeline";
import type { NegotiationState } from "../_negotiation-kernel";
import { computeBand, type ConversationTurn } from "./kernel";
import { generateTurn, type LlmAdapter, type LlmInput } from "./orchestrator";
import { assertHonestMove } from "./rail";
import type { ToolCall } from "./tools";

function shadowEnabled(): boolean {
  return process.env.NEGOTIATION_V2_SHADOW_ENABLED === "1";
}

/** Build a v2 LlmAdapter on top of v1's GenerateAiTextFn. Uses
 *  JSON-mode prompting — v2's first commit doesn't depend on
 *  Anthropic tool-use, which keeps the shadow stage portable across
 *  whatever LLM v1 is wired to. */
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
  return `Conversation so far:
${log}

State scalars:
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

/** Parse the LLM's JSON response into a ToolCall. Best-effort —
 *  malformed JSON throws, which the shadow wrapper catches and logs
 *  as `shadow_parse_error`. */
function parseToolCall(raw: string): ToolCall {
  /* Strip code fences if the model wrapped JSON in markdown. */
  const trimmed = raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  /* Find the first { ... } block in case the model added prose. */
  const m = trimmed.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`no JSON object in LLM response: ${raw.slice(0, 200)}`);
  const parsed = JSON.parse(m[0]) as unknown;
  if (!parsed || typeof parsed !== "object") throw new Error("parsed JSON is not an object");
  const obj = parsed as { name?: unknown; args?: unknown };
  if (typeof obj.name !== "string") throw new Error("missing/non-string 'name'");
  if (!obj.args || typeof obj.args !== "object") throw new Error("missing/non-object 'args'");
  return { name: obj.name, args: obj.args } as ToolCall;
}

/** Adapt v1's conversationLog (the canonical state shape) into v2's
 *  ConversationTurn shape. v1 stores {speaker, text}; v2 expects
 *  {role, text, tool?, lpa?}. v1 turns have no tool field — v2's
 *  state derivation falls back to regex on text for those, which is
 *  exactly the shadow-mode contract documented in kernel.ts. */
function adaptLog(state: NegotiationState): ConversationTurn[] {
  return state.conversationLog.map((t) => ({
    role: t.speaker === "ai" ? "ai" : "candidate",
    text: t.text,
  }));
}

/** Run v2 in shadow alongside v1. Fire-and-forget — caller does NOT
 *  await this. Returns void; all errors are swallowed and logged. */
export function runShadow(
  state: NegotiationState,
  generateAiText: GenerateAiTextFn,
  v1Result: PipelineResult,
  distinctId: string,
): void {
  if (!shadowEnabled()) return;
  /* No await — schedule on the next tick and let it complete in the
   * background. The response has already shipped. */
  void runShadowInner(state, generateAiText, v1Result, distinctId).catch((err) => {
    void captureServerEvent(
      "negotiation_v2_shadow_error",
      distinctId,
      {
        session_id: state.sessionId ?? "unknown",
        turn_index: state.turnIndex,
        error: err instanceof Error ? err.message : String(err),
      },
    );
  });
}

async function runShadowInner(
  state: NegotiationState,
  generateAiText: GenerateAiTextFn,
  v1Result: PipelineResult,
  distinctId: string,
): Promise<void> {
  const band = computeBand(
    state.role ?? "",
    state.company ?? "",
    /* experienceLevel — v1's NegotiationState doesn't carry a clean
     * level scalar at this layer; derive from YoE in computeBand. */
    undefined,
    state.candidateApplicableYoe ?? null,
  );
  const log = adaptLog(state);
  const adapter = buildAdapter(generateAiText, distinctId);

  const result = await generateTurn(log, band, adapter);
  const railVerdict = assertHonestMove(result, {
    turnIndex: state.turnIndex,
    offerAskCount: countOfferAsks(state),
    hasAnchored: state.highestOfferMade > 0,
    lastAnchorLpa: state.highestOfferMade || null,
    candidateTarget: state.candidateTarget ?? null,
    verbalAcceptanceTurn: state.verbalAcceptanceTurn ?? null,
    /* The rail doesn't use mentionedNumbers, but the type requires
     * it. Empty list is a faithful default — v1 state doesn't carry
     * this scalar set, and the shadow path uses the rail only for
     * honest-move classification. */
    mentionedNumbers: [],
    surfacedTopics: [],
    closedTopics: [],
  });

  /* "Diverged" heuristic: v1 shipped no number AND v2 shipped a
   * number (or vice versa). The point of shadow is to surface
   * exactly the cases the Flipkart fixture flagged. */
  const v1HasNumber = /\b\d+(?:\.\d+)?\s*(?:l|lpa)\b/i.test(v1Result.text) || /₹\s*\d+/.test(v1Result.text);
  const v2HasNumber = result.lpa !== undefined;
  /* String-compare across the disjoint v1 NextAction.kind and v2
   * ToolName unions — they have no nominal overlap by design, but
   * shared move-shapes ("close-recap-formal" ↔ "close_recap",
   * "ask-discovery" ↔ "ask_discovery") read as divergence here too,
   * which is what we want during shadow. */
  const v1Kind: string = v1Result.action.kind;
  const v2Kind: string = result.tool;
  const diverged = v1HasNumber !== v2HasNumber || v1Kind !== v2Kind;

  void captureServerEvent("negotiation_v2_shadow_turn", distinctId, {
    session_id: state.sessionId ?? "unknown",
    turn_index: state.turnIndex,
    v1_text_excerpt: v1Result.text.slice(0, 200),
    v1_action_kind: v1Result.action.kind,
    v1_source: v1Result.source,
    v1_has_number: v1HasNumber,
    v2_tool: result.tool,
    v2_canonical_excerpt: result.canonical.slice(0, 200),
    v2_lpa: result.lpa ?? null,
    v2_kernel_accepted: result.firstPickAccepted,
    v2_llm_calls: result.llmCalls,
    v2_first_pick: result.firstPick.tool,
    v2_first_pick_rejected_for: result.firstPick.rejectionReason ?? null,
    v2_rail_pass: railVerdict.pass,
    v2_rail_reason: railVerdict.reason ?? null,
    diverged,
  });
}

/** Re-derive offerAskCount from v1's state log using the same regex
 *  bank the v2 kernel uses. Kept local so we don't have to export
 *  the bank from kernel.ts just for this. */
const OFFER_ASK_RE = /(?:\b(?:give|share|tell)\s+(?:me\s+)?(?:your\s+)?(?:initial\s+)?offer\b|\bwhat(?:'s|\s+is)\s+(?:your\s+)?(?:initial\s+)?offer\b|\bhave\s+not\s+(?:yet\s+)?given\s+(?:initial\s+)?offer\b|\bcan\s+you\s+give\s+me\s+\d)/i;
function countOfferAsks(state: NegotiationState): number {
  let n = 0;
  for (const t of state.conversationLog) {
    if (t.speaker === "candidate" && OFFER_ASK_RE.test(t.text)) n++;
  }
  return n;
}
