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

/** Validated read of the optional message the employer chose to show the
 *  candidate. Distinct from `note`, which is a private internal note. */
export function asCandidateMessage(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, 1000);
  return t.length > 0 ? t : null;
}

/** Splits what the employer typed into the two audiences.
 *  - `privateNote`: employer-only (stored on the match, never posted to the
 *    candidate thread or the candidate-visible event history).
 *  - `candidateMessage`: shown to the candidate. It is only ever set by an
 *    explicit `candidateMessage` field, with one exception: an interview
 *    invite's `note` has always been the schedule note addressed to the
 *    candidate, so an invite that sends only `note` keeps delivering it. */
export function splitStatusNotes(
  status: CandidateStatus,
  rawNote: unknown,
  rawCandidateMessage: unknown,
): { privateNote: string | null; candidateMessage: string | null } {
  const privateNote = asCandidateStatusNote(rawNote);
  const explicit = asCandidateMessage(rawCandidateMessage);
  if (explicit !== null) return { privateNote, candidateMessage: explicit };
  if (status === "interview_invited" && rawCandidateMessage === undefined) {
    return { privateNote, candidateMessage: privateNote && privateNote.length > 0 ? privateNote : null };
  }
  return { privateNote, candidateMessage: null };
}

/** The system message posted into the candidate-visible thread for a status
 *  change. Only `candidateMessage` is ever quoted — never the private note.
 *  Null for statuses with nothing worth announcing. */
export function threadMessageFor(
  candidateStatus: string,
  candidateMessage: string | null,
  interviewScheduledAt: string | null,
): string | null {
  const said = candidateMessage ? ` Message from the employer: "${candidateMessage}"` : "";
  switch (candidateStatus) {
    case "interview_invited": {
      const when = interviewScheduledAt ? ` for ${new Date(interviewScheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : "";
      return `📅 Interview invite sent${when}.${said}`;
    }
    case "interviewing":
      return `🗣️ Candidate marked as interviewing.${said}`;
    case "hired":
      return `🎉 Candidate marked as hired.${said}`;
    case "rejected":
      return `Application status updated: Rejected.${said}`;
    case "not_a_fit":
      return `Application status updated: Not a fit.${said}`;
    case "no_response":
      return `Application status updated: No response.${said}`;
    default:
      return null;
  }
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
 *  `hired`, `not_a_fit` and `no_response` are terminal, so the pipeline can't
 *  be pushed backwards (e.g. hired -> shortlisted) or skipped forward (e.g.
 *  shortlisted -> hired) through a raw PATCH. `rejected` is the one
 *  reversible decision: "Reopen" puts a rejected candidate back on the
 *  shortlist, since a misclick or a changed mind shouldn't be a dead end.
 *  A status "changing" to its own current value is always allowed — that's
 *  just a note/interview time update, not a transition. */
const ALLOWED_TRANSITIONS: Record<CandidateStatus, readonly CandidateStatus[]> = {
  shortlisted: ["interview_invited", "rejected", "not_a_fit"],
  interview_invited: ["interviewing", "rejected", "not_a_fit", "no_response"],
  interviewing: ["hired", "rejected", "not_a_fit", "no_response"],
  hired: [],
  rejected: ["shortlisted"],
  not_a_fit: [],
  no_response: [],
};

/** The statuses a candidate can move to next, in pipeline order. Empty once
 *  they reach a terminal state (a rejected candidate can only be reopened). The Stage menu renders exactly this list. */
export function nextCandidateStatuses(from: CandidateStatus): readonly CandidateStatus[] {
  return ALLOWED_TRANSITIONS[from];
}

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
