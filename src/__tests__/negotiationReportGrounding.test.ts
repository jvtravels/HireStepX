/* Report-layer coherence guarantee (PRI-66 belt-and-suspenders).
 *
 * Three code paths can score a negotiation — the LLM evaluator, the server
 * deterministic fallback, and the client heuristic — and only the last one
 * grounds its own scores in the outcome. `groundNegotiationReport` is the
 * single convergence point where the kernel's authoritative gap-closure and
 * the finished skill scores are both in hand, so it enforces the invariant
 * that NO path may render "accepted, ~0% of the gap closed" beside a 95
 * Leverage bar. These tests lock the reconciliation: it only ever lowers,
 * only on an accepted-but-weak close, and moves skills + overall + band down
 * in lockstep while leaving demeanour, strong closes, and walk-aways alone. */
import { describe, it, expect } from "vitest";
import { groundNegotiationReport } from "../sessionReport/adapter";
import type { InterviewResultData } from "../sessionReport/types";

type Outcome = InterviewResultData["negotiationOutcome"];

/** Minimal authoritative outcome — only the fields the grounding reads. */
const outcome = (over: Partial<NonNullable<Outcome>>): Outcome => ({
  offers: [],
  finalTotal: null,
  outcome: "accepted",
  candidateAsk: 65,
  gapClosurePct: 0,
  leverDiversity: 0,
  ...over,
}) as Outcome;

/** A candidate who used all the right words → the scorer handed out 95s
 *  across the board. The grounding must decide by outcome, not by these. */
const inflatedSkills = () => [
  { name: "Anchoring", score: 95 },
  { name: "Leverage Use", score: 95 },
  { name: "Closing Technique", score: 95 },
  { name: "Concession Strategy", score: 95 },
  { name: "Package Thinking", score: 95 },
  { name: "Composure", score: 90 },
  { name: "Professional Tone", score: 88 },
];

const byName = (skills: Array<{ name: string; score: number }>, name: string) =>
  skills.find((s) => s.name === name)!.score;

const FLIPKART_BANDS = { strongHire: 90, hire: 75, leanHire: 60, noHire: 42 };

describe("groundNegotiationReport — report-layer coherence", () => {
  it("caps outcome skills, overall, and band on an accepted 0%-gap fold", () => {
    const r = groundNegotiationReport(
      inflatedSkills(), 79, "hire", outcome({ gapClosurePct: 0 }), FLIPKART_BANDS,
    );
    // Outcome-dependent axes capped to the fold ceiling (45).
    expect(byName(r.skills, "Leverage Use")).toBeLessThanOrEqual(45);
    expect(byName(r.skills, "Closing Technique")).toBeLessThanOrEqual(45);
    expect(byName(r.skills, "Anchoring")).toBeLessThanOrEqual(45);
    expect(byName(r.skills, "Concession Strategy")).toBeLessThanOrEqual(45);
    expect(byName(r.skills, "Package Thinking")).toBeLessThanOrEqual(45);
    // Overall pulled down and the band recomputed so the pill can't say "Hire".
    expect(r.overallScore).toBeLessThanOrEqual(60);
    expect(r.band).not.toBe("hire");
    expect(r.band).not.toBe("strongHire");
    // Demeanour axes are never touched — a calm, polite fold is still calm.
    expect(byName(r.skills, "Composure")).toBe(90);
    expect(byName(r.skills, "Professional Tone")).toBe(88);
  });

  it("applies a mediocre ceiling (60) for a token-movement close", () => {
    const r = groundNegotiationReport(
      inflatedSkills(), 79, "hire", outcome({ gapClosurePct: 20 }), FLIPKART_BANDS,
    );
    expect(byName(r.skills, "Leverage Use")).toBeLessThanOrEqual(60);
    expect(byName(r.skills, "Leverage Use")).toBeGreaterThan(45);
  });

  it("applies a decent-but-not-strong ceiling (75) under half the gap", () => {
    const r = groundNegotiationReport(
      inflatedSkills(), 88, "strongHire", outcome({ gapClosurePct: 45 }), FLIPKART_BANDS,
    );
    expect(byName(r.skills, "Leverage Use")).toBeLessThanOrEqual(75);
    expect(byName(r.skills, "Leverage Use")).toBeGreaterThan(60);
  });

  it("leaves a genuinely strong close (≥55% gap closed) untouched", () => {
    const r = groundNegotiationReport(
      inflatedSkills(), 88, "strongHire", outcome({ gapClosurePct: 80 }), FLIPKART_BANDS,
    );
    expect(byName(r.skills, "Leverage Use")).toBe(95);
    expect(r.overallScore).toBe(88);
    expect(r.band).toBe("strongHire");
  });

  it("never touches a walk-away, even with high skills", () => {
    const r = groundNegotiationReport(
      inflatedSkills(), 82, "hire",
      outcome({ outcome: "walked_away", gapClosurePct: 0 }), FLIPKART_BANDS,
    );
    // Declining a lowball is not a fold — leverage may legitimately be high.
    expect(byName(r.skills, "Leverage Use")).toBe(95);
    expect(r.overallScore).toBe(82);
    expect(r.band).toBe("hire");
  });

  it("does not second-guess the scorer when gap closure is unknown", () => {
    const r = groundNegotiationReport(
      inflatedSkills(), 79, "hire",
      outcome({ gapClosurePct: null }), FLIPKART_BANDS,
    );
    expect(byName(r.skills, "Leverage Use")).toBe(95);
    expect(r.overallScore).toBe(79);
    expect(r.band).toBe("hire");
  });

  it("is a no-op for a non-negotiation (undefined outcome)", () => {
    const skills = inflatedSkills();
    const r = groundNegotiationReport(skills, 79, "hire", undefined, FLIPKART_BANDS);
    expect(r.skills).toBe(skills);
    expect(r.overallScore).toBe(79);
    expect(r.band).toBe("hire");
  });

  it("never RAISES a score or band (monotonic down-only)", () => {
    // Scorer already scored the fold low → grounding must not lift it.
    const lowSkills = [
      { name: "Leverage Use", score: 30 },
      { name: "Closing Technique", score: 35 },
    ];
    const r = groundNegotiationReport(
      lowSkills, 40, "noHire", outcome({ gapClosurePct: 0 }), FLIPKART_BANDS,
    );
    expect(byName(r.skills, "Leverage Use")).toBe(30);
    expect(byName(r.skills, "Closing Technique")).toBe(35);
    expect(r.overallScore).toBeLessThanOrEqual(40);
  });

  it("falls back to default bands when calibration is absent", () => {
    const r = groundNegotiationReport(
      inflatedSkills(), 79, "hire", outcome({ gapClosurePct: 0 }),
      // no calibration bands passed
    );
    // Default profile: leanHire 55, hire 70. Grounded score ≤60 → not "hire".
    expect(r.overallScore).toBeLessThanOrEqual(60);
    expect(r.band).not.toBe("hire");
  });
});
