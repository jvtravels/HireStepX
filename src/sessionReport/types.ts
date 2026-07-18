/* Session Report — view-model types.
   These are the props the view component consumes. Distinct from the
   `SessionReport` schema in `dashboardData.ts` so the report layer can
   evolve without forcing a server-side schema bump. The adapter
   (`adapter.ts`) is the only thing that translates between them. */

import type { HrCompanyNorms } from "../../data/hr-company-norms";

export type Verdict =
  | "strongHire"
  | "hire"
  | "leanHire"
  | "noHire"
  | "strongNoHire";

export interface DeliveryMetric {
  label: string;
  value: number;
  unit?: string;
  targetLabel: string;
  band: "good" | "ok" | "needsWork";
}

export interface Skill {
  name: string;
  score: number;
  roleAvg?: number;
}

export type HighlightKind = "filler" | "hedge" | "quantified" | "firstPerson";

export interface AnswerSpan {
  text: string;
  highlight?: HighlightKind;
}

export type RedFlagType =
  | "blame"
  | "missing_result"
  | "we_without_i"
  | "scope_drift"
  | "contradiction"
  | "vague";

export interface RedFlag {
  type: RedFlagType;
  severity: "high" | "medium" | "low";
  title: string;
  explanation: string;
  quote?: string;
}

export type LengthVerdict = "tooShort" | "justRight" | "tooLong";

export interface Question {
  index: number;
  text: string;
  score: number;
  /** S6-B4 — true when NO genuine per-turn score exists for this row (e.g. a
   *  reconstructed negotiation exchange: the evaluator scored the call as a
   *  whole, never per-turn). The per-question card then renders a neutral "—"
   *  instead of a misleading numeric score. `score` still carries a value for
   *  band derivation, but it is NOT the row's own graded score, so it must not
   *  be shown as one. */
  scoreUnavailable?: boolean;
  band: "weak" | "partial" | "strong" | "complete";
  answer: AnswerSpan[];
  restructured?: AnswerSpan[];
  topPerformerAnswer?: AnswerSpan[];
  whatMakesItStrong?: string[];
  star: {
    situation: boolean;
    task: boolean;
    action: boolean;
    result: boolean;
    learning: boolean;
  };
  metrics: {
    wordCount: number;
    responseSec: number;
    firstPersonRatioPct: number;
    quantificationCount: number;
  };
  whyScored: string;
  redFlags?: RedFlag[];
  lengthVerdict?: LengthVerdict;
  frequencyPct?: number;
  frequencyNote?: string;
  likelyFollowUp?: string;
  /** Short "good alternative" the candidate could have said — teaches by
   *  example. Surfaces as a collapsed-looking "Try this instead" block at
   *  the bottom of weak-band question cards. The `text` is the ideal
   *  short answer; `whyBetter` is a one-line rationale that frames the
   *  delta (what the alternative does that the actual answer didn't).
   *  Optional — block is omitted entirely when absent. */
  idealAnswerSnippet?: { text: string; whyBetter: string };
  /** Per-question focus-specific metric tiles. When present these replace the
   *  generic 4-tile strip (Words / Length / First-person / Quantified) with
   *  focus-aware signal (Approaches / Complexity / Edge cases / Test cases for
   *  technical, etc.). Tone uses the same enum as session-level focusMetrics:
   *  good | watch | miss | neutral. */
  focusMetrics?: Array<{ label: string; value: string; tone: "good" | "watch" | "miss" | "neutral" }>;
}

export interface CalibrationBand {
  label: string;
  minScore: number;
}

export interface Calibration {
  companyLabel: string;
  note?: string;
  bands: CalibrationBand[];
}

export interface CrossSessionInsight {
  kind: "regression" | "persistent" | "improvement";
  title: string;
  body: string;
}

export interface StoryReuseFinding {
  storyLabel: string;
  body: string;
}

export interface BlindSpot {
  title: string;
  body: string;
}

