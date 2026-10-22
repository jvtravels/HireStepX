import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../server-handlers/_unsubscribe", () => ({
  isSuppressed: vi.fn(async () => false),
  marketingEmailParts: vi.fn(async () => ({ footer: undefined, resend: {} })),
  preferenceDepsFromEnv: vi.fn(() => ({})),
}));
vi.mock("../../server-handlers/_cron-heartbeat", () => ({ recordCronResult: vi.fn(async () => undefined) }));

const intent = { userId: "u1", email: "a@b.co", plan: "pro", amount: 49900, planName: "Pro", createdAt: Date.now() - 2 * 3600_000 };

function mockRes() {
  const res = { statusCode: 0, body: undefined as unknown, status(c: number) { this.statusCode = c; return this; }, json(b: unknown) { this.body = b; return this; } };
  return res;
}

describe("send-abandonment-emails claim-before-send", () => {
  let calls: string[];
  let claimResult: "OK" | null;
  let resendOk: boolean;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("CRON_SECRET", "s3cret");
    calls = [];
    claimResult = "OK";
    resendOk = true;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(url);
      if (url.includes("/SCAN/")) return new Response(JSON.stringify({ result: ["0", ["pay_intent:1"]] }));
      if (url.includes("/GET/")) return new Response(JSON.stringify({ result: JSON.stringify(intent) }));
      if (url.includes("/SET/")) return new Response(JSON.stringify({ result: claimResult }));
      if (url.includes("api.resend.com")) return new Response("{}", { status: resendOk ? 200 : 500 });
      return new Response(JSON.stringify({ result: 1 }));
    }));
  });

  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  async function run() {
    const { default: handler } = await import("../../server-handlers/send-abandonment-emails");
    const res = mockRes();
    await handler({ headers: { authorization: "Bearer s3cret" } } as never, res as never);
    return res;
  }

  it("sends once and deletes the intent when the claim is won", async () => {
    const res = await run();
    expect(res.body).toMatchObject({ sent: 1, skipped: 0 });
    expect(calls.some((u) => u.includes("/SET/") && u.includes("NX"))).toBe(true);
    expect(calls.some((u) => u.includes("/DEL/pay_intent%3A1"))).toBe(true);
  });

  it("does not send when another run already holds the claim", async () => {
    claimResult = null;
    const res = await run();
    expect(res.body).toMatchObject({ sent: 0, skipped: 1 });
    expect(calls.some((u) => u.includes("api.resend.com"))).toBe(false);
  });

  it("releases the claim when the send fails so the next run retries", async () => {
    resendOk = false;
    const res = await run();
    expect(res.body).toMatchObject({ sent: 0 });
    expect(calls.some((u) => u.includes("/DEL/claim%3Apay_intent%3A1"))).toBe(true);
    expect(calls.some((u) => u.includes("/DEL/pay_intent%3A1"))).toBe(false);
  });
});
