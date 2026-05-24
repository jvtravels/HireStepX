import { describe, it, expect } from "vitest";
import { behavioralAnalyzer } from "../../../server-handlers/analyzers/behavioral";
import type {
  SessionRowForAnalysis,
  TranscriptTurn,
} from "../../../server-handlers/analyzers/_types";

/* Behavioral analyzer — Phase 5.1 ground-truth fixture suite.
 *
 * Mirrors `hrRoundAnalyzer.test.ts` (HR Phase 4.1) — every detection
 * block gets at least one end-to-end transcript that asserts the
 * expected flag fires, plus an inverse transcript that asserts it
 * does NOT fire on similar-looking but legitimately-different content.
 *
 * Convention:
 *   - `ai(...)` / `user(...)` helpers build TranscriptTurn rows.
 *   - Each `describe` block scopes one signal; the green / red pair
 *     pins precision and recall.
 *   - Fixtures aim for ~30-60s of realistic Indian-register dialogue.
 *
 * When adding a new detection block:
 *   1. Add a fixture that asserts the flag fires.
 *   2. Add a near-miss inverse that asserts it doesn't.
 *   3. Land BOTH in this file. */

function session(
  overrides: Partial<SessionRowForAnalysis> & { transcript: TranscriptTurn[] },
): SessionRowForAnalysis {
  return {
    id: "fix_test",
    user_id: "fix_user",
    type: "behavioral",
    focus: "Behavioral",
    difficulty: "mid",
    score: 70,
    questions: 5,
    duration: 1800,
    ai_feedback: "",
    skill_scores: null,
    job_description: null,
    jd_analysis: null,
    resume_version_id: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const ai = (text: string): TranscriptTurn => ({ speaker: "ai", text, time: "" });
const user = (text: string): TranscriptTurn => ({ speaker: "user", text, time: "" });

describe("behavioral fixtures — STAR completeness", () => {
  it("FIXTURE: complete STAR session does NOT flag weak_star_structure", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a project where you owned the outcome."),
          user(
            "At Razorpay, our checkout p99 latency was at 1.2s during sale events — the situation was that conversion was dropping 8% on flash sales. My task was to bring p99 under 500ms in six weeks. I led the migration to a sharded queue and rewrote the settlement worker. The result: p99 dropped to 380ms and conversion recovered 6%.",
          ),
          ai("Tell me about a time you had to push back."),
          user(
            "The situation was a planned feature freeze. My task was to land a security fix before audit. I escalated to the head of engineering and proposed a one-week exception. We shipped the fix on time and the audit passed.",
          ),
        ],
      }),
    });
    expect(out.flags).not.toContain("weak_star_structure");
    expect(out.meta?.behavioral?.starBreakdown?.length).toBe(2);
  });

  it("FIXTURE: chronic STA-without-R fires frequent_missing_result", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a project."),
          user("The situation was a migration. My task was to design it. I designed it and led the team through three months of execution and rolled it out across two regions."),
          ai("Tell me about a conflict."),
          user("The situation was a disagreement with product. My task was to align. I made my case, escalated, and re-aligned the team on a new approach over the next sprint."),
          ai("Tell me about something hard."),
          user("The situation was scaling. My task was to fix it. I designed a new architecture, instrumented the data path, and worked across three teams on the rollout."),
        ],
      }),
    });
    expect(out.flags).toContain("frequent_missing_result");
  });
});

describe("behavioral fixtures — quantification", () => {
  it("FIXTURE: incidental numbers do NOT pass as IMPACT_QUANTIFIED", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a project."),
          user("My task was to lead the rewrite. I worked 5 days a week on the migration. I led the team for 3 months and attended every standup throughout."),
          ai("Another?"),
          user("My task was the rollout. I led 8 meetings a day. I worked with 5 people across 12 weeks and attended every review consistently."),
          ai("And another?"),
          user("My task was the redesign. I led 5 reviewers through the design. I worked the project for 4 months and joined 6 syncs a week without exception."),
        ],
      }),
    });
    expect(out.flags).toContain("unquantified_answers");
    const all = out.meta?.behavioral?.starBreakdown || [];
    expect(all.every((s) => !s.quantified)).toBe(true);
  });

  it("FIXTURE: numbers paired with result verbs DO pass as IMPACT_QUANTIFIED", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a project."),
          user("I led the checkout rewrite. We reduced p99 latency by 40% and saved roughly ₹2 crore in vendor costs annually."),
          ai("Another?"),
          user("I owned the onboarding flow. We increased activation by 22% and shipped to 50k merchants in the first quarter."),
        ],
      }),
    });
    expect(out.flags).not.toContain("unquantified_answers");
    const all = out.meta?.behavioral?.starBreakdown || [];
    expect(all.some((s) => s.quantified)).toBe(true);
  });
});

