"use client";

import { useEffect, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { BellIcon } from "lucide-react";
import { apiFetch } from "./apiClient";
import { tokens as T, fonts as F } from "./auth/_tokens";
import CountBadge from "./CountBadge";

/* ─── Notification bell ──────────────────────────────────────────────────
 * Rendered once in AppShellFrame's header, so it appears on every candidate
 * and employer screen. Polls /api/notifications/list on an interval rather
 * than opening a socket — the feed is informational, not real-time-critical,
 * and this keeps the feature infra-free (no websocket/SSE server needed). */

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

const POLL_MS = 60_000;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell({
  onNavigate,
  audience,
}: {
  onNavigate: (path: string) => void;
  /** Which console is rendering the bell — scopes the feed so an
   *  employer-only or candidate-only notification never leaks to the
   *  other side on a dual-role account. See AppShellFrame's `audience` prop. */
  audience: "candidate" | "employer";
}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    const res = await apiFetch<{ notifications: Notification[]; unreadCount: number }>(
      `/api/notifications/list?audience=${audience}`,
      {},
    );
    if (res.ok && res.data) {
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unreadCount);
    }
  }

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [audience]);

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    await apiFetch("/api/notifications/mark-read", { id });
  }

  async function markAllRead() {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    setUnreadCount(0);
    await apiFetch("/api/notifications/mark-read", { all: true });
  }

  function handleItemClick(n: Notification) {
    setOpen(false);
    if (!n.read_at) markRead(n.id);
    if (n.link) onNavigate(n.link);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
          className="p-2 h-auto"
          style={{ position: "relative", flexShrink: 0 }}
        >
          <BellIcon size={16} aria-hidden="true" style={{ color: T.coal }} />
          <CountBadge count={unreadCount} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" style={{ width: 340, padding: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px" }}>
          <DropdownMenuLabel className="p-0 font-normal" style={{ fontFamily: F.sans, fontSize: 13.5, fontWeight: 600, color: T.coal }}>
            Notifications
          </DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 0,
                fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: T.indigo,
              }}
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {notifications.length === 0 ? (
            <p style={{ margin: 0, padding: "24px 12px", textAlign: "center", fontFamily: F.sans, fontSize: 13, color: T.inkSoft }}>
              You're all caught up.
            </p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleItemClick(n)}
                style={{
                  display: "block", width: "100%", textAlign: "left", cursor: "pointer",
                  border: "none", borderBottom: `1px solid ${T.line}`, background: n.read_at ? "transparent" : T.pageBg,
                  padding: "10px 12px",
                }}
              >
                <p style={{ margin: 0, fontFamily: F.sans, fontSize: 13, fontWeight: 600, color: T.coal, display: "flex", alignItems: "center", gap: 6 }}>
                  {!n.read_at && (
                    <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: T.indigo, flexShrink: 0 }} />
                  )}
                  {n.title}
                </p>
                {n.body && (
                  <p style={{ margin: "2px 0 0", fontFamily: F.sans, fontSize: 12.5, color: T.inkSoft, lineHeight: 1.4 }}>
                    {n.body}
                  </p>
                )}
                <p style={{ margin: "4px 0 0", fontFamily: F.sans, fontSize: 11, color: T.inkSoft }}>
                  {timeAgo(n.created_at)}
                </p>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
