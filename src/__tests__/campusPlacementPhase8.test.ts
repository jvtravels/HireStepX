/* Phase-8 / v6.7 realism corrections for the campus-placement analyzer.
 *
 * Closes six gaps surfaced by the post-v6.6 realism audit:
 *
 *   8.1  `cognizant-genc` archetype split out from `wipro-nlth`.
 *        Cognizant / Capgemini Exceller candidates now resolve to a
 *        distinct archetype with its own label, and the
 *        "client rotation / domain breadth" narrative gets credit
 *        on the why-company probe (mirrors the existing service-tier
 *        narrative pattern).
 *
 *   8.2  Short-screening session gate — `transcript.length < 10`
 *        suppresses `bond_unprepared` and `reverse_questions_declined`
 *        and emits the positive flag `short_screening_session_acknowledged`.
 *
 *   8.3  `shipped_to_prod_context` positive flag fires when a candidate
 *        narrates a project with concrete shipped-to-prod evidence
 *        (active users / production deploy / merged PR). At product-grade
 *        archetypes (top-tier-campus / tcs-digital) it suppresses
 *        `portfolio_absent_for_claim`.
 *
 *   8.4  `location_agnostic_signal` — at tcs-digital, candidate
 *        stating any-location openness suppresses
 *        `weak_reverse_questions` (the Digital loop doesn't probe
 *        relocation directly; volunteered context counts as
 *        substantive engagement).
 *
 *   8.5  `aptitude_puzzle_refusal` severity downgrades to "low" at
 *        tcs-digital — that loop is offline-coding-format, not
 *        live-puzzle. Stays "high" at other archetypes.
 *
 *   8.6  `weak_reverse_questions` at `unknown` archetype now adopts
 *        service-tier leniency (generic reverse questions are
 *        acceptable when we can't pin down archetype).
 */

import { describe, it, expect } from "vitest";
import { campusPlacementAnalyzer as campusPlacement } from "../../server-handlers/analyzers/campus-placement";
import type { SessionRowForAnalysis, TranscriptTurn } from "../../server-handlers/analyzers/_types";

function session(opts: {
  transcript: TranscriptTurn[];
  targetCompany?: string | null;
}): SessionRowForAnalysis {
  return {
    id: "s8",
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

/* Padding transcript so we exceed the 10-turn short-screening gate. Used
 * by tests that need the FULL panel rubric (closing slot / bond probes
 * counted). Each call returns 12 throwaway turns. */
function padTo12Turns(extra: TranscriptTurn[]): TranscriptTurn[] {
  const pad: TranscriptTurn[] = [];
  for (let i = 0; i < 12 - extra.length; i++) {
    pad.push({ speaker: i % 2 === 0 ? "ai" : "user", text: `Padding turn ${i} — generic conversation continuation about projects and prep.`, time: `0${i}:00` });
  }
  return [...extra, ...pad];
}

describe("campus-placement v6.7 (8.1) — cognizant-genc archetype split", () => {
  it("resolves Cognizant to cognizant-genc archetype with its own label", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "Cognizant",
        transcript: [
          { speaker: "ai", text: "Tell me about yourself.", time: "00:00" },
          { speaker: "user", text: "I'm Anjali, CSE final year, CGPA 7.8.", time: "00:05" },
        ],
      }),
      resume: null,
    });
    expect(result.meta?.campusPlacement?.archetype).toBe("cognizant-genc");
    expect(result.meta?.campusPlacement?.archetypeLabel).toBe("Cognizant GenC / Capgemini Exceller");
    expect(result.flags).toContain("campus_archetype_cognizant_genc");
  });

  it("credits Cognizant client-rotation narrative as why-company answer (positive flag, no negative)", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "Cognizant",
        transcript: padTo12Turns([
          { speaker: "ai", text: "Why this company?", time: "00:00" },
          // generic culture filler triggers the gate; cognizant-rotation narrative rescues
          { speaker: "user", text: "Great culture, good company. What also attracts me is the client rotation across multiple client domains — horizontal mobility gives me breadth of industries early on.", time: "00:05" },
        ]),
      }),
      resume: null,
    });
    expect(result.flags).toContain("service_tier_why_company_acceptable");
    expect(result.flags).not.toContain("no_company_specific_research");
  });

  it("still fires no_company_specific_research at Cognizant when no narrative + generic filler", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "Cognizant",
        transcript: padTo12Turns([
          { speaker: "ai", text: "Why this company?", time: "00:00" },
          { speaker: "user", text: "Great culture, good company, great brand. Big mnc with good company values.", time: "00:05" },
        ]),
      }),
      resume: null,
    });
    expect(result.flags).toContain("no_company_specific_research");
    expect(result.flags).not.toContain("service_tier_why_company_acceptable");
  });
});

