/* Employer team model: roles, permissions, invites, and the single resolver
 * that turns "who is calling" into "which company, in what role".
 *
 * A company is an `employers` row; employers.id is also its original owner's
 * auth user id, which is why every existing employer_id foreign key keeps
 * working. Every employer handler calls resolveEmployerContext() instead of
 * assuming auth.userId == employer_id, then gates the action on can(role, perm)
 * (never on a role name), so adding a role later is a one-line change here.
 *
 * Everything in this file is pure or takes an injectable fetch so it is
 * unit-testable (see src/__tests__/employerTeamHelpers.test.ts).
 */

import type { EraseDeps } from "./_erase-user";

export const EMPLOYER_ROLES = ["owner", "admin", "member", "viewer"] as const;
export type EmployerRole = (typeof EMPLOYER_ROLES)[number];

/** Roles an invite may grant. Ownership moves only via transfer, never by invite. */
export const INVITABLE_ROLES = ["admin", "member", "viewer"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export function isEmployerRole(v: unknown): v is EmployerRole {
  return typeof v === "string" && (EMPLOYER_ROLES as readonly string[]).includes(v);
}
export function isInvitableRole(v: unknown): v is InvitableRole {
  return typeof v === "string" && (INVITABLE_ROLES as readonly string[]).includes(v);
}

export type Permission =
  | "jobs.read"
  | "jobs.write"
  | "candidates.read"
  | "candidates.manage"
  | "candidates.unlock"
  | "messages.send"
  | "company.edit"
  | "team.read"
  | "team.invite"
  | "team.manage"
  | "audit.read";

const VIEWER: Permission[] = ["jobs.read", "candidates.read", "team.read"];
const MEMBER: Permission[] = [...VIEWER, "jobs.write", "candidates.manage", "candidates.unlock", "messages.send"];
const ADMIN: Permission[] = [...MEMBER, "company.edit", "team.invite", "team.manage", "audit.read"];

export const ROLE_PERMISSIONS: Record<EmployerRole, ReadonlySet<Permission>> = {
  viewer: new Set(VIEWER),
  member: new Set(MEMBER),
  admin: new Set(ADMIN),
  owner: new Set(ADMIN),
};

export function can(role: EmployerRole | null | undefined, permission: Permission): boolean {
  return !!role && ROLE_PERMISSIONS[role].has(permission);
}

export const ROLE_LABEL: Record<EmployerRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

export const ROLE_BLURB: Record<EmployerRole, string> = {
  owner: "Full control, including ownership and deleting the company.",
  admin: "Manages the team, company profile and everything members can do.",
  member: "Posts jobs, unlocks candidates and messages them.",
  viewer: "Read-only access to jobs and candidates.",
};

const RANK: Record<EmployerRole, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };

/** Who may change or remove whom. Owners manage everyone but themselves;
 *  admins manage only members and viewers; nobody else manages anyone. */
export function canManageMember(actor: EmployerRole, target: EmployerRole): boolean {
  if (actor === "owner") return true;
  if (actor === "admin") return RANK[target] < RANK.admin;
  return false;
}

/** Which roles `actor` may hand out (invite, or set on an existing member). */
export function assignableRoles(actor: EmployerRole): InvitableRole[] {
  if (actor === "owner") return ["admin", "member", "viewer"];
  if (actor === "admin") return ["member", "viewer"];
  return [];
}

export type TeamRuleViolation =
  | "forbidden"
  | "cannot_assign_role"
  | "last_owner"
  | "owner_role_via_transfer"
  | "self_demote";

export const VIOLATION_MESSAGE: Record<TeamRuleViolation, string> = {
  forbidden: "You don't have permission to manage this member.",
  cannot_assign_role: "You can't assign that role.",
  last_owner: "A company needs at least one owner. Transfer ownership first.",
  owner_role_via_transfer: "Ownership is moved with Transfer ownership, not a role change.",
  self_demote: "You can't change your own role.",
};

export interface RosterEntry {
  userId: string;
  role: EmployerRole;
}

