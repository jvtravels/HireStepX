import { describe, it, expect, vi, beforeEach } from "vitest";

/* Regression for the Edge-runtime fire-and-forget bug: a resume_data write
 * used to nudge the incremental rematch pipeline via `void fn()`, which has
 * no guaranteed lifetime past the response on Vercel's Edge runtime — the
 * isolate can be torn down before the rescore finishes, so candidates who
 * just signed up silently never showed up against open requirements. This
 * pins that the handler now registers the rescore via `after()` instead,
 * which Vercel keeps the isolate alive for. */

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const withAuthAndRateLimit = vi.fn();
const after = vi.fn();
const rematchOpenRequirementsForNewResume = vi.fn().mockResolvedValue(undefined);

vi.mock("../../server-handlers/_shared", () => ({
  withAuthAndRateLimit: (...args: unknown[]) => withAuthAndRateLimit(...args),
  corsHeaders: () => ({}),
  withRequestId: (h: Record<string, string>) => h,
}));

vi.mock("next/server", () => ({
  after: (...args: unknown[]) => after(...args),
}));

vi.mock("../../server-handlers/employer-requirements", () => ({
  rematchOpenRequirementsForNewResume: (...args: unknown[]) => rematchOpenRequirementsForNewResume(...args),
}));

const { default: handler } = await import("../../server-handlers/update-profile");

function updateReq(body: Record<string, unknown>) {
  return new Request("https://x.test/api/profile/update", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: "cand-1", authenticated: true }, headers: {} });
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [{ id: "cand-1", name: "Jay" }],
  }) as unknown as typeof fetch;
});

describe("update-profile — incremental rematch trigger", () => {
  it("registers the rematch via after() (not a bare fire-and-forget) when resume_data is written", async () => {
    const res = await handler(updateReq({ resume_data: { _type: "fallback", skills: ["React"] } }));

    expect(res.status).toBe(200);
    expect(after).toHaveBeenCalledTimes(1);
    expect(rematchOpenRequirementsForNewResume).not.toHaveBeenCalled(); // not invoked eagerly...
    await after.mock.calls[0][0](); // ...only once after()'s callback actually runs
    expect(rematchOpenRequirementsForNewResume).toHaveBeenCalledTimes(1);
  });

  it("does not register a rematch when the write carries no resume_data", async () => {
    const res = await handler(updateReq({ name: "Jay" }));

    expect(res.status).toBe(200);
    expect(after).not.toHaveBeenCalled();
  });
});
