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
  /** Employer-feature data (all optional so older callers/tests keep working). */
  employer_discovery?: EmployerDiscoveryExport;
  employer_account?: EmployerAccountExport | null;
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
  employer_discovery: EmployerDiscoveryExport;
  employer_account: EmployerAccountExport | null;
}

/* ── Employer-feature data (DPDP right of access) ──
 * What employers did with the candidate's profile, and what the candidate
 * chose. Employer identity (company / role) is included ONLY for matches the
 * employer paid to unlock — before that, the platform deliberately hides who
 * viewed a candidate, and the export must not become a side channel around it. */

export interface EmployerDiscoveryExport {
  visibility: string | null;
  visibility_updated_at: string | null;
  consent_log: unknown[];
  blocks: unknown[];
  reports_filed: unknown[];
  matches: unknown[];
  status_events: unknown[];
  conversations: unknown[];
  messages: unknown[];
}

export interface EmployerAccountExport {
  employer: unknown;
  requirements: unknown[];
  unlock_payments: unknown[];
  unlock_orders: unknown[];
  messages_sent: unknown[];
}

interface RawMatch {
  id?: string;
  created_at?: string;
  unlocked?: boolean | null;
  unlocked_at?: string | null;
  profile_viewed_at?: string | null;
  candidate_status?: string | null;
  candidate_response?: string | null;
  candidate_responded_at?: string | null;
  employer_requirements?: { title?: string | null; employers?: { company_name?: string | null } | null } | null;
}

export function shapeMatchesForExport(rows: unknown): { shaped: unknown[]; unlockedIds: Set<string>; companyByMatch: Map<string, string | null> } {
  const shaped: unknown[] = [];
  const unlockedIds = new Set<string>();
  const companyByMatch = new Map<string, string | null>();
  if (!Array.isArray(rows)) return { shaped, unlockedIds, companyByMatch };
  for (const raw of rows as RawMatch[]) {
    if (!raw || typeof raw.id !== "string") continue;
    const unlocked = raw.unlocked === true;
    const company = unlocked ? raw.employer_requirements?.employers?.company_name ?? null : null;
    if (unlocked) unlockedIds.add(raw.id);
    companyByMatch.set(raw.id, company);
    shaped.push({
      match_id: raw.id,
      matched_at: raw.created_at ?? null,
      viewed_by_employer_at: raw.profile_viewed_at ?? null,
      pipeline_status: raw.candidate_status ?? null,
      your_response: raw.candidate_response ?? "none",
      responded_at: raw.candidate_responded_at ?? null,
      unlocked,
      unlocked_at: unlocked ? raw.unlocked_at ?? null : null,
      employer_company: company,
      role_title: unlocked ? raw.employer_requirements?.title ?? null : null,
    });
  }
  return { shaped, unlockedIds, companyByMatch };
}

export function shapeStatusEventsForExport(rows: unknown, unlockedIds: Set<string>): unknown[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const e = r as { id?: string; match_id?: string | null; from_status?: string | null; to_status?: string; actor?: string; note?: string | null; created_at?: string };
    const revealed = !!e.match_id && unlockedIds.has(e.match_id);
    return {
      id: e.id,
      match_id: e.match_id ?? null,
      from_status: e.from_status ?? null,
      to_status: e.to_status,
      actor: e.actor,
      // An employer's free-text note can name them; show it only once they're revealed (candidate's own notes always).
      note: revealed || e.actor === "candidate" ? e.note ?? null : null,
      created_at: e.created_at,
    };
  });
}

export function shapeConversationsForExport(rows: unknown, companyByMatch: Map<string, string | null>): unknown[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const c = r as { id?: string; match_id?: string; created_at?: string; last_message_at?: string | null };
    return {
      id: c.id,
      match_id: c.match_id ?? null,
      employer_company: (c.match_id && companyByMatch.get(c.match_id)) || null,
      created_at: c.created_at,
      last_message_at: c.last_message_at ?? null,
    };
  });
}

export function shapeMessagesForExport(rows: unknown): unknown[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const m = r as { id?: string; conversation_id?: string; sender_role?: string; body?: string; attachment_name?: string | null; created_at?: string };
    return {
      id: m.id,
      conversation_id: m.conversation_id,
      sender_role: m.sender_role,
      body: m.body ?? "",
      attachment_name: m.attachment_name ?? null,
      created_at: m.created_at,
    };
  });
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
    employer_discovery: inputs.employer_discovery ?? {
      visibility: null,
      visibility_updated_at: null,
      consent_log: [],
      blocks: [],
      reports_filed: [],
      matches: [],
      status_events: [],
      conversations: [],
      messages: [],
    },
    employer_account: inputs.employer_account ?? null,
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
