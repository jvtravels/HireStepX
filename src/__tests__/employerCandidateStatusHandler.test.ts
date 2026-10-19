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
const notify = vi.fn(async () => undefined);
vi.mock("../../server-handlers/_notify", () => ({ notify: (...a: unknown[]) => notify(...(a as [])) }));

const { default: handler } = await import("../../server-handlers/employer-candidate-status");

const EMP = "emp-1";
const CAND = "cand-1";
const MATCH = "11111111-1111-4111-8111-111111111111";

interface Opts {
  unlocked?: boolean;
  response?: string | null;
  withdrew?: boolean;
  from?: string;
}

function installFetch(o: Opts) {
  const to = { current: "" };
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    if (u.includes("/auth/v1/admin/users/")) return { ok: true, json: async () => ({ email: "a@acme.com", email_confirmed_at: "t" }) };
    if (u.includes("/rest/v1/employer_blocks")) return { ok: true, json: async () => [] };
    if (u.includes("/rest/v1/requirement_matches") && method === "PATCH") {
      const patch = JSON.parse(String(init?.body));
      to.current = patch.candidate_status;
      return {
        ok: true,
        json: async () => [{ id: MATCH, requirement_id: "r1", candidate_status: patch.candidate_status, candidate_status_note: null, candidate_status_updated_at: "t", interview_scheduled_at: null }],
      };
    }
    if (u.includes("/rest/v1/requirement_matches")) {
      return {
        ok: true,
        json: async () => [{
          id: MATCH, requirement_id: "r1", candidate_user_id: CAND, match_score: 80,
          unlocked: o.unlocked ?? true, candidate_status: o.from ?? "shortlisted", candidate_response: o.response ?? null,
          employer_requirements: {
            employer_id: EMP, status: "ready", title: "Dev",
            employers: { company_name: "Acme", website: "acme.com", suspended_at: null, verification_tier: "basic" },
          },
          profiles: { name: "C", employer_visibility: o.withdrew ? "off" : "on" },
        }],
      };
    }
    if (u.includes("/rest/v1/match_status_events")) return { ok: true, json: async () => [] };
    if (u.includes("/rest/v1/conversations?match_id=")) return { ok: true, json: async () => [{ id: "c1" }] };
    if (u.includes("/rest/v1/conversations?id=")) return { ok: true, json: async () => [] };
    if (u.endsWith("/rest/v1/conversation_messages")) return { ok: true, json: async () => [] };
    throw new Error(`unexpected fetch ${method} ${u}`);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const systemBodies = (f: ReturnType<typeof installFetch>) =>
  f.mock.calls
    .filter(([u, init]) => String(u).endsWith("/rest/v1/conversation_messages") && (init as RequestInit | undefined)?.method === "POST")
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)).body as string);

const eventInserts = (f: ReturnType<typeof installFetch>) =>
  f.mock.calls.filter(([u, init]) => String(u).includes("/rest/v1/match_status_events") && (init as RequestInit | undefined)?.method === "POST");

const patch = (body: Record<string, unknown>) =>
  handler(new Request("https://x.test/api/employer-candidate-status", { method: "PATCH", body: JSON.stringify({ matchId: MATCH, ...body }) }));

beforeEach(() => {
  withAuthAndRateLimit.mockReset();
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: EMP }, headers: {} });
  notify.mockClear();
});

describe("employer-candidate-status free text", () => {
  it("never delivers employer-typed text from a Locked match", async () => {
    const f = installFetch({ unlocked: false });
    const res = await patch({ candidateStatus: "not_a_fit", candidateMessage: "Call me 9876543210, I am Rahul at TCS" });
    expect(res.status).toBe(200);
    const bodies = systemBodies(f);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toContain("Not a fit");
    expect(bodies[0]).not.toContain("9876543210");
    expect(bodies[0]).not.toContain("Rahul");
    const event = JSON.parse(String(eventInserts(f)[0][1]?.body));
    expect(event.note).toBeNull();
  });

  it("delivers the message from an unlocked match", async () => {
    const f = installFetch({ unlocked: true });
    await patch({ candidateStatus: "rejected", candidateMessage: "Thanks for your time" });
    expect(systemBodies(f)[0]).toContain("Thanks for your time");
  });

  it("drops the message when the candidate declined or withdrew", async () => {
    const declined = installFetch({ unlocked: true, response: "declined" });
    await patch({ candidateStatus: "rejected", candidateMessage: "please reconsider" });
    expect(systemBodies(declined)[0]).not.toContain("please reconsider");

    const withdrew = installFetch({ unlocked: true, withdrew: true });
    await patch({ candidateStatus: "rejected", candidateMessage: "please reconsider" });
    expect(systemBodies(withdrew)[0]).not.toContain("please reconsider");
  });
});

describe("employer-candidate-status same-state repeats", () => {
  it("updates silently without re-notifying, re-posting or re-logging", async () => {
    const f = installFetch({ unlocked: true, from: "rejected" });
    // rejected -> rejected is a note-only edit.
    const res = await patch({ candidateStatus: "rejected", note: "internal", candidateMessage: "again" });
    expect(res.status).toBe(200);
    expect(notify).not.toHaveBeenCalled();
    expect(systemBodies(f)).toHaveLength(0);
    expect(eventInserts(f)).toHaveLength(0);
  });

  it("still notifies and posts on a real transition", async () => {
    const f = installFetch({ unlocked: true, from: "shortlisted" });
    const res = await patch({ candidateStatus: "rejected" });
    expect(res.status).toBe(200);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(systemBodies(f)).toHaveLength(1);
    expect(eventInserts(f)).toHaveLength(1);
  });
});

describe("employer-candidate-status rate limit", () => {
  it("allows 60 changes a minute so a 20-candidate bulk move can be undone", async () => {
    installFetch({ unlocked: true });
    await patch({ candidateStatus: "rejected" });
    expect(withAuthAndRateLimit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userLimit: 60 }));
  });
});
