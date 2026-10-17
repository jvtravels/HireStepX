import { describe, it, expect, vi } from "vitest";

vi.mock("../../server-handlers/_shared", () => ({ slog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("../../server-handlers/_notify", () => ({ notify: vi.fn() }));

const {
  creditShare, isRefundableStatus, creditBalance, spendCredit, spendCreditDetailed, releaseCredit, creditSpentOnOrders, creditRefundForMatches,
  returnCreditForUnavailable, clawbackOrderCredit, ensureCreditSpent, flagCreditAbuse, toCreditEvents,
} = await import("../../server-handlers/_employer-credit");
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

type Resp = ReturnType<typeof ok>;
type RouteFn = (url: string, method: string, body: Record<string, unknown> | null) => Resp | undefined;
/** URL-routed fetch fake: the first route that answers wins, unrouted reads are empty lists, unrouted writes succeed. */
function router(...routes: RouteFn[]) {
  const calls: Array<{ url: string; method: string; body: Record<string, unknown> | null }> = [];
  const f = vi.fn(async (input: string, init?: { method?: string; body?: string }) => {
    const url = String(input);
    const method = (init?.method || "GET").toUpperCase();
    const body = init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : null;
    calls.push({ url, method, body });
    for (const r of routes) {
      const hit = r(url, method, body);
      if (hit) return hit;
    }
    return method === "GET" ? ok([]) : ok(null, 201);
  });
  const ledgerPosts = () => calls.filter((c) => c.method === "POST" && c.url.includes("/employer_credit_ledger") && c.body);
  return { f, calls, ledgerPosts };
}
const matchesRoute = (rows: Array<{ id: string; candidate_status: string | null }>): RouteFn => (u) => (u.includes("/requirement_matches?id=in.") && u.includes("select=id,candidate_status") ? ok(rows) : undefined);
const ordersRoute = (rows: unknown[]): RouteFn => (u) => (u.includes("/employer_unlock_orders?status=in.") ? ok(rows) : undefined);
const spentRoute = (rows: Array<{ amount: number; order_ref: string }>): RouteFn => (u) => (u.includes("kind=in.(spend,release)") ? ok(rows) : undefined);
const ledgerPost = (status: number): RouteFn => (u, m) => (m === "POST" && u.includes("/employer_credit_ledger") ? ok(null, status) : undefined);
const relocks = (calls: Array<{ method: string; url: string; body: Record<string, unknown> | null }>) => calls.filter((c) => c.method === "PATCH" && c.url.includes("/requirement_matches"));

describe("creditRefundForMatches", () => {
  const order = { razorpay_order_id: "order_1", employer_id: "e1", amount: 29_900, match_ids: ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10"] };

  it("credits an equal share once per eligible match, relocks it and notifies the employer", async () => {
    const notifyImpl = vi.fn();
    const r0 = router(matchesRoute([{ id: "m1", candidate_status: "shortlisted" }, { id: "m2", candidate_status: "hired" }]), ordersRoute([order]));
    const r = await creditRefundForMatches({ base: BASE, headers: H, matchIds: ["m1", "m2"], reason: "declined", fetchImpl: r0.f as never, notifyImpl });
    expect(r.credited).toEqual([{ employerId: "e1", matchId: "m1", amountPaise: 2_990 }]);
    expect(r0.ledgerPosts()[0].body).toMatchObject({ kind: "refund", reason: "declined", match_id: "m1", amount: 2_990 });
    expect(notifyImpl).toHaveBeenCalledWith(expect.objectContaining({ userId: "e1", type: "credit_refunded" }));
    const lock = relocks(r0.calls);
    expect(lock).toHaveLength(1);
    expect(lock[0].url).toContain("id=in.(m1)");
    expect(lock[0].body).toMatchObject({ unlocked: false, unlocked_at: null });
  });

  it("a duplicate (409) for a refund on a different order credits nothing, does not relock or notify", async () => {
    const notifyImpl = vi.fn();
    const r0 = router(
      matchesRoute([{ id: "m1", candidate_status: "interview_invited" }]), ordersRoute([order]), ledgerPost(409),
      (u) => (u.includes("kind=eq.refund&select=order_ref") ? ok([{ order_ref: "order_OLD" }]) : undefined),
    );
    const r = await creditRefundForMatches({ base: BASE, headers: H, matchIds: ["m1"], reason: "withdrew", fetchImpl: r0.f as never, notifyImpl });
    expect(r.credited).toEqual([]);
    expect(notifyImpl).not.toHaveBeenCalled();
    expect(relocks(r0.calls)).toHaveLength(0);
  });

  it("a duplicate (409) for the same order finishes a relock a crash skipped, without re-crediting", async () => {
    const notifyImpl = vi.fn();
    const r0 = router(
      matchesRoute([{ id: "m1", candidate_status: "shortlisted" }]), ordersRoute([order]), ledgerPost(409),
      (u) => (u.includes("kind=eq.refund&select=order_ref") ? ok([{ order_ref: "order_1" }]) : undefined),
    );
    const r = await creditRefundForMatches({ base: BASE, headers: H, matchIds: ["m1"], reason: "withdrew", fetchImpl: r0.f as never, notifyImpl });
    expect(r.credited).toEqual([]);
    expect(notifyImpl).not.toHaveBeenCalled();
    expect(relocks(r0.calls)).toHaveLength(1);
  });

  it("does nothing when no matched candidate is refundable", async () => {
    const r0 = router(matchesRoute([{ id: "m1", candidate_status: "rejected" }]));
    const r = await creditRefundForMatches({ base: BASE, headers: H, matchIds: ["m1"], reason: "blocked", fetchImpl: r0.f as never });
    expect(r.credited).toEqual([]);
    expect(r0.ledgerPosts()).toHaveLength(0);
  });

  it("credits cash and credit paid together when the order was part credit", async () => {
    const r0 = router(
      matchesRoute([{ id: "m1", candidate_status: "shortlisted" }]),
      ordersRoute([{ razorpay_order_id: "order_2", employer_id: "e1", amount: 3_900, match_ids: ["m1"] }]),
      spentRoute([{ amount: -2_000, order_ref: "order_2" }]),
    );
    const r = await creditRefundForMatches({ base: BASE, headers: H, matchIds: ["m1"], reason: "declined", fetchImpl: r0.f as never, notifyImpl: vi.fn() });
    expect(r.credited[0].amountPaise).toBe(5_900);
  });

  it("skips a decline when the employer already messaged the candidate", async () => {
    const r0 = router(
      matchesRoute([{ id: "m1", candidate_status: "shortlisted" }]), ordersRoute([order]),
      (u) => (u.includes("/conversations?") ? ok([{ id: "c1", match_id: "m1" }]) : undefined),
      (u) => (u.includes("/conversation_messages?") ? ok([{ conversation_id: "c1" }]) : undefined),
    );
    const r = await creditRefundForMatches({ base: BASE, headers: H, matchIds: ["m1"], reason: "declined", fetchImpl: r0.f as never, notifyImpl: vi.fn() });
    expect(r.credited).toEqual([]);
    expect(r.skippedEmployerMessaged).toEqual(["m1"]);
    expect(r0.ledgerPosts()).toHaveLength(0);
    expect(relocks(r0.calls)).toHaveLength(0);
  });

  it("still credits a no-reply even when the employer messaged (they got no answer)", async () => {
    const r0 = router(
      matchesRoute([{ id: "m1", candidate_status: "interview_invited" }]), ordersRoute([order]),
      (u) => (u.includes("/conversations?") ? ok([{ id: "c1", match_id: "m1" }]) : undefined),
      (u) => (u.includes("/conversation_messages?") ? ok([{ conversation_id: "c1" }]) : undefined),
    );
    const r = await creditRefundForMatches({ base: BASE, headers: H, matchIds: ["m1"], reason: "no_response", fetchImpl: r0.f as never, notifyImpl: vi.fn() });
    expect(r.credited).toHaveLength(1);
  });

  it("an unreadable conversation lookup never withholds credit", async () => {
    const r0 = router(matchesRoute([{ id: "m1", candidate_status: "shortlisted" }]), ordersRoute([order]), (u) => (u.includes("/conversations?") ? ok({}, 500) : undefined));
    const r = await creditRefundForMatches({ base: BASE, headers: H, matchIds: ["m1"], reason: "declined", fetchImpl: r0.f as never, notifyImpl: vi.fn() });
    expect(r.credited).toHaveLength(1);
  });

  it("flags decline abuse (3+ refunds over 60% of paid spend) with a warning but still credits", async () => {
    const { slog } = await import("../../server-handlers/_shared");
    vi.mocked(slog.warn).mockClear();
    const r0 = router(
      matchesRoute([{ id: "m1", candidate_status: "shortlisted" }]), ordersRoute([order]),
      (u) => (u.includes("kind=eq.refund&created_at=gte.") ? ok([{ amount: 2_990 }, { amount: 2_990 }, { amount: 2_990 }]) : undefined),
      (u) => (u.includes("/employer_unlock_payments?") ? ok([{ amount: 10_000 }]) : undefined),
    );
    const r = await creditRefundForMatches({ base: BASE, headers: H, matchIds: ["m1"], reason: "declined", fetchImpl: r0.f as never, notifyImpl: vi.fn() });
    expect(r.credited).toHaveLength(1);
    expect(slog.warn).toHaveBeenCalledWith(expect.stringContaining("decline abuse"), expect.objectContaining({ code: "employer_credit_abuse_flag", employerId: "e1", refunds: 3 }));
  });
});

describe("flagCreditAbuse", () => {
  const run = (refunds: number[], paid: number[]) => {
    const r0 = router(
      (u) => (u.includes("kind=eq.refund") ? ok(refunds.map((amount) => ({ amount }))) : undefined),
      (u) => (u.includes("/employer_unlock_payments?") ? ok(paid.map((amount) => ({ amount }))) : undefined),
    );
    return flagCreditAbuse({ base: BASE, headers: H, employerId: "e1", fetchImpl: r0.f as never });
  };
  it("needs both 3+ refunds and refund credit above 60% of paid spend", async () => {
    expect(await run([3_000, 3_000, 3_000], [10_000])).toBe(true);
    expect(await run([3_000, 3_000], [1_000])).toBe(false);
    expect(await run([1_000, 1_000, 1_000], [100_000])).toBe(false);
    expect(await run([6_000, 6_000, 6_000], [30_000])).toBe(false);
  });
  it("never throws and reports false when a read fails", async () => {
    const f = vi.fn().mockRejectedValue(new Error("down"));
    expect(await flagCreditAbuse({ base: BASE, headers: H, employerId: "e1", fetchImpl: f as never })).toBe(false);
  });
});

describe("returnCreditForUnavailable", () => {
  it("returns the credit share for each candidate that could not be unlocked", async () => {
    const r0 = router(spentRoute([{ amount: -5_900, order_ref: "order_1" }]));
    const n = await returnCreditForUnavailable({ base: BASE, headers: H, employerId: "e1", orderRef: "order_1", orderMatchCount: 1, failedMatchIds: ["m1"], fetchImpl: r0.f as never });
    expect(n).toBe(5_900);
  });

  it("returns the cash share too, not just the credit that was spent", async () => {
    const r0 = router(spentRoute([{ amount: -1_000, order_ref: "order_1" }]));
    const n = await returnCreditForUnavailable({
      base: BASE, headers: H, employerId: "e1", orderRef: "order_1", orderMatchCount: 5, failedMatchIds: ["m1", "m2"], orderCashPaise: 4_000, fetchImpl: r0.f as never,
    });
    expect(n).toBe(2_000);
    expect(r0.ledgerPosts().map((c) => c.body)).toEqual([
      expect.objectContaining({ kind: "refund", reason: "unavailable", match_id: "m1", amount: 1_000 }),
      expect.objectContaining({ kind: "refund", reason: "unavailable", match_id: "m2", amount: 1_000 }),
    ]);
  });

  it("is idempotent: a duplicate refund row returns nothing", async () => {
    const r0 = router(ledgerPost(409));
    expect(await returnCreditForUnavailable({ base: BASE, headers: H, employerId: "e1", orderRef: "order_1", orderMatchCount: 1, failedMatchIds: ["m1"], orderCashPaise: 5_900, fetchImpl: r0.f as never })).toBe(0);
  });

  it("returns 0 when nothing was paid on the order", async () => {
    const r0 = router(spentRoute([]));
    expect(await returnCreditForUnavailable({ base: BASE, headers: H, employerId: "e1", orderRef: "order_1", orderMatchCount: 1, failedMatchIds: ["m1"], fetchImpl: r0.f as never })).toBe(0);
    expect(r0.ledgerPosts()).toHaveLength(0);
  });
});

describe("spendCreditDetailed", () => {
  it("distinguishes spent, insufficient and error", async () => {
    expect(await spendCreditDetailed(BASE, H, "e1", 2_000, "o", vi.fn().mockResolvedValue(ok(2_000)) as never)).toEqual({ spent: 2_000, outcome: "spent" });
    expect(await spendCreditDetailed(BASE, H, "e1", 2_000, "o", vi.fn().mockResolvedValue(ok(0)) as never)).toEqual({ spent: 0, outcome: "insufficient" });
    const r0 = router((u) => (u.includes("/rpc/spend_employer_credit") ? ok({}, 500) : undefined));
    expect(await spendCreditDetailed(BASE, H, "e1", 2_000, "o", r0.f as never)).toEqual({ spent: 0, outcome: "error" });
  });

  it("re-reads the ledger when the RPC response is lost, trusting a spend row that committed", async () => {
    const r0 = router(
      (u) => (u.includes("/rpc/spend_employer_credit") ? ok({}, 502) : undefined),
      spentRoute([{ amount: -2_000, order_ref: "o" }]),
    );
    expect(await spendCreditDetailed(BASE, H, "e1", 2_000, "o", r0.f as never)).toEqual({ spent: 2_000, outcome: "spent" });
  });

  it("re-reads the ledger after a thrown fetch too", async () => {
    const f = vi.fn()
      .mockRejectedValueOnce(new Error("socket"))
      .mockResolvedValueOnce(ok([]));
    expect(await spendCreditDetailed(BASE, H, "e1", 2_000, "o", f as never)).toEqual({ spent: 0, outcome: "error" });
  });
});

describe("creditSpentOnOrders and releaseCredit with late re-spends", () => {
  it("folds the :late re-spend into the order's net spend", async () => {
    const r0 = router(spentRoute([
      { amount: -2_000, order_ref: "o1" }, { amount: 2_000, order_ref: "o1" }, { amount: -2_000, order_ref: "o1:late" },
    ]));
    expect((await creditSpentOnOrders(BASE, H, "e1", ["o1"], r0.f as never))?.get("o1")).toBe(2_000);
  });

  it("releases the original and the late spend separately, once each", async () => {
    const r0 = router(spentRoute([{ amount: -2_000, order_ref: "o1" }, { amount: -500, order_ref: "o1:late" }]));
    await releaseCredit(BASE, H, "e1", "o1", r0.f as never);
    expect(r0.ledgerPosts().map((c) => c.body)).toEqual([
      expect.objectContaining({ kind: "release", amount: 2_000, order_ref: "o1" }),
      expect.objectContaining({ kind: "release", amount: 500, order_ref: "o1:late" }),
    ]);
  });
});

describe("clawbackOrderCredit", () => {
  const order = { razorpay_order_id: "order_1", employer_id: "e1", requirement_id: "req-1" };
  const refundRows = (u: string) => (u.includes("kind=in.(refund,conversion)") ? ok([{ amount: 2_990, match_id: "m1" }, { amount: 2_990, match_id: "m2" }]) : undefined);

  it("writes one negative clawback row per credited candidate under its own ref", async () => {
    const r0 = router((u) => refundRows(u));
    const r = await clawbackOrderCredit({ base: BASE, headers: H, order, reason: "payment_refunded", releaseSpent: false, fetchImpl: r0.f as never });
    expect(r).toEqual({ ok: true, clawedBackPaise: 5_980, rows: 2 });
    expect(r0.ledgerPosts().map((c) => c.body)).toEqual([
      expect.objectContaining({ kind: "clawback", reason: "payment_refunded", amount: -2_990, match_id: "m1", order_ref: "clawback:order_1:m1" }),
      expect.objectContaining({ kind: "clawback", reason: "payment_refunded", amount: -2_990, match_id: "m2", order_ref: "clawback:order_1:m2" }),
    ]);
  });

  it("a replay (409 on every row) claws back nothing more and is still ok", async () => {
    const r0 = router((u) => refundRows(u), ledgerPost(409));
    expect(await clawbackOrderCredit({ base: BASE, headers: H, order, reason: "payment_refunded", releaseSpent: false, fetchImpl: r0.f as never })).toEqual({ ok: true, clawedBackPaise: 0, rows: 0 });
  });

  it("a full refund also releases the credit spent on the order; a dispute loss does not", async () => {
    const spent = spentRoute([{ amount: -1_000, order_ref: "order_1" }]);
    const full = router((u) => refundRows(u), spent);
    await clawbackOrderCredit({ base: BASE, headers: H, order, reason: "payment_refunded", releaseSpent: true, fetchImpl: full.f as never });
    expect(full.ledgerPosts().some((c) => c.body?.kind === "release")).toBe(true);
    const dispute = router((u) => refundRows(u), spent);
    await clawbackOrderCredit({ base: BASE, headers: H, order, reason: "payment_disputed", releaseSpent: false, fetchImpl: dispute.f as never });
    expect(dispute.ledgerPosts().some((c) => c.body?.kind === "release")).toBe(false);
  });

  it("reverses a late-payment conversion row as well", async () => {
    const r0 = router((u) => (u.includes("kind=in.(refund,conversion)") ? ok([{ amount: 5_900, match_id: null }]) : undefined));
    const r = await clawbackOrderCredit({ base: BASE, headers: H, order, reason: "payment_refunded", releaseSpent: false, fetchImpl: r0.f as never });
    expect(r.clawedBackPaise).toBe(5_900);
    expect(r0.ledgerPosts()[0].body).toMatchObject({ amount: -5_900, order_ref: "clawback:order_1:convert" });
  });

  it("reports ok:false on a failed write so the webhook is redelivered", async () => {
    const r0 = router((u) => refundRows(u), ledgerPost(500));
    expect((await clawbackOrderCredit({ base: BASE, headers: H, order, reason: "payment_refunded", releaseSpent: false, fetchImpl: r0.f as never })).ok).toBe(false);
  });

  it("tolerates migration 0042 being unapplied (check constraint) without retrying forever", async () => {
    const { slog } = await import("../../server-handlers/_shared");
    const r0 = router(
      (u) => refundRows(u),
      (u, m) => (m === "POST" && u.includes("/employer_credit_ledger") ? { ok: false, status: 400, json: async () => ({}), text: async () => 'new row violates check constraint "employer_credit_ledger_kind_check" 23514' } : undefined),
    );
    const r = await clawbackOrderCredit({ base: BASE, headers: H, order, reason: "payment_refunded", releaseSpent: false, fetchImpl: r0.f as never });
    expect(r.ok).toBe(true);
    expect(slog.error).toHaveBeenCalledWith(expect.stringContaining("migration 0042"), expect.anything());
  });

  it("is a no-op when the ledger table is missing", async () => {
    const r0 = router((u) => (u.includes("kind=in.(refund,conversion)") ? ok({}, 404) : undefined));
    expect(await clawbackOrderCredit({ base: BASE, headers: H, order, reason: "payment_refunded", releaseSpent: true, fetchImpl: r0.f as never })).toEqual({ ok: true, clawedBackPaise: 0, rows: 0 });
  });
});

describe("ensureCreditSpent", () => {
  const order = { razorpay_order_id: "order_1", employer_id: "e1", amount: 3_900, requirement_id: "req-1" };
  const applied = (v: number | null): RouteFn => (u) => (u.includes("select=credit_applied_paise") ? ok(v === null ? [{}] : [{ credit_applied_paise: v }]) : undefined);

  it("passes legacy orders without a stored credit_applied_paise untouched", async () => {
    const r0 = router(applied(null));
    expect(await ensureCreditSpent({ base: BASE, headers: H, order, fetchImpl: r0.f as never })).toEqual({ state: "ok", creditSpentPaise: 0 });
  });

  it("is ok when the intended credit is still spent", async () => {
    const r0 = router(applied(2_000), spentRoute([{ amount: -2_000, order_ref: "order_1" }]));
    expect(await ensureCreditSpent({ base: BASE, headers: H, order, fetchImpl: r0.f as never })).toEqual({ state: "ok", creditSpentPaise: 2_000 });
    expect(r0.calls.some((c) => c.url.includes("/rpc/"))).toBe(false);
  });

  it("re-spends credit the reconciler released, under the :late ref", async () => {
    const r0 = router(
      applied(2_000),
      spentRoute([{ amount: -2_000, order_ref: "order_1" }, { amount: 2_000, order_ref: "order_1" }]),
      (u) => (u.includes("/rpc/spend_employer_credit") ? ok(2_000) : undefined),
    );
    expect(await ensureCreditSpent({ base: BASE, headers: H, order, fetchImpl: r0.f as never })).toEqual({ state: "ok", creditSpentPaise: 2_000 });
    const rpc = r0.calls.find((c) => c.url.includes("/rpc/spend_employer_credit"));
    expect(rpc?.body).toMatchObject({ p_amount: 2_000, p_order_ref: "order_1:late" });
  });

  it("converts the cash to credit when the balance can no longer cover the credit", async () => {
    const r0 = router(
      applied(2_000),
      spentRoute([{ amount: -2_000, order_ref: "order_1" }, { amount: 2_000, order_ref: "order_1" }]),
      (u) => (u.includes("/rpc/spend_employer_credit") ? ok(0) : undefined),
    );
    expect(await ensureCreditSpent({ base: BASE, headers: H, order, fetchImpl: r0.f as never })).toEqual({ state: "converted", creditPaise: 3_900 });
    expect(r0.ledgerPosts().map((c) => c.body)).toContainEqual(expect.objectContaining({ kind: "conversion", reason: "late_payment", amount: 3_900, order_ref: "order_1:convert" }));
  });

  it("returns error (retry later) when the spend or ledger read fails", async () => {
    const spendFails = router(applied(2_000), spentRoute([]), (u) => (u.includes("/rpc/spend_employer_credit") ? ok({}, 500) : undefined));
    expect(await ensureCreditSpent({ base: BASE, headers: H, order, fetchImpl: spendFails.f as never })).toEqual({ state: "error" });
    const readFails = router(applied(2_000), (u) => (u.includes("kind=in.(spend,release)") ? ok({}, 500) : undefined));
    expect(await ensureCreditSpent({ base: BASE, headers: H, order, fetchImpl: readFails.f as never })).toEqual({ state: "error" });
  });

  it("returns error rather than a silent success when the conversion row cannot be written", async () => {
    const r0 = router(applied(2_000), spentRoute([]), (u) => (u.includes("/rpc/spend_employer_credit") ? ok(0) : undefined), ledgerPost(500));
    expect(await ensureCreditSpent({ base: BASE, headers: H, order, fetchImpl: r0.f as never })).toEqual({ state: "error" });
  });
});

describe("toCreditEvents", () => {
  it("labels refunds, clawbacks, conversions, spends and releases", () => {
    const row = (kind: string, reason: string | null) => ({ amount: 100, kind, reason, match_id: null, order_ref: null, created_at: "2026-10-01T00:00:00Z" });
    const labels = toCreditEvents([
      row("refund", "declined"), row("clawback", "payment_refunded"), row("conversion", "late_payment"), row("spend", null), row("release", null),
    ] as never).map((e) => e.label);
    expect(labels).toEqual(["Candidate declined", "Reversed: Payment refunded", "Late payment kept as credit", "Applied to an unlock", "Returned: unlock not completed"]);
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