export type ThoughtBubbleState = "engaged" | "drifting" | "concerned";

export interface ThoughtBubbleSegment {
  state: ThoughtBubbleState;
  pct: number;
}

/** Bias / perception-optimizer findings — language patterns research
 *  (Anderson 2014, Linneman 2013, Hyland 1998, Jensen 2018) shows
 *  empirically disadvantage candidates in hiring rounds, especially
 *  non-native English speakers. Framed as a perception optimizer, not
 *  a judgment of the speaker. Surfaced as count chips with a
 *  representative example. Production-grade differentiator — no other
 *  AI mock-interview tool ships this. */
export type BiasKind =
  | "selfDiminutive"
  | "overApology"
  | "overHedging"
  | "uptalk";

export interface BiasFinding {
  kind: BiasKind;
  label: string;
  count: number;
  example?: string;
  suggestion: string;
}


/** Focus-aware banner shown at the top of the report — one block that
 *  instantly orients the candidate to what kind of round they just did
 *  and the single headline number that round is graded on.
 *
 *  The chrome (icon, label, tagline, accent) is a static constant per
 *  focus type. The headline metric is the first entry in the evaluator's
 *  `focusMetrics` array (already scored against the transcript); the
 *  remaining metrics are also surfaced for cross-reference. Undefined
 *  when the session has no recognized focus type or when the behavioral
 *  v2 path handles its own hero (FocusBanner is suppressed). */
export interface FocusBannerData {
  /** Emoji or short icon string, e.g. "⚙" or "💰". */
  icon: string;
  /** Short display label, e.g. "Technical Round · DSA". */
  label: string;
  /** Plain-English tagline — what the focus actually grades on. */
  tagline: string;
  /** The first (headline) focus metric from the evaluator.
   *  `caption` is a one-liner that makes the value self-explanatory — e.g.
   *  "you didn't say O(...) on either question". Optional: omitted when the
   *  evaluator didn't produce a caption or the value is a fallback "—". */
  headlineMetric: { label: string; value: string; tone: "good" | "watch" | "miss" | "neutral"; caption?: string };
  /** All focus metrics the evaluator produced (up to 3). */
  allMetrics: Array<{ label: string; value: string; tone: "good" | "watch" | "miss" | "neutral" }>;
  accent: string;
  accentSoft: string;
}

/** HR-round structured extraction passed through from the evaluator.
 *  Drives the dedicated HrFullReport panels (motivation rewrite, notice
 *  logistics, comp expectation, counter-offer risk, BGV gaps). */
export interface HrReportData {
  motivationBefore: string;
  motivationAfter: string;
  noticeDays: number | null;
  noticeFlexibility: "buyout-possible" | "strict" | "not-stated";
  compExpected: string | null;
  counterOfferRisk: "low" | "med" | "high" | "not-assessed";
  bgvGaps: string[];
  /** Sector-grounded India HR norms (notice/BGV/comp/dual-employment) for the
   *  target company's employer-type. Null when no company / unknown sector —
   *  the report falls back to generic guidance. */
  companyNorms?: HrCompanyNorms | null;
}

