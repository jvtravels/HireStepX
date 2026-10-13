/* eraseUserData — the ONE erasure routine. Used by delete-account.ts (immediate
 * "hard" path) and cleanup-deleted-accounts.ts (7-day soft-delete cron), so the two
 * paths can never drift again.
 *
 * Order (resumable, idempotent; a failed run leaves the account soft-deleted for the
 * next cron run and NEVER reaches the auth-user delete):
 *   A. gates  - employer lookup, storage objects (resume-files, chat-attachments,
 *               employer-logos, each re-listed to verify), financial anonymisation.
 *               Any failure aborts before a single DB row is deleted.
 *   B. rows   - every user-scoped table (see USER_TABLE_DELETES), failures aggregated.
 *   C. processors (best effort, never block) - Google token revoke, PostHog person.
 *   D. auth   - auth user delete (cascades profiles) or, for a retained employer, ban.
 *
 * RETENTION EXCEPTIONS (kept, anonymised; legal basis: tax/accounting records):
 *   payments, payment_dedup           user_id nulled, receipt_url cleared; amounts + Razorpay ids kept
 *   employer_unlock_payments/_orders  kept with the employer row (company/website/logo cleared,
 *                                     gstin + billing_name kept as part of the invoice); auth user
 *                                     is banned + re-emailed to a non-routable address, not deleted
 *   service_usage                     ops telemetry, user_id nulled
 *   account_erasure_log               proof of erasure; sha256(user id) only, counts only
 *   Razorpay itself has no deletion API: its copy is its own retention exception.
 *   Database backups are not edited; they age out ("overwritten within 30 days").
 */

import {
  CHAT_ATTACHMENT_BUCKET,
  EMPLOYER_LOGO_BUCKET,
  anonymisedAuthEmail,
  anonymisedEmployerPatch,
  extractAttachmentPaths,
  mustRetainEmployerFinancials,
} from "./_delete-account-helpers";

export const RESUME_FILE_BUCKET = "resume-files";

export interface PostHogErasureConfig {
  apiHost: string;
  projectId: string;
  personalApiKey: string;
}

export interface EraseDeps {
  fetchImpl: typeof fetch;
  supabaseUrl: string;
  serviceKey: string;
  trigger: "user_hard" | "scheduled";
  /** Email/name already known to the caller (the profile read fills gaps). */
  contact?: { email?: string; name?: string };
  posthog?: PostHogErasureConfig | null;
  /** Called once, only after a fully successful erasure. Failures are swallowed. */
  notify?: (contact: { email: string; name: string }) => Promise<void>;
  log?: (msg: string, fields: Record<string, unknown>) => void;
  now?: () => Date;
}

export type AuthOutcome = "deleted" | "deactivated" | "failed" | "not_attempted";

export interface EraseResult {
  ok: boolean;
  failedSteps: string[];
  retainedFinancialRecords: boolean;
  auth: AuthOutcome;
  /** Rows / objects removed per step (counts only, never identifiers). */
  counts: Record<string, number>;
  processors: { posthog: "deleted" | "skipped" | "failed"; google: "revoked" | "none" | "failed" };
}

interface TableStep {
  table: string;
  column: string;
  scope: "user" | "employer";
}

/** Every table holding a user's rows, enumerated from supabase-schema.sql. Most also
 *  cascade from profiles(id); the explicit deletes guard against live-FK drift and give counts. */
