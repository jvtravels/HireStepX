/* Shared types for the per-focus session analyzer pipeline.
 *
 * Every analyzer produces the same AnalyzerResult shape so the cron,
 * dashboard, and DB schema don't care which one ran. To add a new
 * focus, implement FocusAnalyzer and register it in _dispatch.ts.
 */

export type SessionFocus =
  | "behavioral"
  | "technical"
  | "system-design"
  | "strategic"
  | "case-study"
  | "salary-negotiation"
  | "panel"
  | "campus-placement"
  | "hr-round"
  | "management"
  | "government-psu"
  | "unknown";

export interface TranscriptTurn {
  speaker: string;        // "ai" | "user" | "AI" | "User" — caller-defined
  text: string;
  time: string;
}

export interface SessionRowForAnalysis {
  id: string;
  user_id: string;
  type: string;           // raw value from sessions.type
  focus: string;
  difficulty: string;
  score: number;
  questions: number;
  duration: number;
  transcript: TranscriptTurn[];
  ai_feedback: string;
  skill_scores: Record<string, number> | null;
  job_description: string | null;
  jd_analysis: Record<string, unknown> | null;
  resume_version_id: string | null;
  created_at: string;
  target_role?: string | null;
  target_company?: string | null;
}

export interface Hallucination {
  turn_idx: number;
  type: string;           // e.g. "fake_comp_band" | "ai_invented_resume_fact"
  evidence: string;       // verbatim quote, ≤300 chars
  severity: "low" | "medium" | "high";
}

export interface RubricGap {
  dimension: string;      // e.g. "result_quantification"
  expected: string;
  observed: string;
  severity: "low" | "medium" | "high";
}

export interface BadQuestion {
  turn_idx: number;
  reason: string;         // e.g. "leaked_answer" | "ambiguous"
  evidence: string;
}

export interface AnalyzerResult {
  rescore: number | null;       // null when analyzer didn't run an LLM rescore
  scoreDrift: number | null;
  hallucinations: Hallucination[];
  rubricGaps: RubricGap[];
  badQuestions: BadQuestion[];
  flags: string[];              // tags for filtering/aggregation
  coachingNotes: string;
}

export interface AnalyzerInput {
  session: SessionRowForAnalysis;
}

export interface FocusAnalyzer {
  focus: SessionFocus;
  version: string;              // e.g. "behavioral-v1" — bump on rubric change
  analyze(input: AnalyzerInput): Promise<AnalyzerResult>;
}

export function emptyResult(): AnalyzerResult {
  return {
    rescore: null,
    scoreDrift: null,
    hallucinations: [],
    rubricGaps: [],
    badQuestions: [],
    flags: [],
    coachingNotes: "",
  };
}