describe("behavioral fixtures — company verification", () => {
  it("FIXTURE: 'At Last Year' / 'At Northern India' do NOT trigger unverifiable_companies", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        jd_analysis: { resume_excerpt: "Worked at Razorpay" } as Record<string, unknown>,
        transcript: [
          ai("Walk me through your last role."),
          user("At Last Year I shipped the checkout migration. At Northern India we expanded the merchant footprint. At First Glance the architecture looked simple."),
        ],
      }),
    });
    expect(out.flags).not.toContain("unverifiable_companies");
  });

  it("FIXTURE: real unknown companies with corporate suffixes DO fire unverifiable_companies", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        jd_analysis: { resume_excerpt: "Worked at Razorpay" } as Record<string, unknown>,
        transcript: [
          ai("Walk me through your past roles."),
          user(
            "At Phantom Technologies I led the platform team. Later at Acme Pvt Ltd I owned the migration. Before that at Bogus Systems Inc I built the analytics layer.",
          ),
        ],
      }),
    });
    expect(out.flags).toContain("unverifiable_companies");
  });
});

describe("behavioral fixtures — probing depth (Phase 3)", () => {
  it("FIXTURE: AI rolls past vague answers → ai_accepted_vague", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a project."),
          user(
            "We kind of figured it out as a team. Everyone pitched in and the team handled it. We sort of worked through the issues.",
          ),
          ai("Got it. Next?"),
          user(
            "The team basically managed the rollout. Everyone just sort of did their part and things worked out fine in the end.",
          ),
          ai("Cool, moving on."),
          user(
            "We generally figured it out together. The team kind of sorted the launch and things worked out for the customer.",
          ),
        ],
      }),
    });
    expect(out.flags).toContain("ai_accepted_vague");
  });

  it("FIXTURE: AI probes for ownership → ai_accepted_vague does NOT fire", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a project."),
          user("We kind of figured it out as a team and everyone pitched in to sort of make it work."),
          ai("What did *you* specifically do?"),
          user("I led the migration. I owned the architecture call and drove the rollout."),
        ],
      }),
    });
    expect(out.flags).not.toContain("ai_accepted_vague");
  });

  it("FIXTURE: failure question → owns_failure when candidate takes accountability", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a time you failed."),
          user(
            "I underestimated the migration risk and shipped late. My mistake — in hindsight I should have escalated sooner. I owned the slip in the retro and used it as a forcing function on the next launch.",
          ),
        ],
      }),
    });
    expect(out.flags).toContain("owns_failure");
    expect(out.meta?.behavioral?.probing?.failureResponse).toBe("owns");
  });

  it("FIXTURE: owns failure WITHOUT naming concrete miss → weak_specificity_in_failure_story", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about your biggest failure."),
          user(
            "Honestly, I made a mistake on that one. I underestimated it and I should have done better. My bad — I owned the miss in the retro and committed to doing better next time. I learned a lot from it and moved on.",
          ),
        ],
      }),
    });
    expect(out.flags).toContain("owns_failure");
    expect(out.flags).toContain("weak_specificity_in_failure_story");
    expect(out.meta?.behavioral?.probing?.failureResponseHadConcreteMiss).toBe(false);
  });

  it("FIXTURE: owns failure WITH concrete miss → no weak_specificity_in_failure_story", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about your biggest failure."),
          user(
            "I underestimated the rollback path on the checkout migration — I shipped without a tested revert sequence and we ate two hours of downtime during the next sale event. My mistake. In hindsight I should have spec'd the rollback before the rollout, and that's the rule on my team now.",
          ),
        ],
      }),
    });
    expect(out.flags).toContain("owns_failure");
    expect(out.flags).not.toContain("weak_specificity_in_failure_story");
    expect(out.meta?.behavioral?.probing?.failureResponseHadConcreteMiss).toBe(true);
  });

  it("FIXTURE: failure question → deflects_failure when candidate routes blame", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about your biggest mistake."),
          user(
            "The team didn't deliver on time and management kept changing scope. The client wouldn't sign off so we couldn't move. Engineering leadership never gave us the headcount.",
          ),
        ],
      }),
    });
    expect(out.flags).toContain("deflects_failure");
  });

  it("FIXTURE: learning reflection absent in long session → no_learning_reflection", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a project."),
          user("I led the checkout rewrite. We reduced p99 by 40% and increased conversion by 6%."),
          ai("Tell me about a conflict."),
          user("I aligned with product on the new approach. We shipped the compromise in three sprints."),
          ai("Something hard?"),
          user("I drove the migration to sharded queues. We saved ₹2 crore annually in vendor cost."),
          ai("One more."),
          user("I owned the onboarding redesign. We increased activation by 22% across 50k merchants."),
        ],
      }),
    });
    expect(out.flags).toContain("no_learning_reflection");
  });

  it("FIXTURE: learning reflection present → no_learning_reflection does NOT fire", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a project."),
          user(
            "I led the checkout rewrite. We reduced p99 by 40%. In hindsight I would have spec'd the rollback path first — I learned to validate the rollback before the rollout.",
          ),
          ai("Tell me about a conflict."),
          user(
            "I aligned with product on the new approach. The biggest lesson for me was to surface trade-offs in writing before the meeting, not during.",
          ),
          ai("Something hard?"),
          user("I drove the migration. We saved ₹2 crore annually."),
          ai("One more."),
          user("I owned the onboarding redesign. We increased activation by 22%."),
        ],
      }),
    });
    expect(out.flags).not.toContain("no_learning_reflection");
  });
});

