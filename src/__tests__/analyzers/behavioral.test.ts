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
