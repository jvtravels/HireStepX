import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.SUPABASE_URL = "https://db.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";

vi.mock("../../server-handlers/_shared", () => ({
  withAuthAndRateLimit: async () => ({ headers: {}, auth: { userId: "owner-1" } }),
  corsHeaders: () => ({}),
  slog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../../server-handlers/_employer-team-gate", () => ({ teamsEnabledFor: async () => true }));
const sendChange = vi.fn(async (..._a: unknown[]) => true);
const sendInvite = vi.fn(async (..._a: unknown[]) => true);
vi.mock("../../server-handlers/_employer-team-emails", async (orig) => ({
  ...(await orig<typeof import("../../server-handlers/_employer-team-emails")>()),
  sendTeamChangeEmail: (...a: unknown[]) => sendChange(...a),
  sendTeamInviteEmail: (...a: unknown[]) => sendInvite(...a),
}));
vi.mock("../../server-handlers/_employer-team-helpers", async (orig) => ({
  ...(await orig<typeof import("../../server-handlers/_employer-team-helpers")>()),
  requireEmployerPermission: async () => ({
    ok: true, ctx: { employerId: "co-1", userId: "owner-1", role: "owner", email: "owner@acme.com", name: "Priya" },
  }),
  writeAuditLog: async () => true,
}));

const { default: handler } = await import("../../server-handlers/employer-team");
const { MAX_TEAM_SIZE } = await import("../../server-handlers/_employer-team-helpers");

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const roster = [
  { user_id: "owner-1", role: "owner", email: "owner@acme.com", name: "Priya", invited_by: null, joined_at: hoursAgo(500), last_active_at: null },
  { user_id: "u-2", role: "member", email: "dev@acme.com", name: "Dev", invited_by: "owner-1", joined_at: hoursAgo(100), last_active_at: null },
];

let recentInvites: Array<{ created_at: string }>;
let resendsLogged: number;
let memberWriteRows: unknown[];
let inviteInsertFull: boolean;
let demoteFails: boolean;
const calls: Array<{ url: string; method: string }> = [];

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  recentInvites = [];
  resendsLogged = 0;
  memberWriteRows = [{ ok: 1 }];
  inviteInsertFull = false;
  demoteFails = false;
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method });
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
    if (url.includes("/employers?")) return json([{ company_name: "Acme", suspended_at: null }]);
    if (url.includes("/employer_members?") && method === "GET") return json(roster);
    if (url.includes("/employer_members?")) {
      if (demoteFails && method === "PATCH" && url.includes("user_id=eq.owner-1")) return json({}, 500);
      return json(memberWriteRows);
    }
    if (url.includes("employer_invites?") && url.includes("accepted_at=is.null&revoked_at=is.null&select")) return json([]);
    if (url.includes("employer_invites?") && url.includes("created_at=gt.")) return json(recentInvites);
    if (url.includes("employer_audit_log?")) return json(Array.from({ length: resendsLogged }, (_, i) => ({ id: i })));
    if (url.includes("/employer_invites") && method === "POST" && inviteInsertFull) return new Response('{"message":"team_full"}', { status: 400 });
    if (url.includes("/employer_invites") && method === "POST") {
      return json([{ id: "inv-new", employer_id: "co-1", email: "new@acme.com", role: "member", invited_by: "owner-1", created_at: hoursAgo(0), expires_at: hoursAgo(-100), accepted_at: null, revoked_at: null }], 201);
    }
    if (url.includes("employer_invites?id=eq.inv-1") && method === "GET") {
      return json([{ id: "inv-1", employer_id: "co-1", email: "wait@acme.com", role: "member", invited_by: "owner-1", created_at: hoursAgo(2), expires_at: hoursAgo(-100), accepted_at: null, revoked_at: null }]);
    }
    if (url.includes("employer_invites?id=eq.inv-1") && method === "PATCH") {
      return json([{ id: "inv-1", employer_id: "co-1", email: "wait@acme.com", role: "member", invited_by: "owner-1", created_at: hoursAgo(2), expires_at: hoursAgo(-100), accepted_at: null, revoked_at: null }]);
    }
    return json([]);
  }));
});

const post = (body: unknown) =>
  handler(new Request("https://app.test/api/employer-team", { method: "POST", body: JSON.stringify(body) }));

describe("employer-team handler: invite throttle", () => {
  it("counts revoked and accepted invites from the last day, not only live ones", async () => {
    recentInvites = Array.from({ length: 20 }, () => ({ created_at: hoursAgo(3) }));
    const res = await post({ action: "invite", email: "new@acme.com", role: "member" });
    expect(res.status).toBe(429);
    expect(sendInvite).not.toHaveBeenCalled();
  });

  it("lets an invite through while under the cap", async () => {
    recentInvites = Array.from({ length: 19 }, () => ({ created_at: hoursAgo(3) }));
    const res = await post({ action: "invite", email: "new@acme.com", role: "member" });
    expect(res.status).toBe(201);
    expect(sendInvite).toHaveBeenCalledOnce();
  });
});

