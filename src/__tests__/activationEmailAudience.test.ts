import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

process.env.SUPABASE_URL = "https://db.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
process.env.RESEND_API_KEY = "re_key";
process.env.CRON_SECRET = "cron";
vi.mock("../../server-handlers/_cron-auth", () => ({ verifyCronAuth: () => true }));
vi.mock("../../server-handlers/_cron-heartbeat", () => ({ recordCronResult: vi.fn() }));

const { default: handler } = await import("../../server-handlers/send-activation-emails");

const CAND = "11111111-1111-4111-8111-111111111111";
const EMP = "22222222-2222-4222-8222-222222222222";
const profile = (id: string, email: string) => ({ id, name: "Rakhi Sharma", email, created_at: new Date().toISOString(), target_role: null, practice_timestamps: [] });

function mockRes() {
  const r = { statusCode: 0, body: undefined as unknown, status(c: number) { r.statusCode = c; return r; }, json(b: unknown) { r.body = b; return r; } };
  return r;
}

function install(opts: { employerStatus?: number; employers?: string[] }) {
  const resendTo: string[] = [];
  const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/rest/v1/profiles")) return new Response(JSON.stringify([profile(CAND, "cand@example.com"), profile(EMP, "hr@employer.example")]), { status: 200 });
    if (u.includes("/rest/v1/employers")) {
      if (opts.employerStatus && opts.employerStatus >= 400) return new Response("[]", { status: opts.employerStatus });
      return new Response(JSON.stringify((opts.employers ?? []).map((id) => ({ id }))), { status: 200 });
    }
    if (u.includes("/rest/v1/")) return new Response("[]", { status: 200 });
    if (u.includes("api.resend.com")) {
      resendTo.push(...(JSON.parse(String(init?.body)).to as string[]));
      return new Response("{}", { status: 200 });
    }
    return new Response("{}", { status: 200 });
  });
  vi.stubGlobal("fetch", f);
  return resendTo;
}

beforeEach(() => { vi.spyOn(console, "warn").mockImplementation(() => {}); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("send-activation-emails audience", () => {
  it("emails the candidate and never the employer account", async () => {
    const to = install({ employers: [EMP] });
    const res = mockRes();
    await handler({ method: "GET", headers: {} } as never, res as never);
    expect(to).toEqual(["cand@example.com"]);
  });

  it("sends nothing when the employer lookup fails (fail closed)", async () => {
    const to = install({ employerStatus: 500 });
    const res = mockRes();
    await handler({ method: "GET", headers: {} } as never, res as never);
    expect(to).toEqual([]);
  });
});
