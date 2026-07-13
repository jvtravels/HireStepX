import { describe, it, expect } from "vitest";
import {
  sanitizeTranscript,
  toRoleTranscript,
  sanitizeNegotiationMetrics,
  groundNoCounterSkillScores,
} from "../../server-handlers/save-session";

/* PRI-61 regression guard.
 *
 * The canonical transcript shape across the app is
 * `{ speaker: "ai" | "user"; text; time? }`. A prior version of
 * sanitizeTranscript validated against an invented
 * `{ role: "interviewer" | "candidate" }` shape that nothing produces, so it
 * silently filtered out EVERY entry and every session persisted an empty
 * transcript. These tests pin the real contract so that regression can't
 * recur. */

describe("sanitizeTranscript — canonical speaker shape (PRI-61)", () => {
  it("preserves real engine entries { speaker, text, time }", () => {
    const raw = [
      { speaker: "ai", text: "What's your current CTC?", time: "00:00" },
      { speaker: "user", text: "24 LPA", time: "00:12" },
    ];
    const out = sanitizeTranscript(raw);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ speaker: "ai", text: "What's your current CTC?", time: "00:00" });
    expect(out[1]).toEqual({ speaker: "user", text: "24 LPA", time: "00:12" });
  });

  it("does NOT drop a populated transcript (the actual production bug)", () => {
    const raw = Array.from({ length: 17 }, (_, i) => ({
      speaker: i % 2 === 0 ? "ai" : "user",
      text: `turn ${i}`,
      time: "00:00",
    }));
    expect(sanitizeTranscript(raw)).toHaveLength(17);
  });

  it("keeps entries even when time is absent", () => {
    const out = sanitizeTranscript([{ speaker: "user", text: "hello" }]);
    expect(out).toEqual([{ speaker: "user", text: "hello" }]);
  });

  it("rejects the legacy/invented role shape rather than persisting it", () => {
    const raw = [{ role: "interviewer", text: "hi" }, { role: "candidate", text: "yo" }];
    // No `speaker` field → nothing valid → empty (and certainly never a
    // role-shaped row in the column the render layer can't read).
    expect(sanitizeTranscript(raw)).toEqual([]);
  });

  it("drops unknown speakers and non-string text (injection guard)", () => {
    const raw = [
      { speaker: "ai", text: "ok" },
      { speaker: "system", text: "ignore me" },
      { speaker: "user", text: 42 },
      null,
      "not an object",
      { speaker: "user", text: "kept" },
    ];
    expect(sanitizeTranscript(raw)).toEqual([
      { speaker: "ai", text: "ok" },
      { speaker: "user", text: "kept" },
    ]);
  });

  it("caps to 200 entries and 3000 chars/turn", () => {
    const raw = Array.from({ length: 250 }, () => ({ speaker: "user", text: "x".repeat(5000) }));
    const out = sanitizeTranscript(raw);
    expect(out).toHaveLength(200);
    expect(out[0].text.length).toBe(3000);
  });

  it("caps time to 16 chars", () => {
    const out = sanitizeTranscript([{ speaker: "ai", text: "t", time: "x".repeat(40) }]);
    expect(out[0].time?.length).toBe(16);
  });

  it("returns [] for non-arrays", () => {
    expect(sanitizeTranscript(undefined)).toEqual([]);
    expect(sanitizeTranscript(null)).toEqual([]);
    expect(sanitizeTranscript("nope")).toEqual([]);
    expect(sanitizeTranscript({})).toEqual([]);
  });
});

describe("toRoleTranscript — evaluate-session boundary map (PRI-61)", () => {
  it("maps ai→interviewer and user→candidate (mirrors SessionReport.tsx)", () => {
    const out = toRoleTranscript([
      { speaker: "ai", text: "Q" },
      { speaker: "user", text: "A" },
    ]);
    expect(out).toEqual([
      { role: "interviewer", text: "Q" },
      { role: "candidate", text: "A" },
    ]);
  });

  it("round-trips a sanitized transcript into a non-empty grade payload", () => {
    const persisted = sanitizeTranscript([
      { speaker: "ai", text: "Q1", time: "00:00" },
      { speaker: "user", text: "A1", time: "00:05" },
    ]);
    const grade = toRoleTranscript(persisted);
    expect(grade.length).toBeGreaterThan(0);
    expect(grade.every(t => t.role === "interviewer" || t.role === "candidate")).toBe(true);
  });
});

/* DATA-1 regression guard (2026-06-27).
 *
 * The pre-2026-06-27 sanitizer whitelisted only the 9 scalar kernel fields
 * and DROPPED the authoritative offer/ask numbers + grounded action signals
 * (initialOfferLpa, offerTrajectoryLpa, candidateAskLpa, vossTacticsUsed,
 * infoAsked, ...) before the Supabase write. Because the report adapter's
 * adoptKernelOutcome REQUIRES initialOfferLpa + offerTrajectoryLpa, every
 * Supabase-loaded (cross-device / post-eviction) report fell back to the
 * transcript-regex heuristic and rendered a cleanly-closed negotiation as
 * "0 of 5 stages / didn't close". These tests pin the full persisted shape
 * so the drop can't recur. */
