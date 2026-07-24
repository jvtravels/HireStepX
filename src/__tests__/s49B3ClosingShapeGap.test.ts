/* S49-B3 (2026-07-24) — LLM hallucination of a farewell without "next steps".
 *
 * Root cause: CLOSING_SHAPE_RE only caught "thanks for the conversation/chat/
 * call/discussion today" and "with the next steps". The LLM can generate:
 *   "Thanks for talking it through with me today."
 * as a standalone closing sentence — no "next steps" clause — and this
 * phrase bypassed the premature-close guard, reaching the candidate even when
 * the kernel had chosen a probe/anchor lever.
 *
 * Fix: added three new patterns to CLOSING_SHAPE_RE:
 *   (a) "thanks for talking it through (with me)"
 *   (b) "thanks for your time today" / "thanks for joining us today"
 *   (c) "we'll / I'll follow up with you soon/shortly"
 *
 * Test matrix:
 *   A. "Thanks for talking it through with me today." — must flag premature-close
 *   B. "Thanks for your time today. We'll connect soon." — must flag premature-close
 *   C. "We'll follow up with you shortly." — must flag premature-close
 *   D. "We'll follow up on the equity details shortly." — must NOT flag (not a farewell)
 *   E. "Thanks for sharing that context." — must NOT flag (too short/generic) */

import { describe, it, expect } from "vitest";
import {
  validateResponseContract,
} from "../../server-handlers/_response-contract";
import {
  initState,
  applyAiMove,
  applyCandidateAnswer,
} from "../../server-handlers/_negotiation-kernel";
import { resolveServerBand } from "../../server-handlers/_band-resolver";
import { planNextAction } from "../../server-handlers/_next-action-planner";

const HDFC_BAND = resolveServerBand("Senior Data Analyst", "hdfc", "senior", 4);

function stateAfterOneExchange(): ReturnType<typeof applyAiMove> {
  let s = initState({ sessionId: "s49b3close", role: "data-analyst", company: "hdfc", band: HDFC_BAND });
  s = applyCandidateAnswer(s, "My current CTC is ₹18L and I'm targeting around ₹28L.");
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "probe target" }, "What's your exact expectation?");
  return s;
}

describe("S49-B3 — CLOSING_SHAPE_RE catches farewell shapes without 'next steps'", () => {
  it("A. 'Thanks for talking it through with me today.' flags premature-close", () => {
    const state = stateAfterOneExchange();
    const action = planNextAction(state);
    const result = validateResponseContract({
      text: "Thanks for talking it through with me today.",
      move: { lever: "probe", newTotalLpa: null, rationale: "probe" },
      state,
      candidateLastUtterance: "That sounds right.",
    });
    expect(result.ok).toBe(false);
    expect(result.violations).toContain("premature-close");
  });

  it("B. 'Thanks for your time today.' flags premature-close", () => {
    const state = stateAfterOneExchange();
    const result = validateResponseContract({
      text: "Thanks for your time today. We'll connect soon.",
      move: { lever: "probe", newTotalLpa: null, rationale: "probe" },
      state,
      candidateLastUtterance: "I see.",
    });
    expect(result.ok).toBe(false);
    expect(result.violations).toContain("premature-close");
  });

  it("C. 'We'll follow up with you shortly.' flags premature-close", () => {
    const state = stateAfterOneExchange();
    const result = validateResponseContract({
      text: "We'll follow up with you shortly.",
      move: { lever: "probe", newTotalLpa: null, rationale: "probe" },
      state,
      candidateLastUtterance: "Okay.",
    });
    expect(result.ok).toBe(false);
    expect(result.violations).toContain("premature-close");
  });

  it("D. 'We'll follow up on the equity details shortly.' does NOT flag (not a farewell)", () => {
    const state = stateAfterOneExchange();
    const result = validateResponseContract({
      text: "We'll follow up on the equity details shortly. For now, the base is ₹16.6L.",
      move: { lever: "probe", newTotalLpa: null, rationale: "probe" },
      state,
      candidateLastUtterance: "Can you clarify equity?",
    });
    // This should NOT have premature-close (it's talking about a specific comp topic)
    expect(result.violations).not.toContain("premature-close");
  });

  it("E. 'Thanks for sharing that context.' does NOT flag (not a farewell)", () => {
    const state = stateAfterOneExchange();
    const result = validateResponseContract({
      text: "Thanks for sharing that context. Given your ₹28L target, our range for this role is ₹16–23L.",
      move: { lever: "probe", newTotalLpa: null, rationale: "probe" },
      state,
      candidateLastUtterance: "I'm expecting 28.",
    });
    expect(result.violations).not.toContain("premature-close");
  });
});
