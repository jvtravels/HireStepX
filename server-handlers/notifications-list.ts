export const config = { runtime: "edge" };

import { withAuthAndRateLimit, supabaseServiceHeaders, supabaseUrl, errorResponse } from "./_shared";
import {
  PAGE_SIZE,
  buildListQuery,
  buildUnreadCountQuery,
  parseAudience,
  parseCategory,
  parseContentRange,
  parseCursor,
  parseFilter,
} from "./_notifications-helpers";

interface NotificationRow {
  id: string;
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
  if (!base) return new Response(JSON.stringify({ notifications: [], unreadCount: 0, nextCursor: null }), { status: 200, headers });

  const nowIso = new Date().toISOString();
  const [listRes, countRes] = await Promise.all([
    fetch(
      `${base}/rest/v1/notifications?${buildListQuery({
        userId: auth.userId,
        audience,
        filter: parseFilter(url.searchParams.get("filter")),
        category: parseCategory(url.searchParams.get("category")),
        cursor: parseCursor(url.searchParams.get("cursor")),
        nowIso,
      })}`,
      { headers: supabaseServiceHeaders() },
    ),
    fetch(`${base}/rest/v1/notifications?${buildUnreadCountQuery(auth.userId, audience, nowIso)}`, {
      headers: { ...supabaseServiceHeaders(), Prefer: "count=exact" },
    }),
  ]);
  if (!listRes.ok) return errorResponse(502, "Could not load notifications", headers);

  const rows = (await listRes.json().catch(() => [])) as NotificationRow[];
  const all = Array.isArray(rows) ? rows : [];
  const hasMore = all.length > PAGE_SIZE;
  const notifications = hasMore ? all.slice(0, PAGE_SIZE) : all;
  const nextCursor = hasMore ? notifications[notifications.length - 1].created_at : null;
  const unreadCount = countRes.ok ? parseContentRange(countRes.headers.get("content-range")) : 0;

  return new Response(JSON.stringify({ notifications, unreadCount, nextCursor }), { status: 200, headers });
}
