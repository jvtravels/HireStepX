"use client";

/* Shared building blocks for the employer requirement surfaces (detail,
   compare, outcome, edit, new). Kept separate from _atoms.tsx so the
   requirement pages can share trust/state primitives —
   inline notices, suspended banner, retry panel — without growing
   the general atom file. */

import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangleIcon, CheckCircle2Icon, InfoIcon, ShieldAlertIcon, RefreshCwIcon } from "lucide-react";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { Button } from "@/components/ui/button";
import { OutlineCta } from "@/employer/_atoms";
import { StatePanel } from "@/employer/StatePanel";

/* ── Inline notices ── */

export type NoticeTone = "error" | "warning" | "info" | "success";

const NOTICE_PALETTE: Record<NoticeTone, { bg: string; fg: string; line: string }> = {
  error: { bg: t.error100, fg: t.errorInk, line: t.errorLine },
  warning: { bg: t.warning100, fg: t.warningInk, line: t.warningLine },
  info: { bg: t.indigo100, fg: t.indigoDeep, line: t.line },
  success: { bg: t.success100, fg: t.successInk, line: t.successLine },
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
  const p = NOTICE_PALETTE[tone];
  const Icon = NOTICE_ICON[tone];
  return (
    <div
      id={id}
      role={live ? (tone === "error" ? "alert" : "status") : undefined}
      className={live ? (tone === "error" ? "mx-shake" : "mx-rise") : undefined}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        flexWrap: "wrap",
        padding: "10px 14px",
        borderRadius: 12,
        background: p.bg,
        color: p.fg,
        border: `1px solid ${p.line}`,
        fontFamily: f.sans,
        fontSize: textSize.base,
        lineHeight: 1.5,
      }}
    >
      <Icon size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: "1 1 220px", minWidth: 0, overflowWrap: "anywhere" }}>
        {title && <div style={{ fontWeight: 700, marginBottom: children ? 2 : 0 }}>{title}</div>}
        {children}
      </div>
      {action}
    </div>
  );
}

/** Read-only banner shown on every requirement surface when the employer
    account is suspended. Write controls elsewhere are disabled to match. */
export function SuspendedBanner() {
  return (
    <InlineNotice tone="warning" title="Account suspended: read-only" live={false}>
      You can still review existing candidates, but unlocking, messaging, status changes and editing
      requirements are turned off. Contact{" "}
      <a href="mailto:support@hirestepx.com" style={{ color: "inherit", fontWeight: 600, textDecoration: "underline" }}>
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

/** A real link that looks like PrimaryCta/OutlineCta. Atoms render <button>,
    and a button nested in an anchor is invalid, so navigation CTAs use this. */
export function LinkCta({
  href,
  children,
  icon,
  variant = "primary",
  size = "md",
  ariaLabel,
}: {
  href: string;
  children: ReactNode;
  icon?: ReactNode;
  variant?: "primary" | "outline";
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  return (
    <Button
      asChild
      variant={variant === "primary" ? "default" : "outline"}
      size="lg"
      className={size === "sm" ? "gap-2 px-4 pointer-coarse:h-11" : "h-11 gap-2 px-5"}
      style={{ fontFamily: f.sans, fontSize: size === "sm" ? textSize.base : textSize.md, fontWeight: 600 }}
    >
      <Link href={href} aria-label={ariaLabel}>
        {icon}
        {children}
      </Link>
    </Button>
  );
}
