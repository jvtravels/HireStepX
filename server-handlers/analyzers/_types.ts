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

/**
 * Slim resume shape passed into analyzers. Intentionally a flattened
 * subset of `StoredResume` (the frontend discriminated union) so that
 * edge-runtime analyzer code has zero dependency on `src/`. The cron
 * loader normalizes both AI and fallback variants into this shape.
 * All fields optional so analyzers fall back gracefully when resume
 * data is absent or partial (older cached profiles, fallback misses).
 */
export interface ResumeForAnalyzer {
  /** Spelled-out degree string, e.g. "B.Tech Computer Science Engineering". */
  degree?: string;
  /** College / university name, e.g. "PES University". */
  school?: string;
  /** Graduation year as string ("2025") — kept loose for fallback parser. */
  gradYear?: string;
  /** Per-role timeline. Each entry has the company / title / period the
   *  user listed on the resume. Bullets included so cross-checks can
   *  spot project / metric drift between transcript and resume. */
  experiences?: Array<{
    title?: string;
    company?: string;
    period?: string;
    bullets?: string[];
  }>;
  /** Top skills the user advertised on the resume (chip-style list). */
  topSkills?: string[];
  /** Any URL embedded in the resume's contact / portfolio section —
   *  used to suppress `portfolio_absent_for_claim` when the candidate
   *  has obviously listed their GitHub / live-demo somewhere even if
   *  they didn't repeat it in the live answer. */
  links?: string[];
}

export interface AnalyzerInput {
  session: SessionRowForAnalysis;
  /** Optional — populated by the cron when `session.resume_version_id`
   *  resolves successfully. Analyzers should treat `undefined`,
   *  `null`, and an empty object as "no resume signal" and not crash. */
  resume?: ResumeForAnalyzer | null;
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
