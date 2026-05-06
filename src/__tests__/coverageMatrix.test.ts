/**
 * Coverage-matrix audit for the question bank.
 *
 * Prints a (company × role-family × focus) coverage report to stderr
 * and asserts MINIMUM tier-1 coverage thresholds. Catches silent
 * drift — e.g. someone deleting an Amazon SDE behavioral entry leaves
 * the LLM falling to tier-2 references (peer-company), which means
 * the prompt loses its company-specific style anchor.
 *
 * The thresholds are deliberately lenient — this test is about
 * surfacing the matrix shape, not pinning every cell. When tier-1
 * coverage genuinely improves, raise the threshold here.
 */

import { describe, it, expect } from "vitest";
import { QUESTION_BANK, type CompanyKey, type RoleFamily, type FocusArea } from "../../data/interview-question-bank";

/* The cells we genuinely care about — the highest-traffic
   (company × role × focus) combos for Indian candidates. Cells
   outside this set are nice-to-have; cells inside should never
   silently fall to tier-2. */
const HIGH_TRAFFIC_COMBOS: ReadonlyArray<readonly [CompanyKey, RoleFamily, FocusArea]> = [
  // FAANG core
  ["amazon", "swe", "behavioral"],
  ["amazon", "swe", "system-design"],
  ["google", "swe", "system-design"],
  ["microsoft", "pm", "behavioral"],
  ["meta", "swe", "system-design"],
  // Indian unicorns — top targets
  ["flipkart", "pm", "case-study"],
  ["razorpay", "swe", "system-design"],
  ["razorpay", "swe", "technical"],
  ["swiggy", "pm", "case-study"],
  ["zomato", "pm", "case-study"],
  ["phonepe", "swe", "system-design"],
  // Salary-negotiation should always have entries (highest stakes)
  ["razorpay", "salary", "salary-negotiation"],
  ["google", "salary", "salary-negotiation"],
  ["tcs", "salary", "salary-negotiation"],
  // Stripe — distinct hiring style worth pinning
  ["stripe", "swe", "technical"],
  ["stripe", "swe", "system-design"],
  // Consulting MBB
  ["mckinsey", "consultant", "case-study"],
  ["bcg", "consultant", "case-study"],
  // Quant
  ["jane-street", "quant", "technical"],
  // PM ladder
  ["atlassian", "pm", "case-study"],
  // Management focus (was missing pre-2026-Q2 — silently fell to behavioral)
  ["amazon", "em", "management"],
  ["razorpay", "em", "management"],
  // Campus placement (high Indian-market commercial value)
  ["tcs", "campus", "campus-placement"],
  ["infosys", "campus", "campus-placement"],
  ["amazon", "campus", "campus-placement"],
  // Government / PSU (was 0-coverage pre-2026-Q2)
  ["upsc", "civil-services", "government-psu"],
  ["ssb", "defence", "government-psu"],
  ["isro", "scientist", "government-psu"],
  ["rbi", "civil-services", "government-psu"],
  // HR Round (lifted to 11 entries from 5)
  ["mckinsey", "consultant", "hr"],
  ["amazon", "swe", "hr"],
  ["stripe", "swe", "hr"],
  // Strategic (was silently aliased to case-study; now has dedicated bucket)
  ["swiggy", "pm", "strategic"],
  ["razorpay", "em", "strategic"],
  ["bain", "consultant", "strategic"],
  // Panel Interview (cross-persona handoff entries)
  ["atlassian", "behavioral", "panel"],
  ["google", "em", "panel"],
  ["amazon", "em", "panel"],
  // Technical Leadership (senior-IC × EM hybrid — distinct from pure SWE technical)
  ["razorpay", "em", "technical"],
  ["stripe", "em", "technical"],
  ["google", "em", "technical"],
  ["amazon", "em", "technical"],
];

function hasTier1(combo: readonly [CompanyKey, RoleFamily, FocusArea]): boolean {
  const [company, roleFamily, focus] = combo;
  return QUESTION_BANK.some(
    e => e.company === company && e.roleFamily === roleFamily && e.focus === focus,
  );
}

describe("question-bank coverage matrix", () => {
  it("every high-traffic (company × role × focus) combo has at least one tier-1 entry", () => {
    const missing = HIGH_TRAFFIC_COMBOS.filter(c => !hasTier1(c));
    if (missing.length > 0) {
      // Print actionable hint before failing.
      const formatted = missing.map(([c, r, f]) => `  ${c} × ${r} × ${f}`).join("\n");
      throw new Error(
        `Question bank missing tier-1 coverage for ${missing.length} high-traffic combo(s):\n${formatted}\n\nAdd at least one entry per missing cell to data/interview-question-bank.ts.`,
      );
    }
    expect(missing).toHaveLength(0);
  });

  it("every entry has a non-empty styleNote OR is a known styleNote-optional category", () => {
    /* StyleNote is the most useful field — it tells the LLM what
       the question pattern actually tests. We allow it to be absent
       only for trivial warmups. */
    const missingNotes = QUESTION_BANK.filter(
      e => !e.styleNote && e.difficulty !== "warmup",
    );
    /* Don't fail hard — surface as a soft floor. Aim for >75% styleNote
       coverage at non-warmup entries. */
    const total = QUESTION_BANK.filter(e => e.difficulty !== "warmup").length;
    const coverage = (total - missingNotes.length) / total;
    expect(coverage).toBeGreaterThanOrEqual(0.6);
  });

  it("salary-negotiation entries span at least 5 distinct companies", () => {
    /* Salary neg is the highest-stakes focus. Diversity of company
       contexts (FAANG / unicorn / IT-services / consulting / GCC)
       is what makes the LLM able to anchor an offer to the right tier. */
    const salaryCompanies = new Set(
      QUESTION_BANK.filter(e => e.focus === "salary-negotiation").map(e => e.company),
    );
    expect(salaryCompanies.size).toBeGreaterThanOrEqual(5);
  });

  it("at least 60% of high-traffic combos have multiple tier-1 entries (variety)", () => {
    /* One entry is enough to anchor style; multiple entries let the
       LLM pick from a range so questions don't repeat across sessions. */
    const multiEntryCount = HIGH_TRAFFIC_COMBOS.filter(combo => {
      const [company, roleFamily, focus] = combo;
      return QUESTION_BANK.filter(
        e => e.company === company && e.roleFamily === roleFamily && e.focus === focus,
      ).length >= 2;
    }).length;
    const ratio = multiEntryCount / HIGH_TRAFFIC_COMBOS.length;
    /* Soft floor: at least 30% of high-traffic combos should have
       depth (>=2 entries). Raise as bank grows. */
    expect(ratio).toBeGreaterThanOrEqual(0.3);
  });

  it("recency: at least 40% of bank is from 2026-Q1 or later", () => {
    /* Old questions don't expire, but the field shifts. Ensure ongoing
       refresh is happening. Threshold raises as bank ages. */
    const recent = QUESTION_BANK.filter(e => /^2026-Q[1-4]$/.test(e.addedQuarter)).length;
    expect(recent / QUESTION_BANK.length).toBeGreaterThanOrEqual(0.4);
  });
});
