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

const { default: handler } = await import("../../server-handlers/message-attachment-url");
const { default: uploadHandler } = await import("../../server-handlers/message-attachment-upload");

interface Opts {
  unlocked?: boolean;
  response?: string | null;
  withdrew?: boolean;
  blocked?: boolean;
  suspended?: boolean;
  reqStatus?: string;
  senderRole?: "employer" | "candidate";
}

const EMP = "emp-1";
const CAND = "cand-1";
const MATCH = "11111111-1111-4111-8111-111111111111";
const MSG = "22222222-2222-4222-8222-222222222222";

function installFetch(o: Opts) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/auth/v1/admin/users/")) return { ok: true, json: async () => ({ email: "a@acme.com", email_confirmed_at: "t" }) };
    if (u.includes("/rest/v1/conversation_messages")) {
      return {
        ok: true,
        json: async () => [{ id: MSG, employer_id: EMP, candidate_user_id: CAND, sender_role: o.senderRole ?? "candidate", attachment_path: `${MATCH}/f.pdf`, conversations: { match_id: MATCH } }],
      };
    }
    if (u.includes("/rest/v1/requirement_matches")) {
      return {
        ok: true,
        json: async () => [{
          id: MATCH, requirement_id: "r1", candidate_user_id: CAND, match_score: 80, unlocked: o.unlocked ?? true,
          candidate_status: "shortlisted", candidate_response: o.response ?? null,
          employer_requirements: {
            employer_id: EMP, status: o.reqStatus ?? "ready", title: "Dev",
            employers: { company_name: "Acme", website: "acme.com", suspended_at: o.suspended ? "t" : null, verification_tier: "basic" },
          },
          profiles: { name: "C", employer_visibility: o.withdrew ? "off" : "on" },
        }],
      };
    }
    if (u.includes("/rest/v1/employer_blocks")) return { ok: true, json: async () => (o.blocked ? [{ candidate_user_id: CAND }] : []) };
    if (u.includes("/storage/v1/object/sign/")) return { ok: true, json: async () => ({ signedURL: "/object/sign/chat-attachments/f.pdf?token=abc" }) };
    if (u.includes("/storage/v1/object/chat-attachments/")) return { ok: true, text: async () => "" };
    throw new Error(`unexpected fetch ${u}`);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const signed = (f: ReturnType<typeof installFetch>) => f.mock.calls.some(([u]) => String(u).includes("/object/sign/"));
const get = () => handler(new Request(`https://x.test/api/message-attachment-url?messageId=${MSG}`));
const asUser = (id: string) => withAuthAndRateLimit.mockResolvedValue({ auth: { userId: id }, headers: {} });

beforeEach(() => {
  withAuthAndRateLimit.mockReset();
  asUser(EMP);
});

describe("message-attachment-url gating", () => {
  it("lets an unlocked employer download a candidate's attachment", async () => {
    const f = installFetch({ unlocked: true });
    const res = await get();
    expect(res.status).toBe(200);
    expect((await res.json()).url).toContain("/storage/v1/object/sign/chat-attachments/f.pdf");
    expect(signed(f)).toBe(true);
  });

  it("403s unlock_required for a locked employer and never signs", async () => {
    const f = installFetch({ unlocked: false });
    const res = await get();
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("unlock_required");
    expect(signed(f)).toBe(false);
  });

  it("lets a locked employer re-download a file they sent themselves", async () => {
    installFetch({ unlocked: false, response: "interested", senderRole: "employer" });
    expect((await get()).status).toBe(200);
  });

  it("404s a blocked employer even after unlock", async () => {
    const f = installFetch({ unlocked: true, blocked: true });
    expect((await get()).status).toBe(404);
    expect(signed(f)).toBe(false);
  });

  it("403s a suspended employer", async () => {
    const f = installFetch({ unlocked: true, suspended: true });
    expect((await get()).status).toBe(403);
    expect(signed(f)).toBe(false);
  });

  it("409s candidate_withdrew and candidate_declined", async () => {
    let f = installFetch({ unlocked: true, withdrew: true });
    let res = await get();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("candidate_withdrew");
    expect(signed(f)).toBe(false);

    f = installFetch({ unlocked: true, response: "declined" });
    res = await get();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("candidate_declined");
    expect(signed(f)).toBe(false);
  });

  it("keeps candidate access to their own thread's attachments, even locked, withdrawn or with a suspended employer", async () => {
    asUser(CAND);
    const f = installFetch({ unlocked: false, withdrew: true, suspended: true, response: "declined" });
    expect((await get()).status).toBe(200);
    expect(signed(f)).toBe(true);
  });

  it("403s a stranger", async () => {
    asUser("someone-else");
    const f = installFetch({ unlocked: true });
    expect((await get()).status).toBe(403);
    expect(signed(f)).toBe(false);
  });
});

describe("message-attachment-upload gating", () => {
  const upload = () => uploadHandler(new Request("https://x.test/api/message-attachment-upload", {
    method: "POST",
    body: JSON.stringify({ matchId: MATCH, fileName: "cv.pdf", contentType: "application/pdf", fileBase64: "aGVsbG8=" }),
  }));
  const stored = (f: ReturnType<typeof installFetch>) => f.mock.calls.some(([u]) => String(u).includes("/storage/v1/object/chat-attachments/"));

  it("lets an unlocked employer upload", async () => {
    const f = installFetch({ unlocked: true });
    expect((await upload()).status).toBe(200);
    expect(stored(f)).toBe(true);
  });

  it("402s a locked employer, 409s a closed requirement, 404s a blocked employer; nothing is stored", async () => {
    let f = installFetch({ unlocked: false });
    let res = await upload();
    expect(res.status).toBe(402);
    expect((await res.json()).code).toBe("unlock_required");
    expect(stored(f)).toBe(false);

    f = installFetch({ unlocked: true, reqStatus: "closed" });
    res = await upload();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("requirement_closed");
    expect(stored(f)).toBe(false);

    f = installFetch({ unlocked: true, blocked: true });
    expect((await upload()).status).toBe(404);
    expect(stored(f)).toBe(false);
  });

  it("lets a candidate upload, except into a suspended employer's thread", async () => {
    asUser(CAND);
    installFetch({ unlocked: false });
    expect((await upload()).status).toBe(200);
    const f = installFetch({ unlocked: true, suspended: true });
    const res = await upload();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("employer_unavailable");
    expect(stored(f)).toBe(false);
  });
});