export const USER_TABLE_DELETES: TableStep[] = [
  { table: "sessions", column: "user_id", scope: "user" },
  { table: "calendar_reminder_log", column: "user_id", scope: "user" },
  { table: "calendar_events", column: "user_id", scope: "user" },
  { table: "feedback", column: "user_id", scope: "user" },
  { table: "resumes", column: "user_id", scope: "user" }, // cascades resume_versions
  { table: "question_feedback", column: "user_id", scope: "user" },
  { table: "credibility_disputes", column: "user_id", scope: "user" },
  { table: "referrals", column: "referrer_id", scope: "user" },
  { table: "report_shares", column: "user_id", scope: "user" },
  { table: "user_outcomes", column: "user_id", scope: "user" },
  { table: "llm_usage", column: "user_id", scope: "user" },
  { table: "product_ratings", column: "user_id", scope: "user" },
  { table: "interview_turns", column: "user_id", scope: "user" },
  { table: "session_insights", column: "user_id", scope: "user" },
  { table: "salary_offers", column: "user_id", scope: "user" },
  { table: "promo_redemptions", column: "user_id", scope: "user" },
  { table: "credit_ledger", column: "user_id", scope: "user" },
  { table: "session_credits", column: "user_id", scope: "user" },
  { table: "support_messages", column: "user_id", scope: "user" },
  { table: "notifications", column: "user_id", scope: "user" },
  { table: "notification_preferences", column: "user_id", scope: "user" },
  { table: "google_calendar_sync", column: "user_id", scope: "user" },
  { table: "candidate_consent_log", column: "user_id", scope: "user" },
  { table: "employer_blocks", column: "candidate_user_id", scope: "user" },
  { table: "employer_reports", column: "reporter_user_id", scope: "user" },
  { table: "match_status_events", column: "candidate_user_id", scope: "user" },
  { table: "message_flags", column: "flagged_by", scope: "user" },
  { table: "conversation_messages", column: "candidate_user_id", scope: "user" },
  { table: "conversations", column: "candidate_user_id", scope: "user" },
  { table: "requirement_matches", column: "candidate_user_id", scope: "user" },
  // Employer side (only run when the user has an employers row).
  { table: "employer_requirement_activity", column: "employer_id", scope: "employer" },
  { table: "match_status_events", column: "employer_id", scope: "employer" },
  { table: "conversation_messages", column: "employer_id", scope: "employer" },
  { table: "conversations", column: "employer_id", scope: "employer" },
  { table: "employer_requirements", column: "employer_id", scope: "employer" },
];

/** Tables created by later migrations: a 404 (table missing) just means nothing to erase. */
export const OPTIONAL_TABLES = new Set([
  "candidate_consent_log", "employer_blocks", "employer_reports", "match_status_events", "message_flags",
  "conversation_messages", "conversations", "requirement_matches", "product_ratings", "interview_turns",
  "notifications", "notification_preferences", "employer_unlock_orders", "employer_requirement_activity",
  "employer_requirements", "account_erasure_log", "used_verification_tokens", "payment_dedup",
]);

