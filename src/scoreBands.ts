/* One score-to-band mapping for every list, card and ring that labels a
 * session score. The report's recruiter verdict ("Hire Signal", "Lean Hire")
 * is a separate concept and keeps its own vocabulary. */

export type ScoreBandKey = "strong" | "good" | "needsWork";

export const STRONG_MIN = 85;
export const GOOD_MIN = 75;

export const SCORE_BAND_LABEL: Record<ScoreBandKey, string> = {
  strong: "Strong",
  good: "Good",
  needsWork: "Needs work",
};

export const SCORE_BAND_TIP: Record<ScoreBandKey, string> = {
  strong: "Strong: Interview-ready performance",
  good: "Good: Solid foundation, minor areas to refine",
  needsWork: "Needs work: Key areas need practice before interviews",
};

export function scoreBandKey(score: number): ScoreBandKey {
  if (score >= STRONG_MIN) return "strong";
  if (score >= GOOD_MIN) return "good";
  return "needsWork";
}