export interface InterviewResultData {
  overallScore: number;
  verdict: Verdict;
  scoreDelta: number;
  percentile?: number;
  recentScores?: number[];
  readiness?: { pct: number; etaWeeks: number };
  daysUntilInterview?: number;
  company: string;
  role: string;
  level: string;
  difficulty: string;
  aiVerdict: string;
  strengths: string[];
  improvements: string[];
  metrics: DeliveryMetric[];
  skills: Skill[];
  weakestSkill: { name: string; tip: string };
  questions: Question[];
  scoreConfidence?: "high" | "medium" | "low";
  scoreConfidenceNote?: string;
  calibration?: Calibration;
  /** India-context fairness applied during scoring — the non-penalty
   *  treatment of Indian-register behaviour, deterministically detected from
   *  the candidate's words. Renders under the calibration banner. Undefined /
   *  empty `notes` = the surface is hidden. */
  fairnessSignals?: { notes: string[] };
  priorSessionCount?: number;
  crossSessionInsights?: CrossSessionInsight[];
  storyReuseFindings?: StoryReuseFinding[];
  blindSpots?: BlindSpot[];
  thoughtBubble?: ThoughtBubbleSegment[];
  readinessSentence?: string;
  /** Perception-optimizer findings — bias-pattern aggregates across the
   *  whole session. Empty / undefined = panel doesn't render. */
  biasFindings?: BiasFinding[];
  /** Closing-turn reverse-interview classification — populated when the
   *  interviewer asked "any questions for us?" and we got a reply.
   *  Drives a dedicated coaching card in the behavioural report. Other
   *  interview types leave this undefined. */
  reverseInterview?: {
    verdict: "strong" | "neutral" | "weak" | "red_flag";
    counts: { green: number; yellow: number; red: number };
    classifications: Array<{ bucket: "green" | "yellow" | "red"; reason: string }>;
  };
  /** Resume improvement bullets from the AI resume analysis — shown in the
   *  Next Steps section to connect interview coaching with resume quality.
   *  Sourced from `aiProfile.improvements` (computed once at resume-upload).
   *  Undefined when no AI-parsed resume is available. */
  resumeImprovements?: string[];
  /** Focus-aware banner for the top of the report. See `FocusBannerData`.
   *  Undefined for behavioral sessions (BehavioralFullReport has its own
   *  hero) or when focus type isn't recognized. */
  focusBanner?: FocusBannerData;
  /** HR-round-specific extraction — present only for hr-round sessions.
   *  When set, HrFullReport renders and the generic panel stack is replaced. */
  hrReport?: HrReportData;
  /** Set only for salary-negotiation sessions. Contains the offer
   *  trajectory across turns + the deal outcome. Drives the
   *  NegotiationOutcomeSection in the report (offer-progression
   *  timeline + accepted-deal email template). Other interview
   *  types leave this undefined. */
  negotiationOutcome?: {
    /** Each AI offer made during the session, in order. Most-recent last. */
    offers: Array<{ turn: number; total: number; question: string }>;
    /** Final agreed total CTC if the candidate accepted. Null otherwise. */
    finalTotal: number | null;
    /** Outcome state derived from candidate's answers. */
    outcome: "accepted" | "walked_away" | "no_agreement";
    /** Highest number the candidate stated as their target. */
    candidateAsk: number | null;
    /** Percent of the gap the candidate closed between the AI's *first*
     *  offer and their own stated ask. 0 = no movement off the opening
     *  number; 100 = recruiter conceded the full ask. Null when no
     *  offers or no stated ask was extracted from the transcript.
     *
     *  HONESTY NOTE (2026-05-30): this was previously named
     *  `percentileWithinBand` and surfaced as a cohort percentile
     *  ("Bottom X% of candidates", p25/p50/p75 viz). There is no cohort
     *  dataset behind it — the number is purely intra-session gap
     *  closure. Renamed + reframed across `OfferTrajectory` and
     *  `TLDRHero`. The cohort panel was deleted. */
    gapClosurePct?: number | null;
    /** Grounded candidate-action signals lifted from the kernel final
     *  state (adoptKernelOutcome). Used by `derivePhases` to mark the
     *  middle ladder stages (justified / handled-pushback / explored-levers)
     *  reached ONLY from actions the candidate actually took — never from
     *  the recruiter's offer count (PDF#45 anti-fabrication contract).
     *  Absent for legacy transcript-heuristic rows, which then fall back to
     *  an honest "not reached" rather than an inflated stage count. */
    leverDiversity?: number;
    tacticsUsed?: ReadonlyArray<string>;
    infoAsked?: ReadonlyArray<string>;
    /** S13-B9 — subset of `infoAsked` the candidate raised on their OWN
     *  initiative (recruiter did not elicit it). `derivePhases` stage-2 ("You
     *  justified your number") keys on this so a recruiter-elicited disclosure
     *  is not miscredited as candidate-initiated justification. */
    infoAskedInitiated?: ReadonlyArray<string>;
    /** Structured pushbacks the AI made during the call. Each entry pairs
     *  an AI line with how the candidate responded (held / deflected /
     *  conceded). Drives the "When they pushed back, did you fold?" panel.
     *  Optional — backend wires this from transcript classification. */
    pushbacks?: Array<{
      pushback: string;
      outcome: "held" | "deflected" | "conceded";
      detail: string;
    }>;
    /** How the candidate framed their counter-anchor. Drives the bracket
     *  ladder panel. Optional — derivable from candidateAsk + transcript. */
    anchorBracket?: {
      type: "single" | "range" | "range_with_justification" | "none";
      quote: string;
      verdict: string;
    };
    /** Top costly verbal phrases (filler / hedge / pre-acceptance) with
     *  per-phrase counts + timestamps. Optional — needs transcript phrase
     *  classifier on the backend. */
    verbalHabits?: Array<{
      phrase: string;
      count: number;
      cost: string;
      timestamps?: string[]; // mm:ss list
    }>;
    /** Disclosure leaks (current CTC / current ESOP / etc. mentioned).
     *  Each costs the candidate anchor leverage. Optional. */
    disclosureLeaks?: Array<{ at: string; leak: string; cost: string }>;
    /** Silence moments — when the candidate held silence after a
     *  recruiter line, with healthy/filled-too-fast verdict. Needs
     *  audio analysis. Optional. */
    silenceMoments?: Array<{
      at: string;
      duration: string; // "4.2s"
      context: string;
      healthy: boolean;
    }>;
    /** S4S5-B3 — one-time joining bonus the recruiter offered (LPA).
     *  Null/absent when no joining bonus was part of the deal.
     *  Distinct from `finalTotal` (annual CTC) — used by
     *  CounterOfferLetterPanel and OfferEconomicsPanel. */
    joiningBonusLpa?: number | null;
    /** Levers the candidate didn't ask about that strong negotiators
     *  always probe — each tagged with what it's worth. Optional —
     *  backend derives from transcript-question-classifier. */
    unaskedLevers?: Array<{ question: string; whyItMatters: string }>;
    /** Counterparty intel for this specific company — flexibility points,
     *  band ranges, recent move patterns. Optional — needs company DB. */
    counterpartyFacts?: Array<{ fact: string; tone: "good" | "bad" | "neutral" }>;
    counterpartySource?: string;
    /** Cross-session archetype + the move that breaks the pattern.
     *  Optional — needs >=2 prior sessions to be meaningful. */
    archetype?: {
      title: string; // e.g. "The Pre-Acceptor"
      body: string;
      fix: string;
      /* Per-session arc on the headline metric, oldest → newest. */
      arc?: Array<{ label: string; score: number; highlight?: string }>;
      arcMetric?: string; // e.g. "Anchoring discipline"
    };
    /** Recommended drills sequenced for the next 5 days. Each links to
     *  a runnable drill via slug or external URL. Optional. */
    drills?: Array<{ slug?: string; title: string; goal: string; effort: string }>;
    /** Calibrated-surprise lowball event — populated only when the
     *  kernel fired the `calibrated-surprise-lowball` probe in response
     *  to a candidate anchor that came in significantly under the band
     *  floor. Surfaces as a coaching insight in the UnaskedLeversPanel
     *  (Part 2 — Action). Absent for every session where the probe
     *  did not fire. */
    lowballEvent?: {
      /** The LPA the candidate stated as their anchor. */
      candidateAnchor: number;
      /** The band floor (walkAway) in LPA the probe was measured against. */
      bandFloor: number;
      /** Fractional gap (e.g. 0.22 = 22% under floor). */
      gapPct: number;
      /** True when the recruiter calibrated-surprise probe actually fired
       *  — by construction the lowballEvent only exists when this is true. */
      recruiterProbed: boolean;
      /** True when the candidate doubled down after the probe (held the
       *  lowball); false when they revised up. */
      candidateHeld: boolean;
    };
    /** Recruiter-power-dynamics feature (2026-05-29) — caller-declared
     *  external pressure context for the recruiter on this call, with the
     *  derived posture / candidate-leverage labels. Absent when no signals
     *  were supplied AND no mid-session detection fired. */
    powerContext?: {
      recruiterPower: number;
      signals: {
        openReqMonths?: number;
        pipelineDepth?: number;
        quarterTiming?: "fresh-quarter" | "mid-quarter" | "quarter-end" | "annual-sprint";
        candidateHasCompetingProcess?: boolean;
      };
      posture: "strong" | "neutral" | "hungry";
      candidateLeverage: "low" | "neutral" | "high";
    };
  };

