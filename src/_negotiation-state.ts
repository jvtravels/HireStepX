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

/** The authoritative numeric core every negotiate-turn response carries on
 *  its serialized kernel `state.band`. The kernel is the documented source
 *  of truth ("kernel-first"): it negotiates against the tier-clamped band
 *  resolved server-side by `resolveServerBand` + `clampBandToTierP50`. */
export interface KernelBandCore {
  initialOffer: number;
  maxStretch: number;
  walkAway: number;
  hasEquity?: boolean;
}

/** Shape the report (DealSummaryCard) + live dashboard read. Mirrors
 *  interviewAPI.NegotiationBandData structurally; kept local to avoid a
 *  hook→API import cycle in the pure layer. */
export interface ReportBand {
  initialOffer: number;
  minOffer: number;
  maxStretch: number;
  walkAway: number;
  joiningBonusRange: [number, number];
  hasEquity: boolean;
  equityRange: [number, number];
  bandContext: string;
}

/** Narrow an unknown parsed-JSON `state.band` to a KernelBandCore.
 *  Returns null unless the three load-bearing numbers are finite — so a
 *  shape change in the serialized state can never silently feed NaN/garbage
 *  into the report band. */
export function extractKernelBand(parsedBand: unknown): KernelBandCore | null {
  if (parsedBand == null || typeof parsedBand !== "object") return null;
  const b = parsedBand as Record<string, unknown>;
  const initialOffer = b.initialOffer;
  const maxStretch = b.maxStretch;
  const walkAway = b.walkAway;
  if (
    typeof initialOffer !== "number" || !Number.isFinite(initialOffer) ||
    typeof maxStretch !== "number" || !Number.isFinite(maxStretch) ||
    typeof walkAway !== "number" || !Number.isFinite(walkAway)
  ) {
    return null;
  }
  return {
    initialOffer,
    maxStretch,
    walkAway,
    hasEquity: typeof b.hasEquity === "boolean" ? b.hasEquity : undefined,
  };
}

/** STRUCTURAL FIX (2026-06-18) — Deal Summary band/package inflation.
 *
 * Two band pipelines used to diverge: `generate-questions` returned the
 * UNCLAMPED `generateNegotiationBand` band to the client (stored in
 * `negotiationBandRef`, the report's source), while `negotiate-turn`
 * negotiated against the tier-CLAMPED kernel band. The report then showed
 * a number (e.g. ₹80.9 LPA) that the bot never actually offered (it
 * negotiated on ₹41.4 LPA), and "band captured" rendered 0%.
 *
 * The drift-proof fix is kernel-first: once the kernel exists, adopt ITS
 * authoritative band for the report. This merges the kernel's load-bearing
 * numbers over the descriptive metadata the resolver supplied (bonus/equity
 * ranges, context blurb), and pins `minOffer` so it can never exceed the
 * new (lower) initialOffer. Idempotent — re-applying the same kernel band
 * is a no-op. */
export function adoptKernelBand(
  existing: ReportBand | null | undefined,
  kernel: KernelBandCore,
): ReportBand {
  const hasEquity = kernel.hasEquity ?? existing?.hasEquity ?? false;
  return {
    initialOffer: kernel.initialOffer,
    maxStretch: kernel.maxStretch,
    walkAway: kernel.walkAway,
    /* Keep the floor coherent with the (possibly lowered) initial offer.
       A stale descriptive minOffer above the kernel initial would read as
       "the company's minimum is higher than its opening offer". */
    minOffer: existing
      ? Math.min(existing.minOffer, kernel.initialOffer)
      : kernel.walkAway,
    hasEquity,
    joiningBonusRange: existing?.joiningBonusRange ?? [0, 0],
    equityRange: hasEquity ? (existing?.equityRange ?? [0, 0]) : [0, 0],
    bandContext: existing?.bandContext ?? "",
  };
}
