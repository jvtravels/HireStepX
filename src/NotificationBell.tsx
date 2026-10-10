"use client";

import { useState } from "react";
import { ArrowLeftIcon, BellIcon, CheckCheckIcon, SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CountBadge from "./CountBadge";
import NotificationList from "./notifications/NotificationList";
import NotificationPreferences from "./notifications/NotificationPreferences";
import { useNotificationFeed, type FeedFilter, type FeedNotification } from "./notifications/useNotificationFeed";

/* Header bell, rendered once in AppShellFrame for both consoles. Polls the feed
   (pauses on hidden tabs) so the badge stays fresh. The panel is the only
   notifications surface: tabs, triage actions and preferences all live here. */

export default function NotificationBell({
  onNavigate,
  audience,
}: {
  onNavigate: (path: string) => void;
  audience: "candidate" | "employer";
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<FeedFilter | "settings">("all");
  const feed = useNotificationFeed(audience, { filter: view === "settings" ? "all" : view });

  function openItem(n: FeedNotification) {
    if (!n.read_at) feed.act(n.id, "read");
    if (n.link) {
      setOpen(false);
      onNavigate(n.link);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void feed.reload();
      }}
    >
      <Button
        type="button"
        variant="outline"
        aria-label={feed.unreadCount > 0 ? `Notifications (${feed.unreadCount} unread)` : "Notifications"}
        className="relative h-auto shrink-0 p-2"
        onClick={() => setOpen(true)}
      >
        <BellIcon size={16} aria-hidden="true" />
        <CountBadge count={feed.unreadCount} />
      </Button>
      <span role="status" aria-live="polite" className="sr-only">{feed.announcement}</span>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{view === "settings" ? "Notification preferences" : "Notifications"}</SheetTitle>
          <SheetDescription className="sr-only">Recent activity on your account.</SheetDescription>
          <div className="flex items-center gap-1 pt-1">
            {view === "settings" ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => setView("all")}>
                <ArrowLeftIcon aria-hidden="true" /> Back
              </Button>
            ) : (
              <>
                <Tabs value={view} onValueChange={(v) => setView(v as FeedFilter)}>
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="unread">Unread{feed.unreadCount > 0 ? ` (${feed.unreadCount})` : ""}</TabsTrigger>
                    <TabsTrigger value="done">Done</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="ml-auto"
                  aria-label="Notification preferences"
                  onClick={() => setView("settings")}
                >
                  <SettingsIcon aria-hidden="true" />
                </Button>
              </>
            )}
          </div>
          {view !== "settings" && (
            <Button type="button" size="sm" variant="ghost" className="self-start" disabled={feed.unreadCount === 0} onClick={feed.markAllRead}>
              <CheckCheckIcon aria-hidden="true" /> Mark all read
            </Button>
          )}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {view === "settings" ? (
            <NotificationPreferences audience={audience} />
          ) : (
            <NotificationList
              items={feed.items}
              loading={feed.loading}
              error={feed.error}
              loadingMore={feed.loadingMore}
              hasMore={feed.hasMore}
              filter={view}
              onRetry={feed.reload}
              onLoadMore={feed.loadMore}
              onOpen={openItem}
              onAction={feed.act}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
