/* Phase 32 (2026-05-14) — parity test pinning the two acceptance call
 * sites to identical output.
 *
 * The audit (May-14) flagged drift risk: `acceptedImmediately` (legacy
 * NegotiationFacts field) and `signalsAcceptance` (kernel ParsedAnswer
 * field) are populated by independent code paths. Both now route
 * through `classifyAcceptance` (Phase 9, 2026-05-13), so the values
 * should agree for any given utterance. This test pins that property
 * across a representative corpus so a future tweak to one path that
 * doesn't land on the other fails CI.
 *
 * Why two call sites exist:
 *   - Kernel path  → per-turn, with phase + offerOnTable context
 *   - Legacy path  → whole-transcript scan, no per-turn context
 *
 * The phase gate in classifyAcceptance is a no-op when phase is
 * omitted (back-compat), so a turn-by-turn comparison of the LEGACY
 * extraction (no context) against a context-less kernel call should
 * yield identical accepted booleans. Any utterance where they disagree
 * is a regression.
 */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";
import { extractNegotiationFacts } from "../interviewEvaluation";

/* Corpus of utterances that span the acceptance / non-acceptance /
 * conditional / split-clause cases. Each one is checked TWO ways:
 *   (a) via classifyAcceptance directly (the kernel's per-turn path
 *       with no context — same call shape as the legacy facts
 *       extractor on line 262 of interviewEvaluation.ts).
 *   (b) via extractNegotiationFacts on a single-turn transcript
 *       (the legacy whole-transcript path).
 * Both must agree. */
const CORPUS: Array<{ utterance: string; label: string }> = [
  /* Plain acceptances. */
  { utterance: "I accept the offer.", label: "plain-accept" },
  { utterance: "Yes, I'll take it.", label: "yes-take-it" },
  { utterance: "I'd like to accept this offer.", label: "would-like-to-accept" },
  { utterance: "Sounds good, let's move forward.", label: "sounds-good" },
  { utterance: "Deal. When do I start?", label: "deal-when-start" },

  /* Split-clause acceptances (accept + follow-up question). */
  { utterance: "I'll join. Can you send me the offer letter?", label: "join-plus-question" },
  { utterance: "I accept. What's the joining date?", label: "accept-plus-question" },

  /* Conditional / non-acceptance. */
  { utterance: "I'll accept if you bump base to 30.", label: "conditional-bump" },
  { utterance: "Yes, but I want more equity.", label: "yes-but-more" },
  { utterance: "Only if the joining bonus is included.", label: "only-if" },

  /* Negotiation moves (not acceptance). */
  { utterance: "Can you do better than that?", label: "can-you-do-better" },
  { utterance: "I was hoping for closer to 50.", label: "hoping-closer-to" },
  { utterance: "Let me think about it.", label: "let-me-think" },

  /* Walk-away (not acceptance — should be false on both sides). */
  { utterance: "I'm going to pass on this.", label: "going-to-pass" },
  { utterance: "Thanks but no thanks.", label: "no-thanks" },

  /* Info-seeking after positive language (must NOT count as accept). */
  { utterance: "Sounds good. Can you tell me about the benefits?", label: "info-seek-after-positive" },

  /* Edge cases. */
  { utterance: "", label: "empty" },
  { utterance: "Hmm.", label: "single-filler" },
  { utterance: "Okay.", label: "okay-alone" },
];

describe("Phase 32 — acceptance classifier parity (kernel vs legacy paths)", () => {
  for (const { utterance, label } of CORPUS) {
    it(`agrees on '${label}'`, () => {
      const fromKernelPath = classifyAcceptance(utterance).accepted;
      const fromLegacyPath = extractNegotiationFacts([
        { speaker: "user", text: utterance, time: 0 },
      ]).acceptedImmediately;
      expect(fromLegacyPath).toBe(fromKernelPath);
    });
  }

  it("multi-turn transcript: legacy path agrees with per-turn OR-aggregation", () => {
    /* When the legacy path scans a multi-turn transcript, it returns
     * true if ANY user turn signals acceptance. Pin that semantic
     * against an explicit OR over per-turn classifyAcceptance calls. */
    const turns = [
      { speaker: "user" as const, text: "Can you do better?", time: 0 },
      { speaker: "user" as const, text: "Let me think.", time: 1 },
      { speaker: "user" as const, text: "Okay, I accept.", time: 2 },
    ];
    const fromLegacy = extractNegotiationFacts(turns).acceptedImmediately;
    const fromPerTurn = turns.some((t) => classifyAcceptance(t.text).accepted);
    expect(fromLegacy).toBe(fromPerTurn);
    expect(fromLegacy).toBe(true);
  });
});
