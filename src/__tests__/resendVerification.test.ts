import { describe, it, expect, vi, beforeEach } from "vitest";

const scheduled: Array<() => Promise<void>> = [];
// send-welcome reads its HMAC secret at module load, so set it before the imports run.
vi.hoisted(() => { process.env.EMAIL_VERIFICATION_SECRET = "x".repeat(32); });
vi.mock("next/server", () => ({ after: (fn: () => Promise<void>) => { scheduled.push(fn); } }));

import handler from "../../server-handlers/resend-verification";
import {
  processResendVerification,
  RESEND_GENERIC_MESSAGE,
  type ResendDeps,
} from "../../server-handlers/_resend-verification-helpers";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function deps(fetchImpl: typeof fetch): ResendDeps {
  return {
    supabaseUrl: "https://s.test",
    serviceKey: "svc",
    resendApiKey: "re_key",
    fromEmail: "HireStepX <noreply@hirestepx.com>",
    appUrl: "https://app.test",
    canIssueTokens: true,
    makeToken: () => "tok123",
    fetchImpl,
  };
}

function routedFetch(user: unknown | null, resendStatus = 200) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/auth/v1/admin/users")) return json({ users: user ? [user] : [] });
    if (url.includes("api.resend.com")) return json({ id: "x" }, resendStatus);
    throw new Error(`unexpected ${url}`);
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

const unverified = { id: "u1", email: "a@example.com", user_metadata: { name: "Asha", custom_email_verified: false }, app_metadata: { provider: "email", providers: ["email"] } };

describe("processResendVerification", () => {
  it("sends a fresh token email only for an existing unverified password account", async () => {
    const f = routedFetch(unverified);
    expect(await processResendVerification(deps(f), "a@example.com")).toBe("sent");
    const call = (f as unknown as ReturnType<typeof vi.fn>).mock.calls.find((c) => String(c[0]).includes("resend.com"))!;
    const body = JSON.parse(call[1].body);
    expect(body.to).toEqual(["a@example.com"]);
    expect(body.html).toContain("https://app.test/api/verify-email?email=a%40example.com&token=tok123");
    expect(body.html).toContain("Asha");
  });

  it("sends nothing for unknown, verified, or OAuth-only accounts", async () => {
    for (const [user, outcome] of [
      [null, "skipped-no-account"],
      [{ ...unverified, user_metadata: { custom_email_verified: true } }, "skipped-verified"],
      [{ ...unverified, email_confirmed_at: "2026-01-01", app_metadata: { provider: "google", providers: ["google"] } }, "skipped-oauth"],
    ] as const) {
      const f = routedFetch(user);
      expect(await processResendVerification(deps(f), "a@example.com")).toBe(outcome);
      expect((f as unknown as ReturnType<typeof vi.fn>).mock.calls.some((c) => String(c[0]).includes("resend.com"))).toBe(false);
    }
  });

  it("does not issue tokens when the signing secret is weak", async () => {
    const f = routedFetch(unverified);
    expect(await processResendVerification({ ...deps(f), canIssueTokens: false }, "a@example.com")).toBe("not-configured");
    expect(f).not.toHaveBeenCalled();
  });

  it("reports a failed lookup and a failed send distinctly", async () => {
    const bad = vi.fn().mockResolvedValue(json({}, 500)) as unknown as typeof fetch;
    expect(await processResendVerification(deps(bad), "a@example.com")).toBe("lookup-failed");
    expect(await processResendVerification(deps(routedFetch(unverified, 500)), "a@example.com")).toBe("send-failed");
  });
});

describe("POST /api/resend-verification (anti-enumeration)", () => {
  beforeEach(() => {
    scheduled.length = 0;
    process.env.SUPABASE_URL = "https://s.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
    process.env.RESEND_API_KEY = "re_key";
    process.env.EMAIL_VERIFICATION_SECRET = "x".repeat(32);
  });

  let ipCounter = 0;
  const call = (body: unknown, ip = `10.0.0.${++ipCounter}`) =>
    handler(new Request("https://app.test/api/resend-verification", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", "x-real-ip": ip },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }));

  it("returns the identical response for unknown, valid, malformed and missing emails", async () => {
    const bodies = [{ email: "known@example.com" }, { email: "ghost@example.com" }, { email: "not-an-email" }, {}, "{bad json"];
    const results = await Promise.all(bodies.map(async (b) => {
      const r = await call(b);
      return { status: r.status, body: await r.text() };
    }));
    for (const r of results) {
      expect(r.status).toBe(200);
      expect(JSON.parse(r.body)).toEqual({ ok: true, message: RESEND_GENERIC_MESSAGE });
    }
    expect(new Set(results.map((r) => r.body)).size).toBe(1);
  });

  it("defers the lookup and send until after the response is chosen", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(routedFetch(unverified) as typeof fetch);
    const res = await call({ email: "a@example.com" });
    expect(res.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(1);
    await scheduled[0]();
    expect(fetchSpy.mock.calls.some((c) => String(c[0]).includes("resend.com"))).toBe(true);
    fetchSpy.mockRestore();
  });

  it("rate limits per email (3/hour) with the same generic 200 and no further work", async () => {
    for (let i = 0; i < 3; i++) expect((await call({ email: "limited@example.com" })).status).toBe(200);
    expect(scheduled).toHaveLength(3);
    const res = await call({ email: "Limited@Example.com" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, message: RESEND_GENERIC_MESSAGE });
    expect(scheduled).toHaveLength(3);
  });

  it("rate limits per IP with a 429", async () => {
    let last = 200;
    for (let i = 0; i < 11; i++) last = (await call({ email: `u${i}@example.com` }, "10.9.9.9")).status;
    expect(last).toBe(429);
  });

  it("rejects foreign origins", async () => {
    const r = await handler(new Request("https://app.test/api/resend-verification", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example", "x-real-ip": "10.8.8.8" },
      body: JSON.stringify({ email: "a@example.com" }),
    }));
    expect(r.status).toBe(403);
  });
});
