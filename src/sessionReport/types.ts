/* Session Report — view-model types.
   These are the props the view component consumes. Distinct from the
   `SessionReport` schema in `dashboardData.ts` so the report layer can
   evolve without forcing a server-side schema bump. The adapter
   (`adapter.ts`) is the only thing that translates between them. */

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
  priorSessionCount?: number;
  crossSessionInsights?: CrossSessionInsight[];
  storyReuseFindings?: StoryReuseFinding[];
  blindSpots?: BlindSpot[];
  thoughtBubble?: ThoughtBubbleSegment[];
  readinessSentence?: string;
  /** Perception-optimizer findings — bias-pattern aggregates across the
   *  whole session. Empty / undefined = panel doesn't render. */
  biasFindings?: BiasFinding[];
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
  };
}
