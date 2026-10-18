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
vi.mock("../../server-handlers/_posthog", () => ({ captureServerEvent: vi.fn(async () => undefined) }));
vi.mock("../../server-handlers/_unsubscribe", () => ({
  isSuppressed: vi.fn(async () => true),
  marketingEmailParts: vi.fn(async () => ({ footer: "", resend: {} })),
  preferenceDepsFromEnv: vi.fn(() => ({})),
}));

const { default: handler } = await import("../../server-handlers/employer-candidate-evidence");

interface Opts { unlocked?: boolean; response?: string | null; withdrew?: boolean }

const report = {
  skills: [{ name: "Communication", score: 80 }],
  wins: [{ text: "You explained it well", quote: "Mail me at priya@example.com or call 9876543210" }],
  perQuestion: [{ idx: 0, question: "Tell me about a project", verdict: "strong", score: 80, answerText: "Reach me at priya@example.com" }],
};

function installFetch(o: Opts) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/auth/v1/admin/users/")) return { ok: true, json: async () => ({ email: "a@acme.com", email_confirmed_at: "t" }) };
    if (u.includes("/rest/v1/requirement_matches") && init?.method === "PATCH") return { ok: true, json: async () => [] };
    if (u.includes("/rest/v1/requirement_matches")) {
      return {
        ok: true,
        json: async () => [{
          id: "m1", requirement_id: "r1", candidate_user_id: "cand-1", match_score: 80, unlocked: o.unlocked ?? true,
          candidate_status: "shortlisted", candidate_response: o.response ?? null,
          employer_requirements: { employer_id: "emp-1", status: "ready", title: "Dev", employers: { company_name: "Acme", website: "acme.com", suspended_at: null, verification_tier: "basic" } },
          profiles: { name: "Priya Sharma", employer_visibility: o.withdrew ? "off" : "on" },
        }],
      };
    }
    if (u.includes("/rest/v1/employer_blocks")) return { ok: true, json: async () => [] };
    if (u.includes("/rest/v1/sessions?")) return { ok: true, json: async () => [{ user_id: "cand-1", created_at: "2026-09-01T00:00:00Z", report_json: report, type: "interview", score: 80 }] };
    if (u.includes("/rest/v1/profiles?")) return { ok: true, json: async () => [{ name: "Priya Sharma" }] };
    if (u.includes("/rest/v1/resume_versions")) return { ok: true, json: async () => [{ file_name: "Priya Sharma CV.pdf", file_path: "cand-1/cv.pdf" }] };
    throw new Error(`unexpected fetch ${u}`);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const get = () => handler(new Request("https://x.test/api/employer-candidate-evidence?matchId=m1"));

beforeEach(() => {
  withAuthAndRateLimit.mockReset();
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: "emp-1" }, headers: {} });
});

describe("employer-candidate-evidence contact withholding", () => {
  it("returns raw quotes and the resume file for an unlocked, willing candidate", async () => {
    installFetch({ unlocked: true });
    const body = await (await get()).json();
    expect(body.resumeFile).toEqual({ fileName: "Priya Sharma CV.pdf" });
    expect(JSON.stringify(body.quotes)).toContain("priya@example.com");
  });

  it("scrubs contact text and drops the resume file once an unlocked candidate has declined", async () => {
    installFetch({ unlocked: true, response: "declined" });
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resumeFile).toBeNull();
    expect(body.quotes.length).toBeGreaterThan(0);
    const blob = JSON.stringify([body.quotes, body.questions]);
    expect(blob).not.toContain("priya@example.com");
    expect(blob).not.toContain("9876543210");
  });

  it("never reads the resume file for a declined candidate", async () => {
    const f = installFetch({ unlocked: true, response: "declined" });
    await get();
    expect(f.mock.calls.some(([u]) => String(u).includes("resume_versions"))).toBe(false);
  });

  it("still 409s a withdrawn candidate", async () => {
    installFetch({ unlocked: true, withdrew: true });
    const res = await get();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("candidate_withdrew");
  });

  it("scrubs a locked candidate and omits the resume file", async () => {
    installFetch({ unlocked: false });
    const body = await (await get()).json();
    expect(body.resumeFile).toBeNull();
    expect(JSON.stringify(body.quotes)).not.toContain("priya@example.com");
  });
});
