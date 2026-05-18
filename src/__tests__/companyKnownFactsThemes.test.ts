import { describe, it, expect } from "vitest";
import {
  COMPANY_KNOWN_FACTS,
  formatKnownFactsForPrompt,
  getKnownFacts,
} from "../../data/company-known-facts";

/* Phase-6.6 — structured `themes` directive on company-known-facts.
   Bias-toward themes render as an imperative "BIAS QUESTIONS TOWARD:"
   line that the LLM treats with more weight than prose buried in
   `notes`. These tests pin:
   - the schema (themes is optional, but when present is a non-empty
     string[] with short entries)
   - the renderer (emits the directive when themes set, skips when not)
   - the audit-canonical Meesho coverage (the 7 themes from the audit
     report — India scale / Tier 2-3 / mobile-first / low-bandwidth /
     commerce behaviour / seller-customer / growth-retention) */

describe("company-known-facts — themes schema", () => {
  it("every entry's themes (when present) is a non-empty array of short strings", () => {
    for (const [slug, facts] of Object.entries(COMPANY_KNOWN_FACTS)) {
      if (facts.themes === undefined) continue;
      expect(Array.isArray(facts.themes), `${slug}: themes must be an array`).toBe(true);
      expect(facts.themes.length, `${slug}: themes must be non-empty`).toBeGreaterThan(0);
      for (const t of facts.themes) {
        expect(typeof t, `${slug}: theme entries must be strings`).toBe("string");
        expect(t.length, `${slug}: theme "${t}" must be non-empty`).toBeGreaterThan(0);
        // Soft cap on length — themes render comma-joined inline; long
        // entries make the directive line unreadable. 60 chars is generous.
        expect(t.length, `${slug}: theme "${t}" too long (keep ≤60 chars)`).toBeLessThanOrEqual(60);
      }
    }
  });
});

describe("formatKnownFactsForPrompt — themes rendering", () => {
  it("emits a 'BIAS QUESTIONS TOWARD:' directive when themes are present", () => {
    const facts = getKnownFacts("meesho");
    expect(facts).not.toBeNull();
    const out = formatKnownFactsForPrompt(facts, "Meesho");
    expect(out).toMatch(/BIAS QUESTIONS TOWARD:/);
    // The directive must list all of meesho's themes verbatim.
    for (const t of facts!.themes ?? []) {
      expect(out).toContain(t);
    }
  });

  it("does NOT emit the bias directive when themes are absent", () => {
    /* Build a facts record with no themes; the renderer must skip the
       directive line entirely (no empty "BIAS QUESTIONS TOWARD:" leak). */
    const facts = {
      description: "Test co.",
      lastVerified: "2026-05-19",
    };
    const out = formatKnownFactsForPrompt(facts, "TestCo");
    expect(out).not.toMatch(/BIAS QUESTIONS TOWARD/);
  });

  it("treats empty themes array as 'no themes' (defensive)", () => {
    const facts = {
      description: "Test co.",
      themes: [],
      lastVerified: "2026-05-19",
    };
    const out = formatKnownFactsForPrompt(facts, "TestCo");
    expect(out).not.toMatch(/BIAS QUESTIONS TOWARD/);
  });
});

describe("Phase-6.6 — Meesho theme coverage (audit canonical)", () => {
  /* The Meesho × Senior Product Designer audit (May 2026) called out
     7 themes the question set should bias toward. These are pinned so
     a future edit to meesho's row can't accidentally drop one. */
  const canonical = [
    /India scale/i,
    /Tier 2.?\/?3/i,
    /mobile-first/i,
    /low.?bandwidth/i,
    /social.?commerce/i,
    /seller/i,
    /(growth|retention)/i,
  ];

  it("Meesho's themes cover the 7 audit-canonical biases", () => {
    const meesho = getKnownFacts("meesho");
    expect(meesho).not.toBeNull();
    const joined = (meesho!.themes ?? []).join(" | ");
    for (const pattern of canonical) {
      expect(joined, `Missing theme matching ${pattern}`).toMatch(pattern);
    }
  });

  it("Meesho's bias directive renders inside the prompt block", () => {
    const out = formatKnownFactsForPrompt(getKnownFacts("meesho"), "Meesho");
    expect(out).toMatch(/BIAS QUESTIONS TOWARD:.*Tier 2\/3 buyers/);
    expect(out).toMatch(/mobile-first UX/);
    expect(out).toMatch(/low-bandwidth performance/);
  });
});

describe("Phase-6.6 — peer-company themes coverage", () => {
  /* Themes were also added for the next 5 high-traffic Indian product
     companies. Pin presence so peer companies don't silently regress
     to themes-less. */
  const expectedThemed = ["flipkart", "swiggy", "zomato", "phonepe", "razorpay"];
  for (const slug of expectedThemed) {
    it(`${slug} has at least 5 themes`, () => {
      const facts = getKnownFacts(slug);
      expect(facts).not.toBeNull();
      expect(facts!.themes, `${slug} should have themes`).toBeDefined();
      expect((facts!.themes ?? []).length).toBeGreaterThanOrEqual(5);
    });
  }
});
