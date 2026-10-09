import { describe, it, expect, vi } from "vitest";
import { applyReferralCode } from "../../server-handlers/_referral-apply";
import { REFERRAL_REWARD_DAILY_CAP } from "../../server-handlers/_referral-reward-helpers";

const BASE = "https://db.example.co";
const NOW = Date.parse("2026-03-10T00:00:00Z");
const input = { baseUrl: BASE, serviceKey: "k", userId: "u-new", code: "HSX-ABC123", nowMs: NOW };

function res(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => body } as unknown as Response;
}

interface World {
  referrer?: unknown[];
  self?: unknown[];
  createdToday?: number;
  insertOk?: boolean;
  claimRows?: unknown[];
  creditOk?: boolean;
}

function world(w: World) {
  const calls: string[] = [];
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    const m = init?.method ?? "GET";
    if (u.includes("profiles?referral_code=")) { calls.push("lookup"); return res(w.referrer ?? [{ id: "u-ref" }]); }
    if (u.includes("profiles?id=eq.u-new&select=")) { calls.push("self"); return res(w.self ?? [{ referred_by: null, email: "a@b.com", name: "A", created_at: "2026-03-09T00:00:00Z" }]); }
    if (u.includes("referrals?referrer_id=")) { calls.push("count"); return res(Array.from({ length: w.createdToday ?? 0 }, (_, i) => ({ id: String(i) }))); }
    if (u.includes("/referrals") && m === "POST") { calls.push("insert"); return res(null, w.insertOk ?? true); }
    if (u.includes("referrals?referred_id=")) { calls.push("existing"); return res([]); }
    if (u.includes("profiles?id=eq.u-new&referred_by=is.null")) { calls.push("claim"); return res(w.claimRows ?? [{ id: "u-new" }]); }
    if (u.includes("profiles?id=eq.u-new&referred_by=eq.")) { calls.push("rollback"); return res(null); }
    if (u.includes("/rpc/")) { calls.push("credit"); return res(w.creditOk === false ? null : 1, w.creditOk !== false); }
    throw new Error(`unrouted ${m} ${u}`);
  }) as unknown as typeof fetch;
  return { f, calls };
}

describe("applyReferralCode", () => {
  it("404s on an unknown code", async () => {
    const { f } = world({ referrer: [] });
    expect(await applyReferralCode(input, f)).toMatchObject({ ok: false, status: 404 });
  });

  it("rejects the user's own code", async () => {
    const { f } = world({ referrer: [{ id: "u-new" }] });
    expect(await applyReferralCode(input, f)).toMatchObject({ ok: false, status: 400 });
  });

  it("503s when the profile row isn't there yet", async () => {
    const { f } = world({ self: [] });
    expect(await applyReferralCode(input, f)).toMatchObject({ ok: false, status: 503 });
  });

  it("rejects established accounts", async () => {
    const { f, calls } = world({ self: [{ referred_by: null, email: "a@b.com", name: "A", created_at: "2026-01-01T00:00:00Z" }] });
    expect(await applyReferralCode(input, f)).toMatchObject({ ok: false, status: 403 });
    expect(calls).not.toContain("insert");
    expect(calls).not.toContain("credit");
  });

  it("is idempotent when already referred", async () => {
    const { f, calls } = world({ self: [{ referred_by: "HSX-OTHER", email: "a@b.com", name: "A", created_at: "2026-03-09T00:00:00Z" }] });
    expect(await applyReferralCode(input, f)).toEqual({ ok: true, alreadyReferred: true });
    expect(calls).not.toContain("credit");
  });

  it("creates the referral row BEFORE claiming referred_by, then credits", async () => {
    const { f, calls } = world({});
    const out = await applyReferralCode(input, f);
    expect(out).toMatchObject({ ok: true, alreadyReferred: false, rewarded: true, referrerId: "u-ref" });
    expect(calls.indexOf("insert")).toBeLessThan(calls.indexOf("claim"));
    expect(calls.indexOf("claim")).toBeLessThan(calls.indexOf("credit"));
  });

  it("fails without claiming when the row can't be recorded", async () => {
    const { f, calls } = world({ insertOk: false });
    expect(await applyReferralCode(input, f)).toMatchObject({ ok: false, status: 500 });
    expect(calls).not.toContain("claim");
  });

  it("does not credit when it loses the referred_by race", async () => {
    const { f, calls } = world({ claimRows: [] });
    expect(await applyReferralCode(input, f)).toEqual({ ok: true, alreadyReferred: true });
    expect(calls).not.toContain("credit");
  });

  it("records the referral but grants no credit when the referrer is over the daily cap", async () => {
    const { f, calls } = world({ createdToday: REFERRAL_REWARD_DAILY_CAP });
    expect(await applyReferralCode(input, f)).toMatchObject({ ok: true, rewarded: false, reason: "capped" });
    expect(calls).toContain("insert");
    expect(calls).not.toContain("credit");
  });

  it("rolls referred_by back and 502s when the credit write fails", async () => {
    const { f, calls } = world({ creditOk: false });
    expect(await applyReferralCode(input, f)).toMatchObject({ ok: false, status: 502 });
    expect(calls).toContain("rollback");
  });
});
