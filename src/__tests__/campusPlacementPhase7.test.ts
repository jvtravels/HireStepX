/* Phase-7 / v6.6 realism corrections for the campus-placement analyzer.
 *
 * Closes six gaps surfaced by the post-v6.5 realism audit:
 *
 *   7.1  College / TPO internal CGPA cutoff disclosure is valid
 *        framing. "My college's TPO cutoff is 7.0; my CGPA is 6.8"
 *        emits the positive `college_cgpa_policy_acknowledged` flag and
 *        suppresses `cgpa_low_no_framing`.
 *
 *   7.2  `bond_unprepared` now requires the AI to have probed bond
 *        ≥2 times. A single "I don't know" reply to a single probe
 *        is often surprise, not unresearch. `bondProbeCount` surfaced
 *        on `meta.campusPlacement` for downstream consumers.
 *
 *   7.3  Mid-session reverse-question tracking — if the candidate
 *        asked any SPECIFIC question (tech stack / mentor / growth
 *        track / etc.) BEFORE the closing "any questions?" slot,
 *        `weak_reverse_questions` is suppressed across archetypes
 *        and the positive `mid_session_questions_present` flag fires.
 *
 *   7.4  `aptitudeProbeExpectedType` on meta — derived from archetype
 *        ("cognitive-coding" for TCS/Infosys, "classical-puzzle" for
 *        Wipro NLTH / Cognizant, "none" for top-tier-campus, "either"
 *        when unknown). Consumed by downstream prompt-quality grading.
 *
 *   7.5  `internship_company_unrecognized` — transcript-only signal
 *        (only fires when no resume is loaded). Low severity,
 *        informational; conservative whitelist of ~70 well-known
 *        Indian / global tech employers.
 *
 *   7.6  MTI whitelist for "graduated in 2024" — no regex change
 *        needed (v6.5 removed the pattern); validates the existing
 *        behaviour as a non-regression.
 */

import { describe, it, expect } from "vitest";
import { campusPlacementAnalyzer as campusPlacement } from "../../server-handlers/analyzers/campus-placement";
import type { SessionRowForAnalysis, TranscriptTurn } from "../../server-handlers/analyzers/_types";

function session(opts: {
  transcript: TranscriptTurn[];
  targetCompany?: string | null;
}): SessionRowForAnalysis {
  return {
    id: "s7",
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

describe("campus-placement v6.6 (7.1) — college / TPO CGPA-policy is valid framing", () => {
  it("emits college_cgpa_policy_acknowledged and suppresses cgpa_low_no_framing when TPO cutoff is cited", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "TCS",
        transcript: [
          { speaker: "ai", text: "Tell me about yourself.", time: "00:00" },
          // CGPA 6.8 is BELOW the typical 7.0 default — would normally fire
          // cgpa_low_no_framing, but TPO-cutoff citation is valid framing.
          { speaker: "user", text: "I'm in CSE final year. My college's TPO cutoff is 7.0 for service-tier firms, and my CGPA is 6.8 — I'm just above the campus internal bar for non-TCS firms but TCS lets 6.0+ apply directly.", time: "00:05" },
          { speaker: "ai", text: "Okay.", time: "01:00" },
          { speaker: "user", text: "I'm comfortable with the two-year bond.", time: "01:15" },
        ],
      }),
      resume: null,
    });
    expect(result.flags).toContain("college_cgpa_policy_acknowledged");
    expect(result.flags).not.toContain("cgpa_low_no_framing");
  });

  it("STILL fires cgpa_low_no_framing when CGPA is bare (no policy / no other framing)", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "Google",
        transcript: [
          { speaker: "ai", text: "Tell me about yourself.", time: "00:00" },
          // 6.5 < 7.5 cutoff for top-tier, no framing
          { speaker: "user", text: "I'm in CSE. My CGPA is 6.5.", time: "00:05" },
          { speaker: "ai", text: "Anything else?", time: "01:00" },
          { speaker: "user", text: "That's all from me.", time: "01:15" },
        ],
      }),
      resume: null,
    });
    expect(result.flags).toContain("cgpa_low_no_framing");
    expect(result.flags).not.toContain("college_cgpa_policy_acknowledged");
  });
});