  /** Kernel-aware negotiation metrics — present only when the session
   *  ran through /api/negotiate-turn and the engine accumulated move
   *  history. Surfaced as a "Negotiation Quality" card distinct from
   *  the heuristic transcript-based negotiationOutcome above. */
  kernelMetrics?: {
    outcome: "accepted" | "walked-away" | "stalemate" | "in-progress";
    anchorTurn: number | null;
    leverDiversity: number;
    lpaGained: number;
    lpaPerTurn: number;
    bandTraversal: number | null;
    overBandViolation: boolean;
    totalTurns: number;
    score: number;
    /** The candidate's authoritative effective ask (LPA), folding a
     *  fixed-only anchor into a total-equivalent. Optional: absent on rows
     *  persisted before it was added. The panel's "Anchored at" tile uses it
     *  as the single source for did-they-anchor (L-6) — anchorTurn only carries
     *  the WHEN, and misses fixed-only anchors the turn snapshot never recorded. */
    candidateAskLpa?: number | null;
    /* Kernel tactic + intent signals. Optional because rows persisted
       before this ship landed will not have them. */
    vossTacticsUsed?: ReadonlyArray<string>;
    infoAsked?: ReadonlyArray<string>;
    /** S13-B9 — candidate-INITIATED subset of infoAsked (recruiter did not
     *  elicit it). Optional: absent on rows persisted before it shipped. */
    infoAskedInitiated?: ReadonlyArray<string>;
    walkAwayReturned?: boolean;
    hardBandCap?: boolean;
    marketMode?: "soft" | "neutral" | "hot";
    /** M2 PR-6 (2026-06-07) — family-level guardrail flag counts for
     *  the session, keyed by flag name (e.g. "pressure-repeat",
     *  "stall-cascade", "anchor-double-set"). Optional: absent when
     *  no flags fired, or for sessions persisted before the M2 PR-3
     *  taxonomy + guardrail layer landed. Drives CoachingSignalsPanel
     *  in NegotiationFullReport. */
    guardrailFlagSummary?: Record<string, number>;
  };
}

