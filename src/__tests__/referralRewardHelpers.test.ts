import { describe, it, expect, vi } from "vitest";
import {
  normalizeReferralCode,
  claimReferralReward,
  countRecentReferralRewards,
  grantReferralReward,
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

describe("grantReferralReward", () => {
  const input = {
    baseUrl: BASE,
    serviceKey: KEY,
    referralId: "r1",
    referrerId: "u-referrer",
    referredId: "u-referred",
    nowIso: "2026-01-01T00:00:00Z",
    sinceIso: "2025-12-31T00:00:00Z",
  };

  it("does not grant or claim when the referrer is over the daily cap", async () => {
    const capRows = Array.from({ length: REFERRAL_REWARD_DAILY_CAP }, (_, i) => ({ id: String(i) }));
    const patch = vi.fn();
    const f = router([
      { match: (u) => u.includes("reward_granted_at=gte"), reply: () => res(capRows) },
      { match: (_u, i) => i?.method === "PATCH", reply: () => { patch(); return res([{ id: "r1" }]); } },
    ]);
    const out = await grantReferralReward(input, f);
    expect(out.granted).toBe(false);
    expect(out.reason).toBe("capped");
    expect(patch).not.toHaveBeenCalled();
  });

  it("returns already_claimed when the CAS finds no row", async () => {
    const f = router([
      { match: (u) => u.includes("reward_granted_at=gte"), reply: () => res([]) },
      { match: (_u, i) => i?.method === "PATCH", reply: () => res([]) }, // claim loses
    ]);
    const out = await grantReferralReward(input, f);
    expect(out.granted).toBe(false);
    expect(out.reason).toBe("already_claimed");
  });

  it("claims and credits BOTH sides exactly once on success", async () => {
    const credited: string[] = [];
    const f = router([
      { match: (u) => u.includes("reward_granted_at=gte"), reply: () => res([]) }, // cap: 0
      { match: (u, i) => u.includes("/referrals") && i?.method === "PATCH", reply: () => res([{ id: "r1" }]) }, // claim wins
      // RPC not yet deployed in test env — return 404 so grantSessionCredits falls back to the
      // non-atomic upsert path. Supabase returns 404 for missing functions, not a network throw.
      { match: (u) => u.includes("/rpc/"), reply: () => ({ ok: false, status: 404, json: async () => ({}) } as unknown as Response) },
      { match: (u, i) => u.includes("/session_credits") && (!i || i.method === undefined || i.method === "GET"), reply: () => res([{ balance: 0 }]) }, // balance read
      {
        match: (u, i) => u.includes("/session_credits") && i?.method === "POST",
        reply: () => { credited.push("grant"); return res(null); },
      },
    ]);
    const out = await grantReferralReward(input, f);
    expect(out.granted).toBe(true);
    expect(out.reason).toBe("ok");
    expect(out.referrerCredited).toBe(true);
    expect(out.referredCredited).toBe(true);
    // One credit grant POST per side.
    expect(credited.length).toBe(2);
    expect(REFERRAL_REWARD_CREDITS).toBe(1);
  });
});
