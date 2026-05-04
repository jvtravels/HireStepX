/* Session Report V2 — view-model types.
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
}
