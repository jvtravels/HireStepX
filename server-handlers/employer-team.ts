/* Vercel Edge Function — Employer team (members + invites)
 *
 * GET  /api/employer-team → { me, members, invites, limits }
 *      Every member can read the roster; pending invites only go to people who
 *      can manage invites (owner/admin).
 * POST /api/employer-team { action, ... } where action is one of:
 *      invite               { email, role }      send (or replace) an invite
 *      resend_invite        { inviteId }         rotate the link and re-send
 *      revoke_invite        { inviteId }
 *      set_role             { userId, role }
 *      remove_member        { userId }
 *      leave                {}
 *      transfer_ownership   { userId }           owner → member, owner becomes admin
 *
 * Authorization is by permission (see _employer-team-helpers.ts), and the
 * hierarchy rules (admins can't touch admins, last owner can't leave, nobody
 * edits their own role) live in checkMemberChange so they are unit-tested.
 * Accepting an invite is a separate endpoint: employer-team-accept.ts.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, slog } from "./_shared";
import {
  MAX_TEAM_SIZE, INVITE_TTL_DAYS, INVITES_PER_DAY, RESENDS_PER_DAY, invitesRemainingToday, VIOLATION_MESSAGE, assignableRoles, can, canManageMember, checkMemberChange,
  generateInviteToken, hashInviteToken, inviteState, isEmployerRole, isInvitableRole, isValidEmail, normalizeEmail,
  requireEmployerPermission, writeAuditLog,
  type AuditAction, type EmployerContext, type EmployerRole, type InviteRow, type InvitableRole,
} from "./_employer-team-helpers";
import { inviteLink, sendTeamChangeEmail, sendTeamInviteEmail, type TeamChange } from "./_employer-team-emails";
import { teamsEnabledFor } from "./_employer-team-gate";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}
const jsonHeaders = () => ({ ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=representation" });

interface MemberRow {
  user_id: string;
  role: EmployerRole;
  email: string;
  name: string | null;
  invited_by: string | null;
  joined_at: string;
  last_active_at: string | null;
}
interface InviteListRow extends InviteRow {
  invited_by: string | null;
  created_at: string;
}

const MEMBER_COLS = "user_id,role,email,name,invited_by,joined_at,last_active_at";
const INVITE_COLS = "id,employer_id,email,role,invited_by,expires_at,accepted_at,revoked_at,created_at";

async function loadRoster(employerId: string): Promise<MemberRow[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/employer_members?employer_id=eq.${encodeURIComponent(employerId)}&select=${MEMBER_COLS}&order=joined_at.asc`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) throw new Error(`roster read failed: ${res.status}`);
  return (await res.json()) as MemberRow[];
}

async function loadLiveInvites(employerId: string): Promise<InviteListRow[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/employer_invites?employer_id=eq.${encodeURIComponent(employerId)}&accepted_at=is.null&revoked_at=is.null&select=${INVITE_COLS}&order=created_at.desc&limit=100`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) throw new Error(`invites read failed: ${res.status}`);
  return (await res.json()) as InviteListRow[];
}

async function loadRecentInviteTimes(employerId: string): Promise<string[]> {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/employer_invites?employer_id=eq.${encodeURIComponent(employerId)}&created_at=gt.${encodeURIComponent(since)}&select=created_at&limit=200`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) throw new Error(`recent invites read failed: ${res.status}`);
  return ((await res.json()) as Array<{ created_at: string }>).map((r) => r.created_at);
}

async function countResendsToday(employerId: string): Promise<number> {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/employer_audit_log?employer_id=eq.${encodeURIComponent(employerId)}&action=eq.member.invite_resent&created_at=gt.${encodeURIComponent(since)}&select=id&limit=200`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) throw new Error(`resend count failed: ${res.status}`);
  return ((await res.json()) as unknown[]).length;
}

async function loadInvite(employerId: string, inviteId: string): Promise<InviteListRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/employer_invites?id=eq.${encodeURIComponent(inviteId)}&employer_id=eq.${encodeURIComponent(employerId)}&select=${INVITE_COLS}&limit=1`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) throw new Error(`invite read failed: ${res.status}`);
  return ((await res.json()) as InviteListRow[])[0] ?? null;
}

async function loadCompany(employerId: string): Promise<{ company_name: string; suspended_at: string | null } | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/employers?id=eq.${encodeURIComponent(employerId)}&select=company_name,suspended_at&limit=1`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) throw new Error(`company read failed: ${res.status}`);
  return ((await res.json()) as Array<{ company_name: string; suspended_at: string | null }>)[0] ?? null;
}

function memberDto(m: MemberRow, meId: string) {
  return {
    userId: m.user_id, role: m.role, email: m.email, name: m.name, joinedAt: m.joined_at,
    lastActiveAt: m.last_active_at, invitedBy: m.invited_by, isYou: m.user_id === meId,
  };
}

function inviteDto(i: InviteListRow, roster: MemberRow[]) {
  const by = roster.find((m) => m.user_id === i.invited_by);
  return {
    id: i.id, email: i.email, role: i.role, createdAt: i.created_at, expiresAt: i.expires_at,
    state: inviteState(i), invitedByName: by?.name || by?.email || null,
  };
}

export default async function handler(req: Request): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 503, headers: corsHeaders(req, { allowGet: true }) });
  }
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "employer-team", ipLimit: 60, userLimit: 40, maxBytes: 8_000, checkQuota: false, allowGet: true,
  });
  if (pre instanceof Response) return pre;
  const headers = { ...pre.headers, ...corsHeaders(req, { allowGet: true }) };
  const userId = pre.auth.userId;
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (!userId) return reply({ error: "Unauthorized" }, 401);

  try {
    const gate = await requireEmployerPermission(SUPABASE_URL, serviceHeaders(), userId, "team.read");
    if (!gate.ok) return reply({ error: gate.error }, gate.status);
    const ctx = gate.ctx;
    if (!(await teamsEnabledFor(ctx.employerId))) return reply({ error: "Not found" }, 404);

    if (req.method === "GET") return await handleGet(ctx, reply);
    if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return reply({ error: "Invalid JSON body" }, 400);
    }
    return await handleAction(ctx, body, reply);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-team threw", { code: "employer_team_unexpected_error", error: msg.slice(0, 200), userId });
    return reply({ error: "Something went wrong. Please try again." }, 500);
  }
}

type Reply = (body: unknown, status?: number) => Response;

async function handleGet(ctx: EmployerContext, reply: Reply): Promise<Response> {
  const roster = await loadRoster(ctx.employerId);
  const invites = can(ctx.role, "team.invite") ? await loadLiveInvites(ctx.employerId) : [];
  return reply({
    me: { userId: ctx.userId, role: ctx.role, email: ctx.email },
    members: roster.map((m) => memberDto(m, ctx.userId)),
    invites: invites.map((i) => inviteDto(i, roster)),
    assignableRoles: assignableRoles(ctx.role),
    limits: { maxTeamSize: MAX_TEAM_SIZE, invitesPerDay: INVITES_PER_DAY, inviteTtlDays: INVITE_TTL_DAYS },
  });
}

function audit(ctx: EmployerContext, action: AuditAction, entityId: string | undefined, meta: Record<string, unknown>) {
  return writeAuditLog(SUPABASE_URL, serviceHeaders(), {
    employerId: ctx.employerId, actorUserId: ctx.userId, actorEmail: ctx.email, action,
    entityType: "member", entityId, meta,
  });
}

/* Best-effort: the change is already committed, so telling the person never
   fails the request. Email only: removed people have lost the console. */
