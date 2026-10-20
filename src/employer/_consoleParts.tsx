import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { StatePanel } from "@/employer/StatePanel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fonts as f } from "@/auth/_tokens";
import { OutlineCta } from "@/employer/_atoms";

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

const SKELETON_ROWS = [0, 1, 2, 3, 4, 5];

/** The one loading placeholder for every employer page. `label` is what a screen reader hears.
 *  `page` is a heading with two content blocks, `list` a toolbar plus table rows (jobs list),
 *  `job` a header, toolbar and candidate rows (job detail). `padded` is for pages that render
 *  inside the white container without their own gutter. */
export function PageSkeleton({ label = "Loading", variant = "page", padded = false }: { label?: string; variant?: "page" | "list" | "job"; padded?: boolean }) {
  const announced = label.endsWith("…") ? label : `${label}…`;
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={cn("flex w-full min-w-0 flex-col gap-4", padded && "px-7 py-6")}>
      <span className="sr-only">{announced}</span>
      {variant === "list" ? (
        <div aria-hidden="true" className="flex flex-col gap-3">
          <div className="flex gap-3">
            <Skeleton className="h-9 w-64 max-w-full rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
          {SKELETON_ROWS.map((i) => (
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
      ) : variant === "job" ? (
        <>
          <div aria-hidden="true" className="grid min-w-0 gap-5 min-[1440px]:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-[min(420px,80%)]" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-28 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-32 rounded-full" />
              </div>
            </div>
            <Skeleton className="hidden h-28 w-full rounded-xl min-[1440px]:block" />
          </div>
          <div aria-hidden="true" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Skeleton className="h-9 w-72 max-w-full rounded-lg" />
              <Skeleton className="h-9 w-56 max-w-full rounded-lg" />
            </div>
            {SKELETON_ROWS.slice(0, 5).map((i) => (
              <div key={i} className="flex items-center gap-4 border-t border-hx-line pt-4">
                <Skeleton className="size-4 shrink-0" />
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
                <Skeleton className="h-8 w-28 max-sm:hidden" />
              </div>
            ))}
          </div>
        </>
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

/** Page-level failure with a way out. */
export function ErrorPanel({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try again",
  action,
  contained,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: React.ReactNode;
  contained?: boolean;
}) {
  return (
    <StatePanel
      tone="error"
      title={title}
      message={message}
      contained={contained}
      actions={
        onRetry || action ? (
          <>
            {onRetry && <OutlineCta onClick={onRetry}>{retryLabel}</OutlineCta>}
            {action}
          </>
        ) : undefined
      }
    />
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

export { OutlineCta, StatePanel };
export { InWhiteCardProvider } from "@/employer/StatePanel";
