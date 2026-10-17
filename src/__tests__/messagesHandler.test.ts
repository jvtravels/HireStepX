import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const withAuthAndRateLimit = vi.fn();
vi.mock("../../server-handlers/_shared", () => ({
  withAuthAndRateLimit: (...a: unknown[]) => withAuthAndRateLimit(...a),
  corsHeaders: () => ({}),
  withRequestId: (h: Record<string, string>) => h,
  slog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock("../../server-handlers/_notify", () => ({ notify: vi.fn(async () => undefined) }));

// Real _entitlements + _messages-helpers: the gating rules run end to end.
const { default: handler } = await import("../../server-handlers/messages");

interface MatchOpts {
  unlocked?: boolean;
  response?: string | null;
  withdrew?: boolean;
  reqStatus?: string;
  candidateStatus?: string;
  suspended?: boolean;
  blocked?: boolean;
}

const EMP = "emp-1";
const CAND = "cand-1";
const MATCH = "11111111-1111-4111-8111-111111111111";

function matchRow(o: MatchOpts) {
  return [{
    id: MATCH, requirement_id: "r1", candidate_user_id: CAND, match_score: 80,
    unlocked: o.unlocked ?? true, candidate_status: o.candidateStatus ?? "shortlisted", candidate_response: o.response ?? null,
    employer_requirements: {
      employer_id: EMP, status: o.reqStatus ?? "ready", title: "Dev",
      employers: { company_name: "Acme", website: "acme.com", suspended_at: o.suspended ? "2026-09-01T00:00:00Z" : null, verification_tier: "basic" },
    },
    profiles: { name: "C", employer_visibility: o.withdrew ? "off" : "on" },
  }];
}

function installFetch(o: MatchOpts) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/auth/v1/admin/users/")) return { ok: true, json: async () => ({ email: "a@acme.com", email_confirmed_at: "t" }) };
    if (u.includes("/rest/v1/requirement_matches")) return { ok: true, json: async () => matchRow(o) };
    if (u.includes("/rest/v1/employer_blocks")) return { ok: true, json: async () => (o.blocked ? [{ candidate_user_id: CAND }] : []) };
    if (u.endsWith("/rest/v1/conversation_messages") && init?.method === "POST") {
      return { ok: true, status: 201, json: async () => [{ id: "msg1", conversation_id: "c1", sender_id: "x", sender_role: "employer", body: "hi", attachment_path: null, attachment_name: null, attachment_mime: null, auto_flag_reason: null, created_at: "t" }], text: async () => "" };
    }
    if (u.includes("/rest/v1/conversation_messages?conversation_id=")) return { ok: true, json: async () => [] };
    if (u.includes("/rest/v1/conversations?match_id=")) {
      return { ok: true, json: async () => [{ id: "c1", match_id: MATCH, requirement_id: "r1", employer_id: EMP, candidate_user_id: CAND, last_message_at: null, last_sender_role: null, employer_last_read_at: null, candidate_last_read_at: null, created_at: "t" }] };
    }
    if (u.includes("/rest/v1/conversations?id=")) return { ok: true, json: async () => [] };
    throw new Error(`unexpected fetch ${u}`);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const sent = (f: ReturnType<typeof installFetch>) =>
  f.mock.calls.some(([u, init]) => String(u).endsWith("/rest/v1/conversation_messages") && (init as RequestInit | undefined)?.method === "POST");

const post = (body: Record<string, unknown> = { matchId: MATCH, body: "hello" }) =>
  handler(new Request("https://x.test/api/messages", { method: "POST", body: JSON.stringify(body) }));

const asUser = (id: string) => withAuthAndRateLimit.mockResolvedValue({ auth: { userId: id }, headers: {} });

beforeEach(() => {
  withAuthAndRateLimit.mockReset();
  asUser(EMP);
});

describe("messages POST gating", () => {
  it("lets an unlocked employer send", async () => {
    const f = installFetch({ unlocked: true });
    const res = await post();
    expect(res.status).toBe(201);
    expect(sent(f)).toBe(true);
  });

  it("402s unlock_required for a locked employer, unless the candidate is interested", async () => {
    const f = installFetch({ unlocked: false });
    const res = await post();
    expect(res.status).toBe(402);
    expect((await res.json()).code).toBe("unlock_required");
    expect(sent(f)).toBe(false);

    installFetch({ unlocked: false, response: "interested" });
    expect((await post()).status).toBe(201);
  });

  it("409s candidate_declined", async () => {
    const f = installFetch({ unlocked: true, response: "declined" });
    const res = await post();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("candidate_declined");
    expect(sent(f)).toBe(false);
  });

  it("409s candidate_withdrew when the candidate switched visibility off after unlock", async () => {
    const f = installFetch({ unlocked: true, withdrew: true });
    const res = await post();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("candidate_withdrew");
    expect(sent(f)).toBe(false);
  });

  it("409s requirement_closed for an employer on a closed requirement", async () => {
    const f = installFetch({ unlocked: true, reqStatus: "closed" });
    const res = await post();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("requirement_closed");
    expect(sent(f)).toBe(false);
  });

  it("409s candidate_not_active once the employer rejected the candidate", async () => {
    for (const candidateStatus of ["rejected", "not_a_fit"]) {
      const f = installFetch({ unlocked: true, candidateStatus });
      const res = await post();
      expect(res.status).toBe(409);
      expect((await res.json()).code).toBe("candidate_not_active");
      expect(sent(f)).toBe(false);
    }
  });

  it("404s a blocked employer and 403s a suspended one", async () => {
    installFetch({ unlocked: true, blocked: true });
    expect((await post()).status).toBe(404);
    installFetch({ unlocked: true, suspended: true });
    expect((await post()).status).toBe(403);
  });

  it("still lets a candidate reply on a closed requirement or after being rejected", async () => {
    asUser(CAND);
    const f = installFetch({ unlocked: true, reqStatus: "closed", candidateStatus: "rejected" });
    const res = await post();
    expect(res.status).toBe(201);
    expect(sent(f)).toBe(true);
  });

  it("409s employer_unavailable when a candidate posts into a suspended employer's thread", async () => {
    asUser(CAND);
    const f = installFetch({ unlocked: true, suspended: true });
    const res = await post();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("employer_unavailable");
    expect(sent(f)).toBe(false);
  });

  it("keeps history readable for a candidate on a suspended employer's thread, without the company identity", async () => {
    asUser(CAND);
    const f = installFetch({ unlocked: true, suspended: true });
    const res = await handler(new Request(`https://x.test/api/messages?matchId=${MATCH}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.context.employerUnavailable).toBe(true);
    expect(body.context.companyName).not.toBe("Acme");
    expect(sent(f)).toBe(false);
  });
});
