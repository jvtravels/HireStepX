import { describe, it, expect, vi } from "vitest";
import {
  normalizeReferralCode,
  claimReferralReward,
  countRecentReferralRewards,
  isNewAccount,
  maskEmail,
  countReferralsCreatedSince,
  countReferralPayouts,
  payReferrerForReferral,
  REFERRAL_REWARD_LIFETIME_CAP,
  REFERRAL_NEW_ACCOUNT_WINDOW_MS,
  REFERRAL_REWARD_DAILY_CAP,
  REFERRAL_REWARD_CREDITS,
} from "../../server-handlers/_referral-reward-helpers";

const BASE = "https://db.example.co";
const KEY = "service-key";

/** Minimal Response-like stub: the helpers only touch .ok and .json(). */
function res(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => body } as unknown as Response;
}

/** Route a mocked fetch by (url, method) → response. */
function router(routes: Array<{ match: (url: string, init?: RequestInit) => boolean; reply: () => Response }>) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const hit = routes.find((r) => r.match(String(url), init));
    if (!hit) throw new Error(`unrouted fetch: ${url}`);
    return hit.reply();
  }) as unknown as typeof fetch;
}

describe("normalizeReferralCode", () => {
  it("accepts and upper-cases a valid code", () => {
    expect(normalizeReferralCode("hsx-abc123")).toBe("HSX-ABC123");
    expect(normalizeReferralCode("  HSX-ZZZZ  ")).toBe("HSX-ZZZZ");
  });
  it("rejects malformed or non-string input", () => {
    expect(normalizeReferralCode("ABC123")).toBeNull();
    expect(normalizeReferralCode("HSX-")).toBeNull();
    expect(normalizeReferralCode("HSX-TOOLONGCODE")).toBeNull();
    expect(normalizeReferralCode(null)).toBeNull();
    expect(normalizeReferralCode(42)).toBeNull();
  });
});

describe("claimReferralReward (compare-and-swap)", () => {
  it("returns true when exactly one row is flipped", async () => {
    const f = router([{ match: (u, i) => u.includes("/referrals") && i?.method === "PATCH", reply: () => res([{ id: "r1" }]) }]);
    expect(await claimReferralReward(BASE, KEY, "r1", "2026-01-01T00:00:00Z", f)).toBe(true);
  });
  it("returns false when no row matched (already claimed)", async () => {
    const f = router([{ match: (u, i) => i?.method === "PATCH", reply: () => res([]) }]);
    expect(await claimReferralReward(BASE, KEY, "r1", "2026-01-01T00:00:00Z", f)).toBe(false);
  });
  it("returns false on a non-ok write", async () => {
    const f = router([{ match: () => true, reply: () => res(null, false) }]);
    expect(await claimReferralReward(BASE, KEY, "r1", "2026-01-01T00:00:00Z", f)).toBe(false);
  });
});

describe("countRecentReferralRewards", () => {
  it("counts returned rows", async () => {
    const f = router([{ match: (u) => u.includes("/referrals"), reply: () => res([{ id: "a" }, { id: "b" }]) }]);
    expect(await countRecentReferralRewards(BASE, KEY, "ref", "2026-01-01T00:00:00Z", f)).toBe(2);
  });
  it("fails open to 0 on a read error", async () => {
    const f = router([{ match: () => true, reply: () => res(null, false) }]);
    expect(await countRecentReferralRewards(BASE, KEY, "ref", "2026-01-01T00:00:00Z", f)).toBe(0);
  });
});

describe("isNewAccount", () => {
  const now = Date.parse("2026-03-10T00:00:00Z");
  it("accepts accounts inside the window", () => {
    expect(isNewAccount("2026-03-09T00:00:00Z", now)).toBe(true);
    expect(isNewAccount(new Date(now - REFERRAL_NEW_ACCOUNT_WINDOW_MS).toISOString(), now)).toBe(true);
  });
  it("rejects old accounts", () => {
    expect(isNewAccount("2026-01-01T00:00:00Z", now)).toBe(false);
  });
  it("fails closed on missing or invalid timestamps", () => {
    expect(isNewAccount(null, now)).toBe(false);
    expect(isNewAccount("garbage", now)).toBe(false);
  });
});

describe("maskEmail", () => {
  it("keeps the first letter and the domain", () => {
    expect(maskEmail("priya.sharma@gmail.com")).toBe("p***@gmail.com");
  });
  it("returns empty for missing or malformed input", () => {
    expect(maskEmail(null)).toBe("");
    expect(maskEmail("@x.com")).toBe("");
    expect(maskEmail("nope")).toBe("");
  });
});

