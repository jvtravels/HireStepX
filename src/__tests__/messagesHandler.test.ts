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
  noConversation?: boolean;
  /** created_at of employer messages already in the thread (cap query). */
  employerSentAt?: string[];
  /** rows returned for the thread read */
  messages?: Array<Record<string, unknown>>;
  /** rows returned for the inbox list */
  inbox?: Array<Record<string, unknown>>;
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
    if (u.includes("/rest/v1/conversation_messages?conversation_id=") && u.includes("sender_role=eq.employer")) {
      return { ok: true, json: async () => (o.employerSentAt ?? []).map((created_at) => ({ created_at })) };
    }
    if (u.includes("/rest/v1/conversation_messages?conversation_id=")) return { ok: true, json: async () => o.messages ?? [] };
    if (u.includes("/rest/v1/conversations?or=")) return { ok: true, json: async () => o.inbox ?? [] };
    if (u.includes("/rest/v1/conversations?match_id=")) {
      if (o.noConversation && init?.method !== "POST") return { ok: true, json: async () => [] };
      return { ok: true, json: async () => [{ id: "c1", match_id: MATCH, requirement_id: "r1", employer_id: EMP, candidate_user_id: CAND, last_message_at: null, last_sender_role: null, employer_last_read_at: null, candidate_last_read_at: null, created_at: "t" }] };
    }
    if (u.includes("/rest/v1/conversations?id=")) return { ok: true, json: async () => [] };
    if (u.endsWith("/rest/v1/conversations") && init?.method === "POST") {
      return { ok: true, text: async () => JSON.stringify([{ id: "c1", match_id: MATCH, requirement_id: "r1", employer_id: EMP, candidate_user_id: CAND }]) };
    }
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

  it.each(["interview_invited", "interviewing", "hired"])("lets a candidate open a thread once invited, even without a paid unlock (%s)", async (candidateStatus) => {
    asUser(CAND);
    const f = installFetch({ unlocked: false, candidateStatus, noConversation: true });
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

const getThread = () => handler(new Request(`https://x.test/api/messages?matchId=${MATCH}`));

describe("messages: company identity stays confidential until unlock", () => {
  it("masks the company name from a candidate while the match is locked, and shows it once unlocked", async () => {
    asUser(CAND);
    installFetch({ unlocked: false });
    expect((await (await getThread()).json()).context.companyName).toBe("Confidential company");
    installFetch({ unlocked: true });
    expect((await (await getThread()).json()).context.companyName).toBe("Acme");
  });

  it("masks the company name in the candidate's inbox list until unlock", async () => {
    asUser(CAND);
    const row = (unlocked: boolean) => ({
      id: "c1", match_id: MATCH, requirement_id: "r1", employer_id: EMP, candidate_user_id: CAND,
      last_message_at: null, last_sender_role: null, employer_last_read_at: null, candidate_last_read_at: null, created_at: "t",
      employer_requirements: { title: "Dev", employers: { company_name: "Acme", suspended_at: null } },
      profiles: { name: "C", employer_visibility: "on" },
      requirement_matches: { candidate_status: "shortlisted", match_score: 80, unlocked },
    });
    installFetch({ inbox: [row(false)] });
    let conv = (await (await handler(new Request("https://x.test/api/messages"))).json()).conversations[0];
    expect(conv.companyName).toBe("Confidential company");
    expect(conv.counterpartName).toBe("Confidential company");
    installFetch({ inbox: [row(true)] });
    conv = (await (await handler(new Request("https://x.test/api/messages"))).json()).conversations[0];
    expect(conv.companyName).toBe("Acme");
  });
});

describe("messages: inbox list for a suspended employer", () => {
  it("403s the employer's inbox once suspended", async () => {
    const row = {
      id: "c1", match_id: MATCH, requirement_id: "r1", employer_id: EMP, candidate_user_id: CAND,
      last_message_at: null, last_sender_role: null, employer_last_read_at: null, candidate_last_read_at: null, created_at: "t",
      employer_requirements: { title: "Dev", employers: { company_name: "Acme", suspended_at: "2026-09-01T00:00:00Z" } },
      profiles: { name: "C", employer_visibility: "on" },
      requirement_matches: { candidate_status: "shortlisted", match_score: 80, unlocked: true },
    };
    installFetch({ inbox: [row] });
    const res = await handler(new Request("https://x.test/api/messages"));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/suspended/);
  });
});

describe("messages: a candidate cannot cold-open a thread", () => {
  it("403s no_relationship for a candidate with a locked, un-answered match and no thread", async () => {
    asUser(CAND);
    const f = installFetch({ unlocked: false, noConversation: true });
    const res = await post();
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("no_relationship");
    expect(sent(f)).toBe(false);
  });

  it("does not let interest alone open a thread, but an unlock does", async () => {
    asUser(CAND);
    const f = installFetch({ unlocked: false, response: "interested", noConversation: true });
    const res = await post();
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("no_relationship");
    expect(sent(f)).toBe(false);
    installFetch({ unlocked: true, noConversation: true });
    expect((await post()).status).toBe(201);
  });

  it("still lets a candidate reply in an existing thread even while locked", async () => {
    asUser(CAND);
    installFetch({ unlocked: false });
    expect((await post()).status).toBe(201);
  });
});

describe("messages: employer per-match spam cap", () => {
  it("429s message_cap_reached with Retry-After after 20 employer messages in 24h", async () => {
    const hourAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
    const f = installFetch({ unlocked: true, employerSentAt: Array.from({ length: 20 }, (_, i) => hourAgo(1 + i * 0.5)) });
    const res = await post();
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("message_cap_reached");
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(sent(f)).toBe(false);
  });

  it("allows the send under the cap and never caps the candidate", async () => {
    installFetch({ unlocked: true, employerSentAt: Array.from({ length: 19 }, () => new Date().toISOString()) });
    expect((await post()).status).toBe(201);
    asUser(CAND);
    installFetch({ unlocked: true, employerSentAt: Array.from({ length: 25 }, () => new Date().toISOString()) });
    expect((await post()).status).toBe(201);
  });
});

describe("messages: attachment path validation", () => {
  it.each([
    `${MATCH}/../other/f.pdf`,
    `/${MATCH}/f.pdf`,
    `${MATCH}\\f.pdf`,
    `${MATCH}/%2e%2e/f.pdf`,
    `${MATCH}/a/b.pdf`,
    `22222222-2222-4222-8222-222222222222/f.pdf`,
  ])("400s %s", async (attachmentPath) => {
    const f = installFetch({ unlocked: true });
    const res = await post({ matchId: MATCH, body: "x", attachmentPath });
    expect(res.status).toBe(400);
    expect(sent(f)).toBe(false);
  });

  it("accepts a path the sender's own upload minted", async () => {
    installFetch({ unlocked: true });
    expect((await post({ matchId: MATCH, body: "x", attachmentPath: `${MATCH}/employer-aaaa-bbbb.pdf` })).status).toBe(201);
    asUser(CAND);
    installFetch({ unlocked: true });
    expect((await post({ matchId: MATCH, body: "x", attachmentPath: `${MATCH}/candidate-aaaa-bbbb.pdf` })).status).toBe(201);
  });

  it("refuses an employer re-posting a candidate's file (paywall bypass), and legacy untagged paths", async () => {
    for (const attachmentPath of [`${MATCH}/candidate-aaaa-bbbb.pdf`, `${MATCH}/aaaa-bbbb.pdf`]) {
      const f = installFetch({ unlocked: false, response: "interested" });
      const res = await post({ matchId: MATCH, body: "x", attachmentPath });
      expect(res.status).toBe(400);
      expect(sent(f)).toBe(false);
    }
  });

  it("refuses a candidate re-posting an employer's file", async () => {
    asUser(CAND);
    const f = installFetch({ unlocked: true });
    expect((await post({ matchId: MATCH, body: "x", attachmentPath: `${MATCH}/employer-aaaa-bbbb.pdf` })).status).toBe(400);
    expect(sent(f)).toBe(false);
  });

  it("stores a sanitised name and a MIME type derived from the path, not the client's", async () => {
    const f = installFetch({ unlocked: true });
    await post({
      matchId: MATCH, body: "x", attachmentPath: `${MATCH}/employer-aaaa-bbbb.pdf`,
      attachmentName: "../../etc/passwd\u0000<b>.pdf", attachmentMime: "text/html",
    });
    const call = f.mock.calls.find(([u, init]) => String(u).endsWith("/rest/v1/conversation_messages") && (init as RequestInit | undefined)?.method === "POST");
    const stored = JSON.parse(String((call![1] as RequestInit).body));
    expect(stored.attachment_name).not.toMatch(/[\\/<>]/);
    expect(stored.attachment_name).not.toContain("\u0000");
    expect(stored.attachment_name).toContain("passwd");
    expect(stored.attachment_mime).toBe("application/pdf");
  });
});

describe("messages: attachment names and contact for a non-releasable employer", () => {
  const candMsg = { id: "m", conversation_id: "c1", sender_id: CAND, sender_role: "candidate", body: "call 9876543210", attachment_path: `${MATCH}/candidate-a.pdf`, attachment_name: "Priya_Sharma_9876543210.pdf", attachment_mime: "application/pdf", auto_flag_reason: null, created_at: "t" };

  it("redacts the file name and phone while locked", async () => {
    installFetch({ unlocked: false, response: "interested", messages: [candMsg] });
    const body = await (await getThread()).json();
    expect(body.messages[0].attachmentName).toBe("Attachment");
    expect(body.messages[0].body).not.toContain("9876543210");
  });

  it("never returns a candidate file's storage key to a non-releasable employer", async () => {
    installFetch({ unlocked: false, response: "interested", messages: [candMsg] });
    const body = await (await getThread()).json();
    expect(body.messages[0].attachmentPath).toBe("withheld");
    expect(JSON.stringify(body)).not.toContain("candidate-a.pdf");
  });

  it("still returns the real path once the contact is releasable, and the candidate always gets their own", async () => {
    installFetch({ unlocked: true, messages: [candMsg] });
    expect((await (await getThread()).json()).messages[0].attachmentPath).toBe(`${MATCH}/candidate-a.pdf`);
    asUser(CAND);
    installFetch({ unlocked: false, messages: [candMsg] });
    expect((await (await getThread()).json()).messages[0].attachmentPath).toBe(`${MATCH}/candidate-a.pdf`);
  });

  it("keeps them hidden after an unlocked candidate declines or withdraws", async () => {
    for (const o of [{ response: "declined" }, { withdrew: true }]) {
      installFetch({ unlocked: true, messages: [candMsg], ...o });
      const body = await (await getThread()).json();
      expect(body.messages[0].attachmentName).toBe("Attachment");
      expect(body.messages[0].body).not.toContain("9876543210");
      expect(body.context.contactLocked).toBe(true);
    }
  });

  it("shows them to an unlocked employer with a willing candidate", async () => {
    installFetch({ unlocked: true, messages: [candMsg] });
    const body = await (await getThread()).json();
    expect(body.messages[0].attachmentName).toBe("Priya_Sharma_9876543210.pdf");
    expect(body.messages[0].body).toContain("9876543210");
  });
});
