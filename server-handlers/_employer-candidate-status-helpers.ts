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

/** Allowed forward transitions in the per-candidate hiring pipeline. Built
 *  from the two employer surfaces that drive status changes:
 *  - the candidate detail page (app/(employer)/employer/requirements/[id]/
 *    candidates/[candidateId]/page.tsx): "Invite" only shows from
 *    `shortlisted`, and "Reject" shows from anything but the three terminal
 *    states (hired/rejected/not_a_fit);
 *  - the outcome-feedback page (.../outcome/page.tsx): records a final
 *    outcome (hired/interviewing/not_a_fit/no_response) once an interview
 *    has happened.
 *  `hired`, `rejected`, `not_a_fit` and `no_response` are terminal — none of
 *  the employer surfaces ever move a candidate out of them, so the pipeline
 *  can't be pushed backwards (e.g. hired -> shortlisted) or skipped forward
 *  (e.g. shortlisted -> hired) through a raw PATCH. A status "changing" to
 *  its own current value is always allowed — that's just a note/interview
 *  time update, not a transition. */
const ALLOWED_TRANSITIONS: Record<CandidateStatus, readonly CandidateStatus[]> = {
  shortlisted: ["interview_invited", "rejected", "not_a_fit"],
  interview_invited: ["interviewing", "rejected", "not_a_fit", "no_response"],
  interviewing: ["hired", "rejected", "not_a_fit", "no_response"],
  hired: [],
  rejected: [],
  not_a_fit: [],
  no_response: [],
};

/** Whether moving a candidate from `from` to `to` is a legal pipeline
 *  transition. Same-status "transitions" (note/date-only updates) are
 *  always allowed. */
export function isValidCandidateStatusTransition(from: CandidateStatus, to: CandidateStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export interface RequirementMatchRow {
  id: string;
  requirement_id: string;
  candidate_status: string;
  candidate_status_note: string | null;
  candidate_status_updated_at: string | null;
  interview_scheduled_at: string | null;
}
