/* Pure registry shared by the server (notify, handlers) and the client (inbox UI).
   No imports on purpose: it must stay edge- and browser-safe. */

export type Audience = "candidate" | "employer";
export type Priority = "critical" | "normal" | "low";
export type Category = "messages" | "applications" | "billing" | "rewards" | "matches" | "activity";

export interface TypeMeta {
  audience: Audience | "both";
  category: Category;
  priority: Priority;
}

export const NOTIFICATION_TYPES = {
  streak_milestone: { audience: "candidate", category: "rewards", priority: "low" },
  referral_reward: { audience: "candidate", category: "rewards", priority: "normal" },
  candidate_status_change: { audience: "candidate", category: "applications", priority: "normal" },
  employer_viewed_profile: { audience: "candidate", category: "activity", priority: "low" },
  unlock_confirmed: { audience: "employer", category: "billing", priority: "normal" },
  matches_ready: { audience: "employer", category: "matches", priority: "normal" },
  strong_match_found: { audience: "employer", category: "matches", priority: "normal" },
  candidate_responded: { audience: "employer", category: "messages", priority: "normal" },
  payment_success: { audience: "both", category: "billing", priority: "normal" },
  payment_failed: { audience: "both", category: "billing", priority: "critical" },
  subscription_renewed: { audience: "both", category: "billing", priority: "low" },
  new_message_candidate: { audience: "candidate", category: "messages", priority: "normal" },
  new_message_employer: { audience: "employer", category: "messages", priority: "normal" },
  new_message: { audience: "both", category: "messages", priority: "normal" },
} as const satisfies Record<string, TypeMeta>;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;

export const CATEGORY_LABELS: Record<Category, { label: string; description: string }> = {
  messages: { label: "Messages", description: "Replies and new conversations" },
  applications: { label: "Applications", description: "Status changes on roles you are in" },
  matches: { label: "Matches", description: "New and strong candidate matches" },
  billing: { label: "Billing", description: "Payments, unlocks and renewals" },
  rewards: { label: "Rewards", description: "Streaks and referral credits" },
  activity: { label: "Activity", description: "Profile views and other signals" },
};

export function typeMeta(type: string): TypeMeta | null {
  return Object.hasOwn(NOTIFICATION_TYPES, type) ? NOTIFICATION_TYPES[type as NotificationType] : null;
}

export function visibleTo(type: string, audience: Audience): boolean {
  const m = typeMeta(type);
  return m === null || m.audience === "both" || m.audience === audience;
}

export function typesForAudience(audience: Audience): NotificationType[] {
  return (Object.keys(NOTIFICATION_TYPES) as NotificationType[]).filter((t) => visibleTo(t, audience));
}

export function categoriesForAudience(audience: Audience): Category[] {
  return [...new Set(typesForAudience(audience).map((t) => NOTIFICATION_TYPES[t].category))];
}

/* ── Preferences ── */

export interface NotificationPrefs {
  /** Per category in-app on/off. Missing means on. Critical items ignore this. */
  inApp: Partial<Record<Category, boolean>>;
}

export const DEFAULT_PREFS: NotificationPrefs = { inApp: {} };

export function isInAppEnabled(prefs: NotificationPrefs, type: string, priority: Priority): boolean {
  if (priority === "critical") return true;
  const m = typeMeta(type);
  if (!m) return true;
  return prefs.inApp[m.category] !== false;
}

export function sanitizePrefs(input: unknown): NotificationPrefs {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const inApp: Partial<Record<Category, boolean>> = {};
  if (o.inApp && typeof o.inApp === "object") {
    for (const c of Object.keys(CATEGORY_LABELS) as Category[]) {
      const val = (o.inApp as Record<string, unknown>)[c];
      if (typeof val === "boolean") inApp[c] = val;
    }
  }
  return { inApp };
}

/* ── Presentation helpers ── */

export interface DayGroup<T extends { created_at: string }> {
  key: string;
  label: string;
  items: T[];
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function dayGroupLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const diff = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return "This week";
  if (diff < 30) return "This month";
  return "Earlier";
}

export function groupByDay<T extends { created_at: string }>(items: T[], now: Date = new Date()): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const label = dayGroupLabel(item.created_at, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ key: label, label, items: [item] });
  }
  return groups;
}

export function timeAgo(iso: string, now: number = Date.now()): string {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export const SNOOZE_OPTIONS = [
  { id: "1h", label: "1 hour", ms: 3_600_000 },
  { id: "tomorrow", label: "Tomorrow morning", ms: 0 },
  { id: "week", label: "Next week", ms: 7 * 86_400_000 },
] as const;

export function snoozeUntil(id: string, now: Date = new Date()): Date | null {
  if (id === "1h") return new Date(now.getTime() + 3_600_000);
  if (id === "week") return new Date(now.getTime() + 7 * 86_400_000);
  if (id === "tomorrow") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  }
  return null;
}
