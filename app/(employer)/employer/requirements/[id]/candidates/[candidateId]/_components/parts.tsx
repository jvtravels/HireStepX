import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function Fact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm font-medium break-words text-foreground">{value}</dd>
      </div>
    </div>
  );
}

/** The percentage is always printed, so the bar is decorative. */
export function Meter({ label, pct, className }: { label: string; pct: number; className?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-foreground">{label}</span>
        <span className="font-medium tabular-nums">{v}%</span>
      </div>
      <Progress aria-hidden="true" value={v} className="h-1.5" />
    </div>
  );
}

export function UnlockLink({ href, children, size = "default" }: { href: string; children: React.ReactNode; size?: "default" | "sm" }) {
  return (
    <Button asChild size={size} className="pointer-coarse:h-11">
      <Link href={href}>{children}</Link>
    </Button>
  );
}