describe("behavioral fixtures — register drift (Phase 4.1)", () => {
  it("FIXTURE: AI drifts to USD / 401k / PTO → register_drift_to_us", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("For context the package is around $140,000 base with a 401(k) match and 20 PTO days."),
          user("I owned the migration end-to-end."),
          ai("And the sign-on package is competitive."),
          user("I shipped on time."),
        ],
      }),
    });
    expect(out.flags).toContain("register_drift_to_us");
    expect(out.rubricGaps.some((g) => g.flag === "register_drift_to_us")).toBe(true);
  });

  it("FIXTURE: Indian-register AI turns do NOT trigger register_drift_to_us", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("The role is around 32 LPA with standard PL/CL and EPF."),
          user("I owned the migration end-to-end."),
          ai("And the joining bonus is 2 lakh."),
          user("I shipped on time."),
        ],
      }),
    });
    expect(out.flags).not.toContain("register_drift_to_us");
  });
});

describe("behavioral fixtures — competency taxonomy (Phase 2)", () => {
  it("FIXTURE: Amazon-track answers surface ownership + customer-obsession on top", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        target_company: "Amazon",
        transcript: [
          ai("Tell me about a customer-obsession moment."),
          user(
            "I talked to ten merchants weekly before redesigning the flow. I owned the migration end-to-end and dogfooded the new system for a month. We delivered on time and increased activation by 22%.",
          ),
          ai("And one more?"),
          user("I owned the onboarding rewrite. I drove cross-team alignment and shipped to 50k merchants."),
        ],
      }),
    });
    const top = out.meta?.behavioral?.topCompetencies || [];
    expect(top[0]).toBe("ownership");
    expect(top).toContain("customer-obsession");
    expect(out.coachingNotes.toLowerCase()).toMatch(/strong signals|anchor/);
  });

  it("FIXTURE: Google-track answers surface dive-deep + learn-and-be-curious", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        target_company: "Google",
        transcript: [
          ai("Tell me about a hard debug."),
          user(
            "I root-caused the latency to a single config flag. I pulled the logs and traced the request path. The data showed a 3x spike on Sundays.",
          ),
          ai("Tell me about something you didn't know."),
          user(
            "I didn't know Kafka so I read up over the weekend. I ran a spike to validate the approach and paired with a senior engineer for two days.",
          ),
        ],
      }),
    });
    const top = out.meta?.behavioral?.topCompetencies || [];
    expect(top).toContain("dive-deep");
    expect(top).toContain("learn-and-be-curious");
  });
});

