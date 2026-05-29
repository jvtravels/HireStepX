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
      /** Competencies demonstrated in this specific answer
       *  (see _behavioral-competencies.ts). Empty array when no
       *  behavioural markers matched — the answer may still be a
       *  strong STAR but didn't paint a recognisable competency. */
      competencies?: string[];
    }>;
    /** Aggregate frequency of each competency across the session.
     *  Used by the report to rank "top demonstrated" — three
     *  ownership stories beat one customer-obsession story. */
    competencyCounts?: Record<string, number>;
    /** The top N competencies for the candidate's target track,
     *  pre-ranked so the UI doesn't need to know the weighting
     *  rules. Empty array when no competency hits at all. */
    topCompetencies?: string[];
    /** Phase-3: probing-depth signal counts collected across the
     *  session. Populated only when at least one user answer / AI
     *  follow-up pair was scanned. Older insight rows won't have
     *  this — render defensively. */
    probing?: {
      aiProbedDepth: number;
      aiProbedOwnership: number;
      aiAcceptedVague: number;
      learningReflections: number;
      failureQuestionAsked: boolean;
      /** Failure-response classification on the user's first answer
       *  to a failure-style AI question. `null` when no failure
       *  question was asked, or no substantive user response. */
      failureResponse: "owns" | "deflects" | "neutral" | null;
      /** Did the captured failure response name a concrete thing the
       *  candidate missed (a system / assumption / stakeholder), or
       *  just generic "I made a mistake" ownership? `null` when no
       *  failure response was captured. Drives the
       *  `weak_specificity_in_failure_story` flag. */
      failureResponseHadConcreteMiss?: boolean | null;
    };
    /** Phase-6.3: evidence-quality counters. Tracks how many user
     *  answers quoted a metric, how many of those metrics floated
     *  without baseline / method / sample within the proximity
     *  window, and how many times the next AI turn rolled past
     *  without probing for evidence. Populated only when at least
     *  one metric-bearing user answer was scanned. */
    evidence?: {
      metricAnswersCount: number;
      metricAnswersUnevidenced: number;
      aiAcceptedUnevidencedMetric: number;
    };
    /** Delivery-pattern counters: rehearsed-opener hits, hedge-density
     *  hits, and rambling-answer hits. Each aggregates to a session-
     *  level pattern flag at threshold (see BEHAVIORAL_THRESHOLDS).
     *  Surfaced in the report so the candidate sees the absolute count,
     *  not just the flag presence. */
    delivery?: {
      rehearsedOpenerHits: number;
      lowConvictionHits: number;
      ramblingHits: number;
    };
    /** Conflict-narrative counters: how many conflict / disagreement-
     *  shaped questions the AI asked, and how many of the candidate's
     *  responses ran one-sided (no counterparty-POV framing). Fires the
     *  `one_sided_conflict_narrative` flag at threshold so the next
     *  session's prebias steers toward stems that demand the other
     *  side's position up front. */
    conflict?: {
      conflictQuestionsAsked: number;
      oneSidedConflictHits: number;
    };
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
    /** Phase-3 campus archetype — finer than companyTier. One of
     *  "tcs-ninja" | "tcs-digital" | "wipro-nlth" | "top-tier-campus"
     *  | "unknown". Drives the archetype-specific CGPA cutoff above
     *  and the report chip label. */
    archetype?: string;
    archetypeLabel?: string;
    /** v6.6 — how many times the AI probed bond / service-agreement.
     *  The `bond_unprepared` flag now gates on ≥2 probes (a single
     *  probe + "I don't know" is often just surprise, not unresearch). */
    bondProbeCount?: number;
    /** v6.6 — what kind of aptitude probe the recruiter at this
     *  archetype would have asked. Lets the LLM evaluator grade whether
     *  the generated probe matched the rubric.
     *    "cognitive-coding" — TCS / Infosys (SQL, strings, hashmap)
     *    "classical-puzzle" — Wipro NLTH / Cognizant (8 balls, switches)
     *    "none"             — top-tier-campus skips aptitude
     *    "either"           — archetype unknown */
    aptitudeProbeExpectedType?: "cognitive-coding" | "classical-puzzle" | "none" | "either";
  };
  /** Salary-negotiation: tier-aware scoring band + CTC take-home
   *  breakdown the analyzer used. Surfaced in the report header so the
   *  candidate sees which compensation band they were graded against,
   *  and on the offer card so they see in-hand monthly under both tax
   *  regimes. Populated only when the session has a closing offer +
   *  target_role; old insight rows render the report without it. */
  salaryNegotiation?: {
    /** Canonical bucket label, e.g. "FAANG / Big-Tech / GCC", "Indian
     *  unicorn", "Early-stage startup". Stable strings — UI displays
     *  verbatim. `undefined` when company isn't recognised. */
    tierBucket?:
      | "listed_big_tech"
      | "listed_unicorn"
      | "mature_unicorn"
      | "growth_startup"
      | "early_startup"
      | "it_services"
      | "bfsi"
      | "fmcg"
      | "psu";
    tierBucketLabel?: string;
    /** Closing offer total CTC (LPA) — the number used for the
     *  take-home computation below. Null when no offer was extracted. */
    closingTotalLpa?: number | null;
    /** In-hand monthly (₹) under both regimes for the closing offer.
     *  Null when no offer was extracted. */
    monthlyTakeHomeNewRegimeInr?: number | null;
    monthlyTakeHomeOldRegimeInr?: number | null;
    /** Annual tax under each regime (LPA). Used by the UI to render the
     *  "₹X.X LPA tax under new regime" hint line. */
    annualTaxNewRegimeLpa?: number | null;
    annualTaxOldRegimeLpa?: number | null;
    /** Phase 2.1 — Equity literacy. Populated only when an equity grant
     *  was named in the transcript with an extractable face value.
     *  Cliff/half/full-vest are computed at the helper's defaults
     *  (4-yr / 1-yr cliff; RSU = 100% liquidity, ESOP = 30%). */
    equityLiteracy?: {
      grantTotalLpa: number;
      equityType: "rsu" | "esop";
      cliffRealisticLpa: number;
      halfVestRealisticLpa: number;
      fullVestRealisticLpa: number;
      perquisiteTaxAtFullVestLpa: number;
      netAfterTaxLpa: number;
      realisticPctOfFace: number;
    } | null;
    /** Phase 2.2 — BATNA strength score (0..1) + label. Computed even
     *  when no competing offers detected (label = "none", score = 0)
     *  so the report card always has something to render once the
     *  candidate triggers BATNA-mention. */
    batnaStrength?: {
      score: number;
      label: "none" | "weak" | "moderate" | "strong";
      rationale: string;
      offerCount: number;
    } | null;
    /** Phase 3 — Indian recruiter SECTOR persona resolved from the
     *  tier bucket. Stable string set; UI renders a chip next to the
     *  tier band chip. Realism-Audit Fix 1 (2026-05-22) adds `psu`,
     *  `consulting-big4`, and `fmcg-management` so PSU + FMCG sessions
     *  no longer fall through to `default`. */
    recruiterPersona?:
      | "it-services"
      | "gcc"
      | "indian-unicorn"
      | "early-startup"
      | "bfsi"
      | "psu"
      | "consulting-big4"
      | "fmcg-management"
      | "edtech"
      | "consulting-mbb"
      | "default";
    recruiterPersonaLabel?: string;
    /** Phase 5 Session B (2026-05-19) — multi-round signals. Inferred
     *  from transcript-side handoff prose (analyzer doesn't see kernel
     *  state directly). `multiRoundEnabled` reflects whether ANY
     *  handoff prose was detected. `roundsCompleted` is the count of
     *  personas in the trajectory (1..3). `roundPersonaTrajectory`
     *  is the ordered tuple of personas the session passed through. */
    multiRoundEnabled?: boolean;
    roundsCompleted?: number;
    roundPersonaTrajectory?: Array<"hr-partner" | "hiring-manager" | "director">;
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
