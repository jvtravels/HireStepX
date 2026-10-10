import { cn } from "@/lib/utils";
import type { StatusTone } from "./helpers";

const TONE: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  indigo: "bg-primary/10 text-primary",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  copper: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  error: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
};

export default function StatusPill({ label, tone, className }: { label: string; tone: StatusTone; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-medium whitespace-nowrap", TONE[tone], className)}>
      {label}
    </span>
  );
}
