/* Phase-6 realism-calibration regressions for campus-placement analyzer.
 *
 * Covers the five Phase-6 realism fixes (v6.5):
 *
 *   1. MTI whitelist — "passed out 2024" is standard Indian English
 *      and should NOT trigger `mti_pattern_detected`. (Real recruiters
 *      across TCS/Infosys/Wipro hear it every screen and don't dock.)
 *      Things that SHOULD still trigger: "myself Rahul", "kindly revert",
 *      "having a doubt".
 *
 *   2. Service-tier "why this company" — TCS NQT / Wipro NLTH candidates
 *      saying "structured training / proven client base / long-term
 *      growth" must NOT fire `no_company_specific_research`; they should
 *      fire the positive `service_tier_why_company_acceptable` instead.
 *      Product-tier (Google/top-tier-campus) still must show specific
 *      signal.
 *
 *   3. Reverse-question realism — "what's the work culture?" is acceptable
 *      filler at TCS NQT / Wipro NLTH loops; `weak_reverse_questions`
 *      should be suppressed for those archetypes. It still fires at
 *      tcs-digital / top-tier-campus where the bar is specific.
 *
 *   4. Wipro NLTH CGPA cutoff is now 6.0 (was 6.5) — `archetypeCgpaCutoff`
 *      unit test covers this directly.
 *
 *   5. (No analyzer test needed — fix #5 is in the LLM prompt for
 *      generate-questions and is validated by prompt-quality review,
 *      not analyzer output.)
 */

import { describe, it, expect } from "vitest";
import { campusPlacementAnalyzer as campusPlacement } from "../../server-handlers/analyzers/campus-placement";
import { archetypeCgpaCutoff } from "../../server-handlers/_campus-archetype";
import type { SessionRowForAnalysis, TranscriptTurn } from "../../server-handlers/analyzers/_types";

function session(opts: {
  transcript: TranscriptTurn[];
  targetCompany?: string | null;
}): SessionRowForAnalysis {
  return {
    id: "s6",
    user_id: "u1",
    type: "campus-placement",
    focus: "campus-placement",
    difficulty: "medium",
    score: 70,
    questions: opts.transcript.filter((t) => t.speaker === "ai").length,
    duration: 600,
    transcript: opts.transcript,
    ai_feedback: "",
    skill_scores: null,
    job_description: null,
    jd_analysis: null,
    resume_version_id: null,
    created_at: new Date().toISOString(),
    target_company: opts.targetCompany ?? null,
  };
}

describe("campus-placement Phase 6.1 — MTI whitelist for Indian-English conventions", () => {
  it("does NOT flag MTI for 'passed out 2024' (standard Indian English)", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "TCS",
        transcript: [
          { speaker: "ai", text: "Tell me about yourself.", time: "00:00" },
          { speaker: "user", text: "I am Anjali, I passed out from PES University in 2024 with a CGPA of 8.4, and I built a FastAPI inventory service with five REST endpoints deployed on Render.", time: "00:05" },
          { speaker: "ai", text: "Any questions for us?", time: "01:00" },
          { speaker: "user", text: "Could you walk me through the training program structure and the typical onboarding cohort timeline?", time: "01:15" },
        ],
      }),
      resume: null,
    });
    expect(result.flags).not.toContain("mti_pattern_detected");
  });

  it("STILL flags MTI for 'myself Rahul' / 'kindly revert' / 'having a doubt' (real deductions)", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "TCS",
        transcript: [
          { speaker: "ai", text: "Tell me about yourself.", time: "00:00" },
          { speaker: "user", text: "Myself Rahul, I have a doubt about the timeline. Kindly revert back at your earliest.", time: "00:05" },
          { speaker: "ai", text: "Any questions for us?", time: "01:00" },
          { speaker: "user", text: "Could you walk me through the training program structure?", time: "01:15" },
        ],
      }),
      resume: null,
    });
    expect(result.flags).toContain("mti_pattern_detected");
  });
});

