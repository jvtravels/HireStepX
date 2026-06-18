import { describe, it, expect } from "vitest";
import {
  pickInitialNegotiationStyle,
  computeNegotiationPhase,
  NEGOTIATION_PHASES,
  extractKernelBand,
  adoptKernelBand,
  type ReportBand,
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

/* ─── extractKernelBand / adoptKernelBand ────────────────────────────
 *
 * STRUCTURAL FIX (2026-06-18) — Deal Summary band/package inflation.
 *
 * The report used to show the UNCLAMPED generate-questions band (e.g.
 * ₹80.9 LPA) while the kernel negotiated on the tier-CLAMPED band (₹41.4).
 * These tests LOCK the kernel-first reconciliation: the report band must
 * adopt the kernel's authoritative numbers, never exceed them, and keep a
 * coherent floor. If any invariant breaks, the inflated-package regression
 * the user reported silently returns. */

const INFLATED: ReportBand = {
  initialOffer: 80.9,
  minOffer: 70,
  maxStretch: 95,
  walkAway: 60,
  joiningBonusRange: [2, 5],
  hasEquity: true,
  equityRange: [8, 12],
  bandContext: "growth-stage unicorn",
};

describe("extractKernelBand", () => {
  it("narrows a well-formed serialized band to its load-bearing numbers", () => {
    const got = extractKernelBand({ initialOffer: 41.4, maxStretch: 52, walkAway: 33, hasEquity: false, extra: "ignored" });
    expect(got).toEqual({ initialOffer: 41.4, maxStretch: 52, walkAway: 33, hasEquity: false });
  });

  it("returns null when any load-bearing number is missing or non-finite", () => {
    expect(extractKernelBand(null)).toBeNull();
    expect(extractKernelBand(undefined)).toBeNull();
    expect(extractKernelBand("nope")).toBeNull();
    expect(extractKernelBand({ initialOffer: 41.4, maxStretch: 52 })).toBeNull(); // no walkAway
    expect(extractKernelBand({ initialOffer: NaN, maxStretch: 52, walkAway: 33 })).toBeNull();
  });

  it("leaves hasEquity undefined when the serialized band omits it", () => {
    const got = extractKernelBand({ initialOffer: 41.4, maxStretch: 52, walkAway: 33 });
    expect(got?.hasEquity).toBeUndefined();
  });
});

describe("adoptKernelBand", () => {
  it("replaces inflated band numbers with the kernel's authoritative ones", () => {
    const kernel = { initialOffer: 41.4, maxStretch: 52, walkAway: 33, hasEquity: true };
    const got = adoptKernelBand(INFLATED, kernel);
    expect(got.initialOffer).toBe(41.4);
    expect(got.maxStretch).toBe(52);
    expect(got.walkAway).toBe(33);
  });

  it("pins minOffer at or below the (lowered) kernel initialOffer", () => {
    // INFLATED.minOffer (70) is above the kernel initialOffer (41.4) — it
    // must drop, never read as "minimum higher than the opening offer".
    const got = adoptKernelBand(INFLATED, { initialOffer: 41.4, maxStretch: 52, walkAway: 33 });
    expect(got.minOffer).toBeLessThanOrEqual(got.initialOffer);
    expect(got.minOffer).toBe(41.4);
  });

  it("keeps the descriptive metadata the resolver supplied", () => {
    const got = adoptKernelBand(INFLATED, { initialOffer: 41.4, maxStretch: 52, walkAway: 33, hasEquity: true });
    expect(got.joiningBonusRange).toEqual([2, 5]);
    expect(got.equityRange).toEqual([8, 12]);
    expect(got.bandContext).toBe("growth-stage unicorn");
  });

  it("zeroes the equity range when the kernel says no equity is on the table", () => {
    const got = adoptKernelBand(INFLATED, { initialOffer: 41.4, maxStretch: 52, walkAway: 33, hasEquity: false });
    expect(got.hasEquity).toBe(false);
    expect(got.equityRange).toEqual([0, 0]);
  });

  it("synthesizes a coherent band when there is no prior report band", () => {
    const got = adoptKernelBand(null, { initialOffer: 41.4, maxStretch: 52, walkAway: 33, hasEquity: false });
    expect(got.initialOffer).toBe(41.4);
    expect(got.minOffer).toBe(33); // floors at walkAway when nothing better is known
    expect(got.hasEquity).toBe(false);
    expect(got.bandContext).toBe("");
  });

  it("is idempotent — re-adopting the same kernel band is a no-op", () => {
    const kernel = { initialOffer: 41.4, maxStretch: 52, walkAway: 33, hasEquity: true };
    const once = adoptKernelBand(INFLATED, kernel);
    const twice = adoptKernelBand(once, kernel);
    expect(twice).toEqual(once);
  });

  it("guarantees band-capture math can never be negative-from-inflation", () => {
    // The bug symptom: finalOffer floored to an inflated initialOffer made
    // captured = (final - initial)/range = 0. With the kernel band, a real
    // close above the kernel initialOffer yields positive capture.
    const got = adoptKernelBand(INFLATED, { initialOffer: 41.4, maxStretch: 52, walkAway: 33 });
    const finalOffer = 46; // a realistic close the kernel actually reached
    const range = got.maxStretch - got.initialOffer;
    const captured = Math.round(((finalOffer - got.initialOffer) / range) * 100);
    expect(captured).toBeGreaterThan(0);
  });
});
