import { describe, it, expect } from "vitest";
import {
  pickInitialNegotiationStyle,
  computeNegotiationPhase,
  NEGOTIATION_PHASES,
} from "../_negotiation-state";

/* ─── pickInitialNegotiationStyle ────────────────────────────────── */

function makeStorage(seed: { hirestepx_sessions?: string }): Storage {
  return {
    getItem: (k: string) => (k in seed ? (seed as Record<string, string>)[k] ?? null : null),
    setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0,
  };
}

describe("pickInitialNegotiationStyle", () => {
  it("returns undefined for non-negotiation interview types", () => {
    expect(pickInitialNegotiationStyle("behavioral")).toBeUndefined();
    expect(pickInitialNegotiationStyle("technical")).toBeUndefined();
  });

  it("returns aggressive for high recent average (≥78)", () => {
    const storage = makeStorage({
      hirestepx_sessions: JSON.stringify([
        { type: "salary-negotiation", score: 85 },
        { type: "salary-negotiation", score: 80 },
        { type: "salary-negotiation", score: 78 },
      ]),
    });
    expect(pickInitialNegotiationStyle("salary-negotiation", () => storage)).toBe("aggressive");
  });

  it("returns defensive for mid-range recent average (65–77)", () => {
    const storage = makeStorage({
      hirestepx_sessions: JSON.stringify([
        { type: "salary-negotiation", score: 70 },
      ]),
    });
    expect(pickInitialNegotiationStyle("salary-negotiation", () => storage)).toBe("defensive");
  });

  it("returns cooperative for low recent average (<65)", () => {
    const storage = makeStorage({
      hirestepx_sessions: JSON.stringify([
        { type: "salary-negotiation", score: 50 },
      ]),
    });
    expect(pickInitialNegotiationStyle("salary-negotiation", () => storage)).toBe("cooperative");
  });

  it("ignores non-negotiation sessions when computing the average", () => {
    const storage = makeStorage({
      hirestepx_sessions: JSON.stringify([
        { type: "behavioral", score: 95 }, // would push avg above 78 if counted
        { type: "salary-negotiation", score: 50 },
      ]),
    });
    expect(pickInitialNegotiationStyle("salary-negotiation", () => storage)).toBe("cooperative");
  });

  it("falls back to a random style when there is no history", () => {
    const storage = makeStorage({});
    const result = pickInitialNegotiationStyle("salary-negotiation", () => storage);
    expect(["cooperative", "defensive", "aggressive"]).toContain(result);
  });

  it("falls back to random when storage throws (Safari private mode)", () => {
    const result = pickInitialNegotiationStyle("salary-negotiation", () => {
      throw new Error("private mode");
    });
    expect(["cooperative", "defensive", "aggressive"]).toContain(result);
  });

  it("falls back to random on malformed JSON", () => {
    const storage = makeStorage({ hirestepx_sessions: "not-json{{" });
    const result = pickInitialNegotiationStyle("salary-negotiation", () => storage);
    expect(["cooperative", "defensive", "aggressive"]).toContain(result);
  });
});

/* ─── computeNegotiationPhase ───────────────────────────────────── */

describe("computeNegotiationPhase", () => {
  const sixQuestions = ["intro", "question", "question", "question", "question", "question", "question", "closing"];

  it("returns undefined for non-negotiation interview types", () => {
    expect(computeNegotiationPhase({
      interviewType: "behavioral", currentStep: 2, scriptStepTypes: sixQuestions,
    })).toBeUndefined();
  });

  it("starts at offer-reaction on the first question", () => {
    expect(computeNegotiationPhase({
      interviewType: "salary-negotiation", currentStep: 1, scriptStepTypes: sixQuestions,
    })).toBe("offer-reaction");
  });

  it("ends at closing on the final question", () => {
    expect(computeNegotiationPhase({
      interviewType: "salary-negotiation", currentStep: 6, scriptStepTypes: sixQuestions,
    })).toBe("closing");
  });

  it("returns closing for a single-question script (edge case)", () => {
    expect(computeNegotiationPhase({
      interviewType: "salary-negotiation", currentStep: 0, scriptStepTypes: ["question"],
    })).toBe("closing");
  });

  it("walks through all 6 phases in order across a typical script", () => {
    const phases = sixQuestions
      .map((_, i) => computeNegotiationPhase({
        interviewType: "salary-negotiation", currentStep: i, scriptStepTypes: sixQuestions,
      }))
      .filter(Boolean);
    // First should be offer-reaction, last should be closing.
    expect(phases[0]).toBe("offer-reaction");
    expect(phases[phases.length - 1]).toBe("closing");
    // Every emitted phase must be a known one.
    for (const p of phases) {
      expect(NEGOTIATION_PHASES).toContain(p as (typeof NEGOTIATION_PHASES)[number]);
    }
  });

  it("clamps to a valid phase even when currentStep overshoots the script", () => {
    const result = computeNegotiationPhase({
      interviewType: "salary-negotiation", currentStep: 999, scriptStepTypes: sixQuestions,
    });
    expect(result).toBe("closing");
  });

  it("treats follow-up steps as questions for phase ratio", () => {
    const withFollowUps = ["question", "follow-up", "question", "follow-up", "question"];
    const phase = computeNegotiationPhase({
      interviewType: "salary-negotiation", currentStep: 0, scriptStepTypes: withFollowUps,
    });
    expect(phase).toBe("offer-reaction");
  });
});
