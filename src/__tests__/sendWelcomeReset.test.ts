import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// send-welcome reads its config at module load, so set it before the import runs.
vi.hoisted(() => {
  process.env.SUPABASE_URL = "https://s.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
  process.env.RESEND_API_KEY = "re_key";
  process.env.APP_URL = "https://app.test";
});

import handler from "../../server-handlers/send-welcome";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

interface Sent { subject: string; to: string[] }

interface Failures {
  generateLink?: number | "throw";
  resend?: number | "throw";
}

function setup(users: unknown[], fail: Failures = {}) {
  const generateLinkCalls: unknown[] = [];
  const emails: Sent[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/auth/v1/admin/users")) return json({ users });
    if (url.includes("/auth/v1/admin/generate_link")) {
      if (fail.generateLink === "throw") throw new Error("network");
      if (fail.generateLink) return json({}, fail.generateLink);
      generateLinkCalls.push(JSON.parse(String(init?.body)));
      return json({ action_link: "https://s.test/auth/v1/verify?token=abc&type=recovery" });
    }
    if (url.includes("api.resend.com")) {
      if (fail.resend === "throw") throw new Error("network");
      if (fail.resend) return json({}, fail.resend);
      emails.push(JSON.parse(String(init?.body)));
      return json({ id: "e1" });
    }
    return json({});
  });
  vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock as typeof fetch);
  return { generateLinkCalls, emails };
}

async function reset(email: string) {
  let status = 0;
  let body: unknown;
  const res = {
    setHeader() { return res; },
    status(s: number) { status = s; return res; },
    json(b: unknown) { body = b; return res; },
    end() { return res; },
  } as unknown as VercelResponse;
  const req = { method: "POST", headers: {}, body: { action: "reset", email } } as unknown as VercelRequest;
  await handler(req, res);
  return { status, body };
}

describe("send-welcome reset: exact email lookup", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("finds the real account even when a superstring account sorts ahead of it", async () => {
    const { generateLinkCalls, emails } = setup([
      { id: "1", email: "abob@example.com", app_metadata: { provider: "email", providers: ["email"] } },
      { id: "2", email: "bob@example.com", app_metadata: { provider: "email", providers: ["email"] } },
    ]);
    expect(await reset("Bob@Example.com")).toEqual({ status: 200, body: { ok: true } });
    expect(generateLinkCalls).toEqual([expect.objectContaining({ type: "recovery", email: "bob@example.com" })]);
    expect(emails.map((e) => e.subject)).toEqual(["Your password reset link"]);
  });

  it("treats a substring-only hit as no account (courtesy email, no recovery link)", async () => {
    const { generateLinkCalls, emails } = setup([{ id: "1", email: "abob2@example.com" }]);
    expect(await reset("bob2@example.com")).toEqual({ status: 200, body: { ok: true } });
    expect(generateLinkCalls).toHaveLength(0);
    expect(emails.map((e) => e.subject)).toEqual(["We couldn't find an account for this email"]);
  });

  it("sends OAuth-only accounts a sign-in-with-Google note instead of a reset link", async () => {
    const { generateLinkCalls, emails } = setup([
      { id: "1", email: "gina@example.com", app_metadata: { provider: "google", providers: ["google"] } },
    ]);
    expect(await reset("gina@example.com")).toEqual({ status: 200, body: { ok: true } });
    expect(generateLinkCalls).toHaveLength(0);
    expect(emails.map((e) => e.subject)).toEqual(["Your account signs in with Google"]);
    expect(emails[0].to).toEqual(["gina@example.com"]);
  });
});

const emailUser = (email: string) => [
  { id: "1", email, app_metadata: { provider: "email", providers: ["email"] } },
];

describe("send-welcome reset: failure signalling", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("returns 503 when Resend has a server error", async () => {
    setup(emailUser("f1@example.com"), { resend: 502 });
    expect((await reset("f1@example.com")).status).toBe(503);
  });

  it("returns 503 when generate_link has a server error", async () => {
    setup(emailUser("f2@example.com"), { generateLink: 500 });
    expect((await reset("f2@example.com")).status).toBe(503);
  });

  it("returns 503 when a request throws (network failure or timeout)", async () => {
    setup(emailUser("f3@example.com"), { resend: "throw" });
    expect((await reset("f3@example.com")).status).toBe(503);
  });

  it("keeps address-specific 4xx failures as a generic 200 so account existence can't leak", async () => {
    setup(emailUser("f4@example.com"), { resend: 422 });
    expect(await reset("f4@example.com")).toEqual({ status: 200, body: { ok: true } });
    setup(emailUser("f5@example.com"), { generateLink: 422 });
    expect(await reset("f5@example.com")).toEqual({ status: 200, body: { ok: true } });
  });

  it("returns 429 once the per-email daily limit is exceeded", async () => {
    setup(emailUser("limit@example.com"));
    for (let i = 0; i < 3; i++) expect((await reset("limit@example.com")).status).toBe(200);
    expect((await reset("limit@example.com")).status).toBe(429);
  });
});

describe("send-welcome reset: email copy", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("states the same 30-minute expiry as the reset page", async () => {
    const { emails } = setup(emailUser("copy@example.com"));
    await reset("copy@example.com");
    const html = JSON.stringify(emails[0]);
    expect(html).toContain("30 minutes");
    expect(html).not.toContain("60 minutes");
  });

  it("points Google-only accounts at the Google button on the login page", async () => {
    const { emails } = setup([
      { id: "1", email: "g2@example.com", app_metadata: { provider: "google", providers: ["google"] } },
    ]);
    await reset("g2@example.com");
    const html = JSON.stringify(emails[0]);
    expect(html).toContain("/login?method=google");
    expect(html).toContain("Continue with Google");
  });
});

describe("send-welcome reset: link robustness", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("wraps the long fallback link so it can't overflow narrow screens", async () => {
    const { emails } = setup(emailUser("wrap@example.com"));
    await reset("wrap@example.com");
    expect(JSON.stringify(emails[0])).toContain("word-break:break-all");
  });
});