async function tellMember(ctx: EmployerContext, companyName: string, target: { email: string }, change: TeamChange): Promise<void> {
  await Promise.allSettled([sendTeamChangeEmail({ to: target.email, change, companyName, actorName: ctx.name || ctx.email })]);
}

async function handleAction(ctx: EmployerContext, body: Record<string, unknown>, reply: Reply): Promise<Response> {
  const action = typeof body.action === "string" ? body.action : "";
  const company = await loadCompany(ctx.employerId);
  if (!company) return reply({ error: "Company not found" }, 404);
  if (company.suspended_at) return reply({ error: "This account is suspended, so team changes are turned off." }, 403);

  switch (action) {
    case "invite":
      return invite(ctx, company.company_name, body, reply);
    case "resend_invite":
      return resendInvite(ctx, company.company_name, body, reply);
    case "revoke_invite":
      return revokeInvite(ctx, body, reply);
    case "set_role":
      return changeMember(ctx, company.company_name, String(body.userId ?? ""), isEmployerRole(body.role) ? body.role : undefined, reply);
    case "remove_member":
      return changeMember(ctx, company.company_name, String(body.userId ?? ""), null, reply);
    case "leave":
      return changeMember(ctx, company.company_name, ctx.userId, null, reply);
    case "transfer_ownership":
      return transferOwnership(ctx, company.company_name, String(body.userId ?? ""), reply);
    default:
      return reply({ error: "Unknown action" }, 400);
  }
}

