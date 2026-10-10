/* Writes to the `notifications` table (see supabase-schema.sql). Single call
   site for both consoles; the registry in src/notifications/registry.ts says
   which audience, category and priority each type has.

   Best-effort by design: a failed write must never block the caller's real
   mutation. Callers fire this after their own write succeeded. */

import { supabaseServiceHeaders, supabaseUrl, slog } from "./_shared";
import {
  NOTIFICATION_TYPES,
  isInAppEnabled,
  sanitizePrefs,
  type NotificationType,
  type Priority,
} from "../src/notifications/registry";

export type { NotificationType } from "../src/notifications/registry";

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  /** Defaults to the type's registry priority. */
  priority?: Priority;
  /** Unread rows sharing a key collapse into one row with a count. */
  groupKey?: string;
  /** Label for the row's primary action button, e.g. "Open chat". */
  actionLabel?: string;
}

async function loadPrefs(base: string, userId: string) {
  try {
    const res = await fetch(
      `${base}/rest/v1/notification_preferences?user_id=eq.${encodeURIComponent(userId)}&select=prefs`,
      { headers: supabaseServiceHeaders(), signal: AbortSignal.timeout(3000) },
    );
    if (!res.ok) return sanitizePrefs(null);
    const rows = (await res.json().catch(() => [])) as { prefs?: unknown }[];
    return sanitizePrefs(rows[0]?.prefs);
  } catch {
    return sanitizePrefs(null);
  }
}

async function bumpGroup(base: string, input: NotifyInput, title: string, body: string): Promise<boolean> {
  const lookup = await fetch(
    `${base}/rest/v1/notifications?user_id=eq.${encodeURIComponent(input.userId)}&group_key=eq.${encodeURIComponent(input.groupKey ?? "")}&read_at=is.null&archived_at=is.null&select=id,count&order=created_at.desc&limit=1`,
    { headers: supabaseServiceHeaders(), signal: AbortSignal.timeout(3000) },
  );
  if (!lookup.ok) return false;
  const rows = (await lookup.json().catch(() => [])) as { id: string; count: number }[];
  const existing = rows[0];
  if (!existing) return false;
  const patch = await fetch(`${base}/rest/v1/notifications?id=eq.${encodeURIComponent(existing.id)}`, {
    method: "PATCH",
    headers: { ...supabaseServiceHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({
      count: (existing.count || 1) + 1,
      title,
      body,
      snoozed_until: null,
      created_at: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(3000),
  });
  return patch.ok;
}

export async function notify(input: NotifyInput): Promise<void> {
  const base = supabaseUrl();
  if (!base) return;
  const meta = NOTIFICATION_TYPES[input.type];
  const priority = input.priority ?? meta.priority;
  try {
    const prefs = await loadPrefs(base, input.userId);
    if (!isInAppEnabled(prefs, input.type, priority)) return;

    const title = input.title.slice(0, 200);
    const body = (input.body ?? "").slice(0, 1000);

    if (input.groupKey && (await bumpGroup(base, input, title, body))) return;

    const res = await fetch(`${base}/rest/v1/notifications`, {
      method: "POST",
      headers: { ...supabaseServiceHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: input.userId,
        type: input.type,
        title,
        body,
        link: input.link ?? null,
        priority,
        group_key: input.groupKey ?? null,
        action_label: input.actionLabel ?? null,
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
