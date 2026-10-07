export const config = { runtime: "edge" };

import { withAuthAndRateLimit, supabaseServiceHeaders, supabaseUrl, errorResponse } from "./_shared";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export default async function handler(req: Request): Promise<Response> {
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "notifications-list",
    ipLimit: 60,
    userLimit: 30,
    maxBytes: 2_000,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;
  if (!auth.userId) return errorResponse(401, "Unauthorized", headers);

  const base = supabaseUrl();
  if (!base) return new Response(JSON.stringify({ notifications: [], unreadCount: 0 }), { status: 200, headers });

  const res = await fetch(
    `${base}/rest/v1/notifications?user_id=eq.${encodeURIComponent(auth.userId)}&select=id,type,title,body,link,read_at,created_at&order=created_at.desc&limit=50`,
    { headers: supabaseServiceHeaders() },
  );
  if (!res.ok) return errorResponse(502, "Could not load notifications", headers);

  const rows = (await res.json().catch(() => [])) as NotificationRow[];
  const notifications = Array.isArray(rows) ? rows : [];
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return new Response(JSON.stringify({ notifications, unreadCount }), { status: 200, headers });
}
