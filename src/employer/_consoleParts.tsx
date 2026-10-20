import Link from "next/link";
import { PlusIcon } from "lucide-react";
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

/** The one "Post a job" button for every employer surface, so it never differs between pages. */
export function PostJobLink({ children = "Post a job", full = false }: { children?: React.ReactNode; full?: boolean }) {
  return (
    <Button asChild variant="default" size="lg" className={cn("h-9 gap-2 px-4.5 pointer-coarse:h-11", full && "w-full")}>
      <Link href="/employer/requirements/new">
        <PlusIcon size={16} strokeWidth={2.5} aria-hidden="true" />
        {children}
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

/** Announced loading placeholder. `label` is what a screen reader hears.
 *  `list` mirrors a toolbar plus table rows (jobs list); the default mirrors a
 *  page heading with two content blocks. */
export function PageSkeleton({ label = "Loading", variant = "page" }: { label?: string; variant?: "page" | "list" }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex w-full flex-col gap-4">
      <span className="sr-only">{label}…</span>
      {variant === "list" ? (
        <div aria-hidden="true" className="flex flex-col gap-3">
          <div className="flex gap-3">
            <Skeleton className="h-9 w-64 max-w-full rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 border-t border-hx-line pt-3">
              <div className="flex min-w-0 flex-[2] flex-col gap-2">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
              </div>
              <Skeleton className="h-6 w-24 max-sm:hidden" />
              <Skeleton className="h-10 w-40 max-sm:hidden" />
              <Skeleton className="h-4 w-20 max-md:hidden" />
              <Skeleton className="h-4 w-16 max-md:hidden" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <Skeleton className="h-10 w-[min(420px,70%)] rounded-lg" />
          <Skeleton className="h-[18px] w-[min(560px,90%)] rounded-md" />
          <Skeleton className="h-[140px] w-full rounded-xl" />
          <Skeleton className="h-[140px] w-full rounded-xl" />
        </>
      )}
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

/** Compact in-page failure with a retry, for sections that fail while the rest
 *  of the page still works. Counterpart to the centred ErrorPanel. */
export function InlineAlert({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-hx-line bg-white px-4 py-3 text-[14px] text-hx-error-ink">
      <span className="min-w-[200px] flex-1">{message}</span>
      <OutlineCta size="sm" onClick={onRetry}>Retry</OutlineCta>
    </div>
  );
}

export { OutlineCta };