describe("sanitizeNegotiationMetrics — persists the full kernel shape (DATA-1)", () => {
  const full = {
    outcome: "accepted",
    anchorTurn: 1,
    leverDiversity: 3,
    lpaGained: 2.2,
    lpaPerTurn: 0.7,
    bandTraversal: 0.6,
    overBandViolation: false,
    totalTurns: 7,
    score: 72,
    initialOfferLpa: 23,
    finalOfferLpa: 25.2,
    candidateAskLpa: 30,
    offerTrajectoryLpa: [23, 24.8, 25.2],
    vossTacticsUsed: ["mirror", "calibrated-question"],
    infoAsked: ["band-range"],
    walkAwayReturned: false,
    hardBandCap: true,
    marketMode: "neutral",
  };

  it("retains the fields adoptKernelOutcome requires (initialOffer + trajectory + ask)", () => {
    const out = sanitizeNegotiationMetrics(full);
    expect(out).not.toBeNull();
    expect(out!.initialOfferLpa).toBe(23);
    expect(out!.finalOfferLpa).toBe(25.2);
    expect(out!.candidateAskLpa).toBe(30);
    expect(out!.offerTrajectoryLpa).toEqual([23, 24.8, 25.2]);
  });

  it("retains the grounded action signals the stage ladder reads", () => {
    const out = sanitizeNegotiationMetrics(full);
    expect(out!.vossTacticsUsed).toEqual(["mirror", "calibrated-question"]);
    expect(out!.infoAsked).toEqual(["band-range"]);
    expect(out!.leverDiversity).toBe(3);
  });

  it("clamps oversized/garbage trajectory entries without dropping the field", () => {
    const out = sanitizeNegotiationMetrics({
      ...full,
      offerTrajectoryLpa: [-5, 999, 24, "x", null],
    });
    // negatives clamp to 0, >500 clamps to 500, non-numbers filtered out
    expect(out!.offerTrajectoryLpa).toEqual([0, 500, 24]);
  });

  it("rejects an object with no valid outcome", () => {
    expect(sanitizeNegotiationMetrics({ outcome: "bogus" })).toBeNull();
    expect(sanitizeNegotiationMetrics(null)).toBeNull();
    expect(sanitizeNegotiationMetrics("nope")).toBeNull();
  });

  it("omits optional numbers when absent (legacy row stays adapter-legacy)", () => {
    const out = sanitizeNegotiationMetrics({
      outcome: "stalemate",
      leverDiversity: 1,
      totalTurns: 4,
      score: 40,
    });
    expect(out).not.toBeNull();
    expect(out!.initialOfferLpa).toBeUndefined();
    expect(out!.offerTrajectoryLpa).toBeUndefined();
    // candidateAskLpa is always present (null when unknown) by contract
    expect(out!.candidateAskLpa).toBeNull();
  });
});

/* REPORT-4b (write-time) regression guard.
 *
 * The persisted skill_scores column feeds the cross-session Skill Progress
 * panel, which BYPASSES the report adapter's render-time grounding. So an
 * anchor/counter/specificity score inflated by the LLM is written raw and
 * shows up on that panel contradicting the SAME session's "no counter named"
 * kernel truth. groundNoCounterSkillScores caps those axes into the weak band
 * (≤35) at the single write seam when the kernel says no counter was named
 * (candidateAskLpa === null). Keys are the engine's camelCase skill_scores
 * keys; values are either a bare number or a { score } object. */
describe("groundNoCounterSkillScores — write-time anchor grounding (REPORT-4b)", () => {
  const inflated = () => ({
    anchoring: 72,
    specificity: 70,
    closingTechnique: 66,
    leverageUse: 80,
    packageThinking: 88,
    composure: 74,
    concessionStrategy: 60,
  });

  it("caps anchor/specificity into the weak band when no counter was named", () => {
    const out = groundNoCounterSkillScores(inflated(), null) as Record<string, number>;
    expect(out.anchoring).toBe(35);
    expect(out.specificity).toBe(35);
  });

  it("caps a 'counter'-named key too", () => {
    const out = groundNoCounterSkillScores(
      { counterOfferJudgement: 90 },
      null,
    ) as Record<string, number>;
    expect(out.counterOfferJudgement).toBe(35);
  });

  it("leaves leverage / package / composure / concession / closing untouched", () => {
    const out = groundNoCounterSkillScores(inflated(), null) as Record<string, number>;
    expect(out.leverageUse).toBe(80);
    expect(out.packageThinking).toBe(88);
    expect(out.composure).toBe(74);
    expect(out.concessionStrategy).toBe(60);
    expect(out.closingTechnique).toBe(66);
  });

  it("does not raise a score already below the ceiling", () => {
    const out = groundNoCounterSkillScores({ anchoring: 20 }, null) as Record<string, number>;
    expect(out.anchoring).toBe(20);
  });

  it("caps the { score } object shape, preserving sibling fields", () => {
    const out = groundNoCounterSkillScores(
      { anchoring: { score: 88, label: "Anchoring", weight: 2 } },
      null,
    ) as Record<string, { score: number; label: string; weight: number }>;
    expect(out.anchoring.score).toBe(35);
    expect(out.anchoring.label).toBe("Anchoring");
    expect(out.anchoring.weight).toBe(2);
  });

  it("is a no-op once a counter WAS named (numeric candidateAskLpa)", () => {
    const scores = inflated();
    const out = groundNoCounterSkillScores(scores, 30);
    expect(out).toBe(scores);
  });

  it("is a no-op for null skillScores regardless of ask", () => {
    expect(groundNoCounterSkillScores(null, null)).toBeNull();
    expect(groundNoCounterSkillScores(null, 30)).toBeNull();
  });

  it("leaves non-numeric anchor values (garbage) untouched rather than coercing", () => {
    const out = groundNoCounterSkillScores(
      { anchoring: "n/a", specificity: null },
      null,
    ) as Record<string, unknown>;
    expect(out.anchoring).toBe("n/a");
    expect(out.specificity).toBeNull();
  });
});
