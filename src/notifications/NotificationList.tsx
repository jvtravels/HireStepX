"use client";

import { useMemo, useState } from "react";
import { AlertCircleIcon, BellOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import NotificationItem from "./NotificationItem";
import { groupByDay } from "./registry";
import type { FeedNotification, FeedFilter } from "./useNotificationFeed";

interface Props {
  items: FeedNotification[];
  loading: boolean;
  error: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  filter: FeedFilter;
  onRetry: () => void;
  onLoadMore: () => void;
  onOpen: (n: FeedNotification) => void;
  onAction: (id: string, action: "read" | "unread" | "done" | "restore" | "snooze", until?: Date) => void;
}

const EMPTY: Record<FeedFilter, { title: string; hint: string }> = {
  all: { title: "You're all caught up", hint: "New activity will show up here." },
  unread: { title: "Nothing unread", hint: "Switch to All to see earlier notifications." },
  done: { title: "Nothing marked done", hint: "Items you mark as done are kept here." },
};

export default function NotificationList({ items, loading, error, loadingMore, hasMore, filter, onRetry, onLoadMore, onOpen, onAction }: Props) {
  const groups = useMemo(() => groupByDay(items), [items]);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div role="alert" className="m-auto flex flex-col items-center gap-2.5 px-6 py-10 text-center">
        <AlertCircleIcon aria-hidden="true" className="size-6 text-muted-foreground" />
        <p className="m-0 text-sm font-semibold text-foreground">Couldn&apos;t load notifications</p>
        <Button type="button" variant="outline" onClick={onRetry}>Retry</Button>
      </div>
    );
  }

  if (items.length === 0) {
    const e = EMPTY[filter];
    return (
      <div className="m-auto flex max-w-xs flex-col items-center gap-2 px-6 py-10 text-center">
        <BellOffIcon aria-hidden="true" className="size-6 text-muted-foreground" />
        <p className="m-0 text-sm font-semibold text-foreground">{e.title}</p>
        <p className="m-0 text-[13px] text-muted-foreground">{e.hint}</p>
      </div>
    );
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, [role=menu]")) return;
    const k = e.key.toLowerCase();
    if (k !== "j" && k !== "k") return;
    e.preventDefault();
    setFocusIdx((i) => {
      const next = i === null ? 0 : k === "j" ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1);
      document.querySelector<HTMLElement>(`[data-notification-id="${items[next]?.id}"] button`)?.focus();
      return next;
    });
  }

  let flat = -1;
  return (
    // Keyboard handler lives on the list container so J/K work while any row control has focus.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div onKeyDown={onKeyDown} role="region" aria-label="Notifications list">
      {error && (
        <div role="status" className="bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          Couldn&apos;t refresh. Showing what we have.
        </div>
      )}
      {groups.map((g) => (
        <section key={g.key} aria-label={g.label}>
          <h3 className="sticky top-0 z-[1] m-0 border-b border-border bg-background/95 px-4 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase backdrop-blur-sm">
            {g.label}
          </h3>
          <ul role="list" className="m-0 list-none p-0">
            {g.items.map((n) => {
              flat += 1;
              return <NotificationItem key={n.id} n={n} done={filter === "done"} focused={focusIdx === flat} onOpen={onOpen} onAction={onAction} />;
            })}
          </ul>
        </section>
      ))}
      {hasMore && (
        <div className="flex justify-center p-3">
          <Button type="button" variant="ghost" size="sm" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? <Spinner className="size-4" /> : null} Load older
          </Button>
        </div>
      )}
    </div>
  );
}
