import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyCronAuth, constantTimeEqual } from "../../server-handlers/_cron-auth";

/* `x-vercel-cron: 1` is a plain header anyone can send, so it must never authenticate a cron.
   Every cron in vercel.json has to accept only `Authorization: Bearer ${CRON_SECRET}` and fail
   closed when the secret is unset. */

// Some crons check "is Supabase configured" before auth and read these at import time; give them values
// so the 401 under test is what comes back, not an unrelated 503.
process.env.SUPABASE_URL ||= "https://proj.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "svc-key";

const ORIGINAL_SECRET = process.env.CRON_SECRET;
afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_SECRET;
});

describe("verifyCronAuth", () => {
  it("fails closed when CRON_SECRET is unset or blank, even for an empty Bearer", () => {
    process.env.CRON_SECRET = "";
    expect(verifyCronAuth(new Request("https://x.test", { headers: { authorization: "Bearer " } }))).toBe(false);
    expect(verifyCronAuth(new Request("https://x.test"))).toBe(false);
    process.env.CRON_SECRET = "   ";
    expect(verifyCronAuth(new Request("https://x.test", { headers: { authorization: "Bearer " } }))).toBe(false);
  });

  it("accepts only the exact Bearer secret", () => {
    process.env.CRON_SECRET = "s3cret";
    const req = (h: Record<string, string>) => new Request("https://x.test", { headers: h });
    expect(verifyCronAuth(req({ authorization: "Bearer s3cret" }))).toBe(true);
    expect(verifyCronAuth(req({ authorization: "Bearer s3cre" }))).toBe(false);
    expect(verifyCronAuth(req({ authorization: "Bearer s3cret2" }))).toBe(false);
    expect(verifyCronAuth(req({ authorization: "s3cret" }))).toBe(false);
    expect(verifyCronAuth(req({ "x-vercel-cron": "1" }))).toBe(false);
    expect(verifyCronAuth(req({ "x-vercel-cron": "1", authorization: "Bearer nope" }))).toBe(false);
  });

  it("reads Node-style header bags (lowercased keys, string or array values)", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(verifyCronAuth({ headers: { authorization: "Bearer s3cret" } })).toBe(true);
    expect(verifyCronAuth({ headers: { authorization: ["Bearer s3cret"] } })).toBe(true);
    expect(verifyCronAuth({ headers: { "x-vercel-cron": "1" } })).toBe(false);
    expect(verifyCronAuth({ headers: {} })).toBe(false);
  });

  it("constantTimeEqual compares by value across different lengths", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
  });
});

/* ── Every cron in vercel.json ── */
const vercel = JSON.parse(readFileSync(resolve(__dirname, "../../vercel.json"), "utf8")) as { crons: Array<{ path: string; schedule: string }> };
type RouteMod = { GET?: (req: Request) => Promise<Response> };
const routes = import.meta.glob("../../app/api/**/route.ts") as Record<string, () => Promise<RouteMod>>;

describe.each(vercel.crons.map((c) => [c.path]))("cron %s", (path) => {
  const key = `../../app${path}/route.ts`;

  beforeEach(() => {
    global.fetch = vi.fn().mockRejectedValue(new Error("no outbound calls expected")) as unknown as typeof fetch;
  });

  const call = async (headers: Record<string, string>) => {
    const load = routes[key];
    expect(load, `no route file for ${path}`).toBeTypeOf("function");
    const mod = await load();
    expect(mod.GET, `${path} must export GET (Vercel crons are GET)`).toBeTypeOf("function");
    return mod.GET!(new Request(`https://x.test${path}`, { headers }));
  };

  it("rejects x-vercel-cron alone when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    expect((await call({ "x-vercel-cron": "1" })).status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects an empty Bearer when CRON_SECRET is unset", async () => {
    process.env.CRON_SECRET = "";
    expect((await call({ authorization: "Bearer " })).status).toBe(401);
  });

  it("rejects x-vercel-cron and a wrong secret even when CRON_SECRET is set", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await call({ "x-vercel-cron": "1" })).status).toBe(401);
    expect((await call({ "x-vercel-cron": "1", authorization: "Bearer wrong" })).status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
