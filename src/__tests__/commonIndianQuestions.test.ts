import { describe, it, expect } from "vitest";
import {
  COMMON_INDIAN_QUESTIONS,
  TOP_25_INDIAN_QUESTIONS,
  FOCUS_TO_CANON_CATEGORIES,
  formatCommonIndianCanon,
} from "../../data/common-indian-questions";

describe("Common Indian interview questions canon", () => {
  it("ships a non-trivial number of questions", () => {
    // ~150 entries across 18 categories — sanity guard against accidental truncation.
    expect(COMMON_INDIAN_QUESTIONS.length).toBeGreaterThan(120);
  });

  it("every entry has valid frequency 1-5", () => {
    for (const e of COMMON_INDIAN_QUESTIONS) {
      expect([1, 2, 3, 4, 5]).toContain(e.frequency);
      expect(e.text.trim().length).toBeGreaterThan(0);
    }
  });

  it("covers all 18 canon categories", () => {
    const cats = new Set(COMMON_INDIAN_QUESTIONS.map((e) => e.category));
    expect(cats.size).toBeGreaterThanOrEqual(18);
  });

  it("top-25 list is exactly 25 entries with no duplicates", () => {
    expect(TOP_25_INDIAN_QUESTIONS.length).toBe(25);
    expect(new Set(TOP_25_INDIAN_QUESTIONS).size).toBe(25);
  });

  it("HR-round canon surfaces CTC + notice-period probes (load-bearing for Indian realism)", () => {
    const out = formatCommonIndianCanon({ focus: "hr-round" });
    expect(out).toMatch(/CTC/);
    expect(out).toMatch(/notice period/i);
    expect(out).toMatch(/INDIAN INTERVIEWER CANON/);
  });

  it("salary-negotiation canon surfaces hike-justification + ESOP/variable pushbacks", () => {
    const out = formatCommonIndianCanon({ focus: "salary-negotiation" });
    expect(out).toMatch(/hike/i);
    expect(out).toMatch(/ESOP|variable/i);
  });

  it("behavioral canon surfaces STAR chestnuts (pressure, failure, conflict)", () => {
    const out = formatCommonIndianCanon({ focus: "behavioral" });
    expect(out).toMatch(/pressure/i);
    expect(out).toMatch(/conflict/i);
  });

  it("campus-placement canon surfaces fresher-specific probes", () => {
    const out = formatCommonIndianCanon({ focus: "campus-placement" });
    expect(out).toMatch(/final-year project|fresher|relocat/i);
  });

  it("government-psu returns empty (PSU has its own canon, not corporate)", () => {
    const out = formatCommonIndianCanon({ focus: "government-psu" });
    expect(out).toBe("");
  });

  it.each([
    ["case-study"],
    ["strategic"],
    ["technical"],
    ["panel"],
    ["management"],
  ])("returns empty for %s (format does not match opening/CTC canon)", (focus) => {
    expect(formatCommonIndianCanon({ focus })).toBe("");
    // Even with role + tier expansion present, non-applicable focuses stay silent.
    expect(formatCommonIndianCanon({ focus, role: "Sales Manager", companyTier: "indian-unicorn" })).toBe("");
  });

  it("role keyword pulls in track-specific category — sales role gets sales canon", () => {
    const out = formatCommonIndianCanon({ focus: "behavioral", role: "Sales Manager" });
    expect(out).toMatch(/target|prospect|objection/i);
  });

  it("company tier pulls in tier-specific category — IT services gets service-agreement probe", () => {
    const out = formatCommonIndianCanon({
      focus: "behavioral",
      companyTier: "it-services",
    });
    expect(out).toMatch(/service agreement|rotational shifts|client/i);
  });

  it("startup tier surfaces ambiguity / first-30-days probes", () => {
    const out = formatCommonIndianCanon({
      focus: "behavioral",
      companyTier: "indian-unicorn",
    });
    expect(out).toMatch(/ambiguity|30 days|trade-off|metric/i);
  });

  it("limit caps output entries", () => {
    const out = formatCommonIndianCanon({ focus: "behavioral", limit: 3 });
    const bullets = out.split("\n").filter((l) => l.startsWith("- "));
    expect(bullets.length).toBeLessThanOrEqual(3);
  });

  it("highFrequencyOnly excludes frequency<4 entries", () => {
    const out = formatCommonIndianCanon({ focus: "behavioral", highFrequencyOnly: true, limit: 50 });
    // All listed canon for behavioral at freq>=4: pressure, failure, conflict, ownership, etc.
    expect(out).toMatch(/pressure|failure|conflict|ownership/i);
    // "improved a process" is freq=3 → must be excluded
    expect(out).not.toMatch(/improved a process/i);
  });

  it("FOCUS_TO_CANON_CATEGORIES is restricted to focuses where canon makes sense", () => {
    // Canon applies ONLY to these four — case-study / strategic / technical /
    // panel / management / government-psu intentionally absent (canon would
    // break their formats).
    expect(Object.keys(FOCUS_TO_CANON_CATEGORIES).sort()).toEqual([
      "behavioral",
      "campus-placement",
      "hr-round",
      "salary-negotiation",
    ]);
  });
});
