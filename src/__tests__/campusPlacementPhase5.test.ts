/* Phase-5 stretch regressions for the campus-placement analyzer.
 *
 * Covers two signals introduced as Phase 5 of the Campus Placement
 * Score Improvement Plan:
 *
 *   - `backlog_honest_disclosure` — POSITIVE counterpart to the
 *     existing `active_backlog_evasion` flag. Fires when the AI
 *     probes backlogs and the candidate answers with a clean,
 *     unhedged disclosure ("zero backlogs", "all cleared first
 *     attempt"). Recruiters explicitly reward this — service-tier
 *     bond loops grade backlog-honesty alongside the answer itself.
 *
 *   - `aptitude_project_inconsistency` — fires when the candidate
 *     refuses a live aptitude / puzzle probe BUT elsewhere claimed
 *     substantial project depth (applied tech stack or portfolio
 *     link). Recruiters drill exactly this gap: "you shipped a
 *     FastAPI service but can't reason about 8 balls?"
 *
 * The bond / service-agreement awareness probe (the third Phase-5
 * item) is already covered by the existing Wave-3 patterns
 * (BOND_PROBE / BOND_REFUSAL / BOND_IGNORANCE / BOND_HEALTHY_RESPONSE)
 * and their tests live in the broader analyzer fixture sweep.
 */

import { describe, it, expect } from "vitest";
import { campusPlacementAnalyzer as campusPlacement } from "../../server-handlers/analyzers/campus-placement";
import type { SessionRowForAnalysis, TranscriptTurn } from "../../server-handlers/analyzers/_types";

function session(opts: {
  transcript: TranscriptTurn[];
  targetCompany?: string | null;
}): SessionRowForAnalysis {
  return {
    id: "s5",
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

describe("campus-placement backlog_honest_disclosure (Phase 5)", () => {
  it("fires when the candidate gives a clean answer on the backlog probe", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "TCS",
        transcript: [
          { speaker: "ai", text: "Do you have any active backlogs or arrears?", time: "00:00" },
          { speaker: "user", text: "Zero active backlogs, cleared all subjects first attempt — including DBMS and OS.", time: "00:05" },
          { speaker: "ai", text: "Anything else?", time: "01:00" },
          { speaker: "user", text: "Yes, that is all from me, thanks for the chance to interview today.", time: "01:15" },
          { speaker: "ai", text: "Got it.", time: "02:00" },
          { speaker: "user", text: "I'm looking forward to hearing from you, and happy to clarify anything further.", time: "02:15" },
        ],
      }),
      resume: null,
    });
    expect(result.flags).toContain("backlog_honest_disclosure");
    expect(result.flags).not.toContain("active_backlog_evasion");
  });

  it("does NOT fire when the candidate hedges (evasion wins)", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "TCS",
        transcript: [
          { speaker: "ai", text: "Any standing arrears?", time: "00:00" },
          { speaker: "user", text: "Not sure honestly, I think one or two are pending, I'll clear them soon.", time: "00:05" },
          { speaker: "ai", text: "Got it.", time: "01:00" },
          { speaker: "user", text: "Yes, that is all from me, thanks for the chance to interview today.", time: "01:15" },
        ],
      }),
      resume: null,
    });
    expect(result.flags).not.toContain("backlog_honest_disclosure");
    expect(result.flags).toContain("active_backlog_evasion");
  });
});