export function posthogConfigFromEnv(env: Record<string, string | undefined>): PostHogErasureConfig | null {
  const personalApiKey = env.POSTHOG_PERSONAL_API_KEY;
  const projectId = env.POSTHOG_PROJECT_ID;
  if (!personalApiKey || !projectId) return null;
  // Ingestion host (us.i.posthog.com) differs from the management API host (us.posthog.com).
  const host = (env.POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");
  return { apiHost: host.replace(".i.posthog.com", ".posthog.com"), projectId, personalApiKey };
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Distinct id for the post-deletion analytics event, so it cannot re-create the erased person. */
export async function pseudonymousId(userId: string): Promise<string> {
  return `deleted_${(await sha256Hex(userId)).slice(0, 16)}`;
}

function parseContentRange(res: Response): number {
  const cr = res.headers?.get?.("content-range");
  const total = cr ? Number(cr.split("/")[1]) : NaN;
  return Number.isFinite(total) ? total : 0;
}

async function readRows(r: Response): Promise<unknown[]> {
  try {
    const j: unknown = await r.json();
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

export async function eraseUserData(deps: EraseDeps, userId: string): Promise<EraseResult> {
  const { fetchImpl, supabaseUrl, serviceKey } = deps;
  const log = deps.log ?? (() => undefined);
  const enc = encodeURIComponent(userId);
  const baseHeaders: Record<string, string> = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
  const sb = (path: string, init: RequestInit = {}, extraHeaders: Record<string, string> = {}) =>
    fetchImpl(`${supabaseUrl}${path}`, {
      ...init,
      headers: { ...baseHeaders, Prefer: "return=minimal", ...extraHeaders },
      signal: AbortSignal.timeout(15_000),
    });

  const counts: Record<string, number> = {};
  const failed: string[] = [];
  const result = (extra: Partial<EraseResult> = {}): EraseResult => ({
    ok: false,
    failedSteps: failed,
    retainedFinancialRecords: false,
    auth: "not_attempted",
    counts,
    processors: { posthog: "skipped", google: "none" },
    ...extra,
  });
  const fail = (step: string, e?: unknown) => {
    failed.push(step);
    log("erase-user: step failed", { step, error: e instanceof Error ? e.message : undefined });
  };

  // Contact details for the confirmation email: read before the profile disappears.
  const contact = { email: deps.contact?.email ?? "", name: deps.contact?.name ?? "" };
  try {
    const r = await sb(`/rest/v1/profiles?id=eq.${enc}&select=email,name`, { method: "GET" });
    if (r.ok) {
      const row = (await readRows(r))[0] as { email?: string; name?: string } | undefined;
      contact.email = row?.email || contact.email;
      contact.name = row?.name || contact.name;
    }
  } catch { /* non-critical */ }

  /* ── Storage helpers ── */
  const bucketMissing = async (r: Response) => {
    if (r.status === 404) return true;
    if (r.status !== 400) return false;
    const t = await r.text?.().catch(() => "");
    return /bucket.*not.*found/i.test(t ?? "");
  };

  /** Recursively list object paths under a prefix (Supabase list is one level deep). */
  async function listObjects(bucket: string, prefix: string, depth = 0): Promise<string[]> {
    const out: string[] = [];
    for (let offset = 0; offset < 20_000; offset += 1000) {
      const r = await sb(`/storage/v1/object/list/${bucket}`, {
        method: "POST",
        body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
      });
      if (!r.ok) {
        if (await bucketMissing(r)) return out;
        throw new Error(`list ${bucket} HTTP ${r.status}`);
      }
      const items = (await readRows(r)) as Array<{ name?: string; id?: string | null }>;
      for (const it of items) {
        if (typeof it?.name !== "string" || it.name.includes("..")) continue;
        const full = `${prefix}/${it.name}`;
        if (it.id) out.push(full);
        else if (depth < 4) out.push(...(await listObjects(bucket, full, depth + 1)));
      }
      if (items.length < 1000) break;
    }
    return out;
  }

  async function removeObjects(bucket: string, paths: string[]): Promise<void> {
    for (let i = 0; i < paths.length; i += 100) {
      const r = await sb(`/storage/v1/object/${bucket}`, { method: "DELETE", body: JSON.stringify({ prefixes: paths.slice(i, i + 100) }) });
      if (!r.ok && !(await bucketMissing(r))) throw new Error(`remove ${bucket} HTTP ${r.status}`);
    }
  }

  /** Delete every object under `${userId}/` (+ any known pointer paths), then re-list to verify. */
  async function eraseBucketPrefix(bucket: string, extraPaths: string[]): Promise<number> {
    const listed = await listObjects(bucket, userId);
    const paths = [...new Set([...listed, ...extraPaths])];
    if (paths.length > 0) await removeObjects(bucket, paths);
    if (listed.length > 0 && (await listObjects(bucket, userId)).length > 0) throw new Error(`${bucket} objects remain after delete`);
    return paths.length;
  }

  /* ── Phase A: gates ── */

  // A1. Employer lookup. Fail closed: we must know whether payment rows must be retained.
  let employerLogoPath: string | null = null;
  let isEmployer = false;
  let retainEmployer = false;
  try {
    const empRes = await sb(`/rest/v1/employers?id=eq.${enc}&select=id,logo_path&limit=1`, { method: "GET" });
    if (!empRes.ok && !(empRes.status === 404)) throw new Error(`employers lookup HTTP ${empRes.status}`);
    const empRows = empRes.ok ? ((await readRows(empRes)) as Array<{ id?: string; logo_path?: string | null }>) : [];
    if (empRows[0]?.id) {
      isEmployer = true;
      employerLogoPath = empRows[0].logo_path ?? null;
      const countRows = async (table: string): Promise<number> => {
        const r = await sb(`/rest/v1/${table}?employer_id=eq.${enc}&select=id&limit=1`, { method: "GET" });
        if (r.status === 404 && OPTIONAL_TABLES.has(table)) return 0;
        if (!r.ok) throw new Error(`${table} lookup HTTP ${r.status}`);
        return (await readRows(r)).length;
      };
      const [payments, orders] = await Promise.all([countRows("employer_unlock_payments"), countRows("employer_unlock_orders")]);
      retainEmployer = mustRetainEmployerFinancials({ payments, orders });
    }
  } catch (e) {
    fail("employer data", e);
    return result();
  }

  // A2. Storage. Pointers in the DB are best-effort hints; the authoritative sweep is the
  // `${userId}/` prefix, so orphaned files (version row already gone) are still found.
  try {
    const attRes = await sb(
      `/rest/v1/conversation_messages?or=(candidate_user_id.eq.${enc},employer_id.eq.${enc})&attachment_path=not.is.null&select=attachment_path&limit=1000`,
      { method: "GET" },
    );
    if (!attRes.ok && attRes.status !== 404) throw new Error(`attachment lookup HTTP ${attRes.status}`);
    const paths = attRes.ok ? extractAttachmentPaths(await readRows(attRes)) : [];
    if (paths.length > 0) await removeObjects(CHAT_ATTACHMENT_BUCKET, paths);
    counts[CHAT_ATTACHMENT_BUCKET] = paths.length;
  } catch (e) {
    fail(CHAT_ATTACHMENT_BUCKET, e);
  }
  try {
    const verRes = await sb(
      `/rest/v1/resume_versions?select=file_path,resumes!inner(user_id)&resumes.user_id=eq.${enc}&file_path=not.is.null&limit=1000`,
      { method: "GET" },
    );
    const pointers = verRes.ok
      ? (await readRows(verRes)).map((r) => (r as { file_path?: unknown })?.file_path).filter((p): p is string => typeof p === "string" && p.length > 0 && !p.includes(".."))
      : [];
    counts[RESUME_FILE_BUCKET] = await eraseBucketPrefix(RESUME_FILE_BUCKET, pointers);
  } catch (e) {
    fail(RESUME_FILE_BUCKET, e);
  }
  try {
    const logo = employerLogoPath && !employerLogoPath.includes("..") ? [employerLogoPath] : [];
    counts[EMPLOYER_LOGO_BUCKET] = await eraseBucketPrefix(EMPLOYER_LOGO_BUCKET, logo);
  } catch (e) {
    fail(EMPLOYER_LOGO_BUCKET, e);
  }

  // A2b. Release the Google Calendar grant (best effort; the row itself is deleted in phase B).
  const processors: EraseResult["processors"] = { posthog: "skipped", google: "none" };
  try {
    const gr = await sb(`/rest/v1/google_calendar_sync?user_id=eq.${enc}&select=refresh_token&limit=1`, { method: "GET" });
    const token = gr.ok ? (await readRows(gr))[0] : undefined;
    const refresh = (token as { refresh_token?: unknown } | undefined)?.refresh_token;
    if (typeof refresh === "string" && refresh) {
      const rv = await fetchImpl(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(10_000),
      });
      processors.google = rv.ok ? "revoked" : "failed";
    }
  } catch {
    processors.google = "failed";
  }

  // A3. Financial anonymisation (retained rows lose their link to the person).
  const anonymise = async (step: string, path: string, patch: Record<string, unknown>) => {
    try {
      const r = await sb(path, { method: "PATCH", body: JSON.stringify(patch) });
      if (!r.ok && !(r.status === 404 && OPTIONAL_TABLES.has(step))) throw new Error(`${step} anonymise HTTP ${r.status}`);
    } catch (e) {
      fail(step, e);
    }
  };
  // service_usage.user_id is `on delete set null` in the schema but the live constraint
  // predates that and blocks the profile delete, so null it explicitly first.
  await anonymise("service_usage", `/rest/v1/service_usage?user_id=eq.${enc}`, { user_id: null });
  // Requires migration 0035 (payments.user_id nullable). Until applied this fails closed:
  // the account stays soft-deleted and is retried, rather than destroying tax records.
  await anonymise("payments", `/rest/v1/payments?user_id=eq.${enc}`, { user_id: null, receipt_url: "" });
  await anonymise("payment_dedup", `/rest/v1/payment_dedup?user_id=eq.${enc}`, { user_id: null });
  await anonymise("referrals", `/rest/v1/referrals?referred_id=eq.${enc}`, { referred_id: null, referred_email: null });
  if (retainEmployer) {
    await anonymise("employers", `/rest/v1/employers?id=eq.${enc}`, anonymisedEmployerPatch((deps.now ?? (() => new Date()))().toISOString()));
  }

  if (failed.length > 0) return result({ retainedFinancialRecords: retainEmployer });

  /* ── Phase B: row deletes ── */
  const tableSteps: Array<{ name: string; path: string }> = USER_TABLE_DELETES
    .filter((s) => s.scope === "user" || isEmployer)
    .map((s) => ({ name: s.table, path: `/rest/v1/${s.table}?${s.column}=eq.${enc}` }));
  if (contact.email) {
    tableSteps.push({ name: "used_verification_tokens", path: `/rest/v1/used_verification_tokens?email=eq.${encodeURIComponent(contact.email)}` });
  }
  for (const step of tableSteps) {
    try {
      const r = await sb(step.path, { method: "DELETE" }, { Prefer: "return=minimal,count=exact" });
      if (!r.ok && !(r.status === 404 && OPTIONAL_TABLES.has(step.name))) throw new Error(`${step.name} delete HTTP ${r.status}`);
      counts[step.name] = (counts[step.name] ?? 0) + parseContentRange(r);
    } catch (e) {
      fail(step.name, e);
    }
  }

  /* ── Phase C: processors (best effort) ── */
  if (deps.posthog) {
    try {
      const r = await fetchImpl(`${deps.posthog.apiHost}/api/projects/${encodeURIComponent(deps.posthog.projectId)}/persons/bulk_delete/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${deps.posthog.personalApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ distinct_ids: [userId], delete_events: true }),
        signal: AbortSignal.timeout(10_000),
      });
      processors.posthog = r.ok ? "deleted" : "failed";
    } catch {
      processors.posthog = "failed";
    }
  }

  if (failed.length > 0) return result({ retainedFinancialRecords: retainEmployer, processors });

  /* ── Phase D: auth (last) ── */
  let auth: AuthOutcome;
  try {
    if (retainEmployer) {
      const r = await fetchImpl(`${supabaseUrl}/auth/v1/admin/users/${enc}`, {
        method: "PUT",
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: anonymisedAuthEmail(userId), email_confirm: true, phone: "", user_metadata: {}, ban_duration: "876000h" }),
        signal: AbortSignal.timeout(15_000),
      });
      auth = r.ok ? "deactivated" : "failed";
    } else {
      const r = await fetchImpl(`${supabaseUrl}/auth/v1/admin/users/${enc}`, {
        method: "DELETE",
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        signal: AbortSignal.timeout(15_000),
      });
      auth = r.ok || r.status === 404 ? "deleted" : "failed";
    }
  } catch {
    auth = "failed";
  }
  if (auth === "failed") {
    fail("auth");
    return result({ retainedFinancialRecords: retainEmployer, processors, auth });
  }

  // The auth delete cascades the profile; this covers the retained-employer path and any
  // cascade drift. Deleting a missing row is a no-op, so it is safe on retry.
  try {
    const r = await sb(`/rest/v1/profiles?id=eq.${enc}`, { method: "DELETE" });
    if (!r.ok) throw new Error(`profiles delete HTTP ${r.status}`);
  } catch (e) {
    fail("profiles", e);
    return result({ retainedFinancialRecords: retainEmployer, processors, auth });
  }

  const final = result({ ok: true, retainedFinancialRecords: retainEmployer, processors, auth });

  // Audit trail: pseudonymous hash + counts, no PII. Tolerates the table being absent (migration 0035).
  try {
    await sb("/rest/v1/account_erasure_log", {
      method: "POST",
      body: JSON.stringify({ user_hash: await sha256Hex(userId), trigger: deps.trigger, retained_financial: retainEmployer, counts, processors }),
    });
  } catch { /* best effort */ }
  log("erase-user: completed", { userHash: (await sha256Hex(userId)).slice(0, 12), trigger: deps.trigger, counts, retained: retainEmployer, processors });

  if (deps.notify && contact.email) {
    try { await deps.notify({ email: contact.email, name: contact.name }); } catch { /* best effort */ }
  }
  return final;
}
