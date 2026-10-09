"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { BellIcon } from "lucide-react";
import { apiFetch } from "./apiClient";
import { tokens as T, fonts as F } from "./auth/_tokens";
import CountBadge from "./CountBadge";

/* ─── Notification bell ──────────────────────────────────────────────────
 * Rendered once in AppShellFrame's header, so it appears on every candidate
 * and employer screen. Polls /api/notifications/list on an interval rather
 * than opening a socket — the feed is informational, not real-time-critical,
 * and this keeps the feature infra-free (no websocket/SSE server needed).
 * Opens as a slide-out Sheet panel (not a small dropdown) so a long feed has
 * room to breathe, matching the app shell's sidebar-style slide panels. */

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
  const [announcement, setAnnouncement] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Guards the poll from clobbering an optimistic mark-read/mark-all-read
  // update that's still in flight — without this, a poll tick landing
  // between the optimistic state write and the PATCH response could
  // resurrect a notification's unread state right after the user cleared it.
  const pendingMutations = useRef(0);
  const prevUnreadRef = useRef(0);
  const firstLoadRef = useRef(true);

  async function load() {
    const res = await apiFetch<{ notifications: Notification[]; unreadCount: number }>(
      `/api/notifications/list?audience=${audience}`,
      {},
    );
    if (res.ok && res.data && pendingMutations.current === 0) {
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unreadCount);
      if (!firstLoadRef.current && res.data.unreadCount > prevUnreadRef.current) {
        const delta = res.data.unreadCount - prevUnreadRef.current;
        setAnnouncement(delta === 1 ? "1 new notification" : `${delta} new notifications`);
      }
      firstLoadRef.current = false;
      prevUnreadRef.current = res.data.unreadCount;
    }
  }

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [audience]);

  async function markRead(id: string) {
    pendingMutations.current += 1;
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    setUnreadCount((prev) => {
      const next = Math.max(0, prev - 1);
      prevUnreadRef.current = next;
      return next;
    });
    await apiFetch("/api/notifications/mark-read", { id });
    pendingMutations.current = Math.max(0, pendingMutations.current - 1);
  }

  async function markAllRead() {
    pendingMutations.current += 1;
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    setUnreadCount(0);
    prevUnreadRef.current = 0;
    await apiFetch("/api/notifications/mark-read", { all: true });
    pendingMutations.current = Math.max(0, pendingMutations.current - 1);
  }

  function handleItemClick(n: Notification) {
    if (!n.read_at) markRead(n.id);
    if (n.link) {
      setOpen(false);
      onNavigate(n.link);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
        className="p-2 h-auto"
        style={{ position: "relative", flexShrink: 0 }}
        onClick={() => setOpen(true)}
      >
        <BellIcon size={16} aria-hidden="true" style={{ color: T.coal }} />
        <CountBadge count={unreadCount} />
      </Button>
      {/* Visually hidden — announces new notifications to screen-reader
          users even while the panel is closed, since nothing else here does. */}
      <span
        role="status"
        aria-live="polite"
        style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}
      >
        {announcement}
      </span>
      <SheetContent side="right" className="w-full sm:max-w-sm p-0 flex flex-col">
        <SheetHeader className="flex-row items-center justify-between gap-2 border-b" style={{ borderColor: T.line }}>
          <SheetTitle style={{ fontFamily: F.sans, color: T.coal }}>Notifications</SheetTitle>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 0, marginRight: 32,
                fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: T.indigo,
              }}
            >
              Mark all read
            </button>
          )}
        </SheetHeader>
        <div style={{ flex: 1, overflowY: "auto" }} role="list" aria-label="Notifications">
          {notifications.length === 0 ? (
            <p style={{ margin: 0, padding: "32px 16px", textAlign: "center", fontFamily: F.sans, fontSize: 13, color: T.inkSoft }}>
              You're all caught up.
            </p>
          ) : (
            notifications.map((n) => {
              const body = (
                <>
                  <p style={{ margin: 0, fontFamily: F.sans, fontSize: 13.5, fontWeight: 600, color: T.coal, display: "flex", alignItems: "center", gap: 6 }}>
                    {!n.read_at && (
                      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: T.indigo, flexShrink: 0 }} />
                    )}
                    {n.title}
                  </p>
                  {n.body && (
                    <p style={{ margin: "3px 0 0", fontFamily: F.sans, fontSize: 12.5, color: T.inkSoft, lineHeight: 1.4 }}>
                      {n.body}
                    </p>
                  )}
                  <p style={{ margin: "5px 0 0", fontFamily: F.sans, fontSize: 11, color: T.inkSoft }}>
                    {timeAgo(n.created_at)}
                  </p>
                </>
              );
              // Not every notification links somewhere — rendering those as a
              // full-row button produced a dead click with no feedback.
              // Non-navigational ones render as a static row, with an
              // explicit "Mark as read" affordance instead of an implicit
              // whole-row click that does nothing visible.
              if (!n.link) {
                return (
                  <div key={n.id} role="listitem" style={{ borderBottom: `1px solid ${T.line}`, background: n.read_at ? "transparent" : T.pageBg, padding: "12px 16px" }}>
                    {body}
                    {!n.read_at && (
                      <button
                        type="button"
                        onClick={() => markRead(n.id)}
                        style={{ marginTop: 6, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: F.sans, fontSize: 11.5, fontWeight: 600, color: T.indigo }}
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                );
              }
              return (
                <div key={n.id} role="listitem">
                  <button
                    type="button"
                    onClick={() => handleItemClick(n)}
                    style={{
                      display: "block", width: "100%", textAlign: "left", cursor: "pointer",
                      border: "none", borderBottom: `1px solid ${T.line}`, background: n.read_at ? "transparent" : T.pageBg,
                      padding: "12px 16px",
                    }}
                  >
                    {body}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
