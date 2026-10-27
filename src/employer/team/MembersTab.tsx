"use client";

import { useMemo, useState } from "react";
import { LogOutIcon, MoreHorizontalIcon, SearchIcon, UserMinusIcon, UserPlusIcon, UsersIcon, CrownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/employer/_atoms";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { assignableRoles, canManageMember, type EmployerRole, type InvitableRole } from "../../../server-handlers/_employer-team-helpers";
import type { ActivitySummary, TeamMember } from "../useTeam";
import { relativeTime } from "../teamActivity";
import { PAD, PersonAvatar, RoleMenu, muted } from "./TeamParts";

export type MemberCommand =
  | { kind: "set_role"; member: TeamMember; role: InvitableRole }
  | { kind: "remove"; member: TeamMember }
  | { kind: "transfer"; member: TeamMember }
  | { kind: "leave"; member: TeamMember };

const COLS = "minmax(0, 1fr) 132px 112px 128px 40px";
const COLS_NO_ACTIVITY = "minmax(0, 1fr) 132px 112px 40px";
const SEARCH_FROM = 6;

export default function MembersTab({
  members, myRole, summary, summaryDays, showActivity, compact, soleOwner, canInvite, seatsFull, onInvite, onCommand, busyId,
}: {
  members: TeamMember[];
  myRole: EmployerRole;
  summary: ActivitySummary[];
  summaryDays: number;
  showActivity: boolean;
  compact: boolean;
  soleOwner: boolean;
  canInvite: boolean;
  seatsFull: boolean;
  onInvite: () => void;
  onCommand: (cmd: MemberCommand) => void;
  busyId: string | null;
}) {
  const counts = new Map(summary.map((s) => [s.userId, s.count]));
  const peak = Math.max(1, ...summary.map((s) => s.count));
  const columns = showActivity ? COLS : COLS_NO_ACTIVITY;
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () => (q ? members.filter((m) => `${m.name ?? ""} ${m.email}`.toLowerCase().includes(q)) : members),
    [members, q],
  );
  const alone = members.length === 1;

  return (
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
        <div role="row" className={PAD} style={{ display: "grid", gridTemplateColumns: columns, gap: 16, paddingTop: 10, paddingBottom: 10, borderBottom: `1px solid ${t.line}`, background: t.creamRaised }}>
          <span role="columnheader" style={headStyle}>Member</span>
          <span role="columnheader" style={headStyle}>Role</span>
          <span role="columnheader" style={headStyle}>Last active</span>
          {showActivity && <span role="columnheader" style={headStyle}>Actions, {summaryDays}d</span>}
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
              className={PAD}
              style={{ display: "grid", gridTemplateColumns: columns, gap: 16, alignItems: "center", paddingTop: 12, paddingBottom: 12, borderTop: i === 0 ? "none" : `1px solid ${t.line}` }}
            >
              <div role="cell" style={{ minWidth: 0 }}>{identity}</div>
              <div role="cell">{roleCell}</div>
              <div role="cell" style={{ ...muted, fontSize: 13 }}>{relativeTime(m.lastActiveAt)}</div>
              {showActivity && (
                <div role="cell" style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: f.sans, fontSize: 13, color: t.coal, fontVariantNumeric: "tabular-nums" }}>
                  <span style={{ minWidth: 24 }}>{counts.get(m.userId) ?? 0}</span>
                  <span aria-hidden="true" style={{ flex: 1, height: 4, borderRadius: 999, background: t.creamSoft, overflow: "hidden" }}>
                    <span style={{ display: "block", height: "100%", width: `${((counts.get(m.userId) ?? 0) / peak) * 100}%`, background: t.indigo, opacity: 0.55, borderRadius: 999 }} />
                  </span>
                </div>
              )}
              <div role="cell" style={{ display: "flex", justifyContent: "flex-end" }}>{menu}</div>
            </div>
          );
        })}
      </div>
      </div>

      {alone && canInvite && !q && (
        <div className={PAD} style={{ paddingTop: 20, paddingBottom: 24, borderTop: `1px solid ${t.line}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", border: `1px dashed ${t.line}`, borderRadius: 12, padding: "16px 18px", background: t.creamRaised }}>
            <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 10, background: t.indigo100, color: t.indigoDeep, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <UsersIcon size={17} />
            </span>
            <div style={{ flex: "1 1 260px", minWidth: 0 }}>
              <h2 style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal, margin: 0 }}>You&apos;re the only one here</h2>
              <p style={{ ...muted, marginTop: 2 }}>Bring in recruiters and hiring managers so jobs, candidates and messages are shared, and every action is attributed.</p>
            </div>
            <Button type="button" size="lg" className="h-9 gap-2 px-4" disabled={seatsFull} onClick={onInvite}>
              <UserPlusIcon aria-hidden="true" /> Invite teammate
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}

const headStyle: React.CSSProperties = { fontFamily: f.sans, fontSize: 12, fontWeight: 500, color: t.inkSoft };