describe("campus-placement v6.7 (8.2) — short-screening session gate", () => {
  it("suppresses bond_unprepared on a short (<10 turn) screening call even with ≥2 bond probes", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "TCS",
        transcript: [
          { speaker: "ai", text: "Are you aware of the service bond?", time: "00:00" },
          { speaker: "user", text: "What's a bond? I don't really know.", time: "00:05" },
          { speaker: "ai", text: "The two-year bond — sign the bond at joining. Familiar?", time: "01:00" },
          { speaker: "user", text: "I've never heard of it honestly.", time: "01:15" },
        ],
      }),
      resume: null,
    });
    expect(result.flags).toContain("short_screening_session_acknowledged");
    expect(result.flags).not.toContain("bond_unprepared");
  });

  it("suppresses reverse_questions_declined on a short screening call when closer is missed/declined", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "TCS",
        transcript: [
          { speaker: "ai", text: "Tell me about yourself.", time: "00:00" },
          { speaker: "user", text: "I'm Anjali, CSE final year, CGPA 8.4.", time: "00:05" },
          { speaker: "ai", text: "Do you have any questions for us?", time: "01:00" },
          { speaker: "user", text: "No, I'm good thanks.", time: "01:15" },
        ],
      }),
      resume: null,
    });
    expect(result.flags).toContain("short_screening_session_acknowledged");
    expect(result.flags).not.toContain("reverse_questions_declined");
  });

  it("STILL fires reverse_questions_declined on a full (≥10 turn) panel", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "TCS",
        transcript: padTo12Turns([
          { speaker: "ai", text: "Tell me about yourself.", time: "00:00" },
          { speaker: "user", text: "I'm Anjali, CSE final year, CGPA 8.4.", time: "00:05" },
          { speaker: "ai", text: "Do you have any questions for us?", time: "10:00" },
          { speaker: "user", text: "No, I'm good thanks.", time: "10:15" },
        ]),
      }),
      resume: null,
    });
    expect(result.flags).not.toContain("short_screening_session_acknowledged");
    expect(result.flags).toContain("reverse_questions_declined");
  });
});

describe("campus-placement v6.7 (8.3) — shipped_to_prod_context positive flag", () => {
  it("fires shipped_to_prod_context on production/active-user narrative", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "Google",
        transcript: padTo12Turns([
          { speaker: "ai", text: "Tell me about a project.", time: "00:00" },
          { speaker: "user", text: "I built a webhook retry service during my internship — shipped to production, currently serving 200 active users every day, merged my PR into the main payments codebase.", time: "00:05" },
        ]),
      }),
      resume: null,
    });
    expect(result.flags).toContain("shipped_to_prod_context");
  });

  it("suppresses portfolio_absent_for_claim at top-tier-campus when shipped_to_prod_context is present", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "Google",
        transcript: padTo12Turns([
          { speaker: "ai", text: "Tell me about a project.", time: "00:00" },
          { speaker: "user", text: "I built a small notification service. Shipped to production at my internship, live with 300 daily active users now — repo is internal so I can't share it publicly.", time: "00:05" },
          { speaker: "ai", text: "Got it. Tell me more.", time: "01:00" },
          { speaker: "user", text: "Sure — happy to walk you through the architecture decisions.", time: "01:15" },
        ]),
      }),
      resume: null,
    });
    expect(result.flags).toContain("shipped_to_prod_context");
    expect(result.flags).not.toContain("portfolio_absent_for_claim");
  });

  it("STILL fires portfolio_absent_for_claim at service-tier (no product-grade leniency)", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "TCS",
        transcript: padTo12Turns([
          { speaker: "ai", text: "Tell me about a project.", time: "00:00" },
          { speaker: "user", text: "I built a small notification service. Shipped to production at my internship, live with 300 daily active users now — repo is internal so I can't share it publicly.", time: "00:05" },
          { speaker: "ai", text: "Got it.", time: "01:00" },
          { speaker: "user", text: "Yes that's the project.", time: "01:15" },
        ]),
      }),
      resume: null,
    });
    expect(result.flags).toContain("shipped_to_prod_context");
    expect(result.flags).toContain("portfolio_absent_for_claim");
  });
});

