import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  signUnsubscribeToken,
  verifyUnsubscribeToken,
  buildUnsubscribeHeaders,
  marketingEmailParts,
  getSuppressedUserIds,
  isSuppressed,
  filterSuppressed,
  setEmailOptOut,
  type PreferenceDeps,
} from "../../server-handlers/_unsubscribe";
import { handleUnsubscribe } from "../../server-handlers/unsubscribe";

const SECRET = "test-secret-at-least-16-chars";
const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

function res(status: number, body: unknown = []): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function deps(fetchImpl: typeof fetch): PreferenceDeps {
  return { supabaseUrl: "https://db.test", serviceKey: "svc", fetchImpl };
}

beforeEach(() => {
  vi.stubEnv("UNSUBSCRIBE_SECRET", SECRET);
  vi.stubEnv("APP_URL", "https://hirestepx.com");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("unsubscribe tokens", () => {
  it("round-trips user and category", async () => {
    const t = await signUnsubscribeToken(U1, "marketing");
    expect(t).toBeTruthy();
    expect(await verifyUnsubscribeToken(t)).toEqual({ ok: true, userId: U1, category: "marketing" });
  });

  it("rejects a tampered signature, user id, or category", async () => {
    const t = (await signUnsubscribeToken(U1, "marketing"))!;
    const [, , sig] = t.split(".");
    expect(await verifyUnsubscribeToken(`${U2}.marketing.${sig}`)).toEqual({ ok: false, reason: "invalid" });
    expect(await verifyUnsubscribeToken(`${U1}.employer_notifications.${sig}`)).toEqual({ ok: false, reason: "invalid" });
    expect(await verifyUnsubscribeToken(`${U1}.marketing.${sig.slice(0, -2)}AA`)).toMatchObject({ ok: false });
  });

  it("rejects tokens signed with a different secret", async () => {
    const t = await signUnsubscribeToken(U1, "marketing", "another-secret-16-chars-x");
    expect(await verifyUnsubscribeToken(t)).toEqual({ ok: false, reason: "invalid" });
  });

  it("flags malformed input", async () => {
    for (const bad of [null, "", "abc", "a.b", `${U1}.bogus.AAAA`, `not-a-uuid.marketing.AAAA`, "x".repeat(300)]) {
      expect(await verifyUnsubscribeToken(bad)).toEqual({ ok: false, reason: "malformed" });
    }
  });

  it("fails closed with no (or a too-short) secret", async () => {
    vi.stubEnv("UNSUBSCRIBE_SECRET", "short");
    expect(await signUnsubscribeToken(U1, "marketing")).toBeNull();
    expect(await verifyUnsubscribeToken(`${U1}.marketing.AAAA`)).toEqual({ ok: false, reason: "unconfigured" });
  });
});

describe("headers and email parts", () => {
  it("builds RFC 8058 headers", () => {
    const h = buildUnsubscribeHeaders("https://hirestepx.com/api/unsubscribe?t=x");
    expect(h["List-Unsubscribe"]).toMatch(/^<https:\/\/hirestepx\.com\/api\/unsubscribe\?t=x>, <mailto:/);
    expect(h["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("marketingEmailParts carries a signed link, headers and reply_to", async () => {
    const p = await marketingEmailParts(U1, "marketing");
    expect(p.footer.marketing).toBe(true);
    expect(p.footer.unsubUrl).toContain("/api/unsubscribe?t=");
    expect(p.resend.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(p.resend.reply_to).toBe("hello@hirestepx.com");
  });

  it("degrades to a settings link, with no one-click header, when unconfigured", async () => {
    vi.stubEnv("UNSUBSCRIBE_SECRET", "");
    const p = await marketingEmailParts(U1, "marketing");
    expect(p.footer.unsubUrl).toBeUndefined();
    expect(p.footer.manageUrl).toBe("https://hirestepx.com/settings");
    expect(p.resend.headers).toEqual({});
    expect(p.resend.reply_to).toBe("hello@hirestepx.com");
  });
});

describe("suppression lookup", () => {
  it("returns the opted-out ids", async () => {
    const f = vi.fn(async () => res(200, [{ user_id: U1 }])) as unknown as typeof fetch;
    const out = await getSuppressedUserIds(deps(f), [U1, U2], "marketing");
    expect([...out]).toEqual([U1]);
    const url = String((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(url).toContain("marketing_opt_out=eq.true");
  });

  it("treats a missing table/column as not suppressed", async () => {
    for (const code of ["PGRST205", "42P01", "42703", "PGRST204"]) {
      const f = vi.fn(async () => res(404, { code })) as unknown as typeof fetch;
      expect((await getSuppressedUserIds(deps(f), [U1], "marketing")).size).toBe(0);
    }
  });

  it("fails closed on a server error or network failure", async () => {
    const f500 = vi.fn(async () => res(500, { message: "boom" })) as unknown as typeof fetch;
    expect(await isSuppressed(deps(f500), U1, "marketing")).toBe(true);
    const fThrow = vi.fn(async () => { throw new Error("net"); }) as unknown as typeof fetch;
    expect(await isSuppressed(deps(fThrow), U1, "employer_notifications")).toBe(true);
  });

  it("filterSuppressed drops opted-out rows and keeps order", async () => {
    const f = vi.fn(async () => res(200, [{ user_id: U2 }])) as unknown as typeof fetch;
    const rows = [{ id: U1 }, { id: U2 }];
    expect(await filterSuppressed(deps(f), rows, "marketing")).toEqual([{ id: U1 }]);
  });

  it("does not call the database for an empty list", async () => {
    const f = vi.fn() as unknown as typeof fetch;
    expect((await getSuppressedUserIds(deps(f), [], "marketing")).size).toBe(0);
    expect(f).not.toHaveBeenCalled();
  });

  it("setEmailOptOut reports failure (including migration not applied)", async () => {
    expect(await setEmailOptOut(deps(vi.fn(async () => res(201, null)) as unknown as typeof fetch), U1, "marketing", true)).toBe(true);
    expect(await setEmailOptOut(deps(vi.fn(async () => res(404, { code: "PGRST205" })) as unknown as typeof fetch), U1, "marketing", true)).toBe(false);
  });
});

describe("handleUnsubscribe", () => {
  const notLimited = async () => false;

  async function post(token: string | null, body = "List-Unsubscribe=One-Click", fetchImpl?: typeof fetch, limited = notLimited) {
    const url = `https://hirestepx.com/api/unsubscribe${token ? `?t=${encodeURIComponent(token)}` : ""}`;
    return handleUnsubscribe(new Request(url, { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } }), {
      prefs: deps(fetchImpl ?? (vi.fn(async () => res(201, null)) as unknown as typeof fetch)),
      rateLimited: limited,
    });
  }

  it("GET redirects to the confirmation page and never writes", async () => {
    const f = vi.fn() as unknown as typeof fetch;
    const r = await handleUnsubscribe(new Request("https://hirestepx.com/api/unsubscribe?t=abc"), { prefs: deps(f), rateLimited: notLimited });
    expect(r.status).toBe(302);
    expect(r.headers.get("Location")).toBe("https://hirestepx.com/unsubscribe?t=abc");
    expect(f).not.toHaveBeenCalled();
  });

  it("POST with a valid token opts the user out", async () => {
    const t = (await signUnsubscribeToken(U1, "marketing"))!;
    const f = vi.fn(async () => res(201, null)) as unknown as typeof fetch;
    const r = await post(t, undefined, f);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, category: "marketing", optedOut: true });
    const init = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({ user_id: U1, marketing_opt_out: true });
  });

  it("is idempotent", async () => {
    const t = (await signUnsubscribeToken(U1, "marketing"))!;
    expect((await post(t)).status).toBe(200);
    expect((await post(t)).status).toBe(200);
  });

  it("action=resubscribe reverses the opt-out", async () => {
    const t = (await signUnsubscribeToken(U1, "employer_notifications"))!;
    const f = vi.fn(async () => res(201, null)) as unknown as typeof fetch;
    const r = await post(t, "action=resubscribe", f);
    expect(await r.json()).toMatchObject({ optedOut: false });
    const init = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({ employer_notifications_opt_out: false });
  });

  it("returns 400 for a malformed token and 403 for a forged one", async () => {
    expect((await post("garbage")).status).toBe(400);
    expect((await post(null)).status).toBe(400);
    const t = (await signUnsubscribeToken(U1, "marketing"))!;
    expect((await post(`${U2}.marketing.${t.split(".")[2]}`)).status).toBe(403);
  });

  it("returns 503 (not a false success) when the preference cannot be saved", async () => {
    const t = (await signUnsubscribeToken(U1, "marketing"))!;
    const r = await post(t, undefined, vi.fn(async () => res(404, { code: "PGRST205" })) as unknown as typeof fetch);
    expect(r.status).toBe(503);
  });

  it("returns 503 when no secret is configured", async () => {
    vi.stubEnv("UNSUBSCRIBE_SECRET", "");
    expect((await post(`${U1}.marketing.AAAA`)).status).toBe(503);
  });

  it("returns 429 when rate limited, 405 for other methods", async () => {
    expect((await post("x", undefined, undefined, async () => true)).status).toBe(429);
    const r = await handleUnsubscribe(new Request("https://hirestepx.com/api/unsubscribe", { method: "DELETE" }), { rateLimited: notLimited });
    expect(r.status).toBe(405);
  });
});
