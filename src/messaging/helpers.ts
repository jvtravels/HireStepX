import { useCallback, useEffect, useState } from "react";

export type ViewerRole = "employer" | "candidate";

export interface ThreadMessage {
  id: string;
  senderRole: "employer" | "candidate" | "system";
  body: string;
  attachmentPath: string | null;
  attachmentName: string | null;
  attachmentMime: string | null;
  flagged: boolean;
  createdAt: string;
}

export interface InboxItem {
  matchId: string;
  name: string;
  masked: boolean;
  roleTitle: string;
  lastMessageAt: string | null;
  unread: boolean;
  statusLabel: string;
  statusTone: StatusTone;
}

export type StatusTone = "neutral" | "indigo" | "violet" | "copper" | "success" | "error";

export type ThreadRow =
  | { kind: "day"; key: string; label: string }
  | { kind: "system"; key: string; message: ThreadMessage }
  | { kind: "message"; key: string; message: ThreadMessage; showHeader: boolean };

const GROUP_WINDOW_MS = 5 * 60_000;

export function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, { weekday: diffDays < 7 ? "long" : undefined, day: "numeric", month: "short", year: sameYear ? undefined : "numeric" });
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Compact inbox timestamp: time today, "Yesterday", weekday this week, otherwise a short date. */
export function listTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays <= 0) return clockTime(iso);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: d.getFullYear() === now.getFullYear() ? undefined : "2-digit" });
}

/** Day separators plus Slack-style collapsing of consecutive messages from one sender. */
export function buildThreadRows(messages: ThreadMessage[], now: Date = new Date()): ThreadRow[] {
  const rows: ThreadRow[] = [];
  let lastDay = "";
  let prev: ThreadMessage | null = null;
  for (const m of messages) {
    const day = String(startOfDay(new Date(m.createdAt)));
    if (day !== lastDay) {
      rows.push({ kind: "day", key: `day-${day}`, label: dayLabel(m.createdAt, now) });
      lastDay = day;
      prev = null;
    }
    if (m.senderRole === "system") {
      rows.push({ kind: "system", key: m.id, message: m });
      prev = null;
      continue;
    }
    const continues =
      prev !== null &&
      prev.senderRole === m.senderRole &&
      new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < GROUP_WINDOW_MS;
    rows.push({ kind: "message", key: m.id, message: m, showHeader: !continues });
    prev = m;
  }
  return rows;
}

export function sortInbox(items: InboxItem[]): InboxItem[] {
  return [...items].sort((a, b) => {
    if (a.unread !== b.unread) return a.unread ? -1 : 1;
    const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bt - at;
  });
}

export type InboxFilter = "all" | "unread" | "favorites";

export function filterInbox(items: InboxItem[], filter: InboxFilter, query: string, favorites: ReadonlySet<string>): InboxItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((i) => {
    if (filter === "unread" && !i.unread) return false;
    if (filter === "favorites" && !favorites.has(i.matchId)) return false;
    if (!q) return true;
    return `${i.name} ${i.roleTitle}`.toLowerCase().includes(q);
  });
}

export function attachmentKind(name: string | null, mime: string | null): { ext: string; label: string } {
  const ext = (name?.split(".").pop() ?? "").toLowerCase();
  if (mime?.startsWith("image/")) return { ext: ext || "img", label: "Image" };
  if (mime === "application/pdf" || ext === "pdf") return { ext: "pdf", label: "PDF document" };
  if (["doc", "docx"].includes(ext)) return { ext, label: "Word document" };
  if (["xls", "xlsx", "csv"].includes(ext)) return { ext, label: "Spreadsheet" };
  return { ext: ext || "file", label: "File" };
}

export const CANDIDATE_QUICK_REPLIES = [
  "Thanks for reaching out. I'm interested and happy to chat.",
  "Could you share more about the role and the team?",
  "I'm available for a call this week. What times work for you?",
  "Thanks, but I'm not looking at this right now.",
];

export const EMPLOYER_QUICK_REPLIES = [
  "Hi, we liked your profile and would like to discuss the role. Are you open to a quick call?",
  "Could you share your notice period and expected CTC?",
  "Are you available for an interview this week? Share a couple of slots that work.",
  "Thanks for your time. We'll get back to you with next steps shortly.",
];

const FAV_PREFIX = "hsx.messages.favorites.";

function readFavorites(role: ViewerRole): Set<string> {
  try {
    const raw = window.localStorage.getItem(FAV_PREFIX + role);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

/** Favorites are a per-browser convenience (no server column), so a blocked or cleared store just starts empty. */
export function useFavorites(role: ViewerRole) {
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    setFavorites(readFavorites(role));
  }, [role]);

  const toggle = useCallback((matchId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      try {
        window.localStorage.setItem(FAV_PREFIX + role, JSON.stringify([...next]));
      } catch {
        /* storage unavailable: keep in-memory state only */
      }
      return next;
    });
  }, [role]);

  return { favorites, toggle };
}

/** Pipeline status to pill tone; shared so a status reads the same color on both sides of the product. */
export function statusTone(status: string): StatusTone {
  switch (status) {
    case "shortlisted": return "indigo";
    case "interview_invited": return "violet";
    case "interviewing": return "copper";
    case "hired": return "success";
    case "rejected": return "error";
    default: return "neutral";
  }
}
