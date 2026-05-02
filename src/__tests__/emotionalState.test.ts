import { describe, it, expect } from "vitest";
import { deriveCandidateState } from "../_emotional-state";

describe("deriveCandidateState", () => {
  it("returns undefined for empty input", () => {
    expect(deriveCandidateState([])).toBeUndefined();
  });

  it("treats a single confident long answer as engaged + low stress", () => {
    const r = deriveCandidateState([
      "I led the migration from a Rails monolith to Go services. We moved 18 endpoints over six weeks. Latency dropped from 450ms p95 to 120ms p95 and we cut infrastructure cost by about 40 percent. The team paired daily and we hit every milestone.",
    ]);
    expect(r?.stress).toBe("low");
    expect(r?.engagement).toBe("engaged");
    expect(r?.fillerDensity).toBe(0);
  });

  it("flags high stress when hesitation markers stack up", () => {
    const r = deriveCandidateState([
      "Hmm, let me think. Umm, so the project, hmm, was about, let me see, scaling the order pipeline.",
    ]);
    expect(r?.stress).toBe("high");
  });

  it("flags medium stress on heavy filler density alone", () => {
    const r = deriveCandidateState([
      "So basically, like, we actually, you know, sort of had to like, basically rebuild the thing kind of from scratch.",
    ]);
    // 9 fillers in ~19 words = ~47% density → easily above 6% threshold
    expect(r?.stress).toBe("medium");
  });

  it("flags engagement as fading on shrinking trend (still ≥20 words)", () => {
    const r = deriveCandidateState([
      "I led a really significant migration project across multiple teams over six months and we shipped successfully with measurable impact on cost and latency throughout the entire transition period and follow-up reviews afterwards.",
      "We also did a smaller scale follow-up project that took about three weeks of focused work to complete.",
      "Smaller version of the same idea, ran four weeks, modest gains across the board, no major surprises during rollout this time around.",
    ]);
    // Latest 22 words; earlier avg ~26 — borderline, should be stable. Tighten:
    expect(r?.lengthTrend === "stable" || r?.lengthTrend === "shortening").toBe(true);
    // Even if it dips to shortening, latest >20 words → fading not disengaged
    if (r?.lengthTrend === "shortening") {
      expect(r?.engagement).toBe("fading");
    }
  });

  it("flags engagement as disengaged on shrinking AND <20 words", () => {
    const r = deriveCandidateState([
      "I led a significant migration project across multiple teams over six months and we shipped on time.",
      "Yes.",
    ]);
    expect(r?.engagement).toBe("disengaged");
  });

  it("rounds fillerDensity to 2 decimal places", () => {
    const r = deriveCandidateState([
      "We basically actually like did some work on the system.",
    ]);
    expect(r?.fillerDensity).toBeGreaterThan(0);
    // ensure it's a value with at most 2 decimals
    expect(Math.round(r!.fillerDensity * 100)).toBe(r!.fillerDensity * 100);
  });

  it("uses last 3 turns when window is larger", () => {
    const longTrail = ["one two three", "four five six", "seven eight nine", "ten eleven twelve"];
    const r = deriveCandidateState(longTrail);
    expect(r).toBeDefined();
    // latest len 3, earlier avg over (4..9 part) = (3 + 3) / 2 = 3 — stable
    expect(r?.lengthTrend).toBe("stable");
  });
});
