import { typesForAudience, type Audience, type Category, CATEGORY_LABELS, NOTIFICATION_TYPES, type NotificationType } from "../src/notifications/registry";

export const PAGE_SIZE = 30;
export type ListFilter = "all" | "unread" | "done";

export function parseAudience(value: unknown): Audience | null {
  return value === "employer" || value === "candidate" ? value : null;
}

export function parseFilter(value: string | null): ListFilter {
  return value === "unread" || value === "done" ? value : "all";
}

export function parseCategory(value: string | null): Category | null {
  return value && Object.hasOwn(CATEGORY_LABELS, value) ? (value as Category) : null;
}

export function parseCursor(value: string | null): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** Types visible to the caller, optionally narrowed to one category, as a PostgREST `in.()` list. */
export function typeInList(audience: Audience, category: Category | null): string {
  const types = typesForAudience(audience).filter((t: NotificationType) => !category || NOTIFICATION_TYPES[t].category === category);
  return `in.(${types.join(",")})`;
}

export function buildListQuery(opts: { userId: string; audience: Audience; filter: ListFilter; category: Category | null; cursor: string | null; nowIso: string }): string {
  const { userId, audience, filter, category, cursor, nowIso } = opts;
  const q = [
    `user_id=eq.${encodeURIComponent(userId)}`,
    `type=${typeInList(audience, category)}`,
    "select=id,type,title,body,link,read_at,created_at,priority,count,action_label,snoozed_until,archived_at",
    "order=created_at.desc",
    `limit=${PAGE_SIZE + 1}`,
  ];
  if (filter === "done") q.push("archived_at=not.is.null");
  else {
    q.push("archived_at=is.null");
    q.push(`or=(snoozed_until.is.null,snoozed_until.lte.${nowIso})`);
    if (filter === "unread") q.push("read_at=is.null");
  }
  if (cursor) q.push(`created_at=lt.${encodeURIComponent(cursor)}`);
  return q.join("&");
}

export function buildUnreadCountQuery(userId: string, audience: Audience, nowIso: string): string {
  return [
    `user_id=eq.${encodeURIComponent(userId)}`,
    `type=${typeInList(audience, null)}`,
    "read_at=is.null",
    "archived_at=is.null",
    `or=(snoozed_until.is.null,snoozed_until.lte.${nowIso})`,
    "select=id",
    "limit=1",
  ].join("&");
}

export function parseContentRange(header: string | null): number {
  const total = header?.split("/")[1];
  const n = total ? Number(total) : 0;
  return Number.isFinite(n) ? n : 0;
}

export type TriageAction = "read" | "unread" | "done" | "restore" | "snooze" | "unsnooze" | "read_all";

export interface TriageBody {
  action?: unknown;
  id?: unknown;
  audience?: unknown;
  until?: unknown;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SNOOZE_MS = 31 * 86_400_000;

export type TriagePlan =
  | { ok: true; filter: string; patch: Record<string, string | null> }
  | { ok: false; error: string };

export function planTriage(userId: string, body: TriageBody, now: Date): TriagePlan {
  const action = body.action as TriageAction | undefined;
  const nowIso = now.toISOString();
  const own = `user_id=eq.${encodeURIComponent(userId)}`;

  if (action === "read_all") {
    const audience = parseAudience(body.audience);
    if (!audience) return { ok: false, error: "audience is required for read_all" };
    return { ok: true, filter: `${own}&type=${typeInList(audience, null)}&read_at=is.null&archived_at=is.null`, patch: { read_at: nowIso } };
  }

  if (typeof body.id !== "string" || !UUID.test(body.id)) return { ok: false, error: "A valid id is required" };
  const filter = `id=eq.${body.id}&${own}`;

  switch (action) {
    case "read": return { ok: true, filter, patch: { read_at: nowIso } };
    case "unread": return { ok: true, filter, patch: { read_at: null } };
    case "done": return { ok: true, filter, patch: { archived_at: nowIso, read_at: nowIso } };
    case "restore": return { ok: true, filter, patch: { archived_at: null } };
    case "unsnooze": return { ok: true, filter, patch: { snoozed_until: null } };
    case "snooze": {
      const t = typeof body.until === "string" ? Date.parse(body.until) : NaN;
      if (Number.isNaN(t) || t <= now.getTime() || t - now.getTime() > MAX_SNOOZE_MS) return { ok: false, error: "until must be a future time within 31 days" };
      return { ok: true, filter, patch: { snoozed_until: new Date(t).toISOString() } };
    }
    default: return { ok: false, error: "Unknown action" };
  }
}
