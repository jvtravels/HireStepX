"use client";

import { createContext, useContext } from "react";
import { AlertTriangleIcon, InboxIcon } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";

/** Set by the shell around pages it already wraps in the white main container, so a state panel
 *  inside them centres in that container instead of drawing a second one. */
const InWhiteCardContext = createContext(false);
export const InWhiteCardProvider = InWhiteCardContext.Provider;

/** The one page-level empty or error state. Fills the white main container and centres its
 *  content both ways, so every employer page looks the same when there is nothing to show or
 *  the data failed to load. Pass `contained={false}` when the caller already draws the card. */
export function StatePanel({
  tone = "empty",
  icon,
  title,
  message,
  actions,
  contained,
}: {
  tone?: "empty" | "error";
  icon?: React.ReactNode;
  title: string;
  message: React.ReactNode;
  actions?: React.ReactNode;
  contained?: boolean;
}) {
  const inCard = useContext(InWhiteCardContext);
  const ownCard = contained ?? !inCard;
  const glyph =
    icon ?? (tone === "error" ? <AlertTriangleIcon aria-hidden="true" className="text-hx-error-ink" /> : <InboxIcon aria-hidden="true" />);
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn("flex w-full min-w-0 flex-1 flex-col", ownCard && "rounded-2xl border border-hx-line bg-white")}
    >
      <EmptyState
        className="min-h-[360px] px-6 py-16"
        icon={glyph}
        title={title}
        description={message}
        action={actions ? <div className="flex flex-wrap items-center justify-center gap-3">{actions}</div> : undefined}
      />
    </div>
  );
}
