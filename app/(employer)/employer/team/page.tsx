"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/Toast";
import { useMaxWidth } from "@/hooks/useMaxWidth";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { can, ROLE_LABEL } from "../../../../server-handlers/_employer-team-helpers";
import { useTeam, useTeamActivity, type ActivityFilter, type InviteResult, type TeamAction, type TeamInvite } from "@/employer/useTeam";
import { ConfirmDialog, ErrorPanel, PageSkeleton, muted, type ConfirmSpec } from "@/employer/team/TeamParts";
import InvitePanel from "@/employer/team/InvitePanel";
import MembersTab, { type MemberCommand } from "@/employer/team/MembersTab";
import InvitesTab from "@/employer/team/InvitesTab";
import ActivityTab from "@/employer/team/ActivityTab";

type TabId = "members" | "invites" | "activity";

/* /employer/team — one company, many people. Everyone on the team can see who
   is on it; owners and admins also invite, change roles, and read the activity
   log. What a viewer may NOT do is hidden rather than disabled, and every rule
   is enforced again on the server (employer-team handler). */
export default function EmployerTeamPage() {
  const router = useRouter();
  const { teamsEnabled, companyStatusLoading } = useEmployerData();
  const hidden = !companyStatusLoading && !teamsEnabled;
  useEffect(() => { if (hidden) router.replace("/employer"); }, [hidden, router]);
  if (!teamsEnabled) return <PageSkeleton label="Loading team" />;
  return <TeamConsole />;
}

