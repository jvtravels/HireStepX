import { describe, it, expect } from "vitest";
import {
  auditQuestion,
  buildJudgePrompt,
  findUnverifiedClaims,
  parseJudgeVerdict,
  pickCells,
  summarizeAudit,
  type JudgeVerdict,
} from "../../server-handlers/_hallucination-eval-helpers";
import type { KnownFacts } from "../../data/company-known-facts";

const FACTS: KnownFacts = {
  description: "Payments gateway for Indian businesses",
  products: ["Payment Gateway", "RazorpayX"],
  competitors: ["Cashfree", "PayU"],
  lastVerified: "2026-01-01",
};

const verdict = (over: Partial<JudgeVerdict> = {}): JudgeVerdict => ({
  claims: [],
  isPureHypothetical: false,
  isAnonymized: false,
  ...over,
});

describe("buildJudgePrompt", () => {
  it("fills every placeholder", () => {
    const p = buildJudgePrompt("Razorpay", "How would you scale RazorpayX?");
    expect(p).not.toContain("{COMPANY}");
    expect(p).not.toContain("{QUESTION}");
    expect(p).toContain("How would you scale RazorpayX?");
    expect(p).toContain("about Razorpay.");
  });

  it("does not interpret $ patterns in the question", () => {
    expect(buildJudgePrompt("X", "cost is $& and $1")).toContain("cost is $& and $1");
  });
});

describe("parseJudgeVerdict", () => {
  it("accepts a well-formed verdict", () => {
    const v = parseJudgeVerdict({ claims: [{ claim: "RazorpayX", type: "product" }], isPureHypothetical: true, isAnonymized: false });
    expect(v).toEqual({ claims: [{ claim: "RazorpayX", type: "product" }], isPureHypothetical: true, isAnonymized: false });
  });

  it("rejects non-objects and missing claims", () => {
    expect(parseJudgeVerdict(null)).toBeNull();
    expect(parseJudgeVerdict("x")).toBeNull();
    expect(parseJudgeVerdict({})).toBeNull();
    expect(parseJudgeVerdict({ claims: [{ type: "scale" }] })).toBeNull();
  });

  it("defaults flags to false and unknown type", () => {
    expect(parseJudgeVerdict({ claims: [{ claim: "a" }] })).toEqual({
      claims: [{ claim: "a", type: "unknown" }],
      isPureHypothetical: false,
      isAnonymized: false,
    });
  });
});

describe("findUnverifiedClaims", () => {
  it("passes claims backed by the whitelist", () => {
    expect(findUnverifiedClaims([{ claim: "RazorpayX", type: "product" }], FACTS)).toEqual([]);
  });

  it("flags claims absent from the whitelist", () => {
    expect(findUnverifiedClaims([{ claim: "processes 10 trillion transactions a day", type: "scale" }], FACTS)).toEqual([
      "processes 10 trillion transactions a day",
    ]);
  });

  it("treats everything as unverified without a whitelist", () => {
    expect(findUnverifiedClaims([{ claim: "RazorpayX", type: "product" }], null)).toEqual(["RazorpayX"]);
  });

  it("an empty whitelist field does not verify every claim", () => {
    expect(findUnverifiedClaims([{ claim: "invented unicorn product", type: "product" }], { ...FACTS, scale: "", notes: "" })).toEqual([
      "invented unicorn product",
    ]);
  });

  it("ignores blank claims", () => {
    expect(findUnverifiedClaims([{ claim: "  ", type: "scale" }], FACTS)).toEqual([]);
  });
});

describe("auditQuestion", () => {
  it("is clean with no claims", () => {
    expect(auditQuestion("q", verdict(), FACTS).isHallucination).toBe(false);
  });

  it("flags unverified assertions", () => {
    const a = auditQuestion("q", verdict({ claims: [{ claim: "founded by Jane Doe", type: "person" }] }), FACTS);
    expect(a.isHallucination).toBe(true);
    expect(a.unverifiedClaims).toEqual(["founded by Jane Doe"]);
  });

  it("forgives pure hypotheticals", () => {
    const a = auditQuestion("q", verdict({ isPureHypothetical: true, claims: [{ claim: "10B txn/day", type: "scale" }] }), FACTS);
    expect(a.unverifiedClaims).toHaveLength(1);
    expect(a.isHallucination).toBe(false);
  });

  it("skips the cross-check for anonymized questions", () => {
    const a = auditQuestion("q", verdict({ isAnonymized: true, claims: [{ claim: "a big unicorn", type: "scale" }] }), FACTS);
    expect(a.isHallucination).toBe(false);
  });
});

describe("summarizeAudit", () => {
  const mk = (isHallucination: boolean) => ({ question: "q", claims: [], unverifiedClaims: [], isHallucination });

  it("reports null rate when nothing was judged", () => {
    expect(summarizeAudit([], 0.05)).toEqual({ judged: 0, hallucinated: 0, rate: null, exceedsThreshold: false });
  });

  it("compares rate to threshold strictly", () => {
    const audits = [mk(true), ...Array.from({ length: 19 }, () => mk(false))];
    expect(summarizeAudit(audits, 0.05).exceedsThreshold).toBe(false);
    expect(summarizeAudit([mk(true), ...audits.slice(1, 10)], 0.05).exceedsThreshold).toBe(true);
  });
});

describe("pickCells", () => {
  const cells = ["a", "b", "c", "d", "e"];

  it("takes a window from the offset", () => {
    expect(pickCells(cells, 2, 1)).toEqual(["b", "c"]);
  });

  it("wraps around the end", () => {
    expect(pickCells(cells, 3, 4)).toEqual(["e", "a", "b"]);
  });

  it("caps at the matrix size and handles negative offsets", () => {
    expect(pickCells(cells, 99, 0)).toEqual(cells);
    expect(pickCells(cells, 1, -1)).toEqual(["e"]);
  });

  it("returns nothing for empty input or non-positive sample", () => {
    expect(pickCells([], 3, 0)).toEqual([]);
    expect(pickCells(cells, 0, 0)).toEqual([]);
  });
});