describe("campus-placement Phase 6.2 — service-tier 'why this company' acceptable narrative", () => {
  it("emits positive flag (NOT no_company_specific_research) when TCS-Ninja candidate cites stability/training/scale", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "TCS",
        transcript: [
          { speaker: "ai", text: "Why do you want to join us specifically?", time: "00:00" },
          { speaker: "user", text: "I'm looking for a stable long-term career with structured training and a proven client base. TCS has a great brand and good growth opportunities for freshers.", time: "00:05" },
          { speaker: "ai", text: "Got it.", time: "01:00" },
          { speaker: "user", text: "I'm comfortable signing the two-year service agreement.", time: "01:15" },
        ],
      }),
      resume: null,
    });
    expect(result.flags).toContain("service_tier_why_company_acceptable");
    expect(result.flags).not.toContain("no_company_specific_research");
  });

  it("STILL fires no_company_specific_research at top-tier-campus (product-co) when answer is generic", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "Google",
        transcript: [
          { speaker: "ai", text: "Why do you want to work here specifically?", time: "00:00" },
          { speaker: "user", text: "Google has a great brand name and good culture. It will help me learn and grow with great opportunities.", time: "00:05" },
          { speaker: "ai", text: "Got it.", time: "01:00" },
          { speaker: "user", text: "I'm excited about the opportunity.", time: "01:15" },
        ],
      }),
      resume: null,
    });
    expect(result.flags).toContain("no_company_specific_research");
    expect(result.flags).not.toContain("service_tier_why_company_acceptable");
  });

  it("STILL fires no_company_specific_research at TCS when answer is pure brand-filler with no service-tier narrative", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "TCS",
        transcript: [
          { speaker: "ai", text: "Why this company specifically?", time: "00:00" },
          { speaker: "user", text: "TCS is a great MNC with good culture and brand value. It will help me learn and grow as a person.", time: "00:05" },
          { speaker: "ai", text: "Anything else?", time: "01:00" },
          { speaker: "user", text: "Thank you for the opportunity.", time: "01:15" },
        ],
      }),
      resume: null,
    });
    expect(result.flags).toContain("no_company_specific_research");
    expect(result.flags).not.toContain("service_tier_why_company_acceptable");
  });
});

describe("campus-placement Phase 6.3 — reverse-question realism for service-tier", () => {
  it("does NOT fire weak_reverse_questions at TCS NQT (tcs-ninja) for 'what's the work culture?'", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "TCS",
        transcript: [
          { speaker: "ai", text: "Tell me about a project.", time: "00:00" },
          { speaker: "user", text: "I built a small inventory app using Python and Postgres. It tracks stock levels for a college fest.", time: "00:05" },
          { speaker: "ai", text: "Got it. Do you have any questions for us?", time: "01:00" },
          { speaker: "user", text: "What's the work culture like at TCS? And how is the company culture for new joiners?", time: "01:15" },
        ],
      }),
      resume: null,
    });
    expect(result.flags).not.toContain("weak_reverse_questions");
  });

  it("STILL fires weak_reverse_questions at top-tier-campus (Google) for the same question", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "Google",
        transcript: [
          { speaker: "ai", text: "Tell me about a project.", time: "00:00" },
          { speaker: "user", text: "I built a FastAPI inventory service with five REST endpoints deployed on Render. Source at github.com/me/inventory.", time: "00:05" },
          { speaker: "ai", text: "Got it. Do you have any questions for us?", time: "01:00" },
          { speaker: "user", text: "What's the work culture like? And how is the company culture for new joiners?", time: "01:15" },
        ],
      }),
      resume: null,
    });
    expect(result.flags).toContain("weak_reverse_questions");
  });
});

describe("campus-placement Phase 6.4 — Wipro NLTH CGPA cutoff is 6.0 (2025 firm-wide floor)", () => {
  it("archetypeCgpaCutoff('wipro-nlth') returns 6.0", () => {
    expect(archetypeCgpaCutoff("wipro-nlth")).toBe(6.0);
  });

  it("tcs-ninja still 6.0, tcs-digital still 7.5, top-tier-campus still 7.5", () => {
    expect(archetypeCgpaCutoff("tcs-ninja")).toBe(6.0);
    expect(archetypeCgpaCutoff("tcs-digital")).toBe(7.5);
    expect(archetypeCgpaCutoff("top-tier-campus")).toBe(7.5);
    expect(archetypeCgpaCutoff("unknown")).toBeNull();
  });
});
