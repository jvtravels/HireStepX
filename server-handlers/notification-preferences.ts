export const config = { runtime: "edge" };

import {
  withAuthAndRateLimit,
  supabaseServiceHeaders,
  supabaseUrl,
  readBodyWithSizeLimit,
  errorResponse,
} from "./_shared";
import { sanitizePrefs } from "../src/notifications/registry";

/** POST `{}` returns the caller's prefs; POST `{ prefs }` replaces them. */
export default async function handler(req: Request): Promise<Response> {
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "notification-preferences",
    ipLimit: 40,
    userLimit: 20,
    maxBytes: 4_000,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;
  if (!auth.userId) return errorResponse(401, "Unauthorized", headers);

  const base = supabaseUrl();
  if (!base) return new Response(JSON.stringify({ prefs: sanitizePrefs(null) }), { status: 200, headers });

  let body: { prefs?: unknown };
  try {
    body = JSON.parse(await readBodyWithSizeLimit(req, 4_000));
  } catch (err) {
    if (err instanceof Response) return err;
    return errorResponse(400, "Invalid request body", headers);
  }
  if (body.prefs === undefined) {
    const res = await fetch(`${base}/rest/v1/notification_preferences?user_id=eq.${encodeURIComponent(auth.userId)}&select=prefs`, {
      headers: supabaseServiceHeaders(),
    });
    if (!res.ok) return errorResponse(502, "Could not load preferences", headers);
    const rows = (await res.json().catch(() => [])) as { prefs?: unknown }[];
    return new Response(JSON.stringify({ prefs: sanitizePrefs(rows[0]?.prefs) }), { status: 200, headers });
  }
  const prefs = sanitizePrefs(body.prefs);
  const res = await fetch(`${base}/rest/v1/notification_preferences?on_conflict=user_id`, {
    method: "POST",
    headers: { ...supabaseServiceHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ user_id: auth.userId, prefs, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) return errorResponse(502, "Could not save preferences", headers);
  return new Response(JSON.stringify({ prefs }), { status: 200, headers });
}
