/* Phase-3 regressions for the campus-placement analyzer.
 *
 * Covers the persona-archetype layer that sits between the coarse
 * `companyTier` classifier and the analyzer's per-flag logic:
 *
 *   - `tcs-ninja`        — TCS NQT base / Infosys SE. CGPA bar 6.0.
 *   - `tcs-digital`      — TCS Digital / Infosys Power Programmer /
 *                          Wipro Elite. CGPA bar 7.5, deep DSA expected.
 *   - `wipro-nlth`       — Wipro NLTH / Cognizant GenC / Capgemini
 *                          Exceller / HCL TechBee. CGPA bar 6.5.
 *   - `top-tier-campus`  — Google / Amazon / Microsoft / Flipkart /
 *                          Razorpay etc. on-campus. CGPA bar 7.5.
 *
 * Resolution order: explicit transcript hint > company-string match.
 * `target_company: "TCS"` alone defaults to ninja (the high-volume
 * variant by candidate count); the digital track has to be claimed
 * in the transcript ("TCS Digital", "Power Programmer", etc.).
 */

import { describe, it, expect } from "vitest";
import { campusPlacementAnalyzer as campusPlacement } from "../../server-handlers/analyzers/campus-placement";
import type { SessionRowForAnalysis } from "../../server-handlers/analyzers/_types";

function session(opts: { userText: string; targetCompany?: string | null }): SessionRowForAnalysis {
  return {
    id: "s3",
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
      { speaker: "ai", text: "Anything else?", time: "01:00" },
      { speaker: "user", text: "Yes, that is all from me, thanks for the time.", time: "01:15" },
      { speaker: "ai", text: "Why this company?", time: "02:00" },
      { speaker: "user", text: "I think it would be a good place to learn and grow over the next few years.", time: "02:15" },
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

describe("campus-placement archetype resolution (Phase 3)", () => {
  it("defaults TCS to the Ninja track with a 6.0 CGPA bar", async () => {
    const result = await campusPlacement.analyze({
      session: session({ userText: "My CGPA is 6.8.", targetCompany: "TCS" }),
      resume: null,
    });
    expect(result.meta?.campusPlacement?.archetype).toBe("tcs-ninja");
    expect(result.meta?.campusPlacement?.baseCgpaCutoff).toBe(6.0);
    expect(result.flags).toContain("campus_archetype_tcs_ninja");
  });

  it("upgrades TCS to the Digital track when the transcript names it", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        userText: "I was shortlisted for TCS Digital. My CGPA is 8.1.",
        targetCompany: "TCS",
      }),
      resume: null,
    });
    expect(result.meta?.campusPlacement?.archetype).toBe("tcs-digital");
    expect(result.meta?.campusPlacement?.baseCgpaCutoff).toBe(7.5);
    expect(result.flags).toContain("campus_archetype_tcs_digital");
  });

  it("resolves Wipro to the NLTH track with a 6.5 cutoff", async () => {
    const result = await campusPlacement.analyze({
      session: session({ userText: "My CGPA is 7.0.", targetCompany: "Wipro" }),
      resume: null,
    });
    expect(result.meta?.campusPlacement?.archetype).toBe("wipro-nlth");
    expect(result.meta?.campusPlacement?.baseCgpaCutoff).toBe(6.5);
  });

  it("resolves Google to the top-tier-campus archetype with a 7.5 cutoff", async () => {
    const result = await campusPlacement.analyze({
      session: session({ userText: "My CGPA is 8.4.", targetCompany: "Google" }),
      resume: null,
    });
    expect(result.meta?.campusPlacement?.archetype).toBe("top-tier-campus");
    expect(result.meta?.campusPlacement?.baseCgpaCutoff).toBe(7.5);
    expect(result.flags).toContain("campus_archetype_top_tier_campus");
  });

  it("surfaces a human-readable archetype label on meta", async () => {
    const result = await campusPlacement.analyze({
      session: session({ userText: "I'm a fresher.", targetCompany: "Wipro" }),
      resume: null,
    });
    expect(result.meta?.campusPlacement?.archetypeLabel).toContain("Wipro NLTH");
  });

  it("returns 'unknown' archetype + falls back to companyTier cutoff for an unrecognised firm", async () => {
    const result = await campusPlacement.analyze({
      session: session({ userText: "I'm interviewing.", targetCompany: "SomeRandomCo" }),
      resume: null,
    });
    expect(result.meta?.campusPlacement?.archetype).toBe("unknown");
    // companyTier == "default" → 7.0 fallback
    expect(result.meta?.campusPlacement?.baseCgpaCutoff).toBe(7.0);
    // no archetype flag emitted on unknown
    expect(result.flags.some((f) => f.startsWith("campus_archetype_"))).toBe(false);
  });

  it("recognises Power Programmer hint and resolves to tcs-digital even when company is Infosys", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        userText: "I cleared the Power Programmer track at Infosys.",
        targetCompany: "Infosys",
      }),
      resume: null,
    });
    expect(result.meta?.campusPlacement?.archetype).toBe("tcs-digital");
  });
});
