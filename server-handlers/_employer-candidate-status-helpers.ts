/* Pure validation pieces for employer-candidate-status.ts, extracted so
 * they're unit-tested against the real code rather than an inline copy.
 * Mirrors the asBounded.../isValid... pattern in
 * _employer-requirements-helpers.ts. */

/** The seven states a candidate can be in against one requirement —
 *  independent of the requirement-level `stage` in
 *  _employer-requirements-helpers.ts, which tracks the posting as a whole. */
export const CANDIDATE_STATUSES = [
  "shortlisted",
  "interview_invited",
  "interviewing",
  "hired",
  "rejected",
  "not_a_fit",
  "no_response",
] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

/** Validated read of a client-supplied candidate status — anything outside
 *  the seven known values returns null so callers can reject the request. */
export function asCandidateStatus(v: unknown): CandidateStatus | null {
  return typeof v === "string" && (CANDIDATE_STATUSES as readonly string[]).includes(v) ? (v as CandidateStatus) : null;
}

/** Validated + length-capped read of the optional free-text note (interview
 *  invite reason or final-outcome note) — undefined/non-string input means
 *  "no note supplied" rather than an error, so a status-only update doesn't
 *  need to resend an existing note. */
export function asCandidateStatusNote(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  return typeof v === "string" ? v.trim().slice(0, 2000) : null;
}

/** Validated read of an optional interview-scheduled-at timestamp: must be
 *  a value `Date` can parse. Returns null for anything else (including
 *  "not supplied"), so it stores as a real SQL NULL rather than a garbage
 *  string. */
export function asInterviewScheduledAt(v: unknown): string | null {
  if (typeof v !== "string" || v.trim().length === 0) return null;
  const parsed = new Date(v);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export interface RequirementMatchRow {
  id: string;
  requirement_id: string;
  candidate_status: string;
  candidate_status_note: string | null;
  candidate_status_updated_at: string | null;
  interview_scheduled_at: string | null;
}
