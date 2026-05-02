/* Pure helpers extracted from export-user-data.ts.
 *
 * This handler is a DPDP/GDPR data-portability endpoint, so the load-bearing
 * pure logic is:
 *   - profile array unwrap (must NOT pick someone else's row if Supabase
 *     returns more than one)
 *   - envelope assembly with the legally-required _meta block
 *   - filename construction (used as a Content-Disposition header — must
 *     stay safe + deterministic).
 *
 * The fetch + auth + safeFetch pieces are kept in the handler.
 */

export interface ExportEnvelopeInputs {
  userId: string;
  userEmail: string;
  exportedAt?: string; // injectable for tests
  profile: unknown[];
  sessions: unknown[];
  calendar_events: unknown[];
  payments: unknown[];
  feedback: unknown[];
  interview_turns: unknown[];
  llm_usage: unknown[];
}

export interface ExportEnvelope {
  _meta: {
    format: "HireStepX User Data Export v1";
    exportedAt: string;
    userId: string;
    userEmail: string;
    notice: string;
  };
  profile: unknown;
  sessions: unknown[];
  calendar_events: unknown[];
  payments: unknown[];
  feedback: unknown[];
  interview_turns: unknown[];
  llm_usage: unknown[];
}

/**
 * Pull the FIRST row off a Supabase response array. Returns null on empty
 * or non-array input. Centralized so a future change can never silently
 * pick `profile[1]` and ship the wrong user's data.
 */
export function pickProfileRow(rows: unknown): unknown {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0] ?? null;
}

/**
 * Assemble the JSON envelope returned to the user. Order matters — _meta
 * comes first so the legal compliance notice is visible at the top of the
 * download. exportedAt is injectable so tests can pin the timestamp.
 */
export function buildExportEnvelope(inputs: ExportEnvelopeInputs): ExportEnvelope {
  return {
    _meta: {
      format: "HireStepX User Data Export v1",
      exportedAt: inputs.exportedAt ?? new Date().toISOString(),
      userId: inputs.userId,
      userEmail: inputs.userEmail,
      notice:
        "This file contains all personal data stored for your account. Retain securely.",
    },
    profile: pickProfileRow(inputs.profile),
    sessions: inputs.sessions,
    calendar_events: inputs.calendar_events,
    payments: inputs.payments,
    feedback: inputs.feedback,
    interview_turns: inputs.interview_turns,
    llm_usage: inputs.llm_usage,
  };
}

/**
 * Filename for the Content-Disposition header. Format:
 *   hirestepx-export-<userIdPrefix>-<YYYY-MM-DD>.json
 *
 * Always exactly the user ID's first 8 chars + ISO date. Never any
 * arbitrary user-controlled string — header injection guard.
 */
export function buildExportFilename(userId: string, now: Date = new Date()): string {
  const idPrefix = (userId || "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 8) || "user";
  const datePart = now.toISOString().slice(0, 10);
  return `hirestepx-export-${idPrefix}-${datePart}.json`;
}
