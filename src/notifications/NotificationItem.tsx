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
import { CATEGORY_LABELS, SNOOZE_OPTIONS, snoozeUntil, timeAgo, typeMeta, type Category } from "./registry";
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
  team_invite_accepted: UserCheckIcon,
};

/* Soft tile per category so a glance at the icon tells you what kind of event it is. */
const TILE: Record<Category, string> = {
  messages: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  applications: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  matches: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  billing: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  rewards: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
  activity: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300",
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
  const sub = n.body || (category ? CATEGORY_LABELS[category].label : "");

  return (
    <li
      data-notification-id={n.id}
      className={cn(
        "group/row relative flex gap-3.5 border-b border-border px-5 py-4 transition-colors hover:bg-muted/60",
        unread ? "bg-primary/[0.06]" : "bg-background",
        focused && "ring-2 ring-ring ring-inset",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl",
          critical ? "bg-destructive/10 text-destructive" : category ? TILE[category] : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onOpen(n)}
          className="block w-full text-left outline-none focus-visible:underline pointer-coarse:min-h-11"
        >
          <span className="flex items-start gap-2">
            <span className={cn("min-w-0 flex-1 line-clamp-2 text-sm leading-snug text-foreground", unread ? "font-semibold" : "font-medium")}>
              {unread && <span aria-label="Unread" role="img" className="mr-1.5 mb-px inline-block size-2 rounded-full bg-primary align-middle" />}
              {n.title}
            </span>
            <time dateTime={n.created_at} className="shrink-0 pt-0.5 text-xs whitespace-nowrap text-muted-foreground">
              {timeAgo(n.created_at)}
            </time>
          </span>
          {sub && <span className="mt-1 line-clamp-2 block text-[13px] leading-snug text-muted-foreground">{sub}</span>}
        </button>
        {(n.count > 1 || (n.link && n.action_label && !done)) && (
          <div className="mt-2.5 flex items-center gap-2">
            {n.link && n.action_label && !done && (
              <Button type="button" size="sm" variant="outline" className="h-8 rounded-full px-3.5 text-[13px] font-medium text-primary" onClick={() => onOpen(n)}>
                {n.action_label}
              </Button>
            )}
            {n.count > 1 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{n.count} new</span>
            )}
          </div>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={`Actions for ${n.title}`}
            className="-mr-2 mt-3.5 shrink-0 self-start opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
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
