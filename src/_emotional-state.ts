/* HireStepX — Emotional-state derivation for the follow-up LLM
 *
 * Pure function — turns the candidate's last few user turns into a
 * coarse {stress, engagement, fillerDensity, lengthTrend} signal. The
 * server-side follow-up handler reads this and modulates tone (warm
 * vs neutral vs probing). Independent of question difficulty, which
 * is governed by adaptiveDifficulty (a separate signal).
 *
 * Lives in its own file so it's testable without spinning up the
 * engine. See src/__tests__/emotionalState.test.ts.
 */

const FILLER = /\b(um+|uh+|like|basically|actually|sort of|kind of|you know|i mean)\b/gi;
const HESITATION = /\b(hmm+|er+|umm+|let me think|let me see|how do i say)\b/gi;

export interface CandidateState {
  stress: "low" | "medium" | "high";
  engagement: "engaged" | "fading" | "disengaged";
  fillerDensity: number;
  lengthTrend: "shortening" | "stable" | "growing";
}

/**
 * Derive emotional-state signals from the user's recent answers.
 *
 * @param recentUserTurns — last N user-spoken texts (current answer last).
 *                          Pass [] / undefined and you'll get undefined back
 *                          to keep call sites simple.
 *
 * Heuristics:
 *   - Stress (high) → ≥3 hesitation markers in the window
 *     (medium) → ≥1 hesitation OR filler density > 6%
 *   - Engagement (disengaged) → answer shrinking AND <20 words
 *     (fading) → answer shrinking trend (latest < 0.6× earlier avg)
 *   - lengthTrend → latest answer length vs earlier-window mean
 */
export function deriveCandidateState(recentUserTurns: string[]): CandidateState | undefined {
  if (!recentUserTurns || recentUserTurns.length === 0) return undefined;
  const window = recentUserTurns.slice(-3);
  const lengths = window.map(t => t.split(/\s+/).filter(Boolean).length);
  const fillerCounts = window.map(t => (t.match(FILLER) || []).length);
  const hesitationCounts = window.map(t => (t.match(HESITATION) || []).length);
  const totalWords = lengths.reduce((a, b) => a + b, 0);
  const totalFillers = fillerCounts.reduce((a, b) => a + b, 0);
  const totalHesitations = hesitationCounts.reduce((a, b) => a + b, 0);

  const latestLen = lengths[lengths.length - 1];
  const earlierAvgLen = lengths.length >= 2
    ? lengths.slice(0, -1).reduce((a, b) => a + b, 0) / (lengths.length - 1)
    : latestLen;

  const lengthTrend: CandidateState["lengthTrend"] =
    latestLen < earlierAvgLen * 0.6 ? "shortening"
    : latestLen > earlierAvgLen * 1.4 ? "growing"
    : "stable";

  const fillerDensity = totalWords > 0 ? totalFillers / totalWords : 0;

  const stress: CandidateState["stress"] =
    totalHesitations >= 3 ? "high"
    : totalHesitations >= 1 || fillerDensity > 0.06 ? "medium"
    : "low";

  const engagement: CandidateState["engagement"] =
    lengthTrend === "shortening" && latestLen < 20 ? "disengaged"
    : lengthTrend === "shortening" ? "fading"
    : "engaged";

  return {
    stress,
    engagement,
    fillerDensity: Math.round(fillerDensity * 100) / 100,
    lengthTrend,
  };
}
