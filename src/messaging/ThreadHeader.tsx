"use client";

import type { ReactNode, Ref } from "react";
import { ArrowLeftIcon, InfoIcon, StarIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { initialsOf } from "./helpers";

interface ThreadHeaderProps {
  name: string;
  masked: boolean;
  /** Replaces the plain name, e.g. the employer-side masked-identity heading. */
  title?: ReactNode;
  subtitle: string;
  badges?: ReactNode;
  actions?: ReactNode;
  headingRef?: Ref<HTMLDivElement>;
  favorite: boolean;
  onToggleFavorite: () => void;
  onBack?: () => void;
  railOpen: boolean;
  onToggleRail: () => void;
}

export default function ThreadHeader({
  name, masked, title, subtitle, badges, actions, headingRef, favorite, onToggleFavorite, onBack, railOpen, onToggleRail,
}: ThreadHeaderProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-background px-4 py-3">
      {onBack && (
        <Button type="button" variant="ghost" size="icon" aria-label="Back to conversations" onClick={onBack} className="-ml-2 size-11 shrink-0">
          <ArrowLeftIcon aria-hidden="true" className="size-5" />
        </Button>
      )}
      <Avatar size="lg" aria-hidden="true">
        <AvatarFallback className="text-sm font-medium">{masked ? "?" : initialsOf(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 basis-48">
        <div ref={headingRef} tabIndex={-1} className="flex flex-wrap items-center gap-x-2 gap-y-1 outline-none">
          {title ?? <h2 className="m-0 truncate text-[15px] font-semibold text-foreground">{name}</h2>}
          {badges}
        </div>
        <p className="m-0 mt-0.5 truncate text-[13px] text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex items-center gap-1.5">
        {actions}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-pressed={favorite}
          aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
          onClick={onToggleFavorite}
          className="size-9 pointer-coarse:size-11"
        >
          <StarIcon aria-hidden="true" className={cn("size-4", favorite && "fill-amber-500 text-amber-500")} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-pressed={railOpen}
          aria-label={railOpen ? "Hide conversation details" : "Show conversation details"}
          onClick={onToggleRail}
          className={cn("size-9 pointer-coarse:size-11", railOpen && "bg-muted")}
        >
          <InfoIcon aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </header>
  );
}
