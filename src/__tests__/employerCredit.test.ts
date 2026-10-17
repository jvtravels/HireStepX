import { describe, it, expect, vi } from "vitest";

vi.mock("../../server-handlers/_shared", () => ({ slog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("../../server-handlers/_notify", () => ({ notify: vi.fn() }));

const { creditShare, isRefundableStatus, creditBalance, spendCredit, releaseCredit, creditRefundForMatches, returnCreditForUnavailable } = await import("../../server-handlers/_employer-credit");
const { sweepUnreachableCredits } = await import("../../server-handlers/_employer-credit-sweep");
const { creditToApply, MIN_CHARGE_PAISE } = await import("../../server-handlers/_unlock-pricing");

const BASE = "https://example.supabase.co";
const H = { apikey: "k" };
const ok = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body, text: async () => "" });

describe("pure credit rules", () => {
  it("creditShare splits everything paid equally across the order's candidates", () => {
    expect(creditShare(29_900, 0, 10)).toBe(2_990);
    expect(creditShare(5_900, 0, 1)).toBe(5_900);
    expect(creditShare(3_900, 2_000, 1)).toBe(5_900);
    expect(creditShare(100, 0, 3)).toBe(33);
    expect(creditShare(0, 0, 1)).toBe(0);
    expect(creditShare(5_900, 0, 0)).toBe(0);
  });

  it("only candidates the employer is still waiting on are refundable", () => {
    expect(isRefundableStatus("shortlisted")).toBe(true);
    expect(isRefundableStatus("interview_invited")).toBe(true);
    expect(isRefundableStatus(null)).toBe(true);
    for (const s of ["interviewing", "hired", "rejected", "offer"]) expect(isRefundableStatus(s)).toBe(false);
  });

  it("creditToApply covers the whole price or leaves a chargeable cash remainder", () => {
    expect(creditToApply(5_900, 0)).toBe(0);
    expect(creditToApply(5_900, 10_000)).toBe(5_900);
    expect(creditToApply(5_900, 2_000)).toBe(2_000);
    expect(creditToApply(5_900, 5_850)).toBe(5_900 - MIN_CHARGE_PAISE);
    expect(creditToApply(0, 5_000)).toBe(0);
  });
});

describe("ledger i/o", () => {
  it("creditBalance sums signed rows and is null when the read fails", async () => {
    expect(await creditBalance(BASE, H, "e1", vi.fn().mockResolvedValue(ok([{ amount: 5_000 }, { amount: -2_000 }])) as never)).toBe(3_000);
    expect(await creditBalance(BASE, H, "e1", vi.fn().mockResolvedValue(ok({}, 404)) as never)).toBeNull();
  });

  it("spendCredit returns what the RPC spent and 0 on failure or insufficient balance", async () => {
    expect(await spendCredit(BASE, H, "e1", 2_000, "order_1", vi.fn().mockResolvedValue(ok(2_000)) as never)).toBe(2_000);
    expect(await spendCredit(BASE, H, "e1", 2_000, "order_1", vi.fn().mockResolvedValue(ok(0)) as never)).toBe(0);
    expect(await spendCredit(BASE, H, "e1", 2_000, "order_1", vi.fn().mockResolvedValue(ok({}, 500)) as never)).toBe(0);
    expect(await spendCredit(BASE, H, "e1", 0, "order_1", vi.fn() as never)).toBe(0);
  });

  it("releaseCredit returns the net spent amount once and does nothing when none was spent", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(ok([{ amount: -2_000, order_ref: "order_1" }]))
      .mockResolvedValueOnce(ok(null, 201));
    await releaseCredit(BASE, H, "e1", "order_1", f as never);
    expect(f).toHaveBeenCalledTimes(2);
    expect(JSON.parse((f.mock.calls[1][1] as { body: string }).body)).toMatchObject({ kind: "release", amount: 2_000, order_ref: "order_1" });

    const none = vi.fn().mockResolvedValueOnce(ok([]));
    await releaseCredit(BASE, H, "e1", "order_1", none as never);
    expect(none).toHaveBeenCalledTimes(1);
  });
});

