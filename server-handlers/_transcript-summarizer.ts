/* Transcript summarization for long negotiation sessions (2026-05-14).
 * ─────────────────────────────────────────────────────────────────────
 * Sessions that stretch past ~30 turns blow the Groq prompt budget if
 * we keep feeding the entire conversationLog into compactTurnBrief on
 * every turn. This module compresses the old prefix into a single
 * system turn and keeps the tail verbatim so the LLM still sees the
 * recent exchange word-for-word.
 *
 * Pure — no IO, no LLM call. The "summary" is synthesized from the
 * candidate profile snapshot and the running offer/target trail; this
 * is a structural summary, not a model-generated one. */

import type { CandidateProfileResult } from "./_candidate-profile";

export interface TranscriptTurn {
  role: "user" | "bot" | "system";
  text: string;
}

export interface SummarizeOptions {
  /** Above this turn-count we compress. Default 30 — matches the
   *  empirical p99 negotiation length (~25 turns) with headroom. */
  threshold?: number;
  /** Number of recent turns to keep verbatim. Default 10. */
  tailKeep?: number;
  /** Optional profile snapshot used to synthesize the summary line. */
  candidateProfile?: CandidateProfileResult | null;
  /** Optional running asks / offers to splice into the summary. */
  candidateTarget?: number | null;
  highestOfferMade?: number | null;
  role?: string | null;
  company?: string | null;
}

export interface SummarizeResult<T extends TranscriptTurn> {
  transcript: T[];
  summarized: boolean;
}

/**
 * If `turns.length > threshold`, replace `turns[0..N-tailKeep]` with a
 * single `{role:'system', text: 'Earlier in conversation: ...'}` and
 * preserve the last `tailKeep` turns verbatim. Otherwise return the
 * input transcript unchanged and `summarized: false`.
 *
 * The compressed summary line synthesises:
 *   - candidate background flags (gap, pivot, fresher, etc.) from
 *     `candidateProfile` (with SPECIAL_PERSONAL_DATA flags excluded —
 *     callers should pass an already-redacted profile if they want
 *     analytics-safe output, but for prompt construction we keep
 *     in-memory flags so the LLM can frame empathetically).
 *   - the role / company anchor.
 *   - the running candidate target + highest offer.
 *
 * Pure: no clock, no IO. Does not mutate the input array.
 */
export function summarizeTranscriptIfLong<T extends TranscriptTurn>(
  turns: ReadonlyArray<T>,
  opts: SummarizeOptions = {},
): SummarizeResult<T> {
  const threshold = opts.threshold ?? 30;
  const tailKeep = opts.tailKeep ?? 10;
  if (!Array.isArray(turns) || turns.length <= threshold) {
    return { transcript: [...(turns ?? [])] as T[], summarized: false };
  }
  if (turns.length <= tailKeep) {
    return { transcript: [...turns] as T[], summarized: false };
  }
  const tail = turns.slice(turns.length - tailKeep);
  const droppedCount = turns.length - tailKeep;
  const summaryParts: string[] = [
    `Earlier in conversation (${droppedCount} turns compressed):`,
  ];
  if (opts.role) summaryParts.push(`role discussed = ${opts.role}`);
  if (opts.company) summaryParts.push(`company = ${opts.company}`);
  if (opts.candidateTarget != null) {
    summaryParts.push(`candidate target ≈ ₹${opts.candidateTarget} LPA`);
  }
  if (opts.highestOfferMade != null && opts.highestOfferMade > 0) {
    summaryParts.push(`highest offer so far = ₹${opts.highestOfferMade} LPA`);
  }
  const cp = opts.candidateProfile;
  if (cp && cp.hasAny) {
    const flags: string[] = [];
    if (cp.careerGapMonths != null) flags.push(`gap=${cp.careerGapMonths}mo`);
    if (cp.tenureSignal) flags.push(`tenure=${cp.tenureSignal}`);
    if (cp.levelMismatch) flags.push(`level-mismatch=${cp.levelMismatch}`);
    if (cp.domainPivot) flags.push("domain-pivot");
    if (cp.internshipConversion) flags.push("PPO");
    if (cp.serviceBondAccepted) flags.push("service-bond");
    if (flags.length > 0) summaryParts.push(`profile: ${flags.join(", ")}`);
  }
  const summaryText = summaryParts.join("; ");
  const summaryTurn = { role: "system", text: summaryText } as unknown as T;
  return { transcript: [summaryTurn, ...tail], summarized: true };
}
