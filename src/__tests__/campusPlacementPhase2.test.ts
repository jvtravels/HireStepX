/* Phase-2 regressions for the campus-placement analyzer.
 *
 * Covers the three depth-validators introduced in Phase 2 of the
 * Campus Placement Score Improvement Plan:
 *
 *  1. `tech_named_but_not_applied` — symmetric counterpart to
 *     `project_no_tech_stack`. Fires when the candidate name-drops ≥2
 *     distinct technologies but never anchors any of them in an artifact
 *     (endpoint count, deployed URL, line count, schema shape, applied
 *     verb pairing). Recruiter-read: "lists Flask, Postgres, React,
 *     Docker on the resume but didn't say what they actually shipped."
 *
 *  2. `portfolio_link_present` — positive signal (no gap). Fires when
 *     the candidate references a GitHub / live demo / deployed URL
 *     alongside a project narration. Lets the report render a green
 *     check chip and gives the LLM evaluator a single flag to read.
 *
 *  3. `projects_dated_not_recent` — fires when the candidate cites only
 *     distant time markers (1st / 2nd year, freshman year) for their
 *     project narration with no current-term or final-year anchor.
 *     Proxies the recency multiplier — final-year > 2nd-sem.
 */

import { describe, it, expect } from "vitest";
import { campusPlacementAnalyzer as campusPlacement } from "../../server-handlers/analyzers/campus-placement";
import type { SessionRowForAnalysis } from "../../server-handlers/analyzers/_types";

function session(opts: { userText: string; targetCompany?: string | null }): SessionRowForAnalysis {
  return {
    id: "s2",
    user_id: "u1",
    type: "campus-placement",
    focus: "campus-placement",
    difficulty: "medium",
    score: 70,
    questions: 6,
    duration: 600,
    transcript: [
      { speaker: "ai", text: "Tell me about your project.", time: "00:00" },
      { speaker: "user", text: opts.userText, time: "00:05" },
      { speaker: "ai", text: "Anything else?", time: "01:00" },
      { speaker: "user", text: "Yes, that is all from me, thanks for the time and the chance to interview.", time: "01:15" },
      { speaker: "ai", text: "Got it.", time: "02:00" },
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

describe("campus-placement tech_named_but_not_applied (Phase 2.1)", () => {
  it("fires when ≥2 tech names are dropped without any applied evidence", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        userText: "I built a project using Python, Flask, React, MongoDB and Docker.",
        targetCompany: "Wipro",
      }),
      resume: null,
    });
    expect(result.flags).toContain("tech_named_but_not_applied");
  });

  it("suppresses when the candidate cites a deployed URL on Render", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        userText:
          "I built a recommender with Python and Flask, deployed on Render at reco.onrender.com, with Postgres and a React frontend.",
        targetCompany: "Wipro",
      }),
      resume: null,
    });
    expect(result.flags).not.toContain("tech_named_but_not_applied");
  });

  it("suppresses when the candidate cites an endpoint count", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        userText:
          "My project was a FastAPI service with 5 REST endpoints backed by Postgres and a React dashboard.",
        targetCompany: "Infosys",
      }),
      resume: null,
    });
    expect(result.flags).not.toContain("tech_named_but_not_applied");
  });

  it("does not fire when only a single tech is named", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        userText: "I built a project in Python.",
        targetCompany: "TCS",
      }),
      resume: null,
    });
    expect(result.flags).not.toContain("tech_named_but_not_applied");
  });
});

describe("campus-placement portfolio_link_present (Phase 2.2)", () => {
  it("fires as a positive signal when a GitHub URL accompanies a project narration", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        userText:
          "I built a recommendation system; source is at github.com/me/recsys and demo on Vercel.",
        targetCompany: "Wipro",
      }),
      resume: null,
    });
    expect(result.flags).toContain("portfolio_link_present");
  });

  it("does not fire when there is a project but no link", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        userText: "I built a small recommender in Python and Flask.",
        targetCompany: "Wipro",
      }),
      resume: null,
    });
    expect(result.flags).not.toContain("portfolio_link_present");
  });
});

describe("campus-placement projects_dated_not_recent (Phase 2.3)", () => {
  it("fires when the only time markers are 1st-year / 2nd-semester", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        userText:
          "I built a calculator app in Python during my 2nd semester in first year of college.",
        targetCompany: "TCS",
      }),
      resume: null,
    });
    expect(result.flags).toContain("projects_dated_not_recent");
  });

  it("suppresses when a final-year / capstone anchor is also present", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        userText:
          "I built a small app in my 2nd semester, and my final-year capstone is an ML pipeline I'm currently building.",
        targetCompany: "TCS",
      }),
      resume: null,
    });
    expect(result.flags).not.toContain("projects_dated_not_recent");
  });

  it("does not fire when no project narration exists", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        userText: "I'm from a tier-2 college in my second year.",
        targetCompany: "TCS",
      }),
      resume: null,
    });
    expect(result.flags).not.toContain("projects_dated_not_recent");
  });
});
