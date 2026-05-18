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
  /** Optional source-flag tag — populated when this gap was emitted
   *  alongside a specific `flags.add(...)` so downstream views (e.g.
   *  CredibilitySection) can do an exact lookup instead of regex-
   *  matching on `expected`/`observed` text. Today only the HR-round
   *  resume cross-checks (v4.2 / v4.3) and the campus-placement
   *  resume cross-checks set this. Existing untagged gaps continue
   *  to work — the field is opt-in. */
  flag?: string;
}

export interface BadQuestion {
  turn_idx: number;
  reason: string;         // e.g. "leaked_answer" | "ambiguous"
  evidence: string;
}

/* Per-focus structured metadata surfaced alongside the standard
 * analyzer outputs. Each focus owns one optional sub-key; callers
 * read defensively (`meta?.campusPlacement?.…`) because older cached
 * insights predate this field. New foci append a new optional sub-
 * key here rather than overloading flags / rubricGaps with rendering
 * hints. */
export interface AnalyzerMeta {
  /** Behavioral: per-answer STAR breakdown so the report can render
   *  a turn-by-turn ✓S ✓T ✓A ✗R matrix instead of just an aggregate
   *  completion rate. `quantified` reflects whether the answer paired
   *  a number with a result verb ("reduced X by 40%") — distinct from
   *  incidental numerics ("I worked 5 days a week"). */
  behavioral?: {
    starBreakdown: Array<{
      turn_idx: number;
      present: Array<"S" | "T" | "A" | "R">;
      missing: Array<"S" | "T" | "A" | "R">;
      text_preview: string;
      quantified: boolean;
    }>;
  };
  /** Campus-placement: tier-aware CGPA calibration the analyzer used.
   *  Surfaced in the report so the candidate sees the actual cutoff
   *  they were graded against — not a guessed one. */
  campusPlacement?: {
    companyTier: string;          // e.g. "service" | "product-india" | "product-global" | "unknown"
    collegeTier: string;          // e.g. "tier-1" | "tier-2" | "unknown"
    baseCgpaCutoff: number;       // pre-adjustment, per company tier
    adjustedCgpaCutoff: number;   // after collegeTier adjustment
    statedCgpa: number | null;    // CGPA the candidate said aloud, if any
    targetCompany?: string | null;
  };
}

export interface AnalyzerResult {
  rescore: number | null;       // null when analyzer didn't run an LLM rescore
  scoreDrift: number | null;
  hallucinations: Hallucination[];
  rubricGaps: RubricGap[];
  badQuestions: BadQuestion[];
  flags: string[];              // tags for filtering/aggregation
  coachingNotes: string;
  /** Optional structured metadata — see AnalyzerMeta. Older insight
   *  rows in the DB won't have this; render defensively. */
  meta?: AnalyzerMeta;
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
  /** CGPA / percentage as string, e.g. "8.2" or "84". Used by the
   *  campus-placement analyzer to cross-check verbal CGPA claims. */
  cgpa?: string;
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
