"use client";

import {
  AlertTriangleIcon, ArchiveRestoreIcon, BellIcon, CheckIcon, ClockIcon, CreditCardIcon, EyeIcon, FlameIcon,
  GiftIcon, MailOpenIcon, MessageSquareIcon, MoreHorizontalIcon, SparklesIcon, UserCheckIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SNOOZE_OPTIONS, snoozeUntil, timeAgo, typeMeta } from "./registry";
import type { FeedNotification } from "./useNotificationFeed";

const ICONS: Record<string, ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  streak_milestone: FlameIcon,
  referral_reward: GiftIcon,
  candidate_status_change: UserCheckIcon,
  employer_viewed_profile: EyeIcon,
  unlock_confirmed: CreditCardIcon,
  matches_ready: SparklesIcon,
  strong_match_found: SparklesIcon,
  candidate_responded: MessageSquareIcon,
  new_message: MessageSquareIcon,
  new_message_candidate: MessageSquareIcon,
  new_message_employer: MessageSquareIcon,
  payment_success: CreditCardIcon,
  payment_failed: AlertTriangleIcon,
  subscription_renewed: CreditCardIcon,
};

interface Props {
  n: FeedNotification;
  done: boolean;
  focused?: boolean;
  onOpen: (n: FeedNotification) => void;
  onAction: (id: string, action: "read" | "unread" | "done" | "restore" | "snooze", until?: Date) => void;
}

export default function NotificationItem({ n, done, focused, onOpen, onAction }: Props) {
  const Icon = ICONS[n.type] ?? BellIcon;
  const unread = !n.read_at;
  const critical = n.priority === "critical";
  const category = typeMeta(n.type)?.category;

  return (
    <li
      data-notification-id={n.id}
      className={cn(
        "group/row relative flex gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-muted/50",
        unread && "bg-muted/30",
        focused && "ring-2 ring-ring ring-inset",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
          critical ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onOpen(n)}
          className="block w-full text-left outline-none focus-visible:underline pointer-coarse:min-h-11"
        >
          <span className="flex items-center gap-2">
            {unread && <span aria-label="Unread" className="size-1.5 shrink-0 rounded-full bg-primary" />}
            <span className={cn("min-w-0 truncate text-sm text-foreground", unread ? "font-semibold" : "font-medium")}>{n.title}</span>
            {n.count > 1 && (
              <span className="shrink-0 rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">{n.count} new</span>
            )}
          </span>
          {n.body && <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-muted-foreground">{n.body}</span>}
        </button>
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <time dateTime={n.created_at}>{timeAgo(n.created_at)}</time>
          {category && <span aria-hidden="true">·</span>}
          {category && <span className="capitalize">{category}</span>}
          {n.link && n.action_label && !done && (
            <Button type="button" size="xs" variant="outline" className="ml-auto h-6 px-2 text-xs" onClick={() => onOpen(n)}>
              {n.action_label}
            </Button>
          )}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={`Actions for ${n.title}`}
            className="shrink-0 opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
          >
            <MoreHorizontalIcon className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {done ? (
            <DropdownMenuItem onClick={() => onAction(n.id, "restore")}>
              <ArchiveRestoreIcon aria-hidden="true" /> Move back to inbox
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem onClick={() => onAction(n.id, unread ? "read" : "unread")}>
                <MailOpenIcon aria-hidden="true" /> {unread ? "Mark as read" : "Mark as unread"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction(n.id, "done")}>
                <CheckIcon aria-hidden="true" /> Done
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ClockIcon aria-hidden="true" /> Snooze
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {SNOOZE_OPTIONS.map((o) => (
                    <DropdownMenuItem key={o.id} onClick={() => { const until = snoozeUntil(o.id); if (until) onAction(n.id, "snooze", until); }}>
                      {o.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
