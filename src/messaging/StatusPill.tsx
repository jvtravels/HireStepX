import { cn } from "@/lib/utils";
import type { StatusTone } from "./helpers";

const TONE: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  indigo: "bg-hx-indigo-100 text-hx-indigo",
  copper: "bg-hx-copper-100 text-hx-copper-dark",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  error: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
};

export default function StatusPill({ label, tone, className }: { label: string; tone: StatusTone; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap", TONE[tone], className)}>
      {label}
    </span>
  );
}
