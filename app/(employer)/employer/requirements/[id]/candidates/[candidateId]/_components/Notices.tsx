import React from "react";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { EmployerIcon } from "@/employer/_atoms";
import { UnlockLink } from "./atoms";
import type { ActionNotice } from "./useCandidateDetail";

/* Status notices. Colour is never the only signal: each carries an icon and
   explicit text, and urgent ones use role="alert". */

type NoticeTone = "error" | "warning" | "neutral";

const TONES: Record<NoticeTone, { bg: string; line: string; fg: string }> = {
  error: { bg: t.error100, line: t.errorLine, fg: t.errorInk },
  warning: { bg: t.warning100, line: t.warningLine, fg: t.warningInk },
  neutral: { bg: t.creamSoft, line: t.line, fg: t.neutralInk },
};

export function InlineNotice({
  tone,
  title,
  children,
  action,
  role = "status",
}: {
  tone: NoticeTone;
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  role?: "status" | "alert";
}) {
  const c = TONES[tone];
  return (
    <div
      role={role}
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        flexWrap: "wrap",
        padding: "12px 14px",
        borderRadius: 10,
        background: c.bg,
        border: `1px solid ${c.line}`,
        color: c.fg,
        fontFamily: f.sans,
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <span style={{ display: "flex", flexShrink: 0, paddingTop: 1 }}>{tone === "neutral" ? <EmployerIcon.Lock /> : <EmployerIcon.Alert />}</span>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        {title && <strong style={{ display: "block", marginBottom: 2 }}>{title}</strong>}
        {children}
      </div>
      {action}
    </div>
  );
}

export function SuspendedBanner() {
  return (
    <InlineNotice tone="warning" title="Your account is suspended">
      This candidate view is read-only. You can review evidence but can't invite, reject or message candidates until support restores access.
    </InlineNotice>
  );
}

export function ActionNoticeAlert({ notice, shortlistHref }: { notice: ActionNotice; shortlistHref: string }) {
  if (notice.kind === "unlock_required") {
    return (
      <InlineNotice tone="warning" role="alert" title="Unlock required" action={<UnlockLink href={shortlistHref}>Unlock from the shortlist</UnlockLink>}>
        {notice.message}
      </InlineNotice>
    );
  }
  if (notice.kind === "declined") {
    return (
      <InlineNotice tone="error" role="alert" title="Candidate declined contact">
        {notice.message}
      </InlineNotice>
    );
  }
  return (
    <InlineNotice tone="warning" role="alert" title="Action not allowed">
      {notice.message}
    </InlineNotice>
  );
}

/** Placeholder where verbatim quotes would be, shown while they are withheld. */
export function LockedQuotes({ shortlistHref }: { shortlistHref: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 10,
        padding: 16,
        borderRadius: 10,
        border: `1px dashed ${t.lineStrong}`,
        background: t.creamSoft,
        fontFamily: f.sans,
        fontSize: 13,
        color: t.neutralInk,
        lineHeight: 1.6,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, color: t.coal }}>
        <EmployerIcon.Lock />
        Verbatim quotes are locked
      </span>
      <span>What this candidate actually said in practice sessions is shown once you unlock them.</span>
      <UnlockLink href={shortlistHref}>Unlock to read quotes</UnlockLink>
    </div>
  );
}
