import { describe, it, expect, vi } from "vitest";
import { readAllPages, readAllPagesOrMissing, readPage, RestReadError, type RestGet } from "../../server-handlers/_paged-fetch";
import { getEmployerFinancials } from "../../server-handlers/_admin-employer-financials";
import { listEmployers } from "../../server-handlers/_admin-employers";

const res = (body: unknown, ok = true, status = ok ? 200 : 500) => ({ ok, status, json: async () => body }) as unknown as Response;
const rows = (n: number, from = 0) => Array.from({ length: n }, (_, i) => ({ id: from + i }));

describe("readAllPages", () => {
  it("pages past the 1000-row cap using offset and limit", async () => {
    const get = vi.fn<RestGet>(async (path) => {
      const off = Number(/offset=(\d+)/.exec(path)?.[1]);
      return res(off === 0 ? rows(1000) : off === 1000 ? rows(1000, 1000) : rows(250, 2000));
    });
    const out = await readAllPages<{ id: number }>(get, "t?select=id&order=id.asc");
    expect(out.rows).toHaveLength(2250);
    expect(out.truncated).toBe(false);
    expect(get.mock.calls.map((c) => c[0])).toEqual([
      "t?select=id&order=id.asc&offset=0&limit=1000",
      "t?select=id&order=id.asc&offset=1000&limit=1000",
      "t?select=id&order=id.asc&offset=2000&limit=1000",
    ]);
  });

  it("flags truncated when the row cap is hit on a full page", async () => {
    const get: RestGet = async () => res(rows(1000));
    const out = await readAllPages(get, "t?order=id", { maxRows: 2000 });
    expect(out.rows).toHaveLength(2000);
    expect(out.truncated).toBe(true);
  });

  it("is not truncated when the last page exactly fills nothing more", async () => {
    const get: RestGet = async (p) => res(p.includes("offset=0") ? rows(10) : []);
    expect((await readAllPages(get, "t?order=id")).truncated).toBe(false);
  });

  it("throws on a failed page rather than returning a partial read", async () => {
    let n = 0;
    const get: RestGet = async () => (n++ === 0 ? res(rows(1000)) : res({ message: "boom" }, false, 503));
    await expect(readAllPages(get, "t?order=id")).rejects.toBeInstanceOf(RestReadError);
  });

  it("throws on a network error and a non-array body", async () => {
    await expect(readPage(async () => { throw new Error("net"); }, "t")).rejects.toThrow(/net/);
    await expect(readPage(async () => res({ not: "array" }), "t")).rejects.toThrow(/non-array/);
  });
});

describe("readAllPagesOrMissing", () => {
  it("returns null for a not-migrated table or column and rethrows real failures", async () => {
    for (const code of ["PGRST205", "PGRST204", "42P01", "42703"]) {
      expect(await readAllPagesOrMissing(async () => res({ code }, false, 400), "t?order=id")).toBeNull();
    }
    await expect(readAllPagesOrMissing(async () => res({ code: "XX000" }, false, 500), "t?order=id")).rejects.toBeInstanceOf(RestReadError);
    await expect(readAllPagesOrMissing(async () => res({}, false, 500), "t?order=id")).rejects.toBeInstanceOf(RestReadError);
  });
});

describe("getEmployerFinancials degraded and truncated reporting", () => {
  const pay = (i: number) => ({ id: i, employer_id: "e1", amount: 100, created_at: new Date().toISOString() });
  const route = (o: { payments?: () => Response; orders?: (p: string) => Response; ledger?: () => Response }): RestGet => async (p) => {
    if (p.startsWith("employer_unlock_payments")) return o.payments ? o.payments() : res([]);
    if (p.startsWith("employer_unlock_orders")) return o.orders ? o.orders(p) : res([]);
    if (p.startsWith("employer_credit_ledger")) return o.ledger ? o.ledger() : res([]);
    return res([{ id: "e1", company_name: "Acme" }]);
  };

  it("is clean when every read succeeds", async () => {
    const f = await getEmployerFinancials(route({ payments: () => res([pay(1)]) }));
    expect(f).toMatchObject({ degraded: false, readErrors: [], truncated: false });
    expect(f.revenue.lifetimePaise).toBe(100);
  });

  it("reports a read outage as degraded instead of showing silent zeros", async () => {
    const f = await getEmployerFinancials(route({ payments: () => res({}, false, 503), orders: () => res({}, false, 503) }));
    expect(f.degraded).toBe(true);
    expect(f.readErrors).toEqual(expect.arrayContaining(["payments", "orders"]));
    expect(f.readErrors).not.toContain("credit ledger");
  });

  it("treats a not-migrated ledger as unavailable, not as a failure", async () => {
    const f = await getEmployerFinancials(route({ ledger: () => res({ code: "PGRST205" }, false, 404) }));
    expect(f.degraded).toBe(false);
    expect(f.credit.ledgerAvailable).toBe(false);
  });

  it("falls back when refund_due_paise is not migrated and reports it as untracked, without degrading", async () => {
    const f = await getEmployerFinancials(route({
      orders: (p) => (p.includes("refund_due_paise") ? res({ code: "42703" }, false, 400) : res([])),
    }));
    expect(f.degraded).toBe(false);
    expect(f.refundDue.tracked).toBe(false);
  });

  it("flags truncation when the payments table exceeds the cap", async () => {
    const pages = Array.from({ length: 50 }, (_, i) => i);
    let call = 0;
    const f = await getEmployerFinancials(route({
      payments: () => { call++; return res(pages.length && call <= 50 ? Array.from({ length: 1000 }, (_, i) => pay(i)) : []); },
    }));
    expect(f.truncated).toBe(true);
    expect(f.truncatedSources).toContain("payments");
  });
});

describe("listEmployers degraded reporting", () => {
  it("surfaces a failed source rather than returning an empty list as if complete", async () => {
    const get: RestGet = async (p) => {
      if (p.startsWith("employers?")) return res([{ id: "e1", company_name: "Acme", website: null, verification_tier: "basic", verified_at: null, suspended_at: null, suspended_reason: null, submitted_at: null }]);
      if (p.startsWith("employer_reports")) return res({}, false, 500);
      return res([]);
    };
    const out = await listEmployers(get);
    expect(out.total).toBe(1);
    expect(out.degraded).toBe(true);
    expect(out.readErrors).toContain("reports");
  });

  it("is not degraded when all reads succeed", async () => {
    const out = await listEmployers(async () => res([]));
    expect(out).toMatchObject({ degraded: false, truncated: false, total: 0 });
  });
});