describe("campus-placement v6.7 (8.4) — location_agnostic_signal at tcs-digital", () => {
  it("emits location_agnostic_signal and suppresses weak_reverse_questions at tcs-digital", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "TCS",
        transcript: padTo12Turns([
          { speaker: "ai", text: "I'm interviewing you for the TCS Digital track today.", time: "00:00" },
          { speaker: "user", text: "Got it — and I'm open to any location, happy to relocate anywhere pan-India.", time: "00:05" },
          { speaker: "ai", text: "Any questions for us?", time: "10:00" },
          { speaker: "user", text: "What's the work culture like? And how is the team culture?", time: "10:15" },
        ]),
      }),
      resume: null,
    });
    expect(result.meta?.campusPlacement?.archetype).toBe("tcs-digital");
    expect(result.flags).toContain("location_agnostic_signal");
    expect(result.flags).not.toContain("weak_reverse_questions");
  });
});

describe("campus-placement v6.7 (8.5) — aptitude_puzzle_refusal severity at tcs-digital", () => {
  it("downgrades aptitude_puzzle_refusal severity to 'low' at tcs-digital (offline coding format)", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "TCS",
        transcript: padTo12Turns([
          { speaker: "ai", text: "Quick puzzle for the TCS Digital track: how would you reverse a linked list?", time: "00:00" },
          { speaker: "user", text: "I can't think under pressure, I need an IDE.", time: "00:05" },
        ]),
      }),
      resume: null,
    });
    expect(result.flags).toContain("aptitude_puzzle_refusal");
    const gap = result.rubricGaps.find((g) => /refused\s+or\s+stalled\s+on\s+a\s+live\s+puzzle/i.test(g.observed));
    expect(gap?.severity).toBe("low");
  });

  it("keeps aptitude_puzzle_refusal severity at 'high' at top-tier-campus", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "Google",
        transcript: padTo12Turns([
          { speaker: "ai", text: "Quick puzzle: how would you reverse a linked list?", time: "00:00" },
          { speaker: "user", text: "I can't think under pressure, I need an IDE.", time: "00:05" },
        ]),
      }),
      resume: null,
    });
    expect(result.flags).toContain("aptitude_puzzle_refusal");
    const gap = result.rubricGaps.find((g) => /refused\s+or\s+stalled\s+on\s+a\s+live\s+puzzle/i.test(g.observed));
    expect(gap?.severity).toBe("high");
  });
});

describe("campus-placement v6.7 (8.6) — weak_reverse_questions leniency at unknown archetype", () => {
  it("does NOT fire weak_reverse_questions at unknown archetype on generic reverse-question", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "SomeRandomCo",
        transcript: padTo12Turns([
          { speaker: "ai", text: "Tell me about yourself.", time: "00:00" },
          { speaker: "user", text: "I'm Anjali, CSE final year, CGPA 8.4.", time: "00:05" },
          { speaker: "ai", text: "Any questions for us?", time: "10:00" },
          { speaker: "user", text: "What's the work culture like? How is the team culture for freshers?", time: "10:15" },
        ]),
      }),
      resume: null,
    });
    expect(result.meta?.campusPlacement?.archetype).toBe("unknown");
    expect(result.flags).not.toContain("weak_reverse_questions");
  });

  it("STILL fires weak_reverse_questions at top-tier-campus on generic reverse-question (no leniency)", async () => {
    const result = await campusPlacement.analyze({
      session: session({
        targetCompany: "Google",
        transcript: padTo12Turns([
          { speaker: "ai", text: "Tell me about yourself.", time: "00:00" },
          { speaker: "user", text: "I'm Anjali, CSE final year, CGPA 8.4.", time: "00:05" },
          { speaker: "ai", text: "Any questions for us?", time: "10:00" },
          { speaker: "user", text: "What's the work culture like? How is the team culture for freshers?", time: "10:15" },
        ]),
      }),
      resume: null,
    });
    expect(result.flags).toContain("weak_reverse_questions");
  });
});
