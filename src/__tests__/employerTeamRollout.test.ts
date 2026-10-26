import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const withAuthAndRateLimit = vi.fn();
const teamsEnabledFor = vi.fn<(id: string) => Promise<boolean>>();

vi.mock("../../server-handlers/_shared", () => ({
  withAuthAndRateLimit: (...args: unknown[]) => withAuthAndRateLimit(...args),
  corsHeaders: () => ({}),
  withRequestId: (h: Record<string, string>) => h,
  slog: { error: vi.fn() },
}));

vi.mock("../../server-handlers/_employer-team-gate", () => ({
  teamsEnabledFor: (id: string) => teamsEnabledFor(id),
}));

vi.mock("../../server-handlers/_employer-team-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../server-handlers/_employer-team-helpers")>();
  return {
    ...actual,
    requireEmployerPermission: async (_u: string, _h: unknown, userId: string) => ({
      ok: true, ctx: { employerId: "company-1", userId, role: "owner", email: "o@acme.in", name: "Owner" },
    }),
  };
});

const { default: teamHandler } = await import("../../server-handlers/employer-team");
const { default: activityHandler } = await import("../../server-handlers/employer-team-activity");

const get = (path: string) => new Request(`https://x.test${path}`, { method: "GET" });

beforeEach(() => {
  vi.restoreAllMocks();
  withAuthAndRateLimit.mockReset();
  teamsEnabledFor.mockReset();
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: "user-1" }, headers: {} });
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
});

describe("team APIs behind the EMPLOYER_TEAMS rollout", () => {
  it("GET /api/employer-team is a 404 when teams are off for the company, and touches no data", async () => {
    teamsEnabledFor.mockResolvedValue(false);
    const res = await teamHandler(get("/api/employer-team"));
    expect(res.status).toBe(404);
    expect(teamsEnabledFor).toHaveBeenCalledWith("company-1");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("POST /api/employer-team actions are blocked too (no invite can be sent while dark)", async () => {
    teamsEnabledFor.mockResolvedValue(false);
    const res = await teamHandler(new Request("https://x.test/api/employer-team", {
      method: "POST", body: JSON.stringify({ action: "invite", email: "a@b.co", role: "member" }),
    }));
    expect(res.status).toBe(404);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("GET /api/employer-team-activity is a 404 when off", async () => {
    teamsEnabledFor.mockResolvedValue(false);
    const res = await activityHandler(get("/api/employer-team-activity"));
    expect(res.status).toBe(404);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("GET /api/employer-team serves the roster once the company is enabled", async () => {
    teamsEnabledFor.mockResolvedValue(true);
    const res = await teamHandler(get("/api/employer-team"));
    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalled();
  });
});
