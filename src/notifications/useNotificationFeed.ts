"use client";

import { useCallback, useRef, useState } from "react";
import { apiFetch } from "../apiClient";
import { usePolling } from "../usePolling";
import { playUiSound } from "../uiSounds";
import type { Audience, Category } from "./registry";

export interface FeedNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
  priority: "critical" | "normal" | "low";
  count: number;
  action_label: string | null;
  snoozed_until: string | null;
  archived_at: string | null;
}

export type FeedFilter = "all" | "unread" | "done";
type Action = "read" | "unread" | "done" | "restore" | "snooze";

interface ListResponse {
  notifications: FeedNotification[];
  unreadCount: number;
  nextCursor: string | null;
}

const POLL_MS = 60_000;

export function useNotificationFeed(audience: Audience, opts: { filter?: FeedFilter; category?: Category | null; enabled?: boolean } = {}) {
  const { filter = "all", category = null, enabled = true } = opts;
  const [items, setItems] = useState<FeedNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const pending = useRef(0);
  const prevUnread = useRef<number | null>(null);

  const query = useCallback(
    (cursor?: string | null) => {
      const p = new URLSearchParams({ audience, filter });
      if (category) p.set("category", category);
      if (cursor) p.set("cursor", cursor);
      return `/api/notifications/list?${p.toString()}`;
    },
    [audience, filter, category],
  );

  const load = useCallback(async (): Promise<boolean> => {
    const res = await apiFetch<ListResponse>(query(), {});
    if (!res.ok || !res.data) {
      setError(true);
      setLoading(false);
      return false;
    }
    if (pending.current === 0) {
      setItems(res.data.notifications);
      setNextCursor(res.data.nextCursor);
      setUnreadCount(res.data.unreadCount);
      if (prevUnread.current !== null && res.data.unreadCount > prevUnread.current) {
        const delta = res.data.unreadCount - prevUnread.current;
        setAnnouncement(delta === 1 ? "1 new notification" : `${delta} new notifications`);
        playUiSound("notification");
      }
      prevUnread.current = res.data.unreadCount;
    }
    setError(false);
    setLoading(false);
    return true;
  }, [query]);

  usePolling(load, POLL_MS, { restartKey: `${audience}|${filter}|${category ?? ""}`, enabled });

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const res = await apiFetch<ListResponse>(query(nextCursor), {});
    if (res.ok && res.data) {
      const more = res.data.notifications;
      setItems((prev) => [...prev, ...more.filter((n) => !prev.some((p) => p.id === n.id))]);
      setNextCursor(res.data.nextCursor);
    }
    setLoadingMore(false);
  }, [nextCursor, loadingMore, query]);

  const send = useCallback(async (body: Record<string, unknown>) => {
    pending.current += 1;
    const res = await apiFetch("/api/notifications/mark-read", body);
    pending.current = Math.max(0, pending.current - 1);
    return res.ok;
  }, []);

  const act = useCallback(
    async (id: string, action: Action, until?: Date) => {
      const target = items.find((n) => n.id === id);
      if (!target) return;
      const wasUnread = !target.read_at;
      const removes = action === "done" || action === "snooze" || action === "restore" || (action === "read" && filter === "unread");
      const now = new Date().toISOString();
      setItems((prev) =>
        removes && action !== "read"
          ? prev.filter((n) => n.id !== id)
          : prev.map((n) => (n.id === id ? { ...n, read_at: action === "unread" ? null : now } : n)),
      );
      const delta = action === "unread" ? (wasUnread ? 0 : 1) : action === "restore" ? 0 : wasUnread ? -1 : 0;
      setUnreadCount((c) => {
        const next = Math.max(0, c + delta);
        prevUnread.current = next;
        return next;
      });
      const ok = await send({ id, action, ...(until ? { until: until.toISOString() } : {}) });
      if (!ok) await load();
    },
    [items, filter, send, load],
  );

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    setUnreadCount(0);
    prevUnread.current = 0;
    const ok = await send({ action: "read_all", audience });
    if (!ok) await load();
  }, [audience, send, load]);

  return { items, unreadCount, loading, error, loadingMore, hasMore: nextCursor !== null, announcement, reload: load, loadMore, act, markAllRead };
}
