"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import NotificationList from "./NotificationList";
import NotificationPreferences from "./NotificationPreferences";
import { CATEGORY_LABELS, categoriesForAudience, type Audience, type Category } from "./registry";
import { useNotificationFeed, type FeedFilter, type FeedNotification } from "./useNotificationFeed";

type View = FeedFilter | "settings";

export default function NotificationInbox({ audience }: { audience: Audience }) {
  const router = useRouter();
  const [view, setView] = useState<View>("unread");
  const [category, setCategory] = useState<Category | null>(null);
  const feed = useNotificationFeed(audience, {
    filter: view === "settings" ? "all" : view,
    category,
    enabled: view !== "settings",
  });

  function open(n: FeedNotification) {
    if (!n.read_at) feed.act(n.id, "read");
    if (n.link) router.push(n.link);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-background">
      <span role="status" aria-live="polite" className="sr-only">{feed.announcement}</span>
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <h1 className="m-0 mr-auto text-lg font-semibold text-foreground">Notifications</h1>
        {view !== "settings" && (
          <>
            <NativeSelect
              aria-label="Filter by category"
              value={category ?? ""}
              onChange={(e) => setCategory(e.target.value ? (e.target.value as Category) : null)}
            >
              <NativeSelectOption value="">All categories</NativeSelectOption>
              {categoriesForAudience(audience).map((c) => (
                <NativeSelectOption key={c} value={c}>{CATEGORY_LABELS[c].label}</NativeSelectOption>
              ))}
            </NativeSelect>
            <Button type="button" variant="outline" disabled={feed.unreadCount === 0} onClick={feed.markAllRead}>
              <CheckCheckIcon aria-hidden="true" /> Mark all read
            </Button>
          </>
        )}
      </header>
      <div className="border-b border-border px-4 py-2">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="unread">Unread{feed.unreadCount > 0 ? ` (${feed.unreadCount})` : ""}</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="done">Done</TabsTrigger>
            <TabsTrigger value="settings">Preferences</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
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
            onOpen={open}
            onAction={feed.act}
          />
        )}
      </div>
    </div>
  );
}
