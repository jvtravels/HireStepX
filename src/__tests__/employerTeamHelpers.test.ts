import { describe, it, expect, vi } from "vitest";
import {
  can, canManageMember, assignableRoles, checkMemberChange, checkInviteAcceptable, inviteState,
  generateInviteToken, hashInviteToken, normalizeEmail, isValidEmail, resolveEmployerContext,
  requireEmployerPermission, writeAuditLog, isAuditAction, planAccountExit, resolveConversationSide, type InviteRow, type RosterEntry,
} from "../../server-handlers/_employer-team-helpers";

const FUTURE = new Date(Date.now() + 86_400_000).toISOString();
const PAST = new Date(Date.now() - 86_400_000).toISOString();
const invite = (over: Partial<InviteRow> = {}): InviteRow => ({
  id: "i1", employer_id: "co", email: "dev@acme.com", role: "member", expires_at: FUTURE, accepted_at: null, revoked_at: null, ...over,
});
const roster: RosterEntry[] = [
  { userId: "owner", role: "owner" },
  { userId: "admin", role: "admin" },
  { userId: "admin2", role: "admin" },
  { userId: "member", role: "member" },
  { userId: "viewer", role: "viewer" },
];

describe("permissions", () => {
  it("viewers read only; members work candidates; admins manage the team", () => {
    expect(can("viewer", "jobs.read")).toBe(true);
    expect(can("viewer", "candidates.unlock")).toBe(false);
    expect(can("member", "candidates.unlock")).toBe(true);
    expect(can("member", "team.invite")).toBe(false);
    expect(can("admin", "team.manage")).toBe(true);
    expect(can("admin", "audit.read")).toBe(true);
    expect(can(null, "jobs.read")).toBe(false);
  });

  it("admins can manage members and viewers, never admins or owners", () => {
    expect(canManageMember("admin", "member")).toBe(true);
    expect(canManageMember("admin", "admin")).toBe(false);
    expect(canManageMember("admin", "owner")).toBe(false);
    expect(canManageMember("member", "viewer")).toBe(false);
    expect(canManageMember("owner", "admin")).toBe(true);
    expect(assignableRoles("admin")).toEqual(["member", "viewer"]);
    expect(assignableRoles("member")).toEqual([]);
  });
});

describe("checkMemberChange", () => {
  const run = (actorId: string, targetId: string, newRole: Parameters<typeof checkMemberChange>[0]["newRole"], r = roster) =>
    checkMemberChange({ actorId, actorRole: r.find((m) => m.userId === actorId)!.role, targetId, newRole, roster: r });

  it("lets an owner change any other member's role", () => {
    expect(run("owner", "admin", "viewer")).toBeNull();
  });
  it("blocks an admin from touching another admin or granting admin", () => {
    expect(run("admin", "admin2", "member")).toBe("forbidden");
    expect(run("admin", "member", "admin")).toBe("cannot_assign_role");
    expect(run("admin", "member", "viewer")).toBeNull();
  });
  it("blocks members and viewers from managing anyone", () => {
    expect(run("member", "viewer", "member")).toBe("forbidden");
    expect(run("viewer", "member", null)).toBe("forbidden");
  });
  it("never assigns ownership through a role change", () => {
    expect(run("owner", "admin", "owner")).toBe("owner_role_via_transfer");
  });
  it("blocks changing your own role", () => {
    expect(run("admin", "admin", "member")).toBe("self_demote");
  });
  it("lets non-owners leave, but not the last owner", () => {
    expect(run("viewer", "viewer", null)).toBeNull();
    expect(run("owner", "owner", null)).toBe("last_owner");
    const twoOwners: RosterEntry[] = [...roster, { userId: "owner2", role: "owner" }];
    expect(run("owner", "owner", null, twoOwners)).toBeNull();
  });
  it("blocks removing the sole owner, even by another owner-level path", () => {
    expect(run("owner", "ghost", null)).toBe("forbidden");
  });
});

