import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.SUPABASE_URL = "https://db.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
process.env.RESEND_API_KEY = "re_test";
process.env.APP_URL = "https://app.test";

/* Signed-in user for the request in flight; the tests switch it to act as the
   owner, then as the invitee. */
const session = { userId: "owner-1" };
vi.mock("../../server-handlers/_shared", async (orig) => ({
  ...(await orig<typeof import("../../server-handlers/_shared")>()),
  withAuthAndRateLimit: async (req: Request) => ({ headers: {}, auth: { userId: req.headers.get("x-test-user") ?? session.userId } }),
  isRateLimited: async () => false,
  validateOrigin: () => true,
  slog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../../server-handlers/_employer-team-gate", () => ({ teamsEnabledFor: async () => true }));
const notify = vi.fn(async (..._a: unknown[]) => undefined);
vi.mock("../../server-handlers/_notify", () => ({ notify: (...a: unknown[]) => notify(...a) }));
vi.mock("../../server-handlers/_employer-team-helpers", async (orig) => ({
  ...(await orig<typeof import("../../server-handlers/_employer-team-helpers")>()),
  requireEmployerPermission: async () => ({
    ok: true, ctx: { employerId: "co-1", userId: "owner-1", role: "owner", email: "owner@acme.com", name: "Priya" },
  }),
}));

const { default: teamHandler } = await import("../../server-handlers/employer-team");
const { default: acceptHandler } = await import("../../server-handlers/employer-team-accept");

type Row = Record<string, unknown>;
interface Db {
  invites: Row[];
  members: Row[];
  audit: Row[];
  companies: Row[];
  authUsers: Record<string, { email: string; email_confirmed_at: string | null; user_metadata?: Row }>;
  emails: Array<{ to: string[]; subject: string; html: string }>;
  failMemberInsert: boolean;
  resendOk: boolean;
  /* Holds token lookups until this many have arrived, so two accepts both see a pending invite. */
  lookupBarrier: { size: number; waiting: Array<() => void> } | null;
}
let db: Db;

const iso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();

function matches(row: Row, params: URLSearchParams): boolean {
  for (const [key, cond] of params) {
    if (["select", "order", "limit"].includes(key)) continue;
    const v = row[key];
    if (cond === "is.null") { if (v != null) return false; continue; }
    if (cond.startsWith("eq.")) { if (String(v) !== cond.slice(3)) return false; continue; }
    if (cond.startsWith("gt.")) { if (!(String(v) > cond.slice(3))) return false; continue; }
  }
  return true;
}

function installDb() {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const body = init?.body ? (JSON.parse(String(init.body)) as Row) : {};

    if (url.host === "api.resend.com") {
      if (!db.resendOk) return json({}, 500);
      db.emails.push(body as unknown as Db["emails"][number]);
      return json({ id: "em_1" });
    }
    if (url.pathname.startsWith("/auth/v1/admin/users/")) {
      const u = db.authUsers[decodeURIComponent(url.pathname.split("/").pop() ?? "")];
      return u ? json(u) : json({}, 404);
    }

    const table = url.pathname.replace("/rest/v1/", "");
    const p = url.searchParams;

    if (table === "employers") return json(db.companies.filter((c) => matches(c, p)));
    if (table === "employer_audit_log") {
      if (method === "POST") { db.audit.push(body); return json({}, 201); }
      return json(db.audit.filter((r) => matches(r, p)));
    }
    if (table === "employer_members") {
      if (method === "POST") {
        if (db.failMemberInsert) return json({}, 500);
        if (db.members.some((m) => m.user_id === body.user_id)) return json({}, 409);
        db.members.push({ joined_at: iso(), ...body });
        return json({}, 201);
      }
      return json(db.members.filter((m) => matches(m, p)));
    }
    if (table === "employer_invites") {
      if (method === "POST") {
        const row = { id: `inv-${db.invites.length + 1}`, created_at: iso(), accepted_at: null, accepted_by: null, revoked_at: null, ...body };
        db.invites.push(row);
        return json([row], 201);
      }
      if (method === "PATCH") {
        // The filters the handler sends make this a compare-and-swap, as in Postgres.
        const hit = db.invites.filter((r) => matches({ ...r, expires_at: undefined }, new URLSearchParams([...p].filter(([k]) => k !== "expires_at")))
          && (!p.get("expires_at") || String(r.expires_at) > String(p.get("expires_at")).slice(3)));
        hit.forEach((r) => Object.assign(r, body));
        return json(hit);
      }
      const rows = db.invites.filter((r) => matches(r, p)).map((r) => ({
        ...r,
        employers: db.companies.find((c) => c.id === r.employer_id) ?? null,
      }));
      const barrier = db.lookupBarrier;
      if (barrier && p.get("token_hash")) {
        await new Promise<void>((resolve) => {
          barrier.waiting.push(resolve);
          if (barrier.waiting.length >= barrier.size) barrier.waiting.forEach((r) => r());
        });
      }
      return json(rows);
    }
    throw new Error(`unexpected fetch ${method} ${url.pathname}${url.search}`);
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  session.userId = "owner-1";
  db = {
    invites: [],
    members: [{ employer_id: "co-1", user_id: "owner-1", role: "owner", email: "owner@acme.com", name: "Priya", invited_by: null, joined_at: iso(-1e9), last_active_at: null }],
    audit: [],
    companies: [{ id: "co-1", company_name: "Acme", suspended_at: null }],
    authUsers: {
      "new-1": { email: "new@acme.com", email_confirmed_at: iso(-1e6), user_metadata: { name: "Neha" } },
      "other-1": { email: "other@gmail.com", email_confirmed_at: iso(-1e6) },
      "unconfirmed-1": { email: "new@acme.com", email_confirmed_at: null },
      "elsewhere-1": { email: "new@acme.com", email_confirmed_at: iso(-1e6) },
    },
    emails: [],
    failMemberInsert: false,
    resendOk: true,
    lookupBarrier: null,
  };
  installDb();
});

const invite = (email = "new@acme.com", role = "member") =>
  teamHandler(new Request("https://app.test/api/employer-team", { method: "POST", body: JSON.stringify({ action: "invite", email, role }) }));

const tokenFromEmail = (i = 0): string => {
  const href = /href="([^"]*\/employer\/join\?token=[^"]+)"/.exec(db.emails[i].html)?.[1];
  if (!href) throw new Error("no join link in email");
  return new URL(href.replace(/&amp;/g, "&")).searchParams.get("token") as string;
};

const preview = (token: string) =>
  acceptHandler(new Request(`https://app.test/api/employer-team-accept?token=${encodeURIComponent(token)}`));
const accept = (token: string, as: string) =>
  acceptHandler(new Request("https://app.test/api/employer-team-accept", { method: "POST", headers: { "x-test-user": as }, body: JSON.stringify({ token }) }));

describe("team invite round trip: send, email, preview, accept", () => {
  it("emails a working link that previews and joins the invitee with the invited role", async () => {
    const res = await invite("New@Acme.com", "member");
    expect(res.status).toBe(201);
    const sent = (await res.json()) as { emailed: boolean; link: string };
    expect(sent.emailed).toBe(true);

    expect(db.emails).toHaveLength(1);
    expect(db.emails[0].to).toEqual(["new@acme.com"]);
    expect(db.emails[0].subject).toContain("Priya invited you to Acme");
    const token = tokenFromEmail();
    expect(sent.link).toBe(`https://app.test/employer/join?token=${encodeURIComponent(token)}`);
    // Only the hash is stored; the raw token never reaches the database.
    expect(JSON.stringify(db.invites)).not.toContain(token);

    const prev = await preview(token);
    expect(prev.status).toBe(200);
    expect(await prev.json()).toEqual({ state: "pending", companyName: "Acme", role: "member", email: "new@acme.com", inviterName: "Priya" });

    const joined = await accept(token, "new-1");
    expect(joined.status).toBe(200);
    expect(await joined.json()).toEqual({ ok: true, companyName: "Acme", role: "member" });

    expect(db.members.find((m) => m.user_id === "new-1")).toMatchObject({ employer_id: "co-1", role: "member", email: "new@acme.com", name: "Neha", invited_by: "owner-1" });
    expect(db.invites[0]).toMatchObject({ accepted_by: "new-1" });
    expect(db.invites[0].accepted_at).toBeTruthy();
    expect(db.audit.map((a) => a.action)).toEqual(["member.invited", "member.joined"]);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ userId: "owner-1", type: "team_invite_accepted", title: "Neha joined your team" }));

    const list = (await (await teamHandler(new Request("https://app.test/api/employer-team"))).json()) as { members: Array<{ email: string }>; invites: unknown[] };
    expect(list.members.map((m) => m.email)).toContain("new@acme.com");
    expect(list.invites).toHaveLength(0);
  });

  it("is single use: a replayed link is rejected and creates no second membership", async () => {
    await invite();
    const token = tokenFromEmail();
    expect((await accept(token, "new-1")).status).toBe(200);
    const again = await accept(token, "elsewhere-1");
    expect(again.status).toBe(409);
    expect(((await again.json()) as { code: string }).code).toBe("used");
    expect(db.members.filter((m) => m.role === "member")).toHaveLength(1);
  });

  it("lets only one of two accounts win when the link is accepted twice at once", async () => {
    await invite();
    const token = tokenFromEmail();
    // Two confirmed accounts on the invited address, so only the atomic claim can separate them.
    db.lookupBarrier = { size: 2, waiting: [] };
    const results = await Promise.all([accept(token, "new-1"), accept(token, "elsewhere-1")]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(db.members.filter((m) => m.role === "member")).toHaveLength(1);
  });

  it("refuses a different account, even a signed-in one holding the leaked link", async () => {
    await invite();
    const token = tokenFromEmail();
    const res = await accept(token, "other-1");
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe("email_mismatch");
    expect(db.members.some((m) => m.user_id === "other-1")).toBe(false);
    expect(db.invites[0].accepted_at).toBeNull();
  });

  it("refuses the right address until its email is confirmed", async () => {
    await invite();
    const res = await accept(tokenFromEmail(), "unconfirmed-1");
    expect(((await res.json()) as { code: string }).code).toBe("email_mismatch");
    expect(db.members.some((m) => m.user_id === "unconfirmed-1")).toBe(false);
  });

  it("rejects expired and revoked links with their own reasons", async () => {
    await invite();
    const token = tokenFromEmail();
    db.invites[0].expires_at = iso(-1000);
    const expired = await accept(token, "new-1");
    expect(((await expired.json()) as { code: string }).code).toBe("expired");

    db.invites[0].expires_at = iso(1e8);
    db.invites[0].revoked_at = iso();
    const revoked = await accept(token, "new-1");
    expect(((await revoked.json()) as { code: string }).code).toBe("revoked");
    expect(db.members.some((m) => m.user_id === "new-1")).toBe(false);
  });

  it("treats an unknown or malformed token as not found", async () => {
    expect((await preview("x".repeat(43))).status).toBe(404);
    expect((await preview("short")).status).toBe(404);
    expect((await accept("x".repeat(43), "new-1")).status).toBe(404);
  });

  it("refuses someone who already belongs to another company", async () => {
    await invite();
    db.members.push({ employer_id: "co-2", user_id: "new-1", role: "owner", email: "new@acme.com", name: null, joined_at: iso(-1e6) });
    const res = await accept(tokenFromEmail(), "new-1");
    expect(((await res.json()) as { code: string }).code).toBe("already_member");
    expect(db.invites[0].accepted_at).toBeNull();
  });

  it("refuses to join a suspended company, without burning the invite", async () => {
    await invite();
    const token = tokenFromEmail();
    db.companies[0].suspended_at = iso(-1);
    const res = await accept(token, "new-1");
    expect(res.status).toBe(403);
    expect(db.members.some((m) => m.user_id === "new-1")).toBe(false);
    expect(db.invites[0].accepted_at).toBeNull();
  });

  it("refuses to join a team that is already at its seat limit, without burning the invite", async () => {
    await invite();
    const token = tokenFromEmail();
    for (let i = 0; i < 4; i++) {
      db.members.push({ employer_id: "co-1", user_id: `m-${i}`, role: "member", email: `m${i}@acme.com`, name: null, joined_at: iso(-1e6) });
    }
    const res = await accept(token, "new-1");
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe("team_full");
    expect(db.members.some((m) => m.user_id === "new-1")).toBe(false);
    expect(db.invites[0].accepted_at).toBeNull();

    db.members.pop();
    expect((await accept(token, "new-1")).status).toBe(200);
  });

  it("does not burn the invite when the membership insert fails", async () => {
    await invite();
    const token = tokenFromEmail();
    db.failMemberInsert = true;
    expect((await accept(token, "new-1")).status).toBe(500);
    expect(db.invites[0]).toMatchObject({ accepted_at: null, accepted_by: null });

    db.failMemberInsert = false;
    expect((await accept(token, "new-1")).status).toBe(200);
  });

  it("re-inviting an address kills the earlier link", async () => {
    await invite();
    const first = tokenFromEmail(0);
    await invite();
    const second = tokenFromEmail(1);
    expect(second).not.toBe(first);
    expect(((await (await accept(first, "new-1")).json()) as { code: string }).code).toBe("revoked");
    expect((await accept(second, "new-1")).status).toBe(200);
  });

  it("still creates the invite and returns a copyable link when the email fails to send", async () => {
    db.resendOk = false;
    const res = await invite();
    expect(res.status).toBe(201);
    const sent = (await res.json()) as { emailed: boolean; link: string };
    expect(sent.emailed).toBe(false);
    const token = new URL(sent.link).searchParams.get("token") as string;
    expect((await accept(token, "new-1")).status).toBe(200);
  });

  it("escapes a hostile company name in the email", async () => {
    db.companies[0].company_name = `<img src=x onerror=alert(1)>`;
    await invite();
    expect(db.emails[0].html).not.toContain("<img src=x");
    expect(db.emails[0].html).toContain("&lt;img");
  });
});