/** Validates a role change or removal (newRole === null) against the roster.
 *  Pure so every rule is covered by a unit test. Returns null when allowed. */
export function checkMemberChange(params: {
  actorId: string;
  actorRole: EmployerRole;
  targetId: string;
  newRole: EmployerRole | null;
  roster: RosterEntry[];
}): TeamRuleViolation | null {
  const { actorId, actorRole, targetId, newRole, roster } = params;
  const target = roster.find((m) => m.userId === targetId);
  if (!target) return "forbidden";
  if (newRole === "owner") return "owner_role_via_transfer";
  const owners = roster.filter((m) => m.role === "owner").length;
  if (actorId === targetId) {
    // Anyone may leave (unless sole owner); nobody may change their own role.
    if (newRole !== null) return "self_demote";
    return target.role === "owner" && owners <= 1 ? "last_owner" : null;
  }
  if (!can(actorRole, "team.manage") || !canManageMember(actorRole, target.role)) return "forbidden";
  if (newRole !== null && !assignableRoles(actorRole).includes(newRole as InvitableRole)) return "cannot_assign_role";
  if (target.role === "owner" && owners <= 1) return "last_owner";
  return null;
}

/* ── Invites ─────────────────────────────────────────────────────────── */

export const INVITE_TTL_DAYS = 7;
export const MAX_TEAM_SIZE = 5;

