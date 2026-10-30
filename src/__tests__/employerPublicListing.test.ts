import { describe, it, expect, vi, beforeEach } from "vitest";

/* Employer consent key for the public /openings pages (set_public_listing in
 * employer-requirement-detail.ts): "on" only opts in, never approves; "off"
 * always withdraws, including from an approved listing. */

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const withAuthAndRateLimit = vi.fn();
const slogError = vi.fn();

vi.mock("../../server-handlers/_shared", () => ({
  withAuthAndRateLimit: (...args: unknown[]) => withAuthAndRateLimit(...args),
  corsHeaders: () => ({}),
  withRequestId: (h: Record<string, string>) => h,
  slog: { error: (...args: unknown[]) => slogError(...args) },
}));

const runMatching = vi.fn();
const logRequirementActivity = vi.fn();

vi.mock("../../server-handlers/employer-requirements", () => ({
  runMatching: (...args: unknown[]) => runMatching(...args),
  logRequirementActivity: (...args: unknown[]) => logRequirementActivity(...args),
}));

vi.mock("../../server-handlers/_employer-team-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../server-handlers/_employer-team-helpers")>();
  return {
    ...actual,
    requireEmployerPermission: async (_u: string, _h: unknown, userId: string) => ({ ok: true, ctx: { employerId: userId, userId, role: "owner", email: "", name: null } }),
    writeAuditLog: async () => true,
  };
});

const { default: handler } = await import("../../server-handlers/employer-requirement-detail");


function listingReq(value: unknown) {
  return new Request("https://x.test/api/employer-requirement-detail?id=req-1", {
    method: "PATCH",
    body: JSON.stringify({ action: "set_public_listing", value }),
  });
}
const row = (over: Record<string, unknown> = {}) => ({ ok: true, json: async () => [{ id: "req-1", status: "ready", public_listing: "off", ...over }] });

beforeEach(() => {
  vi.restoreAllMocks();
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: "emp-1" }, headers: {} });
});

describe("set_public_listing", () => {
  it("opts a role in without approving it", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(row()).mockResolvedValueOnce({ ok: true, json: async () => [{}] });
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = await handler(listingReq("on"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "req-1", publicListing: "employer_ok" });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ public_listing: "employer_ok" });
  });

  it("never downgrades an approved listing when asked to opt in again", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(row({ public_listing: "approved" }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = await handler(listingReq("on"));
    expect(await res.json()).toEqual({ id: "req-1", publicListing: "approved" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("withdraws from an approved listing and clears the approval date", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(row({ public_listing: "approved" })).mockResolvedValueOnce({ ok: true, json: async () => [{}] });
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = await handler(listingReq("off"));
    expect(res.status).toBe(200);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ public_listing: "off", public_approved_at: null });
  });

  it("rejects values other than on and off", async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    expect((await handler(listingReq("approved"))).status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("refuses to opt in a closed role", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(row({ status: "closed" })) as unknown as typeof fetch;
    expect((await handler(listingReq("on"))).status).toBe(409);
  });

  it("404s a role that is not the caller's", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => [] }) as unknown as typeof fetch;
    expect((await handler(listingReq("on"))).status).toBe(404);
  });
});