describe("behavioral fixtures — duplicate-question detection", () => {
  it("FIXTURE: same question asked twice → duplicate_question flag", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a time you owned a difficult cross-team decision."),
          user("I owned the checkout migration call."),
          ai("Tell me about a time you owned a difficult cross-team decision."),
          user("I owned the payments rewrite."),
        ],
      }),
    });
    expect(out.flags).toContain("duplicate_question");
  });
});

describe("behavioral fixtures — empty / degenerate input", () => {
  it("FIXTURE: empty transcript → empty_transcript", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({ transcript: [] }),
    });
    expect(out.flags).toContain("empty_transcript");
  });

  it("FIXTURE: only micro-replies → no STAR signal, no false flags", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Ready?"),
          user("Yes."),
          ai("Are you sure?"),
          user("Yes."),
        ],
      }),
    });
    expect(out.flags).not.toContain("weak_star_structure");
    expect(out.flags).not.toContain("frequent_missing_result");
  });

  it("FIXTURE: all-AI transcript (no substantive user answers) → no_user_answers_recorded", async () => {
    /* Phase-6-hygiene — distinguishable from `empty_transcript` (0
       turns). Useful when the candidate was muted / mic broken — the
       report layer needs to render a different empty state. */
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about yourself."),
          ai("Take your time."),
          ai("Walk me through your most recent project."),
        ],
      }),
    });
    expect(out.flags).toContain("no_user_answers_recorded");
    expect(out.flags).not.toContain("empty_transcript");
  });
});

