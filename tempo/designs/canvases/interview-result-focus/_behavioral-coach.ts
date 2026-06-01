/* ─── Behavioral coaching templates ──────────────────────────────────
 *
 * Maps analyzer-emitted behavioral flags to coaching prose. This is the
 * single source of truth for: failure-story coach quote, conflict
 * coach line, and the one-habit-to-fix headline / rationale / prebias
 * dimension. The fixture should NOT hand-author this copy — call the
 * helpers below and let the template fill in the per-session context.
 *
 * In production this same registry is what `analyzers/behavioral.ts`
 * + `BEHAVIORAL_PRIOR_FLAG_TO_DIMENSION` feed the report from.
 */

export type BehavioralFlag =
  | "one_sided_conflict_narrative"
  | "weak_specificity_in_failure_story"
  | "we_without_i"
  | "result_missing"
  | "rambling_answers"
  | "rehearsed_answers"
  | "low_conviction_delivery"
  | "weak_star_structure";

export interface CoachCtx {
  /** Question index the flag fired on (e.g. 4 for "Q4"). */
  questionIndex?: number;
  /** Counterparty role mentioned in the answer ("VP", "PM", "TL"). */
  counterpartyRole?: string;
  /** Company tier used for rubric framing ("Razorpay-tier fintech"). */
  companyTier?: string;
  /** Persona voice used ("Hiring Manager", "Bar Raiser"...). */
  personaVoice?: string;
}

export interface OneHabit {
  headline: string;
  rationale: string;
  prebiasDimension: string;
}

interface Template {
  oneHabit: (ctx: CoachCtx) => OneHabit;
  conflictCoach?: (ctx: CoachCtx) => string;
  failureCoachQuote?: (ctx: CoachCtx) => string;
}

const persona = (ctx: CoachCtx) => ctx.personaVoice ?? "Indian HM";
const stakeholder = (ctx: CoachCtx) => ctx.counterpartyRole ?? "stakeholder";
const qref = (ctx: CoachCtx) =>
  typeof ctx.questionIndex === "number" ? `Q${ctx.questionIndex}` : "the conflict turn";

export const BEHAVIORAL_COACH: Record<BehavioralFlag, Template> = {
  one_sided_conflict_narrative: {
    oneHabit: (ctx) => ({
      headline: "Name the counterparty's view first.",
      rationale: `You skipped what the ${stakeholder(ctx)} wanted in ${qref(ctx)} before describing what you did. ${persona(ctx)}s expect that frame inside the first 15 seconds.`,
      prebiasDimension: "conflict counterparty-POV",
    }),
    conflictCoach: (ctx) =>
      `Name what ${stakeholder(ctx) === "stakeholder" ? "they" : "the " + stakeholder(ctx)} wanted before what you did. Bar-Raiser expects the counterparty frame inside the first 15 seconds.`,
  },
  weak_specificity_in_failure_story: {
    oneHabit: (ctx) => ({
      headline: "Replace abstract misses with concrete ones.",
      rationale: `In ${qref(ctx)} you owned the failure but never named the specific call you'd take back. Bar-Raiser reads "I missed an edge case" as hindsight theatre.`,
      prebiasDimension: "failure specificity",
    }),
    failureCoachQuote: () =>
      `"I missed an edge case" is hindsight theatre. Try: "I underestimated the rollback path on the migration — that's how we ended up in a 40-minute outage."`,
  },
  we_without_i: {
    oneHabit: (ctx) => ({
      headline: "Use 'I' where you actually decided.",
      rationale: `In ${qref(ctx)} the Action section read 'we' 3-to-1 over 'I'. You're being hired, not your team — name the specific decisions you owned.`,
      prebiasDimension: "ownership first-person",
    }),
  },
  result_missing: {
    oneHabit: (ctx) => ({
      headline: "Close every story with a number.",
      rationale: `${qref(ctx)} stopped before the result. ${persona(ctx)} hears 'no number, no outcome' — quantify the close even if it's a soft metric.`,
      prebiasDimension: "outcome quantification",
    }),
  },
  rambling_answers: {
    oneHabit: (ctx) => ({
      headline: "Cap STAR answers at 90 seconds.",
      rationale: `Two answers crossed 3 minutes; ${persona(ctx)}s lose the thread past 90s. Compress Situation/Task to 20s combined, hold Action to 50s, close Result in 20s.`,
      prebiasDimension: "delivery stamina",
    }),
  },
  rehearsed_answers: {
    oneHabit: (ctx) => ({
      headline: "Break the rehearsed opener.",
      rationale: `Three turns opened with the same cadence — reads as memorized. ${persona(ctx)}s probe harder when the delivery is too clean.`,
      prebiasDimension: "delivery authenticity",
    }),
  },
  low_conviction_delivery: {
    oneHabit: () => ({
      headline: "Drop hedging from claims you actually own.",
      rationale: `'I think', 'kind of', and 'sort of' showed up in 4 answers — including ones where you'd already done the work. Either you owned it or you didn't; pick one.`,
      prebiasDimension: "conviction language",
    }),
  },
  weak_star_structure: {
    oneHabit: (ctx) => ({
      headline: "Lock the STAR frame before answering.",
      rationale: `Two answers skipped Task entirely; ${persona(ctx)}s can't score what you don't frame. Spend 3 seconds naming the Task before the Action.`,
      prebiasDimension: "STAR coherence",
    }),
  },
};

/** Compose a one-habit-to-fix block from the dominant flag.
 *  Always returns something — pass the strongest flag the analyzer
 *  surfaced for the session. */
export function coachOneHabit(flag: BehavioralFlag, ctx: CoachCtx = {}): OneHabit {
  return BEHAVIORAL_COACH[flag].oneHabit(ctx);
}

export function coachConflict(ctx: CoachCtx = {}): string {
  return BEHAVIORAL_COACH.one_sided_conflict_narrative.conflictCoach!(ctx);
}

export function coachFailureQuote(ctx: CoachCtx = {}): string {
  return BEHAVIORAL_COACH.weak_specificity_in_failure_story.failureCoachQuote!(ctx);
}
