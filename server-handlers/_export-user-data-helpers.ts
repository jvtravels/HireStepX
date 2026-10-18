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
  /** Additional user-scoped tables (resumes, referrals, ...), merged at the top level. */
  extra_tables?: Record<string, unknown[]>;
  /** Tables whose fetch failed / hit the row cap; makes an incomplete export visible. */
  errors?: string[];
  truncated?: string[];
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
    /** false when any table failed to load or was truncated: the file is NOT a full export. */
    complete: boolean;
    errors: string[];
    truncated: string[];
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
  [extraTable: string]: unknown;
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
  /** Created / updated / archived / stage-change trail on the employer's own requirements. */
  requirement_activity: unknown[];
  /** Credit movements on the employer's account (empty until that table is migrated). */
  credit_ledger: unknown[];
  /** Per-refund credit notes for the employer's unlock orders. */
  credit_notes: unknown[];
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
  candidate_status_note?: string | null;
  candidate_status_updated_at?: string | null;
  interview_scheduled_at?: string | null;
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
      status_updated_at: raw.candidate_status_updated_at ?? null,
      interview_scheduled_at: raw.interview_scheduled_at ?? null,
      // The employer's free-text note (interview-invite reason / outcome note) can name them, so it
      // follows the same reveal rule as the status-event notes.
      employer_note: unlocked ? raw.candidate_status_note ?? null : null,
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
  const errors = inputs.errors ?? [];
  const truncated = inputs.truncated ?? [];
  const envelope: ExportEnvelope = {
    _meta: {
      format: "HireStepX User Data Export v1",
      exportedAt: inputs.exportedAt ?? new Date().toISOString(),
      userId: inputs.userId,
      userEmail: inputs.userEmail,
      notice:
        errors.length === 0 && truncated.length === 0
          ? "This file contains all personal data stored for your account. Retain securely."
          : "This file is INCOMPLETE: see _meta.errors and _meta.truncated. Download again or contact support@hirestepx.com. Retain securely.",
      complete: errors.length === 0 && truncated.length === 0,
      errors,
      truncated,
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
  // Extras go last (keeps _meta first) and can never overwrite a fixed section.
  for (const [key, rows] of Object.entries(inputs.extra_tables ?? {})) {
    if (!(key in envelope)) envelope[key] = rows;
  }
  return envelope;
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

/* ── Completeness: table list + pagination ──
 * safeFetch used to swallow every error into [], silently shipping a "full" export
 * that was missing tables. Every table is now fetched page by page, and any failure
 * or cap is surfaced in _meta. */

export const EXPORT_PAGE_SIZE = 1000;
/** Per-table ceiling (rows). Beyond it the table is returned truncated and flagged. */
export const EXPORT_MAX_ROWS_PER_TABLE = 50_000;

export interface ExportSpec {
  /** Key in the export payload. */
  key: string;
  path: string;
  /** Stable ordering for offset pagination. */
  order: string;
  /** A 404 (table from a not-yet-applied migration) means "no rows", not an error. */
  optional?: boolean;
  /** Tighter per-table row cap than EXPORT_MAX_ROWS_PER_TABLE, for unbounded-growth audit tables. */
  maxRows?: number;
}

export interface PagedResult {
  rows: unknown[];
  truncated: boolean;
  error: boolean;
}

export async function fetchPaged(
  fetchImpl: typeof fetch,
  baseUrl: string,
  headers: Record<string, string>,
  spec: ExportSpec,
  opts: { pageSize?: number; maxRows?: number } = {},
): Promise<PagedResult> {
  const pageSize = opts.pageSize ?? EXPORT_PAGE_SIZE;
  const maxRows = spec.maxRows ?? opts.maxRows ?? EXPORT_MAX_ROWS_PER_TABLE;
  const rows: unknown[] = [];
  const sep = spec.path.includes("?") ? "&" : "?";
  try {
    while (rows.length < maxRows) {
      const limit = Math.min(pageSize, maxRows - rows.length);
      const r = await fetchImpl(`${baseUrl}${spec.path}${sep}order=${spec.order}&limit=${limit}&offset=${rows.length}`, {
        headers,
        signal: AbortSignal.timeout(15_000),
      });
      if (!r.ok) {
        if (r.status === 404 && spec.optional) return { rows, truncated: false, error: false };
        return { rows, truncated: false, error: true };
      }
      const page: unknown = await r.json();
      if (!Array.isArray(page)) return { rows, truncated: false, error: true };
      rows.push(...page);
      if (page.length < limit) return { rows, truncated: false, error: false };
    }
    // Hit the cap on a full page: truncated unless the table ends exactly here.
    const probe = await fetchImpl(`${baseUrl}${spec.path}${sep}order=${spec.order}&limit=1&offset=${rows.length}`, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    const more: unknown = probe.ok ? await probe.json() : [];
    return { rows, truncated: Array.isArray(more) && more.length > 0, error: !probe.ok };
  } catch {
    return { rows, truncated: false, error: true };
  }
}

const NEWEST = "created_at.desc,id.asc";

/** Every user-scoped table (supabase-schema.sql). Secrets are excluded by column list:
 *  google_calendar_sync tokens/sync cursors, report_shares bearer tokens, and third
 *  parties' emails in referrals. */
export function buildCandidateExportSpecs(id: string): ExportSpec[] {
  const u = `user_id=eq.${id}`;
  const t = (key: string, query: string, order: string, optional = false): ExportSpec => ({ key, path: `/rest/v1/${key}?${query}`, order, optional });
  return [
    t("profiles", `id=eq.${id}`, "id.asc"),
    t("sessions", u, NEWEST),
    t("calendar_events", u, NEWEST),
    t("calendar_reminder_log", u, "sent_at.desc,id.asc"),
    t("google_calendar_sync", `${u}&select=user_id,calendar_id,token_expiry,channel_expiry,created_at,updated_at`, "user_id.asc"),
    t("feedback", u, NEWEST),
    t("question_feedback", u, NEWEST),
    t("credibility_disputes", u, NEWEST),
    t("payments", u, NEWEST),
    t("payment_dedup", `${u}&select=razorpay_payment_id,created_at`, "razorpay_payment_id.asc", true),
    t("referrals", `referrer_id=eq.${id}&select=id,referral_code,status,reward_granted,reward_granted_at,created_at`, NEWEST),
    { key: "referrals_received", path: `/rest/v1/referrals?referred_id=eq.${id}&select=id,referral_code,status,created_at`, order: NEWEST },
    t("llm_usage", u, NEWEST),
    t("report_shares", `${u}&select=session_id,expires_at,revoked_at,view_count,last_viewed_at,include_transcript,include_per_question,created_at`, "created_at.desc,session_id.asc"),
    t("user_outcomes", u, "user_id.asc"),
    t("resumes", u, NEWEST),
    // Inner join on resumes scopes versions to this user (same pattern as resume-upload-file.ts).
    { key: "resume_versions", path: `/rest/v1/resume_versions?select=*,resumes!inner(user_id)&resumes.user_id=eq.${id}`, order: NEWEST },
    t("session_credits", u, "user_id.asc"),
    t("credit_ledger", u, NEWEST),
    t("promo_redemptions", u, "redeemed_at.desc,id.asc"),
    t("session_insights", u, "analyzed_at.desc,session_id.asc"),
    t("salary_offers", u, "reported_at.desc,id.asc"),
    t("support_messages", u, NEWEST),
    t("notifications", u, NEWEST, true),
    t("notification_preferences", u, "user_id.asc", true),
    t("product_ratings", u, NEWEST, true),
    t("candidate_requests", `candidate_user_id=eq.${id}&select=id,kind,topic,fields,note,status,response_note,created_at,resolved_at`, NEWEST, true),
    t("user_consents", `${u}&select=purpose,version,accepted_at`, "accepted_at.desc,id.asc", true),
    t("email_preferences", u, "user_id.asc", true),
    t("interview_turns", u, NEWEST, true),
  ];
}

/** Drop the join helper column added for scoping and return plain version rows. */
export function stripResumeJoin(rows: unknown[]): unknown[] {
  return rows.map((r) => {
    if (!r || typeof r !== "object") return r;
    const { resumes: _joined, ...rest } = r as Record<string, unknown>;
    void _joined;
    return rest;
  });
}

export interface ResumeFileRef { version_id: unknown; file_name: unknown; file_path: string }

export function resumeFileRefs(versions: unknown[], max = 50): ResumeFileRef[] {
  const out: ResumeFileRef[] = [];
  for (const v of versions) {
    const r = v as { id?: unknown; file_name?: unknown; file_path?: unknown };
    if (typeof r?.file_path === "string" && r.file_path && !r.file_path.includes("..")) {
      out.push({ version_id: r.id ?? null, file_name: r.file_name ?? null, file_path: r.file_path });
      if (out.length >= max) break;
    }
  }
  return out;
}
