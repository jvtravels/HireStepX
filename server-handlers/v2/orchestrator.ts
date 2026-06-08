/* V2-ORCHESTRATOR (2026-06-09) — the single per-turn loop.
 *
 * One call site, three steps:
 *
 *   1. Compute band + derive state + legal tools (kernel)
 *   2. Ask the LLM which tool to call (constrained to legal set)
 *   3. Validate + render with the kernel; one retry on rejection;
 *      on second rejection, fall back to decline_offer_ask
 *
 * The LLM is injected as an adapter so this module is testable
 * without an actual network call. Production wires the Anthropic
 * SDK or whatever caller v1 was using; tests pass a stub. */

import type { NegotiationBand } from "../_negotiation-kernel";
import {
  deriveState,
  legalTools,
  type ConversationTurn,
  type DerivedState,
  type ToolName,
} from "./kernel";
import { executeTool, type ToolCall } from "./tools";

/** What the orchestrator hands the LLM each turn. The legal set is
 *  the hard constraint — the model picks one tool from this list,
 *  no others. `lastRejection` is non-null on retries: it tells the
 *  model why its previous pick was rejected so it can correct. */
export interface LlmInput {
  systemPrompt: string;
  conversationLog: ConversationTurn[];
  legalTools: ToolName[];
  band: NegotiationBand;
  state: DerivedState;
  lastRejection?: { tool: string; reason: string };
}

export type LlmAdapter = (input: LlmInput) => Promise<ToolCall>;

export interface OrchestratorResult {
  /** The tool the kernel actually ran (after any retries / fallback). */
  tool: ToolName;
  /** The user-facing prose. Always non-empty. */
  canonical: string;
  /** Number the kernel rendered, when applicable. */
  lpa?: number;
  /** True iff the LLM's first pick passed kernel validation. */
  firstPickAccepted: boolean;
  /** Number of LLM calls made this turn (1 on success, 2 on one
   *  retry, never more — we fall back to decline_offer_ask). */
  llmCalls: number;
  /** What the LLM picked first (for telemetry on retry rate). */
  firstPick: { tool: string; rejectionReason?: string };
}

/** The system prompt is the only place the negotiation playbook
 *  lives in prose. It encodes Voss tactical empathy, anchor
 *  discipline, and the hard invariants — but the invariants are
 *  ALSO enforced by the kernel's legal-tools gate, so the prompt
 *  is the "soft" layer and the gate is the "hard" layer. */
export function buildSystemPrompt(band: NegotiationBand): string {
  return `You are a senior Indian HR recruiter negotiating compensation in LPA. You speak naturally, like a real recruiter — not a chatbot. Short sentences. No marketing fluff. No "let me check and come back" without a concrete time.

Hard rules (enforced by the kernel — your output is rejected if you violate them):

1. When the candidate explicitly asks for an offer, you MUST either propose_anchor or decline_offer_ask. You CANNOT ask another discovery question. You CANNOT defer without a concrete callback time.

2. Every anchor, counter, or concession MUST cite a specific rationale (>= 10 chars). Vague phrases like "based on your profile" are not rationale.

3. Defer requires a concrete time marker ("by EOD", "tomorrow", "by Friday", "by 06/12"). "Let me come back to you" alone is rejected.

4. The negotiation band for this role is: walk-away ${band.walkAway} LPA, initial ${band.initialOffer} LPA, stretch ${band.maxStretch} LPA. You CANNOT anchor or counter outside this band. If the candidate's target exceeds your stretch, use decline_offer_ask honestly.

5. Counters go UP from the prior anchor, never sideways or down.

Pick ONE tool from the legal set the orchestrator gives you. Provide its arguments. The kernel renders the final prose — you never write the user-facing string yourself.`;
}

/** The per-turn loop. Pure orchestration — all stateful work is in
 *  the kernel (state derivation) or in the tools (validation +
 *  rendering). Side-effect-free aside from the LLM call(s). */
export async function generateTurn(
  log: ConversationTurn[],
  band: NegotiationBand,
  llm: LlmAdapter,
): Promise<OrchestratorResult> {
  const state = deriveState(log);
  const legal = legalTools(state);
  const systemPrompt = buildSystemPrompt(band);

  /* --- Attempt 1 --- */
  const firstPick = await llm({
    systemPrompt,
    conversationLog: log,
    legalTools: legal,
    band,
    state,
  });

  const firstRejection = checkLegality(firstPick, legal);
  if (!firstRejection) {
    const result = executeTool(firstPick, band, state);
    if (result.ok) {
      return {
        tool: result.tool,
        canonical: result.canonical,
        lpa: result.lpa,
        firstPickAccepted: true,
        llmCalls: 1,
        firstPick: { tool: firstPick.name },
      };
    }
    /* Kernel rejected on semantics (e.g. out-of-band number). Retry. */
    return await retryOrFallback(
      log,
      band,
      state,
      legal,
      systemPrompt,
      llm,
      { tool: firstPick.name, reason: result.reason },
    );
  }

  /* Illegal tool name. Retry with the rejection reason. */
  return await retryOrFallback(
    log,
    band,
    state,
    legal,
    systemPrompt,
    llm,
    { tool: firstPick.name, reason: firstRejection },
  );
}

function checkLegality(call: ToolCall, legal: ToolName[]): string | null {
  if (!legal.includes(call.name)) {
    return `tool '${call.name}' is not in the legal set [${legal.join(", ")}]`;
  }
  return null;
}

async function retryOrFallback(
  log: ConversationTurn[],
  band: NegotiationBand,
  state: DerivedState,
  legal: ToolName[],
  systemPrompt: string,
  llm: LlmAdapter,
  firstReject: { tool: string; reason: string },
): Promise<OrchestratorResult> {
  const second = await llm({
    systemPrompt,
    conversationLog: log,
    legalTools: legal,
    band,
    state,
    lastRejection: firstReject,
  });

  const legalityFail = checkLegality(second, legal);
  if (!legalityFail) {
    const result = executeTool(second, band, state);
    if (result.ok) {
      return {
        tool: result.tool,
        canonical: result.canonical,
        lpa: result.lpa,
        firstPickAccepted: false,
        llmCalls: 2,
        firstPick: { tool: firstReject.tool, rejectionReason: firstReject.reason },
      };
    }
  }

  /* Second pick still bad. Fall back to decline_offer_ask — the
   * structurally honest exit. We never ship a defer / fluff
   * fallback; that was the v1 failure mode. */
  const fallback = executeTool(
    {
      name: "decline_offer_ask",
      args: { reason: "I want to be straight with you about what I can authorize" },
    },
    band,
    state,
  );
  if (!fallback.ok) {
    /* decline_offer_ask is unconditional in tools.ts — this branch
     * is unreachable, but TypeScript exhaustiveness still wants it. */
    throw new Error("v2 invariant violated: decline_offer_ask rejected");
  }
  return {
    tool: fallback.tool,
    canonical: fallback.canonical,
    lpa: fallback.lpa,
    firstPickAccepted: false,
    llmCalls: 2,
    firstPick: firstReject,
  };
}
