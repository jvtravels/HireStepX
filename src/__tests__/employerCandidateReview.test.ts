import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const withAuthAndRateLimit = vi.fn();
const requirePerm = vi.fn();
const loadAccess = vi.fn();
const audit = vi.fn(async (..._a: unknown[]) => true);

vi.mock("../../server-handlers/_shared", () => ({
  withAuthAndRateLimit: (...a: unknown[]) => withAuthAndRateLimit(...a),
  corsHeaders: () => ({}),
  withRequestId: (h: Record<string, string>) => h,
  slog: { error: vi.fn(), warn: vi.fn() },
}));
vi.mock("../../server-handlers/_employer-team-helpers", () => ({
  requireEmployerPermission: (...a: unknown[]) => requirePerm(...a),
  writeAuditLog: (...a: unknown[]) => audit(...a),
}));
vi.mock("../../server-handlers/_entitlements", () => ({
  loadAuthIdentity: async () => ({ email: "a@x.co", emailConfirmed: true }),
  loadEmployerMatchAccess: (...a: unknown[]) => loadAccess(...a),
  DENIED_STATUS: { not_found: { status: 404, error: "Not found" }, forbidden: { status: 403, error: "Forbidden" } },
}));

const { default: handler } = await import("../../server-handlers/employer-candidate-review");

const rows = [
  { reviewer_user_id: "u1", reviewer_email: "u1@x.co", rating: 4, reason: "great", updated_at: "2026-10-29T01:00:00Z" },
  { reviewer_user_id: "u2", reviewer_email: "u2@x.co", rating: 1, reason: "weak", updated_at: "2026-10-29T02:00:00Z" },
];
const get = () => new Request("https://x.test/api/employer-candidate-review?matchId=11111111-1111-4111-8111-111111111111");
const patch = (body: unknown) => new Request("https://x.test/api/employer-candidate-review", { method: "PATCH", body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: "u1" }, headers: {} });
  requirePerm.mockResolvedValue({ ok: true, ctx: { employerId: "emp1", userId: "u1", role: "member", email: "u1@x.co", name: null } });
  loadAccess.mockResolvedValue({ ok: true, access: { unlocked: false, match: { id: "11111111-1111-4111-8111-111111111111", requirement_id: "r1", employer_requirements: { title: "Eng" }, profiles: { name: "Secret" } } } });
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => rows, text: async () => "" })) as unknown as typeof fetch;
});

describe("employer-candidate-review", () => {
  it("401s without a user", async () => {
    withAuthAndRateLimit.mockResolvedValue({ auth: { userId: null }, headers: {} });
    expect((await handler(get())).status).toBe(401);
  });
  it("reveals teammates' reviews once the caller has reviewed", async () => {
    const body = await (await handler(get())).json();
    expect(body.revealed).toBe(true);
    expect(body.others).toHaveLength(1);
    expect(body.summary.disagreement).toBe(true);
  });
  it("keeps teammates' reviews hidden before the caller reviews", async () => {
    withAuthAndRateLimit.mockResolvedValue({ auth: { userId: "u3" }, headers: {} });
    const body = await (await handler(get())).json();
    expect(body).toMatchObject({ mine: null, others: [], revealed: false, hiddenCount: 2, summary: null });
    expect(JSON.stringify(body)).not.toContain("weak");
  });
  it("requires candidates.read for GET and candidates.manage for PATCH", async () => {
    await handler(get());
    expect(requirePerm.mock.calls[0][3]).toBe("candidates.read");
    await handler(patch({ matchId: "11111111-1111-4111-8111-111111111111", rating: 3, reason: "ok" }));
    expect(requirePerm.mock.calls[1][3]).toBe("candidates.manage");
  });
  it("returns the permission error", async () => {
    requirePerm.mockResolvedValue({ ok: false, status: 403, error: "No access" });
    expect((await handler(patch({ matchId: "11111111-1111-4111-8111-111111111111", rating: 3, reason: "ok" }))).status).toBe(403);
  });
  it("validates rating and reason before touching the database", async () => {
    expect((await handler(patch({ matchId: "11111111-1111-4111-8111-111111111111", rating: 5, reason: "ok" }))).status).toBe(400);
    expect((await handler(patch({ matchId: "11111111-1111-4111-8111-111111111111", rating: 3, reason: " " }))).status).toBe(400);
    expect((await handler(patch({ rating: 3, reason: "ok" }))).status).toBe(400);
    expect((await handler(patch({ matchId: "not-a-uuid", rating: 3, reason: "ok" }))).status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it("denies a match from another company", async () => {
    loadAccess.mockResolvedValue({ ok: false, reason: "not_found" });
    expect((await handler(patch({ matchId: "22222222-2222-4222-8222-222222222222", rating: 3, reason: "ok" }))).status).toBe(404);
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it("takes the employer from the session and audits without leaking a locked name", async () => {
    await handler(patch({ matchId: "11111111-1111-4111-8111-111111111111", rating: 3, reason: "ok", employerId: "evil" }));
    const post = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const sent = JSON.parse(post[1].body);
    expect(sent.employer_id).toBe("emp1");
    expect(sent.reviewer_user_id).toBe("u1");
    expect(audit.mock.calls[0][2]).toMatchObject({ action: "candidate.reviewed", meta: { rating: 3, candidateName: null } });
  });
});
