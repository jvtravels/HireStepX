"use client";

/* Shared building blocks for the employer requirement surfaces (detail,
   compare, outcome, edit, new). Kept separate from _atoms.tsx so the
   requirement pages can share trust/state primitives —
   inline notices, suspended banner, retry panel — without growing
   the general atom file. */

import type { ReactNode } from "react";
import { AlertTriangleIcon, CheckCircle2Icon, InfoIcon, ShieldAlertIcon, RefreshCwIcon } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { OutlineCta } from "@/employer/_atoms";
import { CtaLink } from "@/employer/_consoleParts";
import { StatePanel } from "@/employer/StatePanel";

/* ── Inline notices ── */

export type NoticeTone = "error" | "warning" | "info" | "success";

const NOTICE_CLASS: Record<NoticeTone, string> = {
  error: "border-hx-error-ink/20 bg-hx-error-100 text-hx-error-ink",
  warning: "border-hx-warning-ink/20 bg-hx-warning-100 text-hx-warning-ink",
  info: "border-hx-line bg-hx-indigo-100 text-hx-indigo-deep",
  success: "border-hx-success-ink/20 bg-hx-success-100 text-hx-success-ink",
};

const NOTICE_ICON: Record<NoticeTone, typeof InfoIcon> = {
  error: AlertTriangleIcon,
  warning: ShieldAlertIcon,
  info: InfoIcon,
  success: CheckCircle2Icon,
};

/** Announced status/error message that stays next to the control that caused
    it (WCAG 4.1.3). Errors use role="alert"; everything else role="status".
    Pass `live={false}` for a notice that is already on screen at load. */
export function InlineNotice({
  tone,
  title,
  children,
  action,
  id,
  live = true,
}: {
  tone: NoticeTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  id?: string;
  live?: boolean;
}) {
  const Icon = NOTICE_ICON[tone];
  return (
    <Alert
      id={id}
      role={live ? (tone === "error" ? "alert" : "status") : undefined}
      className={cn(
        "flex flex-wrap items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] leading-normal",
        NOTICE_CLASS[tone],
        live && (tone === "error" ? "mx-shake" : "mx-rise"),
      )}
    >
      <Icon size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-[1_1_220px] [overflow-wrap:anywhere]">
        {title && <AlertTitle className={cn("font-bold", children ? "mb-0.5" : "")}>{title}</AlertTitle>}
        {children}
      </div>
      {action}
    </Alert>
  );
}

/** Compact in-page failure with a retry, for sections that fail while the rest
    of the page still works. Counterpart to the centred ErrorRetry panel. */
export function InlineAlert({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <InlineNotice tone="error" action={<OutlineCta size="sm" onClick={onRetry}>Retry</OutlineCta>}>
      {message}
    </InlineNotice>
  );
}

/** Read-only banner shown on every requirement surface when the employer
    account is suspended. Write controls elsewhere are disabled to match. */
export function SuspendedBanner() {
  return (
    <InlineNotice tone="warning" title="Account suspended: read-only" live={false}>
      You can still review existing candidates, but unlocking, messaging, status changes and editing
      requirements are turned off. Contact{" "}
      <a href="mailto:support@hirestepx.com" className="font-semibold text-inherit underline">
        support@hirestepx.com
      </a>{" "}
      to resolve this.
    </InlineNotice>
  );
}

/* ── Loading / error / empty ── */

/** Failure panel with a retry action — used where a section's data could not
    be loaded and the user should be able to try again without a full reload. */
export function ErrorRetry({
  title,
  message,
  onRetry,
  retrying = false,
  flat = false,
  children,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  flat?: boolean;
  children?: ReactNode;
}) {
  return (
    <StatePanel
      tone="error"
      title={title}
      message={message}
      contained={flat ? false : undefined}
      actions={
        onRetry || children ? (
          <>
            {onRetry && (
              <OutlineCta onClick={onRetry} loading={retrying} icon={<RefreshCwIcon size={14} aria-hidden="true" />}>
                {retrying ? "Retrying…" : "Try again"}
              </OutlineCta>
            )}
            {children}
          </>
        ) : undefined
      }
    />
  );
}

/** Empty-state panel: one heading, one sentence of why, optional next step. */
export function EmptyNote({ title, children, action, flat = false, icon }: { title: string; children: ReactNode; action?: ReactNode; flat?: boolean; icon?: ReactNode }) {
  return <StatePanel title={title} message={children} actions={action} icon={icon} contained={flat ? false : undefined} />;
}

export function LinkCta({ ariaLabel, ...rest }: { href: string; children: ReactNode; icon?: ReactNode; variant?: "primary" | "outline"; size?: "sm" | "md"; ariaLabel?: string }) {
  return <CtaLink {...rest} size={rest.size ?? "md"} ariaLabel={ariaLabel} />;
}
