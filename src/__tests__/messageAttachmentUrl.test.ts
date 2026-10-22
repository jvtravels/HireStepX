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
  attachmentPath?: string;
  noConversation?: boolean;
  status?: string;
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
        json: async () => [{ id: MSG, employer_id: EMP, candidate_user_id: CAND, sender_role: o.senderRole ?? "candidate", attachment_path: o.attachmentPath ?? `${MATCH}/candidate-f.pdf`, conversations: { match_id: MATCH } }],
      };
    }
    if (u.includes("/rest/v1/conversations?match_id=")) return { ok: true, json: async () => (o.noConversation ? [] : [{ id: "c1" }]) };
    if (u.includes("/rest/v1/requirement_matches")) {
      return {
        ok: true,
        json: async () => [{
          id: MATCH, requirement_id: "r1", candidate_user_id: CAND, match_score: 80, unlocked: o.unlocked ?? true,
          candidate_status: o.status ?? "shortlisted", candidate_response: o.response ?? null,
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
    installFetch({ unlocked: false, response: "interested", senderRole: "employer", attachmentPath: `${MATCH}/employer-f.pdf` });
    expect((await get()).status).toBe(200);
  });

  it("403s a locked employer whose message row says employer but whose file the candidate uploaded", async () => {
    const f = installFetch({ unlocked: false, response: "interested", senderRole: "employer", attachmentPath: `${MATCH}/candidate-f.pdf` });
    const res = await get();
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("unlock_required");
    expect(signed(f)).toBe(false);
  });

  it("treats a legacy untagged path as the candidate's, so a locked employer cannot sign it", async () => {
    const f = installFetch({ unlocked: false, response: "interested", senderRole: "employer", attachmentPath: `${MATCH}/f.pdf` });
    expect((await get()).status).toBe(403);
    expect(signed(f)).toBe(false);
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

  it("404s a stranger, same as a missing message", async () => {
    asUser("someone-else");
    const f = installFetch({ unlocked: true });
    expect((await get()).status).toBe(404);
    expect(signed(f)).toBe(false);
  });
});

describe("message-attachment-url path validation", () => {
  it.each([`${MATCH}/../x/f.pdf`, `/${MATCH}/f.pdf`, `${MATCH}\\f.pdf`, `22222222-2222-4222-8222-222222222222/f.pdf`])(
    "refuses to sign a stored path of %s",
    async (attachmentPath) => {
      asUser(CAND);
      const f = installFetch({ attachmentPath });
      const res = await get();
      expect(res.status).toBe(404);
      expect(signed(f)).toBe(false);
    },
  );
});

const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));
const PDF_B64 = b64([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

describe("message-attachment-upload gating", () => {
  const send = (contentType: string, fileBase64: string) => uploadHandler(new Request("https://x.test/api/message-attachment-upload", {
    method: "POST",
    body: JSON.stringify({ matchId: MATCH, fileName: "cv.pdf", contentType, fileBase64 }),
  }));
  const upload = () => send("application/pdf", PDF_B64);
  const stored = (f: ReturnType<typeof installFetch>) => f.mock.calls.some(([u]) => String(u).includes("/storage/v1/object/chat-attachments/"));

  it("lets an unlocked employer upload", async () => {
    const f = installFetch({ unlocked: true });
    expect((await upload()).status).toBe(200);
    expect(stored(f)).toBe(true);
  });

  it("tags the stored object with the uploader's role so signing can gate on it", async () => {
    installFetch({ unlocked: true });
    expect((await (await upload()).json()).attachmentPath).toMatch(new RegExp(`^${MATCH}/employer-[0-9a-f-]{36}\\.pdf$`));
    asUser(CAND);
    installFetch({ unlocked: false });
    expect((await (await upload()).json()).attachmentPath).toMatch(new RegExp(`^${MATCH}/candidate-[0-9a-f-]{36}\\.pdf$`));
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
    installFetch({ unlocked: false, status: "interview_invited" });
    expect((await upload()).status).toBe(200);
    const f = installFetch({ unlocked: true, suspended: true });
    const res = await upload();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("employer_unavailable");
    expect(stored(f)).toBe(false);
  });

  it("415s when the bytes do not match the declared type, and stores nothing", async () => {
    const f = installFetch({ unlocked: true });
    // HTML posing as a PDF / PNG
    for (const [type, text] of [["application/pdf", "<html><script>x</script>"], ["image/png", "%PDF-1.4"]] as const) {
      const res = await send(type, btoa(text));
      expect(res.status).toBe(415);
      expect((await res.json()).error).toMatch(/doesn't match/);
    }
    expect(stored(f)).toBe(false);
  });

  it("accepts real PNG, JPEG, DOCX (zip) and plain text, rejects binary text/plain", async () => {
    installFetch({ unlocked: true });
    expect((await send("image/png", b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).status).toBe(200);
    expect((await send("image/jpeg", b64([0xff, 0xd8, 0xff, 0xe0]))).status).toBe(200);
    expect((await send("application/vnd.openxmlformats-officedocument.wordprocessingml.document", b64([0x50, 0x4b, 0x03, 0x04]))).status).toBe(200);
    expect((await send("text/plain", btoa("hello world"))).status).toBe(200);
    expect((await send("text/plain", b64([0x4d, 0x5a, 0x00, 0x01]))).status).toBe(415);
  });

  it("lets a candidate open a thread by upload once the employer has invited them", async () => {
    asUser(CAND);
    installFetch({ unlocked: false, status: "interview_invited", noConversation: true });
    expect((await upload()).status).toBe(200);
  });

  it("403s a candidate who would be cold-opening a thread", async () => {
    asUser(CAND);
    const f = installFetch({ unlocked: false, noConversation: true });
    const res = await upload();
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("no_relationship");
    expect(stored(f)).toBe(false);
  });
});
