/* Pure helpers extracted from cancel-subscription.ts.
 *
 * Most of cancel-subscription is HTTP glue (Razorpay POST + Supabase PATCH +
 * Resend POST). The pure pieces are:
 *   - parseSubscriptionFromProfile: handle the Supabase array-row response
 *     shape (could be empty, missing fields, etc) without leaking nulls.
 *   - formatSubscriptionEndDate: Indian English date for the cancellation
 *     email — falls back to a humane phrase when the DB field is missing.
 *   - buildCancellationEmailHtml: the email body that the user sees. A bug
 *     here ships an unsafe-looking message or breaks the reactivate link.
 *   - isCancellationBodyTooLarge: 1MB POST body cap (extracted to encode the
 *     constant).
 */

import { escapeHtml } from "./_shared";

export const CANCELLATION_BODY_BYTE_LIMIT = 1_048_576;

export function isCancellationBodyTooLarge(contentLengthHeader: string | undefined | null): boolean {
  const n = parseInt(contentLengthHeader || "0", 10);
  if (!isFinite(n) || n < 0) return false;
  return n > CANCELLATION_BODY_BYTE_LIMIT;
}

export interface SubscriptionProfileRow {
  razorpay_subscription_id?: string | null;
  email?: string | null;
  name?: string | null;
  subscription_end?: string | null;
  subscription_tier?: string | null;
}

/**
 * Supabase REST returns an array — even for `?id=eq.X`. Extract the first
 * row (or null) defensively. Bug here = wrong-user data leaks downstream.
 */
export function parseSubscriptionProfile(rows: unknown): SubscriptionProfileRow | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = rows[0];
  if (!row || typeof row !== "object") return null;
  return row as SubscriptionProfileRow;
}

/**
 * Format an ISO timestamp into Indian English ("3 May 2026"). When the
 * date is missing or invalid, fall back to a clear phrase so the user
 * isn't confused by "Invalid Date" in their email.
 */
export function formatSubscriptionEndDate(iso: string | null | undefined): string {
  if (!iso) return "the end of your billing period";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "the end of your billing period";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export interface CancellationEmailParams {
  userName: string | null | undefined;
  tier: string | null | undefined;
  endDateText: string;
  appUrl: string;
}

/**
 * Cancellation email body. Name is HTML-escaped so a `<script>` in the
 * profile.name field can't be reflected to the user's inbox. Tier and end
 * date are model-controlled / system values and don't need escaping in
 * practice — but we guard anyway.
 */
export function buildCancellationEmailHtml(params: CancellationEmailParams): string {
  const safeName = escapeHtml(params.userName || "there");
  const safeTier = escapeHtml(params.tier || "paid");
  const safeEnd = escapeHtml(params.endDateText);
  const safeUrl = params.appUrl.replace(/\/$/, "");
  return (
    `<p>Hi ${safeName}, your HireStepX <strong>${safeTier}</strong> plan has been cancelled. ` +
    `You'll continue to have access until <strong>${safeEnd}</strong>.</p>` +
    `<p>Changed your mind? You can reactivate anytime from <a href="${safeUrl}/dashboard/settings">Settings</a>.</p>` +
    `<p style="color:#9A9590;font-size:12px;">— The HireStepX Team</p>`
  );
}
