"use client";

import { useState, type ReactNode } from "react";
import { MessagesSquareIcon } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMaxWidth } from "../hooks/useMaxWidth";
import { cn } from "@/lib/utils";

interface MessagingLayoutProps {
  list: ReactNode;
  /** Null renders the "pick a conversation" placeholder. */
  thread: ReactNode | null;
  rail: ReactNode;
  railState: RailState;
  /** Phones show one pane at a time. */
  narrow: boolean;
  hasActive: boolean;
  /** Shown when a deep-linked conversation can't be found. */
  placeholder: string;
  banner?: ReactNode;
}

export const RAIL_BREAKPOINT = 1180;

export interface RailState {
  open: boolean;
  compact: boolean;
  setOpen: (open: boolean) => void;
}

/** Details rail: open by default beside the thread on wide screens, closed (sheet) on narrower ones. */
export function useRailState(): RailState {
  const compact = useMaxWidth(RAIL_BREAKPOINT);
  const [pref, setPref] = useState<boolean | null>(null);
  return { open: pref ?? !compact, compact, setOpen: setPref };
}

export default function MessagingLayout({ list, thread, rail, railState, narrow, hasActive, placeholder, banner }: MessagingLayoutProps) {
  const { open: railOpen, compact, setOpen: onRailOpenChange } = railState;
  const showList = !narrow || !hasActive;
  const showThread = !narrow || hasActive;
  const inlineRail = railOpen && !compact && hasActive;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background">
      {banner}
      <div className="flex min-h-0 flex-1">
        {showList && (
          <aside className={cn("min-h-0 shrink-0 border-border", narrow ? "w-full" : "w-80 border-r")}>{list}</aside>
        )}
        {showThread && (
          <section className="flex min-w-0 flex-1 flex-col" aria-label="Conversation">
            {thread ?? (
              <div className="m-auto flex max-w-xs flex-col items-center gap-2 px-6 text-center">
                <MessagesSquareIcon aria-hidden="true" className="size-7 text-muted-foreground" />
                <p className="m-0 text-sm font-semibold text-foreground">{placeholder}</p>
              </div>
            )}
          </section>
        )}
        {inlineRail && (
          <aside aria-label="Conversation details" className="hidden min-h-0 w-72 shrink-0 overflow-y-auto border-l border-border bg-background min-[1180px]:block">
            {rail}
          </aside>
        )}
      </div>
      {compact && hasActive && (
        <Sheet open={railOpen} onOpenChange={onRailOpenChange}>
          <SheetContent side="right" className="w-80 gap-0 overflow-y-auto p-0 sm:max-w-80">
            <SheetHeader className="border-b border-border">
              <SheetTitle>Conversation details</SheetTitle>
              <SheetDescription>Role, status and shared files for this conversation.</SheetDescription>
            </SheetHeader>
            {rail}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
