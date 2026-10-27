import { describe, it, expect, beforeAll, afterAll } from "vitest";

/**
 * RLS integration tests for employer team tables (supabase-migrations/0061).
 *
 * Opt-in, same switch as rls.integration.test.ts: set TEST_SUPABASE_URL,
 * TEST_SUPABASE_ANON_KEY and TEST_SUPABASE_SERVICE_ROLE_KEY for a dedicated
 * TEST project that already has 0061 applied. Never point this at production.
 *
 * What it proves: a client JWT (what a browser holds) can only read its own
 * company's roster, only owners/admins can read the audit trail, nobody can
 * read invite tokens, and nobody can write any of these tables directly.
 */

const SUPABASE_URL = process.env.TEST_SUPABASE_URL || "";
const ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY || "";
const SERVICE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || "";
const RLS_ENABLED = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);

interface TestUser { userId: string; token: string }

async function signUp(email: string): Promise<TestUser> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ email, password: "TestPass123!", data: { custom_email_verified: true } }),
  });
  if (!res.ok) throw new Error(`signUp failed: ${res.status} ${await res.text()}`);
  const { user, session } = await res.json();
  if (!user?.id || !session?.access_token) throw new Error("signUp returned incomplete payload");
  return { userId: user.id, token: session.access_token };
}

const service = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers ?? {}) },
  });

const asUser = (token: string, path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers ?? {}) },
  });

async function rows<T = Record<string, unknown>>(res: Response): Promise<T[]> {
  expect(res.ok).toBe(true);
  return (await res.json()) as T[];
}