describe("campus-placement aptitude_project_inconsistency (Phase 5)", () => {
  it("fires when the candidate refuses a puzzle but claimed an applied project", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "Wipro",
        transcript: [
          { speaker: "ai", text: "Tell me about a project.", time: "00:00" },
          { speaker: "user", text: "I built a FastAPI microservice with 5 REST endpoints, Postgres with 3 tables, deployed on Render. Source at github.com/me/project.", time: "00:05" },
          { speaker: "ai", text: "Quick one — you have 8 balls, one slightly heavier. Two weighings on a balance. How do you find it?", time: "01:00" },
          { speaker: "user", text: "I can't solve on the spot, I'm not good with puzzles honestly.", time: "01:15" },
          { speaker: "ai", text: "Any questions?", time: "02:00" },
          { speaker: "user", text: "Could you walk me through the team allocation process and the typical onboarding timeline?", time: "02:15" },
        ],
      }),
      resume: null,
    });
    expect(result.flags).toContain("aptitude_puzzle_refusal");
    expect(result.flags).toContain("aptitude_project_inconsistency");
  });

  it("does NOT fire when no applied project depth was claimed", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "Wipro",
        transcript: [
          { speaker: "ai", text: "Tell me about a project.", time: "00:00" },
          { speaker: "user", text: "I built a small calculator in Python during my second semester of college.", time: "00:05" },
          { speaker: "ai", text: "Quick one — you have 8 balls, one slightly heavier. Two weighings on a balance. How do you find it?", time: "01:00" },
          { speaker: "user", text: "I can't solve on the spot, I'm not good with puzzles honestly.", time: "01:15" },
          { speaker: "ai", text: "Any questions?", time: "02:00" },
          { speaker: "user", text: "Could you walk me through the team allocation process and the typical onboarding timeline?", time: "02:15" },
        ],
      }),
      resume: null,
    });
    expect(result.flags).toContain("aptitude_puzzle_refusal");
    expect(result.flags).not.toContain("aptitude_project_inconsistency");
  });

  it("does NOT fire when the candidate engaged with the puzzle (no refusal)", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "Wipro",
        transcript: [
          { speaker: "ai", text: "Tell me about a project.", time: "00:00" },
          { speaker: "user", text: "I built a FastAPI microservice with 5 REST endpoints, deployed on Render. Source at github.com/me/project.", time: "00:05" },
          { speaker: "ai", text: "Quick one — you have 8 balls, one slightly heavier. Two weighings on a balance. How do you find it?", time: "01:00" },
          { speaker: "user", text: "Split into 3-3-2, weigh the two groups of three; if equal the heavier is in the pair, one more weighing finds it.", time: "01:15" },
          { speaker: "ai", text: "Nice.", time: "02:00" },
          { speaker: "user", text: "Thanks. Happy to walk through any other part of the project if useful.", time: "02:15" },
        ],
      }),
      resume: null,
    });
    expect(result.flags).not.toContain("aptitude_puzzle_refusal");
    expect(result.flags).not.toContain("aptitude_project_inconsistency");
  });
});

/* Audit follow-up — Phase-5 resume.links suppression path.
 *
 * The `portfolio_absent_for_claim` flag fires when a candidate narrates
 * a project without dropping a GitHub / live-demo link in the same turn.
 * If `resume.links` contains a public-artifact URL the recruiter can
 * already see, we suppress the flag — punishing the candidate twice for
 * a single absence reads as a UX bug. This path existed since Phase 2
 * but was never directly asserted; adding the regression net here. */
describe("campus-placement portfolio suppression via resume.links (audit follow-up)", () => {
  it("suppresses portfolio_absent_for_claim when resume.links includes a github URL", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "Wipro",
        transcript: [
          { speaker: "ai", text: "Tell me about a project.", time: "00:00" },
          { speaker: "user", text: "I built a Django REST backend for a college event manager with five endpoints and Postgres.", time: "00:05" },
          { speaker: "ai", text: "Walk me through the hardest part.", time: "01:00" },
          { speaker: "user", text: "Schema migrations under load — I shipped a blue-green deploy script to handle it cleanly.", time: "01:15" },
          { speaker: "ai", text: "Any questions for us?", time: "02:00" },
          { speaker: "user", text: "Could you walk me through the typical onboarding timeline and the team allocation process?", time: "02:15" },
        ],
      }),
      resume: {
        links: ["https://github.com/me/eventbook", "https://linkedin.com/in/me"],
      },
    });
    expect(result.flags).not.toContain("portfolio_absent_for_claim");
  });

  it("still fires portfolio_absent_for_claim when resume.links has no portfolio URL", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "Wipro",
        transcript: [
          { speaker: "ai", text: "Tell me about a project.", time: "00:00" },
          { speaker: "user", text: "I built a Django REST backend for a college event manager with five endpoints and Postgres.", time: "00:05" },
          { speaker: "ai", text: "Walk me through the hardest part.", time: "01:00" },
          { speaker: "user", text: "Schema migrations under load — I shipped a blue-green deploy script to handle it cleanly.", time: "01:15" },
          { speaker: "ai", text: "Any questions for us?", time: "02:00" },
          { speaker: "user", text: "Could you walk me through the typical onboarding timeline and the team allocation process?", time: "02:15" },
        ],
      }),
      resume: {
        links: ["https://linkedin.com/in/me"],
      },
    });
    expect(result.flags).toContain("portfolio_absent_for_claim");
  });
});