describe("invites", () => {
  it("reports state from timestamps", () => {
    expect(inviteState(invite())).toBe("pending");
    expect(inviteState(invite({ expires_at: PAST }))).toBe("expired");
    expect(inviteState(invite({ revoked_at: PAST }))).toBe("revoked");
    expect(inviteState(invite({ accepted_at: PAST }))).toBe("accepted");
  });

  it("accepts only a pending invite for the matching confirmed email", () => {
    const ok = { email: "Dev@Acme.com", emailConfirmed: true };
    expect(checkInviteAcceptable(invite(), ok)).toBeNull();
    expect(checkInviteAcceptable(null, ok)).toBe("invalid");
    expect(checkInviteAcceptable(invite({ expires_at: PAST }), ok)).toBe("expired");
    expect(checkInviteAcceptable(invite({ revoked_at: PAST }), ok)).toBe("revoked");
    expect(checkInviteAcceptable(invite({ accepted_at: PAST }), ok)).toBe("used");
    expect(checkInviteAcceptable(invite(), { email: "other@acme.com", emailConfirmed: true })).toBe("email_mismatch");
    expect(checkInviteAcceptable(invite(), { email: "dev@acme.com", emailConfirmed: false })).toBe("email_mismatch");
  });

  it("generates unguessable URL-safe tokens and hashes them deterministically", async () => {
    const a = generateInviteToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateInviteToken()).not.toBe(a);
    const h = await hashInviteToken(a);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashInviteToken(a)).toBe(h);
    expect(h).not.toContain(a);
  });

  it("normalizes and validates emails", () => {
    expect(normalizeEmail("  Dev@ACME.com ")).toBe("dev@acme.com");
    expect(normalizeEmail(42)).toBe("");
    expect(isValidEmail("dev@acme.com")).toBe(true);
    expect(isValidEmail("dev@acme")).toBe(false);
    expect(isValidEmail("a b@acme.com")).toBe(false);
  });
});

describe("resolveEmployerContext", () => {
  const json = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

  it("returns the member's company and role", async () => {
    const f = vi.fn().mockResolvedValue(json([{ employer_id: "co", user_id: "u1", role: "member", email: "a@b.co", name: "A", last_active_at: new Date().toISOString() }]));
    const ctx = await resolveEmployerContext("https://x", {}, "u1", f as unknown as typeof fetch);
    expect(ctx).toMatchObject({ employerId: "co", userId: "u1", role: "member" });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("touches last_active_at when stale", async () => {
    const f = vi.fn().mockResolvedValue(json([{ employer_id: "co", user_id: "u1", role: "admin", email: "", name: null, last_active_at: null }]));
    await resolveEmployerContext("https://x", {}, "u1", f as unknown as typeof fetch);
    expect(f.mock.calls[1][1]).toMatchObject({ method: "PATCH" });
  });

  it("falls back to legacy owner-by-user-id when there is no member row", async () => {
    const f = vi.fn().mockResolvedValueOnce(json([])).mockResolvedValueOnce(json([{ id: "u1" }]));
    expect(await resolveEmployerContext("https://x", {}, "u1", f as unknown as typeof fetch)).toMatchObject({ employerId: "u1", role: "owner" });
  });

  it("falls back the same way when the members table is not deployed yet", async () => {
    const f = vi.fn().mockResolvedValueOnce(json({}, false)).mockResolvedValueOnce(json([{ id: "u1" }]));
    expect((await resolveEmployerContext("https://x", {}, "u1", f as unknown as typeof fetch))?.role).toBe("owner");
  });

  it("returns null for an account with no company", async () => {
    const f = vi.fn().mockResolvedValueOnce(json([])).mockResolvedValueOnce(json([]));
    expect(await resolveEmployerContext("https://x", {}, "u1", f as unknown as typeof fetch)).toBeNull();
  });

  it("requireEmployerPermission 403s a role without the permission", async () => {
    const f = vi.fn().mockResolvedValue(json([{ employer_id: "co", user_id: "u1", role: "viewer", email: "", name: null, last_active_at: new Date().toISOString() }]));
    const gate = await requireEmployerPermission("https://x", {}, "u1", "jobs.write", f as unknown as typeof fetch);
    expect(gate).toMatchObject({ ok: false, status: 403 });
  });
});

describe("audit log", () => {
  it("writes the entry and never throws", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true });
    expect(await writeAuditLog("https://x", {}, { employerId: "co", actorUserId: "u1", action: "job.created", meta: { title: "SDE" } }, f as unknown as typeof fetch)).toBe(true);
    expect(JSON.parse(f.mock.calls[0][1].body)).toMatchObject({ employer_id: "co", actor_user_id: "u1", action: "job.created" });
    const boom = vi.fn().mockRejectedValue(new Error("down"));
    expect(await writeAuditLog("https://x", {}, { employerId: "co", actorUserId: null, action: "job.created" }, boom as unknown as typeof fetch)).toBe(false);
  });
  it("recognises known actions only", () => {
    expect(isAuditAction("candidate.unlocked")).toBe(true);
    expect(isAuditAction("drop.table")).toBe(false);
  });
});

