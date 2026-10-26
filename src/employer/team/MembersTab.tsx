"use client";

import { LogOutIcon, MoreHorizontalIcon, UserMinusIcon, CrownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/employer/_atoms";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { assignableRoles, canManageMember, type EmployerRole, type InvitableRole } from "../../../server-handlers/_employer-team-helpers";
import type { ActivitySummary, TeamMember } from "../useTeam";
import { relativeTime } from "../teamActivity";
import { PersonAvatar, RoleMenu, muted } from "./TeamParts";

export type MemberCommand =
  | { kind: "set_role"; member: TeamMember; role: InvitableRole }
  | { kind: "remove"; member: TeamMember }
  | { kind: "transfer"; member: TeamMember }
  | { kind: "leave"; member: TeamMember };

const COLS = "minmax(0, 1fr) 132px 112px 88px 40px";
const COLS_NO_ACTIVITY = "minmax(0, 1fr) 132px 112px 40px";

export default function MembersTab({
  members, myRole, summary, summaryDays, showActivity, compact, soleOwner, onCommand, busyId,
}: {
  members: TeamMember[];
  myRole: EmployerRole;
  summary: ActivitySummary[];
  summaryDays: number;
  showActivity: boolean;
  compact: boolean;
  soleOwner: boolean;
  onCommand: (cmd: MemberCommand) => void;
  busyId: string | null;
}) {
  const counts = new Map(summary.map((s) => [s.userId, s.count]));
  const columns = showActivity ? COLS : COLS_NO_ACTIVITY;

  return (
    <div role="table" aria-label="Team members">
      {!compact && (
        <div role="row" style={{ display: "grid", gridTemplateColumns: columns, gap: 16, padding: "10px 28px", borderBottom: `1px solid ${t.line}`, background: t.creamRaised }}>
          <span role="columnheader" style={headStyle}>Member</span>
          <span role="columnheader" style={headStyle}>Role</span>
          <span role="columnheader" style={headStyle}>Last active</span>
          {showActivity && <span role="columnheader" style={{ ...headStyle, textAlign: "right" }}>{summaryDays}d actions</span>}
          <span role="columnheader" style={headStyle}><span className="sr-only">Actions</span></span>
        </div>
      )}

      <div role="rowgroup">
        {members.map((m, i) => {
          const label = m.name || m.email;
          const roleOptions = m.isYou || !canManageMember(myRole, m.role) ? [] : assignableRoles(myRole);
          const canRemove = !m.isYou && canManageMember(myRole, m.role);
          const canTransfer = !m.isYou && myRole === "owner" && m.role !== "owner";
          const canLeave = m.isYou;
          const hasMenu = canRemove || canTransfer || canLeave;
          const busy = busyId === m.userId;

          const identity = (
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <PersonAvatar seed={m.userId} label={label} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                  {m.isYou && <Badge tone="neutral">You</Badge>}
                </div>
                <div style={{ ...muted, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.name ? m.email : null}
                  {compact && <>{m.name ? " · " : ""}Active {relativeTime(m.lastActiveAt).toLowerCase()}</>}
                </div>
              </div>
            </div>
          );

          const menu = hasMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild disabled={busy}>
                <Button type="button" variant="ghost" size="icon" aria-label={`More actions for ${label}`}>
                  <MoreHorizontalIcon aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {canTransfer && (
                  <DropdownMenuItem onClick={() => onCommand({ kind: "transfer", member: m })}>
                    <CrownIcon aria-hidden="true" /> Make owner
                  </DropdownMenuItem>
                )}
                {canTransfer && canRemove && <DropdownMenuSeparator />}
                {canRemove && (
                  <DropdownMenuItem variant="destructive" onClick={() => onCommand({ kind: "remove", member: m })}>
                    <UserMinusIcon aria-hidden="true" /> Remove from team
                  </DropdownMenuItem>
                )}
                {canLeave && (
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={soleOwner}
                    onClick={() => onCommand({ kind: "leave", member: m })}
                  >
                    <LogOutIcon aria-hidden="true" /> Leave team
                  </DropdownMenuItem>
                )}
                {canLeave && soleOwner && (
                  <p style={{ ...muted, fontSize: 12, padding: "6px 8px 4px" }}>Make someone else owner before you leave.</p>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : <span />;

          const roleCell = (
            <RoleMenu
              role={m.role}
              options={roleOptions}
              disabled={busy}
              label={label}
              onSelect={(role) => onCommand({ kind: "set_role", member: m, role })}
            />
          );

          if (compact) {
            return (
              <div key={m.userId} role="row" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "10px 12px", alignItems: "center", padding: "14px 16px", borderTop: i === 0 ? "none" : `1px solid ${t.line}` }}>
                <div role="cell" style={{ minWidth: 0 }}>{identity}</div>
                <div role="cell">{menu}</div>
                <div role="cell" style={{ gridColumn: "1 / -1", paddingLeft: 48 }}>{roleCell}</div>
              </div>
            );
          }
          return (
            <div
              key={m.userId}
              role="row"
              style={{ display: "grid", gridTemplateColumns: columns, gap: 16, alignItems: "center", padding: "12px 28px", borderTop: i === 0 ? "none" : `1px solid ${t.line}` }}
            >
              <div role="cell" style={{ minWidth: 0 }}>{identity}</div>
              <div role="cell">{roleCell}</div>
              <div role="cell" style={{ ...muted, fontSize: 13 }}>{relativeTime(m.lastActiveAt)}</div>
              {showActivity && (
                <div role="cell" style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {counts.get(m.userId) ?? 0}
                </div>
              )}
              <div role="cell" style={{ display: "flex", justifyContent: "flex-end" }}>{menu}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const headStyle: React.CSSProperties = { fontFamily: f.sans, fontSize: 12, fontWeight: 500, color: t.inkSoft };