export function normalizeEmail(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase().slice(0, 254) : "";
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export const INVITES_PER_DAY = 20;
export const RESENDS_PER_DAY = 30;

/* Counts invites created inside the window whatever their state, so revoking
   or replacing an invite can't be used to dodge the daily cap. */
export function invitesRemainingToday(createdAts: string[], now = Date.now(), cap = INVITES_PER_DAY): number {
  const dayAgo = now - 86_400_000;
  return Math.max(0, cap - createdAts.filter((c) => Date.parse(c) > dayAgo).length);
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 256 bits of randomness, URL-safe. Only its sha-256 is ever stored. */
export function generateInviteToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashInviteToken(token: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
}

export interface InviteRow {
  id: string;
  employer_id: string;
  email: string;
  role: InvitableRole;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

export type InviteState = "pending" | "accepted" | "revoked" | "expired";

export function inviteState(inv: Pick<InviteRow, "expires_at" | "accepted_at" | "revoked_at">, now = Date.now()): InviteState {
  if (inv.accepted_at) return "accepted";
  if (inv.revoked_at) return "revoked";
  if (Date.parse(inv.expires_at) <= now) return "expired";
  return "pending";
}

export type InviteAcceptError = "invalid" | "expired" | "revoked" | "used" | "email_mismatch" | "already_member";

export const INVITE_ACCEPT_MESSAGE: Record<InviteAcceptError, string> = {
  invalid: "This invite link isn't valid.",
  expired: "This invite has expired. Ask your admin to send a new one.",
  revoked: "This invite was cancelled. Ask your admin to send a new one.",
  used: "This invite has already been used.",
  email_mismatch: "This invite was sent to a different email address. Sign in with the invited email to join.",
  already_member: "Your account already belongs to a company. Leave it before joining another.",
};

/** The one place an invite is judged acceptable. Email match is mandatory:
 *  a leaked link must be useless to anyone but the invited address. */
export function checkInviteAcceptable(
  inv: InviteRow | null,
  accepting: { email: string | null; emailConfirmed: boolean },
  now = Date.now(),
): InviteAcceptError | null {
  if (!inv) return "invalid";
  const state = inviteState(inv, now);
  if (state === "accepted") return "used";
  if (state === "revoked") return "revoked";
  if (state === "expired") return "expired";
  if (!accepting.emailConfirmed || normalizeEmail(accepting.email) !== inv.email) return "email_mismatch";
  return null;
}

/* ── Audit trail ─────────────────────────────────────────────────────── */

export type AuditAction =
  | "member.invited"
  | "member.invite_resent"
  | "member.invite_revoked"
  | "member.joined"
  | "member.role_changed"
  | "member.removed"
  | "member.left"
  | "job.created"
  | "job.updated"
  | "job.archived"
  | "job.reopened"
  | "job.stage_changed"
  | "candidate.unlocked"
  | "candidate.status_changed"
  | "candidate.note_updated"
  | "candidate.reviewed"
  | "candidate.messaged"
  | "company.profile_updated";

export const AUDIT_ACTIONS: readonly AuditAction[] = [
  "member.invited", "member.invite_resent", "member.invite_revoked", "member.joined", "member.role_changed",
  "member.removed", "member.left", "job.created", "job.updated", "job.archived", "job.reopened",
  "job.stage_changed", "candidate.unlocked", "candidate.status_changed", "candidate.note_updated", "candidate.reviewed", "candidate.messaged", "company.profile_updated",
];

export function isAuditAction(v: unknown): v is AuditAction {
  return typeof v === "string" && (AUDIT_ACTIONS as readonly string[]).includes(v);
}

export interface AuditEntry {
  employerId: string;
  actorUserId: string | null;
  actorEmail?: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}

/* Local on purpose: this module is also imported by client code, and _shared.ts pulls in server-only next/server. */
function warnAudit(msg: string, fields: Record<string, unknown>): void {
  console.warn(JSON.stringify({ ts: new Date().toISOString(), level: "warn", msg, ...fields }));
}

/** Best-effort: the trail must never fail the mutation it describes. */
export async function writeAuditLog(
  supabaseUrl: string,
  headers: Record<string, string>,
  entry: AuditEntry,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const res = await fetchImpl(`${supabaseUrl}/rest/v1/employer_audit_log`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        employer_id: entry.employerId,
        actor_user_id: entry.actorUserId,
        actor_email: entry.actorEmail ?? null,
        action: entry.action,
        entity_type: entry.entityType ?? null,
        entity_id: entry.entityId ?? null,
        meta: entry.meta ?? {},
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) warnAudit("[team-audit] write rejected", { action: entry.action, status: res.status });
    return res.ok;
  } catch (err) {
    warnAudit("[team-audit] write failed", { action: entry.action, err: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

/* ── Resolver ────────────────────────────────────────────────────────── */

export interface EmployerContext {
  /** The company. Use this wherever a handler used to use the user's own id. */
  employerId: string;
  /** The person acting. Record this as the actor on writes. */
  userId: string;
  role: EmployerRole;
  email: string;
  name: string | null;
}

interface MemberRow {
  employer_id: string;
  user_id: string;
  role: string;
  email: string;
  name: string | null;
  last_active_at: string | null;
}

const ACTIVE_TOUCH_MS = 5 * 60_000;

/** Maps an authenticated user to their company and role.
 *
 *  Falls back to the legacy "a company is its owner's own user id" rule when
 *  there is no member row (migration not yet applied, or a company created
 *  moments ago), so deploying the code before the data can never lock an
 *  existing employer out. Returns null for a user with no company at all. */
export async function resolveEmployerContext(
  supabaseUrl: string,
  headers: Record<string, string>,
  userId: string,
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<EmployerContext | null> {
  const memberRes = await fetchImpl(
    `${supabaseUrl}/rest/v1/employer_members?user_id=eq.${encodeURIComponent(userId)}&select=employer_id,user_id,role,email,name,last_active_at&limit=1`,
    { headers },
  ).catch(() => null);

  if (memberRes?.ok) {
    const rows = (await memberRes.json().catch(() => [])) as MemberRow[];
    const m = rows[0];
    if (m && isEmployerRole(m.role)) {
      const last = m.last_active_at ? Date.parse(m.last_active_at) : 0;
      if (now - last > ACTIVE_TOUCH_MS) {
        await fetchImpl(
          `${supabaseUrl}/rest/v1/employer_members?employer_id=eq.${encodeURIComponent(m.employer_id)}&user_id=eq.${encodeURIComponent(userId)}`,
          {
            method: "PATCH",
            headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({ last_active_at: new Date(now).toISOString() }),
            signal: AbortSignal.timeout(3000),
          },
        ).catch(() => {});
      }
      return { employerId: m.employer_id, userId, role: m.role, email: m.email, name: m.name };
    }
  }

  const ownRes = await fetchImpl(
    `${supabaseUrl}/rest/v1/employers?id=eq.${encodeURIComponent(userId)}&select=id&limit=1`,
    { headers },
  ).catch(() => null);
  if (!ownRes?.ok) return null;
  const own = (await ownRes.json().catch(() => [])) as Array<{ id: string }>;
  return own[0] ? { employerId: own[0].id, userId, role: "owner", email: "", name: null } : null;
}

export type GateResult =
  | { ok: true; ctx: EmployerContext }
  | { ok: false; status: 403 | 404; error: string };

/** Resolve + authorize in one call. A user with no company gets 404 (nothing
 *  to act on); a member lacking the permission gets 403. */
export async function requireEmployerPermission(
  supabaseUrl: string,
  headers: Record<string, string>,
  userId: string,
  permission: Permission,
  fetchImpl: typeof fetch = fetch,
): Promise<GateResult> {
  const ctx = await resolveEmployerContext(supabaseUrl, headers, userId, fetchImpl);
  if (!ctx) return { ok: false, status: 404, error: "No company found for this account" };
  if (!can(ctx.role, permission)) {
    return { ok: false, status: 403, error: "Your role doesn't allow this. Ask a company admin." };
  }
  return { ok: true, ctx };
}

/* ── Account deletion ────────────────────────────────────────────────── */

export type AccountExit =
  | { kind: "none" }
  | { kind: "left"; employerId: string }
  | { kind: "blocked"; employerId: string }
  | { kind: "last"; employerId: string };

/** What deleting this user's account means for their company. Read-only.
 *  - none:    not in a company (or the members table isn't deployed yet)
 *  - left:    others remain; only their membership goes, the company continues
 *  - blocked: sole owner of a company that still has other members; ownership
 *             must be transferred first so the team isn't orphaned
 *  - last:    the only member; the company's own data goes with them
 *  Throws on an unexpected read failure so a deletion never proceeds blind. */
export async function planAccountExit(
  supabaseUrl: string,
  headers: Record<string, string>,
  userId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AccountExit> {
  const mineRes = await fetchImpl(
    `${supabaseUrl}/rest/v1/employer_members?user_id=eq.${encodeURIComponent(userId)}&select=employer_id,role&limit=1`,
    { headers },
  );
  if (mineRes.status === 404) return { kind: "none" };
  if (!mineRes.ok) throw new Error(`member lookup HTTP ${mineRes.status}`);
  const mine = ((await mineRes.json().catch(() => [])) as Array<{ employer_id: string; role: string }>)[0];
  if (!mine) return { kind: "none" };

  const rosterRes = await fetchImpl(
    `${supabaseUrl}/rest/v1/employer_members?employer_id=eq.${encodeURIComponent(mine.employer_id)}&select=user_id,role`,
    { headers },
  );
  if (!rosterRes.ok) throw new Error(`roster lookup HTTP ${rosterRes.status}`);
  const roster = (await rosterRes.json().catch(() => [])) as Array<{ user_id: string; role: string }>;
  const others = roster.filter((m) => m.user_id !== userId);
  if (others.length === 0) return { kind: "last", employerId: mine.employer_id };
  const otherOwners = others.some((m) => m.role === "owner");
  if (mine.role === "owner" && !otherOwners) return { kind: "blocked", employerId: mine.employer_id };
  return { kind: "left", employerId: mine.employer_id };
}

export const ACCOUNT_EXIT_BLOCKED_MESSAGE =
  "You're the only owner of a company that still has team members. Transfer ownership to someone else (Team page) before deleting your account.";

export async function removeMemberRow(
  supabaseUrl: string,
  headers: Record<string, string>,
  employerId: string,
  userId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const res = await fetchImpl(
    `${supabaseUrl}/rest/v1/employer_members?employer_id=eq.${encodeURIComponent(employerId)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: "DELETE", headers },
  ).catch(() => null);
  return !!res?.ok;
}

/** planAccountExit for an erasure that can be retried. Once a leaving owner's membership row
 *  is gone a retry would read "none" and mistake the surviving company for their own, so a
 *  "none" whose company-by-user-id still has members is treated as "left". */
export async function planErasureExit(
  supabaseUrl: string,
  headers: Record<string, string>,
  userId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AccountExit> {
  const exit = await planAccountExit(supabaseUrl, headers, userId, fetchImpl);
  if (exit.kind !== "none") return exit;
  const res = await fetchImpl(
    `${supabaseUrl}/rest/v1/employer_members?employer_id=eq.${encodeURIComponent(userId)}&select=user_id&limit=1`,
    { headers },
  );
  if (res.status === 404) return exit;
  if (!res.ok) throw new Error(`company roster lookup HTTP ${res.status}`);
  let rows: unknown[] = [];
  try {
    const parsed: unknown = await res.json();
    if (Array.isArray(parsed)) rows = parsed;
  } catch { /* an empty body means no members */ }
  return rows.length > 0 ? { kind: "left", employerId: userId } : exit;
}

/** The company that dies with this account, or null when it continues without them. */
export function companyDyingWith(exit: AccountExit, userId: string): string | null {
  if (exit.kind === "last") return exit.employerId;
  return exit.kind === "none" ? userId : null;
}

/** Wires an account exit into eraseUserData. The company is removed (or, when its
 *  unlock payments must be kept, only the member row) after every row delete and before
 *  the login goes, so a failure leaves the account soft-deleted and retryable. */
export function employerErasureOptions(
  supabaseUrl: string,
  headers: Record<string, string>,
  userId: string,
  exit: AccountExit,
  fetchImpl: typeof fetch = fetch,
): Pick<EraseDeps, "employerId" | "beforeAuth"> {
  if (exit.kind === "left") {
    return {
      employerId: null,
      beforeAuth: async () => {
        if (!(await removeMemberRow(supabaseUrl, headers, exit.employerId, userId, fetchImpl))) throw new Error("membership removal failed");
        await writeAuditLog(supabaseUrl, headers, {
          employerId: exit.employerId, actorUserId: null, action: "member.left",
          entityType: "member", entityId: userId, meta: { accountDeleted: true },
        }, fetchImpl);
      },
    };
  }
  const companyId = companyDyingWith(exit, userId);
  return {
    employerId: companyId,
    beforeAuth: async ({ isEmployer, retainEmployer }) => {
      if (!isEmployer || !companyId) return;
      if (retainEmployer) {
        if (!(await removeMemberRow(supabaseUrl, headers, companyId, userId, fetchImpl))) throw new Error("membership removal failed");
        return;
      }
      const res = await fetchImpl(`${supabaseUrl}/rest/v1/employers?id=eq.${encodeURIComponent(companyId)}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error(`company delete HTTP ${res.status}`);
    },
  };
}

/* ── Conversation access ─────────────────────────────────────────────── */

export type ConversationSide = "employer" | "candidate";

/** Which side of a conversation this user is on, now that the employer side is a
 *  company rather than one login. `denied` means they belong to the employer
 *  company but their role lacks `permission`. */
export async function resolveConversationSide(
  supabaseUrl: string,
  headers: Record<string, string>,
  userId: string,
  conversation: { employerId: string; candidateUserId: string },
  permission: Permission,
  fetchImpl: typeof fetch = fetch,
): Promise<{ side: ConversationSide | null; denied: boolean }> {
  if (userId === conversation.candidateUserId) return { side: "candidate", denied: false };
  const ctx = await resolveEmployerContext(supabaseUrl, headers, userId, fetchImpl);
  if (!ctx || ctx.employerId !== conversation.employerId) return { side: null, denied: false };
  return can(ctx.role, permission) ? { side: "employer", denied: false } : { side: null, denied: true };
}
