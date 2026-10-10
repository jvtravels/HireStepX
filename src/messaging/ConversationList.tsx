"use client";

import { useId } from "react";
import { AlertCircleIcon, SearchIcon, StarIcon, XIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import StatusPill from "./StatusPill";
import { initialsOf, listTime, type InboxFilter, type InboxItem } from "./helpers";

interface ConversationListProps {
  title: string;
  items: InboxItem[];
  total: number;
  activeMatchId: string | null;
  favorites: ReadonlySet<string>;
  filter: InboxFilter;
  query: string;
  unreadCount: number;
  refreshFailed: boolean;
  onFilterChange: (f: InboxFilter) => void;
  onQueryChange: (q: string) => void;
  onSelect: (matchId: string) => void;
  onToggleFavorite: (matchId: string) => void;
  onRetry: () => void;
}

const CHIPS: { id: InboxFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "favorites", label: "Favorites" },
];

export default function ConversationList({
  title, items, total, activeMatchId, favorites, filter, query, unreadCount, refreshFailed,
  onFilterChange, onQueryChange, onSelect, onToggleFavorite, onRetry,
}: ConversationListProps) {
  const searchId = useId();
  const filtering = filter !== "all" || query.trim() !== "";

  return (
    <nav aria-label="Conversations" className="flex h-full min-h-0 w-full flex-col bg-background">
      <div className="flex flex-col gap-3 border-b border-border px-4 pt-4 pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="m-0 text-lg font-semibold tracking-tight text-foreground">{title}</h1>
          <span className="text-xs text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : `${total} ${total === 1 ? "conversation" : "conversations"}`}
          </span>
        </div>
        <div className="relative">
          <label htmlFor={searchId} className="sr-only">Search conversations</label>
          <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search by name or role"
            className="h-9 pr-8 pl-8 text-base md:text-sm"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onQueryChange("")}
              className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted pointer-coarse:size-8"
            >
              <XIcon aria-hidden="true" className="size-3.5" />
            </button>
          )}
        </div>
        <div role="group" aria-label="Filter conversations" className="flex gap-1.5">
          {CHIPS.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={filter === c.id}
              onClick={() => onFilterChange(c.id)}
              className={cn(
                "h-7 rounded-full border px-3 text-xs font-medium transition-colors pointer-coarse:h-9",
                filter === c.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {c.label}
              {c.id === "unread" && unreadCount > 0 ? ` ${unreadCount}` : ""}
            </button>
          ))}
        </div>
      </div>

      {refreshFailed && (
        <div role="status" className="flex flex-wrap items-center gap-2 border-b border-border bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertCircleIcon aria-hidden="true" className="size-3.5" />
          Couldn&apos;t refresh. Showing the last loaded list.
          <Button type="button" variant="ghost" size="sm" className="ml-auto h-6 px-2 pointer-coarse:h-9" onClick={onRetry}>Retry</Button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <p className="m-0 px-6 py-10 text-center text-sm text-muted-foreground">
            {filtering ? "No conversations match. Try a different search or filter." : "No conversations yet."}
          </p>
        ) : (
          <ul role="list" className="m-0 list-none p-0">
            {items.map((c) => {
              const isActive = c.matchId === activeMatchId;
              const fav = favorites.has(c.matchId);
              return (
                <li key={c.matchId} className="group/row relative border-b border-border">
                  <button
                    id={`conv-${c.matchId}`}
                    type="button"
                    aria-current={isActive ? "true" : undefined}
                    onClick={() => onSelect(c.matchId)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors pointer-coarse:min-h-14",
                      isActive ? "bg-primary/5 shadow-[inset_2px_0_0_var(--primary)]" : "hover:bg-muted/60",
                    )}
                  >
                    <span className="relative mt-0.5 shrink-0">
                      <Avatar size="lg">
                        <AvatarFallback className="text-sm font-medium">{c.masked ? "?" : initialsOf(c.name)}</AvatarFallback>
                      </Avatar>
                      {c.unread && (
                        <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background bg-primary" />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn("truncate text-sm text-foreground", c.unread ? "font-semibold" : "font-medium")}>
                          {c.unread && <span className="sr-only">Unread: </span>}
                          {c.name}
                        </span>
                        {c.lastMessageAt && (
                          <time dateTime={c.lastMessageAt} className={cn("shrink-0 text-[11px]", c.unread ? "font-medium text-primary" : "text-muted-foreground")}>
                            <span className="sr-only">Last message </span>
                            {listTime(c.lastMessageAt)}
                          </time>
                        )}
                      </span>
                      <span className="truncate text-[13px] text-muted-foreground">{c.roleTitle}</span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <StatusPill label={c.statusLabel} tone={c.statusTone} />
                        {!c.lastMessageAt && <span className="text-[11px] text-muted-foreground">No messages yet</span>}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={fav}
                    aria-label={`${fav ? "Remove from favorites" : "Add to favorites"}: ${c.name}, ${c.roleTitle}`}
                    onClick={() => onToggleFavorite(c.matchId)}
                    className={cn(
                      "absolute right-2 bottom-2 grid size-7 place-items-center rounded-full transition-opacity hover:bg-muted pointer-coarse:size-9",
                      fav ? "text-amber-500 opacity-100" : "text-muted-foreground opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100",
                    )}
                  >
                    <StarIcon aria-hidden="true" className={cn("size-4", fav && "fill-current")} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </nav>
  );
}