describe("creditRefundForMatches", () => {
  const order = { razorpay_order_id: "order_1", employer_id: "e1", amount: 29_900, match_ids: ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10"] };

  it("credits an equal share once per eligible match and notifies the employer", async () => {
    const notifyImpl = vi.fn();
    const f = vi.fn()
      .mockResolvedValueOnce(ok([{ id: "m1", candidate_status: "shortlisted" }, { id: "m2", candidate_status: "hired" }]))
      .mockResolvedValueOnce(ok([order]))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok(null, 201));
    const r = await creditRefundForMatches({ base: BASE, headers: H, matchIds: ["m1", "m2"], reason: "declined", fetchImpl: f as never, notifyImpl });
    expect(r.credited).toEqual([{ employerId: "e1", matchId: "m1", amountPaise: 2_990 }]);
    expect(JSON.parse((f.mock.calls[3][1] as { body: string }).body)).toMatchObject({ kind: "refund", reason: "declined", match_id: "m1", amount: 2_990 });
    expect(notifyImpl).toHaveBeenCalledWith(expect.objectContaining({ userId: "e1", type: "credit_refunded" }));
  });

  it("a duplicate (409) insert credits nothing and does not notify", async () => {
    const notifyImpl = vi.fn();
    const f = vi.fn()
      .mockResolvedValueOnce(ok([{ id: "m1", candidate_status: "interview_invited" }]))
      .mockResolvedValueOnce(ok([order]))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok(null, 409));
    const r = await creditRefundForMatches({ base: BASE, headers: H, matchIds: ["m1"], reason: "withdrew", fetchImpl: f as never, notifyImpl });
    expect(r.credited).toEqual([]);
    expect(notifyImpl).not.toHaveBeenCalled();
  });

  it("does nothing when no matched candidate is refundable", async () => {
    const f = vi.fn().mockResolvedValueOnce(ok([{ id: "m1", candidate_status: "rejected" }]));
    const r = await creditRefundForMatches({ base: BASE, headers: H, matchIds: ["m1"], reason: "blocked", fetchImpl: f as never });
    expect(r.credited).toEqual([]);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("credits cash and credit paid together when the order was part credit", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(ok([{ id: "m1", candidate_status: "shortlisted" }]))
      .mockResolvedValueOnce(ok([{ razorpay_order_id: "order_2", employer_id: "e1", amount: 3_900, match_ids: ["m1"] }]))
      .mockResolvedValueOnce(ok([{ amount: -2_000, order_ref: "order_2" }]))
      .mockResolvedValueOnce(ok(null, 201));
    const r = await creditRefundForMatches({ base: BASE, headers: H, matchIds: ["m1"], reason: "declined", fetchImpl: f as never, notifyImpl: vi.fn() });
    expect(r.credited[0].amountPaise).toBe(5_900);
  });
});

describe("returnCreditForUnavailable", () => {
  it("returns the credit share for each candidate that could not be unlocked", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(ok([{ amount: -5_900, order_ref: "order_1" }]))
      .mockResolvedValue(ok(null, 201));
    const n = await returnCreditForUnavailable({ base: BASE, headers: H, employerId: "e1", orderRef: "order_1", orderMatchCount: 1, failedMatchIds: ["m1"], fetchImpl: f as never });
    expect(n).toBe(5_900);
  });

  it("returns 0 when no credit was spent on the order", async () => {
    const f = vi.fn().mockResolvedValueOnce(ok([]));
    expect(await returnCreditForUnavailable({ base: BASE, headers: H, employerId: "e1", orderRef: "order_1", orderMatchCount: 1, failedMatchIds: ["m1"], fetchImpl: f as never })).toBe(0);
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe("sweepUnreachableCredits", () => {
  it("credits silent invites after 14 days but skips candidates who replied", async () => {
    const calls: string[] = [];
    const f = vi.fn(async (url: string) => {
      calls.push(url);
      if (url.includes("candidate_response=eq.declined")) return ok([]);
      if (url.includes("candidate_response=eq.none")) return ok([{ id: "silent" }, { id: "replied" }]);
      if (url.includes("/conversations?")) return ok([{ id: "c1", match_id: "replied" }]);
      if (url.includes("/conversation_messages?")) return ok([{ conversation_id: "c1" }]);
      if (url.includes("/requirement_matches?id=in.")) return ok([{ id: "silent", candidate_status: "interview_invited" }]);
      if (url.includes("/employer_unlock_orders?")) return ok([{ razorpay_order_id: "order_1", employer_id: "e1", amount: 5_900, match_ids: ["silent"] }]);
      if (url.includes("kind=in.(spend,release)")) return ok([]);
      return ok(null, 201);
    });
    const summary = await sweepUnreachableCredits({ base: BASE, headers: H, fetchImpl: f as never, notifyImpl: vi.fn(), now: () => new Date("2026-10-17T00:00:00Z") });
    expect(summary).toMatchObject({ noResponseScanned: 2, skippedReachable: 1, creditedMatches: 1, creditedPaise: 5_900 });
    const silentQuery = calls.find((u) => u.includes("candidate_response=eq.none"))!;
    expect(decodeURIComponent(silentQuery)).toContain("candidate_status_updated_at=lt.2026-10-03T00:00:00.000Z");
  });
});
