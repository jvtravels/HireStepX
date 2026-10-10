"use client";

/* Shared building blocks for the employer requirement surfaces (detail,
   compare, outcome, edit, new). Kept separate from _atoms.tsx so the
   requirement pages can share trust/state primitives — masked-identity badge,
   inline notices, suspended banner, skeletons, retry panel — without growing
   the general atom file. */

import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangleIcon, CheckCircle2Icon, InfoIcon, LockIcon, ShieldAlertIcon, RefreshCwIcon } from "lucide-react";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, OutlineCta } from "@/employer/_atoms";

/* ── Masked identity ── */

/** Pre-unlock identity marker. Always renders the same words so a candidate
    reads as "hidden" identically in the table, evidence dialog, compare view
    and outcome page. */
export function IdentityHiddenBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: compact ? "2px 8px" : "4px 10px",
        borderRadius: 999,
        background: t.creamSoft,
        color: t.inkFaint,
        border: `1px solid ${t.line}`,
        fontFamily: f.sans,
        fontSize: textSize.sm,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      <LockIcon size={11} aria-hidden="true" />
      Identity hidden until unlock
    </span>
  );
}

/* ── Inline notices ── */

export type NoticeTone = "error" | "warning" | "info" | "success";

const NOTICE_PALETTE: Record<NoticeTone, { bg: string; fg: string; line: string }> = {
  error: { bg: t.error100, fg: t.errorInk, line: t.errorLine },
  warning: { bg: t.warning100, fg: t.warningInk, line: t.warningLine },
  info: { bg: t.info100, fg: t.info, line: t.line },
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

/** Page-level loading placeholder. The visually hidden label gives screen
    readers something to announce; the skeleton blocks are decorative. */
export function PageSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" style={{ display: "grid", gap: 16 }}>
      <span className="sr-only">{label}</span>
      <Card>
        <div aria-hidden="true" style={{ display: "grid", gap: 12 }}>
          <Skeleton style={{ height: 28, width: "45%" }} />
          <Skeleton style={{ height: 16, width: "70%" }} />
          <Skeleton style={{ height: 16, width: "55%" }} />
        </div>
      </Card>
      <Card pad={16}>
        <div aria-hidden="true" style={{ display: "grid", gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ height: 44, width: "100%" }} />
          ))}
        </div>
      </Card>
    </div>
  );
}

/** Failure panel with a retry action — used where a section's data could not
    be loaded and the user should be able to try again without a full reload. */
export function ErrorRetry({
  title,
  message,
  onRetry,
  retrying = false,
  children,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  children?: ReactNode;
}) {
  return (
    <Card style={{ textAlign: "center", padding: 40 }}>
      <div
        aria-hidden="true"
        style={{ width: 40, height: 40, borderRadius: 10, background: t.error100, color: t.errorInk, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}
      >
        <AlertTriangleIcon size={18} />
      </div>
      <h2 role="alert" style={{ fontFamily: f.sans, fontSize: textSize["2xl"], fontWeight: 600, color: t.coal, margin: "0 0 8px" }}>
        {title}
      </h2>
      <p style={{ fontFamily: f.sans, fontSize: textSize.md, color: t.inkFaint, margin: "0 auto 18px", maxWidth: 460 }}>{message}</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        {onRetry && (
          <OutlineCta onClick={onRetry} loading={retrying} icon={<RefreshCwIcon size={14} aria-hidden="true" />}>
            {retrying ? "Retrying…" : "Try again"}
          </OutlineCta>
        )}
        {children}
      </div>
    </Card>
  );
}

/** Empty-state panel: one heading, one sentence of why, optional next step. */
export function EmptyNote({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card style={{ textAlign: "center", padding: 40 }}>
      <h2 style={{ fontFamily: f.sans, fontSize: textSize["2xl"], fontWeight: 600, color: t.coal, margin: "0 0 8px" }}>{title}</h2>
      <p style={{ fontFamily: f.sans, fontSize: textSize.md, color: t.inkFaint, margin: "0 auto", maxWidth: 520, lineHeight: 1.6 }}>{children}</p>
      {action && <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>{action}</div>}
    </Card>
  );
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
