"use client";

import { useState } from "react";
import { CopyIcon, MailIcon, RotateCwIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/employer/_atoms";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import type { TeamInvite } from "../useTeam";
import { daysUntil } from "../teamActivity";
import { RoleBadge, muted } from "./TeamParts";

export default function InvitesTab({
  invites, canInvite, onResend, onRevoke, onInviteClick, busyId,
}: {
  invites: TeamInvite[];
  canInvite: boolean;
  onResend: (invite: TeamInvite) => Promise<string | null>;
  onRevoke: (invite: TeamInvite) => void;
  onInviteClick: () => void;
  busyId: string | null;
}) {
  const [links, setLinks] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const open = invites.filter((i) => i.state === "pending" || i.state === "expired");

  if (open.length === 0) {
    return (
      <div style={{ padding: "56px 28px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 6 }}>
        <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, background: t.creamSoft, color: t.inkSoft, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
          <MailIcon size={18} />
        </span>
        <h2 style={{ fontFamily: f.sans, fontSize: 15, fontWeight: 600, color: t.coal, margin: 0 }}>No pending invites</h2>
        <p style={{ ...muted, maxWidth: 360 }}>Invites you send show up here until they&apos;re accepted, revoked or expired.</p>
        {canInvite && (
          <Button type="button" variant="outline" size="lg" className="mt-3 h-9 px-4" onClick={onInviteClick}>Invite a teammate</Button>
        )}
      </div>
    );
  }

  const copy = async (id: string, link: string) => {
    try { await navigator.clipboard.writeText(link); setCopiedId(id); window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000); } catch { /* clipboard blocked; link stays visible */ }
  };

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {open.map((inv, i) => {
        const expired = inv.state === "expired";
        const left = daysUntil(inv.expiresAt);
        const busy = busyId === inv.id;
        return (
          <li key={inv.id} style={{ padding: "14px 28px", borderTop: i === 0 ? "none" : `1px solid ${t.line}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal, overflowWrap: "anywhere" }}>{inv.email}</span>
                  <RoleBadge role={inv.role} />
                  <Badge tone={expired ? "warning" : "neutral"}>{expired ? "Expired" : "Pending"}</Badge>
                </div>
                <p style={{ ...muted, fontSize: 12, marginTop: 2 }}>
                  {inv.invitedByName ? `Invited by ${inv.invitedByName} · ` : ""}
                  {expired ? "Send a new invite to reopen access." : left <= 1 ? "Expires today" : `Expires in ${left} days`}
                </p>
              </div>
              {canInvite && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Button
                    type="button" variant="outline" size="lg" className="h-9 gap-2 px-3.5" disabled={busy}
                    onClick={() => { void onResend(inv).then((link) => { if (link) setLinks((l) => ({ ...l, [inv.id]: link })); }); }}
                  >
                    <RotateCwIcon aria-hidden="true" /> {expired ? "Send again" : "Resend"}
                  </Button>
                  <Button type="button" variant="ghost" size="lg" className="h-9 px-3" disabled={busy} onClick={() => onRevoke(inv)}>Revoke</Button>
                </div>
              )}
            </div>
            {links[inv.id] && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                <code style={{ flex: 1, minWidth: 0, fontFamily: f.mono, fontSize: 12, color: t.inkSoft, background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: 8, padding: "7px 10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {links[inv.id]}
                </code>
                <Button type="button" variant="outline" size="lg" className="h-8 gap-2 px-3" onClick={() => void copy(inv.id, links[inv.id])}>
                  {copiedId === inv.id ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
                  {copiedId === inv.id ? "Copied" : "Copy"}
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
