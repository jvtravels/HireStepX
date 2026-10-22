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

function setup(users: unknown[]) {
  const generateLinkCalls: unknown[] = [];
  const emails: Sent[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/auth/v1/admin/users")) return json({ users });
    if (url.includes("/auth/v1/admin/generate_link")) {
      generateLinkCalls.push(JSON.parse(String(init?.body)));
      return json({ action_link: "https://s.test/auth/v1/verify?token=abc&type=recovery" });
    }
    if (url.includes("api.resend.com")) {
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
    expect(emails.map((e) => e.subject)).toEqual(["Reset link, as requested"]);
  });

  it("treats a substring-only hit as no account (courtesy email, no recovery link)", async () => {
    const { generateLinkCalls, emails } = setup([{ id: "1", email: "abob2@example.com" }]);
    expect(await reset("bob2@example.com")).toEqual({ status: 200, body: { ok: true } });
    expect(generateLinkCalls).toHaveLength(0);
    expect(emails.map((e) => e.subject)).toEqual(["We couldn't find your account"]);
  });

  it("sends OAuth-only accounts a sign-in-with-Google note instead of a reset link", async () => {
    const { generateLinkCalls, emails } = setup([
      { id: "1", email: "gina@example.com", app_metadata: { provider: "google", providers: ["google"] } },
    ]);
    expect(await reset("gina@example.com")).toEqual({ status: 200, body: { ok: true } });
    expect(generateLinkCalls).toHaveLength(0);
    expect(emails.map((e) => e.subject)).toEqual(["Sign in with Google"]);
    expect(emails[0].to).toEqual(["gina@example.com"]);
  });
});
