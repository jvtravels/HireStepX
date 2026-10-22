import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

vi.hoisted(() => {
  process.env.SUPABASE_URL = "https://s.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
  process.env.RESEND_API_KEY = "re_key";
  process.env.APP_URL = "https://app.test";
});

import handler from "../../server-handlers/send-welcome";

async function post(body: Record<string, unknown>, origin?: string) {
  let status = 0;
  let payload: unknown;
  const res = {
    setHeader() { return res; },
    status(s: number) { status = s; return res; },
    json(b: unknown) { payload = b; return res; },
    end() { return res; },
  } as unknown as VercelResponse;
  const req = { method: "POST", headers: origin ? { origin } : {}, body } as unknown as VercelRequest;
  await handler(req, res);
  return { status, payload };
}

describe("send-welcome no longer mails or un-verifies on request", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}", { status: 200 }));
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(["resend", "verify", "verify-reminder", undefined])("rejects action %s with no outbound calls", async (action) => {
    const { status, payload } = await post({ action, email: "victim@example.com", userId: "11111111-1111-1111-1111-111111111111" });
    expect(status).toBe(400);
    expect(payload).toEqual({ error: "Unknown action" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
