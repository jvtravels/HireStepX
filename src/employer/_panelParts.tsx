"use client";

/* Flat bordered panel primitives shared by the employer detail surfaces:
   Panel + header, text link, label/value rows, outlined skill chips, status
   dots, a meter bar and a focusable info tip. Tailwind only, on the hx-*
   tokens, so new employer screens don't each hand-roll these. */

import Link from "next/link";
import type { ReactNode } from "react";
import { InfoIcon } from "lucide-react";
import { cn } from "cn";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function Panel({
  id,
  title,
  icon,
  action,
  children,
  className,
}: {
  id: string;
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("min-w-0 rounded-xl border border-hx-line bg-white p-[18px]", className)}>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 id={id} className="m-0 flex items-center gap-2 text-[15px] font-semibold text-hx-coal">
          {icon && <span aria-hidden="true" className="inline-flex text-hx-ink-soft">{icon}</span>}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PanelLink({ href, children, label }: { href: string; children: ReactNode; label?: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-md text-[13px] font-semibold text-hx-indigo no-underline transition-colors duration-150 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo motion-reduce:transition-none pointer-coarse:min-h-11"
    >
      {children}
    </Link>
  );
}

export function PanelButton({ onClick, children, expanded }: { onClick: () => void; children: ReactNode; expanded?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className="inline-flex cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent p-0 text-[13px] font-semibold text-hx-indigo transition-colors duration-150 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo motion-reduce:transition-none pointer-coarse:min-h-11"
    >
      {children}
    </button>
  );
}

export function KeyValueList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("m-0 flex flex-col gap-2.5", className)}>{children}</dl>;
}

export function KeyValueRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-[13px]">
      <dt className="shrink-0 text-hx-ink-soft">{label}</dt>
      <dd className="m-0 min-w-0 text-right font-medium text-hx-coal [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

export type ChipTone = "danger" | "primary" | "info" | "neutral";

const CHIP_TONE: Record<ChipTone, string> = {
  danger: "border-hx-error-100 text-hx-error-ink",
  primary: "border-hx-indigo-100 text-hx-indigo",
  info: "border-hx-info-100 text-hx-info",
  neutral: "border-hx-line text-hx-neutral-ink",
};

export function SkillChip({ tone = "neutral", children }: { tone?: ChipTone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex max-w-full items-center rounded-full border bg-white px-2.5 py-1 text-[12px] font-medium [overflow-wrap:anywhere]", CHIP_TONE[tone])}>
      {children}
    </span>
  );
}

export type DotTone = "good" | "soon" | "unknown";

const DOT_TONE: Record<DotTone, string> = {
  good: "bg-hx-success",
  soon: "bg-hx-warning",
  unknown: "bg-hx-ink-soft/50",
};

export function DotLabel({ tone, children }: { tone: DotTone; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-hx-coal">
      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", DOT_TONE[tone])} />
      {children}
    </span>
  );
}

export function MeterBar({ value, label, tone = "success", thin = false }: { value: number; label: string; tone?: "success" | "indigo"; thin?: boolean }) {
  return (
    <Progress
      value={Math.max(0, Math.min(100, value))}
      aria-label={label}
      className={cn(
        thin ? "h-1" : "h-2",
        "bg-hx-soft [&_[data-slot=progress-indicator]]:rounded-full [&_[data-slot=progress-indicator]]:duration-300 [&_[data-slot=progress-indicator]]:ease-out motion-reduce:[&_[data-slot=progress-indicator]]:transition-none",
        tone === "indigo" ? "[&_[data-slot=progress-indicator]]:bg-hx-indigo" : "[&_[data-slot=progress-indicator]]:bg-hx-success",
      )}
    />
  );
}

/** A real button, so keyboard and touch users get the same explanation as hover. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-1 text-hx-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo pointer-coarse:size-11"
        >
          <InfoIcon size={12} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-64">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