describe("campus-placement v6.6 (7.2) — bond multi-probe gate", () => {
  it("does NOT fire bond_unprepared on a single bond probe + 'don't know' reply", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "TCS",
        transcript: [
          { speaker: "ai", text: "Tell me about yourself.", time: "00:00" },
          { speaker: "user", text: "I'm Anjali, CSE final year, CGPA 8.4.", time: "00:05" },
          // single probe — caught off-guard
          { speaker: "ai", text: "Are you aware of the service bond?", time: "01:00" },
          { speaker: "user", text: "What's a bond? I don't really know about that.", time: "01:15" },
        ],
      }),
      resume: null,
    });
    expect(result.flags).not.toContain("bond_unprepared");
    expect(result.meta?.campusPlacement?.bondProbeCount).toBe(1);
  });

  it("STILL fires bond_unprepared when AI probes bond ≥2 times and candidate stays ignorant", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "TCS",
        // v6.7 — full-panel format (≥10 turns) so the short-screening
        // gate doesn't suppress bond_unprepared.
        transcript: [
          { speaker: "ai", text: "Tell me about yourself.", time: "00:00" },
          { speaker: "user", text: "I'm Anjali, CSE final year, CGPA 8.4.", time: "00:05" },
          { speaker: "ai", text: "Walk me through a project.", time: "01:00" },
          { speaker: "user", text: "Built a small REST service in Flask with Postgres.", time: "01:15" },
          { speaker: "ai", text: "Are you aware of the service bond?", time: "02:00" },
          { speaker: "user", text: "What's a bond? I don't really know.", time: "02:05" },
          { speaker: "ai", text: "The two-year bond — sign the bond at joining. Familiar?", time: "03:00" },
          { speaker: "user", text: "I've never heard of it honestly.", time: "03:15" },
          { speaker: "ai", text: "Any questions for us?", time: "04:00" },
          { speaker: "user", text: "What's the training program structure?", time: "04:15" },
        ],
      }),
      resume: null,
    });
    expect(result.flags).toContain("bond_unprepared");
    expect(result.meta?.campusPlacement?.bondProbeCount).toBe(2);
  });
});

describe("campus-placement v6.6 (7.3) — mid-session reverse-question tracking", () => {
  it("suppresses weak_reverse_questions at top-tier-campus when candidate asked specific mid-session questions", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "Google",
        transcript: [
          { speaker: "ai", text: "Tell me about a project.", time: "00:00" },
          { speaker: "user", text: "I built a FastAPI inventory service with 5 REST endpoints, deployed on Render. Could you tell me more about your tech stack and how the team handles code review?", time: "00:05" },
          { speaker: "ai", text: "Got it. Do you have any questions for us?", time: "01:00" },
          { speaker: "user", text: "What's the work culture like? Honestly, all clear from my side.", time: "01:15" },
        ],
      }),
      resume: null,
    });
    expect(result.flags).toContain("mid_session_questions_present");
    expect(result.flags).not.toContain("weak_reverse_questions");
  });

  it("STILL fires weak_reverse_questions at top-tier-campus when no mid-session specific asks", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "Google",
        transcript: [
          { speaker: "ai", text: "Tell me about a project.", time: "00:00" },
          { speaker: "user", text: "I built a FastAPI inventory service with 5 REST endpoints, deployed on Render.", time: "00:05" },
          { speaker: "ai", text: "Got it. Do you have any questions for us?", time: "01:00" },
          { speaker: "user", text: "What's the work culture like? And how is the company culture for new joiners?", time: "01:15" },
        ],
      }),
      resume: null,
    });
    expect(result.flags).not.toContain("mid_session_questions_present");
    expect(result.flags).toContain("weak_reverse_questions");
  });
});

