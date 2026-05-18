import { describe, it, expect } from "vitest";
import { behavioralAnalyzer } from "../../../server-handlers/analyzers/behavioral";
import type { SessionRowForAnalysis, TranscriptTurn } from "../../../server-handlers/analyzers/_types";

function session(overrides: Partial<SessionRowForAnalysis> & { transcript: TranscriptTurn[] }): SessionRowForAnalysis {
  return {
    id: "sess_test",
    user_id: "user_test",
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

describe("behavioralAnalyzer", () => {
  it("flags weak STAR structure when most answers miss components", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a time you led a project."),
          user("I worked on a team project last year and it was hard but we did our best together overall."),
          ai("And another?"),
          user("Yeah I helped with a launch once. It was good. People seemed happy with the outcome at the time."),
          ai("Another example?"),
          user("Sure, I worked on something else too. It was decent. Not much else to say honestly."),
        ],
      }),
    });
    expect(out.flags).toContain("weak_star_structure");
  });

  it("does not flag a clean STAR answer with quantified result", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a time you improved a system."),
          user(
            "The situation was that our checkout API was timing out under load. My task was to find the cause and fix it. I built a new caching layer and rewrote the slow query path. The result was a 60% reduction in p99 latency and we shipped it within 2 weeks.",
          ),
        ],
      }),
    });
    expect(out.flags).not.toContain("weak_star_structure");
    expect(out.flags).not.toContain("frequent_missing_result");
    expect(out.flags).not.toContain("unquantified_answers");
  });

  it("flags ai_accepts_missing_result when AI moves on without probing for outcome", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a difficult stakeholder."),
          user(
            "The situation was a tough partnership with marketing. My task was to align on roadmap. I scheduled weekly syncs and rebuilt trust by sharing demos. We collaborated more after that.",
          ),
          ai("Great. Tell me about a time you had to learn something new."),
          user(
            "The context was joining a Rust team. My task was to ship a service in 6 weeks. I paired with senior engineers and read the book end to end. It was a productive experience for me overall.",
          ),
          ai("Nice. Next question — describe a conflict you handled."),
          user(
            "The situation was two engineers disagreeing on architecture. My responsibility was to mediate. I set up a design doc review and facilitated discussion. Things calmed down eventually after that.",
          ),
        ],
      }),
    });
    expect(out.flags).toContain("ai_accepts_missing_result");
    expect(out.rubricGaps.length).toBeGreaterThan(0);
  });

  it("flags duplicate_question when AI repeats the same question", async () => {
    const repeat = "Tell me about a time you had to influence without authority across the organization.";
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai(repeat),
          user("I once convinced a partner team to adopt our shared library. Result: they migrated in 3 sprints."),
          ai("Got it."),
          ai(repeat),
          user("Another example: I drove cross-team alignment on logging. Outcome: unified format shipped to 40 services."),
        ],
      }),
    });
    expect(out.flags).toContain("duplicate_question");
    expect(out.badQuestions.find((q) => q.reason === "duplicate_question")).toBeDefined();
  });

  it("flags unquantified_answers when answers describe Action but never include numbers", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a time you led."),
          user("The situation was a struggling team. My task was to refocus them. I implemented new ceremonies and drove alignment. The result was a team that felt better aligned and happier overall day to day."),
          ai("Another example."),
          user("Context: a stalled migration. I was responsible for unblocking it. I built a dashboard and led standups. Outcome: the project moved forward smoothly to completion."),
          ai("Another."),
          user("Situation: a launch behind schedule. My task was to recover. I created a tiger team and led daily syncs. The result was a successful launch with happy stakeholders all around."),
        ],
      }),
    });
    expect(out.flags).toContain("unquantified_answers");
  });

  it("returns empty_transcript flag and no errors for an empty session", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({ transcript: [] }),
    });
    expect(out.flags).toEqual(["empty_transcript"]);
    expect(out.hallucinations).toEqual([]);
    expect(out.rubricGaps).toEqual([]);
  });

  it("emits per-answer starBreakdown in meta.behavioral", async () => {
    /* Phase-1 (v2) addition: aggregate completionRate told the candidate
       "weak STAR" without identifying WHICH answer was thin. The
       breakdown lets the report render a per-turn ✓S ✓T ✓A ✗R matrix. */
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a project."),
          user(
            "At my last company the team was struggling with a stalled migration. My task was to unblock it. I built a dashboard and led daily standups. As a result we reduced the cutover risk by 40% and shipped on time.",
          ),
          ai("And another?"),
          user(
            "We were the team — we built things together. It went well overall and people were happy with the outcome at the end.",
          ),
        ],
      }),
    });
    const bd = out.meta?.behavioral?.starBreakdown;
    expect(bd).toBeDefined();
    expect(bd!.length).toBe(2);
    expect(bd![0].quantified).toBe(true);
    expect(bd![0].missing).not.toContain("A");
    expect(bd![0].missing).not.toContain("R");
    expect(bd![1].quantified).toBe(false);
    // Each breakdown row carries a short preview the UI can show.
    expect(bd![0].text_preview.length).toBeGreaterThan(0);
    expect(bd![0].text_preview.length).toBeLessThanOrEqual(160);
  });

  it("unverifiable_companies does NOT fire on capitalized phrases without a corporate suffix", async () => {
    /* Phase-1 (v2) fix: v1 fired on "At Northern India" / "At Last
       Year". The new gate requires a corporate suffix, a known-co
       hint, or a resume match before counting a phrase as a company. */
    const out = await behavioralAnalyzer.analyze({
      session: session({
        jd_analysis: { role: "engineer" }, // non-empty resumeText source
        transcript: [
          ai("Walk me through your background."),
          user(
            "At Northern India offices we had a team of four. At Last Year's hackathon we built a prototype. The result was a working demo that won second place.",
          ),
          ai("Anything else?"),
          user(
            "At The Time we were figuring out the architecture. At First Glance the design seemed fine, but I rewrote it. The result was a cleaner system.",
          ),
        ],
      }),
    });
    expect(out.flags).not.toContain("unverifiable_companies");
  });

  it("unverifiable_companies DOES fire when 2+ company-suffixed names aren't in the resume", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        jd_analysis: { role: "engineer" }, // resume mentions nothing
        transcript: [
          ai("Walk me through your background."),
          user(
            "At Phantom Technologies Pvt Ltd I led the backend team. We shipped a billing service. The result was a 30% drop in support tickets.",
          ),
          ai("Another role?"),
          user(
            "At Imaginary Labs Inc I drove the migration to microservices. The team adopted my proposal. The result was a successful cutover in 8 weeks.",
          ),
        ],
      }),
    });
    expect(out.flags).toContain("unverifiable_companies");
  });

  it("unquantified_answers does NOT fire when numbers sit next to result verbs", async () => {
    /* Phase-1 (v2) numeric depth: v1 counted "5 days a week" as
       quantified. v2 requires the number near a result verb. */
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a launch."),
          user(
            "The situation was a delayed rollout. My task was to recover the schedule. I built a tiger team and shipped on time. We reduced p99 latency by 40% across the API.",
          ),
          ai("Another?"),
          user(
            "Context: a migration. I was responsible for it. I ran daily syncs. We migrated 200 services in 6 weeks and cut on-call paging by 30%.",
          ),
          ai("One more?"),
          user(
            "Situation: a struggling team. My task was to refocus. I ran retros and reset the roadmap. We delivered 3 milestones ahead of plan and increased velocity by 25%.",
          ),
        ],
      }),
    });
    expect(out.flags).not.toContain("unquantified_answers");
  });

  it("unquantified_answers DOES fire on incidental numerics with no result-verb proximity", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a project."),
          user(
            "The situation was a stalled effort. My task was to push it. I worked 5 days a week with the team for 3 months. People felt better aligned and happier overall.",
          ),
          ai("Another?"),
          user(
            "Context: a struggling launch. I was responsible. I ran 10 standups and 4 retros. The team felt good about the direction by the end of the quarter.",
          ),
          ai("Another?"),
          user(
            "Situation: a delay. My task was to recover. I scheduled 6 meetings and read 2 books. People felt better aligned and morale was higher by the end of the quarter.",
          ),
        ],
      }),
    });
    expect(out.flags).toContain("unquantified_answers");
  });

  it("emits topCompetencies + competencyCounts in meta.behavioral (Phase 2)", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        target_company: "Amazon",
        transcript: [
          ai("Tell me about a project."),
          user(
            "I owned the checkout migration end-to-end. I talked to merchants weekly to validate the redesign. We shipped on time and reduced p99 latency by 40%.",
          ),
          ai("Another?"),
          user(
            "I drove cross-team alignment on the logging schema. I rebuilt trust with platform after a missed handoff. We delivered the rollout in six weeks and cut on-call paging by 30%.",
          ),
        ],
      }),
    });
    const meta = out.meta?.behavioral;
    expect(meta?.topCompetencies?.length).toBeGreaterThanOrEqual(2);
    expect(meta?.competencyCounts?.["ownership"]).toBeGreaterThanOrEqual(2);
    expect(meta?.competencyCounts?.["deliver-results"]).toBeGreaterThanOrEqual(1);
    // Per-answer competencies surface on the breakdown rows too.
    const firstAnswerBreakdown = meta?.starBreakdown?.[0];
    expect(firstAnswerBreakdown?.competencies).toContain("ownership");
  });

  it("Amazon track weighting prefers Amazon-aligned competencies", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        target_company: "Amazon",
        transcript: [
          ai("One example."),
          user(
            "I dug into the metrics and root-caused the latency issue. I owned the fix and we shipped within a week. The data showed a 60% reduction in p99.",
          ),
          ai("Another example."),
          user(
            "I made the case for a longer-term migration plan. We invested in a 3-year roadmap. I drove cross-team alignment over six months.",
          ),
        ],
      }),
    });
    const top = out.meta?.behavioral?.topCompetencies || [];
    // Ownership, dive-deep, think-big are all Amazon LPs and should rank.
    expect(top.length).toBeGreaterThanOrEqual(2);
    const amazonAligned = ["ownership", "dive-deep", "think-big", "deliver-results"];
    const overlap = top.filter((c) => amazonAligned.includes(c));
    expect(overlap.length).toBeGreaterThanOrEqual(2);
  });

  it("surfaces a positive coaching anchor when 2+ competencies are demonstrated", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Tell me about a project."),
          user(
            "I owned the redesign. I talked to users every week. We shipped on time and reduced churn by 20%.",
          ),
          ai("Another?"),
          user(
            "I drove the migration. I dogfooded the new system for a month. We delivered it in eight weeks.",
          ),
        ],
      }),
    });
    expect(out.coachingNotes.toLowerCase()).toMatch(/strong signals|anchor/);
  });

  it("ignores micro-replies (yes/ok) when scoring STAR completeness", async () => {
    const out = await behavioralAnalyzer.analyze({
      session: session({
        transcript: [
          ai("Ready?"),
          user("Yes."),
          ai("Tell me about a project."),
          user("The situation was a scaling crisis. My task was to design a fix. I built a sharded queue. The result: 10x throughput in 4 weeks."),
        ],
      }),
    });
    expect(out.flags).not.toContain("weak_star_structure");
  });
});
