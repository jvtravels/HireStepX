"use client";

import { useMemo, useState } from "react";
import { LogOutIcon, MoreHorizontalIcon, SearchIcon, UserMinusIcon, CrownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/employer/_atoms";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { assignableRoles, canManageMember, type EmployerRole, type InvitableRole } from "../../../server-handlers/_employer-team-helpers";
import type { TeamMember } from "../useTeam";
import { relativeTime } from "../teamActivity";
import { PAD, PersonAvatar, RoleMenu, muted } from "./TeamParts";

export type MemberCommand =
  | { kind: "set_role"; member: TeamMember; role: InvitableRole }
  | { kind: "remove"; member: TeamMember }
  | { kind: "transfer"; member: TeamMember }
  | { kind: "leave"; member: TeamMember };

const COLS = "minmax(0, 1fr) 132px 112px 40px";
const SEARCH_FROM = 6;

export default function MembersTab({
  members, myRole, compact, soleOwner, onCommand, busyId,
}: {
  members: TeamMember[];
  myRole: EmployerRole;
  compact: boolean;
  soleOwner: boolean;
  onCommand: (cmd: MemberCommand) => void;
  busyId: string | null;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () => (q ? members.filter((m) => `${m.name ?? ""} ${m.email}`.toLowerCase().includes(q)) : members),
    [members, q],
  );

  return (
    <TooltipProvider delayDuration={150}>
    <div>
      {members.length >= SEARCH_FROM && (
        <div className={PAD} style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 12, borderBottom: `1px solid ${t.line}` }}>
          <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 320 }}>
            <SearchIcon size={15} aria-hidden="true" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: t.inkSoft }} />
            <Input
              type="search"
              aria-label="Search members"
              placeholder="Search by name or email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 bg-white pl-8"
              style={{ fontFamily: f.sans }}
            />
          </div>
          <span style={{ ...muted, fontSize: 12 }} aria-live="polite">
            {q ? `${visible.length} of ${members.length}` : `${members.length} members`}
          </span>
        </div>
      )}
      <div role="table" aria-label="Team members">
      {!compact && (
        <div role="row" className={PAD} style={{ display: "grid", gridTemplateColumns: COLS, gap: 16, paddingTop: 10, paddingBottom: 10, borderBottom: `1px solid ${t.line}`, background: t.creamRaised }}>
          <span role="columnheader" style={headStyle}>Member</span>
          <span role="columnheader" style={headStyle}>Role</span>
          <span role="columnheader" style={headStyle}>Last active</span>
          <span role="columnheader" style={headStyle}><span className="sr-only">Actions</span></span>
        </div>
      )}

      <div role="rowgroup">
        {visible.length === 0 && (
          <div role="row"><p role="cell" style={{ ...muted, padding: "32px 16px", textAlign: "center" }}>No one matches &ldquo;{query.trim()}&rdquo;.</p></div>
        )}
        {visible.map((m, i) => {
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="block">
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={soleOwner}
                          onClick={() => onCommand({ kind: "leave", member: m })}
                        >
                          <LogOutIcon aria-hidden="true" /> Leave team
                        </DropdownMenuItem>
                      </span>
                    </TooltipTrigger>
                    {soleOwner && <TooltipContent side="left">Make someone else owner before you leave.</TooltipContent>}
                  </Tooltip>
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
              className={PAD}
              style={{ display: "grid", gridTemplateColumns: COLS, gap: 16, alignItems: "center", paddingTop: 12, paddingBottom: 12, borderTop: i === 0 ? "none" : `1px solid ${t.line}` }}
            >
              <div role="cell" style={{ minWidth: 0 }}>{identity}</div>
              <div role="cell">{roleCell}</div>
              <div role="cell" style={{ ...muted, fontSize: 13 }}>{relativeTime(m.lastActiveAt)}</div>
              <div role="cell" style={{ display: "flex", justifyContent: "flex-end" }}>{menu}</div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
    </TooltipProvider>
  );
}

const headStyle: React.CSSProperties = { fontFamily: f.sans, fontSize: 12, fontWeight: 500, color: t.inkSoft };