/* ─── BehavioralFullReport view-model ──────────────────────────────────
   Strongly-typed prop bag for the new diagnostic-first behavioral
   report (`src/sessionReport/BehavioralFullReport.tsx`). The adapter
   `toBehavioralFullReportData()` is the only producer; every field is
   shaped for direct render and edge-states are baked in as nullable
   sub-objects so JSX can branch with `if (failure) … else hidden`.

   Nullable cards: when the analyzer's `meta.behavioral` didn't yield
   the data the design needs (no failure Q asked, no conflict Q asked,
   too-short session, first-ever session), the corresponding sub-object
   is `null` and the component hides that card entirely. */

export interface BehavioralStarRow {
  questionId: string;        // "Q1", "Q2"…
  topic: string;             // short label, e.g. "Failure: scaled rollout"
  s: boolean;
  t: boolean;
  a: boolean;
  r: boolean;
}

export interface BehavioralFailureCard {
  ownership: boolean;
  ownershipNote: string;
  concreteMiss: boolean;
  concreteMissNote: string;
  learning: boolean;
  learningNote: string;
  coachQuote: string;
  statusLabel: string;
  statusTone: "ok" | "gap" | "neutral";
}

export interface BehavioralConflictCard {
  asked: number;
  oneSided: number;
  balanced: number;
  coachLine: string;
  jumpToQuestionIds: string[];
  statusLabel: string;
  statusTone: "ok" | "gap" | "neutral";
}

