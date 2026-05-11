import { describe, it, expect } from "vitest";
import {
  resolveCounter,
  formatCounterSentence,
  substituteCounterNumber,
  composeCounterReply,
} from "../../server-handlers/_negotiation-counter";

describe("resolveCounter", () => {
  const ctx = { highestOfferMade: 30, maxStretch: 40, recommendedCounter: 35 };

  it("accepts an LLM number within band", () => {
    const r = resolveCounter(36, ctx);
    expect(r).toEqual({ ok: true, counter: 36, source: "llm" });
  });

  it("rejects counter below highestOfferMade and falls back to recommendation", () => {
    // Razorpay round-5: LLM said "revised offer of ₹35.3 LPA" when highest was ₹49.
    const r = resolveCounter(25, ctx);
    expect(r).toEqual({ ok: true, counter: 35, source: "recommended" });
  });

  it("rejects counter above maxStretch*1.05 and falls back", () => {
    const r = resolveCounter(50, ctx);
    expect(r).toEqual({ ok: true, counter: 35, source: "recommended" });
  });

  it("accepts a counter at maxStretch (no rounding rejection)", () => {
    const r = resolveCounter(40, ctx);
    expect(r).toEqual({ ok: true, counter: 40, source: "llm" });
  });

  it("returns not-ok when LLM is invalid AND recommendation is missing", () => {
    expect(resolveCounter(null, { highestOfferMade: 30, maxStretch: 40, recommendedCounter: null })).toEqual({
      ok: false,
      reason: "no-valid-counter-available",
    });
  });

  it("treats absent highestOfferMade as floor=0", () => {
    const r = resolveCounter(20, { highestOfferMade: null, maxStretch: 40, recommendedCounter: null });
    expect(r).toEqual({ ok: true, counter: 20, source: "llm" });
  });

  it("rejects non-finite / non-positive proposals and falls back to recommendation", () => {
    expect(resolveCounter(NaN, ctx)).toEqual({ ok: true, counter: 35, source: "recommended" });
    expect(resolveCounter(-5, ctx)).toEqual({ ok: true, counter: 35, source: "recommended" });
    expect(resolveCounter(0, ctx)).toEqual({ ok: true, counter: 35, source: "recommended" });
  });
});

describe("formatCounterSentence", () => {
  it("uses ceiling-language when counter is at maxStretch", () => {
    expect(formatCounterSentence(40, true)).toContain("top of what I can do");
    expect(formatCounterSentence(40, true)).toContain("₹40 LPA");
  });
  it("uses open-language when counter is below ceiling", () => {
    expect(formatCounterSentence(32, false)).toContain("Where does that leave us?");
  });
});

describe("substituteCounterNumber", () => {
  it("replaces existing rupee LPA figures with the validated counter", () => {
    expect(substituteCounterNumber("I can do ₹35.3 LPA total", 38)).toBe(
      "I can do ₹38 LPA total",
    );
  });
  it("replaces multiple rupee figures with the same counter", () => {
    expect(substituteCounterNumber("₹35 LPA or ₹36 LPA", 38)).toBe("₹38 LPA or ₹38 LPA");
  });
  it("leaves text without rupee figures unchanged", () => {
    expect(substituteCounterNumber("Let me push for this", 38)).toBe("Let me push for this");
  });
});

describe("composeCounterReply", () => {
  const ctx = { highestOfferMade: 30, maxStretch: 40, recommendedCounter: 35 };

  it("substitutes a backwards counter and appends the canonical sentence", () => {
    // Razorpay bug: LLM said "₹35.3 LPA" with highest=49. Helper must catch
    // and use recommended ₹35 (here ceiling=40, so the recommended itself
    // overrides the bad ₹35.3 — confirming the structural fix).
    const out = composeCounterReply("I can push for a revised offer of ₹35.3 LPA", 25, ctx)!;
    expect(out.source).toBe("recommended");
    expect(out.counter).toBe(35);
    // The bad number must be gone.
    expect(out.text).not.toContain("₹35.3");
    expect(out.text).toContain("₹35 LPA");
  });

  it("keeps an LLM number that's already valid and templates the sentence", () => {
    const out = composeCounterReply("Let me see what I can do.", 36, ctx)!;
    expect(out.source).toBe("llm");
    expect(out.counter).toBe(36);
    expect(out.text).toContain("Let me see what I can do.");
    expect(out.text).toContain("₹36 LPA");
  });

  it("returns null when no counter is resolvable", () => {
    expect(
      composeCounterReply("anything", null, { highestOfferMade: 30, maxStretch: 40, recommendedCounter: null }),
    ).toBeNull();
  });
});
