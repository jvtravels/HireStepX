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

// Real _entitlements: ownership/unlock rules are exercised through the network layer.
const { default: handler } = await import("../../server-handlers/employer-candidate-resume-url");

interface MatchOpts { employerId?: string; unlocked?: boolean; withdrew?: boolean; missing?: boolean; response?: string | null; blocked?: boolean }
function matchRow(o: MatchOpts) {
  return [{
    id: MATCH_ID, requirement_id: "r1", candidate_user_id: "cand-1", match_score: 80, unlocked: o.unlocked ?? false, candidate_response: o.response ?? null,
    employer_requirements: { employer_id: o.employerId ?? "emp-1", status: "ready", title: "Dev", employers: { company_name: "Acme", website: "acme.com", suspended_at: null, verification_tier: "basic" } },
    profiles: { name: "C", employer_visibility: o.withdrew ? "off" : "on" },
  }];
}

function installFetch(opts: MatchOpts & { files?: unknown[]; signOk?: boolean }) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/auth/v1/admin/users/")) return { ok: true, json: async () => ({ email: "a@acme.com", email_confirmed_at: "t" }) };
    if (u.includes("/rest/v1/requirement_matches")) return { ok: true, json: async () => (opts.missing ? [] : matchRow(opts)) };
    if (u.includes("/rest/v1/employer_blocks")) return { ok: true, json: async () => (opts.blocked ? [{ candidate_user_id: "cand-1" }] : []) };
    if (u.includes("/rest/v1/resume_versions")) return { ok: true, json: async () => opts.files ?? [{ file_name: "Priya CV.pdf", file_path: "cand-1/cv.pdf" }] };
    if (u.includes("/storage/v1/object/sign/")) {
      return opts.signOk === false
        ? { ok: false, json: async () => ({}) }
        : { ok: true, json: async () => ({ signedURL: "/object/sign/resume-files/cand-1/cv.pdf?token=abc" }) };
    }
    throw new Error(`unexpected fetch ${u}`);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const MATCH_ID = "11111111-1111-4111-8111-111111111111";
const get = (qs = `?matchId=${MATCH_ID}`) => handler(new Request(`https://x.test/api/employer-candidate-resume-url${qs}`));

beforeEach(() => {
  withAuthAndRateLimit.mockReset();
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: "emp-1" }, headers: {} });
});

describe("employer-candidate-resume-url", () => {
  it("403s while the candidate is still locked and never signs a URL", async () => {
    const f = installFetch({ unlocked: false });
    const res = await get();
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/Unlock this candidate/);
    expect(f.mock.calls.some(([u]) => String(u).includes("/object/sign/"))).toBe(false);
  });

  it("returns a short-lived signed download URL once unlocked", async () => {
    const f = installFetch({ unlocked: true });
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fileName).toBe("Priya CV.pdf");
    expect(body.url).toBe("https://example.supabase.co/storage/v1/object/sign/resume-files/cand-1/cv.pdf?token=abc&download=Priya%20CV.pdf");
    const signCall = f.mock.calls.find(([u]) => String(u).includes("/object/sign/"));
    expect(JSON.parse(String(signCall?.[1]?.body))).toEqual({ expiresIn: 120 });
  });

  it("404s for a match that does not exist", async () => {
    installFetch({ missing: true });
    expect((await get()).status).toBe(404);
  });

  it("refuses an employer who does not own the requirement, without leaking the file", async () => {
    const f = installFetch({ employerId: "someone-else", unlocked: true });
    const res = await get();
    expect(res.status).toBe(403);
    expect(f.mock.calls.some(([u]) => String(u).includes("resume_versions"))).toBe(false);
  });

  it("409s once the candidate has withdrawn from employer contact", async () => {
    installFetch({ unlocked: true, withdrew: true });
    const res = await get();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("candidate_withdrew");
  });

  it("409s candidate_declined for an unlocked candidate who declined, and never signs", async () => {
    const f = installFetch({ unlocked: true, response: "declined" });
    const res = await get();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("candidate_declined");
    expect(f.mock.calls.some(([u]) => String(u).includes("resume_versions") || String(u).includes("/object/sign/"))).toBe(false);
  });

  it("404s a blocked employer even after unlock, and never signs", async () => {
    const f = installFetch({ unlocked: true, blocked: true });
    expect((await get()).status).toBe(404);
    expect(f.mock.calls.some(([u]) => String(u).includes("/object/sign/"))).toBe(false);
  });

  it("still serves an unlocked candidate who responded interested", async () => {
    installFetch({ unlocked: true, response: "interested" });
    expect((await get()).status).toBe(200);
  });

  it("404s when the candidate has no resume file and 502s when signing fails", async () => {
    installFetch({ unlocked: true, files: [] });
    expect((await get()).status).toBe(404);
    installFetch({ unlocked: true, signOk: false });
    expect((await get()).status).toBe(502);
  });

  it("400s without a matchId and 401s without a user", async () => {
    installFetch({ unlocked: true });
    expect((await get("")).status).toBe(400);
    expect((await get("?matchId=m1")).status).toBe(400);
    expect((await get("?matchId=1;drop")).status).toBe(400);
    withAuthAndRateLimit.mockResolvedValue({ auth: { userId: null }, headers: {} });
    expect((await get()).status).toBe(401);
  });
});
