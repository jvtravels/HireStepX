import { c } from "./tokens";

export type UserContext = { targetRole?: string; targetCompany?: string; industry?: string; interviewDate?: string; practiceTimestamps?: string[]; subscriptionTier?: string; subscriptionEnd?: string } | null;

/* Plain-language coaching pair surfaced on the dashboard session card.
   Produced by the evaluate-session LLM (see _evaluate-session-helpers
   `normalizeCoaching`) and persisted inside `sessions.report_json`. Optional
   everywhere downstream: pre-mvp-8 rows have no coaching, so the card falls
   back to the legacy topStrength/topWeakness one-liners. */
/* The evaluator schema version the client currently understands. Must
   stay in lockstep with REPORT_VERSION in server-handlers/evaluate-session.ts
   — when the server bumps it, bump this too in the same commit so cached
   rows below the new version fall through to a re-evaluation instead of
   hydrating a stale shape. */
export const CLIENT_REPORT_VERSION = "mvp-8";

export interface SessionCoaching {
  strength: { headline: string; meaning: string };
  gap: { headline: string; meaning: string; example: string };
}

export interface DashboardSession {
  id: string;
  date: string;
  dateLabel: string;
  type: string;
  role: string;
  score: number;
  change: number;
  duration: string;
  difficulty?: string;
  /* Setup metadata used by the per-question feedback aggregator
     (active-learning loop). The session row in Supabase already stores
     these; making them optional here lets older dashboard list mappers
     keep working while the report view passes them through to
     QuestionCard for the thumbs-feedback payload. */
  company?: string;
  focus?: string;
  topStrength: string;
  topWeakness: string;
  /** Structured plain-language coaching from the evaluator (mvp-8+).
   *  Undefined for older sessions → card falls back to topStrength/
   *  topWeakness one-liners. */
  coaching?: SessionCoaching;
  /** Persisted evaluator output (full report) + the version that wrote
   *  it. Surfacing both lets `SessionReport` hydrate from cache without
   *  calling /api/evaluate-session at all when the row is current. Typed
   *  as unknown because the canonical SessionReport interface lives in
   *  dashboardData.ts — the report layer casts on entry. */
  cachedReport?: unknown;
  cachedReportVersion?: string;
  feedback: string;
  transcript: { speaker: string; text: string; scoreNote?: string }[];
  questionScores: { question: string; score: number; notes: string }[];
  /** Kernel-aware negotiation metrics — populated for salary-neg
   *  sessions that ran through /api/negotiate-turn. Surfaced in the
   *  report's "Negotiation Quality" card. */
  negotiationMetrics?: {
    outcome: "accepted" | "walked-away" | "stalemate" | "in-progress";
    anchorTurn: number | null;
    leverDiversity: number;
    lpaGained: number;
    lpaPerTurn: number;
    bandTraversal: number | null;
    overBandViolation: boolean;
    totalTurns: number;
    score: number;
    /* Optional kernel signals — added in a later ship. Optional so old
       rows persisted without them deserialize cleanly. */
    vossTacticsUsed?: ReadonlyArray<string>;
    infoAsked?: ReadonlyArray<string>;
    walkAwayReturned?: boolean;
    hardBandCap?: boolean;
    marketMode?: "soft" | "neutral" | "hot";
    /* Calibrated-surprise lowball event — pre-computed upstream from
       the kernel's finalState via buildLowballEvent. Optional so old
       rows persisted without it deserialize cleanly. */
    lowballEvent?: {
      candidateAnchor: number;
      bandFloor: number;
      gapPct: number;
      recruiterProbed: boolean;
      candidateHeld: boolean;
    };
    /* Recruiter-power-dynamics feature (2026-05-29) — caller-declared
       external pressure context. Optional so old rows persisted without
       it deserialize cleanly. */
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
}

export interface SkillData {
  name: string;
  score: number;
  prev: number;
  color: string;
}

export interface TrendPoint {
  score: number;
  date: string;
  type: string;
}

export interface InterviewEvent {
  id: string;
  title: string;
  company: string;
  type: string;
  date: string;
  time: string;
  duration: number;
  location: string;
  notes: string;
  status: "upcoming" | "completed" | "cancelled";
  reminders: boolean;
}

export interface PersistedState {
  hasCompletedFirstSession: boolean;
  dismissedNotifs: number[];
  userName: string;
  targetRole: string;
  resumeFileName: string | null;
  interviewDate: string;
  defaultDifficulty?: string;
  emailNotifs?: boolean;
  streakReminder?: boolean;
  weeklyDigest?: boolean;
}

export const sessionTypes = ["All", "Behavioral", "Strategic", "Technical Leadership", "Case Study", "Campus Placement", "HR Round", "Management", "Government & PSU"];

export function scoreLabel(score: number) {
  if (score >= 85) return "Strong";
  if (score >= 75) return "Good";
  return "Needs work";
}

export function scoreLabelColor(score: number) {
  if (score >= 85) return c.sage;
  if (score >= 75) return c.gilt;
  return c.ember;
}