async function insertInvite(ctx: EmployerContext, email: string, role: InvitableRole, tokenHash: string): Promise<InviteListRow | "conflict"> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/employer_invites`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      employer_id: ctx.employerId, email, role, token_hash: tokenHash, invited_by: ctx.userId,
      expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString(),
    }),
  });
  if (res.status === 409) return "conflict";
  if (!res.ok) throw new Error(`invite insert failed: ${res.status}`);
  return ((await res.json()) as InviteListRow[])[0];
}

async function invite(ctx: EmployerContext, companyName: string, body: Record<string, unknown>, reply: Reply): Promise<Response> {
  if (!can(ctx.role, "team.invite")) return reply({ error: VIOLATION_MESSAGE.forbidden }, 403);
  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) return reply({ error: "Enter a valid email address." }, 400);
  if (!isInvitableRole(body.role) || !assignableRoles(ctx.role).includes(body.role)) {
    return reply({ error: VIOLATION_MESSAGE.cannot_assign_role }, 403);
  }
  const role = body.role;

  const [roster, live, recent] = await Promise.all([loadRoster(ctx.employerId), loadLiveInvites(ctx.employerId), loadRecentInviteTimes(ctx.employerId)]);
  if (roster.some((m) => m.email === email)) return reply({ error: "That person is already on your team." }, 409);

  const pending = live.filter((i) => inviteState(i) === "pending");
  if (roster.length + pending.filter((i) => i.email !== email).length >= MAX_TEAM_SIZE) {
    return reply({ error: `Teams are limited to ${MAX_TEAM_SIZE} people. Remove someone or cancel an invite first.` }, 409);
  }
  if (invitesRemainingToday(recent) === 0) {
    return reply({ error: "You've sent a lot of invites today. Try again tomorrow." }, 429);
  }

  // Re-inviting an address replaces its live invite (one live invite per email).
  const existing = live.find((i) => i.email === email);
  if (existing) {
    if (!canManageMember(ctx.role, existing.role)) return reply({ error: VIOLATION_MESSAGE.forbidden }, 403);
    await fetch(`${SUPABASE_URL}/rest/v1/employer_invites?id=eq.${existing.id}`, {
      method: "PATCH", headers: { ...jsonHeaders(), Prefer: "return=minimal" }, body: JSON.stringify({ revoked_at: new Date().toISOString() }),
    });
  }

  const token = generateInviteToken();
  const row = await insertInvite(ctx, email, role, await hashInviteToken(token));
  if (row === "conflict") return reply({ error: "An invite for that email is already pending." }, 409);

  const emailed = await sendTeamInviteEmail({ to: email, token, companyName, inviterName: ctx.name || ctx.email, role });
  await audit(ctx, "member.invited", row.id, { email, role });
  return reply({ invite: inviteDto(row, roster), link: inviteLink(token), emailed }, 201);
}

async function resendInvite(ctx: EmployerContext, companyName: string, body: Record<string, unknown>, reply: Reply): Promise<Response> {
  if (!can(ctx.role, "team.invite")) return reply({ error: VIOLATION_MESSAGE.forbidden }, 403);
  const inv = await loadInvite(ctx.employerId, String(body.inviteId ?? ""));
  if (!inv || inv.accepted_at || inv.revoked_at) return reply({ error: "Invite not found" }, 404);
  if (!canManageMember(ctx.role, inv.role)) return reply({ error: VIOLATION_MESSAGE.forbidden }, 403);

  if ((await countResendsToday(ctx.employerId)) >= RESENDS_PER_DAY) {
    return reply({ error: "You've re-sent a lot of invites today. Try again tomorrow." }, 429);
  }

  const token = generateInviteToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/employer_invites?id=eq.${inv.id}&accepted_at=is.null&revoked_at=is.null`, {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify({
      token_hash: await hashInviteToken(token), invited_by: ctx.userId,
      expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`invite rotate failed: ${res.status}`);
  const row = ((await res.json()) as InviteListRow[])[0];
  if (!row) return reply({ error: "Invite not found" }, 404);

  const emailed = await sendTeamInviteEmail({ to: inv.email, token, companyName, inviterName: ctx.name || ctx.email, role: inv.role });
  await audit(ctx, "member.invite_resent", inv.id, { email: inv.email, role: inv.role });
  return reply({ invite: inviteDto(row, await loadRoster(ctx.employerId)), link: inviteLink(token), emailed });
}

async function revokeInvite(ctx: EmployerContext, body: Record<string, unknown>, reply: Reply): Promise<Response> {
  if (!can(ctx.role, "team.invite")) return reply({ error: VIOLATION_MESSAGE.forbidden }, 403);
  const inv = await loadInvite(ctx.employerId, String(body.inviteId ?? ""));
  if (!inv || inv.accepted_at || inv.revoked_at) return reply({ error: "Invite not found" }, 404);
  if (!canManageMember(ctx.role, inv.role)) return reply({ error: VIOLATION_MESSAGE.forbidden }, 403);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/employer_invites?id=eq.${inv.id}&accepted_at=is.null`, {
    method: "PATCH", headers: { ...jsonHeaders(), Prefer: "return=minimal" }, body: JSON.stringify({ revoked_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`invite revoke failed: ${res.status}`);
  await audit(ctx, "member.invite_revoked", inv.id, { email: inv.email, role: inv.role });
  return reply({ ok: true });
}

/** newRole: a role to set, null to remove/leave, undefined = the client sent an invalid role. */
async function changeMember(ctx: EmployerContext, companyName: string, targetId: string, newRole: EmployerRole | null | undefined, reply: Reply): Promise<Response> {
  if (!targetId || newRole === undefined) return reply({ error: "Invalid request" }, 400);
  const roster = await loadRoster(ctx.employerId);
  const violation = checkMemberChange({
    actorId: ctx.userId, actorRole: ctx.role, targetId, newRole,
    roster: roster.map((m) => ({ userId: m.user_id, role: m.role })),
  });
  if (violation) return reply({ error: VIOLATION_MESSAGE[violation], code: violation }, violation === "forbidden" ? 403 : 409);
  const target = roster.find((m) => m.user_id === targetId)!;
  const where = `employer_id=eq.${encodeURIComponent(ctx.employerId)}&user_id=eq.${encodeURIComponent(targetId)}`;

  if (newRole === null) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/employer_members?${where}`, { method: "DELETE", headers: { ...serviceHeaders(), Prefer: "return=minimal" } });
    if (!res.ok) throw new Error(`member delete failed: ${res.status}`);
    await audit(ctx, targetId === ctx.userId ? "member.left" : "member.removed", targetId, { email: target.email, role: target.role });
    if (targetId !== ctx.userId) await tellMember(ctx, companyName, { email: target.email }, { kind: "removed" });
    return reply({ ok: true });
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/employer_members?${where}`, {
    method: "PATCH", headers: jsonHeaders(), body: JSON.stringify({ role: newRole }),
  });
  if (!res.ok) throw new Error(`member update failed: ${res.status}`);
  await audit(ctx, "member.role_changed", targetId, { email: target.email, from: target.role, to: newRole });
  await tellMember(ctx, companyName, { email: target.email }, { kind: "role_changed", role: newRole });
  return reply({ member: memberDto({ ...target, role: newRole }, ctx.userId) });
}

async function transferOwnership(ctx: EmployerContext, companyName: string, targetId: string, reply: Reply): Promise<Response> {
  if (ctx.role !== "owner") return reply({ error: "Only the owner can transfer ownership." }, 403);
  if (!targetId || targetId === ctx.userId) return reply({ error: "Choose another team member." }, 400);
  const roster = await loadRoster(ctx.employerId);
  const target = roster.find((m) => m.user_id === targetId);
  if (!target) return reply({ error: "That person isn't on your team." }, 404);

  const patch = (uid: string, role: EmployerRole) =>
    fetch(`${SUPABASE_URL}/rest/v1/employer_members?employer_id=eq.${encodeURIComponent(ctx.employerId)}&user_id=eq.${encodeURIComponent(uid)}`, {
      method: "PATCH", headers: { ...jsonHeaders(), Prefer: "return=minimal" }, body: JSON.stringify({ role }),
    });
  // Promote first: if the demotion then fails there are two owners, never none.
  const up = await patch(targetId, "owner");
  if (!up.ok) throw new Error(`ownership promote failed: ${up.status}`);
  const down = await patch(ctx.userId, "admin");
  if (!down.ok) throw new Error(`ownership demote failed: ${down.status}`);
  await audit(ctx, "member.role_changed", targetId, { email: target.email, from: target.role, to: "owner", transfer: true });
  await tellMember(ctx, companyName, { email: target.email }, { kind: "ownership_received" });
  return reply({ ok: true });
}
