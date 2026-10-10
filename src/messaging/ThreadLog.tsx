"use client";

import { useMemo, type ReactNode, type Ref } from "react";
import { AlertCircleIcon, FileTextIcon, FlagIcon, ImageIcon, MessageSquareIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { attachmentKind, buildThreadRows, clockTime, initialsOf, type ThreadMessage, type ViewerRole } from "./helpers";

interface ThreadLogProps {
  messages: ThreadMessage[];
  viewerRole: ViewerRole;
  selfName: string;
  otherName: string;
  otherMasked: boolean;
  loading: boolean;
  error: boolean;
  scrollRef: Ref<HTMLDivElement>;
  announcement: { n: number; text: string };
  emptyHint: string;
  onRetry: () => void;
  onOpenAttachment: (messageId: string) => void;
  /** Provided on the side that may report the counterpart's messages. */
  onReport?: (messageId: string) => void;
  banner?: ReactNode;
}

function AttachmentCard({ message, onOpen }: { message: ThreadMessage; onOpen: (id: string) => void }) {
  const { ext, label } = attachmentKind(message.attachmentName, message.attachmentMime);
  const Icon = message.attachmentMime?.startsWith("image/") ? ImageIcon : FileTextIcon;
  return (
    <button
      type="button"
      onClick={() => onOpen(message.id)}
      aria-label={`Open attachment ${message.attachmentName ?? ""}`.trim()}
      className="mt-1.5 flex w-full max-w-sm items-center gap-3 rounded-lg border border-border bg-card p-2.5 text-left transition-colors hover:bg-muted/60 pointer-coarse:min-h-14"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{message.attachmentName || "Attachment"}</span>
        <span className="block text-xs text-muted-foreground">{label} · {ext.toUpperCase()} · Click to open</span>
      </span>
    </button>
  );
}

export default function ThreadLog({
  messages, viewerRole, selfName, otherName, otherMasked, loading, error, scrollRef, announcement, emptyHint,
  onRetry, onOpenAttachment, onReport, banner,
}: ThreadLogProps) {
  const rows = useMemo(() => buildThreadRows(messages), [messages]);
  const lastOwnId = useMemo(() => messages.filter((m) => m.senderRole === viewerRole).at(-1)?.id, [messages, viewerRole]);

  return (
    <>
      <span key={announcement.n} role="status" className="sr-only">{announcement.text}</span>
      {error && messages.length > 0 && (
        <div role="status" className="shrink-0 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          Couldn&apos;t refresh this conversation. Retrying automatically.
        </div>
      )}
      {banner}
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-busy={loading}
        aria-label={`Conversation with ${otherName}`}
        // Focusable so keyboard users can scroll the history; the log role is non-interactive by design.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        {loading && (
          <div className="flex flex-col gap-5 px-4 py-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && error && messages.length === 0 && (
          <div role="alert" className="m-auto flex flex-col items-center gap-2.5 px-6 text-center">
            <AlertCircleIcon aria-hidden="true" className="size-6 text-muted-foreground" />
            <p className="m-0 text-sm font-semibold text-foreground">Couldn&apos;t load this conversation</p>
            <Button type="button" variant="outline" className="pointer-coarse:h-11 px-4" onClick={onRetry}>Retry</Button>
          </div>
        )}
        {!loading && !error && messages.length === 0 && (
          <div className="m-auto flex max-w-xs flex-col items-center gap-2 px-6 text-center">
            <MessageSquareIcon aria-hidden="true" className="size-6 text-muted-foreground" />
            <p className="m-0 text-sm font-semibold text-foreground">No messages yet</p>
            <p className="m-0 text-[13px] text-muted-foreground">{emptyHint}</p>
          </div>
        )}
        {rows.map((row) => {
          if (row.kind === "day") {
            return (
              <div key={row.key} className="sticky top-0 z-[1] my-2 flex items-center gap-3 bg-background/90 px-4 py-1 backdrop-blur-sm" role="separator" aria-label={row.label}>
                <span aria-hidden="true" className="h-px flex-1 bg-border" />
                <span className="rounded-full border border-border bg-background px-3 py-0.5 text-xs font-medium text-muted-foreground">{row.label}</span>
                <span aria-hidden="true" className="h-px flex-1 bg-border" />
              </div>
            );
          }
          if (row.kind === "system") {
            return (
              <div key={row.key} className="my-1.5 flex items-center justify-center gap-2 px-6 text-center text-xs text-muted-foreground">
                <span className="rounded-full bg-muted px-3 py-1">
                  {row.message.body}
                  <time dateTime={row.message.createdAt} className="ml-2 opacity-70">{clockTime(row.message.createdAt)}</time>
                </span>
              </div>
            );
          }
          const m = row.message;
          const own = m.senderRole === viewerRole;
          const sender = own ? selfName : otherName;
          return (
            <div key={row.key} className={cn("group/msg relative flex gap-3 px-4 hover:bg-muted/40", row.showHeader ? "mt-2 pt-1.5 pb-0.5" : "py-0.5")}>
              <div className="w-9 shrink-0">
                {row.showHeader ? (
                  <Avatar size="lg" aria-hidden="true" className="size-9">
                    <AvatarFallback className={cn("text-xs font-medium", own && "bg-primary/10 text-primary")}>
                      {!own && otherMasked ? "?" : initialsOf(sender)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <time dateTime={m.createdAt} aria-hidden="true" className="block pt-1 text-center text-[10px] text-muted-foreground opacity-0 group-hover/msg:opacity-100">
                    {clockTime(m.createdAt)}
                  </time>
                )}
              </div>
              <div className="min-w-0 flex-1">
                {row.showHeader && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-foreground">{own ? "You" : sender}</span>
                    <time dateTime={m.createdAt} className="text-xs text-muted-foreground">{clockTime(m.createdAt)}</time>
                    {m.flagged && <span className="rounded-full bg-red-100 px-1.5 text-[11px] font-medium text-red-700 dark:bg-red-500/20 dark:text-red-300">Flagged</span>}
                  </div>
                )}
                <span className="sr-only">{row.showHeader ? "" : `${own ? "You" : sender}: `}</span>
                {m.body && <p className="m-0 text-sm leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap text-foreground">{m.body}</p>}
                {m.attachmentPath && <AttachmentCard message={m} onOpen={onOpenAttachment} />}
                {own && m.id === lastOwnId && <p className="m-0 mt-0.5 text-[11px] text-muted-foreground">Delivered</p>}
              </div>
              {!own && onReport && (
                <button
                  type="button"
                  onClick={() => onReport(m.id)}
                  aria-label={`Report message from ${otherName} sent ${new Date(m.createdAt).toLocaleString()}`}
                  className="absolute top-1 right-3 flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover/msg:opacity-100 hover:text-foreground focus-visible:opacity-100 pointer-coarse:min-h-11 pointer-coarse:opacity-100"
                >
                  <FlagIcon aria-hidden="true" className="size-3" /> Report
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