describe("behavioral fixtures — we_attribution_heavy (Phase-6 hygiene)", () => {
  it("FIXTURE: 4 substantive answers, 3 lean on we/team without first-person action → we_attribution_heavy", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a time you owned a tough delivery."),
          user("So we managed the migration as a team. The team handled the rollout and we figured out the gaps as they came up over a couple of months."),
          ai("Tell me about a time you drove cross-functional alignment."),
          user("The team handled it really well. Everyone got it done in the end and we managed the dependencies between three pods without major issues."),
          ai("Tell me about a time you closed a critical bug."),
          user("We worked out a fix quickly. The team got that done within a sprint and we managed the comms back to the customer through the AM."),
          ai("Tell me about a real win this year."),
          user("I personally led the redesign of the checkout funnel — I owned the discovery, drove the prototype reviews, and shipped a 12% conversion lift over the baseline."),
        ],
      }),
    });
    expect(out.flags).toContain("we_attribution_heavy");
  });

  it("FIXTURE: ≥2 long answers without R or quantification → rambling_answers", async () => {
    /* Each user answer below is intentionally >1800 chars, missing R,
     * and not impact-quantified. The flag should fire on the session
     * pattern, not on any single long answer. */
    const longNoR = (theme: string): string => {
      const filler = " The team kept iterating across reviews, alignment meetings, and design crits — and honestly there was a lot of back-and-forth between us, the PM, and the design lead about what good would look like in this space, which made the whole stretch feel longer than it needed to be.";
      const seed = `So the situation with ${theme} was layered — there were stakeholders pulling in different directions and I was trying to find a path that respected the technical realities while still moving us forward on the original commitment we had made earlier in the quarter to the leadership review.`;
      return (seed + filler.repeat(6)).slice(0, 2400);
    };
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Walk me through a major delivery."),
          user(longNoR("the migration")),
          ai("Tell me about a difficult call."),
          user(longNoR("the rearchitecture")),
          ai("And a time you led through ambiguity?"),
          user(longNoR("the cross-org rollout")),
        ],
      }),
    });
    expect(out.flags).toContain("rambling_answers");
  });

  it("FIXTURE: long answer WITH R + quantification → no rambling_answers", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Walk me through a major delivery."),
          user(
            "The situation was that our checkout p99 latency was at 1.2s during sale events, and conversion was dropping eight percent on flash sales — we were leaving real money on the table every weekend. My task was to bring p99 under 500ms within six weeks while keeping the existing payment integrations stable. I led the migration to a sharded queue, rewrote the settlement worker, and personally owned the cutover sequencing across our three regional clusters. As a result, p99 dropped to 380ms and we recovered six percent of conversion within the first sale window after rollout — measured against the prior month's baseline."
          ),
          ai("Tell me about a difficult call."),
          user(
            "The situation was a planned feature freeze before the audit window. My task was to land a security fix without breaking the freeze policy. I escalated to the head of engineering, walked through the risk math, and proposed a tightly-scoped one-week exception. As a result, we shipped the fix, the audit passed cleanly, and the team avoided the much larger cost of slipping the audit by a quarter — which we measured at roughly thirty engineering-weeks of follow-on work."
          ),
        ],
      }),
    });
    expect(out.flags).not.toContain("rambling_answers");
  });

  it("FIXTURE: every answer carries first-person action → no we_attribution_heavy", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a time you owned a tough delivery."),
          user("I led the migration end-to-end. I owned the rollout plan, I designed the cutover sequence, and I shipped it over a six-week window."),
          ai("Tell me about cross-functional alignment."),
          user("I drove the alignment myself — I scheduled the weekly stand-ups, I wrote the brief, and I escalated when the PM and tech-lead disagreed on scope."),
          ai("Tell me about a recent bug fix."),
          user("I debugged the production incident, I root-caused the race condition, and I shipped the hotfix that night."),
        ],
      }),
    });
    expect(out.flags).not.toContain("we_attribution_heavy");
  });

  it("FIXTURE: ≥2 stock-opener answers → rehearsed_answers", async () => {
    /* Two of the three substantive answers open with a memorised stock
     * phrase. Should fire at REHEARSED_MIN_HITS = 2. */
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a time you led through a tough delivery."),
          user(
            "Let me tell you about a time when our checkout p99 was at 1.2 seconds during sale events. My task was to bring it under 500ms in six weeks. I led the migration to a sharded queue and rewrote the settlement worker. As a result, p99 dropped to 380ms.",
          ),
          ai("Tell me about a difficult conversation."),
          user(
            "To answer your question, I had a disagreement with my product manager about scope. My task was to align the team without slipping the launch date. I escalated to the head of engineering, walked through the risk math, and we shipped on time.",
          ),
          ai("Tell me about a failure."),
          user(
            "I once underestimated the migration complexity and we slipped by two weeks. I owned the miss in the retro, wrote up the lessons, and we rebuilt the estimation process so future migrations had buffer.",
          ),
        ],
      }),
    });
    expect(out.flags).toContain("rehearsed_answers");
    expect(out.meta?.behavioral?.delivery?.rehearsedOpenerHits).toBeGreaterThanOrEqual(2);
  });

  it("FIXTURE: spontaneous openings → no rehearsed_answers", async () => {
    /* Same answer shapes as above but each one opens inside the
     * situation rather than with a template phrase. */
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a time you led through a tough delivery."),
          user(
            "It was three weeks before launch and our checkout p99 was sitting at 1.2 seconds during sale events. My task was to bring it under 500ms in six weeks. I led the migration to a sharded queue and rewrote the settlement worker. As a result, p99 dropped to 380ms.",
          ),
          ai("Tell me about a difficult conversation."),
          user(
            "My PM wanted to push checkout-revamp into the same sprint as the audit fix — that's where we disagreed. I walked through the risk math with the head of engineering and proposed a tightly scoped exception. We shipped both on time.",
          ),
          ai("Tell me about a failure."),
          user(
            "I underestimated the migration complexity and we slipped by two weeks. I owned the miss in the retro and we rebuilt the estimation process so future migrations had buffer.",
          ),
        ],
      }),
    });
    expect(out.flags).not.toContain("rehearsed_answers");
  });

  it("FIXTURE: ≥2 hedge-dense answers → low_conviction_delivery", async () => {
    /* Each substantive answer carries ≥3 hedge tokens (um / like /
     * maybe / I think / kind of). Should fire at LOW_CONVICTION_MIN_HITS = 2. */
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a time you led through a tough delivery."),
          user(
            "So um, I think it was, like, the checkout migration where, you know, I was kind of leading the work. Basically my task was to, like, get latency down and I think we maybe shipped it in six weeks or so. I led the migration to a sharded queue and rewrote the settlement worker. As a result, latency dropped.",
          ),
          ai("Tell me about a difficult conversation."),
          user(
            "Honestly, I would say it was, like, a disagreement with my PM. I mean, I think it was about scope, basically, and I'm not sure exactly how it started but, you know, we kind of worked through it. I escalated to the head of engineering and we shipped on time.",
          ),
          ai("Tell me about a failure."),
          user(
            "I underestimated the migration and we slipped by two weeks. I owned the miss in the retro and we rebuilt the estimation process so future migrations had buffer.",
          ),
        ],
      }),
    });
    expect(out.flags).toContain("low_conviction_delivery");
    expect(out.meta?.behavioral?.delivery?.lowConvictionHits).toBeGreaterThanOrEqual(2);
  });

  it("FIXTURE: ≥2 conflict answers without counterparty POV → one_sided_conflict_narrative", async () => {
    /* Both conflict-shaped AI prompts get answered with pure first-
     * person narration ("I did X, I escalated, I shipped") — the
     * candidate never mentions what the OTHER side wanted, believed,
     * or feared. Should fire at ONE_SIDED_CONFLICT_MIN_HITS = 2. */
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a disagreement with a stakeholder."),
          user(
            "I disagreed with the scope on the audit-fix sprint. I walked through the risk math, escalated to the head of engineering, and proposed a one-week exception. I shipped the fix on time and the audit passed.",
          ),
          ai("Tell me about a time you had to push back on cross-functional alignment."),
          user(
            "I pushed back on the launch plan because I thought it was unsafe. I wrote up my analysis, presented it in the next leadership review, and got the rollout window extended. I shipped the migration two sprints later.",
          ),
          ai("Tell me about a project."),
          user(
            "I led the checkout rewrite end-to-end. I owned the architecture call, designed the cutover sequence, and shipped p99 down to 380ms.",
          ),
        ],
      }),
    });
    expect(out.flags).toContain("one_sided_conflict_narrative");
    expect(out.meta?.behavioral?.conflict?.oneSidedConflictHits).toBeGreaterThanOrEqual(2);
    expect(out.meta?.behavioral?.conflict?.conflictQuestionsAsked).toBeGreaterThanOrEqual(2);
  });

  it("FIXTURE: conflict answers that name the other side's position → no one_sided_conflict_narrative", async () => {
    /* Same conflict prompts but each answer opens with what the
     * counterparty wanted / believed / argued. Protects against false
     * positives on well-narrated disagreements. */
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a disagreement with a stakeholder."),
          user(
            "The PM wanted to ship checkout-revamp in the same sprint as the audit fix — their position was that the audit would slip the launch and lose the quarter. I walked through the risk math with the head of engineering and proposed a one-week exception. We shipped both on time.",
          ),
          ai("Tell me about a time you had to push back on cross-functional alignment."),
          user(
            "The design lead believed the new flow would lose mobile users; their concern was around tap-target density on low-end Androids. I ran a usability test on a 2GB device, brought the data back, and we landed on a compromise layout. The mobile conversion held.",
          ),
          ai("Tell me about a project."),
          user(
            "I led the checkout rewrite end-to-end. I owned the architecture call and shipped p99 down to 380ms.",
          ),
        ],
      }),
    });
    expect(out.flags).not.toContain("one_sided_conflict_narrative");
  });

  it("FIXTURE: decisive answers → no low_conviction_delivery", async () => {
    /* Same content density but no hedge stacks. Should NOT trip the
     * flag — protects against false positives on confident speech that
     * happens to contain a single "I think" or "like". */
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a time you led through a tough delivery."),
          user(
            "The checkout migration. My task was to bring p99 under 500ms in six weeks. I led the migration to a sharded queue and rewrote the settlement worker. As a result, p99 dropped to 380ms within the first sale window.",
          ),
          ai("Tell me about a difficult conversation."),
          user(
            "My PM and I disagreed on scope for the audit fix. I walked through the risk math with the head of engineering and proposed a tightly scoped one-week exception. We shipped both on time.",
          ),
          ai("Tell me about a failure."),
          user(
            "I underestimated the migration complexity and we slipped by two weeks. I owned the miss in the retro and we rebuilt the estimation process so future migrations had buffer.",
          ),
        ],
      }),
    });
    expect(out.flags).not.toContain("low_conviction_delivery");
  });
});