export interface BehavioralDeliveryCard {
  rehearsedHits: number;
  hedgedHits: number;
  ramblingHits: number;
  /** Per-question delivery tone segments for the timeline bar. */
  segments: Array<{ questionId: string; tone: "crisp" | "hedged" | "ramble" }>;
  coachLine: string;
  statusLabel: string;
  statusTone: "ok" | "gap" | "neutral";
}

export interface BehavioralRadarCard {
  axes: string[];
  you: number[];                // length === axes.length
  prev: number[] | null;        // null on first-ever session
  track: string;                // e.g. "Indian Product"
  summary: string;              // one-line analysis
  ups: string[];                // axis labels trending up
  downs: string[];              // axis labels trending down
  statusLabel: string;
  statusTone: "ok" | "gap" | "neutral";
}

export interface BehavioralEvidenceCard {
  metricClaims: number;
  evidenced: number;
  floating: number;
  unevidencedQuotes: string[];
  fixTechnique: string;
  statusLabel: string;
  statusTone: "ok" | "gap" | "neutral";
}

export interface BehavioralAccountability {
  depthProbes: number;
  vagueAccepted: number;
  ownershipProbes: number;
  deflected: number;
}

export interface BehavioralTranscriptRow {
  questionId: string;
  topic: string;
  pills: Array<{ label: string; tone: "ok" | "gap" | "neutral" }>;
}

export interface BehavioralPersona {
  voice: string;        // "Hiring Manager"
  tier: string;         // "Razorpay-tier fintech"
  role: string;         // "Senior PM"
  lpaBand: string;      // "₹38 LPA"
}

export interface BehavioralSessionMeta {
  number: number;       // session 04 → 4
  dateISO: string;      // "2026-06-02"
  durationMin: number;  // 28
  substantiveAnswers: number;
}

export interface BehavioralOneHabit {
  headline: string;
  rationale: string;
  prebiasDimension: string;
}

export interface BehavioralFullReportData {
  score: number;
  /** null for first-ever session — hides the delta chip in hero. */
  scoreDelta: number | null;
  verdict: string;
  /** Percentile inside the candidate's track (0..100). Nullable when
   *  we don't have a cohort yet. */
  percentile: number | null;
  track: string;
  persona: BehavioralPersona;
  sessionMeta: BehavioralSessionMeta;
  oneHabit: BehavioralOneHabit;
  /** STAR matrix rows. Empty array means too-few substantive answers —
   *  the component renders a one-line note instead of the grid. */
  starBreakdown: BehavioralStarRow[];
  /** Null when no failure question was asked — entire card hidden. */
  failure: BehavioralFailureCard | null;
  /** Null when no conflict question was asked — entire card hidden. */
  conflict: BehavioralConflictCard | null;
  delivery: BehavioralDeliveryCard;
  radar: BehavioralRadarCard;
  evidence: BehavioralEvidenceCard;
  aiAccountability: BehavioralAccountability;
  transcript: BehavioralTranscriptRow[];
  /** Sticky-footer CTA copy. Adapter softens for low scores. */
  ctaPrimaryLabel: string;
  ctaSubcopy: string;
  /** True iff this is the candidate's first behavioral session — the
   *  hero/radar render no delta chip and no ghost polygon. */
  isFirstSession: boolean;
}

