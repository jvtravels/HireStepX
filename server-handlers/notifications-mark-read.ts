export const config = { runtime: "edge" };

import {
  withAuthAndRateLimit,
  supabaseServiceHeaders,
  supabaseUrl,
  readBodyWithSizeLimit,
  errorResponse,
} from "./_shared";

export default async function handler(req: Request): Promise<Response> {
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "notifications-mark-read",
    ipLimit: 60,
    userLimit: 30,
    maxBytes: 2_000,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;
  if (!auth.userId) return errorResponse(401, "Unauthorized", headers);

  let body: { id?: string; all?: boolean };
  try {
    body = JSON.parse(await readBodyWithSizeLimit(req, 2_000));
  } catch (err) {
    if (err instanceof Response) return err;
    return errorResponse(400, "Invalid request body", headers);
  }

  const base = supabaseUrl();
  if (!base) return new Response(JSON.stringify({ ok: true }), { status: 200, headers });

  const filter = body.all
    ? `user_id=eq.${encodeURIComponent(auth.userId)}&read_at=is.null`
    : body.id
      ? `id=eq.${encodeURIComponent(body.id)}&user_id=eq.${encodeURIComponent(auth.userId)}`
      : null;
  if (!filter) return errorResponse(400, "Provide id or all", headers);

  const res = await fetch(`${base}/rest/v1/notifications?${filter}`, {
    method: "PATCH",
    headers: { ...supabaseServiceHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({ read_at: new Date().toISOString() }),
  });
  if (!res.ok) return errorResponse(502, "Could not update notifications", headers);

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
