import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { OutlineCta, PrimaryCta } from "@/employer/_atoms";

/* Shared console building blocks for the pages that own their own layout
   (dashboard, jobs, settings) and the route-level loading/error boundaries.
   Kept apart from _atoms.tsx, which other surfaces own. */

/** A real <a> that looks like PrimaryCta. Wrapping a <Button> in a <Link>
 *  nests an interactive element inside another (invalid, and two tab stops). */
export function PrimaryLink({ href, children, icon, full = false, onClick }: { href: string; children: React.ReactNode; icon?: React.ReactNode; full?: boolean; onClick?: () => void }) {
  return (
    <Button asChild variant="default" size="lg" className={cn("h-9 gap-2 px-4.5 pointer-coarse:h-11", full && "w-full")}>
      <Link href={href} onClick={onClick}>
        {children}
        {icon}
      </Link>
    </Button>
  );
}

export function OutlineLink({ href, children, full = false, small = false, onClick }: { href: string; children: React.ReactNode; full?: boolean; small?: boolean; onClick?: () => void }) {
  return (
    <Button
      asChild
      variant="outline"
      className={cn("gap-2 font-semibold pointer-coarse:h-11", small ? "h-9 px-4" : "h-11 px-5", full && "w-full")}
      style={{ fontFamily: f.sans, fontSize: small ? 13 : 14 }}
    >
      <Link href={href} onClick={onClick}>{children}</Link>
    </Button>
  );
}

/** Announced loading placeholder. `label` is what a screen reader hears. */
export function PageSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
      <span className="sr-only">{label}…</span>
      <Skeleton style={{ height: 40, width: "min(420px, 70%)", borderRadius: 8 }} />
      <Skeleton style={{ height: 18, width: "min(560px, 90%)", borderRadius: 6 }} />
      <Skeleton style={{ height: 140, width: "100%", borderRadius: 12 }} />
      <Skeleton style={{ height: 140, width: "100%", borderRadius: 12 }} />
    </div>
  );
}

/** Inline failure with a way out. `role="alert"` so it is announced when it
 *  replaces a loading state. */
export function ErrorPanel({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try again",
  action,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      style={{
        width: "100%", maxWidth: 560, margin: "0 auto", boxSizing: "border-box", padding: 24, textAlign: "center",
        background: t.white, border: `1px solid ${t.line}`, borderRadius: 12,
      }}
    >
      <h2 style={{ fontFamily: f.sans, fontSize: 18, fontWeight: 600, color: t.coal, margin: "0 0 6px" }}>{title}</h2>
      <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, lineHeight: 1.55, margin: "0 0 16px" }}>{message}</p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        {onRetry && <PrimaryCta onClick={onRetry}>{retryLabel}</PrimaryCta>}
        {action}
      </div>
    </div>
  );
}

export { OutlineCta };
