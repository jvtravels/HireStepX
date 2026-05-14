/* Mid-level flow (2026-05-14f) — pins the LLM behaviour for the six
 * canonical Indian 3-6 YoE salary-negotiation pushback scenarios:
 *
 *   5.  Standard 30-40% hike  — "why this hike?"
 *   6.  High 60-80% hike      — "how do you justify?"
 *   7.  Doesn't know breakup  — "fixed/variable?"
 *   8.  Multiple offers       — "how are you deciding?"
 *   9.  90-day notice         — "can you join earlier?"
 *   10. Serving notice        — "what is your LWD?"
 *
 * Most state for these (hikePercent / componentBreakdown / competing
 * offer detail / noticePeriodDays / lastWorkingDayText) already exists
 * in the kernel. The only new utterance signal is `compBreakupUnknown`
 * — candidate self-states they don't know their fixed/variable split.
 * The rest is LEVER_GUIDANCE / NEGOTIATION_SYSTEM_PROMPT tuning so the
 * LLM picks the right voice for each scenario. */
import { describe, expect, it } from "vitest";
import { extractCandidateProfile, mergeCandidateProfile } from "../../server-handlers/_candidate-profile";

describe("mid-level — compBreakupUnknown detection", () => {
  it("detects 'I don't know my fixed/variable breakup'", () => {
    const r = extractCandidateProfile("Honestly, I don't know my exact fixed and variable breakup.");
    expect(r.compBreakupUnknown).toBe(true);
    expect(r.hasAny).toBe(true);
  });
  it("detects 'not sure of the split'", () => {
    const r = extractCandidateProfile("Not sure of the split — I only know the total CTC.");
    expect(r.compBreakupUnknown).toBe(true);
  });
  it("detects 'I only know the headline CTC number'", () => {
    const r = extractCandidateProfile("I only know the headline CTC, need to check the rest.");
    expect(r.compBreakupUnknown).toBe(true);
  });
  it("detects 'need to check my base'", () => {
    const r = extractCandidateProfile("I'll need to check my base — I don't remember the exact breakdown.");
    expect(r.compBreakupUnknown).toBe(true);
  });
  it("does NOT fire when candidate states their split clearly", () => {
    const r = extractCandidateProfile("My current base is ₹15L, variable is ₹3L.");
    expect(r.compBreakupUnknown).toBe(false);
  });
  it("monotone-up across merge", () => {
    const prior = extractCandidateProfile("I don't know my breakup.");
    expect(prior.compBreakupUnknown).toBe(true);
    const next = extractCandidateProfile("What are next steps?");
    const merged = mergeCandidateProfile(prior, next);
    expect(merged.compBreakupUnknown).toBe(true);
  });
});

/* The remaining 5 scenarios rely on existing kernel state
 * (hikePercent / candidateComponentBreakdown / competingOfferDetail /
 * noticeJoining.noticePeriodDays / noticeJoining.lastWorkingDayText)
 * already populated by the rest of the kernel — they're tested
 * elsewhere. The mid-level prompt rules are non-functional (voice/
 * guidance) and are validated by the prompt-content smoke test below. */

describe("mid-level — system prompt carries the 6-scenario heuristic", () => {
  it("NEGOTIATION_SYSTEM_PROMPT references the mid-level hike heuristic", async () => {
    const mod = await import("../../server-handlers/_negotiate-turn-helpers");
    const sys = mod.NEGOTIATION_SYSTEM_PROMPT;
    /* hike heuristic — three explicit bands */
    expect(sys).toMatch(/30-40%.*STANDARD/i);
    expect(sys).toMatch(/60-80%.*OVERREACH/i);
    /* comp-literacy coaching rule */
    expect(sys).toMatch(/noBreakup/);
    expect(sys).toMatch(/comp[-\s]?literacy/i);
    /* multi-offer decision framework rule */
    expect(sys).toMatch(/role fit.*fixed[-\s]variable.*stability.*growth.*joining timeline/i);
    /* 90-day notice / buyout rule */
    expect(sys).toMatch(/90-day notice/i);
    expect(sys).toMatch(/buyout/i);
    /* LWD acknowledgement rule */
    expect(sys).toMatch(/Last Working Day|LWD/);
    expect(sys).toMatch(/counter-?offer/i);
  });
});
