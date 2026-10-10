import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import Link from "next/link";

/** The percentage is always printed, so the bar is decorative. */
export function Meter({ label, pct, className }: { label: string; pct: number; className?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-foreground">{label}</span>
        <span className="font-medium tabular-nums">{v}%</span>
      </div>
      <Progress aria-hidden="true" value={v} className={cn("h-1.5", v >= 75 ? "[&>[data-slot=progress-indicator]]:bg-emerald-600" : v >= 50 ? "[&>[data-slot=progress-indicator]]:bg-amber-500" : "[&>[data-slot=progress-indicator]]:bg-red-500")} />
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
