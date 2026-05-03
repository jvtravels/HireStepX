/* HireStepX — Salary-negotiation state helpers
 *
 * Two pure functions extracted from useInterviewEngine.ts so the
 * negotiation logic doesn't sprawl through the engine. Both are pure:
 * no React, no DOM. Negotiation is the most idiosyncratic interview
 * type — its state machine + phase model deserve their own module.
 *
 * pickInitialNegotiationStyle — chooses cooperative / defensive /
 *   aggressive based on the candidate's last 3 negotiation scores.
 *   Low scores → cooperative (easier to practice against), high
 *   scores → aggressive (harder, more realistic). Falls back to
 *   random if there's no history or localStorage is blocked.
 *
 * computeNegotiationPhase — maps a candidate's position in the
 *   question script (as a ratio) onto a 6-phase negotiation arc:
 *     offer-reaction → probe-expectations → counter-offer →
 *     benefits-discussion → closing-pressure → closing
 *   Uses the ratio (not absolute index) so the mapping stays
 *   correct when follow-ups dynamically change the question count
 *   mid-interview.
 */

export type NegotiationStyle = "cooperative" | "defensive" | "aggressive";

export const NEGOTIATION_PHASES = [
  "offer-reaction",
  "probe-expectations",
  "counter-offer",
  "benefits-discussion",
  "closing-pressure",
  "closing",
] as const;
export type NegotiationPhase = typeof NEGOTIATION_PHASES[number];

interface SessionRecord { type?: string; score?: number }

/** Decide the AI's negotiation tone for this session. Reads recent
 *  history from localStorage; safe in Safari private mode. */
export function pickInitialNegotiationStyle(
  interviewType: string,
  /* Storage is injected so tests don't need a jsdom global. The
     engine just passes `() => localStorage`. */
  getStorage: () => Storage | undefined = () => (typeof localStorage !== "undefined" ? localStorage : undefined),
): NegotiationStyle | undefined {
  if (interviewType !== "salary-negotiation") return undefined;
  try {
    const storage = getStorage();
    const raw = storage?.getItem("hirestepx_sessions");
    if (raw) {
      const sessions = JSON.parse(raw) as SessionRecord[];
      const negSessions = sessions.filter(s => s.type === "salary-negotiation" && typeof s.score === "number");
      if (negSessions.length > 0) {
        const sample = negSessions.slice(0, 3);
        const avgScore = sample.reduce((sum, s) => sum + (s.score || 0), 0) / sample.length;
        if (avgScore >= 78) return "aggressive";
        if (avgScore >= 65) return "defensive";
        return "cooperative";
      }
    }
  } catch { /* localStorage access failed — fall through to random */ }
  const styles: NegotiationStyle[] = ["cooperative", "aggressive", "defensive"];
  return styles[Math.floor(Math.random() * styles.length)];
}

/** Map current position in the script onto the 6-phase negotiation arc.
 *  Returns undefined for non-negotiation interviews so callers can short-circuit. */
export function computeNegotiationPhase(input: {
  interviewType: string;
  currentStep: number;
  scriptStepTypes: string[];
}): NegotiationPhase | undefined {
  const { interviewType, currentStep, scriptStepTypes } = input;
  if (interviewType !== "salary-negotiation") return undefined;
  const isQuestionLike = (t: string) => t === "question" || t === "follow-up";
  const totalQs = scriptStepTypes.filter(isQuestionLike).length;
  const currentQIdx = scriptStepTypes.slice(0, currentStep + 1).filter(isQuestionLike).length;
  /* Edge case: single question → jump straight to closing (matches
     the original engine behaviour). Otherwise interpolate by ratio. */
  const ratio = totalQs > 1 ? (currentQIdx - 1) / (totalQs - 1) : 1;
  const phaseIdx = Math.min(
    Math.max(0, Math.round(ratio * (NEGOTIATION_PHASES.length - 1))),
    NEGOTIATION_PHASES.length - 1,
  );
  return NEGOTIATION_PHASES[phaseIdx];
}
