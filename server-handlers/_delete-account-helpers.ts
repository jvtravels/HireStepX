/* Pure helpers for delete-account.ts — what the employer / candidate-agency
 * features add to account erasure (DPDP right to erasure vs. financial-record
 * retention). No I/O; unit-tested in src/__tests__/deleteAccountHelpers.test.ts.
 *
 * FK map (supabase-schema.sql + 0032) that drives these decisions:
 *
 *   profiles(id) ON DELETE CASCADE ->  candidate_consent_log, employer_blocks (candidate),
 *                                      employer_reports (reporter), requirement_matches (candidate),
 *                                      conversations / conversation_messages (candidate),
 *                                      match_status_events (candidate)
 *   auth.users(id) ON DELETE CASCADE -> employers, message_flags (flagged_by), notifications,
 *                                      conversation_messages.sender_id
 *   employers(id) ON DELETE CASCADE ->  employer_requirements, employer_unlock_payments,
 *                                      employer_unlock_orders, employer_requirement_activity,
 *                                      employer_blocks / employer_reports (about the employer)
 *
 * So a plain auth-user delete of an EMPLOYER would silently cascade away the
 * payment ledger. Financial records (GST invoices, Razorpay payment ids) must
 * be retained, so an employer with any payment/order rows is anonymised and
 * deactivated instead of hard-deleted. */

export const CHAT_ATTACHMENT_BUCKET = "chat-attachments";
export const EMPLOYER_LOGO_BUCKET = "employer-logos";

/** Tables the candidate-agency feature added; tolerate a missing table (404 / PGRST205) so
 *  deleting an account never fails just because migration 0032 has not run in that environment. */
export const AGENCY_TABLES_TOLERATING_MISSING = new Set([
  "candidate_consent_log",
  "employer_blocks",
  "employer_reports",
  "match_status_events",
  "message_flags",
  "conversation_messages",
  "conversations",
  "requirement_matches",
]);

/** A delete counts as OK when it succeeded, or the (optional) table doesn't exist yet. */
export function deleteSucceeded(table: string, status: number, ok: boolean): boolean {
  if (ok) return true;
  return status === 404 && AGENCY_TABLES_TOLERATING_MISSING.has(table);
}

/** Distinct, non-empty storage paths from conversation_messages rows. */
export function extractAttachmentPaths(rows: unknown): string[] {
  if (!Array.isArray(rows)) return [];
  const out = new Set<string>();
  for (const r of rows) {
    const p = (r as { attachment_path?: unknown } | null)?.attachment_path;
    if (typeof p === "string" && p.length > 0 && !p.includes("..")) out.add(p);
  }
  return [...out];
}

/** Employer accounts keep their financial rows: retain whenever any payment or order exists. */
export function mustRetainEmployerFinancials(counts: { payments: number; orders: number }): boolean {
  return counts.payments > 0 || counts.orders > 0;
}

/** Non-routable replacement email for a deactivated (retained) employer auth user. */
export function anonymisedAuthEmail(userId: string): string {
  return `deleted-${userId.replace(/[^a-zA-Z0-9-]/g, "")}@deleted.invalid`;
}

/** Columns cleared on a retained employer row. gstin / billing_name are deliberately
 *  NOT cleared: they are part of the tax invoice record. */
export function anonymisedEmployerPatch(now: string): Record<string, unknown> {
  return {
    company_name: "",
    website: "",
    logo_path: null,
    suspended_at: now,
    suspended_reason: "account deleted by user",
  };
}