describe("employer-team handler: seat cap", () => {
  const seats = (n: number) => Array.from({ length: n }, (_, i) => ({
    user_id: `u-${i}`, role: "member", email: `m${i}@acme.com`, name: `M${i}`, invited_by: "owner-1", joined_at: hoursAgo(10), last_active_at: null,
  }));

  it("allows at most 5 people and refuses the 6th invite", async () => {
    expect(MAX_TEAM_SIZE).toBe(5);
    const original = roster.splice(0, roster.length, ...seats(MAX_TEAM_SIZE));
    try {
      const res = await post({ action: "invite", email: "new@acme.com", role: "member" });
      expect(res.status).toBe(409);
      expect(sendInvite).not.toHaveBeenCalled();
    } finally {
      roster.splice(0, roster.length, ...original);
    }
  });

  it("still allows the 5th seat", async () => {
    const original = roster.splice(0, roster.length, ...seats(MAX_TEAM_SIZE - 1));
    try {
      const res = await post({ action: "invite", email: "new@acme.com", role: "member" });
      expect(res.status).toBe(201);
    } finally {
      roster.splice(0, roster.length, ...original);
    }
  });
});

describe("employer-team handler: resend cap", () => {
  it("stops re-sending once the daily resend cap is reached", async () => {
    resendsLogged = 30;
    const res = await post({ action: "resend_invite", inviteId: "inv-1" });
    expect(res.status).toBe(429);
    expect(sendInvite).not.toHaveBeenCalled();
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("re-sends under the cap", async () => {
    resendsLogged = 2;
    const res = await post({ action: "resend_invite", inviteId: "inv-1" });
    expect(res.status).toBe(200);
    expect(sendInvite).toHaveBeenCalledOnce();
  });
});

describe("employer-team handler: telling people about access changes", () => {
  it("emails a member whose role changed", async () => {
    const res = await post({ action: "set_role", userId: "u-2", role: "admin" });
    expect(res.status).toBe(200);
    expect(sendChange).toHaveBeenCalledWith(expect.objectContaining({ to: "dev@acme.com", change: { kind: "role_changed", role: "admin" } }));
  });

  it("emails a removed member", async () => {
    const res = await post({ action: "remove_member", userId: "u-2" });
    expect(res.status).toBe(200);
    expect(sendChange).toHaveBeenCalledWith(expect.objectContaining({ to: "dev@acme.com", change: { kind: "removed" } }));
  });

  it("tells the new owner on a transfer", async () => {
    const res = await post({ action: "transfer_ownership", userId: "u-2" });
    expect(res.status).toBe(200);
    expect(sendChange).toHaveBeenCalledWith(expect.objectContaining({ change: { kind: "ownership_received" } }));
  });

  it("sends nothing when the sole owner is blocked from leaving", async () => {
    const res = await post({ action: "leave" });
    expect(res.status).toBe(409);
    expect(sendChange).not.toHaveBeenCalled();
  });
});

describe("employer-team handler: concurrent changes", () => {
  it("pins a role change to the role it validated and reports a stale roster as 409", async () => {
    memberWriteRows = [];
    const res = await post({ action: "set_role", userId: "u-2", role: "admin" });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe("stale");
    const patch = calls.find((c) => c.method === "PATCH" && c.url.includes("user_id=eq.u-2"));
    expect(patch?.url).toContain("role=eq.member");
    expect(sendChange).not.toHaveBeenCalled();
  });

  it("does not remove someone who was changed since the page loaded", async () => {
    memberWriteRows = [];
    const res = await post({ action: "remove_member", userId: "u-2" });
    expect(res.status).toBe(409);
    expect(sendChange).not.toHaveBeenCalled();
  });

  it("puts the new owner back when the old owner's demotion fails", async () => {
    demoteFails = true;
    expect((await post({ action: "transfer_ownership", userId: "u-2" })).status).toBe(500);
    const patches = calls.filter((c) => c.method === "PATCH" && c.url.includes("employer_members"));
    expect(patches.at(-1)?.url).toContain("user_id=eq.u-2");
    expect(patches.at(-1)?.url).toContain("role=eq.owner");
  });

  it("maps the database seat-cap error on invite to the normal team-full message", async () => {
    inviteInsertFull = true;
    const res = await post({ action: "invite", email: "new@acme.com", role: "member" });
    expect(res.status).toBe(409);
    expect(sendInvite).not.toHaveBeenCalled();
  });
});