describe("campus-placement v6.6 (7.4) — aptitudeProbeExpectedType on meta by archetype", () => {
  it("'cognitive-coding' for tcs-ninja", async () => {
    const result = await campusPlacement.analyze({
      session: session({ targetCompany: "TCS", transcript: [{ speaker: "ai", text: "Hi.", time: "00:00" }, { speaker: "user", text: "Hello.", time: "00:05" }] }),
      resume: null,
    });
    expect(result.meta?.campusPlacement?.aptitudeProbeExpectedType).toBe("cognitive-coding");
  });

  it("'classical-puzzle' for wipro-nlth", async () => {
    const result = await campusPlacement.analyze({
      session: session({ targetCompany: "Wipro", transcript: [{ speaker: "ai", text: "Hi.", time: "00:00" }, { speaker: "user", text: "Hello.", time: "00:05" }] }),
      resume: null,
    });
    expect(result.meta?.campusPlacement?.aptitudeProbeExpectedType).toBe("classical-puzzle");
  });

  it("'none' for top-tier-campus", async () => {
    const result = await campusPlacement.analyze({
      session: session({ targetCompany: "Google", transcript: [{ speaker: "ai", text: "Hi.", time: "00:00" }, { speaker: "user", text: "Hello.", time: "00:05" }] }),
      resume: null,
    });
    expect(result.meta?.campusPlacement?.aptitudeProbeExpectedType).toBe("none");
  });

  it("'either' for unknown archetype", async () => {
    const result = await campusPlacement.analyze({
      session: session({ targetCompany: "SomeRandomCo", transcript: [{ speaker: "ai", text: "Hi.", time: "00:00" }, { speaker: "user", text: "Hello.", time: "00:05" }] }),
      resume: null,
    });
    expect(result.meta?.campusPlacement?.aptitudeProbeExpectedType).toBe("either");
  });
});

describe("campus-placement v6.6 (7.5) — internship company plausibility (transcript-only)", () => {
  it("fires internship_company_unrecognized when claimed company isn't in the known-tech-employer list and no resume", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "TCS",
        transcript: [
          { speaker: "ai", text: "Tell me about your internship.", time: "00:00" },
          { speaker: "user", text: "I interned at FakeNonexistentCorp for the summer of 2024. I built dashboards. My mentor was great and I shipped a small reporting tool.", time: "00:05" },
          { speaker: "ai", text: "Got it.", time: "01:00" },
          { speaker: "user", text: "Yes, that's all.", time: "01:15" },
        ],
      }),
      resume: null,
    });
    expect(result.flags).toContain("internship_company_unrecognized");
  });

  it("does NOT fire when claimed company matches a well-known tech employer", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "TCS",
        transcript: [
          { speaker: "ai", text: "Tell me about your internship.", time: "00:00" },
          { speaker: "user", text: "I interned at Razorpay for six months last year. Built a small webhook retry service, mentored by their payments team, shipped to production.", time: "00:05" },
          { speaker: "ai", text: "Got it.", time: "01:00" },
          { speaker: "user", text: "Yes, that's all.", time: "01:15" },
        ],
      }),
      resume: null,
    });
    expect(result.flags).not.toContain("internship_company_unrecognized");
  });
});

describe("campus-placement v6.6 (7.6) — MTI whitelist (non-regression on graduated)", () => {
  it("does NOT flag MTI for 'graduated in 2024'", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "TCS",
        transcript: [
          { speaker: "ai", text: "Tell me about yourself.", time: "00:00" },
          { speaker: "user", text: "I graduated in 2024 from PES University with a CGPA of 8.4, and I built a FastAPI inventory service deployed on Render.", time: "00:05" },
          { speaker: "ai", text: "Any questions?", time: "01:00" },
          { speaker: "user", text: "Could you walk me through the training program structure?", time: "01:15" },
        ],
      }),
      resume: null,
    });
    expect(result.flags).not.toContain("mti_pattern_detected");
  });
});
