/* Phase-1 quick-win regressions for the campus-placement analyzer.
 *
 * Covers two changes that landed together:
 *
 *  1. `meta.campusPlacement` — tier-aware CGPA calibration the analyzer
 *     used. Surfaced in the report so the candidate sees the actual
 *     cutoff they were graded against. We assert the analyzer populates
 *     `companyTier`, `collegeTier`, `baseCgpaCutoff`, `adjustedCgpaCutoff`
 *     across the company-tier ladder (service / generic / global) AND
 *     the college-tier leniency adjustment (-0.5 for IIT/NIT/BITS).
 *
 *  2. `generic_passion_no_substance` flag now requires BOTH
 *     SPECIFIC_PROJECT and SUBSTANTIATION_TOKEN to be absent before
 *     firing. The earlier version fired on candidates who said
 *     "I'm passionate about ML, you can see my Kaggle profile" — a
 *     concrete substantiation, not generic filler.
 *
 *  Both behaviors were the visible deliverable of the Campus Placement
 *  Score Improvement Plan, Phase 1.
 */

import { describe, it, expect } from "vitest";
import { campusPlacementAnalyzer as campusPlacement } from "../../server-handlers/analyzers/campus-placement";
import type { SessionRowForAnalysis } from "../../server-handlers/analyzers/_types";

function session(opts: {
  userText: string;
  targetCompany?: string | null;
}): SessionRowForAnalysis {
  // Minimum-viable shape. The analyzer reads userText off the user
  // turns and target_company off the session row; everything else
  // exists only so the type-checker is happy.
  return {
    id: "s1",
    user_id: "u1",
    type: "campus-placement",
    focus: "campus-placement",
    difficulty: "medium",
    score: 70,
    questions: 6,
    duration: 600,
    transcript: [
      { speaker: "ai", text: "Tell me about yourself.", time: "00:00" },
      { speaker: "user", text: opts.userText, time: "00:05" },
      // Padding so analyzer counts ≥ 3 user turns (some flags gate on
      // turn count). Kept intentionally bland — no project verbs, no
      // tech stack, no substantiation tokens — so we don't accidentally
      // satisfy other flag suppressors via this turn.
      { speaker: "ai", text: "Anything else?", time: "01:00" },
      { speaker: "user", text: "Yes, that is all from me, thanks for the time and the chance to interview.", time: "01:15" },
      { speaker: "ai", text: "Why this company?", time: "02:00" },
      { speaker: "user", text: "I think it would be a good place to learn and grow over the next few years honestly.", time: "02:15" },
    ],
    ai_feedback: "",
    skill_scores: null,
    job_description: null,
    jd_analysis: null,
    resume_version_id: null,
    created_at: new Date().toISOString(),
    target_company: opts.targetCompany ?? null,
  };
}

describe("campus-placement meta.campusPlacement", () => {
  it("emits the service-tier cutoff (6.5) for TCS", async () => {
    const result = await campusPlacement.analyze({
      session: session({ userText: "My CGPA is 7.4.", targetCompany: "TCS" }),
      resume: null,
    });
    expect(result.meta?.campusPlacement?.companyTier).toBe("service");
    expect(result.meta?.campusPlacement?.baseCgpaCutoff).toBe(6.5);
    expect(result.meta?.campusPlacement?.targetCompany).toBe("TCS");
  });

  it("emits the global-product cutoff (7.5) for Google", async () => {
    const result = await campusPlacement.analyze({
      session: session({ userText: "My CGPA is 8.1.", targetCompany: "Google" }),
      resume: null,
    });
    expect(result.meta?.campusPlacement?.companyTier).toBe("product-global");
    expect(result.meta?.campusPlacement?.baseCgpaCutoff).toBe(7.5);
  });

  it("applies the -0.5 tier-1 college adjustment when the candidate mentions IIT", async () => {
    const result = await campusPlacement.analyze({
      session: session({ userText: "I study at IIT Bombay. My CGPA is 7.4.", targetCompany: "Google" }),
      resume: null,
    });
    const m = result.meta?.campusPlacement;
    expect(m?.collegeTier).toBe("tier-1");
    expect(m?.baseCgpaCutoff).toBe(7.5);
    // Tier-1 leniency knocks 0.5 off the gate.
    expect(m?.adjustedCgpaCutoff).toBeCloseTo(7.0, 5);
  });

  it("records the verbalised CGPA on meta.statedCgpa", async () => {
    const result = await campusPlacement.analyze({
      session: session({ userText: "My CGPA is 7.4.", targetCompany: "TCS" }),
      resume: null,
    });
    expect(result.meta?.campusPlacement?.statedCgpa).toBeCloseTo(7.4, 5);
  });
});

describe("campus-placement generic_passion_no_substance — SUBSTANTIATION_TOKEN gate", () => {
  const PASSION_LINE = "I'm passionate about technology and always loved coding since childhood.";

  it("fires on bare passion language with no substantiation", async () => {
    const result = await campusPlacement.analyze({
      session: session({ userText: PASSION_LINE, targetCompany: "Wipro" }),
      resume: null,
    });
    expect(result.flags).toContain("generic_passion_no_substance");
  });

  it("suppresses when the candidate cites a GitHub URL", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        userText: `${PASSION_LINE} You can see my work at github.com/me/recsys.`,
        targetCompany: "Wipro",
      }),
      resume: null,
    });
    expect(result.flags).not.toContain("generic_passion_no_substance");
  });

  it("suppresses when the candidate cites a hackathon", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        userText: `${PASSION_LINE} I participated in SIH last year.`,
        targetCompany: "Wipro",
      }),
      resume: null,
    });
    expect(result.flags).not.toContain("generic_passion_no_substance");
  });

  it("suppresses when the candidate cites an internship", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        userText: `${PASSION_LINE} I did an internship at a fintech startup last summer.`,
        targetCompany: "Wipro",
      }),
      resume: null,
    });
    expect(result.flags).not.toContain("generic_passion_no_substance");
  });

  it("suppresses when the candidate cites a named MOOC (NPTEL / CS50 / Striver)", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        userText: `${PASSION_LINE} I completed CS50 and the Striver SDE Sheet.`,
        targetCompany: "Wipro",
      }),
      resume: null,
    });
    expect(result.flags).not.toContain("generic_passion_no_substance");
  });

  it("suppresses when the candidate cites a quantified outcome (e.g. 200+ LeetCode)", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        userText: `${PASSION_LINE} I've solved 250+ problems on LeetCode.`,
        targetCompany: "Wipro",
      }),
      resume: null,
    });
    expect(result.flags).not.toContain("generic_passion_no_substance");
  });
});
