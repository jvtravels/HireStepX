import { describe, it, expect } from "vitest";
import { runConversation } from "./_negotiationSim";
import { extractComponentBreakdown } from "../../server-handlers/_component-breakdown";
import type { NegotiationBand } from "../../server-handlers/_negotiation-kernel";

/* PRI-61 regression guard (2026-07-05, live Flipkart Engineering Manager
 * salary-negotiation session).
 *
 * The bot asked, deep in the close phase, "91% variable is significant — how
 * comfortable are you with that split, and have you been consistently hitting
 * full payouts in your current role?" — about a variable split the candidate
 * NEVER disclosed. The candidate's current comp was stated as "46 fixed plus
 * some ESOPs" (no variable at all).
 *
 * Root cause (two layers):
 *   1. On the close turn "firm up the top of your fixed band plus that 4.2L
 *      joining bonus", extractComponentBreakdown's `extractNumberAfter("fixed")`
 *      reached across "band plus that" and bound base = 4.2 (the JOINING-BONUS
 *      figure), not a real fixed base.
 *   2. With a known current total (46), the total-complement inference then
 *      fabricated variable = 46 − 4.2 = 41.8 and stamped `variableInferred:
 *      true` — a 91% "variable share". The variable-comfort probe read
 *      `breakdown.variable` directly and fired, IGNORING `variableInferred`.
 *
 * `variableInferred` exists precisely to mark a complement-derived variable as
 * "not a disclosure". Every other consumer (nextComponentProbe, canonical
 * prose, move-spec) already gates on `variableInferred !== true`; the
 * variable-comfort probe was the lone violator. The fix requires a genuinely
 * disclosed (non-inferred) variable before interrogating payout history.
 *
 * These pin BOTH halves: (a) the exact live transcript no longer produces the
 * probe, and (b) a candidate who ACTUALLY discloses a variable-heavy split
 * still gets probed — the fix narrows, it does not disable the rule. */

const FLIPKART_EM: NegotiationBand = {
  initialOffer: 44,
  maxStretch: 52.3,
  walkAway: 38,
  hasEquity: true,
} as NegotiationBand;

const PROBE_RE =
  /% variable is significant|hitting payouts in full|comfort with that share/i;

describe("PRI-61 — variable-comfort probe requires a DISCLOSED variable", () => {
  /* First, lock the parser-level root cause so a future extractor change that
   * re-mis-binds the joining bonus as base is caught directly. */
  it("marks a total-complement variable as inferred, not disclosed", () => {
    // "fixed band plus that 4.2L joining bonus" with a known total of 46.
    const bd = extractComponentBreakdown(
      "if you can firm up the top of your fixed band plus that 4.2l joining bonus and the esop grant",
      46,
    );
    // Whatever base the extractor binds, any variable it produces here is a
    // derived complement — never a disclosure.
    if (bd.variable != null) expect(bd.variableInferred).toBe(true);
  });

  it("does NOT fire the variable-comfort probe when no variable was disclosed (live repro)", () => {
    const { transcript } = runConversation({
      sessionId: "pri61-guard",
      role: "Engineering Manager",
      company: "Flipkart",
      band: FLIPKART_EM,
      initExtras: { applicableYoe: 10, experienceLevel: "senior" },
      stopOnTerminal: false,
      turns: [
        "Hi Karthik, yes let's begin. I'm an Engineering Manager with about 10 years of experience, currently at 46 LPA fixed plus some ESOPs.",
        "I'd rather anchor on the role than my current number. For context my current fixed is 46, but for this Engineering Manager position I'm looking for 65 LPA total.",
        "Sure. I own the payments platform for a team of 14, took p99 latency down 40% and cut infra cost by 2 crore a year. That justifies the 65.",
        "Honestly 49.2 is barely a bump over my current 46 fixed. I was looking at 65. Where can you actually land?",
        "ESOP is appreciated but I can't pay rent with equity. What's the top of your fixed range? I need the base to move up.",
        "Let's cut to it — if you can close at 56 fixed, that works for me and I'll sign.",
        "Okay, that's fair. If you can firm up the top of your fixed band plus that 4.2L joining bonus and the ESOP grant, I can work with that. Let's lock it in.",
      ],
    });
    const offending = transcript.filter((t) => PROBE_RE.test(t.aiText));
    expect(offending.map((t) => t.aiText)).toEqual([]);
  });

  it("STILL fires the variable-comfort probe when the candidate genuinely discloses a variable split", () => {
    const { transcript } = runConversation({
      sessionId: "pri61-positive",
      role: "Engineering Manager",
      company: "Flipkart",
      band: FLIPKART_EM,
      initExtras: { applicableYoe: 10, experienceLevel: "senior" },
      stopOnTerminal: false,
      turns: [
        "I'm an EM, my current CTC is 44 total — 24 fixed and 20 variable.",
        "The variable is on the annual perf cycle.",
        "I'm looking for a solid jump on the fixed.",
      ],
    });
    const fired = transcript.some((t) => PROBE_RE.test(t.aiText));
    expect(fired).toBe(true);
  });
});
