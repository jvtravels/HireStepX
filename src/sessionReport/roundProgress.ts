import { EVIDENCE_VERIFY_MIN_SESSIONS, EVIDENCE_VERIFY_THRESHOLD } from "../evidenceCapabilities";
import { ROUNDS, roundOf } from "../focusRounds";

export interface RoundProgress {
  label: string;
  qualifying: number;
  needed: number;
  cleared: boolean;
  viewedScore: number;
  viewedQualifies: boolean;
  threshold: number;
  required: number;
  /** Sessions the count is based on. The trend only holds the latest 10. */
  window: number;
}

interface TrendPoint {
  id: string;
  score: number;
}

/** Progress toward clearing this session's round, as of the viewed session.
 *  Null when the trend can't be trusted: no focus (the trend then mixes rounds)
 *  or the viewed session isn't in it. */
export function buildRoundProgress(
  session: { id: string; type?: string | null; focus?: string | null },
  trend: readonly TrendPoint[],
): RoundProgress | null {
  const key = roundOf(session);
  if (!key || !session.focus) return null;
  const viewedIdx = trend.findIndex((p) => p.id === session.id);
  if (viewedIdx < 0) return null;
  const upTo = trend.slice(0, viewedIdx + 1);
  const viewedScore = upTo[upTo.length - 1].score;
  const qualifying = upTo.filter((p) => p.score >= EVIDENCE_VERIFY_THRESHOLD).length;
  const needed = Math.max(0, EVIDENCE_VERIFY_MIN_SESSIONS - qualifying);
  return {
    label: ROUNDS.find((r) => r.key === key)?.label ?? "This round",
    qualifying,
    needed,
    cleared: needed === 0,
    viewedScore,
    viewedQualifies: viewedScore >= EVIDENCE_VERIFY_THRESHOLD,
    threshold: EVIDENCE_VERIFY_THRESHOLD,
    required: EVIDENCE_VERIFY_MIN_SESSIONS,
    window: upTo.length,
  };
}

export function roundProgressHeadline(p: RoundProgress): string {
  if (p.cleared) return `${p.label} round cleared`;
  const more = p.needed === 1 ? "1 more session" : `${p.needed} more sessions`;
  return `${more} at ${p.threshold}+ to clear ${p.label}`;
}

export function roundProgressDetail(p: RoundProgress): string {
  const counted = `${Math.min(p.qualifying, p.required)} of ${p.required} sessions at ${p.threshold}+`;
  const scope = p.window >= 10 ? "in your latest 10" : "so far";
  if (p.cleared) return `${counted} ${scope}.`;
  const result = p.viewedQualifies
    ? "This session counts."
    : `This session scored ${p.viewedScore}, so it does not count yet.`;
  return `${result} ${counted} ${scope}.`;
}
