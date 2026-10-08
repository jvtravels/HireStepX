export const config = { runtime: "edge" };

import { withAuthAndRateLimit, supabaseServiceHeaders, supabaseUrl, errorResponse } from "./_shared";
import { NOTIFICATION_AUDIENCE, type NotificationType } from "./_notify";

type Audience = "employer" | "candidate";
function parseAudience(value: string | null): Audience | null {
  return value === "employer" || value === "candidate" ? value : null;
}

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

  const url = new URL(req.url);
  const audience = parseAudience(url.searchParams.get("audience"));
  if (!audience) return errorResponse(400, "audience must be 'employer' or 'candidate'", headers);

  const base = supabaseUrl();
  if (!base) return new Response(JSON.stringify({ notifications: [], unreadCount: 0 }), { status: 200, headers });

  const res = await fetch(
    `${base}/rest/v1/notifications?user_id=eq.${encodeURIComponent(auth.userId)}&select=id,type,title,body,link,read_at,created_at&order=created_at.desc&limit=50`,
    { headers: supabaseServiceHeaders() },
  );
  if (!res.ok) return errorResponse(502, "Could not load notifications", headers);

  const rows = (await res.json().catch(() => [])) as NotificationRow[];
  const allRows = Array.isArray(rows) ? rows : [];

  // A dual-role account (same auth.users.id as both an `employers` row and a
  // `profiles` row) would otherwise see the other console's notifications
  // leak in, since the table is keyed only on user_id. `audience` names which
  // console is asking (validated above — an invalid/missing value is now a
  // hard 400, not a silent unfiltered fallthrough); types not scoped to that
  // console are dropped here.
  const notifications = allRows.filter((n) => {
    const scope = NOTIFICATION_AUDIENCE[n.type as NotificationType];
    return scope === undefined || scope === "both" || scope === audience;
  });
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return new Response(JSON.stringify({ notifications, unreadCount }), { status: 200, headers });
}