function TeamConsole() {
  const { toast } = useToast();
  const compact = useMaxWidth(760);
  const { companyName, refreshCompanyStatus } = useEmployerData();
  const { team, loading, error, reload, run } = useTeam();

  const [tab, setTab] = useState<TabId>("members");
  const [inviting, setInviting] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ActivityFilter>({ actor: "", group: "" });
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const myRole = team?.me.role ?? "viewer";
  const canInvite = can(myRole, "team.invite");
  const canSeeActivity = can(myRole, "audit.read");
  const activity = useTeamActivity(canSeeActivity && !!team, filter);

  const panelOpen = inviting && canInvite && tab !== "activity";
  const pendingInvites = useMemo(() => (team?.invites ?? []).filter((i) => i.state === "pending" || i.state === "expired"), [team]);
  const existingEmails = useMemo(
    () => new Set([...(team?.members ?? []).map((m) => m.email.toLowerCase()), ...(team?.invites ?? []).filter((i) => i.state === "pending").map((i) => i.email.toLowerCase())]),
    [team],
  );

  if (loading) return <PageSkeleton label="Loading team" />;
  if (error || !team) {
    return <ErrorPanel title="We couldn't load your team" message={error ?? "Check your connection and try again."} onRetry={() => { void reload(); }} />;
  }

  const owners = team.members.filter((m) => m.role === "owner").length;
  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: "members", label: "Members", count: team.members.length },
    ...(canInvite ? [{ id: "invites" as const, label: "Invites", count: pendingInvites.length }] : []),
    ...(canSeeActivity ? [{ id: "activity" as const, label: "Activity" }] : []),
  ];

  const fail = (message: string) => toast(message, "error");

  const invite = async (body: Extract<TeamAction, { action: "invite" }>) => {
    const res = await run<InviteResult>(body);
    return res;
  };

  const resend = async (inv: TeamInvite): Promise<string | null> => {
    setBusyId(inv.id);
    const res = await run<InviteResult>({ action: "resend_invite", inviteId: inv.id });
    setBusyId(null);
    if (!res.ok) { fail(res.error); return null; }
    toast(res.data.emailed ? `Invite sent again to ${inv.email}.` : "Couldn't email them. Copy the link below instead.", res.data.emailed ? "success" : "info");
    return res.data.link;
  };

  const revoke = (inv: TeamInvite) => setConfirm({
    title: `Revoke the invite for ${inv.email}?`,
    body: "The link stops working immediately. You can invite them again later.",
    action: "Revoke invite",
    destructive: true,
    run: async () => {
      setConfirm(null);
      setBusyId(inv.id);
      const res = await run({ action: "revoke_invite", inviteId: inv.id });
      setBusyId(null);
      if (!res.ok) fail(res.error);
      else toast("Invite revoked.", "success");
    },
  });

  const onCommand = (cmd: MemberCommand) => {
    const who = cmd.member.name || cmd.member.email;
    const exec = async (body: TeamAction, done: string, after?: () => void) => {
      setConfirm(null);
      setBusyId(cmd.member.userId);
      const res = await run(body);
      setBusyId(null);
      if (!res.ok) { fail(res.error); return; }
      toast(done, "success");
      after?.();
    };
    if (cmd.kind === "set_role") {
      void exec({ action: "set_role", userId: cmd.member.userId, role: cmd.role }, `${who} is now ${ROLE_LABEL[cmd.role].toLowerCase()}.`);
    } else if (cmd.kind === "remove") {
      setConfirm({
        title: `Remove ${who} from the team?`,
        body: "They lose access to jobs, candidates and messages right away. Their past activity stays in the log.",
        action: "Remove",
        destructive: true,
        run: () => exec({ action: "remove_member", userId: cmd.member.userId }, `${who} was removed.`),
      });
    } else if (cmd.kind === "transfer") {
      setConfirm({
        title: `Make ${who} the owner?`,
        body: "They get full control of the company, including who else can be owner. You become an admin. Only the new owner can undo this.",
        action: "Transfer ownership",
        run: () => exec({ action: "transfer_ownership", userId: cmd.member.userId }, `${who} is now the owner.`, () => { void refreshCompanyStatus(); }),
      });
    } else {
      setConfirm({
        title: "Leave this team?",
        body: `You'll lose access to ${companyName || "this company"}. An admin can invite you back.`,
        action: "Leave team",
        destructive: true,
        run: async () => {
          setConfirm(null);
          const res = await run({ action: "leave" });
          if (!res.ok) { fail(res.error); return; }
          window.location.assign("/employer");
        },
      });
    }
  };

  const onTabKey = (e: React.KeyboardEvent, index: number) => {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = tabs[(index + dir + tabs.length) % tabs.length];
    setTab(next.id);
    tabRefs.current[next.id]?.focus();
  };

  const seatsNote = `${team.members.length} of ${team.limits.maxTeamSize} seats used`;

  return (
    <div style={{ width: "100%" }}>
      <div style={{ background: t.white, border: `1px solid ${t.line}`, borderRadius: 16, overflow: "hidden" }}>
        <header style={{ padding: "20px 28px 0", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontFamily: f.sans, fontSize: 20, fontWeight: 600, color: t.coal, margin: 0, letterSpacing: "-0.01em" }}>Team</h1>
              <p style={{ ...muted, fontSize: 14, marginTop: 4 }}>
                {canInvite
                  ? `Everyone with access to ${companyName || "this company"} on HireStepX. ${seatsNote}.`
                  : `You're ${/^[aeiou]/i.test(ROLE_LABEL[myRole]) ? "an" : "a"} ${ROLE_LABEL[myRole].toLowerCase()} on ${companyName || "this company"}. ${seatsNote}.`}
              </p>
            </div>
            {canInvite && !panelOpen && (
              <Button
                type="button"
                size="lg"
                className="h-9 gap-2 px-4"
                disabled={team.members.length >= team.limits.maxTeamSize}
                onClick={() => { setInviting(true); setTab("members"); }}
              >
                <UserPlusIcon aria-hidden="true" /> Invite teammate
              </Button>
            )}
          </div>

          <div role="tablist" aria-label="Team sections" style={{ display: "flex", gap: 24, marginBottom: -1, overflowX: "auto" }}>
            {tabs.map((tb, i) => {
              const on = tab === tb.id;
              return (
                <button
                  key={tb.id}
                  ref={(el) => { tabRefs.current[tb.id] = el; }}
                  role="tab"
                  type="button"
                  id={`team-tab-${tb.id}`}
                  aria-selected={on}
                  aria-controls="team-panel"
                  tabIndex={on ? 0 : -1}
                  onClick={() => setTab(tb.id)}
                  onKeyDown={(e) => onTabKey(e, i)}
                  className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--btn-primary)]"
                  style={{
                    background: "none", border: 0, cursor: "pointer", padding: "10px 0 12px", whiteSpace: "nowrap",
                    fontFamily: f.sans, fontSize: 14, fontWeight: on ? 600 : 500, color: on ? t.coal : t.inkSoft,
                    borderBottom: `2px solid ${on ? t.indigo : "transparent"}`,
                  }}
                >
                  {tb.label}
                  {tb.count !== undefined && (
                    <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 500, color: t.inkSoft, fontVariantNumeric: "tabular-nums" }}>{tb.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </header>
        <div style={{ borderTop: `1px solid ${t.line}` }} />

        {panelOpen && (
          <InvitePanel
            roles={team.assignableRoles}
            existingEmails={existingEmails}
            onInvite={invite}
            onClose={() => setInviting(false)}
          />
        )}

        <div role="tabpanel" id="team-panel" aria-labelledby={`team-tab-${tab}`}>
          {tab === "members" && (
            <MembersTab
              members={team.members}
              myRole={myRole}
              summary={activity.summary}
              summaryDays={activity.summaryDays}
              showActivity={canSeeActivity && !compact}
              compact={compact}
              soleOwner={myRole === "owner" && owners <= 1}
              onCommand={onCommand}
              busyId={busyId}
            />
          )}
          {tab === "invites" && canInvite && (
            <InvitesTab
              invites={team.invites}
              canInvite={canInvite}
              onResend={resend}
              onRevoke={revoke}
              onInviteClick={() => { setInviting(true); setTab("members"); }}
              busyId={busyId}
            />
          )}
          {tab === "activity" && canSeeActivity && (
            <ActivityTab activity={activity} filter={filter} onFilter={setFilter} members={team.members} />
          )}
        </div>
      </div>

      <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
