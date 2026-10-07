/* Writes a row to the `notifications` table (see supabase-schema.sql).
   Single call site for both the candidate and employer consoles — the bell
   in AppShellFrame reads from the same table regardless of which side the
   signed-in user is on, since `type` carries enough context to route the
   client-side link/icon.

   Best-effort by design: a failed write here must never block the caller's
   actual mutation (session save, payment verification, status change).
   Callers fire this after their own write already succeeded and ignore the
   outcome, mirroring the existing fire-and-forget email helpers. */

import { supabaseServiceHeaders, supabaseUrl, slog } from "./_shared";

export type NotificationType =
  | "streak_milestone"
  | "referral_reward"
  | "candidate_status_change"
  | "unlock_confirmed"
  | "payment_success"
  | "payment_failed"
  | "subscription_renewed"
  | "employer_viewed_profile"
  | "matches_ready"
  | "strong_match_found";

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}

export async function notify(input: NotifyInput): Promise<void> {
  const base = supabaseUrl();
  if (!base) return;
  try {
    const res = await fetch(`${base}/rest/v1/notifications`, {
      method: "POST",
      headers: { ...supabaseServiceHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? "",
        link: input.link ?? null,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      slog.warn("[notify] write failed", { status: res.status, type: input.type, body: t.slice(0, 200) });
    }
  } catch (err) {
    slog.warn("[notify] write threw", { err: err instanceof Error ? err.message : String(err), type: input.type });
  }
}