describe.skipIf(!RLS_ENABLED)("RLS: employer teams (integration)", () => {
  const uniq = Date.now();
  let ownerA: TestUser; let adminA: TestUser; let viewerA: TestUser; let ownerB: TestUser;
  const createdUsers: string[] = [];

  beforeAll(async () => {
    [ownerA, adminA, viewerA, ownerB] = await Promise.all(
      ["owner-a", "admin-a", "viewer-a", "owner-b"].map((n) => signUp(`rls-team-${n}-${uniq}@test.hirestepx.com`)),
    );
    createdUsers.push(ownerA.userId, adminA.userId, viewerA.userId, ownerB.userId);

    const must = async (p: Promise<Response>, what: string) => { const r = await p; if (!r.ok) throw new Error(`${what}: ${r.status} ${await r.text()}`); };
    await must(service("employers", { method: "POST", body: JSON.stringify([
      { id: ownerA.userId, company_name: "RLS Co A" }, { id: ownerB.userId, company_name: "RLS Co B" },
    ]) }), "employers");
    await must(service("employer_members?on_conflict=user_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify([
      { employer_id: ownerA.userId, user_id: ownerA.userId, role: "owner", email: "owner-a@x.test" },
      { employer_id: ownerA.userId, user_id: adminA.userId, role: "admin", email: "admin-a@x.test" },
      { employer_id: ownerA.userId, user_id: viewerA.userId, role: "viewer", email: "viewer-a@x.test" },
      { employer_id: ownerB.userId, user_id: ownerB.userId, role: "owner", email: "owner-b@x.test" },
    ]) }), "members");
    await must(service("employer_audit_log", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify([
      { employer_id: ownerA.userId, actor_user_id: ownerA.userId, action: "job.created" },
      { employer_id: ownerB.userId, actor_user_id: ownerB.userId, action: "job.created" },
    ]) }), "audit");
    await must(service("employer_invites", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify([
      { employer_id: ownerA.userId, email: "pending@x.test", role: "member", token_hash: `rls-${uniq}`, expires_at: new Date(Date.now() + 86_400_000).toISOString() },
    ]) }), "invite");
  }, 60_000);

  afterAll(async () => {
    // Deleting the companies cascades members, invites and audit rows.
    await Promise.all([ownerA, ownerB].filter(Boolean).map((u) => service(`employers?id=eq.${u.userId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => {})));
    await Promise.all(createdUsers.map((id) => fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
      method: "DELETE", headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    }).catch(() => {})));
  });

  describe("roster (employer_members)", () => {
    it.each([["owner", () => ownerA], ["admin", () => adminA], ["viewer", () => viewerA]] as const)(
      "a %s sees their whole company roster and nobody else's",
      async (_name, who) => {
        const r = await rows<{ employer_id: string; user_id: string }>(await asUser(who().token, "employer_members?select=employer_id,user_id"));
        expect(r).toHaveLength(3);
        expect(r.every((m) => m.employer_id === ownerA.userId)).toBe(true);
      },
    );

    it("another company's owner never sees company A's members", async () => {
      const r = await rows<{ employer_id: string }>(await asUser(ownerB.token, "employer_members?select=employer_id"));
      expect(r).toHaveLength(1);
      expect(r[0].employer_id).toBe(ownerB.userId);
    });
  });

  describe("audit trail (employer_audit_log)", () => {
    it("owners and admins read their own company's trail only", async () => {
      for (const who of [ownerA, adminA]) {
        const r = await rows<{ employer_id: string }>(await asUser(who.token, "employer_audit_log?select=employer_id"));
        expect(r.length).toBeGreaterThan(0);
        expect(r.every((e) => e.employer_id === ownerA.userId)).toBe(true);
      }
    });

    it("a viewer sees nothing", async () => {
      expect(await rows(await asUser(viewerA.token, "employer_audit_log?select=id"))).toEqual([]);
    });

    it("an outsider cannot read company A's trail", async () => {
      const r = await rows<{ employer_id: string }>(await asUser(ownerB.token, `employer_audit_log?employer_id=eq.${ownerA.userId}&select=id`));
      expect(r).toEqual([]);
    });

    it("nobody can write to it, so the trail cannot be forged or erased", async () => {
      const ins = await asUser(ownerA.token, "employer_audit_log", { method: "POST", body: JSON.stringify({ employer_id: ownerA.userId, action: "forged" }) });
      expect(ins.ok).toBe(false);
      await asUser(ownerA.token, `employer_audit_log?employer_id=eq.${ownerA.userId}`, { method: "DELETE" });
      const left = await rows(await service(`employer_audit_log?employer_id=eq.${ownerA.userId}&select=id`));
      expect(left.length).toBeGreaterThan(0);
    });
  });

  describe("invites (employer_invites)", () => {
    it("no client JWT can read invites, even the company owner (tokens are service-role only)", async () => {
      expect(await rows(await asUser(ownerA.token, "employer_invites?select=id"))).toEqual([]);
      expect(await rows(await asUser(adminA.token, "employer_invites?select=id"))).toEqual([]);
    });

    it("no client JWT can create one", async () => {
      const r = await asUser(ownerA.token, "employer_invites", {
        method: "POST",
        body: JSON.stringify({ employer_id: ownerA.userId, email: "x@x.test", role: "admin", token_hash: `rls-forge-${uniq}`, expires_at: new Date(Date.now() + 1000).toISOString() }),
      });
      expect(r.ok).toBe(false);
    });
  });

  describe("role escalation and membership tampering", () => {
    it("a viewer cannot promote themselves", async () => {
      await asUser(viewerA.token, `employer_members?user_id=eq.${viewerA.userId}`, { method: "PATCH", body: JSON.stringify({ role: "owner" }) });
      const [m] = await rows<{ role: string }>(await service(`employer_members?user_id=eq.${viewerA.userId}&select=role`));
      expect(m.role).toBe("viewer");
    });

    it("an outsider cannot add themselves to company A", async () => {
      const r = await asUser(ownerB.token, "employer_members", { method: "POST", body: JSON.stringify({ employer_id: ownerA.userId, user_id: ownerB.userId, role: "owner" }) });
      expect(r.ok).toBe(false);
    });

    it("an owner cannot remove a teammate by calling the table directly", async () => {
      await asUser(ownerA.token, `employer_members?user_id=eq.${adminA.userId}`, { method: "DELETE" });
      expect(await rows(await service(`employer_members?user_id=eq.${adminA.userId}&select=user_id`))).toHaveLength(1);
    });
  });

  describe("company row (employers)", () => {
    it("teammates, including viewers, can read their company; outsiders cannot", async () => {
      const mine = await rows<{ id: string }>(await asUser(viewerA.token, `employers?id=eq.${ownerA.userId}&select=id`));
      expect(mine).toHaveLength(1);
      expect(await rows(await asUser(ownerB.token, `employers?id=eq.${ownerA.userId}&select=id`))).toEqual([]);
    });

    it("a client JWT cannot edit the company, so edits must go through the audited API", async () => {
      await asUser(ownerA.token, `employers?id=eq.${ownerA.userId}`, { method: "PATCH", body: JSON.stringify({ company_name: "Renamed Directly" }) });
      const [c] = await rows<{ company_name: string }>(await service(`employers?id=eq.${ownerA.userId}&select=company_name`));
      expect(c.company_name).toBe("RLS Co A");
    });
  });

  it("the role helper is not callable by anonymous clients", async () => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/employer_role_of`, {
      method: "POST",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_employer: ownerA.userId }),
    });
    expect(r.ok).toBe(false);
  });
});