describe("referral counters", () => {
  it("countReferralsCreatedSince counts rows", async () => {
    const f = router([{ match: (u) => u.includes("created_at=gte"), reply: () => res([{ id: "1" }, { id: "2" }, { id: "3" }]) }]);
    expect(await countReferralsCreatedSince(BASE, KEY, "ref", "2026-01-01T00:00:00Z", f)).toBe(3);
  });
  it("countReferralPayouts counts paid rows", async () => {
    const f = router([{ match: (u) => u.includes("reward_granted_at=not.is.null"), reply: () => res([{ id: "1" }]) }]);
    expect(await countReferralPayouts(BASE, KEY, "ref", f)).toBe(1);
  });
});

describe("payReferrerForReferral", () => {
  const input = {
    baseUrl: BASE,
    serviceKey: KEY,
    referredId: "u-referred",
    nowIso: "2026-01-01T00:00:00Z",
    sinceIso: "2025-12-31T00:00:00Z",
  };
  const pendingRow = { match: (u: string) => u.includes("referred_id=eq.u-referred") && u.includes("reward_granted_at=is.null"), reply: () => res([{ id: "r1", referrer_id: "u-referrer" }]) };
  const dailyCount = (rows: unknown[]) => ({ match: (u: string) => u.includes("reward_granted_at=gte"), reply: () => res(rows) });
  const lifetimeCount = (rows: unknown[]) => ({ match: (u: string) => u.includes("reward_granted_at=not.is.null"), reply: () => res(rows) });
  const claim = (rows: unknown[], onCall?: () => void) => ({
    match: (u: string, i?: RequestInit) => u.includes("/referrals?id=eq.r1") && i?.method === "PATCH" && !u.includes("reward_granted_at=eq."),
    reply: () => { onCall?.(); return res(rows); },
  });
  const rpcOk = { match: (u: string) => u.includes("/rpc/"), reply: () => res(5) };
  const rpcFail = { match: (u: string) => u.includes("/rpc/"), reply: () => res(null, false) };
  const release = (onCall: () => void) => ({
    match: (u: string, i?: RequestInit) => u.includes("reward_granted_at=eq.") && i?.method === "PATCH",
    reply: () => { onCall(); return res(null); },
  });
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i) }));

  it("returns no_pending when the referred user has no unpaid referral", async () => {
    const f = router([{ match: (u) => u.includes("referred_id=eq."), reply: () => res([]) }]);
    expect((await payReferrerForReferral(input, f)).reason).toBe("no_pending");
  });

  it("returns error when the lookup fails", async () => {
    const f = router([{ match: () => true, reply: () => res(null, false) }]);
    expect((await payReferrerForReferral(input, f)).reason).toBe("error");
  });

  it("does not claim when over the daily cap", async () => {
    const patch = vi.fn();
    const f = router([pendingRow, dailyCount(rows(REFERRAL_REWARD_DAILY_CAP)), lifetimeCount([]), claim([{ id: "r1" }], patch)]);
    const out = await payReferrerForReferral(input, f);
    expect(out.reason).toBe("capped");
    expect(patch).not.toHaveBeenCalled();
  });

  it("does not claim when over the lifetime cap", async () => {
    const patch = vi.fn();
    const f = router([pendingRow, dailyCount([]), lifetimeCount(rows(REFERRAL_REWARD_LIFETIME_CAP)), claim([{ id: "r1" }], patch)]);
    const out = await payReferrerForReferral(input, f);
    expect(out.reason).toBe("capped");
    expect(patch).not.toHaveBeenCalled();
  });

  it("returns already_claimed when the CAS loses", async () => {
    const f = router([pendingRow, dailyCount([]), lifetimeCount([]), claim([])]);
    expect((await payReferrerForReferral(input, f)).reason).toBe("already_claimed");
  });

  it("releases the claim when the credit write fails so a retry can pay", async () => {
    const released = vi.fn();
    const f = router([pendingRow, dailyCount([]), lifetimeCount([]), claim([{ id: "r1" }]), rpcFail, release(released)]);
    const out = await payReferrerForReferral(input, f);
    expect(out.paid).toBe(false);
    expect(out.reason).toBe("credit_failed");
    expect(released).toHaveBeenCalledTimes(1);
  });

  it("claims once and credits the referrer on success", async () => {
    const claimed = vi.fn();
    const f = router([pendingRow, dailyCount([]), lifetimeCount([]), claim([{ id: "r1" }], claimed), rpcOk]);
    const out = await payReferrerForReferral(input, f);
    expect(out).toEqual({ paid: true, reason: "paid", referrerId: "u-referrer" });
    expect(claimed).toHaveBeenCalledTimes(1);
    expect(REFERRAL_REWARD_CREDITS).toBe(1);
  });
});
