export const config = { runtime: "edge" };

import {
  withAuthAndRateLimit,
  supabaseServiceHeaders,
  supabaseUrl,
  readBodyWithSizeLimit,
  errorResponse,
} from "./_shared";
import { planTriage, type TriageBody } from "./_notifications-helpers";

/** Triage actions: read, unread, done, restore, snooze, unsnooze, read_all (audience-scoped). */
export default async function handler(req: Request): Promise<Response> {
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "notifications-mark-read",
    ipLimit: 60,
    userLimit: 60,
    maxBytes: 2_000,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;
  if (!auth.userId) return errorResponse(401, "Unauthorized", headers);

  let body: TriageBody;
  try {
    body = JSON.parse(await readBodyWithSizeLimit(req, 2_000));
  } catch (err) {
    if (err instanceof Response) return err;
    return errorResponse(400, "Invalid request body", headers);
  }

  const plan = planTriage(auth.userId, body, new Date());
  if (!plan.ok) return errorResponse(400, plan.error, headers);

  const base = supabaseUrl();
  if (!base) return new Response(JSON.stringify({ ok: true }), { status: 200, headers });

  const res = await fetch(`${base}/rest/v1/notifications?${plan.filter}`, {
    method: "PATCH",
    headers: { ...supabaseServiceHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify(plan.patch),
  });
  if (!res.ok) return errorResponse(502, "Could not update notifications", headers);

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
