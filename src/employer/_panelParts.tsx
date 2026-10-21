"use client";

/* Flat bordered panel primitives shared by the employer detail surfaces:
   Panel + header, text link, label/value rows, outlined skill chips, status
   dots, a meter bar and a focusable info tip. Tailwind only, on the hx-*
   tokens, so new employer screens don't each hand-roll these. */

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRightIcon, InfoIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function Panel({
  id,
  title,
  action,
  children,
  className,
  headingClassName,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  headingClassName?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("min-w-0 px-7 py-6", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 id={id} className={cn("m-0 text-[15px] font-semibold text-hx-coal", headingClassName)}>
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
      className="inline-flex items-center gap-1 rounded-md text-[13px] font-semibold text-hx-indigo no-underline transition-colors duration-150 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none pointer-coarse:min-h-11"
    >
      {children}
    </Link>
  );
}

export function PanelButton({ onClick, children, expanded, controls }: { onClick: () => void; children: ReactNode; expanded?: boolean; controls?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-controls={controls}
      className="inline-flex cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent p-0 text-[13px] font-semibold text-hx-indigo transition-colors duration-150 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none pointer-coarse:min-h-11"
    >
      {children}
    </button>
  );
}

export function KeyValueList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("m-0 flex flex-col gap-3", className)}>{children}</dl>;
}

export function KeyValueRow({ label, tip, children }: { label: string; tip?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-x-4 text-[13px]">
      <dt className="text-[12px] text-hx-ink-soft">
        {label}
        {tip && <InfoTip label={`About ${label.toLowerCase()}`}>{tip}</InfoTip>}
      </dt>
      <dd className="m-0 min-w-0 font-medium text-hx-coal [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** Value-first facts: the figure leads and the label sits above it, so a row of them scans in one pass. */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("m-0 grid grid-cols-2 gap-x-4 gap-y-4", className)}>{children}</dl>;
}

export function Stat({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-hx-ink-soft">{label}</dt>
      <dd className="m-0 mt-0.5 text-[15px] leading-snug font-semibold tabular-nums text-hx-coal [overflow-wrap:anywhere]">{children}</dd>
      {hint && <p className="m-0 mt-0.5 text-[12px] leading-snug text-hx-ink-soft">{hint}</p>}
    </div>
  );
}

export interface MetaPart {
  icon: LucideIcon;
  text: ReactNode;
  title?: string;
}

/** Icon + text facts on one wrapping line; the icons separate them, so a wrap never strands a divider. */
export function MetaLine({ parts, className }: { parts: MetaPart[]; className?: string }) {
  if (parts.length === 0) return null;
  return (
    <p className={cn("m-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-hx-coal", className)}>
      {parts.map(({ icon: Icon, text, title }, i) => (
        <span key={i} title={title} className="inline-flex items-center gap-1.5">
          <Icon size={15} aria-hidden="true" className="shrink-0 text-hx-ink-soft" />
          {text}
        </span>
      ))}
    </p>
  );
}

export type ChipTone = "danger" | "primary" | "neutral" | "present" | "missing";

const CHIP_TONE: Record<ChipTone, string> = {
  danger: "bg-hx-error-100 text-hx-error-ink",
  primary: "bg-hx-indigo-100 text-hx-indigo",
  neutral: "bg-hx-soft text-hx-neutral-ink",
  present: "bg-hx-success-100 text-hx-success-ink",
  missing: "border border-dashed border-hx-ink-soft/50 text-hx-neutral-ink",
};

export function SkillChip({ tone = "neutral", children }: { tone?: ChipTone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex max-w-full items-center rounded-md px-2 py-1 text-[12px] leading-none font-medium [overflow-wrap:anywhere]", CHIP_TONE[tone])}>
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

/** Label and printed percentage over a thin bar; the number carries the meaning, so the bar is decorative. */
export function MeterRow({ label, value, tone = "indigo" }: { label: string; value: number; tone?: "success" | "indigo" }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-[13px] text-hx-coal">
        <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
        <span className="font-medium tabular-nums">{v}%</span>
      </div>
      <span aria-hidden="true">
        <MeterBar thin tone={tone} value={v} label={label} />
      </span>
    </div>
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
          className="inline-flex cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-1 text-hx-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:size-11"
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

/* ─── Insight rows ─── */

export type InsightRowTone = "positive" | "action" | "attention" | "neutral";

const INSIGHT_TILE: Record<InsightRowTone, string> = {
  positive: "bg-hx-success-100 text-hx-success-ink",
  action: "bg-hx-indigo-100 text-hx-indigo",
  attention: "bg-hx-warning-100 text-hx-warning-ink",
  neutral: "bg-hx-soft text-hx-ink-soft",
};

export function InsightList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("m-0 list-none divide-y divide-hx-line p-0", className)}>{children}</ul>;
}

/** A toned icon tile, a title, a sentence of detail and, when `href` and `cta` are given, a link. The whole row is the link. */
export function InsightRow({
  tone,
  icon,
  title,
  body,
  href,
  cta,
  className,
}: {
  tone: InsightRowTone;
  icon: ReactNode;
  title: string;
  body: string;
  href?: string;
  cta?: string;
  className?: string;
}) {
  const content = (
    <>
      <span aria-hidden="true" className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg", INSIGHT_TILE[tone])}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold leading-5 text-hx-coal">{title}</span>
        <span className="mt-1 block text-[13px] leading-[1.55] text-hx-ink-soft [overflow-wrap:anywhere]">{body}</span>
        {href && cta && (
          <span className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-hx-indigo group-hover:underline">
            {cta}
            <ArrowRightIcon size={14} aria-hidden="true" className="transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </span>
        )}
      </span>
    </>
  );
  const row = cn("flex items-start gap-3.5 py-4 first:pt-0 last:pb-0", className);
  return (
    <li>
      {href ? (
        <Link href={href} className={cn("group rounded-md no-underline", row)}>{content}</Link>
      ) : (
        <div className={row}>{content}</div>
      )}
    </li>
  );
}