describe("planAccountExit", () => {
  const json = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body }) as Response;
  const run = (f: ReturnType<typeof vi.fn>) => planAccountExit("https://x", {}, "u1", f as unknown as typeof fetch);

  it("is none when there is no member row or the table is missing", async () => {
    expect(await run(vi.fn().mockResolvedValue(json([])))).toEqual({ kind: "none" });
    expect(await run(vi.fn().mockResolvedValue(json({}, false, 404)))).toEqual({ kind: "none" });
  });
  it("is last when the user is the only member", async () => {
    const f = vi.fn().mockResolvedValueOnce(json([{ employer_id: "co", role: "owner" }])).mockResolvedValueOnce(json([{ user_id: "u1", role: "owner" }]));
    expect(await run(f)).toEqual({ kind: "last", employerId: "co" });
  });
  it("blocks a sole owner while others remain", async () => {
    const f = vi.fn().mockResolvedValueOnce(json([{ employer_id: "co", role: "owner" }]))
      .mockResolvedValueOnce(json([{ user_id: "u1", role: "owner" }, { user_id: "u2", role: "admin" }]));
    expect(await run(f)).toEqual({ kind: "blocked", employerId: "co" });
  });
  it("lets an owner leave when another owner exists, and any non-owner leave", async () => {
    const two = vi.fn().mockResolvedValueOnce(json([{ employer_id: "co", role: "owner" }]))
      .mockResolvedValueOnce(json([{ user_id: "u1", role: "owner" }, { user_id: "u2", role: "owner" }]));
    expect(await run(two)).toEqual({ kind: "left", employerId: "co" });
    const member = vi.fn().mockResolvedValueOnce(json([{ employer_id: "co", role: "member" }]))
      .mockResolvedValueOnce(json([{ user_id: "u1", role: "member" }, { user_id: "u2", role: "owner" }]));
    expect(await run(member)).toEqual({ kind: "left", employerId: "co" });
  });
  it("throws on an unexpected read failure so deletion never proceeds blind", async () => {
    await expect(run(vi.fn().mockResolvedValue(json({}, false, 500)))).rejects.toThrow();
  });
});

describe("resolveConversationSide", () => {
  const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;
  const conv = { employerId: "co", candidateUserId: "cand" };
  const memberRow = (role: string) => json([{ employer_id: "co", user_id: "u1", role, email: "", name: null, last_active_at: new Date().toISOString() }]);
  const run = (userId: string, f: ReturnType<typeof vi.fn>) =>
    resolveConversationSide("https://x", {}, userId, conv, "messages.send", f as unknown as typeof fetch);

  it("treats the candidate as candidate without any lookup", async () => {
    const f = vi.fn();
    expect(await run("cand", f)).toEqual({ side: "candidate", denied: false });
    expect(f).not.toHaveBeenCalled();
  });
  it("lets a member of the conversation's company act as employer", async () => {
    expect(await run("u1", vi.fn().mockResolvedValue(memberRow("member")))).toEqual({ side: "employer", denied: false });
  });
  it("denies a viewer of the same company", async () => {
    expect(await run("u1", vi.fn().mockResolvedValue(memberRow("viewer")))).toEqual({ side: null, denied: true });
  });
  it("gives no side to an outsider", async () => {
    const f = vi.fn().mockResolvedValueOnce(json([])).mockResolvedValueOnce(json([]));
    expect(await run("stranger", f)).toEqual({ side: null, denied: false });
  });
});
